import { useState } from 'react';
import { MAX_TAGS, normalizeTags } from './repoModel.js';
import { REPO_STATUSES } from './repoUi.js';

const NOTE_LIMIT = 5000;

/** User-owned fields for one repository. Remount with key={repo.key} to reset drafts. */
export default function RepoMetaEditor({ repo, categories, persistent, onSave }) {
  const [note, setNote] = useState(repo.note || '');
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState('');
  const dirty = note !== (repo.note || '');
  const save = async (patch, done) => {
    try {
      await onSave(patch);
      setMessage(done);
    } catch {
      setMessage(persistent ? '클라우드에 저장하지 못했습니다. 상단 저장 상태에서 다시 시도해 주세요.' : '저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };
  const addTags = () => {
    const incoming = tagDraft.split(',').map(tag => tag.trim()).filter(Boolean);
    if (!incoming.length) return;
    const tags = normalizeTags([...repo.tags, ...incoming]);
    setTagDraft('');
    save({ tags }, tags.length >= MAX_TAGS ? `태그는 최대 ${MAX_TAGS}개까지 저장됩니다.` : '태그를 추가했습니다.');
  };

  return <div className="repo-meta">
    {!persistent && <p className="repo-meta__notice">샘플 모드: 변경 내용은 이 화면에만 임시로 반영되고, 새로고침하면 초기화됩니다.</p>}

    <div className="repo-meta__row">
      <label className="repo-meta__field">
        <span>카테고리</span>
        <select value={repo.category === '미분류' ? '' : repo.category} onChange={event => save({ category: event.target.value }, '카테고리를 변경했습니다.')}>
          <option value="">미분류</option>
          {categories.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className="repo-meta__field">
        <span>관리 상태</span>
        <select value={repo.status || ''} onChange={event => save({ status: event.target.value }, '관리 상태를 변경했습니다.')}>
          <option value="">지정 안 함</option>
          {REPO_STATUSES.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
    </div>

    <fieldset className="repo-meta__tags">
      <legend>태그</legend>
      {repo.tags.length ? <ul className="repo-meta__tag-list">
        {repo.tags.map(tag => <li key={tag}><span>#{tag}</span><button type="button" aria-label={`태그 ${tag} 삭제`} onClick={() => save({ tags: repo.tags.filter(item => item !== tag) }, `태그 ${tag}을(를) 삭제했습니다.`)}>×</button></li>)}
      </ul> : <p className="repo-meta__muted">아직 태그가 없습니다.</p>}
      <div className="repo-meta__tag-input">
        <label className="repo-glass__sr-only" htmlFor={`repo-tag-${repo.key}`}>새 태그</label>
        <input id={`repo-tag-${repo.key}`} type="text" value={tagDraft} maxLength={120} placeholder="예: 교육, MCP (쉼표로 여러 개)"
          disabled={repo.tags.length >= MAX_TAGS}
          onChange={event => setTagDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addTags(); } }} />
        <button type="button" onClick={addTags} disabled={!tagDraft.trim() || repo.tags.length >= MAX_TAGS}>추가</button>
      </div>
    </fieldset>

    <div className="repo-meta__note">
      <label htmlFor={`repo-note-${repo.key}`}>개인 메모</label>
      <textarea id={`repo-note-${repo.key}`} value={note} maxLength={NOTE_LIMIT} rows={5} placeholder="목적, 다음 할 일, 운영 메모 등을 적어 두세요."
        aria-describedby={`repo-note-count-${repo.key}`} onChange={event => setNote(event.target.value)} />
      <div className="repo-meta__note-actions">
        <span id={`repo-note-count-${repo.key}`} className="repo-meta__muted">{note.length.toLocaleString()} / {NOTE_LIMIT.toLocaleString()}자</span>
        <button type="button" onClick={() => { setNote(repo.note || ''); setMessage('메모 변경을 취소했습니다.'); }} disabled={!dirty}>되돌리기</button>
        <button type="button" className="is-primary" onClick={() => save({ note }, persistent ? '메모를 저장했습니다.' : '메모를 임시 저장했습니다.')} disabled={!dirty}>메모 저장</button>
      </div>
    </div>

    <div className="repo-meta__row repo-meta__row--end">
      <button type="button" className="repo-meta__hide" onClick={() => save({ hidden: !repo.hidden }, repo.hidden ? '목록에 다시 표시합니다.' : '목록에서 숨겼습니다. "숨긴 저장소 보기"로 다시 찾을 수 있습니다.')}>
        {repo.hidden ? '목록에 다시 표시' : '목록에서 숨기기'}
      </button>
    </div>
    <p className="repo-glass__sr-only" role="status" aria-live="polite">{message}</p>
    {message && <p className="repo-meta__message" aria-hidden="true">{message}</p>}
  </div>;
}
