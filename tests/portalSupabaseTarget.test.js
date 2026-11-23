import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortalModeError } from '../server/portalDataMode.js'
import { resolveSupabaseTarget } from '../server/supabaseTarget.js'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ auth: { signInWithPassword: vi.fn() } })) }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const PRODUCTION_URL = 'https://kkcvglldsoxglfjqnsga.supabase.co'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.clearAllMocks()
})

function response() {
  return {
    headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value },
    end(raw) { this.body = JSON.parse(raw) },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

describe('Supabase target resolution', () => {
  it('keeps the Production fallback only for Production', () => {
    expect(resolveSupabaseTarget('production', undefined, undefined).url).toBe(PRODUCTION_URL)
    expect(resolveSupabaseTarget('production', 'https://unit.invalid', 'sb_publishable_unit')).toEqual({ url: 'https://unit.invalid', key: 'sb_publishable_unit' })
  })

  it.each([
    ['development', undefined, undefined], ['development', 'https://unit.invalid', undefined], ['development', undefined, 'sb_publishable_unit'],
    ['test', '', ''], ['preview', 'https://unit.invalid', 'sb_publishable_unit'], ['unknown', 'https://unit.invalid', 'sb_publishable_unit'], [undefined, undefined, undefined],
  ])('fails closed instead of reaching Production: env=%s url=%s key=%s', (environment, url, key) => {
    expect(() => resolveSupabaseTarget(environment, url, key)).toThrow(PortalModeError)
  })

  it('accepts an explicit local target', () => {
    expect(resolveSupabaseTarget('development', 'http://127.0.0.1:54321', 'sb_publishable_local')).toEqual({ url: 'http://127.0.0.1:54321', key: 'sb_publishable_local' })
  })
})

describe('browser client module', () => {
  it('does not construct a Production client from a local supabase build without an explicit target', async () => {
    vi.stubGlobal('__PORTAL_BUILD_ENV__', 'development')
    vi.stubEnv('PORTAL_DATA_MODE', 'supabase')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    await expect(import('../src/cloud/client.js')).rejects.toMatchObject({ name: 'PortalModeError', code: 'invalid_configuration' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps the existing Production fallback for Production builds', async () => {
    vi.stubGlobal('__PORTAL_BUILD_ENV__', 'production')
    vi.stubEnv('PORTAL_DATA_MODE', '')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    await import('../src/cloud/client.js')
    expect(createClient).toHaveBeenCalledWith(PRODUCTION_URL, expect.stringMatching(/^sb_publishable_/), {
      auth: { storageKey: 'cxr542-portal-auth', detectSessionInUrl: false },
    })
  })
})

describe('server login target', () => {
  it('returns 503 without creating a client when local supabase mode has no explicit target', async () => {
    for (const key of ['VERCEL', 'VERCEL_ENV', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) vi.stubEnv(key, undefined)
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PORTAL_DATA_MODE', 'supabase')
    const { default: login } = await import('../api/portal-login.js')
    const res = response()
    await login({ method: 'POST', body: { loginId: 'synthetic', password: 'not-real' } }, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'invalid_configuration' })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('every deployed server Function', () => {
  const apiRoot = fileURLToPath(new URL('../api/', import.meta.url))
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : /\.(m?js)$/.test(entry.name) ? [path] : []
  })
  const files = walk(apiRoot).map(path => [relative(apiRoot, path), path])

  it('discovers the API directory', () => {
    expect(files.length).toBeGreaterThanOrEqual(10)
  })

  it.each(files)('api/%s fails closed in Mock Preview, including routes added later', async (_name, path) => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('PORTAL_DATA_MODE', 'mock')
    const fetcher = vi.fn(() => { throw new TypeError('unexpected network') })
    vi.stubGlobal('fetch', fetcher)
    const { default: handler } = await import(pathToFileURL(path).href)
    expect(typeof handler).toBe('function')
    const res = response()
    await handler({ method: 'POST', url: '/api/unit', headers: { 'content-type': 'application/json' }, query: { action: 'token', id: 'unit', path: ['unit'] }, body: {} }, res)
    expect(res.statusCode).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('Mock build runtime selection', () => {
  it('rejects the live runtime when the build itself is Mock, without importing it', async () => {
    const liveLoaded = vi.fn()
    vi.stubEnv('PORTAL_DATA_MODE', 'mock')
    vi.doMock('../src/cloud/supabaseBootstrap.js', () => { liveLoaded(); return { ready: Promise.resolve() } })
    const { loadPortalRuntime } = await import('../src/cloud/runtime.js')
    await expect(loadPortalRuntime('production', '')).rejects.toMatchObject({ code: 'mock_live_access_denied' })
    expect(liveLoaded).not.toHaveBeenCalled()
    vi.doUnmock('../src/cloud/supabaseBootstrap.js')
  })
})
