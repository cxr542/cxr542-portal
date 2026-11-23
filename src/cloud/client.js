import { createClient } from '@supabase/supabase-js'
import { requireLiveDataMode } from '../../server/portalDataMode.js'
import { resolveSupabaseTarget } from '../../server/supabaseTarget.js'

const environment = typeof __PORTAL_BUILD_ENV__ === 'undefined' ? 'development' : __PORTAL_BUILD_ENV__
requireLiveDataMode(environment, import.meta.env.PORTAL_DATA_MODE)
const target = resolveSupabaseTarget(environment, import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

// Publishable key only. RLS enforces ownership on the server.
export const client = createClient(
  target.url,
  target.key,
  { auth: { storageKey: 'cxr542-portal-auth', detectSessionInUrl: false } },
)
