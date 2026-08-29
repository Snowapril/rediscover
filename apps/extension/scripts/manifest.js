import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The manifest is hand-written rather than generated: it is the extension's
// permission contract, and it should be reviewable as a plain file.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'dist'), { recursive: true })
copyFileSync(join(root, 'manifest.json'), join(root, 'dist', 'manifest.json'))
console.log('manifest.json -> dist/')
