import { loadPortalRuntime } from './runtime.js'
import { showInitializationFailure } from './access.js'

export const ready = Promise.resolve().then(() => loadPortalRuntime(
  typeof __PORTAL_BUILD_ENV__ === 'undefined' ? 'development' : __PORTAL_BUILD_ENV__,
  import.meta.env.PORTAL_DATA_MODE,
)).catch(showInitializationFailure).then(runtime => runtime.ready)
