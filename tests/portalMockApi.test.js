import { afterEach, describe, expect, it, vi } from 'vitest'
import login from '../api/portal-login.js'
import notify from '../api/notify-task-done.mjs'
import admin from '../api/admin/[...path].mjs'
import runningAuth from '../api/running-ops-auth.js'
import sheets from '../api/running-ops-sheets.js'
import prompts from '../api/prompts/index.mjs'
import promptItem from '../api/prompts/[id].mjs'
import auth from '../api/prompt-auth/[action].mjs'
import oauth from '../api/prompt-oauth/[action].mjs'
import mcp from '../api/prompt-mcp.mjs'
import { upstream } from '../server/prompts/http.mjs'

const { createClient, authenticate } = vi.hoisted(() => ({ createClient: vi.fn(), authenticate: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

function response() {
  return {
    headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value },
    end(raw) { this.body = JSON.parse(raw) },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })

const routes = [
  ['login', login], ['notify', notify], ['wiki-admin', admin], ['running-auth', runningAuth], ['sheets', sheets],
  ['prompts', prompts], ['prompt-item', promptItem], ['prompt-auth', auth], ['oauth', oauth], ['mcp', mcp],
]

describe('direct server entry points', () => {
  it.each(routes)('rejects %s before credentials, clients, upstream, RPC or external writes', async (_name, handler) => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('PORTAL_DATA_MODE', 'mock')
    const fetcher = vi.fn(() => { throw new TypeError('unexpected network') })
    vi.stubGlobal('fetch', fetcher)
    const res = response()
    await handler({ method: 'POST', url: '/api/prompts', headers: { 'x-vercel-env': 'production', 'x-portal-data-mode': 'supabase', authorization: 'Bearer synthetic-operating-account' }, query: {}, body: { loginId: 'synthetic', password: 'not-real' } }, res)
    expect(res.statusCode).toBe(403)
    expect(JSON.stringify(res.body)).toContain('mock_live_access_denied')
    expect(createClient).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(JSON.stringify(res.body)).not.toContain('access_token')
  })

  it.each(['', 'supabase', 'unknown'])('fails closed on Preview server mode %s', async mode => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('PORTAL_DATA_MODE', mode)
    const res = response()
    await login({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(503)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('blocks internal REST, Auth, RPC, Storage and Realtime upstream paths in Preview', async () => {
    const fetcher = vi.fn()
    const env = { VERCEL_ENV: 'preview', PORTAL_DATA_MODE: 'mock', PROMPTS_ENABLED: 'true', PROMPTS_SUPABASE_URL: 'https://unit.invalid', PROMPTS_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit' }
    for (const path of ['/auth/v1/user', '/rest/v1/portal_documents', '/rest/v1/rpc/portal_write', '/storage/v1/object', '/realtime/v1']) {
      await expect(upstream(path, { env, fetcher })).rejects.toMatchObject({ status: 403, code: 'mock_live_access_denied' })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves the actual Production login handler and configured account', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('PORTAL_DATA_MODE', '')
    for (const [key, value] of Object.entries({ PORTAL_LOGIN_ID: 'unit', PORTAL_ACCOUNT_EMAIL: 'unit@example.invalid', PORTAL_OWNER_USER_ID: 'unit-owner', SUPABASE_URL: 'https://unit.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit' })) vi.stubEnv(key, value)
    createClient.mockReturnValue({ auth: { signInWithPassword: authenticate } })
    authenticate.mockResolvedValue({ data: { user: { id: 'unit-owner' }, session: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' } } })
    const res = response()
    await login({ method: 'POST', body: { loginId: 'unit', password: 'unit-password' } }, res)
    expect(res.statusCode).toBe(200)
    expect(authenticate).toHaveBeenCalledWith({ email: 'unit@example.invalid', password: 'unit-password' })
    expect(res.body).toEqual({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' })
  })
})
