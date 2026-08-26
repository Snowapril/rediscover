# rediscover

Scrap links, organize them into folders, and actually come back and read them.

Bookmark managers are good at collecting and bad at getting you to return. rediscover
treats reading as the thing worth tracking: whether an item has been read is a first-class
property, a reminder can pull a forgotten item back to the surface, and each folder is
sorted by a script you write and that follows your account to every device.

Status: early. The schema, the local development stack, and email sign in exist. The
collection tree, item list, metadata extraction, the script engine, the browser extension,
and the desktop and mobile clients do not yet.

## Layout

| Path | What it is |
| --- | --- |
| `packages/core` | Domain logic with no database or browser dependency: URL canonicalization, item property merging |
| `packages/db` | Postgres schema, row level security policies, and an in-process test harness |
| `packages/api-client` | Supabase client typed against the generated schema |
| `apps/web` | Vite and React web client |
| `supabase/` | Migrations, local stack configuration, edge functions |

## Running it locally

Requires Node 22 and a Docker runtime (Docker Desktop, Colima, or Podman) for the
Supabase stack.

```sh
npm install
npm run db:start                      # starts Postgres, Auth, Storage, Studio
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace @rediscover/web
```

The app is then at http://127.0.0.1:5173 and Supabase Studio at http://127.0.0.1:54323.
Sign in with any email and password; the local stack does not send confirmation mail.

## Checks

```sh
npm run lint
npm run typecheck
npm test        # 39 tests, including the schema suite
npm run build
```

The schema suite applies every migration to an in-process Postgres (PGlite) and asserts
that one user cannot read, forge, update, or delete another user's rows. It needs no
Docker and no hosted project, so it runs in CI unchanged.

After changing a migration, regenerate the database types:

```sh
npm run db:reset
npm run db:types
```
