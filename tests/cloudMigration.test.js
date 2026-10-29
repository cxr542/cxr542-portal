import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectLegacyData } from '../src/cloud/migration.js'

function localValues(entries) {
  const values = new Map(entries)
  return { length: values.size, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null }
}

async function seed(database, store, items) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(store, 'readwrite')
      for (const item of items) tx.objectStore(store).put(item)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  })
}

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })
afterEach(() => { delete globalThis.indexedDB })

describe('legacy browser migration', () => {
  it('merges both storage backends and prefers the IndexedDB copy of the same ID', async () => {
    const local = localValues([
      ['idea-bank-ideas', JSON.stringify([{ id: 'same', body: 'old' }, { id: 'fallback', body: 'keep' }])],
      ['cxr542-portal-font-scale', 'large'],
      ['cxr542-portal-auth', 'do-not-copy-session'],
      ['src-running-ops-session', 'do-not-copy-role'],
      ['unrelated-app-secret', 'do-not-copy'],
    ])
    await seed('idea-bank', 'ideas', [{ id: 'same', body: 'indexed' }])
    const documents = await collectLegacyData(local)
    expect(documents.find(row => row.namespace === 'idea-bank' && row.key === 'same').value.body).toBe('indexed')
    expect(documents.find(row => row.key === 'fallback').value.body).toBe('keep')
    expect(documents.filter(row => row.namespace === 'settings')).toEqual([{ namespace: 'settings', key: 'cxr542-portal-font-scale', value: 'large' }])
  })

  it('retains all career stores including the singleton profile', async () => {
    await seed('who-are-you', 'profile', [{ id: 'profile', name: '테스트' }])
    const local = localValues([['who-are-you-bundle', JSON.stringify({ projects: [{ id: 'project', title: '경력' }] })]])
    const documents = await collectLegacyData(local)
    expect(documents).toEqual(expect.arrayContaining([
      { namespace: 'who-are-you/profile', key: 'profile', value: { id: 'profile', name: '테스트' } },
      { namespace: 'who-are-you/projects', key: 'project', value: { id: 'project', title: '경력' } },
    ]))
  })

  it('does not create empty legacy databases while checking an unused browser', async () => {
    const documents = await collectLegacyData(localValues([]))
    expect(documents).toEqual([])
    expect(await indexedDB.databases()).toEqual([])
  })

  it('stops on malformed records instead of silently dropping local data', async () => {
    await expect(collectLegacyData(localValues([['idea-bank-ideas', 'not-json']]))).rejects.toThrow()
  })
})
