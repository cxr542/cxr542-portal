import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './GithubReposPage.css';

import { REPO_CATEGORIES } from './githubReposData';
import { filterRepoViews, ORIGIN_FILTERS, SORTS, sortRepoViews, toRepoView } from './repoModel';
import { createFixtureMetaStore, createFixtureRepoSource, RepoSourceError, SOURCE_ERRORS } from './repoSource';

const DETAIL_TABS = ['개요', 'README', '메모'];
const defaultSource = createFixtureRepoSource();
const defaultMetaStore = createFixtureMetaStore();

function formatSyncedAt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function GithubReposPage({ source = defaultSource, metaStore = defaultMetaStore }) {
  const [load,setLoad]=useState({ status:'loading', repos:[], syncedAt:null, error:null });
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('전체');
  const [origin,setOrigin]=useState('all');
  const [sort,setSort]=useState('name');
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState('개요');
  const request=useRef(0);
  const verified=source.verified===true;

  const fetchRepos=useCallback(async()=>{
    const id=++request.current;
    try {
      const { repos, syncedAt }=await source.list();
      if (id===request.current) setLoad({ status:'ready', repos, syncedAt, error:null });
    } catch (error) {
      if (id===request.current) setLoad(prev=>({ ...prev, status:'error', error: error instanceof RepoSourceError ? error : new RepoSourceError('unknown') }));
    }
  },[source]);
  const refresh=()=>{ setLoad(prev=>({ ...prev, status:'loading', error:null })); fetchRepos(); };
  useEffect(()=>{ const pending=request; fetchRepos(); return ()=>{ pending.current++; }; },[fetchRepos]);

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
    setTab(DETAIL_TABS[nextIndex]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex].focus();
  };

  const views=useMemo(()=>load.repos.map(repo=>toRepoView(repo, metaStore.get(repo.key))).filter(repo=>!repo.hidden),[load.repos,metaStore]);
  const filtered=useMemo(()=>sortRepoViews(filterRepoViews(views,{query,category,origin}),sort),[views,query,category,origin,sort]);
  const sorts=SORTS.filter(s=>s.id!=='pushed'||views.some(repo=>repo.pushedAt));
  const current=filtered.find(repo=>repo.key===selected)||filtered[0]||null;
  const own=views.filter(r=>!r.fork).length;
  const external=views.length-own;
  const mark=verified?'':'*';
  const busy=load.status==='loading';
  const errorMessage=load.error ? SOURCE_ERRORS[load.error.code] : '';

  return <section className="repo-glass" aria-label={verified?'GitHub 레포지토리 관리':'GitHub 레포지토리 관리 시안'}>
    <div className="repo-glass__head">
      <div><span className="repo-glass__eyebrow">◆ REPOSITORY UNIVERSE{verified?'':' / PHASE 1'}</span><h1>GitHub Repository Manager</h1><p>카테고리별로 프로젝트를 탐색하는 나만의 3D 워크스페이스</p></div>
      <div className="repo-glass__sync">
        <span className="repo-glass__demo" role="status">{busy?'● 불러오는 중…':verified?`● 마지막 동기화 ${formatSyncedAt(load.syncedAt)}`:`● DEMO · 샘플 데이터 ${views.length}건`}</span>
        <button type="button" className="repo-glass__refresh" onClick={refresh} disabled={busy} aria-label="저장소 목록 새로고침">↻ 새로고침</button>
      </div>
    </div>
    <div className="repo-glass__stats">
      <div className="repo-glass__stat violet"><span>{verified?'레포지토리':'샘플 레포지토리'}</span><strong>{views.length}</strong><small>{verified?'GitHub 동기화 기준':'GitHub 실시간 조회 아님'}</small></div>
      <div className="repo-glass__stat blue"><span>{verified?'직접 제작':'직접 제작 추정'}</span><strong>{own}</strong><small>{verified?'GitHub fork=false':'공식 생성 이력 미검증'}</small></div>
      <div className="repo-glass__stat cyan"><span>{verified?'Fork':'외부 원본 추정'}</span><strong>{external}</strong><small>{verified?'GitHub fork=true':'공식 fork 여부 미확인'}</small></div>
    </div>
    <div className="repo-glass__section-head"><h2>카테고리로 탐색하기</h2><button type="button" onClick={()=>{setCategory('전체');setOrigin('all');setQuery('');}}>전체 보기 ↗</button></div>
    <div className="repo-glass__categories">
      {REPO_CATEGORIES.map(group=><button type="button" key={group.name} className={`repo-glass__category ${group.tone} ${category===group.name?'is-active':''}`} aria-pressed={category===group.name} onClick={()=>{setCategory(category===group.name?'전체':group.name);setTab('개요');}}>
        <span className="repo-glass__category-icon" aria-hidden="true">{group.icon}</span><strong>{group.name}</strong><span className="repo-glass__category-count">{views.filter(r=>r.category===group.name).length}개</span><small>{group.caption}</small></button>)}
    </div>
    <div className="repo-glass__workspace">
      <section className="repo-glass__list" aria-label="저장소 목록" aria-busy={busy}>
        <div className="repo-glass__toolbar">
          <div className="repo-glass__filters" role="group" aria-label="원본 유형 필터">{ORIGIN_FILTERS.map(o=><button key={o.id} type="button" aria-pressed={origin===o.id} onClick={()=>setOrigin(o.id)}>{o.label}{o.id==='all'?'':mark}</button>)}</div>
          <label className="repo-glass__search"><span className="repo-glass__sr-only">레포지토리 검색</span><input type="search" placeholder="이름, 설명, 기술 검색…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label className="repo-glass__sort"><span className="repo-glass__sr-only">정렬</span><select value={sort} onChange={e=>setSort(e.target.value)}>{sorts.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        </div>
        {current && <button type="button" className="repo-glass__detail-jump" aria-controls="repo-detail-panel" onClick={() => document.getElementById('repo-detail-panel').focus()}>선택한 저장소 상세로 이동 ↓</button>}
        <div className="repo-glass__table-head"><span>레포지토리</span><span>카테고리</span><span>상태{mark}</span></div>
        <div className="repo-glass__rows">
          {load.status==='error'
            ? <div className="repo-glass__empty repo-glass__error" role="alert"><p>{errorMessage}{load.error.resetAt?` (재시도 가능: ${formatSyncedAt(load.error.resetAt)})`:''}</p><button type="button" onClick={refresh}>다시 시도</button></div>
            : busy && !views.length
              ? <div className="repo-glass__empty">저장소 목록을 불러오는 중입니다…</div>
              : !views.length
                ? <div className="repo-glass__empty">표시할 레포지토리가 없습니다.</div>
                : filtered.length?filtered.map(repo=><button type="button" key={repo.key} className={`repo-glass__repo-row ${current?.key===repo.key?'is-selected':''}`} aria-pressed={current?.key===repo.key} onClick={()=>{setSelected(repo.key);setTab('개요')}}><span className="repo-glass__repo-name"><span aria-hidden="true">{repo.favorite?'★':'◉'}</span><span><strong>{repo.name}</strong><small>{repo.description}</small></span></span><span className="repo-glass__tag">{repo.category}</span><span className="repo-glass__status">{repo.status||'—'}</span></button>):<div className="repo-glass__empty">조건에 맞는 레포지토리가 없습니다. 필터를 초기화해 보세요.</div>}
        </div>
        {!verified && <p className="repo-glass__footnote">*분류·상태는 시연용 추정값입니다. GitHub 데이터 동기화·편집·저장은 아직 포함되지 않습니다.</p>}
      </section>
      <p className="repo-glass__sr-only" role="status" aria-live="polite" aria-atomic="true">{current ? `${current.name} 저장소 상세가 갱신되었습니다.` : '선택 가능한 저장소가 없습니다.'}</p>
      <aside className="repo-glass__detail" aria-label="선택한 저장소 상세">
        {current?<><div className="repo-glass__detail-title"><span aria-hidden="true">◉</span><div><h2>{current.name}</h2><p>{current.description}</p></div></div>
          <div className="repo-glass__chips"><span>{current.origin}</span><span>{current.category}</span>{current.status&&<span>{current.status}</span>}{current.visibility==='private'&&<span>Private</span>}</div>
          <div className="repo-glass__tabs" role="tablist" aria-label="레포지토리 상세 탭">{DETAIL_TABS.map((t, index)=><button key={t} type="button" role="tab" tabIndex={tab===t ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, index)} id={`repo-tab-${t}`} aria-selected={tab===t} aria-controls="repo-detail-panel" onClick={()=>setTab(t)}>{t}</button>)}</div>
          <div id="repo-detail-panel" role="tabpanel" tabIndex={0} aria-labelledby={`repo-tab-${tab}`} className="repo-glass__detail-body">
            {tab==='개요'?<><h3>프로젝트 개요</h3><p>{current.description}</p><dl><div><dt>기술</dt><dd>{current.language||'—'}</dd></div><div><dt>관리 상태</dt><dd>{current.status||'—'}{verified?'':' · 예시'}</dd></div><div><dt>분류 근거</dt><dd>{verified?'GitHub fork 메타데이터 · 사용자 분류':'README·기존 정리 기반 추정'}</dd></div></dl></>:tab==='README'?<><h3>README 미리보기</h3><p>실제 README 가져오기는 Phase 2에서 지원합니다. 현재는 확인된 용도 요약만 보여줍니다.</p><p>{current.description}</p></>:<><h3>개인 관리 메모</h3>{current.note?<p>{current.note}</p>:null}<p>{metaStore.persistent?'메모 편집은 곧 지원됩니다.':'Phase 3에서 저장 가능한 메모와 우선순위 설정을 추가합니다. 현재는 읽기 전용 데모입니다.'}</p></>}
          </div>
          <a className="repo-glass__github-link" href={current.url} target="_blank" rel="noopener noreferrer">GitHub에서 열기 ↗</a>
        </>:<div className="repo-glass__empty">선택 가능한 레포지토리가 없습니다.</div>}
      </aside>
    </div>
  </section>;
}
