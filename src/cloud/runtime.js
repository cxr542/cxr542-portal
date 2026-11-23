import { resolvePortalDataMode } from '../../server/portalDataMode.js'

export function loadPortalRuntime(environment, mode) {
  const resolved = resolvePortalDataMode(environment, mode)
  return resolved === 'mock' ? import('./mockBootstrap.js') : import('./supabaseBootstrap.js')
}
