import { createClient } from '@supabase/supabase-js'
import { rejectLiveRequest, serverEnvironment } from '../server/portalMode.js'
import { resolveSupabaseTarget } from '../server/supabaseTarget.js'

export function createPortalLogin(config, authenticate) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method_not_allowed' })
    }
    if (!config.loginId || !config.email || !config.ownerId) {
      return res.status(503).json({ error: 'account_not_configured' })
    }
    const { loginId, password } = req.body || {}
    if (typeof loginId !== 'string' || typeof password !== 'string' ||
        loginId.trim() !== config.loginId || !password || password.length > 1024) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    try {
      const { data, error } = await authenticate({ email: config.email, password })
      if (error || !data?.session || data.user?.id !== config.ownerId) {
        return res.status(error?.status === 429 ? 429 : 401).json({ error: 'invalid_credentials' })
      }
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    } catch {
      return res.status(503).json({ error: 'authentication_unavailable' })
    }
  }
}

export default function handler(req, res) {
  if (rejectLiveRequest(res)) return
  let target
  try {
    target = resolveSupabaseTarget(serverEnvironment(), process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ error: 'invalid_configuration' })
  }
  const client = createClient(
    target.url,
    target.key,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
  const authenticate = credentials => client.auth.signInWithPassword(credentials)
  return createPortalLogin({
    loginId: process.env.PORTAL_LOGIN_ID,
    email: process.env.PORTAL_ACCOUNT_EMAIL,
    ownerId: process.env.PORTAL_OWNER_USER_ID,
  }, authenticate)(req, res)
}
