/*
 * Resets the local database, taking a copy of the data first.
 *
 * `supabase db reset` drops the database and replays the migrations. That is the
 * right thing while a migration is being written and a disaster once the local
 * database holds a library somebody actually imported — and the two are the same
 * command typed the same way, run from the same habit.
 *
 * So the copy is not optional and not a flag to remember. Every reset writes one
 * first, and prints how to put it back.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CONTAINER = 'supabase_db_rediscover'
const BACKUPS = 'supabase/backups'

function inDatabase(sql) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' },
  ).trim()
}

function running() {
  try {
    inDatabase('select 1')
    return true
  } catch {
    return false
  }
}

if (!running()) {
  console.log('The database is not running; nothing to back up.')
  execFileSync('npx', ['supabase', 'db', 'reset'], { stdio: 'inherit' })
  process.exit(0)
}

const rows = Number(
  inDatabase(
    `select coalesce((select count(*) from public.items), 0) + coalesce((select count(*) from auth.users), 0)`,
  ),
)

if (rows > 0) {
  mkdirSync(BACKUPS, { recursive: true })
  // Both schemas: the scraps are worth nothing without the account that owns
  // them, since every row is reachable only through its user.
  const dump = execFileSync(
    'docker',
    [
      'exec',
      CONTAINER,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--data-only',
      '--schema=public',
      '--schema=auth',
      '--column-inserts',
      '--on-conflict-do-nothing',
    ],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  )

  const stamp = inDatabase(`select to_char(now(), 'YYYY-MM-DD_HH24-MI-SS')`)
  const file = join(BACKUPS, `${stamp}.sql`)
  writeFileSync(file, dump)
  console.log(`Copied ${rows} rows of data to ${file}`)
  console.log(`Put it back with:  npm run db:restore ${file}`)
} else {
  console.log('The database holds no data; resetting without a copy.')
}

execFileSync('npx', ['supabase', 'db', 'reset'], { stdio: 'inherit' })

if (rows > 0) {
  console.log('')
  console.log('The reset emptied the database. The copy above is how to get it back.')
}

if (!existsSync(BACKUPS)) process.exit(0)
