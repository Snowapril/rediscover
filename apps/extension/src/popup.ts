import { parseMetadata } from '@rediscover/core/extract'
import {
  applyExtractedMetadata,
  createItem,
  createRediscoverClient,
  findLiveItemByUrl,
  listCollections,
  setItemCollection,
  type CollectionRow,
  type ItemRow,
  type RediscoverClient,
} from '@rediscover/api-client'
import { STORAGE_KEY, type SharedSession } from './messages.ts'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const APP_URL = import.meta.env.VITE_APP_URL

const status = document.getElementById('status') as HTMLParagraphElement
const detail = document.getElementById('detail') as HTMLParagraphElement
const card = document.getElementById('card') as HTMLDivElement
const thumbnail = document.getElementById('thumbnail') as HTMLImageElement
const titleLine = document.getElementById('title') as HTMLDivElement
const siteLine = document.getElementById('site') as HTMLDivElement
const folderLabel = document.getElementById('folder-label') as HTMLLabelElement
const folderSelect = document.getElementById('folder') as HTMLSelectElement
const openButton = document.getElementById('open') as HTMLButtonElement

function show(element: HTMLElement, visible: boolean): void {
  element.classList.toggle('hidden', !visible)
}

function say(headline: string, note?: string, isError = false): void {
  status.textContent = headline
  status.classList.toggle('error', isError)
  detail.textContent = note ?? ''
  show(detail, note !== undefined)
}

/*
 * @brief Read the page in the tab as the browser has it.
 * @details The rendered markup, not what the server would hand an anonymous
 *   fetch — which is the whole reason to extract from the extension. It reaches
 *   pages behind a login and pages that build themselves with script, and it
 *   needs no permission beyond the tab the user is acting on.
 * @param tabId The tab to read.
 * @return The page's markup, or null if the tab refused to be read.
 */
async function readPage(tabId: number): Promise<string | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    })
    return typeof injection?.result === 'string' ? injection.result : null
  } catch {
    return null
  }
}

function describe(item: ItemRow): void {
  titleLine.textContent = item.title ?? item.url
  siteLine.textContent = item.site_name ?? item.domain
  if (item.thumbnail_url === null) {
    show(thumbnail, false)
  } else {
    thumbnail.src = item.thumbnail_url
    thumbnail.referrerPolicy = 'no-referrer'
    thumbnail.onerror = () => show(thumbnail, false)
    show(thumbnail, true)
  }
  show(card, true)
}

function offerFolders(
  client: RediscoverClient,
  item: ItemRow,
  collections: readonly CollectionRow[],
): void {
  const byId = new Map(collections.map((collection) => [collection.id, collection]))
  const pathOf = (collection: CollectionRow): string => {
    const parent = collection.parent_id === null ? null : byId.get(collection.parent_id)
    return parent === undefined || parent === null
      ? collection.name
      : `${pathOf(parent)} / ${collection.name}`
  }

  folderSelect.replaceChildren()
  const inbox = new Option('Inbox', '')
  folderSelect.append(inbox)

  const sorted = [...collections].sort((a, b) => pathOf(a).localeCompare(pathOf(b)))
  for (const collection of sorted) {
    folderSelect.append(new Option(pathOf(collection), collection.id))
  }
  folderSelect.value = item.collection_id ?? ''

  folderSelect.addEventListener('change', () => {
    const target = folderSelect.value === '' ? null : folderSelect.value
    void setItemCollection(client, item.id, target).then(
      () => say('Saved', folderSelect.value === '' ? 'In your inbox.' : 'Moved.'),
      (cause: unknown) =>
        say('Saved, but not moved', cause instanceof Error ? cause.message : undefined, true),
    )
  })

  show(folderLabel, true)
}

async function run(): Promise<void> {
  openButton.addEventListener('click', () => {
    void chrome.tabs.create({ url: APP_URL })
  })

  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const session = stored[STORAGE_KEY] as SharedSession | null | undefined

  if (session === null || session === undefined) {
    say('Not signed in', 'Open rediscover and sign in; this reconnects on its own.')
    openButton.textContent = 'Open rediscover'
    show(openButton, true)
    return
  }

  const client = createRediscoverClient(SUPABASE_URL, SUPABASE_KEY)
  const { error: sessionError } = await client.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  })
  if (sessionError !== null) {
    say('Session expired', 'Open rediscover to sign in again.', true)
    show(openButton, true)
    return
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url
  if (tab?.id === undefined || url === undefined) {
    say('Nothing to save', 'This tab has no address.', true)
    return
  }

  try {
    const collections = await listCollections(client)

    const existing = await findLiveItemByUrl(client, url)
    if (existing !== null) {
      const folder = collections.find((collection) => collection.id === existing.collection_id)
      say('Already saved', folder === undefined ? 'In your inbox.' : `In ${folder.name}.`)
      describe(existing)
      offerFolders(client, existing, collections)
      show(openButton, true)
      return
    }

    const item = await createItem(client, {
      userId: session.userId,
      collectionId: null,
      url,
    })

    say('Saved', 'Reading the page…')
    describe(item)

    const html = await readPage(tab.id)
    const filled =
      html === null
        ? item
        : await applyExtractedMetadata(
            client,
            item,
            parseMetadata(new DOMParser().parseFromString(html, 'text/html'), url),
          )

    describe(filled)
    say('Saved', html === null ? 'This page would not let itself be read.' : 'In your inbox.')
    offerFolders(client, filled, collections)
    show(openButton, true)
  } catch (cause) {
    say('Could not save', cause instanceof Error ? cause.message : String(cause), true)
    show(openButton, true)
  }
}

void run()
