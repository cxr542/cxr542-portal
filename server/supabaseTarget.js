import { PortalModeError } from './portalDataMode.js'

// Public, RLS-protected Production project identity. Used only as the
// Production fallback so existing Production deployments keep working when
// their env vars are absent. Every other environment must name its target
// explicitly; a missing value fails closed instead of reaching Production.
const PRODUCTION_URL = 'https://kkcvglldsoxglfjqnsga.supabase.co'
const PRODUCTION_PUBLISHABLE_KEY = 'sb_publishable_hC-H979C3pDsXpsRM_ntIg_8NnnpQP2'

export function resolveSupabaseTarget(environment, url, key) {
  if (environment === 'production') {
    return { url: url || PRODUCTION_URL, key: key || PRODUCTION_PUBLISHABLE_KEY }
  }
  if ((environment === 'development' || environment === 'test') && url && key) return { url, key }
  throw new PortalModeError('invalid_configuration')
}
