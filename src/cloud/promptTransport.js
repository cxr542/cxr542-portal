// The portal's existing Supabase session is reused; credentials never leave this origin.
export function createPromptTransport(client, fetcher = fetch, onChange = () => {}) {
  let snapshot = [];
  let stopped = false;
  async function request(path, method = 'GET', data) {
    if (stopped) throw new Error('로그인이 종료되었습니다. 다시 로그인해 주세요.');
    if (!/^\/api\/prompts(?:\?|\/|$)/.test(path)) throw new Error('잘못된 프롬프트 경로입니다.');
    const { data: auth, error } = await client.auth.getSession();
    if (error || !auth.session?.access_token) throw new Error('로그인이 필요합니다.');
    const response = await fetcher(path, {
      method, cache: 'no-store',
      headers: { authorization: `Bearer ${auth.session.access_token}`, 'content-type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      const messages = { 401:'로그인이 만료되었습니다. 다시 로그인해 주세요.', 409:'다른 곳에서 수정된 항목입니다. 현재 입력을 복사한 뒤 목록을 새로 불러와 주세요.', 410:'삭제된 항목은 다시 가져올 수 없습니다.', 429:'요청이 많습니다. 잠시 후 다시 시도해 주세요.' };
      throw new Error(messages[response.status] || '프롬프트 저장소 요청에 실패했습니다. 입력을 보관하고 다시 시도해 주세요.');
    }
    return result;
  }
  async function list() {
    let cursor = null;
    const rows = [], seen = new Set();
    do {
      const result = await request('/api/prompts?include_content=true&limit=50' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
      rows.push(...result.items);
      cursor = result.next_cursor;
      if (cursor && seen.has(cursor)) throw new Error('목록 페이지를 확인할 수 없습니다.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    if (stopped) throw new Error('로그인이 종료되었습니다.');
    snapshot = rows;
    return structuredClone(rows);
  }
  return {
    request, list,
    async importLegacy(raw) {
      if (raw.deleted_at) throw new Error('삭제된 프롬프트는 자동 복구하지 않습니다.');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('portal-prompt-import-v1:' + String(raw.id || JSON.stringify(raw)))));
      digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
      const hex = Array.from(digest.slice(0,16), b => b.toString(16).padStart(2,'0')).join('');
      const request_id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
      return request('/api/prompts','POST', {title:raw.title || '제목 없음',content:raw.content ?? raw.body ?? '',
        category:raw.category || '',tags:raw.tags || [],description:raw.description || '',favorite:!!(raw.favorite ?? raw.pinned),
        source:'legacy_import',legacy:raw,request_id});
    },
    snapshot: () => structuredClone(snapshot),
    changed: async () => { await list(); onChange(); },
    stop: () => { stopped = true; snapshot = []; },
  };
}
