import { existsSync, readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import admin from '../api/admin/[...path].mjs'

const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
const fallback = config.rewrites.findIndex(r => r.source === '/(.*)')

function request(method, url, body) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : [])
  return Object.assign(req, { method, url, headers: { host: 'portal.unit', 'content-type': 'application/json' }, query: {} })
}

function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value },
    end(raw) { this.raw = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw },
  }
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Wiki admin routing before the SPA fallback', () => {
  it('rewrites single and nested /api/admin paths to the catch-all function first', () => {
    const i = config.rewrites.findIndex(r => r.source === '/api/admin/:path+')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(i).toBeLessThan(fallback)
    expect(config.rewrites[i].destination).toBe('/api/admin/[...path]')
    expect(existsSync('api/admin/[...path].mjs')).toBe(true)
  })

  it('keeps the SPA fallback as the last rewrite', () => {
    expect(fallback).toBe(config.rewrites.length - 1)
  })
})

describe('Wiki admin entry point', () => {
  it.each(['/api/admin/config', '/api/admin/topics/nl-config', '/api/admin/health'])(
    'rejects %s in Preview mock without reaching upstream', async url => {
      vi.stubEnv('VERCEL_ENV', 'preview')
      vi.stubEnv('PORTAL_DATA_MODE', 'mock')
      vi.stubEnv('WIKI_ADMIN_API_URL', 'https://wiki.unit.invalid')
      const fetcher = vi.fn()
      vi.stubGlobal('fetch', fetcher)
      const res = response()
      await admin(request('GET', url), res)
      expect(res.statusCode).toBe(403)
      expect(res.raw).toContain('mock_live_access_denied')
      expect(fetcher).not.toHaveBeenCalled()
    })

  it.each([
    ['GET', '/api/admin/config', undefined],
    ['GET', '/api/admin/topics/nl-config?x=1', undefined],
    ['PATCH', '/api/admin/config', { protectMode: true }],
    ['DELETE', '/api/admin/topics/gemini', undefined],
  ])('preserves the Production handler for %s %s', async (method, url, body) => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('PORTAL_DATA_MODE', '')
    vi.stubEnv('WIKI_ADMIN_API_URL', 'https://wiki.unit.invalid/')
    const fetcher = vi.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetcher)
    const res = response()
    await admin(request(method, url, body), res)
    expect(res.statusCode).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [target, init] = fetcher.mock.calls[0]
    expect(target).toBe(`https://wiki.unit.invalid${url}`)
    expect(init.method).toBe(method)
    if (body) expect(JSON.parse(init.body.toString('utf8'))).toEqual(body)
  })
})
