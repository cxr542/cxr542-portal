import '/shared/js/project-shell.js?v=portal2';
import './db.js?v=portal2';
import { api } from './api-client.js';
import { cache } from './cache.js';
import { normalize, payloadRows, preview, upload } from './migration.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const state = { user:null, enabled:false, rows:[], view:'list', draft:null, epoch:0, sequence:0, busy:false, offline:false, migration:[], backup:null };
let draftWrites = Promise.resolve();
const owner = () => state.user?.id || 'local';
function localFilter(rows) {
  const q = $('search').value.trim().toLowerCase();
  const category = $('filter-category').value.trim();
  const tags = $('filter-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  return rows.filter(p => (!q || `${p.title}\n${p.content ?? p.body ?? ''}\n${p.description || ''}\n${(p.tags || []).join(' ')}`.toLowerCase().includes(q)) && (!category || (p.category || '').trim() === category) && tags.every(t => (p.tags || []).includes(t)) && (state.view !== 'pinned' || (p.favorite ?? p.pinned)));
}
async function fullPrompt(row) {
  if (!state.user || state.offline) {
    if (state.user && typeof row.content !== 'string') throw new Error('이 항목의 본문은 온라인에서 한 번 열어 주세요.');
    return row;
  }
  try { return await api.get(row.id); }
  catch (err) {
    if ((!err.status || err.status >= 500) && typeof row.content === 'string') { state.offline = true; return row; }
    throw err;
  }
}
function status(text, error = false) {
  $('save-status').textContent = text; $('save-status').classList.toggle('is-error',error);
  const inline = $('editor-status');
  $('save-status').setAttribute('aria-live',inline ? 'off' : 'polite');
  if (inline) { inline.textContent = text; inline.classList.toggle('is-error',error); }
}
function errorText(err) {
  return ({ version_conflict:'다른 기기에서 수정했습니다. 초안을 보존했습니다. 최신 항목을 다시 열어 비교해 주세요.', unauthorized:'로그인이 필요합니다. 로컬 초안은 보존됩니다.', not_configured:'중앙 저장소가 아직 설정되지 않았습니다.', already_deleted:'이전에 삭제한 항목입니다. 자동 복구하지 않습니다.', rate_limited:'요청이 많습니다. 1분 뒤 다시 시도해 주세요.' })[err.code] || '요청에 실패했습니다. 원본·초안을 유지했습니다. 연결 후 다시 시도해 주세요.';
}
function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{ type:'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function account() {
  $('account').innerHTML = state.user
    ? `<div class="account-row"><span>${escape(state.user.email)} · 개인 저장소</span><button id="logout" class="btn" type="button">로그아웃</button></div>`
    : `<form id="login-form" class="account-row"><label>이메일 <input name="email" type="email" autocomplete="username" required /></label><label>비밀번호 <input name="password" type="password" autocomplete="current-password" required /></label><button class="btn" type="submit" ${state.enabled ? '' : 'disabled'}>로그인</button><span>${state.enabled ? '등록된 계정으로 로그인하세요.' : '중앙 저장소 설정 전입니다. 원본 백업과 로컬 초안을 사용할 수 있습니다.'}</span></form>`;
  $('btn-central-export').disabled = !state.user;
  if (state.user) $('logout').onclick = async () => {
    if (state.busy) return;
    try { await persist(); } catch { status('초안을 저장하지 못했습니다. 본문을 복사해 주세요.',true); return; }
    state.busy = true; ++state.epoch; ++state.sequence; state.rows = []; state.draft = null; state.view = 'list';
    try { await api.logout(); } catch { /* Clear the local session even when the network is unavailable. */ }
    state.user = null; state.busy = false; account(); await load();
  };
  else $('login-form').onsubmit = async event => {
    event.preventDefault(); if (state.busy) return;
    const form = event.currentTarget; const values = new FormData(form); state.busy = true;
    try {
      await persist(); state.user = await api.login(String(values.get('email')),String(values.get('password')));
      form.reset(); ++state.epoch; state.draft = null; state.view = 'list'; account(); await load(); await consent();
    } catch (err) { status(errorText(err),true); }
    finally { state.busy = false; }
  };
}
function filters() {
  const p = new URLSearchParams({ limit:'20',include_content:'true' });
  if ($('search').value.trim()) p.set('q',$('search').value.trim());
  if ($('filter-category').value.trim()) p.set('category',$('filter-category').value.trim());
  if ($('filter-tags').value.trim()) p.set('tags',$('filter-tags').value.split(',').map(s => s.trim()).filter(Boolean).join(','));
  if (state.view === 'pinned') p.set('favorite','true');
  return p;
}
function counts() {
  $('nav-count-all').textContent = String(state.rows.length) + (state.cursor ? '+' : '');
  $('nav-count-pinned').textContent = String(state.rows.filter(p => p.favorite ?? p.pinned).length);
}
function renderList() {
  window.ProjectShell?.setActiveView(state.view);
  counts();
  $('content').innerHTML = `<p class="list-meta">${state.user ? state.offline ? `오프라인 캐시${state.cacheComplete ? ' · 마지막 조회 목록' : ' · 저장된 목록 일부'}` : '중앙 저장소' : '기존 브라우저 원본 · 읽기 전용'} · ${state.rows.length}개${state.cursor ? ' 이상' : ''}</p>` +
    (state.rows.length ? state.rows.map((p,i) => `<article class="prompt-card"><div class="prompt-card__body"><button class="prompt-open" type="button" data-edit="${i}">${escape(p.title)}</button><p class="prompt-card__preview">${escape((p.description || p.content || p.body || '').slice(0,140))}</p><div class="pill-row">${p.category ? `<span class="pill">${escape(p.category)}</span>` : ''}${(p.tags || []).map(t => `<span class="pill">${escape(t)}</span>`).join('')}${(p.favorite ?? p.pinned) ? '<span class="pill">즐겨찾기</span>' : ''}<button class="btn-copy-inline" data-copy="${i}" type="button">복사</button></div></div></article>`).join('') : '<p class="empty">표시할 프롬프트가 없습니다. 새 프롬프트를 작성하거나 기존 데이터를 가져오세요.</p>') +
    (state.cursor ? '<button id="load-more" class="btn" type="button">더 보기</button>' : '');
  document.querySelectorAll('[data-edit]').forEach(b => { const row = state.rows[Number(b.dataset.edit)]; b.onclick = () => edit(row); });
  document.querySelectorAll('[data-copy]').forEach(b => { const row = state.rows[Number(b.dataset.copy)]; b.onclick = async () => {
    try { const full = await fullPrompt(row); await navigator.clipboard.writeText(full.content ?? full.body ?? ''); status(`본문을 복사했습니다.${state.offline ? ' · 오프라인 캐시 기준' : ''}`); } catch (err) { status(errorText(err),true); }
  }; });
  if ($('load-more')) $('load-more').onclick = () => load(true);
}
async function load(more = false) {
  if (state.view === 'edit' || state.view === 'drafts') return;
  const seq = ++state.sequence; const epoch = state.epoch; const who = owner();
  status('불러오는 중…');
  try {
    let rows; let cursor = null;
    if (state.user) {
      const p = filters(); if (more && state.cursor) p.set('cursor',state.cursor);
      const page = await api.request('/api/prompts?' + p); rows = page.items; cursor = page.next_cursor;
      if (seq !== state.sequence || epoch !== state.epoch) return;
      if (more) rows = [...new Map([...state.rows,...rows].map(p => [p.id,p])).values()];
      if (!['q','category','tags','favorite'].some(k => p.has(k))) await cache.put(who,rows,!cursor).catch(() => {});
    } else {
      const legacy = await window.PromptCollectionDb.readLegacy();
      rows = localFilter([...legacy.indexeddb,...legacy.localstorage]);
    }
    if (seq !== state.sequence || epoch !== state.epoch) return;
    state.rows = rows; state.cursor = cursor; state.offline = false; renderList();
    status(state.user ? '서버 조회 완료 · 다른 기기의 변경은 새로고침으로 확인' : '기존 데이터는 그대로 보존됩니다. 새 내용은 로컬 초안으로 저장하세요.');
  } catch (err) {
    if (seq !== state.sequence || epoch !== state.epoch) return;
    if (err.status === 401) { state.user = null; state.rows = []; account(); renderList(); }
    else if (state.user) {
      try { const saved = await cache.get(who); state.rows = localFilter(saved?.items || []); state.cacheComplete = !!saved?.complete; state.cursor = null; state.offline = true; renderList(); } catch { state.rows = []; renderList(); }
    }
    status(errorText(err),true);
  }
}
async function edit(row) {
  if (state.busy) return;
  const epoch = state.epoch;
  try {
    await persist();
    const full = row ? await fullPrompt(row) : null;
    if (epoch !== state.epoch) return;
    state.draft = { ...(full ? normalize(full) : { title:'',content:'',description:'',category:'',tags:[],favorite:false }), id: state.user ? full?.id : undefined, version:full?.version, draft_id:crypto.randomUUID(), request_id:crypto.randomUUID() };
    state.view = 'edit'; state.sequence++; renderEdit();
  } catch (err) { status(errorText(err),true); }
}
function readForm() {
  if (!state.draft || !$('edit-form')) return;
  for (const key of ['title','content','description','category']) state.draft[key] = $('f-'+key).value;
  state.draft.tags = $('f-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  state.draft.favorite = $('f-favorite').checked;
}
async function persist() {
  if (!state.draft) return;
  readForm();
  const item = structuredClone(state.draft); const who = owner();
  draftWrites = draftWrites.catch(() => {}).then(() => cache.draft(who,item));
  return draftWrites;
}
function renderEdit() {
  window.ProjectShell?.setActiveView('edit');
  const d = state.draft;
  $('content').innerHTML = `<form id="edit-form" class="sketch-form"><h2>${d.id ? '프롬프트 편집' : '새 프롬프트'}</h2>` +
    [['title','제목',300],['description','설명',2000],['category','카테고리',100],['tags','태그 (쉼표로 구분)',1200]].map(([k,label,max]) => `<label class="field-label" for="f-${k}">${label}</label><input class="field-input" id="f-${k}" maxlength="${max}" value="${escape(k === 'tags' ? d.tags.join(', ') : d[k])}" ${k === 'title' ? 'required' : ''} />`).join('') +
    `<label class="field-label" for="f-content">프롬프트 본문</label><textarea id="f-content" class="sketch-body" maxlength="40000">${escape(d.content)}</textarea><label class="field-label"><input id="f-favorite" type="checkbox" ${d.favorite ? 'checked' : ''} /> 즐겨찾기</label><div class="form-actions"><button class="btn btn--primary" id="save" type="submit" ${state.user ? '' : 'disabled'}>서버에 저장</button><button class="btn" id="save-draft" type="button">로컬 초안 저장</button><button class="btn" id="copy-body" type="button">본문 복사</button><button class="btn" id="back" type="button">목록</button>${d.id ? '<button class="btn btn--danger" id="delete" type="button">서버에서 삭제</button>' : ''}</div><p id="editor-status" role="status" aria-live="polite" class="list-meta">${state.user ? '서버 저장에 실패해도 초안은 이 기기에 남습니다.' : '로그인 전에는 로컬 초안만 저장됩니다.'}</p></form>`;
  $('edit-form').oninput = () => { persist().then(() => status('로컬 초안 저장됨 · 서버에는 아직 반영되지 않았습니다.')).catch(() => status('로컬 저장 불가 · 화면을 닫기 전 본문을 복사해 주세요.',true)); };
  $('save-draft').onclick = () => persist().then(() => status('로컬 초안 저장됨')).catch(() => status('로컬 초안 저장에 실패했습니다.',true));
  $('copy-body').onclick = async () => { try { await navigator.clipboard.writeText($('f-content').value); status('본문을 복사했습니다.'); } catch { status('복사하지 못했습니다. 본문을 직접 선택해 주세요.',true); } };
  $('back').onclick = async () => { try { await persist(); state.draft = null; state.view = 'list'; await load(); } catch { status('초안을 저장하지 못했습니다. 본문을 복사해 주세요.',true); } };
  $('edit-form').onsubmit = save;
  if ($('delete')) $('delete').onclick = remove;
  $('f-title').focus();
  if (state.offline) status('오프라인 캐시를 열었습니다. 변경 내용은 로컬 초안으로 보관하세요.');
}
function editorBusy(busy) { state.busy = busy; $('edit-form').querySelectorAll('input,textarea,button').forEach(el => { el.disabled = busy; }); }
async function save(event) {
  event.preventDefault(); if (state.busy || !state.user) return;
  editorBusy(true);
  let localSaved = true;
  try {
    readForm(); const d = state.draft; const data = normalize(d); data.source = 'portal';
    await persist().catch(() => { localSaved = false; }); status('서버에 저장 중…');
    const saved = d.id ? await api.update(d.id,{ ...data,version:d.version }) : await api.create({ ...data,request_id:d.request_id });
    d.id = saved.id; d.version = saved.version;
    await cache.removeDraft(owner(),d.draft_id).catch(() => {});
    state.draft = null; state.view = 'list'; await load(); status(`서버 저장됨 · 버전 ${saved.version}`);
  } catch (err) { status((err.status ? errorText(err) : err.message) + (localSaved ? '' : ' 로컬 저장도 불가합니다. 화면을 닫기 전 본문을 복사해 주세요.'),true); }
  finally { state.busy = false; if ($('edit-form')) editorBusy(false); }
}
async function remove() {
  if (state.busy || !window.confirm('이 프롬프트를 서버에서 삭제할까요? 기존 브라우저 원본은 유지됩니다.')) return;
  editorBusy(true);
  try { await persist(); editorBusy(true); await api.delete(state.draft.id,state.draft.version); await cache.removeDraft(owner(),state.draft.draft_id); state.draft = null; state.view = 'list'; await load(); status('서버에서 삭제했습니다.'); }
  catch (err) { status(errorText(err),true); }
  finally { state.busy = false; if ($('edit-form')) editorBusy(false); }
}
async function showDrafts() {
  if (state.busy) return;
  try {
    await persist(); state.draft = null; state.view = 'drafts'; ++state.sequence;
    window.ProjectShell?.setActiveView('drafts');
    const drafts = [...await cache.drafts(owner()),...(state.user ? await cache.drafts('local') : [])];
    $('content').innerHTML = '<h2>이 기기의 로컬 초안</h2><p>내 계정 초안과 로그인 전 이 기기에서 작성한 초안입니다. 직접 열어 서버에 저장하세요.</p>' + (drafts.length ? drafts.map((d,i) => `<article class="prompt-card"><button class="prompt-open" data-draft="${i}" type="button">${escape(d.title || '제목 없는 초안')}</button><span>${escape(new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d.savedAt)))}</span></article>`).join('') : '<p class="empty">저장된 초안이 없습니다.</p>');
    document.querySelectorAll('[data-draft]').forEach(b => { b.onclick = () => { const d = drafts[Number(b.dataset.draft)]; state.draft = d.owner === 'local' && state.user ? { ...d, draft_id:crypto.randomUUID() } : d; state.view = 'edit'; renderEdit(); status('로컬 초안을 열었습니다.'); }; });
  } catch (err) { status(err.message,true); }
}
async function centralDetails() {
  return api.all(true,true);
}
async function migrate(data) {
  if (state.busy) return;
  const epoch = state.epoch;
  try {
    await persist(); state.backup = data; status('가져오기 미리보기를 준비하는 중…');
    const central = state.user ? await centralDetails() : [];
    state.migration = await preview(payloadRows(data),central);
    if (epoch !== state.epoch) return;
    $('backup-confirmed').checked = false; $('migration-dialog').showModal(); renderMigration();
    status('미리보기에서 백업과 선택 항목을 확인해 주세요.');
  } catch (err) { status(err.message,true); }
}
async function consent() {
  const authorization_id = new URL(location.href).searchParams.get('authorization_id');
  $('oauth-consent').replaceChildren();
  if (!authorization_id || !state.user) return;
  try {
    const details = await api.request('/api/prompt-oauth/details','POST',{ authorization_id });
    if (details.redirect_url) { location.assign(details.redirect_url); return; }
    $('oauth-consent').innerHTML = `<section class="consent-panel"><h2>${escape(details.name)} 연결 승인</h2><p>이 앱에서 내 프롬프트를 조회·등록·수정·삭제할 수 있습니다.</p><p>계정 정보 범위: ${escape(details.scope)}<br>콜백: ${escape(details.redirect_uri)}</p><button id="oauth-approve" class="btn" type="button">연결 허용</button> <button id="oauth-deny" class="btn" type="button">거절</button></section>`;
    for (const decision of ['approve','deny']) $('oauth-'+decision).onclick = async () => {
      try { const result = await api.request('/api/prompt-oauth/consent','POST',{ authorization_id,decision }); location.assign(result.redirect_url); }
      catch (err) { status(errorText(err),true); }
    };
  } catch { status('외부 앱 인증 설정을 확인해 주세요. 프롬프트 데이터는 변경하지 않았습니다.',true); }
}
const labels = { ready:'신규',duplicate:'동일 항목 · 건너뜀',conflict:'같은 제목 · 확인 필요',invalid:'잘못된 데이터',uploading:'업로드 중',done:'서버 검증 완료',failed:'실패 · 재시도 가능',deleted:'삭제 이력 · 복구 안 함' };
function renderMigration() {
  $('migration-items').innerHTML = state.migration.map((m,i) => `<label class="migration-row"><input type="checkbox" data-select="${i}" ${m.selected ? 'checked' : ''} ${state.busy || ['duplicate','invalid','uploading','done','deleted'].includes(m.status) ? 'disabled' : ''} /><span><strong>${escape(m.data?.title || m.raw?.title || '제목 없음')}</strong><br>${labels[m.status]}${m.error ? '<br>'+escape(m.error) : ''}</span></label>`).join('');
  updateMigrationActions();
  $('migration-close').disabled = false;
  $('migration-close').textContent = state.busy ? '현재 항목 후 닫기' : '닫기';
  $('migration-stop').disabled = !state.busy || state.cancelMigration;
  $('migration-status').textContent = `${state.migration.filter(m => m.status === 'done').length} / ${state.migration.length}개 검증 완료${state.user ? '' : ' · 업로드하려면 먼저 로그인하세요.'}`;
  document.querySelectorAll('[data-select]').forEach(el => { el.onchange = () => { state.migration[Number(el.dataset.select)].selected = el.checked; updateMigrationActions(); }; });
}
function updateMigrationActions() {
  $('migration-upload').disabled = state.busy || !state.user || !$('backup-confirmed').checked || !state.migration.some(m => m.selected && ['ready','conflict','failed'].includes(m.status));
}
function bind() {
  window.ProjectShell?.init({ storageKey:'prompt-collection-sidebar-collapsed',shellId:'app-shell',railToggleId:'sidebar-toggle',toolbarToggleId:'sidebar-toggle-toolbar' });
  const branding = () => window.ProjectShell?.initBranding({ storageKey:'prompt-collection-branding',defaults:{ title:'프롬프트 모음',tagline:'프롬프트를 저장하고 모든 기기에서 찾기' },titleSuffix:'' });
  if (document.readyState === 'complete') branding();
  else document.addEventListener('DOMContentLoaded',branding,{ once:true });
  document.querySelectorAll('[data-view]').forEach(b => { b.onclick = async () => {
    if (state.busy) return;
    if (b.dataset.view === 'edit') return edit(null);
    try { await persist(); state.draft = null; state.view = b.dataset.view; window.ProjectShell?.setActiveView(state.view); await load(); } catch (err) { status(err.message,true); }
  }; });
  let timer;
  for (const id of ['search','filter-category','filter-tags']) $(id).oninput = () => {
    clearTimeout(timer); timer = setTimeout(() => { if (state.view === 'list' || state.view === 'pinned') load(); },300);
  };
  $('btn-new').onclick = () => edit(null);
  $('btn-refresh').onclick = () => { clearTimeout(timer); if (!state.busy) load(); };
  $('btn-drafts').onclick = showDrafts;
  $('btn-export').onclick = async () => { try { await persist(); const raw = await window.PromptCollectionDb.readLegacy(); raw.drafts = await cache.drafts(owner()); download(raw,'prompt-local-original'); status('원본 백업 파일을 내보냈습니다.'); } catch (err) { status(err.message,true); } };
  $('btn-central-export').onclick = async () => { try { download({ version:2,exportedAt:new Date().toISOString(),prompts:await centralDetails() },'prompt-central'); } catch (err) { status(errorText(err),true); } };
  $('btn-legacy').onclick = async () => { try { await migrate(await window.PromptCollectionDb.readLegacy()); } catch (err) { status(err.message,true); } };
  $('btn-import').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try { if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 백업 파일을 선택해 주세요.'); await migrate(JSON.parse(await file.text())); } catch (err) { status(err.message,true); }
  };
  $('migration-backup').onclick = () => download(state.backup,'prompt-import-original');
  $('backup-confirmed').onchange = updateMigrationActions;
  $('migration-close').onclick = () => { if (state.busy) { state.cancelMigration = true; state.closeAfterMigration = true; } else $('migration-dialog').close(); };
  $('migration-stop').onclick = () => { state.cancelMigration = true; $('migration-stop').disabled = true; $('migration-status').textContent = '현재 항목을 마친 뒤 중지합니다. 원본과 처리 결과는 유지됩니다.'; };
  $('migration-dialog').oncancel = event => { if (state.busy) { event.preventDefault(); state.cancelMigration = true; state.closeAfterMigration = true; } };
  $('migration-upload').onclick = async () => {
    if (state.busy || !state.user || !$('backup-confirmed').checked) return;
    state.busy = true; state.cancelMigration = false; state.closeAfterMigration = false; renderMigration();
    try { await upload(state.migration,api,renderMigration,() => state.cancelMigration); }
    finally { state.busy = false; renderMigration(); if (state.closeAfterMigration) $('migration-dialog').close(); await load(); }
  };
  window.addEventListener('focus',() => { if (!state.busy && !state.draft && !$('migration-dialog').open) load(); });
  window.addEventListener('online',() => { if (!state.busy && !state.draft) load(); });
  window.addEventListener('pagehide',() => { persist().catch(() => {}); });
}
bind();
try {
  state.enabled = (await api.configured()).enabled;
  if (state.enabled && api.hasSession()) state.user = await api.user();
} catch (err) { if (!err.status || err.status >= 500) state.user = api.cachedUser(); status(errorText(err),true); }
account(); await load(); await consent();
