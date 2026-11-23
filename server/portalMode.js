import { PortalModeError, requireLiveDataMode } from './portalDataMode.js'

export function liveDataDenial(env = process.env) {
  const environment = env.VERCEL_ENV || (env.VERCEL ? 'unknown' : env.NODE_ENV === 'test' ? 'test' : 'development')
  try {
    requireLiveDataMode(environment, env.PORTAL_DATA_MODE)
    return null
  } catch (error) {
    if (!(error instanceof PortalModeError)) throw error
    return { status: error.code === 'mock_live_access_denied' ? 403 : 503, code: error.code }
  }
}

export function rejectLiveRequest(res, env = process.env) {
  const denial = liveDataDenial(env)
  if (!denial) return false
  res.statusCode = denial.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: denial.code }))
  return true
}
