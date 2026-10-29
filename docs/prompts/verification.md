# Phase 1 검증 기록

2026-10-28 추가: 명시적 승인 후 home 내부 테스트 스키마와 Preview의 실제 클라우드 검증 20개를 완료했습니다. 아래 Phase 1·로컬 기록의 당시 미적용 상태와 구분해 [최신 클라우드 적용 기록](cloud-preview-verification.md)을 확인합니다. Production 배포는 하지 않았습니다.

개발 브랜치: feat/prompt-centralization. 운영 DB/인증 설정과 Production은 변경하지 않았습니다.

## 자동 검증

- npm test: 19개 파일, 82개 테스트 통과(Phase 2·Preview 스키마·OAuth ID 회귀 검사 포함)
- npm run lint: 통과. 신규 브라우저 모듈과 서버 MJS도 검사
- npm run build: 통과
- npm audit: 취약점 0개
- git diff --check 및 accent-stripes 검사: 통과

PGlite의 실제 PostgreSQL 엔진에서 RLS 역할 전환, 사용자 소유권, 직접 쓰기 차단, version 충돌, tombstone, 멱등성, API 요청 제한, 감사 로그를 실행했습니다. HTTP → Vercel-compatible handler → SQL 계약 테스트는 공백 정규화 및 변경된 원본의 삭제 후 재이관도 검증합니다. Auth/PostgREST 전송부는 로컬 fixture이며 실제 Supabase 연동 검증을 대체하지 않습니다.

## 브라우저 검증

실제 설치된 Chrome + 별도 임시 프로필 두 개, loopback 전용 fixture로 확인했습니다. 실제 iPhone Safari에서 확인한 것은 아닙니다.

원본 두 저장소 보존, 비일치 필터 제외, Space/Tab 포커스, 승인 후 이관 및 서버 재조회, 재실행 중복 제외, 검색/필터/복사, 동시 수정 거절과 초안 보존, 삭제 후 재이관 차단, 현재 항목 후 중지, 새 등록/즐겨찾기, 추가 페이지 전체 캐시, 오프라인 재로드/본문 열기/복사, 실패 저장의 초안 보존, 다른 계정 분리, 포털 홈을 확인했습니다.

캡처: 12개 상태 × 390(DPR3)/1440/1920 × OS light/dark × top/end = 144장. 기존 다크 테마를 유지합니다. 전환 애니메이션과 폰트가 안정화된 뒤 촬영합니다. 증거는 이 worktree의 .cache/prompt-qa/results.json 및 PNG 파일에 있습니다. 첫 검토에서 발견한 공백 정규화, 오프라인 본문/페이지 누락, 로컬 필터, 중지, 포커스, 오류 위치를 수정했습니다.

## Phase 2 실제 로컬 Supabase 검증 (2026-10-28)

Docker의 Supabase Auth, PostgREST, PostgreSQL에서 `node scripts/check-prompts-native.mjs`의 9개 시나리오가 통과했습니다. 모의 인증이나 REST 응답을 사용하지 않았습니다. 사용자 두 명의 로그인, 위조 토큰 거절, CRUD·검색·멱등성, 사용자 간 RLS와 직접 쓰기 차단, 별도 트랜잭션의 동시 수정(200/409), 원본 보존 이관, tombstone과 재이관 차단, 만료 토큰, 갱신 및 로그아웃을 확인했습니다.

로컬 API/DB는 127.0.0.1에만 바인딩했습니다. 서버의 로컬 연결 예외는 NODE_ENV=test, PROMPTS_LOCAL_TEST=true, VERCEL 미설정, 정확한 loopback URL과 publishable key를 모두 요구합니다. 운영 환경에서 활성화되지 않는 회귀 테스트를 추가했습니다. 클라우드 프로젝트·운영 설정·Production 변경과 추가 클라우드 비용은 없습니다. 재실행 조건과 증거는 [native-validation.md](native-validation.md)에 기록했습니다.

## 남은 실제 환경 검증

2026-10-28 추가 브라우저 검증: 별도 임시 Chrome 프로필 두 개가 실제 로컬 Supabase Auth/PostgREST/PostgreSQL에 접속했습니다. 같은 계정 로그인, A 등록→B 검색, B 수정→A 충돌 및 초안 보존, 새로고침 후 최신 본문, 모바일 viewport 가로 넘침 검사, 삭제 전파, 다른 계정 검색 차단의 7개 시나리오가 통과했습니다. 증거는 `.cache/supabase-native/browser-results.json`입니다. 사용자 브라우저의 저장소는 조작하지 않았습니다. 클라우드 Preview 또는 실제 Safari 검증을 의미하지 않습니다.

클라우드 격리 대안: 사용자가 제안한 home 하위 공간은 DB의 별도 스키마로 구현 가능합니다. [home-preview-plan.md](home-preview-plan.md)에 변경 경계와 적용 전 조건을 기록했습니다. 아직 home에 SQL/Auth/API 설정을 변경하지 않았습니다.

Preview 스키마용 SQL·프로필 선택·테스트 사용자 허용 목록을 구현했습니다. 실제 로컬 Supabase에서 Preview 스키마의 10개 통합 시나리오와 브라우저 7개 시나리오가 통과했고, 실제 DB 롤백이 기존 public 데이터와 Auth 사용자를 보존하는지 확인했습니다. 적용 후보와 롤백 SQL은 supabase/preview에 있으며 자동 migration 경로에 포함되지 않습니다.

실제 로컬 OAuth Server 검증 8개도 완료했습니다. 정상 opaque authorization_id를 UUID로 잘못 거부한 문제를 수정했고, 실제 GPT의 PKCE와 공개 연결 주소는 아직 미확정입니다. [OAuth 파일럿 기록](oauth-pilot.md)을 확인합니다.

- 격리된 클라우드 Preview에서 Auth/PostgREST와 프로젝트 advisor 확인(로컬 실제 서비스 검증은 완료)
- 실제 맥북/iPhone Safari로 로그인·조회·수정·충돌 확인
- Supabase OAuth Server(베타)와 GPT Actions PKCE/state/refresh 호환성 파일럿
- 실제 GPT Action 연결 및 자연어 등록/검색/수정
- GitHub Environment required reviewer 및 별도 Vercel Git 자동 배포 설정 확인
- 별도 운영 승인 후 home SQL 적용과 Production 배포, 실제 운영 스모크 테스트

새 유료 프로젝트·요금제는 생성하지 않았고 OOTD는 테스트 fixture에만 사용했습니다. 커밋·PR·운영 배포도 하지 않았습니다.

## 변경 범위와 운영 이관

신규 API: api/prompts, api/prompt-auth, api/prompt-oauth 및 server/prompts. 프롬프트 HTML/JS/CSS, 프롬프트에 한정한 Vite 미들웨어와 Vercel 경로, SQL/정책/테스트, OpenAPI, 배포 승인 문서가 변경되었습니다. 기존 포털 React 변경은 안내 문구와 프롬프트 홈 카드 요약에 한정됩니다. 빌드는 원본 세 CSS를 Lightning CSS로 압축해 프롬프트 HTML에만 넣으며, 다른 모듈의 스타일/빌드 출력은 바꾸지 않습니다. 기존 서체는 OFL 라이선스와 함께 자체 제공하고, 공용 셸 파일은 수정하지 않았습니다.

원래 checkout의 미커밋 README/idea-bank/Vite/Running Ops 작업은 그대로이고 원래 브랜치도 feat/idea-bank-chat-style-ui입니다. 이 구현은 별도 worktree에서 검토해야 하며 원래 미커밋 작업 위에 덮어쓰면 안 됩니다.

Production workflow의 수동 실행/Environment 게이트는 이 브랜치의 코드 변경입니다. 아직 GitHub에 푸시하거나 실제 Environment 승인자를 구성하지 않았습니다. main에 합치기 전에도 운영 승인과 배포 경로 확인이 필요합니다.

## 성능·접근성 측정

최종 로컬 production 빌드를 설치된 실제 Chrome에서 Lighthouse Node API로 모바일/데스크톱 각 3회 측정했습니다. 모든 실행에서 Performance/Accessibility/Best Practices/SEO가 각각 100/100/100/100입니다. 원시 결과는 .cache/prompt-qa/lighthouse-{mobile,desktop}-{1,2,3}.json과 lighthouse-scores.json입니다. 이 결과는 로컬 fixture의 초기 로그아웃 화면이며 보호된 Preview나 실제 Supabase 로그인 화면의 성능 점수가 아닙니다. Fixture는 Vercel에서 확인한 gzip 전송을 재현합니다. 최초 비압축 fixture 결과와 비교해 개선을 과장하지 않도록 최종 측정 조건을 구분합니다.
