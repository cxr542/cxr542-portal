export async function loginWithId(client, credentials) {
  const response = await fetch('/api/portal-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) {
    if (result.error === 'account_not_configured') throw new Error('관리자 계정 설정을 준비 중입니다.')
    if (response.status === 429) throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.')
    if (response.status === 503) throw new Error('인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.')
  }
  if (typeof result.access_token !== 'string' || typeof result.refresh_token !== 'string') {
    throw new Error('로그인 응답을 확인할 수 없습니다.')
  }
  const { data, error } = await client.auth.setSession(result)
  if (error || !data.session) throw new Error('로그인 세션을 시작하지 못했습니다.')
  return data.session
}
