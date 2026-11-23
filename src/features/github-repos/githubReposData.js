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
