# 클라우드 Preview 검증 — 2026-10-28

## 1. 현재 상태

사용자가 home DB·계정·API 변경을 명시적으로 승인한 후 테스트 환경을 적용했습니다. 기존 업무 테이블은 변경하지 않았고 Production 배포·Production 환경변수는 변경하지 않았습니다. 커밋·푸시·PR도 하지 않았습니다.

Preview: https://cxr542-portal-8isbp2fcd-cxr542-1843s-projects.vercel.app/prompt-collection/index.html

배포 ID: dpl_Abx7HnoLZeqgwGXh7CqymQ6Cf3Zq. Vercel project: cxr542-portal / prj_99WcsURX5Ws8FvWSTDp6uriQK6UQ. Preview 배포 READY 및 설정 API enabled=true를 확인했습니다. 이전 disabled Preview URL은 새 배포로 바뀌지 않으므로 위 주소를 사용합니다. Vercel Authentication 보호는 유지합니다.

실제 Vercel Functions → Supabase Auth → PostgREST → PostgreSQL 경로에서 API·브라우저 15개와 추가 RLS·이관 5개, 합계 20개 시나리오가 통과했습니다. 로컬 회귀 테스트 19개 파일/81개, lint/build, git diff --check도 통과했습니다. 브라우저는 서로 다른 임시 Chrome 프로필 두 개입니다. 모바일 viewport 확인을 실제 iPhone Safari 검사로 간주하지 않습니다.

## 2. 발견된 문제

- Vercel 프로젝트에는 Git repository 연결이 없어 브랜치별 Preview 환경변수 설정을 거부했습니다. Preview 환경에만 5개 변수를 저장했고 Production target은 지정하지 않았습니다.
- 설치된 Vercel CLI의 env run은 검증 스크립트를 배포 파일로 해석해 실행하지 못했습니다. Development 변수가 0개임을 decrypt=false 메타데이터로 확인한 후, 단기 프로젝트 OIDC만 발급받아 origin에 제한한 브라우저 헤더로 검증했습니다. 발급 파일에는 VERCEL_OIDC_TOKEN 하나만 있음을 확인했고 검증 후 파일을 제거했습니다. 보호 우회용 영구 secret이나 공개 share link는 만들지 않았습니다.
- Supabase advisor에 유출 비밀번호 보호 비활성 WARN이 있습니다. 프로젝트 전체 Auth 설정과 요금제는 변경하지 않았습니다. 테스트 계정은 충분히 긴 무작위 비밀번호를 사용합니다. 운영 인증을 활성화하기 전에 [공식 비밀번호 보안 설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)을 검토해야 합니다.
- 내부 테이블 3개의 RLS Enabled No Policy INFO는 authenticated/anon의 직접 접근을 의도적으로 막은 설계입니다. 기존 public.articles의 동일 INFO는 이번 작업 전에도 있었습니다. [advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 3. 적용 아키텍처

기존 React/Vite 및 IndexedDB 원본은 유지합니다. 서버는 Preview에서 prompt_preview 프로필로만 데이터 API를 호출하고 Supabase Auth로 요청마다 사용자를 확인합니다. 기존 프론트엔드의 캐시·초안·명시적 이관 동작을 재사용합니다. ChatGPT OAuth는 비활성입니다.

## 4. 적용 파일과 설정

- 검토된 supabase/preview/portal-prompts.sql을 home에 migration 이름 portal_prompt_preview_isolation으로 적용했습니다.
- 서버 프로필 제한: server/prompts/http.mjs. 기본 public이며 prompt_preview는 Preview 또는 명시적 로컬 테스트에서만 허용합니다.
- .vercelignore를 추가해 .cache, .omo, .env 파일과 로컬 빌드·설정이 소스 업로드에 포함되지 않도록 했습니다. 실제 배포 dry-run에서 제외를 확인했습니다.
- Preview 전용 PROMPTS_ENABLED=true, PROMPTS_DB_SCHEMA=prompt_preview, home URL과 publishable key, PROMPTS_OAUTH_ENABLED=false를 저장했습니다. service-role/secret key는 배포 환경이나 브라우저에 넣지 않았습니다.

## 5. DB 상태

home 프로젝트 kkcvglldsoxglfjqnsga의 prompt_preview와 prompt_preview_private만 추가했습니다. Data API 노출은 기존 public/graphql_public을 유지하며 prompt_preview만 추가했습니다. private 스키마, customer_auth/running/support는 추가 노출하지 않았습니다. 기존 extra search path, max rows, 자동 테이블 노출 토글은 변경하지 않았습니다.

테스트 Auth 사용자 2개를 Dashboard의 Create new user로 생성·확인했고 허용 목록에 2개를 등록했습니다. 초대/확인 메일은 발송하지 않았습니다. 공개 가입, OAuth Server, 인증 공급자 설정은 변경하지 않았습니다.

검증 종료 시 Preview의 살아 있는 항목은 OOTD fixture 1개, 삭제 이력은 3개입니다. 모두 테스트 스키마의 테스트 계정 소유입니다. 테스트 스키마 테이블·인덱스는 약 272KiB, 전체 DB는 약 23.6MiB입니다. 실시간 카운터/백그라운드 작업에 따라 값은 변할 수 있습니다.

## 6. API 검증

실제 Preview에서 목록·검색·상세·등록·수정·삭제, 멱등 재시도, 동시 트랜잭션의 200/409, 삭제된 요청의 410, 로그인·refresh·logout을 확인했습니다. 브라우저 A 등록→B 조회, B 수정→A 충돌·초안 보존, 최신 본문 재조회, 삭제 전파를 확인했습니다.

추가로 기존 migration 모듈을 실제 클라우드 API에 연결해 원본 JSON의 unknown 필드와 본문 보존, 재실행 동일 ID, 삭제 후 변경된 원본의 재이관 차단을 확인했습니다. 실제 사용자 브라우저의 원본 IndexedDB/localStorage는 조작하지 않았습니다.

## 7. 인증 및 보안

위조·누락 토큰 401, 다른 사용자 데이터 조회·변경 404, owner 주입 400을 확인했습니다. 직접 PostgREST에서는 본인 행만 보이고 다른 계정은 빈 결과를 받으며, 직접 테이블 쓰기는 403입니다. RLS는 켜져 있고 authenticated의 INSERT/UPDATE/DELETE 및 anon SELECT 권한이 없음을 SQL로 확인했습니다. API 함수의 anon EXECUTE도 허용하지 않습니다.

private 스키마를 REST로 요청하면 PGRST106/406으로 거절됩니다. 테스트 계정으로 기존 articles/collector_runs/collector_alert_state를 읽을 수 없는 것도 실제 REST에서 확인했습니다. 업무 테이블의 정책을 변경하지 않았습니다.

테스트 계정 비밀번호는 .cache/prompt-cloud/accounts.json의 로컬 0600 파일에만 보관했습니다. 토큰은 출력하지 않았고 단기 OIDC 및 API 세션 파일은 검증 후 제거했습니다. 증거 JSON/스크린샷도 .cache에 있으며 배포·Git에서 제외합니다. 본인 확인 또는 테스트 계정 인계 없이 이 파일을 외부에 공유하지 않습니다.

## 8. 비용

새 프로젝트, 유료 브랜치, 요금제 업그레이드는 만들지 않았습니다. 기존 home의 DB·Auth 무료 한도와 Vercel 계정의 빌드/함수 사용량에 합산됩니다. 이번 저장량과 테스트 사용자 수는 작지만 기존 사용량과 요금 조건을 포함한 청구액 0을 보장하는 의미는 아닙니다.

## 9. 리스크 및 롤백

테스트 스키마도 운영 home의 Auth·CPU·디스크·연결을 공유합니다. Preview를 끄려면 Preview의 PROMPTS_ENABLED=false로 새 Preview를 배포하고 테스트 데이터 백업을 먼저 확보합니다. 완전 제거가 필요할 때만 검토된 supabase/preview/rollback.sql로 생성 객체만 제거합니다. public 업무 테이블이나 브라우저 원본은 삭제하지 않습니다.

Data API 노출을 기존 public/graphql_public으로 복원할 때는 다른 사용자가 나중에 추가한 스키마가 없는지 먼저 확인합니다. 테스트 계정 제거 시 세션 폐기 및 종속 테스트 데이터 정리를 먼저 수행합니다. 이번 작업에서는 재검토를 위해 계정과 테스트 데이터·tombstone을 유지했습니다.

## 10. 다음 단계

ChatGPT Actions OAuth/PKCE/refresh 호환성 파일럿과 실제 자연어 등록·검색·수정은 아직 수행하지 않았습니다. 이는 프로젝트 전체 OAuth/Auth 설정 변경을 포함할 수 있으므로 별도로 범위를 정해야 합니다. Production 데이터 모델 적용과 Production 배포는 기존 요구사항에 따라 별도 승인 대상입니다.

클라우드 증거: .cache/prompt-cloud/results.json(15개), extra-results.json(5개), cloud-mobile-list.png. 테스트 스크립트와 임시 브라우저 프로필은 운영 제품 기능이 아니며, 프로필은 종료 후 제거했습니다.
