import { PortalModeError } from '../../server/portalDataMode.js'

export function createMockStorage() {
  const rows = new Map()
  const id = (namespace, key) => JSON.stringify([namespace, String(key)])
  const copy = value => value == null ? null : structuredClone(value)
  const read = (namespace, key) => copy(rows.get(id(namespace, key))?.value)
  const list = namespace => [...rows.values()].filter(row => row.namespace === namespace && row.value != null).map(row => copy(row.value))
  const write = (namespace, key, value) => {
    rows.set(id(namespace, key), { namespace, value: copy(value) })
    return Promise.resolve(copy(value))
  }
  const settings = {
    getItem: key => read('settings', key),
    setItem: (key, value) => write('settings', key, String(value)),
    removeItem: key => write('settings', key, null),
  }
  return {
    mode: 'mock', read, list, write, settings,
    has: (namespace, key) => rows.has(id(namespace, key)),
    clear: async namespace => { for (const [key, row] of rows) if (row.namespace === namespace) rows.delete(key) },
    load: async () => {}, flush: async () => {}, retry: async () => {},
    stop: () => rows.clear(),
  }
}

export function createMockPromptTransport() {
  const denied = () => { throw new PortalModeError('mock_live_access_denied') }
  return {
    snapshot: () => [], list: async () => [], changed: async () => [], stop: () => {},
    importLegacy: denied,
    async request(path, method = 'GET') {
      if (method === 'GET' && /^\/api\/prompts(?:\?|$)/.test(path)) return { items: [], next_cursor: null }
      return denied()
    },
  }
}
