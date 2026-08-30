import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../src/testing.js'

let db: TestDb
let alice: string
let bob: string

beforeAll(async () => {
  db = await createTestDb()
  alice = await db.createUser('alice@example.com')
  bob = await db.createUser('bob@example.com')
}, 60_000)

afterAll(async () => {
  await db.close()
})

async function insertItem(userId: string, url: string, collectionId: string | null = null) {
  const result = await db.pg.query<{ id: string }>(
    `insert into items (user_id, collection_id, url, canonical_url, domain)
     values ($1, $2, $3, $3, 'example.com') returning id`,
    [userId, collectionId, url],
  )
  return result.rows[0]!.id
}

describe('migrations', () => {
  it('creates a profile for every auth user', async () => {
    const result = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from profiles where id = any($1)',
      [[alice, bob]],
    )
    expect(result.rows[0]!.count).toBe(2)
  })

  it('enables row level security on every user-owned table', async () => {
    const result = await db.pg.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = false`,
    )
    expect(result.rows).toEqual([])
  })
})

describe('constraints', () => {
  it('rejects a second live scrap of the same URL by the same user', async () => {
    await insertItem(alice, 'https://example.com/dup')
    await expect(insertItem(alice, 'https://example.com/dup')).rejects.toThrow()
  })

  it('lets two users scrap the same URL', async () => {
    await insertItem(bob, 'https://example.com/dup')
    const result = await db.pg.query<{ count: number }>(
      `select count(*)::int as count from items where canonical_url = 'https://example.com/dup'`,
    )
    expect(result.rows[0]!.count).toBe(2)
  })

  it('lets a trashed URL be scrapped again', async () => {
    const id = await insertItem(alice, 'https://example.com/trash-me')
    await db.pg.query('update items set deleted_at = now() where id = $1', [id])
    await expect(insertItem(alice, 'https://example.com/trash-me')).resolves.toBeTruthy()
  })

  it('rejects an edited_fields entry that is not a known property', async () => {
    const id = await insertItem(alice, 'https://example.com/edited')
    await expect(
      db.pg.query(`update items set edited_fields = '{"title","nope"}' where id = $1`, [id]),
    ).rejects.toThrow()
    await expect(
      db.pg.query(`update items set edited_fields = '{"title","excerpt"}' where id = $1`, [id]),
    ).resolves.toBeTruthy()
  })

  it('rejects a folder that would become its own ancestor', async () => {
    const parent = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Reading') returning id`,
      [alice],
    )
    const parentId = parent.rows[0]!.id
    const child = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, parent_id, name) values ($1, $2, 'Later') returning id`,
      [alice, parentId],
    )
    await expect(
      db.pg.query('update collections set parent_id = $1 where id = $2', [
        child.rows[0]!.id,
        parentId,
      ]),
    ).rejects.toThrow()
  })

  it('can delete a folder that still holds scraps', async () => {
    const folder = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Doomed') returning id`,
      [alice],
    )
    const folderId = folder.rows[0]!.id
    const itemId = await insertItem(alice, 'https://example.com/detach-me', folderId)

    await expect(
      db.pg.query('delete from collections where id = $1', [folderId]),
    ).resolves.toBeTruthy()

    const result = await db.pg.query<{ deleted_at: string | null; user_id: string }>(
      'select deleted_at, user_id from items where id = $1',
      [itemId],
    )
    expect(result.rows[0]!.deleted_at).not.toBeNull()
    expect(result.rows[0]!.user_id).toBe(alice)
  })

  it('trashes the scraps of every folder beneath the one deleted', async () => {
    const parent = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Parent') returning id`,
      [alice],
    )
    const parentId = parent.rows[0]!.id
    const child = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, parent_id, name) values ($1, $2, 'Child') returning id`,
      [alice, parentId],
    )
    const inParent = await insertItem(alice, 'https://example.com/in-parent', parentId)
    const inChild = await insertItem(alice, 'https://example.com/in-child', child.rows[0]!.id)

    await db.pg.query('delete from collections where id = $1', [parentId])

    const folders = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from collections where id = any($1)',
      [[parentId, child.rows[0]!.id]],
    )
    expect(folders.rows[0]!.count).toBe(0)

    const live = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from items where id = any($1) and deleted_at is null',
      [[inParent, inChild]],
    )
    expect(live.rows[0]!.count).toBe(0)
  })

  it('leaves scraps in sibling folders alone', async () => {
    const keep = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Keep') returning id`,
      [alice],
    )
    const drop = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Drop') returning id`,
      [alice],
    )
    const survivor = await insertItem(alice, 'https://example.com/survivor', keep.rows[0]!.id)
    await insertItem(alice, 'https://example.com/doomed', drop.rows[0]!.id)

    await db.pg.query('delete from collections where id = $1', [drop.rows[0]!.id])

    const result = await db.pg.query<{ deleted_at: string | null; collection_id: string }>(
      'select deleted_at, collection_id from items where id = $1',
      [survivor],
    )
    expect(result.rows[0]!.deleted_at).toBeNull()
    expect(result.rows[0]!.collection_id).toBe(keep.rows[0]!.id)
  })

  it("refuses to file an item into another user's folder", async () => {
    const folder = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Bob private') returning id`,
      [bob],
    )
    await expect(
      insertItem(alice, 'https://example.com/cross-owner', folder.rows[0]!.id),
    ).rejects.toThrow()
  })
})

describe('pinned folders', () => {
  it('starts unpinned and records when it was pinned', async () => {
    const folder = await db.pg.query<{ id: string; pinned_at: string | null }>(
      `insert into collections (user_id, name) values ($1, 'Reading') returning id, pinned_at`,
      [alice],
    )
    expect(folder.rows[0]!.pinned_at).toBeNull()

    await db.pg.query('update collections set pinned_at = now() where id = $1', [
      folder.rows[0]!.id,
    ])
    const after = await db.pg.query<{ pinned_at: string | null }>(
      'select pinned_at from collections where id = $1',
      [folder.rows[0]!.id],
    )
    expect(after.rows[0]!.pinned_at).not.toBeNull()
  })

  it("does not let one user pin another's folder", async () => {
    const theirs = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Theirs') returning id`,
      [alice],
    )
    const result = await db.asUser(bob, (pg) =>
      pg.query('update collections set pinned_at = now() where id = $1', [theirs.rows[0]!.id]),
    )
    expect(result.affectedRows).toBe(0)
  })

  it('unpins with the folder still in place', async () => {
    const folder = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name, pinned_at) values ($1, 'Pinned', now()) returning id`,
      [alice],
    )
    await db.pg.query('update collections set pinned_at = null where id = $1', [
      folder.rows[0]!.id,
    ])
    const after = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from collections where id = $1 and pinned_at is null',
      [folder.rows[0]!.id],
    )
    expect(after.rows[0]!.count).toBe(1)
  })
})

describe('views', () => {
  it('lets the inbox have views, not only folders', async () => {
    await expect(
      db.pg.query(`insert into views (user_id, collection_id, name) values ($1, null, 'Unread')`, [
        alice,
      ]),
    ).resolves.toBeTruthy()
  })

  it('refuses two views with the same name in one folder', async () => {
    const folder = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Reading') returning id`,
      [alice],
    )
    const folderId = folder.rows[0]!.id

    await db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'All')`, [
      alice,
      folderId,
    ])
    await expect(
      db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'all')`, [
        alice,
        folderId,
      ]),
    ).rejects.toThrow()
  })

  it('lets two folders each have a view of the same name', async () => {
    const first = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'One') returning id`,
      [alice],
    )
    const second = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Two') returning id`,
      [alice],
    )
    await db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'Recent')`, [
      alice,
      first.rows[0]!.id,
    ])
    await expect(
      db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'Recent')`, [
        alice,
        second.rows[0]!.id,
      ]),
    ).resolves.toBeTruthy()
  })

  it("refuses a view pointing at another user's folder", async () => {
    const theirs = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Theirs') returning id`,
      [bob],
    )
    await expect(
      db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'Sneaky')`, [
        alice,
        theirs.rows[0]!.id,
      ]),
    ).rejects.toThrow()
  })

  it('goes when its folder does, without taking the scraps', async () => {
    const folder = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, name) values ($1, 'Doomed') returning id`,
      [alice],
    )
    const folderId = folder.rows[0]!.id
    await db.pg.query(`insert into views (user_id, collection_id, name) values ($1, $2, 'All')`, [
      alice,
      folderId,
    ])
    const scrap = await insertItem(alice, 'https://example.com/view-folder', folderId)

    await db.pg.query('delete from collections where id = $1', [folderId])

    const views = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from views where collection_id = $1',
      [folderId],
    )
    expect(views.rows[0]!.count).toBe(0)
    const item = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from items where id = $1',
      [scrap],
    )
    expect(item.rows[0]!.count).toBe(1)
  })
})

describe('built-in scripts', () => {
  it('ships sort and group scripts owned by nobody', async () => {
    // Ordering an enum column follows the order the type declares, not the
    // alphabet, so the counts are compared as a map rather than a list.
    const result = await db.pg.query<{ kind: string; count: number }>(
      `select kind, count(*)::int as count from scripts
       where is_builtin and user_id is null group by kind`,
    )
    expect(Object.fromEntries(result.rows.map((row) => [row.kind, row.count]))).toEqual({
      sort: 7,
      group: 3,
    })
  })

  it('leaves a view working when the script it names is deleted', async () => {
    // on delete set null rather than restrict: losing an ordering should drop a
    // view back to its default, not make the view impossible to delete or, worse,
    // take the view with it.
    const script = await db.pg.query<{ id: string }>(
      `insert into scripts (user_id, name, kind, source)
       values ($1, 'Mine', 'sort', 'export function key(){return 0}') returning id`,
      [alice],
    )
    const view = await db.pg.query<{ id: string }>(
      `insert into views (user_id, collection_id, name, sort_script_id)
       values ($1, null, 'Uses it', $2) returning id`,
      [alice, script.rows[0]!.id],
    )

    await db.pg.query('delete from scripts where id = $1', [script.rows[0]!.id])

    const after = await db.pg.query<{ sort_script_id: string | null }>(
      'select sort_script_id from views where id = $1',
      [view.rows[0]!.id],
    )
    expect(after.rows).toHaveLength(1)
    expect(after.rows[0]!.sort_script_id).toBeNull()
  })

  it('records what a forked script came from', async () => {
    const original = await db.pg.query<{ id: string }>(
      `select id from scripts where is_builtin and name = 'Newest first' limit 1`,
    )
    const fork = await db.pg.query<{ forked_from: string | null }>(
      `insert into scripts (user_id, name, kind, source, forked_from)
       values ($1, 'Newest first (mine)', 'sort', 'export function key(){return 0}', $2)
       returning forked_from`,
      [alice, original.rows[0]!.id],
    )
    expect(fork.rows[0]!.forked_from).toBe(original.rows[0]!.id)
  })

  it('lets every user read them and no user write them', async () => {
    const readable = await db.asUser(bob, async (pg) => {
      const result = await pg.query<{ name: string }>('select name from scripts where is_builtin')
      return result.rows.length
    })
    expect(readable).toBe(10)

    const changed = await db.asUser(bob, (pg) =>
      pg.query(`update scripts set source = 'stolen' where is_builtin`),
    )
    expect(changed.affectedRows).toBe(0)
  })

  it('exports the function the engine will look for', async () => {
    // A sort script is asked for key(); only a group script is asked for its
    // own name. A seeded script exporting the wrong one would fail silently at
    // the point someone selects it.
    const expectedExport: Record<string, string> = { sort: 'key', group: 'group' }
    const result = await db.pg.query<{ name: string; kind: string; source: string }>(
      'select name, kind, source from scripts where is_builtin',
    )
    expect(result.rows.length).toBeGreaterThan(0)
    for (const row of result.rows) {
      expect(row.source, `${row.kind} script "${row.name}"`).toContain(
        `export function ${expectedExport[row.kind]}(`,
      )
    }
  })
})

describe('merging folders', () => {
  async function folder(userId: string, name: string, parentId: string | null = null) {
    const result = await db.pg.query<{ id: string }>(
      `insert into collections (user_id, parent_id, name) values ($1, $2, $3) returning id`,
      [userId, parentId, name],
    )
    return result.rows[0]!.id
  }

  it('moves the scraps and subfolders across, then removes the folder', async () => {
    const source = await folder(alice, 'Source')
    const target = await folder(alice, 'Target')
    const child = await folder(alice, 'Child', source)
    const scrap = await insertItem(alice, 'https://example.com/merge-me', source)

    await db.pg.query('select merge_collection($1, $2)', [source, target])

    const item = await db.pg.query<{ collection_id: string | null; deleted_at: string | null }>(
      'select collection_id, deleted_at from items where id = $1',
      [scrap],
    )
    expect(item.rows[0]!.collection_id).toBe(target)
    // The delete trigger trashes whatever is still filed in a folder, so this
    // also proves the scraps left before the folder went.
    expect(item.rows[0]!.deleted_at).toBeNull()

    const moved = await db.pg.query<{ parent_id: string | null }>(
      'select parent_id from collections where id = $1',
      [child],
    )
    expect(moved.rows[0]!.parent_id).toBe(target)

    const gone = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from collections where id = $1',
      [source],
    )
    expect(gone.rows[0]!.count).toBe(0)
  })

  it('places arriving subfolders after the ones already there', async () => {
    const source = await folder(alice, 'Source')
    const target = await folder(alice, 'Target')
    await db.pg.query(
      `insert into collections (user_id, parent_id, name, position) values ($1, $2, 'Existing', 0)`,
      [alice, target],
    )
    await db.pg.query(
      `insert into collections (user_id, parent_id, name, position) values ($1, $2, 'Arriving', 0)`,
      [alice, source],
    )

    await db.pg.query('select merge_collection($1, $2)', [source, target])

    const result = await db.pg.query<{ name: string }>(
      'select name from collections where parent_id = $1 order by position',
      [target],
    )
    expect(result.rows.map((row) => row.name)).toEqual(['Existing', 'Arriving'])
  })

  it('refuses to merge a folder into itself', async () => {
    const only = await folder(alice, 'Only')
    await expect(db.pg.query('select merge_collection($1, $1)', [only])).rejects.toThrow(
      /into itself/,
    )
  })

  it('refuses to merge a folder into its own subfolder', async () => {
    const parent = await folder(alice, 'Parent')
    const child = await folder(alice, 'Child', parent)
    const grandchild = await folder(alice, 'Grandchild', child)

    await expect(db.pg.query('select merge_collection($1, $2)', [parent, child])).rejects.toThrow(
      /own subfolders/,
    )
    await expect(
      db.pg.query('select merge_collection($1, $2)', [parent, grandchild]),
    ).rejects.toThrow(/own subfolders/)
  })

  it("refuses to touch another user's folder", async () => {
    const mine = await folder(bob, 'Mine')
    const theirs = await folder(alice, 'Theirs')

    await expect(
      db.asUser(bob, (pg) => pg.query('select merge_collection($1, $2)', [theirs, mine])),
    ).rejects.toThrow(/no such folder/)

    await expect(
      db.asUser(bob, (pg) => pg.query('select merge_collection($1, $2)', [mine, theirs])),
    ).rejects.toThrow(/no such folder/)

    const survived = await db.pg.query<{ count: number }>(
      'select count(*)::int as count from collections where id = $1',
      [theirs],
    )
    expect(survived.rows[0]!.count).toBe(1)
  })
})

describe('row level security', () => {
  it("hides one user's items from another", async () => {
    await insertItem(alice, 'https://example.com/alice-secret')
    const visible = await db.asUser(bob, async (pg) => {
      const result = await pg.query<{ canonical_url: string }>('select canonical_url from items')
      return result.rows.map((row) => row.canonical_url)
    })
    expect(visible).not.toContain('https://example.com/alice-secret')
  })

  it('shows a user their own items', async () => {
    const visible = await db.asUser(alice, async (pg) => {
      const result = await pg.query<{ canonical_url: string }>('select canonical_url from items')
      return result.rows.map((row) => row.canonical_url)
    })
    expect(visible).toContain('https://example.com/alice-secret')
  })

  it('refuses an insert that claims another user as owner', async () => {
    await expect(
      db.asUser(bob, (pg) =>
        pg.query(
          `insert into items (user_id, url, canonical_url, domain)
           values ($1, 'https://example.com/forged', 'https://example.com/forged', 'example.com')`,
          [alice],
        ),
      ),
    ).rejects.toThrow()
  })

  it("refuses an update to another user's item", async () => {
    const result = await db.asUser(bob, (pg) =>
      pg.query(`update items set is_important = true where canonical_url = 'https://example.com/alice-secret'`),
    )
    expect(result.affectedRows).toBe(0)
  })

  it("refuses a delete of another user's item", async () => {
    const result = await db.asUser(bob, (pg) =>
      pg.query(`delete from items where canonical_url = 'https://example.com/alice-secret'`),
    )
    expect(result.affectedRows).toBe(0)
  })

  it('lets every user read built-in scripts but not write them', async () => {
    await db.pg.query(
      `insert into scripts (user_id, name, kind, source, is_builtin)
       values (null, 'Newest first', 'sort', 'export function key(i){return -i.createdAt}', true)`,
    )
    const readable = await db.asUser(bob, async (pg) => {
      const result = await pg.query<{ name: string }>('select name from scripts where is_builtin')
      return result.rows.map((row) => row.name)
    })
    expect(readable).toContain('Newest first')

    await expect(
      db.asUser(bob, (pg) =>
        pg.query(
          `insert into scripts (user_id, name, kind, source, is_builtin)
           values (null, 'Fake builtin', 'sort', 'export function key(){return 0}', true)`,
        ),
      ),
    ).rejects.toThrow()
  })
})
