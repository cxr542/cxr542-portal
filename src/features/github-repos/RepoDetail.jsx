import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import RepoMetaEditor from './RepoMetaEditor.jsx';
import { DETAIL_TABS, errorView, formatDate, visibilityLabel } from './repoUi.js';
import { RepoSourceError } from './repoErrors.js';

/** Loads one per-repository resource lazily; stale responses for other repos are ignored. */
function useRepoResource(source, kind, repo, enabled) {
  const [state, setState] = useState({ key: null });
  const [attempt, setAttempt] = useState(0);
  const repoRef = useRef(repo);
  useEffect(() => { repoRef.current = repo; });
  const key = `${kind}:${repo.key}:${attempt}`;
  useEffect(() => {
    if (!enabled || typeof source[kind] !== 'function') return undefined;
    let alive = true;
    Promise.resolve()
      .then(() => source[kind](repoRef.current))
      .then(data => { if (alive) setState({ key, status: 'ready', data }); },
        error => { if (alive) setState({ key, status: 'error', error: error instanceof RepoSourceError ? error : new RepoSourceError('unknown') }); });
    return () => { alive = false; };
  }, [source, kind, key, enabled]);
  const supported = typeof source[kind] === 'function';
  const current = !supported ? { status: 'unsupported' } : state.key === key ? state : { status: 'loading' };
  return { ...current, retry: () => setAttempt(value => value + 1) };
}

function ResourceError({ error, onRetry, label }) {
  const view = errorView(error?.code);
  return <div className="repo-detail-state" role="alert">
    <p><span aria-hidden="true">{view.icon} </span>{label}을(를) 불러오지 못했습니다. {view.title}.</p>
    <button type="button" onClick={onRetry}>다시 시도</button>
  </div>;
}

function Branches({ source, repo }) {
  const branches = useRepoResource(source, 'branches', repo, true);
  if (branches.status === 'unsupported') return null;
  return <section className="repo-detail-section" aria-label="브랜치">
    <h4>브랜치{branches.data?.sample && <span className="repo-sample-badge">샘플</span>}</h4>
    {branches.status === 'loading' && <p className="repo-meta__muted" aria-busy="true">브랜치를 불러오는 중…</p>}
    {branches.status === 'error' && <ResourceError error={branches.error} onRetry={branches.retry} label="브랜치" />}
    {branches.status === 'ready' && (branches.data?.items?.length
      ? <ul className="repo-branches">{branches.data.items.map(branch => <li key={branch.name}><code>{branch.name}</code>{branch.name === repo.defaultBranch && <span className="repo-branches__badge">기본</span>}{branch.protected && <span className="repo-branches__badge">보호됨</span>}</li>)}</ul>
      : <p className="repo-meta__muted">브랜치 정보가 없습니다.</p>)}
  </section>;
}

function Readme({ source, repo }) {
  const readme = useRepoResource(source, 'readme', repo, true);
  if (readme.status === 'loading') {
    return <div aria-busy="true"><span className="repo-glass__sr-only">README를 불러오는 중…</span>{[0, 1, 2].map(n => <div key={n} className="repo-skeleton repo-skeleton--text" aria-hidden="true"><span className="repo-skeleton__lines"><span /><span /></span></div>)}</div>;
  }
  if (readme.status === 'error') return <ResourceError error={readme.error} onRetry={readme.retry} label="README" />;
  if (readme.status === 'unsupported' || !readme.data) {
    return <div className="repo-detail-state"><p>이 저장소에는 README가 없습니다.</p><a href={repo.url} target="_blank" rel="noopener noreferrer">GitHub에서 저장소 열기 ↗</a></div>;
  }
  return <>
    {readme.data.sample && <p className="repo-meta__notice">샘플 README입니다. GitHub 연동 후 실제 README가 표시됩니다.</p>}
    <Markdown source={readme.data.text} baseUrl={`${repo.url}/blob/HEAD/`} />
  </>;
}

export default function RepoDetail({ repo, source, verified, persistent, categories, tab, onTabChange, onSaveMeta }) {
  const handleTabKeyDown = (event, index) => {
    let nextIndex;
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % DETAIL_TABS.length; break;
      case 'ArrowLeft': nextIndex = (index + DETAIL_TABS.length - 1) % DETAIL_TABS.length; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = DETAIL_TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onTabChange(DETAIL_TABS[nextIndex]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex].focus();
  };
  const pushed = formatDate(repo.pushedAt);

  return <>
    <div className="repo-glass__detail-title">
      <div><h2>{repo.name}</h2><p>{repo.description || '설명이 없습니다.'}</p></div>
      <button type="button" className={`repo-fav ${repo.favorite ? 'is-on' : ''}`} aria-pressed={repo.favorite} aria-label={repo.favorite ? `${repo.name} 즐겨찾기 해제` : `${repo.name} 즐겨찾기`}
        onClick={() => onSaveMeta({ favorite: !repo.favorite })}>{repo.favorite ? '★' : '☆'}</button>
    </div>
    <div className="repo-glass__chips">
      <span>{repo.origin}</span><span>{repo.category}</span>{repo.status && <span>{repo.status}</span>}
      <span>{visibilityLabel(repo.visibility)}</span>{repo.archived && <span>Archived</span>}
      {repo.tags.map(tag => <span key={tag} className="is-tag">#{tag}</span>)}
    </div>
    <div className="repo-glass__tabs" role="tablist" aria-label="레포지토리 상세 탭">{DETAIL_TABS.map((t, index) => <button key={t} type="button" role="tab" tabIndex={tab === t ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, index)} id={`repo-tab-${t}`} aria-selected={tab === t} aria-controls="repo-detail-panel" onClick={() => onTabChange(t)}>{t}</button>)}</div>
    <div id="repo-detail-panel" role="tabpanel" tabIndex={0} aria-labelledby={`repo-tab-${tab}`} className="repo-glass__detail-body">
      {tab === '개요' && <>
        <h3>프로젝트 개요</h3>
        <p>{repo.description || '설명이 없습니다.'}</p>
        <dl>
          <div><dt>기술</dt><dd>{repo.language || '—'}</dd></div>
          <div><dt>공개 범위</dt><dd>{visibilityLabel(repo.visibility)}</dd></div>
          <div><dt>소유 유형</dt><dd>{repo.origin}{verified ? ' (GitHub fork 필드)' : ''}</dd></div>
          <div><dt>최근 활동</dt><dd>{pushed || (verified ? '—' : '동기화 후 표시')}</dd></div>
          <div><dt>기본 브랜치</dt><dd>{repo.defaultBranch || '—'}</dd></div>
          <div><dt>스타</dt><dd>{repo.stars.toLocaleString()}</dd></div>
          <div><dt>관리 상태</dt><dd>{repo.status || '—'}{verified ? '' : ' · 예시'}</dd></div>
          {repo.topics.length > 0 && <div><dt>토픽</dt><dd>{repo.topics.join(', ')}</dd></div>}
          <div><dt>분류 근거</dt><dd>{verified ? 'GitHub fork 메타데이터 · 사용자 분류' : 'README·기존 정리 기반 추정'}</dd></div>
        </dl>
        <Branches source={source} repo={repo} />
      </>}
      {tab === 'README' && <Readme source={source} repo={repo} />}
      {tab === '메모' && <RepoMetaEditor key={repo.key} repo={repo} categories={categories} persistent={persistent} onSave={onSaveMeta} />}
    </div>
    <a className="secondary" href={repo.url} target="_blank" rel="noopener noreferrer">GitHub에서 열기 ↗</a>
  </>;
}
