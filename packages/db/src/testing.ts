import { PGlite } from '@electric-sql/pglite'
import { readMigrations } from './index.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/*
 * @brief The parts of a Supabase database the migrations depend on but do not create.
 * @details Mirrors what a hosted project already provides: the `auth` schema with
 *   its users table and uid() helper, and the anon/authenticated/service_role
 *   roles that carry table privileges. Default privileges are granted before the
 *   migrations run so tables created by them are reachable by `authenticated`,
 *   matching hosted behaviour.
 */
const SUPABASE_PRELUDE = `
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
  language sql stable
  as $fn$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $fn$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
`

export interface TestDb {
  /*
   * @brief The underlying database, acting as the superuser unless inside asUser.
   */
  pg: PGlite
  /*
   * @brief Create an auth user and its mirrored profile row.
   * @param email Address to register; must be unique within the database.
   * @return The new user's id.
   */
  createUser(email: string): Promise<string>
  /*
   * @brief Run queries with the privileges and identity of one authenticated user.
   * @details Row level security applies inside the callback and does not outside
   *   it, so setup can be done as the superuser and only the assertions run as
   *   the user.
   * @param userId The user to impersonate.
   * @param fn Receives the database; every query it runs is subject to RLS.
   * @return Whatever the callback returns.
   */
  asUser<T>(userId: string, fn: (pg: PGlite) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/*
 * @brief Boot an in-memory Postgres with the Supabase prelude and all migrations applied.
 * @details Uses PGlite, so no Docker or external server is required. Each call
 *   returns an isolated database.
 * @return A handle for querying as the superuser or as a specific user.
 */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite()
  await pg.exec(SUPABASE_PRELUDE)
  for (const migration of readMigrations()) {
    try {
      await pg.exec(migration.sql)
    } catch (cause) {
      throw new Error(`migration ${migration.name} failed`, { cause })
    }
  }

  return {
    pg,

    async createUser(email: string): Promise<string> {
      const result = await pg.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      )
      const row = result.rows[0]
      if (row === undefined) throw new Error(`failed to create user ${email}`)
      return row.id
    },

    async asUser<T>(userId: string, fn: (pg: PGlite) => Promise<T>): Promise<T> {
      if (!UUID_PATTERN.test(userId)) throw new Error(`not a user id: ${userId}`)
      await pg.exec(`set request.jwt.claims = '{"sub":"${userId}"}'; set role authenticated;`)
      try {
        return await fn(pg)
      } finally {
        await pg.exec('reset role; reset request.jwt.claims;')
      }
    },

    async close(): Promise<void> {
      await pg.close()
    },
  }
}
