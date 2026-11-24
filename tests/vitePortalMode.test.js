import { afterEach, expect, it, vi } from 'vitest'

const { fileEnv, createClient } = vi.hoisted(() => ({ fileEnv: {}, createClient: vi.fn(() => ({ auth: { signInWithPassword: vi.fn() } })) }))
vi.mock('vite', () => ({ defineConfig: config => config, loadEnv: () => fileEnv }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.clearAllMocks()
  for (const key of Object.keys(fileEnv)) delete fileEnv[key]
})

it.each([
  ['supabase', undefined, true, 503, 'account_not_configured', 1],
  ['supabase', undefined, false, 503, 'invalid_configuration', 0],
  ['mock', undefined, true, 403, 'mock_live_access_denied', 0],
  ['mock', 'supabase', true, 503, 'invalid_configuration', 0],
])('applies trusted file-only mode %s (client %s, explicit target %s) consistently through the actual local login middleware', async (mode, clientMode, explicitTarget, status, error, clients) => {
  for (const key of ['VERCEL', 'VERCEL_ENV', 'PORTAL_DATA_MODE', 'VITE_PORTAL_DATA_MODE', 'PORTAL_LOGIN_ID', 'PORTAL_ACCOUNT_EMAIL', 'PORTAL_OWNER_USER_ID', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) vi.stubEnv(key, undefined)
  if (explicitTarget) {
    vi.stubEnv('SUPABASE_URL', 'https://unit.invalid')
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_unit')
  }
  fileEnv.PORTAL_DATA_MODE = mode
  if (clientMode !== undefined) fileEnv.VITE_PORTAL_DATA_MODE = clientMode
  const { default: configure } = await import('../vite.config.js')
  const config = configure({ command: 'serve', mode: 'test' })
  const middleware = []
  const server = { middlewares: { use: fn => { middleware.push(fn); return server.middlewares } } }
  for (const name of ['portal-data-mode', 'portal-login']) config.plugins.find(plugin => plugin.name === name).configureServer(server)
  const req = Object.assign((async function* () {})(), { url: '/api/portal-login', method: 'POST' })
  const res = { setHeader: vi.fn(), end(raw) { this.body = JSON.parse(raw) } }
  let proceed = false
  middleware[0](req, res, () => { proceed = true })
  if (proceed) await middleware[1](req, res, () => { throw new Error('login handler was skipped') })
  expect(res.statusCode).toBe(status)
  expect(res.body).toEqual({ error })
  expect(createClient).toHaveBeenCalledTimes(clients)
})
