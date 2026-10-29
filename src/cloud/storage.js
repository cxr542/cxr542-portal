export function createPortalStorage(client, onStatus = () => {}, onWrite = () => {}) {
  const rows = new Map()
  const queue = new Map()
  const failures = new Map()
  let active = true
  const rowKey = (namespace, key) => JSON.stringify([namespace, key])
  const status = () => onStatus({ pending: queue.size, failures: [...failures.values()] })
  const clone = (value) => value == null ? null : structuredClone(value)

  async function load() {
    const loaded = new Map()
    for (let start = 0; ; start += 500) {
      const { data, error } = await client.from('portal_documents').select('*')
        .order('namespace').order('key').range(start, start + 499)
      if (error) throw error
      for (const row of data) loaded.set(rowKey(row.namespace, row.key), row)
      if (data.length < 500) break
    }
    if (!active) throw new Error('session_ended')
    rows.clear()
    for (const [key, row] of loaded) rows.set(key, row)
  }

  function read(namespace, key) {
    return clone(rows.get(rowKey(namespace, String(key)))?.value)
  }

  function list(namespace) {
    return [...rows.values()].filter(row => row.namespace === namespace && row.value != null)
      .map(row => clone(row.value))
  }

  function write(namespace, key, value) {
    if (!active) throw new Error('session_ended')
    key = String(key)
    const id = rowKey(namespace, key)
    const snapshot = clone(value)
    const optimisticEntry = optimistic.get(key)
    const previous = queue.get(id) || Promise.resolve()
    const operation = previous.then(async () => {
      if (!active) throw new Error('session_ended')
      if (failures.has(id)) throw new Error('이전 저장 실패를 먼저 해결해 주세요.')
      const revision = rows.get(id)?.revision || 0
      const { data, error } = await client.rpc('portal_write', {
        p_namespace: namespace, p_key: key, p_value: snapshot, p_revision: revision,
      })
      if (error) throw error
      if (!data?.[0]) throw new Error('저장 결과를 확인할 수 없습니다.')
      if (!active) throw new Error('session_ended')
      rows.set(id, data[0])
      if (namespace === 'settings' && optimisticEntry && optimistic.get(key) === optimisticEntry && optimisticEntry.value === snapshot) optimistic.delete(key)
      onWrite({ namespace, key })
      return clone(snapshot)
    })
    queue.set(id, operation)
    status()
    operation.catch(error => {
      if (active) failures.set(id, { namespace, key, value: snapshot, message: error.message })
    }).finally(() => {
      if (queue.get(id) === operation) queue.delete(id)
      status()
    })
    return operation
  }

  const optimistic = new Map()
  const settings = {
    getItem(key) {
      return optimistic.has(key) ? optimistic.get(key).value : read('settings', key)
    },
    setItem(key, value) {
      if (settings.getItem(key) === String(value)) return
      optimistic.set(key, { value: String(value) })
      write('settings', key, String(value))
    },
    removeItem(key) {
      if (settings.getItem(key) === null) return
      optimistic.set(key, { value: null })
      write('settings', key, null)
    },
  }
  return {
    load, read, list, write, settings,
    has: (namespace, key) => rows.has(rowKey(namespace, String(key))),
    async clear(namespace) {
      await Promise.all(list(namespace).map(item => write(namespace, item.id, null)))
    },
    async flush() {
      await Promise.all([...queue.values()])
      if (failures.size) throw new Error('저장되지 않은 변경 사항이 있습니다.')
    },
    async retry() {
      const pending = [...failures.values()]
      failures.clear()
      await Promise.all(pending.map(row => write(row.namespace, row.key, row.value)))
    },
    stop() { active = false; rows.clear(); optimistic.clear(); failures.clear() },
  }
}
