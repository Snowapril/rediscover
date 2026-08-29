import { useState, type ChangeEvent } from 'react'
import { readBookmarkExport, requiredFolderPaths, type ImportReading } from '@rediscover/core'
import type { ImportProgress, ImportResult } from '@rediscover/api-client'
import { useImportScraps } from '../data/queries.ts'
import type { View } from '../view.ts'

interface Props {
  userId: string
  onDone(view: View): void
}

/*
 * @brief Bring a library across from another bookmark manager.
 * @details The file is read and summarised before anything is written, because
 *   an import that turns out to have found the wrong column is much cheaper to
 *   abandon than to undo.
 * @param userId The owner of everything the import creates.
 * @param onDone Called with the view to move to once the import finishes.
 */
export function ImportView({ userId, onDone }: Props) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState<ImportReading | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importScraps = useImportScraps()

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file === undefined) return

    setError(null)
    setResult(null)
    setProgress(null)
    setFileName(file.name)

    try {
      setReading(readBookmarkExport(await file.text()))
    } catch (cause) {
      setReading(null)
      setError(cause instanceof Error ? cause.message : 'Could not read that file.')
    }
  }

  function start() {
    if (reading === null) return
    setError(null)
    importScraps.mutate(
      { userId, scraps: reading.scraps, onProgress: setProgress },
      {
        onSuccess: (outcome) => {
          setResult(outcome)
          setReading(null)
          setProgress(null)
        },
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'The import did not finish.'),
      },
    )
  }

  const folderCount = reading === null ? 0 : requiredFolderPaths(reading.scraps).length

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Import</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Bring a library across from Raindrop.io or another bookmark manager. Export it as CSV and
        drop the file here — folders, tags, notes and save dates come with it.
      </p>

      <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-6 text-sm hover:border-accent">
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          onChange={(event) => void handleFile(event)}
          className="sr-only"
        />
        <span className="font-medium">Choose a file</span>
        <span className="text-muted">{fileName ?? 'No file chosen'}</span>
      </label>

      {error !== null && <p className="mt-3 text-sm text-accent">{error}</p>}

      {reading !== null && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-4">
          {reading.scraps.length === 0 ? (
            <>
              <p className="text-sm font-medium">Nothing to import from this file.</p>
              <p className="mt-1 text-sm text-muted">
                No column held a web address. The file has{' '}
                {reading.columns.length === 0
                  ? 'no columns at all'
                  : `these columns: ${reading.columns.join(', ')}`}
                . A column named url, link or href is what the import looks for.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {reading.scraps.length} {reading.scraps.length === 1 ? 'link' : 'links'} ready
                {folderCount > 0 && `, in ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`}
              </p>
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {reading.duplicateRows > 0 && (
                  <li>
                    {reading.duplicateRows} repeated{' '}
                    {reading.duplicateRows === 1 ? 'row was' : 'rows were'} collapsed into the first
                    copy.
                  </li>
                )}
                {reading.unusableRows > 0 && (
                  <li>
                    {reading.unusableRows} {reading.unusableRows === 1 ? 'row' : 'rows'} carried no
                    usable web address and will be left out.
                  </li>
                )}
                <li>Links already in your library will be left as they are.</li>
              </ul>

              <button
                type="button"
                onClick={start}
                disabled={importScraps.isPending}
                className="mt-4 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
              >
                {importScraps.isPending ? 'Importing…' : 'Start import'}
              </button>

              {progress !== null && (
                <p className="mt-3 text-sm text-muted" aria-live="polite">
                  {progress.imported} saved
                  {progress.skipped > 0 && `, ${progress.skipped} already had`} ·{' '}
                  {progress.remaining} to go
                </p>
              )}
            </>
          )}
        </div>
      )}

      {result !== null && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-medium">Import finished.</p>
          <p className="mt-1 text-sm text-muted">
            {result.imported} {result.imported === 1 ? 'link' : 'links'} saved
            {result.foldersCreated > 0 &&
              `, ${result.foldersCreated} ${result.foldersCreated === 1 ? 'folder' : 'folders'} created`}
            {result.skipped > 0 && `, ${result.skipped} already in your library`}.
          </p>
          <button
            type="button"
            onClick={() => onDone({ kind: 'folders' })}
            className="mt-3 text-sm underline underline-offset-4"
          >
            See your folders
          </button>
        </div>
      )}
    </section>
  )
}
