export class PortalModeError extends Error {
  constructor(code) {
    super(code)
    this.name = 'PortalModeError'
    this.code = code
  }
}

export function resolvePortalDataMode(environment, mode) {
  switch (environment) {
    case 'production':
      if (!mode || mode === 'supabase') return 'supabase'
      break
    case 'preview':
      if (mode === 'mock') return 'mock'
      break
    case 'development':
    case 'test':
      if (mode === 'mock' || mode === 'supabase') return mode
      break
    default:
      break
  }
  throw new PortalModeError('invalid_configuration')
}

export function requireLiveDataMode(environment, mode) {
  if (resolvePortalDataMode(environment, mode) !== 'supabase') {
    throw new PortalModeError('mock_live_access_denied')
  }
}
