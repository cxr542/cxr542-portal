import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import './GithubReposPage.css';

import { REPO_CATEGORIES } from './githubReposData';
import { filterRepoViews, ORIGIN_FILTERS, SORTS, sortRepoViews, toRepoView } from './repoModel';
import { createFixtureMetaStore, RepoSourceError, selectRepoSource } from './repoSource';
import { RepoStaleBanner, RepoStatePanel } from './RepoStatePanel.jsx';
import { formatClock } from './repoUi.js';
import RepoDetail from './RepoDetail.jsx';

const CATEGORY_NAMES = REPO_CATEGORIES.map(group => group.name);
let sharedMetaStore;
const fixtureMetaStore = () => (sharedMetaStore ||= createFixtureMetaStore());
const noSubscribe = () => () => {};

export default function GithubReposPage({ source: sourceProp, metaStore: metaProp }) {
  const [source] = useState(() => sourceProp || selectRepoSource(globalThis, typeof location === 'undefined' ? '' : location.search));
  const metaStore = metaProp || fixtureMetaStore();
  const meta = useSyncExternalStore(metaStore.subscribe || noSubscribe, metaStore.all, metaStore.all);
  const [load,setLoad]=useState({ status:'loading', repos:[], syncedAt:null, error:null, verified:null, notice:null });
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('전체');
  const [origin,setOrigin]=useState('all');
  const [sort,setSort]=useState('name');
  const [showHidden,setShowHidden]=useState(false);
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState('개요');
  const request=useRef(0);
  const verified=(load.verified ?? source.verified)===true;

  const fetchRepos=useCallback(async()=>{
    const id=++request.current;
    try {
      const result=await source.list();
      if (id===request.current) setLoad({ status:'ready', repos:result.repos, syncedAt:result.syncedAt, error:null, verified:result.verified ?? null, notice:result.notice || null });
    } catch (error) {
      if (id===request.current) setLoad(prev=>({ ...prev, status:'error', error: error instanceof RepoSourceError ? error : new RepoSourceError('unknown') }));
    }
  },[source]);
  const refresh=()=>{ setLoad(prev=>({ ...prev, status:'loading', error:null })); fetchRepos(); };
  useEffect(()=>{ const pending=request; fetchRepos(); return ()=>{ pending.current++; }; },[fetchRepos]);

  const allViews=useMemo(()=>load.repos.map(repo=>toRepoView(repo, meta[repo.key])),[load.repos,meta]);
  const views=useMemo(()=>allViews.filter(repo=>!repo.hidden),[allViews]);
  const hiddenCount=allViews.length-views.length;
  const filtered=useMemo(()=>sortRepoViews(filterRepoViews(allViews,{query,category,origin,includeHidden:showHidden}),sort),[allViews,query,category,origin,showHidden,sort]);
  const sorts=SORTS.filter(s=>s.id!=='pushed'||allViews.some(repo=>repo.pushedAt));
  const current=filtered.find(repo=>repo.key===selected)||filtered[0]||null;
  const own=views.filter(r=>!r.fork).length;
  const external=views.length-own;
  const mark=verified?'':'*';
  const busy=load.status==='loading';
  const hasData=load.repos.length>0;
  const saveMeta=patch=>current ? metaStore.set(current.key, patch) : Promise.resolve();
  const resetFilters=()=>{setCategory('전체');setOrigin('all');setQuery('');};

  let badge;
  if (busy) badge='● 불러오는 중…';
  else if (load.status==='error') badge='● 동기화 실패';
  else if (verified) badge=`● 마지막 동기화 ${formatClock(load.syncedAt)}`;
  else badge=`● DEMO · 샘플 데이터 ${views.length}건`;

  let rows;
  if (load.status==='error' && !hasData) rows=<RepoStatePanel kind="error" code={load.error.code} resetAt={load.error.resetAt} onRetry={refresh}/>;
  else if (busy && !hasData) rows=<RepoStatePanel kind="loading"/>;
  else if (!allViews.length) rows=<RepoStatePanel kind="empty" onRetry={refresh}/>;
  else if (!filtered.length) rows=<div className="repo-glass__empty">{views.length?'조건에 맞는 레포지토리가 없습니다.':'모든 레포지토리가 숨김 상태입니다.'} <button type="button" className="repo-glass__inline-action" onClick={()=>{resetFilters();if(!views.length)setShowHidden(true);}}>{views.length?'필터 초기화':'숨긴 저장소 보기'}</button></div>;
  else rows=filtered.map(repo=><button type="button" key={repo.key} className={`repo-glass__repo-row ${current?.key===repo.key?'is-selected':''} ${repo.hidden?'is-hidden':''}`} aria-pressed={current?.key===repo.key} onClick={()=>{setSelected(repo.key);setTab('개요')}}>
    <span className="repo-glass__repo-name"><span aria-hidden="true" className={repo.favorite?'repo-glass__star':''}>{repo.favorite?'★':'◉'}</span><span><strong>{repo.name}{repo.favorite&&<span className="repo-glass__sr-only"> (즐겨찾기)</span>}{repo.hidden&&<span className="repo-glass__hidden-label"> · 숨김</span>}</strong><small>{repo.description}</small></span></span>
    <span className="repo-glass__tag">{repo.category}</span><span className="repo-glass__status">{repo.status||'—'}</span></button>);

  return <section className="repo-glass" aria-label={verified?'GitHub 레포지토리 관리':'GitHub 레포지토리 관리 시안'}>
    <div className="repo-glass__head">
      <div><span className="repo-glass__eyebrow">◆ REPOSITORY UNIVERSE{verified?'':' / DEMO'}</span><h1>GitHub Repository Manager</h1><p>카테고리별로 프로젝트를 탐색하는 나만의 3D 워크스페이스</p></div>
      <div className="repo-glass__sync">
        <span className={`repo-glass__demo ${load.status==='error'?'is-error':''}`} role="status">{badge}</span>
        <button type="button" className="repo-glass__refresh" onClick={refresh} disabled={busy} aria-label="저장소 목록 새로고침">↻ 새로고침</button>
      </div>
    </div>
    <div className="repo-glass__stats">
      <div className="repo-glass__stat violet"><span>{verified?'레포지토리':'샘플 레포지토리'}</span><strong>{hasData?views.length:'—'}</strong><small>{verified?'GitHub 동기화 기준':'GitHub 실시간 조회 아님'}</small></div>
      <div className="repo-glass__stat blue"><span>{verified?'직접 제작':'직접 제작 추정'}</span><strong>{hasData?own:'—'}</strong><small>{verified?'GitHub fork=false':'공식 생성 이력 미검증'}</small></div>
      <div className="repo-glass__stat cyan"><span>{verified?'Fork':'외부 원본 추정'}</span><strong>{hasData?external:'—'}</strong><small>{verified?'GitHub fork=true':'공식 fork 여부 미확인'}</small></div>
    </div>
    <div className="repo-glass__section-head"><h2>카테고리로 탐색하기</h2><button type="button" onClick={resetFilters}>전체 보기 ↗</button></div>
    <div className="repo-glass__categories">
      {REPO_CATEGORIES.map(group=><button type="button" key={group.name} className={`repo-glass__category ${group.tone} ${category===group.name?'is-active':''}`} aria-pressed={category===group.name} onClick={()=>{setCategory(category===group.name?'전체':group.name);setTab('개요');}}>
        <span className="repo-glass__category-icon" aria-hidden="true">{group.icon}</span><strong>{group.name}</strong><span className="repo-glass__category-count">{views.filter(r=>r.category===group.name).length}개</span><small>{group.caption}</small></button>)}
    </div>
    <div className="repo-glass__workspace">
      <section className="repo-glass__list" aria-label="저장소 목록" aria-busy={busy}>
        <div className="repo-glass__toolbar">
          <div className="repo-glass__filters" role="group" aria-label="원본 유형 필터">{ORIGIN_FILTERS.map(o=><button key={o.id} type="button" aria-pressed={origin===o.id} onClick={()=>setOrigin(o.id)}>{o.label}{o.id==='all'?'':mark}</button>)}</div>
          <label className="repo-glass__search"><span className="repo-glass__sr-only">레포지토리 검색</span><input type="search" placeholder="이름, 설명, 기술, 태그 검색…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label className="repo-glass__sort"><span className="repo-glass__sr-only">정렬</span><select value={sort} onChange={e=>setSort(e.target.value)}>{sorts.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          {hiddenCount>0&&<button type="button" className="repo-glass__hidden-toggle" aria-pressed={showHidden} onClick={()=>setShowHidden(v=>!v)}>{showHidden?'숨긴 저장소 감추기':`숨긴 저장소 ${hiddenCount}개 보기`}</button>}
        </div>
        {load.notice==='not_configured'&&<p className="repo-notice" role="note">GitHub 연동 설정 전이라 샘플 데이터를 표시합니다. 연동이 완료되면 실제 저장소로 바뀝니다.</p>}
        {load.status==='error'&&hasData&&<RepoStaleBanner code={load.error.code} resetAt={load.error.resetAt} onRetry={refresh}/>}
        {current && <button type="button" className="repo-glass__detail-jump" aria-controls="repo-detail-panel" onClick={() => document.getElementById('repo-detail-panel').focus()}>선택한 저장소 상세로 이동 ↓</button>}
        <div className="repo-glass__table-head"><span>레포지토리</span><span>카테고리</span><span>상태{mark}</span></div>
        <div className="repo-glass__rows">{rows}</div>
        {!verified && <p className="repo-glass__footnote">*분류·상태는 시연용 추정값입니다. 실제 GitHub 동기화와 영구 저장은 아직 연결되지 않았습니다.</p>}
      </section>
      <p className="repo-glass__sr-only" role="status" aria-live="polite" aria-atomic="true">{current ? `${current.name} 저장소 상세가 갱신되었습니다.` : '선택 가능한 저장소가 없습니다.'}</p>
      <aside className="repo-glass__detail" aria-label="선택한 저장소 상세">
        {current
          ? <RepoDetail repo={current} source={source} verified={verified} persistent={metaStore.persistent===true} categories={CATEGORY_NAMES} tab={tab} onTabChange={setTab} onSaveMeta={saveMeta}/>
          : <div className="repo-glass__empty">{busy?'저장소를 불러오는 중입니다…':load.status==='error'?'목록을 불러오면 상세 정보가 여기에 표시됩니다.':'선택 가능한 레포지토리가 없습니다.'}</div>}
      </aside>
    </div>
  </section>;
}
