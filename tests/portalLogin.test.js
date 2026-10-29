import { describe, expect, it, vi } from 'vitest'
import { createPortalLogin } from '../api/portal-login.js'
import { loginWithId } from '../src/cloud/login.js'

const config = { loginId: 'cxr542', email: 'portal@cxr542.invalid', ownerId: 'owner-uuid' }
const valid = { data: { user: { id: 'owner-uuid' }, session: { access_token: 'test-access', refresh_token: 'test-refresh' } }, error: null }
function response() {
  return { headers: {}, code: 0, body: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
}

describe('single-account ID/password endpoint', () => {
  it('uses the configured account and returns only session tokens for its owner', async () => {
    const authenticate = vi.fn(async () => valid)
    const res = response()
    await createPortalLogin(config, authenticate)({ method: 'POST', body: { loginId: 'cxr542', password: 'test-password' } }, res)
    expect(authenticate).toHaveBeenCalledWith({ email: config.email, password: 'test-password' })
    expect(res.code).toBe(200)
    expect(res.body).toEqual(valid.data.session)
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it.each([
    { loginId: 'stranger', password: 'test-password' },
    { email: config.email, password: 'test-password' },
    { loginId: 'cxr542', password: '' },
    { loginId: 'cxr542', password: ['unexpected'] },
  ])('rejects invalid credentials before contacting Auth: %j', async body => {
    const authenticate = vi.fn()
    const res = response()
    await createPortalLogin(config, authenticate)({ method: 'POST', body }, res)
    expect(res.code).toBe(401)
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('denies a valid Supabase session belonging to a different user', async () => {
    const res = response()
    await createPortalLogin(config, async () => ({ ...valid, data: { ...valid.data, user: { id: 'other-uuid' } } }))(
      { method: 'POST', body: { loginId: 'cxr542', password: 'test-password' } }, res,
    )
    expect(res.code).toBe(401)
    expect(res.body).toEqual({ error: 'invalid_credentials' })
  })

  it('fails closed when the owner account has not been configured', async () => {
    const res = response()
    const authenticate = vi.fn()
    await createPortalLogin({}, authenticate)({ method: 'POST', body: {} }, res)
    expect(res.code).toBe(503)
    expect(res.body.error).toBe('account_not_configured')
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('preserves provider rate limits without exposing provider error details', async () => {
    const res = response()
    await createPortalLogin(config, async () => ({ data: null, error: { status: 429, message: 'internal provider details' } }))(
      { method: 'POST', body: { loginId: 'cxr542', password: 'test-password' } }, res,
    )
    expect(res.code).toBe(429)
    expect(res.body).toEqual({ error: 'invalid_credentials' })
  })

  it('rejects unsupported methods', async () => {
    const res = response()
    await createPortalLogin(config, vi.fn())({ method: 'GET' }, res)
    expect(res.code).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })
})

describe('ID login client', () => {
  it('installs the authenticated session returned by the same-origin endpoint', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => valid.data.session })
    const client = { auth: { setSession: vi.fn(async () => ({ data: { session: valid.data.session }, error: null })) } }
    try {
      const session = await loginWithId(client, { loginId: 'cxr542', password: 'test-password' })
      expect(session).toEqual(valid.data.session)
      expect(fetcher.mock.calls[0][0]).toBe('/api/portal-login')
      expect(client.auth.setSession).toHaveBeenCalledWith(valid.data.session)
    } finally { fetcher.mockRestore() }
  })

  it('never installs a session on an invalid login', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'invalid_credentials' }) })
    const client = { auth: { setSession: vi.fn() } }
    try {
      await expect(loginWithId(client, { loginId: 'wrong', password: 'test-password' })).rejects.toThrow('일치하지')
      expect(client.auth.setSession).not.toHaveBeenCalled()
    } finally { fetcher.mockRestore() }
  })
})
