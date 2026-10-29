export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('레코드 형식을 확인해 주세요.');
  const title = raw.title;
  const content = raw.body ?? raw.content ?? '';
  if (typeof title !== 'string' || !title.trim() || title.length > 300 || typeof content !== 'string' || content.length > 40000) throw new Error('제목 또는 본문 길이를 확인해 주세요.');
  const tags = raw.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 20 || tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 60)) throw new Error('태그 형식을 확인해 주세요.');
  const description = raw.description ?? ''; const category = raw.category ?? '';
  if (typeof description !== 'string' || description.length > 2000 || typeof category !== 'string' || category.length > 100) throw new Error('설명 또는 카테고리를 확인해 주세요.');
  return { title: title.trim(), content, description:description.trim(), category:category.trim(), tags:[...new Set(tags.map(t => t.trim()))], favorite:!!(raw.pinned ?? raw.favorite), source:'legacy_import' };
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function requestId(raw) {
  if (typeof raw.request_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.request_id)) return raw.request_id;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(raw))));
  digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
  const hex = [...digest.slice(0,16)].map(v => v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function payloadRows(data) {
  if (!data || typeof data !== 'object') throw new Error('지원하지 않는 백업 형식입니다.');
  if (Array.isArray(data.prompts)) return data.prompts;
  if (Array.isArray(data.ideas)) return data.ideas;
  if (data.format === 'prompt-collection-local-backup' && Array.isArray(data.indexeddb) && Array.isArray(data.localstorage)) {
    if (data.drafts !== undefined && !Array.isArray(data.drafts)) throw new Error('초안 백업 형식을 확인해 주세요.');
    return [...data.indexeddb,...data.localstorage,...(data.drafts || [])];
  }
  throw new Error('지원하지 않는 백업 형식입니다.');
}
export async function preview(rows, central = []) {
  const seen = new Set(); const result = [];
  for (const raw of rows) {
    try {
      const data = normalize(raw); const request_id = await requestId(raw);
      const fingerprint = canonical({ ...data, source:null });
      const deleted = !!raw.deleted_at || central.some(p => p.deleted_at && (p.request_id === request_id || (raw.id && (p.id === raw.id || p.legacy?.id === raw.id)) || canonical({ ...normalize(p),source:null }) === fingerprint));
      const duplicate = seen.has(request_id) || central.some(p => !p.deleted_at && canonical({ ...normalize(p), source:null }) === fingerprint);
      const conflict = !duplicate && central.some(p => p.title === data.title);
      seen.add(request_id);
      result.push({ raw, data, request_id, status: deleted ? 'deleted' : duplicate ? 'duplicate' : conflict ? 'conflict' : 'ready', selected:!deleted && !duplicate && !conflict });
    } catch (err) { result.push({ raw, status:'invalid', selected:false, error:err.message }); }
  }
  return result;
}
export async function upload(items, api, onProgress = () => {}, shouldStop = () => false) {
  for (const item of items.filter(i => i.selected && ['ready','conflict','failed'].includes(i.status))) {
    if (shouldStop()) break;
    try {
      item.status = 'uploading'; onProgress(item);
      const saved = await api.create({ ...item.data, request_id:item.request_id, legacy:item.raw });
      const verified = await api.get(saved.id);
      if (canonical({ ...normalize(verified), source:null }) !== canonical({ ...item.data, source:null })) throw new Error('서버 재조회 결과가 다릅니다. 원본을 유지하고 확인해 주세요.');
      item.status = 'done'; item.server_id = saved.id; item.error = null;
    } catch (err) {
      item.status = err.status === 410 ? 'deleted' : 'failed';
      item.error = err.status === 410 ? '이전에 삭제한 항목입니다. 자동 복구하지 않습니다.' : err.status === 409 ? '서버 기록과 충돌했습니다. 원본과 서버 내용을 확인해 주세요.' : err.status ? '서버 연결 또는 요청에 실패했습니다. 원본을 유지했습니다. 다시 시도해 주세요.' : err.message;
    }
    onProgress(item);
  }
  return items;
}
