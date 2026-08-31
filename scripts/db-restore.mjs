/*
 * Loads a copy taken by db:reset back into the local database.
 *
 * The dump is data only, so the schema must already be in place — which after a
 * reset it is. Rows that are already there are left alone rather than
 * conflicting, so restoring twice is harmless.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2]
if (file === undefined || !existsSync(file)) {
  console.error('Usage: npm run db:restore <file from supabase/backups>')
  process.exit(1)
}

execFileSync('docker', ['exec', '-i', 'supabase_db_rediscover', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=0', '-q'], {
  input: readFileSync(file),
  stdio: ['pipe', 'inherit', 'inherit'],
})

console.log(`Restored from ${file}`)
