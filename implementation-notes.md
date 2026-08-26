# Implementation Notes

Working notes kept while implementing the plan at
`~/.claude/plans/buzzing-snuggling-island.md`.

## Deviations

### npm workspaces instead of pnpm workspaces

**Planned:** pnpm workspaces + Turborepo.
**Done:** npm workspaces + Turborepo.
**Why:** pnpm is not installed on this machine. Installing it globally needs sudo
(`/usr/local/lib/node_modules` is root-owned), and the bundled corepack ships
expired npm signing keys, so `corepack pnpm` only works with integrity
verification disabled. npm 10 is already present and supports workspaces, so it
was the option that changed the least. Switching to pnpm later is a
`pnpm-workspace.yaml` plus a regenerated lockfile.

### Duplicate detection uses an md5 index, not a url_hash column

**Planned:** a `url_hash` column with `unique (user_id, url_hash)`.
**Done:** `create unique index items_user_canonical_url_key on items (user_id,
md5(canonical_url)) where deleted_at is null`.
**Why:** the same guarantee with one less column to keep in sync, using a
built-in function rather than the pgcrypto extension. Hashing is still needed
because a long URL would exceed the btree key size limit. The index is partial so
a trashed link can be scrapped again. `canonicalizeUrl` in `@rediscover/core`
therefore has no hashing counterpart.

### Schema tests run on PGlite, not `supabase db reset`

**Planned:** verify with `supabase db reset`.
**Done:** `@rediscover/db` boots PGlite (Postgres compiled to WASM) in-process,
applies a small Supabase prelude (`auth` schema, `auth.uid()`, the anon /
authenticated / service_role roles and their default privileges), then applies
every migration.
**Why:** neither Docker nor a local Postgres is available on this machine, and
the Supabase CLI needs Docker to run the local stack. PGlite is real Postgres, so
the migrations and the RLS policies are exercised for real, offline and in about
a second. The migrations remain plain SQL and apply unchanged to a hosted
project.

### Generated database types deferred to M1

**Planned:** generate DB types into `packages/core` during M0.
**Done:** not generated. `packages/db` is where they will land.
**Why:** `supabase gen types` needs a linked project or a running local stack,
neither of which exists yet. `packages/core` stays free of database concerns and
usable from the browser, the extension and React Native.

### zod schemas deferred to M1

**Planned:** zod schemas in `packages/core` during M0.
**Done:** hand-written TypeScript types only.
**Why:** the first thing that needs runtime validation is the metadata extractor,
which arrives in M1. Adding schemas with no caller would be guesswork about their
shape.

### Social sign in deferred to a later milestone

**Planned:** Google, Apple and Kakao sign in during M1.
**Done:** the provider blocks sit in `supabase/config.toml` with `enabled =
false`; local development signs in with email and password, which the local
stack supports with no confirmation step.
**Why:** the user chose to postpone account linking. Registering the Google and
Kakao applications is prerequisite work that does not block the rest of M1, and
the application only ever sees a Supabase Auth session, so turning a provider on
later changes the sign in screen and nothing else.

### An already-merged migration was edited rather than superseded

**Planned:** treat migrations as immutable once merged.
**Done:** `20260826180000_init.sql` was edited in place to change the items
foreign key from `on delete set null` to `on delete set null (collection_id)`.
**Why:** the unqualified form nulls *every* column of the composite key,
including `user_id`, which is NOT NULL — so deleting a folder that held any item
failed outright. No database anywhere had this migration applied except throwaway
ones: CI builds from scratch each run, and a developer's local stack is restored
with `npm run db:reset`. Adding a corrective migration would have left permanent
noise for a same-day mistake. Once a hosted project exists this option is gone
and a new migration becomes the only correct route.
