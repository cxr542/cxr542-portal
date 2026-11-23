import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortalModeError, resolvePortalDataMode } from '../server/portalDataMode.js'
import { liveDataDenial } from '../server/portalMode.js'
import { createMockStorage, createMockPromptTransport } from '../src/cloud/mockStorage.js'

const { createClient, liveLoaded, mockLoaded } = vi.hoisted(() => ({ createClient: vi.fn(), liveLoaded: vi.fn(), mockLoaded: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.clearAllMocks()
  vi.doUnmock('../src/cloud/mockBootstrap.js')
  vi.doUnmock('../src/cloud/supabaseBootstrap.js')
})

describe('deployment data boundary', () => {
  it.each([
    ['preview', undefined], ['preview', ''], ['preview', 'supabase'], ['preview', 'MOCK'],
    ['preview', 'other'], ['unknown', 'mock'], ['development', undefined], ['test', undefined], ['production', 'mock'],
  ])('rejects environment=%s mode=%s before any client or network', (environment, mode) => {
    expect(() => resolvePortalDataMode(environment, mode)).toThrow(PortalModeError)
  })

  it.each([['preview', 'mock', 'mock'], ['development', 'mock', 'mock'], ['production', undefined, 'supabase'], ['production', 'supabase', 'supabase']])(
    'resolves environment=%s mode=%s to %s', (environment, mode, expected) => {
      expect(resolvePortalDataMode(environment, mode)).toBe(expected)
    },
  )

  it('imports only the mock runtime and never the live bootstrap', async () => {
    vi.doMock('../src/cloud/mockBootstrap.js', () => { mockLoaded(); return { ready: Promise.resolve() } })
    vi.doMock('../src/cloud/supabaseBootstrap.js', () => { liveLoaded(); throw new Error('unexpected live import') })
    const { loadPortalRuntime } = await import('../src/cloud/runtime.js')
    await loadPortalRuntime('preview', 'mock')
    expect(mockLoaded).toHaveBeenCalledTimes(1)
    expect(liveLoaded).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('does not fall back to live initialization when loading Mock fails', async () => {
    vi.doMock('../src/cloud/mockBootstrap.js', () => { throw new TypeError('offline') })
    vi.doMock('../src/cloud/supabaseBootstrap.js', () => { liveLoaded(); return { ready: Promise.resolve() } })
    const { loadPortalRuntime } = await import('../src/cloud/runtime.js')
    await expect(loadPortalRuntime('preview', 'mock')).rejects.toMatchObject({ cause: { message: 'offline' } })
    expect(liveLoaded).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(['mock', '', 'supabase'])('blocks even a direct client-module import in Preview: %s', async mode => {
    vi.stubGlobal('__PORTAL_BUILD_ENV__', 'preview')
    vi.stubEnv('PORTAL_DATA_MODE', mode)
    const fetcher = vi.fn(() => { throw new TypeError('unexpected external network') })
    vi.stubGlobal('fetch', fetcher)
    await expect(import('../src/cloud/client.js')).rejects.toMatchObject({ name: 'PortalModeError', code: mode === 'mock' ? 'mock_live_access_denied' : 'invalid_configuration' })
    expect(createClient).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps the Production client and auth options intact', async () => {
    vi.stubGlobal('__PORTAL_BUILD_ENV__', 'production')
    vi.stubEnv('PORTAL_DATA_MODE', '')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://unit.invalid')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_unit')
    await import('../src/cloud/client.js')
    expect(createClient).toHaveBeenCalledWith('https://unit.invalid', 'sb_publishable_unit', {
      auth: { storageKey: 'cxr542-portal-auth', detectSessionInUrl: false },
    })
  })

  it('loads the Production runtime without selecting Mock', async () => {
    vi.doMock('../src/cloud/mockBootstrap.js', () => { mockLoaded(); throw new Error('unexpected mock import') })
    vi.doMock('../src/cloud/supabaseBootstrap.js', () => { liveLoaded(); return { ready: Promise.resolve() } })
    const { loadPortalRuntime } = await import('../src/cloud/runtime.js')
    await loadPortalRuntime('production', '')
    expect(liveLoaded).toHaveBeenCalledTimes(1)
    expect(mockLoaded).not.toHaveBeenCalled()
  })

  it('never treats missing Vercel deployment metadata as local production', () => {
    expect(liveDataDenial({ VERCEL: '1', PORTAL_DATA_MODE: 'supabase' })).toMatchObject({ status: 503 })
    expect(liveDataDenial({ VERCEL_ENV: 'preview', PORTAL_DATA_MODE: 'mock' })).toMatchObject({ status: 403 })
    expect(liveDataDenial({ VERCEL_ENV: 'production' })).toBeNull()
  })
})

describe('isolated memory state', () => {
  it('round-trips cloned records and settings without Auth, DB, RPC, Storage or fetch', async () => {
    const fetcher = vi.fn(() => { throw new TypeError('offline') })
    vi.stubGlobal('fetch', fetcher)
    const localStorage = { getItem: vi.fn(() => { throw new Error('legacy data must not be read') }) }
    vi.stubGlobal('localStorage', localStorage)
    const store = createMockStorage()
    const original = { id: 'fixture', title: 'Synthetic note' }
    await store.write('idea-bank', original.id, original)
    original.title = 'mutated outside store'
    await store.settings.setItem('theme', 'dark')
    expect(store.list('idea-bank')).toEqual([{ id: 'fixture', title: 'Synthetic note' }])
    expect(store.settings.getItem('theme')).toBe('dark')
    expect(createMockStorage().list('idea-bank')).toEqual([])
    await store.write('idea-bank', 'fixture', null)
    expect(store.list('idea-bank')).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('explicitly rejects prompt writes, imports and live paths without an offline fallback', async () => {
    const fetcher = vi.fn(() => { throw new TypeError('offline') })
    vi.stubGlobal('fetch', fetcher)
    const prompts = createMockPromptTransport()
    expect(await prompts.request('/api/prompts?limit=50')).toEqual({ items: [], next_cursor: null })
    await expect(prompts.request('/api/prompts', 'POST')).rejects.toMatchObject({ code: 'mock_live_access_denied' })
    await expect(prompts.request('/auth/v1/token')).rejects.toMatchObject({ code: 'mock_live_access_denied' })
    expect(() => prompts.importLegacy({ id: 'legacy' })).toThrow(PortalModeError)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
