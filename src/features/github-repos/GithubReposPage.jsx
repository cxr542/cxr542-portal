import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import './GithubReposPage.css';

import { REPO_CATEGORIES } from './githubReposData';
import { filterRepoViews, ORIGIN_FILTERS, SORTS, sortRepoViews, toRepoView } from './repoModel';
import { RepoSourceError, selectRepoSource } from './repoSource';
import { findOrphans, selectMetaStore } from './metaStore.js';
import { RepoStaleBanner, RepoStatePanel } from './RepoStatePanel.jsx';
import { formatCount, formatDateTime } from './repoUi.js';
import { RepoResults } from './RepoResults.jsx';
import RepoDetail from './RepoDetail.jsx';
import { ToolIcon } from '../../components/Workspace.jsx';

const CATEGORY_NAMES = REPO_CATEGORIES.map(group => group.name);
const VIEW_KEY = 'cxr542-portal-github-repos-view';
const DEFAULT_FILTERS = { query: '', category: '전체', origin: 'all', visibility: 'all', language: '' };
let sharedMetaStore;
const defaultMetaStore = () => (sharedMetaStore ||= selectMetaStore(globalThis));
const noSubscribe = () => () => {};

export default function GithubReposPage({ source: sourceProp, metaStore: metaProp }) {
  const [source] = useState(() => sourceProp || selectRepoSource(globalThis, typeof location === 'undefined' ? '' : location.search));
  const metaStore = metaProp || defaultMetaStore();
  const meta = useSyncExternalStore(metaStore.subscribe || noSubscribe, metaStore.all, metaStore.all);
  const [load, setLoad] = useState({ status: 'loading', repos: [], syncedAt: null, error: null, verified: null, notice: null, hasLoaded: false });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState('name');
  const [showHidden, setShowHidden] = useState(false);
  const [view, setView] = useState(() => globalThis.PortalStorage?.getItem(VIEW_KEY) === 'list' ? 'list' : 'card');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('개요');
  const request = useRef(0);
  const detail = useRef(null);
  const trigger = useRef(null);
  const resultsTitle = useRef(null);
  const verified = (load.verified ?? source.verified) === true;

  const fetchRepos = useCallback(async () => {
    const id = ++request.current;
    try {
      const result = await source.list();
      if (id === request.current) setLoad({ status: 'ready', repos: result.repos, syncedAt: result.syncedAt, error: null, verified: result.verified ?? null, notice: result.notice || null, hasLoaded: true });
    } catch (error) {
      if (id === request.current) setLoad(prev => ({ ...prev, status: 'error', error: error instanceof RepoSourceError ? error : new RepoSourceError('unknown') }));
    }
  }, [source]);
  const refresh = () => {
    setLoad(prev => ({ ...prev, status: 'loading', error: null }));
    fetchRepos();
  };
  useEffect(() => {
    const pending = request;
    fetchRepos();
    return () => { pending.current++; };
  }, [fetchRepos]);

  const allViews = useMemo(() => load.repos.map(repo => toRepoView(repo, meta[repo.key])), [load.repos, meta]);
  const hiddenCount = allViews.filter(repo => repo.hidden).length;
  const filtered = useMemo(() => sortRepoViews(
    filterRepoViews(allViews, { ...filters, includeHidden: showHidden })
      .filter(repo => !filters.language || repo.language === filters.language), sort,
  ), [allViews, filters, showHidden, sort]);
  const languages = [...new Set(allViews.map(repo => repo.language).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sorts = SORTS.filter(option => option.id !== 'pushed' || sort === 'pushed' || allViews.some(repo => repo.pushedAt));
  const current = allViews.find(repo => repo.key === selected);
  const busy = load.status === 'loading';
  const internalCount = allViews.filter(repo => repo.visibility === 'internal').length;
  useEffect(() => {
    if (selected && !current) detail.current?.close();
  }, [selected, current]);
  const stats = [
    ['전체 저장소', allViews.length],
    ['Public', allViews.filter(repo => repo.visibility === 'public').length],
    ['Private', allViews.filter(repo => repo.visibility === 'private').length],
    ['전체 Star', allViews.reduce((sum, repo) => sum + repo.stars, 0)],
  ];
  const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  const changeView = nextView => {
    setView(nextView);
    globalThis.PortalStorage?.setItem(VIEW_KEY, nextView);
  };
  const openDetail = (key, button) => {
    trigger.current = button;
    button.focus({ preventScroll: true });
    setSelected(key);
    setTab('개요');
    detail.current.showModal();
  };
  const closeDetail = () => {
    setSelected(null);
    if (!trigger.current?.isConnected) resultsTitle.current?.focus();
    trigger.current = null;
  };
  const saveMeta = patch => current ? metaStore.set(current.key, { ...patch, name: current.name, url: current.url }) : Promise.resolve();
  // Notes for repositories that are gone from GitHub (deleted or access lost) are kept, never auto-deleted.
  const orphans = useMemo(() => {
    if (!verified || load.status !== 'ready' || typeof metaStore.storedKeys !== 'function') return [];
    return findOrphans(metaStore.storedKeys(), load.repos, meta);
  }, [verified, load.status, load.repos, metaStore, meta]);
  const removeOrphan = async orphan => {
    if (typeof metaStore.remove !== 'function') return;
    if (typeof window !== 'undefined' && !window.confirm(`'${orphan.name || orphan.key}'의 메모·태그를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try { await metaStore.remove(orphan.key); } catch { /* the portal retry toolbar keeps the failed write */ }
  };

  const syncTime = verified && formatDateTime(load.syncedAt);
  const syncMessage = busy ? (load.hasLoaded ? '동기화 중…' : '저장소를 불러오는 중…')
    : load.status === 'error' ? (load.hasLoaded ? '동기화 실패' : '저장소 조회 실패')
      : !verified ? '샘플 데이터' : '';
  const allHidden = hiddenCount === allViews.length;
  let results;
  if (!load.hasLoaded && load.status === 'error') {
    results = <RepoStatePanel kind="error" code={load.error.code} resetAt={load.error.resetAt} onRetry={refresh} />;
  } else if (!load.hasLoaded && busy) {
    results = <RepoStatePanel kind="loading" />;
  } else if (!allViews.length) {
    if (load.status === 'ready') results = <RepoStatePanel kind="empty" onRetry={refresh} />;
  } else if (!filtered.length) {
    const revealHidden = allHidden && !showHidden;
    results = <div className="repo-state">
      <h3>{revealHidden ? '모든 저장소가 숨김 상태입니다.' : '조건에 맞는 저장소가 없습니다.'}</h3>
      <button type="button" className="secondary" onClick={() => {
        setFilters(DEFAULT_FILTERS);
        if (revealHidden) setShowHidden(true);
      }}>{revealHidden ? '숨긴 저장소 보기' : '필터 초기화'}</button>
    </div>;
  } else {
    results = <RepoResults repos={filtered} view={view} onManage={openDetail} />;
  }

  return <section className="repo-workspace" aria-labelledby="repo-workspace-title">
    <header className="repo-heading">
      <span className="tool-icon"><ToolIcon id="github-repos" /></span>
      <div>
        <h1 id="repo-workspace-title">GitHub 저장소</h1>
        <p>저장소를 찾고 README, 분류, 개인 메모를 관리하세요.</p>
      </div>
    </header>

    <dl className="repo-stats" aria-label="저장소 요약" aria-describedby={hiddenCount || internalCount ? 'repo-summary-note' : undefined}>
      {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatCount(load.hasLoaded ? value : null)}</dd></div>)}
    </dl>
    {(hiddenCount > 0 || internalCount > 0) && <p id="repo-summary-note" className="repo-summary-note">
      {hiddenCount > 0 && <span>숨긴 저장소 {formatCount(hiddenCount)}개 포함</span>}
      {internalCount > 0 && <span>Internal {formatCount(internalCount)}개 포함</span>}
    </p>}

    <section aria-labelledby="repo-results-title">
      <div className="repo-section-heading">
        <h2 id="repo-results-title" tabIndex={-1} ref={resultsTitle}>저장소 목록</h2>
        <p className="repo-sync" role="status">
          {syncMessage && <span>{syncMessage}</span>}
          {syncTime && <span>마지막 동기화 <time dateTime={load.syncedAt}>{syncTime}</time></span>}
        </p>
      </div>

      <div className="repo-toolbar">
        <div className="repo-toolbar__main">
          <label className="repo-search"><span className="sr-only">저장소 검색</span>
            <input type="search" placeholder="이름, 설명, 기술, 태그 검색" value={filters.query} onChange={event => setFilter('query', event.target.value)} />
          </label>
          <div className="repo-view-toggle" role="group" aria-label="저장소 보기 방식">
            <button type="button" aria-pressed={view === 'card'} onClick={() => changeView('card')}>카드</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>리스트</button>
          </div>
          <button type="button" className="primary" onClick={refresh} disabled={busy} aria-label="저장소 목록 새로고침">새로고침</button>
        </div>
        <div className="repo-toolbar__filters">
          <label>공개 범위<select value={filters.visibility} onChange={event => setFilter('visibility', event.target.value)}>
            <option value="all">전체</option><option value="public">Public</option><option value="private">Private</option>
            {(internalCount > 0 || filters.visibility === 'internal') && <option value="internal">Internal</option>}
          </select></label>
          <label>언어<select value={filters.language} onChange={event => setFilter('language', event.target.value)}>
            <option value="">전체</option>
            {filters.language && !languages.includes(filters.language) && <option>{filters.language}</option>}
            {languages.map(language => <option key={language}>{language}</option>)}
          </select></label>
          <label>카테고리<select value={filters.category} onChange={event => setFilter('category', event.target.value)}>
            {['전체', ...CATEGORY_NAMES, '미분류'].map(category => <option key={category}>{category}</option>)}
          </select></label>
          <label>원본 유형<select value={filters.origin} onChange={event => setFilter('origin', event.target.value)}>
            {ORIGIN_FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select></label>
          <label>정렬<select value={sort} onChange={event => setSort(event.target.value)}>
            {sorts.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select></label>
        </div>
        {hiddenCount > 0 && <label className="repo-hidden-toggle"><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.target.checked)} />숨긴 저장소 {hiddenCount}개 포함</label>}
      </div>

      {load.notice === 'not_configured' && <p className="repo-notice" role="note">GitHub 연동 설정 전입니다. 샘플 데이터를 표시합니다.</p>}
      {load.status === 'error' && load.hasLoaded && <RepoStaleBanner code={load.error.code} resetAt={load.error.resetAt} onRetry={refresh} />}
      <div className="repo-result-info">
        {load.hasLoaded && (load.status !== 'error' || allViews.length > 0) && <span>저장소 {formatCount(filtered.length)}개</span>}
        {filtered.length > 0 && <span>Fork 수 미제공</span>}
      </div>
      <div className="repo-results-body" aria-busy={busy}>{results}</div>

      {orphans.length > 0 && <details className="repo-orphans">
        <summary>GitHub에서 찾을 수 없는 저장소 메모 {orphans.length}개</summary>
        <p>삭제되었거나 접근 권한이 없어진 저장소입니다. 메모는 자동으로 지우지 않습니다.</p>
        <ul>{orphans.map(orphan => <li key={orphan.key}>
          <div><strong>{orphan.name || orphan.key}</strong>{orphan.note && <p>{orphan.note}</p>}{orphan.tags.length > 0 && <small>{orphan.tags.map(tag => `#${tag}`).join(' ')}</small>}</div>
          <button className="secondary" type="button" onClick={() => removeOrphan(orphan)} aria-label={`${orphan.name || orphan.key} 메모 삭제`}>메모 삭제</button>
        </li>)}</ul>
      </details>}
      {!verified && load.hasLoaded && <p className="repo-footnote">샘플의 원본 유형과 관리 상태는 추정값입니다. 샘플에서 편집한 내용은 세션에만 남습니다.</p>}
    </section>

    <dialog ref={detail} className="repo-dialog" aria-label={current ? `${current.name} 저장소 관리` : '저장소 관리'} onClose={closeDetail}>
      <div className="repo-dialog__bar">
        <button type="button" className="secondary" onClick={() => detail.current.close()}>닫기</button>
      </div>
      {current && <RepoDetail repo={current} source={source} verified={verified} persistent={metaStore.persistent === true} categories={CATEGORY_NAMES} tab={tab} onTabChange={setTab} onSaveMeta={saveMeta} />}
    </dialog>
  </section>;
}
