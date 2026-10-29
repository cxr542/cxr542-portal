# 프롬프트 중앙화 Phase 1 결과

## 1. 현재 상태

feat/prompt-centralization 개발 브랜치와 별도 worktree에 구현했습니다. 코드·로컬 검증과 기능 비활성 Preview를 제공하며, 운영 DB/Auth 설정·Production·실제 GPT 연결은 변경하지 않았습니다. 커밋·PR도 생성하지 않았습니다.

## 2. 발견된 문제와 해결

기존 전체 교체/동일 ID 덮어쓰기 경로를 중앙 이관에서 사용하지 않습니다. 원본 두 저장소를 모두 읽고 보존합니다. 실제 Preview에서 발견한 SPA fallback의 API HTML 응답을 함수 대상 명시로 해결했습니다. 독립 검토에서 발견한 정규화 차이, 캐시 본문/페이지 누락, 로컬 필터, 안전한 중지, 키보드 포커스와 오류 위치도 수정했습니다.

## 3. 권장 아키텍처 및 구현

기존 React/Vite 포털과 별도 프롬프트 화면을 유지합니다. Vercel API → Supabase PostgreSQL 중앙 저장, IndexedDB 사용자별 캐시/초안 구조입니다. 서버 성공과 로컬 초안을 구별하며 자동 양방향 병합은 하지 않습니다. home 재사용은 후보로 유지하고 운영 승인 전에는 연결하지 않습니다.

## 4. 변경 파일

- public/prompt-collection: 기존 화면/원본 reader, 신규 api-client/cache/migration, OpenAPI, OFL 자체 제공 폰트
- api/prompts, api/prompt-auth, api/prompt-oauth 및 server/prompts
- supabase/migrations/20261027152049_portal_prompts.sql
- tests/prompt*.test.js, tests/fixtures/ootd.json, scripts/prompts-qa-server.mjs
- vercel.json, Vite API 미들웨어, 프롬프트에 한정한 빌드 최적화, lint와 의존성/lockfile
- 포털 프롬프트 안내/홈 요약, Production 수동 승인 workflow, 운영·연동 문서

원래 checkout의 README/idea-bank/Vite/Running Ops 미커밋 작업과 원래 브랜치는 보존했습니다. 회사 업무 저장소를 수정하지 않았습니다.

## 5. DB 설계

portal_prompts에 UUID/owner/title/content/description/category/tags/source/favorite/private visibility/version/서버 시각/tombstone을 둡니다. 요청 ID/hash 및 legacy JSON이 이관 원장을 겸합니다. 사용자·수정 시각·카테고리·즐겨찾기·태그 인덱스를 작성했습니다. private quota/audit 테이블과 RPC를 포함합니다. SQL은 로컬 PostgreSQL 엔진에서 실행했으며 운영에는 미적용입니다.

## 6. API 설계

인증된 GET 목록/검색·상세, POST 등록, PATCH 수정, DELETE 소프트 삭제를 구현했습니다. 목록은 커서 페이지네이션, category/tags/favorite 필터와 한글/영문 부분 검색을 지원합니다. version 충돌은 409, 삭제 이관 재실행은 복구하지 않습니다. 브라우저는 전체 본문 캐시·백업 및 본인 tombstone 조회를 명시적으로 요청합니다. OpenAPI와 ChatGPT/CLI 문서를 작성했습니다.

## 7. 인증 및 보안

Supabase Auth 사용자 확인 후 사용자 JWT로 접근합니다. owner 입력은 허용하지 않고 RLS와 private 쓰기 함수의 auth.uid() 검사를 적용했습니다. 직접 테이블 쓰기는 차단합니다. publishable key만 서버 설정으로 사용하며 service-role은 사용하지 않습니다. 입력/크기 제한, 독립 트랜잭션의 영속 요청 제한, 안전한 오류, 본문/토큰 없는 감사 기록을 구현했습니다. OAuth는 PKCE·state·client·콜백 허용 목록을 검증하지만 실제 Supabase OAuth Server(베타)/GPT Actions 호환성은 별도 파일럿이 필요합니다.

## 8. 비용

신규 유료 프로젝트·요금제를 만들지 않았습니다. 기존 Vercel Preview 사용량이 발생하며, 중앙 DB는 아직 연결하지 않았습니다. home을 재사용하면 소규모 텍스트 저장은 기존 한도 안에서 가능할 여지가 있지만 실제 계정 요금제와 다른 서비스 사용량을 확인해야 합니다. 1,000개 × 10KB 원문은 약 10MB이며 인덱스·원장·감사 이력·전송량이 추가됩니다. 회사 업무 용도라면 Vercel Hobby 이용 조건을 별도 확인해야 합니다.

## 9. 검증·리스크·롤백

70개 테스트, lint, build, npm audit(취약점 0), diff/스타일 검사 통과. 실제 Chrome 분리 프로필의 15개 시나리오와 144개 캡처를 확인했고 독립 보안/동작·화면 검토를 받았습니다. 실제 iPhone Safari, 실제 Supabase Auth/PostgREST와 GPT 연결은 아직 검증하지 않았습니다. 전체 증거와 성능 측정 조건은 verification.md에 기록했습니다.

롤백은 중앙 기능 비활성화 → 서버 최신 백업 → 이전 프론트로 복귀입니다. 원본 IndexedDB나 중앙 tombstone을 삭제하지 않습니다. 서버 신규 데이터는 기존 브라우저 원본에 자동 복제되지 않으므로 프론트 롤백만으로 데이터가 복구되는 것은 아닙니다.

## 10. 다음 승인 항목

실제 검증 환경의 Supabase Auth/PostgREST 연결, 실제 기기 검증, OAuth/GPT 호환성 파일럿이 남았습니다. 운영 home DB SQL 적용·Auth 설정 변경·환경변수 설정과 Production 배포는 별도 명시적 승인이 필요합니다. GitHub Environment 승인자 및 Vercel의 별도 자동 배포 경로도 main 반영 전에 확인해야 합니다. 제공 OOTD는 테스트 fixture에만 있고 운영 자동 등록은 없습니다.
