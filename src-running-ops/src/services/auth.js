export async function verifyAccess(role, password) {
  const response = await fetch('/api/running-ops-auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, password }),
  })

  if (!response.ok) {
    const error = new Error('auth_failed')
    error.status = response.status
    throw error
  }

  return response.json()
}

let session = null

export function loadSession() { return session }
export function saveSession(next) { session = next }
export function clearSession() { session = null }
