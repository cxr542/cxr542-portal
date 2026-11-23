import { useMemo, useState } from 'react';
import './GithubReposPage.css';

import { filterSampleRepos, REPO_CATEGORIES, SAMPLE_REPOS } from './githubReposData';

const DETAIL_TABS = ['개요', 'README', '메모'];

export default function GithubReposPage() {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('전체');
  const [origin,setOrigin]=useState('전체');
  const [selected,setSelected]=useState(SAMPLE_REPOS[0].name);
  const [tab,setTab]=useState('개요');
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
  const filtered=useMemo(()=>filterSampleRepos(SAMPLE_REPOS,{query,category,origin}),[query,category,origin]);
  const current=filtered.find(repo=>repo.name===selected)||filtered[0]||null;
  const own=SAMPLE_REPOS.filter(r=>r.origin==='직접 제작 추정').length;
  const external=SAMPLE_REPOS.length-own;
  return <section className="repo-glass" aria-label="GitHub 레포지토리 관리 시안">
    <div className="repo-glass__head">
      <div><span className="repo-glass__eyebrow">◆ REPOSITORY UNIVERSE / PHASE 1</span><h1>GitHub Repository Manager</h1><p>카테고리별로 프로젝트를 탐색하는 나만의 3D 워크스페이스</p></div>
      <span className="repo-glass__demo" role="status">● DEMO · 샘플 데이터 {SAMPLE_REPOS.length}건</span>
    </div>
    <div className="repo-glass__stats">
      <div className="repo-glass__stat violet"><span>샘플 레포지토리</span><strong>{SAMPLE_REPOS.length}</strong><small>GitHub 실시간 조회 아님</small></div>
      <div className="repo-glass__stat blue"><span>직접 제작 추정</span><strong>{own}</strong><small>공식 생성 이력 미검증</small></div>
      <div className="repo-glass__stat cyan"><span>외부 원본 추정</span><strong>{external}</strong><small>공식 fork 여부 미확인</small></div>
    </div>
    <div className="repo-glass__section-head"><h2>카테고리로 탐색하기</h2><button type="button" onClick={()=>{setCategory('전체');setOrigin('전체');setQuery('');}}>전체 보기 ↗</button></div>
    <div className="repo-glass__categories">
      {REPO_CATEGORIES.map(group=><button type="button" key={group.name} className={`repo-glass__category ${group.tone} ${category===group.name?'is-active':''}`} aria-pressed={category===group.name} onClick={()=>{setCategory(category===group.name?'전체':group.name);setTab('개요');}}>
        <span className="repo-glass__category-icon" aria-hidden="true">{group.icon}</span><strong>{group.name}</strong><span className="repo-glass__category-count">{SAMPLE_REPOS.filter(r=>r.category===group.name).length}개</span><small>{group.caption}</small></button>)}
    </div>
    <div className="repo-glass__workspace">
      <section className="repo-glass__list" aria-label="저장소 목록">
        <div className="repo-glass__toolbar">
          <div className="repo-glass__filters" role="group" aria-label="원본 유형 필터">{['전체','직접 제작 추정','외부 원본 추정'].map(o=><button key={o} type="button" aria-pressed={origin===o} onClick={()=>setOrigin(o)}>{o==='전체'?'전체':o==='직접 제작 추정'?'내 프로젝트*':'외부 원본*'}</button>)}</div>
          <label className="repo-glass__search"><span className="repo-glass__sr-only">레포지토리 검색</span><input type="search" placeholder="이름, 설명, 기술 검색…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        </div>
        {current && <button type="button" className="repo-glass__detail-jump" aria-controls="repo-detail-panel" onClick={() => document.getElementById('repo-detail-panel').focus()}>선택한 저장소 상세로 이동 ↓</button>}
        <div className="repo-glass__table-head"><span>레포지토리</span><span>카테고리</span><span>상태*</span></div>
        <div className="repo-glass__rows">
          {filtered.length?filtered.map(repo=><button type="button" key={repo.name} className={`repo-glass__repo-row ${current?.name===repo.name?'is-selected':''}`} aria-pressed={current?.name===repo.name} onClick={()=>{setSelected(repo.name);setTab('개요')}}><span className="repo-glass__repo-name"><span aria-hidden="true">◉</span><span><strong>{repo.name}</strong><small>{repo.description}</small></span></span><span className="repo-glass__tag">{repo.category}</span><span className="repo-glass__status">{repo.status}</span></button>):<div className="repo-glass__empty">조건에 맞는 레포지토리가 없습니다. 필터를 초기화해 보세요.</div>}
        </div>
        <p className="repo-glass__footnote">*분류·상태는 시연용 추정값입니다. GitHub 데이터 동기화·편집·저장은 Phase 1에 포함되지 않습니다.</p>
      </section>
      <p className="repo-glass__sr-only" role="status" aria-live="polite" aria-atomic="true">{current ? `${current.name} 저장소 상세가 갱신되었습니다.` : '선택 가능한 저장소가 없습니다.'}</p>
      <aside className="repo-glass__detail" aria-label="선택한 저장소 상세">
        {current?<><div className="repo-glass__detail-title"><span aria-hidden="true">◉</span><div><h2>{current.name}</h2><p>{current.description}</p></div></div>
          <div className="repo-glass__chips"><span>{current.origin}</span><span>{current.category}</span><span>{current.status}</span></div>
          <div className="repo-glass__tabs" role="tablist" aria-label="레포지토리 상세 탭">{DETAIL_TABS.map((t, index)=><button key={t} type="button" role="tab" tabIndex={tab===t ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, index)} id={`repo-tab-${t}`} aria-selected={tab===t} aria-controls="repo-detail-panel" onClick={()=>setTab(t)}>{t}</button>)}</div>
          <div id="repo-detail-panel" role="tabpanel" tabIndex={0} aria-labelledby={`repo-tab-${tab}`} className="repo-glass__detail-body">
            {tab==='개요'?<><h3>프로젝트 개요</h3><p>{current.description}</p><dl><div><dt>기술</dt><dd>{current.language}</dd></div><div><dt>관리 상태</dt><dd>{current.status} · 예시</dd></div><div><dt>분류 근거</dt><dd>README·기존 정리 기반 추정</dd></div></dl></>:tab==='README'?<><h3>README 미리보기</h3><p>실제 README 가져오기는 Phase 2에서 지원합니다. 현재는 확인된 용도 요약만 보여줍니다.</p><p>{current.description}</p></>:<><h3>개인 관리 메모</h3><p>Phase 3에서 저장 가능한 메모와 우선순위 설정을 추가합니다. 현재는 읽기 전용 데모입니다.</p></>}
          </div>
          <a className="repo-glass__github-link" href={current.url} target="_blank" rel="noopener noreferrer">GitHub에서 열기 ↗</a>
        </>:<div className="repo-glass__empty">선택 가능한 레포지토리가 없습니다.</div>}
      </aside>
    </div>
  </section>;
}
