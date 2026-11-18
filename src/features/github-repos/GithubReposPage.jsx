import { useMemo, useState } from 'react';
import './GithubReposPage.css';

// Phase 1 demo fixtures only. No network requests, credentials, or persistence.
export const SAMPLE_REPOS = [
  ['cxr542-portal','개인 서비스','직접 제작 추정','개인 서비스·마라톤 기록·아이디어를 모은 통합 포털','개발 중','React'],
  ['cxr542-launcher','업무·교육','직접 제작 추정','AI 서비스와 교육 도구를 연결하는 워크스페이스 런처','운영 확인 필요','Web'],
  ['edu-team-tms','업무·교육','직접 제작 추정','교육팀 업무일지, KPI, 빌딩비 관리','운영 확인 필요','JavaScript'],
  ['edu-history','업무·교육','직접 제작 추정','교육·강사 이력 관리 목업','실험','React'],
  ['ppt-academizer','업무·교육','직접 제작 추정','강의안용 PowerPoint 템플릿 변환','개발 중','Python'],
  ['medical-briefing-bot','AI·에이전트','직접 제작 추정','보건·의료 뉴스 수집과 AI 브리핑','운영 확인 필요','Python'],
  ['GeminiTuner','AI·에이전트','직접 제작 추정','Gemini 토큰 및 예상 비용 모니터링','실험','JavaScript'],
  ['today-shoes','개인 서비스','직접 제작 추정','러닝화와 훈련 기록 관리','개발 중','Expo'],
  ['src-running-ops','개인 서비스','직접 제작 추정','러닝 동호회 운영 도구','실험','Web'],
  ['AI-Synapse-Wiki','학습·실험','직접 제작 추정','AI 지식 연결·검색 위키','실험','React'],
  ['agent-browser','AI·에이전트','외부 원본 추정','AI 에이전트용 브라우저 자동화 도구','검토','TypeScript'],
  ['openbot','AI·에이전트','외부 원본 추정','로컬 AI 에이전트 협업 작업 공간','검토','TypeScript'],
  ['spec-kit','학습·실험','외부 원본 추정','명세 기반 소프트웨어 개발 도구','검토','Python'],
  ['konlpy','학습·실험','외부 원본 추정','한국어 형태소 분석 라이브러리','보관 검토','Python'],
  ['vision-font','개인 서비스','직접 제작 추정','시력 맞춤형 글자 크기 리더','실험','Expo'],
].map(([name,category,origin,description,status,language])=>({name,category,origin,description,status,language,url:'https://github.com/cxr542/'+name}));
export const REPO_CATEGORIES = [
  {name:'업무·교육',icon:'▣',tone:'violet',caption:'교육 운영과 생산성'},
  {name:'개인 서비스',icon:'✦',tone:'blue',caption:'포털·러닝·생활 도구'},
  {name:'AI·에이전트',icon:'⌘',tone:'cyan',caption:'AI 도구와 자동화'},
  {name:'학습·실험',icon:'◇',tone:'green',caption:'연구·기술 학습'},
];
export function filterSampleRepos(repos,{query='',category='전체',origin='전체'}={}) {
  const keyword=query.trim().toLocaleLowerCase();
  return repos.filter(repo=>(category==='전체'||repo.category===category)
    &&(origin==='전체'||repo.origin===origin)
    &&(!keyword||[repo.name,repo.description,repo.language,repo.category].some(v=>v.toLocaleLowerCase().includes(keyword))));
}
export default function GithubReposPage() {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('전체');
  const [origin,setOrigin]=useState('전체');
  const [selected,setSelected]=useState(SAMPLE_REPOS[0].name);
  const [tab,setTab]=useState('개요');
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
        <div className="repo-glass__table-head"><span>레포지토리</span><span>카테고리</span><span>상태*</span></div>
        <div className="repo-glass__rows">
          {filtered.length?filtered.map(repo=><button type="button" key={repo.name} className={`repo-glass__repo-row ${current?.name===repo.name?'is-selected':''}`} aria-pressed={current?.name===repo.name} onClick={()=>{setSelected(repo.name);setTab('개요')}}><span className="repo-glass__repo-name"><span aria-hidden="true">◉</span><span><strong>{repo.name}</strong><small>{repo.description}</small></span></span><span className="repo-glass__tag">{repo.category}</span><span className="repo-glass__status">{repo.status}</span></button>):<div className="repo-glass__empty">조건에 맞는 레포지토리가 없습니다. 필터를 초기화해 보세요.</div>}
        </div>
        <p className="repo-glass__footnote">*분류·상태는 시연용 추정값입니다. GitHub 데이터 동기화·편집·저장은 Phase 1에 포함되지 않습니다.</p>
      </section>
      <aside className="repo-glass__detail" aria-label="선택한 저장소 상세">
        {current?<><div className="repo-glass__detail-title"><span aria-hidden="true">◉</span><div><h2>{current.name}</h2><p>{current.description}</p></div></div>
          <div className="repo-glass__chips"><span>{current.origin}</span><span>{current.category}</span><span>{current.status}</span></div>
          <div className="repo-glass__tabs" role="tablist" aria-label="레포지토리 상세 탭">{['개요','README','메모'].map(t=><button key={t} role="tab" id={`repo-tab-${t}`} aria-selected={tab===t} aria-controls="repo-detail-panel" onClick={()=>setTab(t)}>{t}</button>)}</div>
          <div id="repo-detail-panel" role="tabpanel" aria-labelledby={`repo-tab-${tab}`} className="repo-glass__detail-body">
            {tab==='개요'?<><h3>프로젝트 개요</h3><p>{current.description}</p><dl><div><dt>기술</dt><dd>{current.language}</dd></div><div><dt>관리 상태</dt><dd>{current.status} · 예시</dd></div><div><dt>분류 근거</dt><dd>README·기존 정리 기반 추정</dd></div></dl></>:tab==='README'?<><h3>README 미리보기</h3><p>실제 README 가져오기는 Phase 2에서 지원합니다. 현재는 확인된 용도 요약만 보여줍니다.</p><p>{current.description}</p></>:<><h3>개인 관리 메모</h3><p>Phase 3에서 저장 가능한 메모와 우선순위 설정을 추가합니다. 현재는 읽기 전용 데모입니다.</p></>}
          </div>
          <a className="repo-glass__github-link" href={current.url} target="_blank" rel="noopener noreferrer">GitHub에서 열기 ↗</a>
        </>:<div className="repo-glass__empty">선택 가능한 레포지토리가 없습니다.</div>}
      </aside>
    </div>
  </section>;
}
