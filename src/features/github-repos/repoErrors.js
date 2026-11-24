// No imports: shared by the browser UI and Node server Functions.
export const SOURCE_ERRORS = {
  unauthorized: 'GitHub 인증이 필요하거나 만료되었습니다.',
  forbidden: '이 저장소 목록을 볼 권한이 없습니다.',
  rate_limited: 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
  not_configured: 'GitHub 연동이 아직 설정되지 않았습니다.',
  network: 'GitHub에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.',
  invalid_response: 'GitHub 응답을 해석하지 못했습니다.',
  unknown: '저장소 목록을 불러오지 못했습니다.',
};

export class RepoSourceError extends Error {
  constructor(code, { resetAt = null } = {}) {
    super(code);
    this.name = 'RepoSourceError';
    this.code = Object.hasOwn(SOURCE_ERRORS, code) ? code : 'unknown';
    this.resetAt = resetAt;
  }
}

/** Phase 2 helper: maps a GitHub REST response status/headers to a RepoSourceError code (null when OK). */
export function classifyGithubResponse(status, headers = {}) {
  const header = name => (typeof headers.get === 'function' ? headers.get(name) : headers[name]) ?? null;
  if (status >= 200 && status < 300) return null;
  if (status === 401) return new RepoSourceError('unauthorized');
  if (status === 429 || (status === 403 && (header('x-ratelimit-remaining') === '0' || header('retry-after')))) {
    const reset = Number(header('x-ratelimit-reset'));
    return new RepoSourceError('rate_limited', { resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null });
  }
  if (status === 403 || status === 404) return new RepoSourceError('forbidden');
  return new RepoSourceError(status >= 500 ? 'network' : 'unknown');
}
