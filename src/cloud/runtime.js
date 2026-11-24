import { PortalModeError, resolvePortalDataMode } from '../../server/portalDataMode.js'

export function loadPortalRuntime(environment, mode) {
  const resolved = resolvePortalDataMode(environment, mode)
  if (resolved === 'mock') return import('./mockBootstrap.js')
  // Build-time constant: a Mock build folds this to a rejection, so Rollup
  // never emits the live Supabase bootstrap/client chunk into its output.
  return import.meta.env.PORTAL_DATA_MODE === 'mock'
    ? Promise.reject(new PortalModeError('mock_live_access_denied'))
    : import('./supabaseBootstrap.js')
}
