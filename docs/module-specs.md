# cxr542 모듈 스펙 (MVP)

## 1) vision-font
- **개발:** `/vision-font/` 웹 데모 (5단계 시력 테스트 → 맞춤 글꼴 → 샘플 기사·URL 미리보기, localStorage·JSON)
- **운영:** React MVP — 폰트 프리셋 3종, 샘플 미리보기, CSS 복사
- **소개:** `/vision-font/about.html` (Expo 앱 설명)

## 2) today-shoes
- **개발:** `/today-shoes/` 웹 데모 (신발장 · 3각도 사진 · Gemini/기본 분석 · JSON)
- **운영:** React MVP — 모델·느낌·태그 메모 (`cxr542-today-shoes-v1`)
- **Expo:** https://cxr542.github.io/today-shoes/

## 3) 마라톤 기록장
- **경로:** `/marathon-log/` (포털과 동일 origin · `public/marathon-log/`)
- **UI:** 포털 홈 카드·사이드바 → iframe 또는 `/marathon-log/` 직접 접속
- **저장:** IndexedDB `marathon-log` / fallback `marathon-log-races` (localStorage)
- **기능:** 대회 기록·PB·통계, 거리/결과 필터, 기상청 조회, JSON 보내기/가져오기, Keep 시드
- **이전:** [GitHub Pages marathon-log](https://cxr542.github.io/cxr542-ai/projects/marathon-log/) 데이터 → JSON보내기 후 포털 `/marathon-log/`에서 JSON 가져오기

## 4) AI-Synapse Wiki
- **개발:** `/ai-synapse-wiki/` — 정적 빌드(읽기) + **편집(Wiki dev)** iframe (`5174`)
- **주제 등록:** `npm run wiki:check` → 포털 **편집(Wiki dev)** 모드 (자연어/수동/목록)
- **정적 갱신:** `WIKI_ROOT=… npm run wiki:sync`
- **가이드:** [docs/ai-synapse-wiki-improve.md](ai-synapse-wiki-improve.md)
- **운영:** React MVP — GitHub Pages·저장소 링크
- **소개:** `/ai-synapse-wiki/about.html`

## 5) GeminiTuner
- **개발:** `/gemini-tuner/` — gemini.google.com FinOps 패널 미리보기 · 스파클 캐릭터 · 5h/1w 한도 위젯 · 월 예산 (localStorage)
- **운영:** React MVP — Chrome 확장·저장소 링크
- **본체:** [GeminiTuner](https://github.com/cxr542/GeminiTuner) · gemini.google.com 사이드 패널

## 6) 아이디어 뱅크
- **경로:** `/idea-bank/` (포털과 동일 origin · `public/idea-bank/`)
- **UI:** 포털 홈 카드·사이드바 → iframe 또는 `/idea-bank/` 직접 접속
- **저장:** IndexedDB / `idea-bank-ideas` (포털 도메인 `vercel.app`)
- **기능:** 검색, 카테고리, 고정함, JSON 보내기/가져오기
- **이전:** [GitHub Pages idea-bank](https://cxr542.github.io/cxr542-ai/projects/idea-bank/) 데이터 → JSON보내기 후 포털 `/idea-bank/`에서 JSON 가져오기

## 7) 나는누구?
- **경로:** `/who-are-you/`
- **UI:** [career.sw.or.kr](https://career.sw.or.kr) 항목 구조 — 근무경력·기술경력(프로젝트)·학력·자격·자기소개서
- **저장:** IndexedDB `who-are-you` / fallback `who-are-you-bundle`
- **기능:** 대시보드 완성도, 표·타임라인, 인쇄/PDF용 미리보기, JSON·`## 항목` 붙여넣기 가져오기
- **참고:** 공식 경력관리시스템은 증빙·기업확인 별도 — 이 앱은 개인 원고·구조화용

## 8) 너는몇점?
- **경로:** `/how-many-points/` (`public/how-many-points/`)
- **UI:** 왓챠피디아형 포스터 그리드 · 종류별 필터(영화/시리즈/책/웹툰) · 0.5~5점 · 리뷰
- **저장:** IndexedDB `how-many-points` / fallback `how-many-points-ratings`
- **가져오기:** 왓챠피디아 CSV ([watchapedia-export](https://github.com/erinyskim/watchapedia-export) 등 브라우저 스크립트) · JSON 보내기/가져오기
- **왓챠 이전:** 공식 Export API 없음 → `가져오기` 메뉴 안내 참고

## 9) 프롬프트 모음
- **경로:** `/prompt-collection/` (`public/prompt-collection/`)
- **UI:** 아이디어 뱅크와 동일 셸(사이드바·목록·편집) · 포털 iframe 또는 직접 접속
- **저장:** IndexedDB `prompt-collection` / fallback `prompt-collection-prompts`
- **기능:** 제목·프롬프트 본문, 검색, 고정함, 목록/카드에서 본문 복사, JSON 보내기/가져오기
- **용도:** Google Keep 등에 흩어 둔 AI·업무 프롬프트를 포털 도메인에서 관리

## 공통 규칙
- 모든 모듈 데이터는 브라우저 localStorage 사용
- 서버 DB 연동은 차기 버전에서 검토
- 기본 CRUD와 빠른 입력 흐름에 집중
