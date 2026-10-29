import { createClient } from '@supabase/supabase-js'

// Publishable key only. RLS enforces ownership on the server.
export const client = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://kkcvglldsoxglfjqnsga.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hC-H979C3pDsXpsRM_ntIg_8NnnpQP2',
  { auth: { storageKey: 'cxr542-portal-auth', detectSessionInUrl: false } },
)
