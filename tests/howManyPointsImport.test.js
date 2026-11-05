import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPortalStorage } from '../src/cloud/storage.js'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let postgres
let cloud
let app
let failure

async function query(user, sql, params = []) {
  await postgres.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${user}';`)
  try { return await postgres.query(sql, params) }
  finally { await postgres.exec('RESET ROLE') }
}

function client(user) {
  return {
    from() {
      return { select() { return { order() { return this }, async range(start, end) {
        const result = await query(user, 'SELECT * FROM public.portal_documents ORDER BY namespace COLLATE "C", key COLLATE "C" LIMIT $1 OFFSET $2', [end - start + 1, start])
        return { data: result.rows, error: null }
      } } } }
    },
    async rpc(name, args) {
      if (failure === 'backup' && args.p_namespace === 'how-many-points-backups') return { data: null, error: new Error('backup offline') }
      try {
        const result = name === 'portal_write'
          ? await query(user, 'SELECT * FROM public.portal_write($1,$2,$3,$4)', [args.p_namespace, args.p_key, JSON.stringify(args.p_value), args.p_revision])
          : await query(user, 'SELECT public.portal_merge_ratings($1,$2,$3,$4) AS result', [JSON.stringify(args.p_snapshot), JSON.stringify(args.p_changes), args.p_backup_key, args.p_overwrite])
        if (name === 'portal_merge_ratings' && failure === 'lost-response') return { data: null, error: new Error('network response lost') }
        return { data: name === 'portal_write' ? result.rows : result.rows[0].result, error: null }
      } catch (error) { return { data: null, error } }
    },
  }
}

function loadApp(storage) {
  const context = { PortalCloud: storage, crypto, console }
  context.window = context
  for (const script of ['import-plan', 'db', 'import-watcha']) {
    vm.runInNewContext(readFileSync(new URL(`../public/how-many-points/js/${script}.js`, import.meta.url), 'utf8'), context)
  }
  return { db: context.HowManyPointsDb, csv: context.HowManyPointsWatchaImport.parseWatchaCsv }
}

function fixtures(count, type, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({ externalId: `${type}-${i + offset}`, source: 'watcha', title: `작품 ${i + offset}`, contentType: type, rating: 4.5, review: `기존 리뷰 ${i}` }))
}

function csv(items) {
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  return '\uFEFFID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler\r\n' + items.map(item =>
    [item.externalId, '', item.title, item.contentType === 'movie' ? 'MOVIE' : 'TV', '', '', '', item.rating, item.review, ''].map(escape).join(','),
  ).join('\r\n')
}

async function merge(items, options = { format: 'csv' }) {
  const preview = await app.db.prepareImport(items, options)
  await app.db.createImportBackup(preview)
  await app.db.commitImport(preview)
  return preview
}

async function seedLibrary() {
  const items = [...fixtures(800, 'movie'), ...fixtures(322, 'series')].map(raw => app.db.normalizeItem(raw))
  await postgres.query(`INSERT INTO public.portal_documents(user_id,namespace,key,value)
    SELECT $1,'how-many-points', value->>'id',value FROM jsonb_array_elements($2::jsonb)`, [owner, JSON.stringify(items)])
  await cloud.load()
  return items.sort((a, b) => a.id.localeCompare(b.id))
}

async function stored() {
  await cloud.load()
  return app.db.listRatings().then(rows => rows.sort((a, b) => a.id.localeCompare(b.id)))
}

beforeAll(async () => {
  postgres = new PGlite()
  await postgres.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${owner}'),('${other}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`)
  for (const path of ['supabase/portal-storage.sql', 'supabase/portal-single-account.sql', 'supabase/migrations/20261105045823_safe_ratings_merge.sql']) {
    await postgres.exec(readFileSync(path, 'utf8'))
  }
  await postgres.query('INSERT INTO public.portal_account(user_id) VALUES($1)', [owner])
}, 30000)
beforeEach(async () => {
  await postgres.exec('TRUNCATE public.portal_documents')
  failure = null
  cloud = createPortalStorage(client(owner))
  await cloud.load()
  app = loadApp(cloud)
})
afterAll(async () => { await postgres?.close() })

describe('CSV safe merge against PostgreSQL and the real cloud adapter', () => {
  it('imports movie 800 then TV 322 without replacing the first file, including multiline reviews', async () => {
    const movies = fixtures(800, 'movie')
    movies[0].review = '여러 줄\n리뷰, "좋아요"'
    await merge(app.csv(csv(movies)))
    await merge(app.csv(csv(fixtures(322, 'series'))))
    const rows = await stored()
    expect(rows).toHaveLength(1122)
    expect(rows.filter(row => row.contentType === 'movie')).toHaveLength(800)
    expect(rows.filter(row => row.contentType === 'series')).toHaveLength(322)
    expect(rows.find(row => row.externalId === 'movie-0').review).toBe(movies[0].review)
  })

  it('keeps all 1122 records byte-for-byte on reimport even when incoming ratings and reviews differ', async () => {
    const before = await seedLibrary()
    const incoming = fixtures(800, 'movie').map(row => ({ ...row, rating: 1, review: '덮어쓰면 안 됨' }))
    const preview = await merge(app.csv(csv(incoming)))
    expect(preview).toMatchObject({ added: 0, duplicates: 800, changed: 800, updated: 0, total: 1122 })
    expect(await stored()).toEqual(before)
  })

  it('adds different identities without title or source collisions and deduplicates repeated rows', async () => {
    const before = await seedLibrary()
    const fresh = fixtures(1, 'movie', 900)[0]
    await merge([fresh, { ...fresh, review: 'second copy' }, { ...fresh, source: 'other' }])
    const rows = await stored()
    expect(rows).toHaveLength(1124)
    expect(rows.filter(row => before.some(old => old.id === row.id))).toEqual(before)
    expect(rows.find(row => row.externalId === fresh.externalId && row.source === 'watcha').review).toBe(fresh.review)
  })

  it('overwrites only an explicitly selected duplicate and backs up the complete preimage', async () => {
    const before = await seedLibrary()
    const preview = await merge([{ ...fixtures(1, 'movie')[0], rating: 2, review: '선택한 변경' }], { format: 'csv', overwrite: true })
    expect(preview.updated).toBe(1)
    const rows = await stored()
    expect(rows).toHaveLength(1122)
    expect(rows.find(row => row.externalId === 'movie-0')).toMatchObject({ rating: 2, review: '선택한 변경', createdAt: before.find(row => row.externalId === 'movie-0').createdAt })
    expect(cloud.list('how-many-points-backups')[0].ratings.slice().sort((a, b) => a.id.localeCompare(b.id))).toEqual(before)
  })

  it('rolls back earlier inserts when a later item fails inside the DB transaction', async () => {
    const before = await seedLibrary()
    const preview = await app.db.prepareImport([{ ...fixtures(1, 'movie', 900)[0], id: 'valid-new' }, { ...fixtures(1, 'series', 900)[0], id: 'x'.repeat(301) }])
    await app.db.createImportBackup(preview)
    await expect(app.db.commitImport(preview)).rejects.toThrow('invalid_import_item')
    expect(await stored()).toEqual(before)
  })

  it('refuses a merge when backup storage fails', async () => {
    const before = await seedLibrary()
    const preview = await app.db.prepareImport(fixtures(1, 'movie', 900))
    failure = 'backup'
    await expect(app.db.createImportBackup(preview)).rejects.toThrow('backup offline')
    await expect(app.db.commitImport(preview)).rejects.toThrow('JSON 백업')
    expect(await stored()).toEqual(before)
  })

  it('refuses a persisted backup whose exported records are corrupted', async () => {
    const before = await seedLibrary()
    const preview = await app.db.prepareImport(fixtures(1, 'movie', 900))
    await app.db.createImportBackup(preview)
    await postgres.exec(`UPDATE public.portal_documents SET value = jsonb_set(value, '{ratings,0,review}', '"corrupted"') WHERE namespace = 'how-many-points-backups'`)
    await expect(app.db.commitImport(preview)).rejects.toThrow('backup_required')
    expect(await stored()).toEqual(before)
  })

  it('recovers a failed backup in the same preview before enabling the final merge', async () => {
    await seedLibrary()
    const preview = await app.db.prepareImport(fixtures(1, 'movie', 900))
    failure = 'backup'
    await expect(app.db.createImportBackup(preview)).rejects.toThrow('backup offline')
    failure = null
    const backup = JSON.parse(await app.db.createImportBackup(preview))
    expect(backup.ratings).toHaveLength(1122)
    await app.db.commitImport(preview)
    expect(await stored()).toHaveLength(1123)
    expect(cloud.list('how-many-points-backups')).toHaveLength(1)
  })

  it('rejects stale previews after another device edits a review', async () => {
    await seedLibrary()
    const preview = await app.db.prepareImport(fixtures(1, 'movie', 900))
    await app.db.createImportBackup(preview)
    const second = createPortalStorage(client(owner))
    await second.load()
    const original = second.read('how-many-points', 'watcha-movie-0')
    await second.write('how-many-points', original.id, { ...original, review: '다른 기기의 최신 리뷰' })
    await expect(app.db.commitImport(preview)).rejects.toThrow('stale_preview')
    const rows = await stored()
    expect(rows).toHaveLength(1122)
    expect(rows.find(row => row.id === original.id).review).toBe('다른 기기의 최신 리뷰')
  })

  it('blocks writes after a lost commit response and safely reimports after reload', async () => {
    await seedLibrary()
    const preview = await app.db.prepareImport(fixtures(1, 'movie', 900))
    await app.db.createImportBackup(preview)
    failure = 'lost-response'
    await expect(app.db.commitImport(preview)).rejects.toThrow('network response lost')
    expect(() => cloud.write('how-many-points', 'x', {})).toThrow('결과 확인')
    failure = null
    await cloud.load()
    await merge(fixtures(1, 'movie', 900))
    expect(await stored()).toHaveLength(1123)
  })

  it('keeps tombstones while adding a different work and refuses implicit resurrection', async () => {
    await seedLibrary()
    await app.db.deleteRating('watcha-movie-0')
    await merge(fixtures(1, 'movie', 900))
    expect(await stored()).toHaveLength(1122)
    expect(await app.db.getRating('watcha-movie-0')).toBeNull()
    const preview = await app.db.prepareImport(fixtures(1, 'movie'))
    await app.db.createImportBackup(preview)
    await expect(app.db.commitImport(preview)).rejects.toThrow('existing_item_protected')
    expect(await stored()).toHaveLength(1122)
  })

  it.each(['ID,URL,Title\nabc,,"닫히지 않은 리뷰', 'ID,URL,Title\nabc,,title,extra'])('rejects malformed CSV before saving: %s', text => {
    expect(() => app.csv(text)).toThrow('CSV')
    expect(cloud.list('how-many-points')).toEqual([])
  })
})

describe('JSON regression and import authorization', () => {
  it('includes a poster-only JSON change in the explicit overwrite preview', async () => {
    const item = app.db.normalizeItem({ id: 'poster', title: '포스터 작품', posterUrl: 'https://example.com/old.jpg' })
    await cloud.write('how-many-points', item.id, item)
    const preview = await merge([{ ...item, posterUrl: 'https://example.com/new.jpg' }], { format: 'json', overwrite: true })
    expect(preview).toMatchObject({ duplicates: 1, changed: 1, updated: 1, total: 1 })
    expect(await app.db.getRating(item.id)).toMatchObject({ posterUrl: 'https://example.com/new.jpg' })
  })

  it('merges JSON with custom IDs and preserves existing ratings and unknown fields', async () => {
    await cloud.write('how-many-points', 'custom', { id: 'custom', externalId: 'movie-0', source: 'watcha', title: '기존', rating: 5, review: '기존 리뷰', unknown: 'keep' })
    await app.db.importPayload({ version: 1, ratings: [{ ...fixtures(1, 'movie')[0], id: 'different' }, { id: 'manual', title: '수동 작품', rating: 3 }] })
    expect(await stored()).toHaveLength(2)
    expect(await app.db.getRating('custom')).toMatchObject({ rating: 5, review: '기존 리뷰', unknown: 'keep' })
    expect(await app.db.getRating('manual')).toMatchObject({ title: '수동 작품', rating: 3 })
  })

  it.each([{ ratings: [] }, { version: 999, ratings: [{ title: 'invalid' }] }, { ideas: [] }])('rejects invalid JSON without clearing existing data: %j', async payload => {
    await seedLibrary()
    await expect(app.db.importPayload(payload)).rejects.toThrow()
    expect(await stored()).toHaveLength(1122)
  })

  it('refuses legacy replacement flags for CSV and JSON', async () => {
    await seedLibrary()
    await expect(app.db.importItems(fixtures(1, 'movie'), true)).rejects.toThrow('전체 교체')
    await expect(app.db.importPayload({ ratings: fixtures(1, 'movie') }, true)).rejects.toThrow('전체 교체')
    expect(await stored()).toHaveLength(1122)
  })

  it('enforces RLS and forbids anon execution of the atomic import', async () => {
    await seedLibrary()
    expect((await query(other, 'SELECT * FROM public.portal_documents')).rows).toEqual([])
    await expect(query(other, "SELECT public.portal_merge_ratings('[]','[]','missing',false)")).rejects.toThrow('backup_required')
    await postgres.exec('SET ROLE anon')
    try { await expect(postgres.query("SELECT public.portal_merge_ratings('[]','[]','missing',false)")).rejects.toMatchObject({ code: '42501' }) }
    finally { await postgres.exec('RESET ROLE') }
    expect(await stored()).toHaveLength(1122)
  })
})
