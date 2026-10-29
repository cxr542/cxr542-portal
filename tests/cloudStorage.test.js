import { describe, expect, it } from 'vitest'
import { createPortalStorage } from '../src/cloud/storage.js'
import { migrateLegacyData } from '../src/cloud/migration.js'

function database() {
  const rows = new Map()
  let offline = false
  return {
    setOffline(value) { offline = value },
    client(user) {
      return {
        from() {
          return { select() { return { order() { return this }, async range(start, end) {
            return { data: [...rows.values()].filter(row => row.user_id === user).slice(start, end + 1), error: null }
          } } } }
        },
        async rpc(_name, args) {
          if (offline) return { data: null, error: new Error('offline') }
          const id = JSON.stringify([user, args.p_namespace, args.p_key])
          const previous = rows.get(id)
          if ((previous?.revision || 0) !== args.p_revision) return { data: null, error: new Error('portal_write_conflict') }
          const row = { user_id: user, namespace: args.p_namespace, key: args.p_key, value: structuredClone(args.p_value), revision: args.p_revision + 1 }
          rows.set(id, row)
          return { data: [structuredClone(row)], error: null }
        },
      }
    },
  }
}

describe('Supabase storage adapter', () => {
  it('hydrates another device without sharing records between accounts', async () => {
    const db = database()
    const first = createPortalStorage(db.client('owner'))
    await first.load()
    await first.write('idea-bank', 'idea', { id: 'idea', body: '메모' })
    const second = createPortalStorage(db.client('owner'))
    const other = createPortalStorage(db.client('other'))
    await Promise.all([second.load(), other.load()])
    expect(second.list('idea-bank')).toEqual([{ id: 'idea', body: '메모' }])
    expect(other.list('idea-bank')).toEqual([])
  })

  it('serializes rapid setting writes and persists the latest value', async () => {
    const db = database()
    const cloud = createPortalStorage(db.client('owner'))
    await cloud.load()
    cloud.settings.setItem('font', 'small')
    cloud.settings.removeItem('font')
    cloud.settings.setItem('font', 'large')
    expect(cloud.settings.getItem('font')).toBe('large')
    await cloud.flush()
    const reloaded = createPortalStorage(db.client('owner'))
    await reloaded.load()
    expect(reloaded.settings.getItem('font')).toBe('large')
  })

  it('keeps the latest optimistic setting visible through repeated values', async () => {
    const db = database()
    const observations = []
    const cloud = createPortalStorage(db.client('owner'), () => {}, () => observations.push(cloud.settings.getItem('font')))
    await cloud.load()
    cloud.settings.setItem('font', 'A')
    cloud.settings.setItem('font', 'B')
    cloud.settings.setItem('font', 'A')
    await cloud.flush()
    expect(observations).toEqual(['A', 'A', 'A'])
  })

  it('rejects stale writes without overwriting another device', async () => {
    const db = database()
    const first = createPortalStorage(db.client('owner'))
    const stale = createPortalStorage(db.client('owner'))
    await Promise.all([first.load(), stale.load()])
    await first.write('idea-bank', 'idea', { id: 'idea', body: 'new' })
    await expect(stale.write('idea-bank', 'idea', { id: 'idea', body: 'stale' })).rejects.toThrow('conflict')
    await expect(stale.flush()).rejects.toThrow()
    await first.load()
    expect(first.read('idea-bank', 'idea').body).toBe('new')
  })

  it('reports failed optimistic saves and retries the last pending value', async () => {
    const db = database()
    const statuses = []
    const cloud = createPortalStorage(db.client('owner'), value => statuses.push(value))
    await cloud.load()
    db.setOffline(true)
    cloud.settings.setItem('font', 'small')
    cloud.settings.setItem('font', 'large')
    await expect(cloud.flush()).rejects.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(statuses.at(-1).failures).toHaveLength(1)
    db.setOffline(false)
    await cloud.retry()
    expect(cloud.read('settings', 'font')).toBe('large')
  })

  it('preserves cloud edits and tombstones when legacy migration is retried', async () => {
    const db = database()
    const cloud = createPortalStorage(db.client('owner'))
    await cloud.load()
    await cloud.write('idea-bank', 'deleted', null)
    await cloud.write('idea-bank', 'edited', { id: 'edited', body: 'remote' })
    const legacy = ['deleted', 'edited', 'new'].map(key => ({ namespace: 'idea-bank', key, value: { id: key, body: 'legacy' } }))
    expect(await migrateLegacyData(cloud, legacy)).toEqual({ imported: 1, skipped: 2 })
    expect(await migrateLegacyData(cloud, legacy)).toEqual({ imported: 0, skipped: 3 })
    expect(cloud.list('idea-bank').map(row => row.id).sort()).toEqual(['edited', 'new'])
    expect(cloud.read('idea-bank', 'edited').body).toBe('remote')
  })

  it('resumes an interrupted migration after the network recovers', async () => {
    const db = database()
    const cloud = createPortalStorage(db.client('owner'))
    await cloud.load()
    const documents = ['first', 'second'].map(key => ({ namespace: 'idea-bank', key, value: { id: key } }))
    db.setOffline(true)
    await expect(migrateLegacyData(cloud, documents)).rejects.toThrow('offline')
    db.setOffline(false)
    await migrateLegacyData(cloud, documents)
    await cloud.flush()
    expect(cloud.list('idea-bank').map(row => row.id).sort()).toEqual(['first', 'second'])
  })

  it('clears private data and refuses writes after the account session ends', async () => {
    const cloud = createPortalStorage(database().client('owner'))
    await cloud.load()
    await cloud.write('idea-bank', 'private', { id: 'private' })
    cloud.stop()
    expect(cloud.list('idea-bank')).toEqual([])
    expect(() => cloud.write('idea-bank', 'private', {})).toThrow('session_ended')
  })
})
