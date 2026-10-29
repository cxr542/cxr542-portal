(function (global) {
  'use strict';
  function api() {
    if (!global.PortalPromptApi) throw new Error('프롬프트 연결을 준비하지 못했습니다. 새로고침해 주세요.');
    return global.PortalPromptApi;
  }
  function view(row) {
    return Object.assign({}, row, { body: row.content, pinned: row.favorite, createdAt: row.created_at, updatedAt: row.updated_at });
  }
  async function listPrompts() { return (await api().list()).map(view); }
  async function getPrompt(id) { return view(await api().request('/api/prompts/' + encodeURIComponent(id))); }
  async function putPrompt(prompt) {
    var updating = Number.isInteger(prompt.version) && prompt.version > 0;
    var data = { title:prompt.title, content:prompt.body || '', favorite:!!prompt.pinned,
      category:prompt.category || '', tags:prompt.tags || [], description:prompt.description || '' };
    if (updating) data.version = prompt.version;
    else data.request_id = prompt.request_id || (prompt.request_id = global.crypto.randomUUID());
    var row = await api().request('/api/prompts' + (updating ? '/' + encodeURIComponent(prompt.id) : ''), updating ? 'PATCH' : 'POST', data);
    Object.assign(prompt, view(row));
    await api().changed();
    return view(row);
  }
  async function deletePrompt(id, version) {
    if (!Number.isInteger(version) || version < 1) throw new Error('목록에서 다시 연 뒤 삭제해 주세요.');
    await api().request('/api/prompts/' + encodeURIComponent(id), 'DELETE', {version:version});
    await api().changed();
  }
  async function legacyRequestId(raw) {
    var input = 'portal-prompt-import-v1:' + String(raw.id || JSON.stringify(raw));
    var digest = new Uint8Array(await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
    digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
    var hex = Array.from(digest.slice(0,16), function (b) { return b.toString(16).padStart(2,'0'); }).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  async function importPayload(data, replace) {
    if (replace) throw new Error('원본 보호를 위해 전체 삭제 가져오기는 지원하지 않습니다.');
    var rows = data && data.prompts;
    if (!Array.isArray(rows)) throw new Error('프롬프트 JSON 백업을 선택해 주세요.');
    if (rows.some(function(raw){return raw.deleted_at;})) throw new Error('삭제된 프롬프트가 포함된 백업은 자동 복구하지 않습니다.');
    for (var raw of rows) {
      await api().request('/api/prompts','POST', {
        title:raw.title || '제목 없음', content:raw.content ?? raw.body ?? '', favorite:!!(raw.favorite ?? raw.pinned),
        category:raw.category || '', tags:raw.tags || [], description:raw.description || '',
        source:'legacy_import', legacy:raw, request_id:await legacyRequestId(raw),
      });
    }
    await api().changed();
  }
  global.PromptCollectionDb = { listPrompts:listPrompts, getPrompt:getPrompt, putPrompt:putPrompt, deletePrompt:deletePrompt,
    seedIfEmpty:listPrompts, slugFromTitle:function(){return global.crypto.randomUUID();},
    getStorageMode:function(){return Promise.resolve('supabase');},
    exportPayload:function(rows){return {version:2,exportedAt:new Date().toISOString(),prompts:rows};}, importPayload:importPayload };
})(window);
