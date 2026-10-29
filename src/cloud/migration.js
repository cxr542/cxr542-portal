export const collections = [
  ['idea-bank', 'ideas', 'idea-bank-ideas'],
  ['prompt-collection', 'prompts', 'prompt-collection-prompts'],
  ['how-many-points', 'ratings', 'how-many-points-ratings'],
  ['marathon-log', 'races', 'marathon-log-races'],
]
const careerStores = ['profile', 'employments', 'projects', 'educations', 'certifications', 'documents']

function readLegacyStore(database, storeName) {
  if (!globalThis.indexedDB) return Promise.resolve([])
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database)
    let absent = false
    request.onupgradeneeded = () => { absent = true; request.transaction.abort() }
    request.onerror = () => absent ? resolve([]) : reject(request.error)
    request.onblocked = () => reject(new Error('이관 전 다른 포털 탭을 닫아 주세요.'))
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return }
      const tx = db.transaction(storeName, 'readonly')
      const read = tx.objectStore(storeName).getAll()
      tx.oncomplete = () => { db.close(); resolve(read.result) }
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })
}

export async function collectLegacyData(storage = globalThis.localStorage) {
  const documents = []
  const recordKeys = new Set(collections.map(row => row[2]))
  recordKeys.add('who-are-you-bundle')
  recordKeys.add('who-are-you-summary')
  const knownKey = /^(cxr542-(portal-|today-shoes-|task-email-notify$)|idea-bank-|prompt-collection-|how-many-points-|who-are-you-|marathon-log-|today-shoes-|vision-font-|gemini-tuner-|project-sidebar-collapsed$|src-running-ops-data$)/
  const settings = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (knownKey.test(key) && key !== 'cxr542-portal-auth' && !recordKeys.has(key)) {
      settings.push({ namespace: 'settings', key, value: storage.getItem(key) })
    }
  }
  for (const [database, store, legacyKey] of collections) {
    const fallback = JSON.parse(storage.getItem(legacyKey) || '[]')
    if (!Array.isArray(fallback)) throw new Error(`${legacyKey}: 데이터 형식을 확인해 주세요.`)
    const indexed = await readLegacyStore(database, store)
    const merged = new Map(fallback.map(item => [String(item.id), item]))
    for (const item of indexed) merged.set(String(item.id), item)
    for (const [key, value] of merged) {
      if (!value.id) throw new Error(`${database}: ID 없는 데이터가 있습니다. JSON 백업을 확인해 주세요.`)
      documents.push({ namespace: database, key, value })
    }
  }
  const bundle = JSON.parse(storage.getItem('who-are-you-bundle') || '{}')
  for (const store of careerStores) {
    const fallback = store === 'profile' ? (bundle.profile ? [bundle.profile] : []) : (bundle[store] || [])
    if (!Array.isArray(fallback)) throw new Error(`경력 ${store}: 데이터 형식을 확인해 주세요.`)
    const merged = new Map(fallback.map(item => [String(item.id || (store === 'profile' ? 'profile' : '')), item]))
    for (const item of await readLegacyStore('who-are-you', store)) merged.set(String(item.id), item)
    for (const [key, value] of merged) {
      if (!key) throw new Error(`경력 ${store}: ID가 없습니다.`)
      documents.push({ namespace: `who-are-you/${store}`, key, value: { ...value, id: key } })
    }
  }
  return [...settings, ...documents]
}

// Import only missing keys, including tombstones: existing cloud edits/deletions win.
export async function migrateLegacyData(cloud, documents) {
  await cloud.retry()
  if (documents.some(row => row.namespace === 'prompt-collection') && !globalThis.PortalPromptApi?.importLegacy) throw new Error('프롬프트 API 연결 후 다시 시도해 주세요. 원본은 유지됩니다.')
  let imported = 0
  let skipped = 0
  for (const row of documents) {
    if (cloud.has(row.namespace, row.key)) { skipped++; continue }
    if (row.namespace === 'prompt-collection') { await globalThis.PortalPromptApi.importLegacy(row.value); imported++; continue }
    await cloud.write(row.namespace, row.key, row.value)
    imported++
  }
  await cloud.flush()
  return { imported, skipped }
}

export function downloadBackup(documents) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), documents }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `portal-before-supabase-${Date.now()}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
