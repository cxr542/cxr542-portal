# 운영 반영 — 2026-10-29

사용자 `운영에 반영해줘` 승인으로 운영 DB 마이그레이션 및 Production 배포를 수행했다.

## 운영 주소와 배포

- 포털: https://cxr542-portal.vercel.app/prompt-collection/index.html
- 포털 배포: `dpl_BuDArk5coUmArojKm2jh6rP1rz29` (Production, READY)
- ChatGPT MCP: https://cxr542-prompt-actions-test.vercel.app/api/prompt-mcp
- MCP 배포: `dpl_2TQdaeiQnGq53Cz2vMFGoSyq1VVu` (Production, READY)
- MCP 주소 이름에는 test가 남아 있지만 이제 운영 `public.portal_prompts`를 사용한다. 기존 OAuth client/resource/callback 및 ChatGPT 연결을 유지했다.
- 기존 포털 보호 설정, 다른 프로젝트, 요금제는 변경하지 않았다. 파일럿 기본 도메인의 기존 503 규칙도 유지했다.

## 소스 보존

작업 브랜치보다 운영 코드가 앞서 있어 현재 운영 소스를 해시로 복원한 후 프롬프트 관련 파일만 합쳤다. 작업 중 발생한 추가 운영 배포도 다시 반영했다.

- 최종 기준 운영 배포: `dpl_JCpAeSJUG9rL72Ne2u6bPDgTiyFD` (135개 소스 파일)
- 범위: `public/prompt-collection/**`, `api/prompts/**`, `api/prompt-auth/**`, `api/prompt-oauth/**`, `api/prompt-mcp.mjs`, `server/prompts/**`, 프롬프트 CSS 빌드 스크립트, 필요한 패키지/잠금 파일 및 API rewrite 추가.
- 기존 공통 클라우드 인증·저장, 다른 앱과 API, Vite cloud 엔트리는 기준 배포에서 보존했다. 공통 `portal_documents`의 기존 프롬프트 데이터는 0건이었다.
- 검증된 합본은 로컬 `.cache/prompt-production/portal` 및 Vercel 배포 소스에 있다. 임시 폴더는 Git에 포함하지 않는다.
- 이 작업의 소스는 아직 커밋/푸시되지 않았다. 후속 Git 통합은 위 최신 기준의 공통 클라우드 변경을 포함해 수행해야 한다. 오래된 작업 브랜치 전체를 그대로 재배포하면 최신 공통 기능을 되돌릴 수 있다.

## DB 및 보존

- Supabase home의 `portal_prompts_production` 마이그레이션 적용.
- `public.portal_prompts`, `portal_private.prompt_limits`, `portal_private.prompt_audit` 생성 및 RLS/권한 적용.
- 운영과 Preview 스키마 분리. 운영 프롬프트는 초기 0건이며 테스트 OOTD는 복사하지 않았다.
- 실제 CRUD 검증용 항목 1건은 soft delete했다. tombstone과 감사 기록은 보존한다.
- IndexedDB/localStorage 원본은 삭제·초기화하지 않는다. 기존 데이터는 로그인 후 백업·미리보기·선택 업로드 절차를 거친다.
- 서버 역할 키나 OAuth client secret을 프런트엔드 또는 배포 환경에 추가하지 않았다. 서버에서는 publishable key와 검증된 사용자 JWT만 사용한다.

## 검증

- 프롬프트 전용 20개 파일 / 99개 테스트 통과, 린트 통과.
- 최신 운영 기준의 다른 기능 45개 회귀 테스트 통과. 이전 범용 클라우드 프롬프트 어댑터 전용 테스트 1개는 새 프롬프트 전용 테스트로 대체하여 제외했다.
- 합본 운영 빌드 성공, Production 전용 번들 환경/스키마 가드 3개 케이스 통과.
- 실제 운영 API 검증 13개: 무인증 401, 두 계정 로그인, 목록, 생성, 다른 사용자 조회 404, 수정, 오래된 version 409, 검색, 삭제, 삭제 후 목록, 로그아웃.
- 실제 운영 포털 주소: API enabled, 무인증 401, 브라우저 운영 배지/로그인/원본 보존 안내 확인.
- 연결된 ChatGPT MCP 검색 두 차례 성공. 운영 저장소를 조회하며 Preview OOTD는 노출하지 않는다.
- 런타임 stderr에는 Node/Vercel 경로의 DEP0169 url.parse 폐기 예정 경고가 관측됐다. 확인한 로그에 애플리케이션 예외는 없었다. 경고를 숨기는 설정은 추가하지 않았다.
- Supabase 보안 진단: 공개 프롬프트 RLS 누락 없음. 비공개 quota/audit 테이블은 의도한 deny-all 정책 상태(INFO). 기존 leaked-password 보호 비활성 경고는 그대로다: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 롤백

- 포털 이전 정상 배포 `dpl_JCpAeSJUG9rL72Ne2u6bPDgTiyFD`로 승격/운영 alias 복원 가능.
- MCP는 이전 Preview `dpl_8TSZASFn1zijgooUnGLzmxtwCVdk`로 안정 주소를 되돌릴 수 있으나 조회 저장소도 Preview로 바뀐다. 전환 전에 신규 운영 쓰기를 중단하고 사용자에게 범위를 알려야 한다.
- DB는 추가형 마이그레이션이다. 롤백 시 테이블/실제 사용자 데이터는 삭제하지 않고 API 비활성화/이전 배포 복원 후 보존한다.
- 신규 유료 리소스/요금제 변경 없음. 기존 무료 한도 내 사용량에 따라 추후 비용 여부를 판단한다.
