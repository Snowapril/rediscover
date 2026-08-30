import releaseSync from '@jitl/quickjs-wasmfile-release-sync'
import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core'
import type { ScriptItem } from '@rediscover/core'
import { HARNESS } from './harness.ts'

/*
 * @brief What a sort script may return for an item.
 * @details Scalars compare directly; an array compares element by element, which
 *   is how a script expresses "by this, then by that".
 */
export type SortKey = number | string | boolean | null | readonly SortKey[]

/*
 * @brief One function a script may export, and what its values must look like.
 */
export interface ExportSpec {
  name: string
  /*
   * @brief `sortKey` for a value to order by, `label` for a category name.
   */
  kind: 'sortKey' | 'label'
  /*
   * @brief Whether the script is wrong without it.
   */
  required: boolean
}

/*
 * @brief What each requested export returned, keyed by its name.
 * @details An export the script does not define is absent rather than empty, so
 *   a caller can tell "the script has no categories" from "every scrap is
 *   uncategorised".
 */
export type ExportValues = Record<string, unknown[]>

export type ScriptOutcome<T> = { ok: true; values: T } | { ok: false; message: string }

export interface RunLimits {
  /*
   * @brief How long the script may run before it is stopped.
   */
  timeoutMs: number
  /*
   * @brief How much memory the sandbox may allocate.
   */
  memoryBytes: number
}

/*
 * @brief Time allowed before the first scrap is even looked at.
 * @details Covers starting the sandbox, evaluating the script, and handing the
 *   scraps over.
 */
const BASE_TIMEOUT_MS = 250

/*
 * @brief Time allowed per scrap on top of that.
 * @details Roughly ten times what a key function costs on a slow machine, so a
 *   legitimate script has room while a runaway one is still stopped.
 */
const PER_ITEM_TIMEOUT_MS = 0.5

const DEFAULT_MEMORY_BYTES = 64 * 1024 * 1024

/*
 * @brief The limits a script runs under unless the caller says otherwise.
 * @details The budget grows with the folder, because the work legitimately
 *   does: evaluating a key function five thousand times is five thousand times
 *   the work of evaluating it once. A flat budget generous enough for a large
 *   folder would let a runaway script in a small one spin for just as long, and
 *   a flat budget tight enough for a small folder rejects a perfectly good
 *   script the moment somebody's folder grows — on a slower machine than the
 *   one it was tuned on.
 * @param itemCount How many scraps the script will see.
 * @return The time and memory it may use.
 */
export function defaultLimitsFor(itemCount: number): RunLimits {
  return {
    timeoutMs: BASE_TIMEOUT_MS + Math.ceil(itemCount * PER_ITEM_TIMEOUT_MS),
    memoryBytes: DEFAULT_MEMORY_BYTES,
  }
}

let modulePromise: Promise<QuickJSWASMModule> | null = null

/*
 * @brief Load the sandbox, once per process.
 * @details One variant is named rather than letting the umbrella package choose:
 *   it ships four, and a bundler that cannot tell which is wanted emits several
 *   megabytes of WebAssembly the browser will never run.
 * @return The WebAssembly module every run borrows a runtime from.
 */
function loadQuickJS(): Promise<QuickJSWASMModule> {
  modulePromise ??= newQuickJSWASMModuleFromVariant(releaseSync)
  return modulePromise
}

/*
 * @brief Run a user script's exported functions over every scrap.
 * @details The script is evaluated as a module in a fresh sandbox with no host
 *   bindings at all — no fetch, no timers, no module loader, nothing of the
 *   page it was launched from. It cannot reach the network or the database, so
 *   the worst a hostile script can do is waste the time and memory it is
 *   allowed, and it is stopped at both.
 *
 *   Every failure comes back as a message rather than an exception, because
 *   these are somebody's own scripts being written and rewritten: a broken one
 *   should say what is wrong under the editor, not break the folder.
 * @param source The script the user wrote.
 * @param exports The functions to call and what each must return.
 * @param items The scraps to run them over.
 * @param limits Time and memory the script may use.
 * @return One value per scrap per export, in the order given, or why it could
 *   not be run.
 */
export async function runExports(
  source: string,
  exports: readonly ExportSpec[],
  items: readonly ScriptItem[],
  limits: RunLimits = defaultLimitsFor(items.length),
): Promise<ScriptOutcome<ExportValues>> {
  const quickJS = await loadQuickJS()
  const runtime = quickJS.newRuntime()

  try {
    runtime.setMemoryLimit(limits.memoryBytes)

    const context = runtime.newContext()
    try {
      const harness = context.evalCode(HARNESS, 'harness.js')
      if (harness.error !== undefined) {
        const message = describeError(context.dump(harness.error))
        harness.error.dispose()
        return { ok: false, message: `The sandbox failed to start: ${message}` }
      }
      harness.value.dispose()

      // The clock starts only now. Loading this scaffolding is not the user's
      // script running, and letting it eat into the budget would both shorten
      // the time their script actually gets and — when the machine is loaded
      // enough — blame them for a deadline that expired before their first line
      // was read.
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + limits.timeoutMs))

      const userModule = context.evalCode(source, 'script.js', { type: 'module' })
      if (userModule.error !== undefined) {
        const message = describeError(context.dump(userModule.error))
        userModule.error.dispose()
        return { ok: false, message }
      }

      context.setProp(context.global, '__module', userModule.value)
      userModule.value.dispose()

      const json = context.newString(JSON.stringify(items))
      const prepare = context.getProp(context.global, '__prepare')
      const prepared = context.callFunction(prepare, context.undefined, json)
      json.dispose()
      prepare.dispose()
      if (prepared.error !== undefined) {
        prepared.error.dispose()
        return { ok: false, message: 'The scraps could not be handed to the script.' }
      }
      prepared.value.dispose()

      const spec = context.newString(JSON.stringify(exports))
      const run = context.getProp(context.global, '__run')
      const outcome = context.callFunction(run, context.undefined, spec)
      spec.dispose()
      run.dispose()

      if (outcome.error !== undefined) {
        const message = describeError(context.dump(outcome.error))
        outcome.error.dispose()
        return { ok: false, message }
      }

      const raw = context.getString(outcome.value)
      outcome.value.dispose()

      const parsed = JSON.parse(raw) as { results?: ExportValues; error?: string }
      if (parsed.error !== undefined) return { ok: false, message: parsed.error }
      return { ok: true, values: parsed.results ?? {} }
    } finally {
      context.dispose()
    }
  } catch (cause) {
    return { ok: false, message: describeError(cause) }
  } finally {
    runtime.dispose()
  }
}

/*
 * @brief Turn whatever the sandbox threw into a sentence worth showing.
 * @details An interrupt and an exhausted heap both surface as opaque objects, so
 *   they are recognised by name and given the explanation a person needs: what
 *   ran out, and that the script is the thing to change.
 * @param cause The thrown or dumped value.
 * @return A message for the editor.
 */
function describeError(cause: unknown): string {
  if (typeof cause === 'string') return cause

  if (typeof cause === 'object' && cause !== null) {
    const error = cause as { name?: unknown; message?: unknown }
    const name = typeof error.name === 'string' ? error.name : ''
    const message = typeof error.message === 'string' ? error.message : ''

    if (name === 'InternalError' && message.includes('interrupted')) {
      return 'The script ran too long and was stopped. Check for a loop that never ends.'
    }
    if (message.includes('out of memory')) {
      return 'The script used more memory than it is allowed.'
    }
    if (message !== '') return name === '' ? message : `${name}: ${message}`
  }

  return 'The script could not be run.'
}

/*
 * @brief Run one exported function, for callers that want only the one.
 * @param source The script the user wrote.
 * @param exportName The function to call.
 * @param items The scraps to run it over.
 * @param limits Time and memory the script may use.
 * @return One value per scrap, or why it could not be run.
 */
export async function runScript(
  source: string,
  exportName: string,
  items: readonly ScriptItem[],
  limits: RunLimits = defaultLimitsFor(items.length),
): Promise<ScriptOutcome<unknown[]>> {
  const kind = exportName === 'key' ? 'sortKey' : 'label'
  const outcome = await runExports(
    source,
    [{ name: exportName, kind, required: true }],
    items,
    limits,
  )
  if (!outcome.ok) return outcome
  return { ok: true, values: outcome.values[exportName] ?? [] }
}
