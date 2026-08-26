import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations')

export interface Migration {
  name: string
  sql: string
}

/*
 * @brief Read every SQL migration from supabase/migrations in filename order.
 * @details Filenames are zero-padded and sorted lexicographically, which is the
 *   order they must be applied in.
 * @return The migrations, oldest first.
 */
export function readMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }))
}
