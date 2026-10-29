# home 내부 Preview 격리 구성안

상태: SQL·서버 코드 준비 및 로컬 검증 후, 명시적 승인에 따라 home의 테스트 스키마·계정·API와 Vercel Preview에 적용했습니다. 아래는 적용 전에 작성한 경계와 절차이며, 실제 결과는 [클라우드 검증 기록](cloud-preview-verification.md)에 있습니다. Production 배포는 하지 않았습니다.

적용 후보 SQL: [portal-prompts.sql](../../supabase/preview/portal-prompts.sql). 명시적 롤백: [rollback.sql](../../supabase/preview/rollback.sql). 일반 migrations 디렉터리 밖에 있어 기존 migration push에 포함되지 않습니다. `node scripts/build-prompts-preview.mjs`는 검토된 코어 SQL로부터 분리 SQL을 재생성하며 DB 연결은 하지 않습니다. 대상 스키마가 이미 있으면 덮어쓰지 않고 트랜잭션 전체를 거절합니다.

사용자는 2026-10-28 새 프로젝트 대신 home 하위 공간을 제안했습니다. DB에서는 폴더가 아니라 스키마를 사용합니다. 읽기 전용 확인 결과 home의 public에는 articles, collector_runs, collector_alert_state가 있고, 모두 RLS가 켜져 있습니다. prompt_preview 스키마의 테이블은 조회되지 않았습니다. 스키마 존재 자체와 함수 충돌 여부는 적용 전에 별도로 확인해야 합니다.

## 권장 변경 경계

- home의 기존 테이블·함수·정책은 수정하지 않습니다.
- 프롬프트 테스트 데이터와 RPC는 `prompt_preview`, 내부 감사·쿼터·테스트 사용자 허용 목록은 `prompt_preview_private`에 격리합니다. 내부 스키마는 API에 노출하지 않습니다.
- 코어 SQL의 public/portal_private 대상은 운영 후보로 유지합니다. Preview SQL은 이를 prompt_preview/prompt_preview_private로 옮기고 테스트 사용자 허용 목록을 추가합니다. 두 SQL을 home에 함께 적용하지 않습니다.
- 인증된 계정 중 명시적으로 허용한 테스트 사용자만 RPC와 RLS를 통과하게 합니다. 클라이언트가 수정 가능한 user_metadata로 허용 여부를 결정하지 않습니다. 테스트 계정 생성은 실제 home Auth 변경이므로 적용 범위에 포함합니다.
- 서비스 키 없이 publishable key와 사용자 JWT를 사용합니다. 별도 스키마 노출이 필요하면 Exposed schemas 목록을 보존하며 추가하고, authenticated에 필요한 최소 권한만 줍니다. anon과 PUBLIC 실행 권한은 허용하지 않습니다.
- 서버는 `PROMPTS_DB_SCHEMA=prompt_preview`에 따라 REST의 Accept-Profile/Content-Profile을 지정합니다. public과 prompt_preview만 허용하며, prompt_preview는 VERCEL=1 및 VERCEL_ENV=preview 또는 명시적인 loopback 테스트에서만 허용합니다. Production에서는 설정 오류로 API가 닫힙니다. 클라이언트 입력으로 임의 스키마를 선택할 수 없게 합니다. Auth 요청에는 이 헤더를 보내지 않습니다.
- Vercel Preview만 이 스키마에 연결합니다. Production 환경변수와 OAuth 설정은 변경하지 않습니다. 기존 disabled Preview는 새 배포가 만들어지기 전까지 로그인/CRUD 연동 환경이 아닙니다.

## 공유되는 부분과 비용

스키마는 별도 DB 또는 프로젝트가 아닙니다. auth.users와 인증 설정, DB CPU·디스크·연결·무료 한도를 공유합니다. 새 프로젝트 요금은 생기지 않지만 기존 프로젝트의 사용량에 합산되므로 비용이 항상 0이라고 보장하지 않습니다. Preview SQL 생성이나 테스트 때문에 요금제를 변경하지 않습니다. 사용량과 현재 요금 조건은 클라우드 적용 직전에 확인합니다.

## 적용 전 검증과 승인

1. 스키마 분리 SQL과 서버 프로필 선택을 구현하고 테스트 사용자/비허용 사용자/교차 사용자/운영 스키마 접근/멱등성/충돌/삭제 시나리오를 로컬에서 검증합니다.
2. home의 대상 이름 충돌, 기존 노출 스키마, Auth 제공자 설정과 advisor를 읽기 전용으로 확인합니다.
3. 정확한 SQL·테스트 계정 생성 범위·API 설정 변경·Preview 환경변수를 검토 가능한 형태로 제시합니다.
4. 원래 요구사항에 따라 운영 home DB 변경은 별도로 승인받은 후 실행합니다. 현재 제안은 그 실행 승인으로 간주하지 않습니다.
5. 적용 후 두 브라우저로 Preview 등록·검색·수정·충돌·삭제와 다른 계정 차단을 확인합니다.

## 승인 후 적용 순서

실행 순서는 SQL 생성·적용 → 테스트 계정 생성 및 허용 목록 등록 → 기존 Exposed schemas를 유지하면서 prompt_preview 추가 → PostgREST 설정/스키마 캐시 갱신 확인 → Preview 전용 환경변수 → Preview 배포 → 브라우저 검증입니다. 없는 스키마를 먼저 Exposed schemas에 추가하면 다른 REST 경로까지 스키마 캐시 로드에 실패할 수 있으므로 순서를 바꾸지 않습니다. private 스키마는 추가하지 않습니다. 로컬 검증에서 새 스키마의 설정 reload만으로 함수 캐시가 갱신되지 않아 별도의 schema reload가 필요했으므로, 실제 적용 후 함수 조회도 확인합니다.

허용 목록에는 실제 확인된 테스트 Auth 사용자 UUID만 관리자 SQL로 넣습니다. `prompt_preview_private.test_users(owner_id)`는 authenticated가 직접 읽거나 쓸 수 없습니다. 등록된 계정도 소유자가 다른 데이터는 읽거나 변경할 수 없으며, 목록에서 제거하면 기존 JWT가 유효해도 다음 SQL 요청부터 접근이 차단됩니다. SQL 자체는 계정을 자동 생성하거나 허용 목록을 seed하지 않습니다.

Preview 런타임 설정 후보:

```dotenv
PROMPTS_ENABLED=true
PROMPTS_DB_SCHEMA=prompt_preview
PROMPTS_SUPABASE_URL=https://kkcvglldsoxglfjqnsga.supabase.co
PROMPTS_SUPABASE_PUBLISHABLE_KEY=<home publishable key>
PROMPTS_OAUTH_ENABLED=false
```

위 값은 Preview에만 설정하며 VITE_ 접두사를 쓰지 않습니다. 키 값은 문서나 커밋에 넣지 않습니다. 테스트 계정은 별도 관리자 승인 범위에서 생성하고 비밀번호를 안전하게 보관하며 메일 발송·공개 가입·프로젝트 전체 인증 설정은 자동 변경하지 않습니다.

클라우드 읽기 전용 확인(2026-10-28): 대상 스키마 세 개(prompt_preview/prompt_preview_private/portal_private) 없음, Auth 사용자 수 0. exposed_schemas는 일반 SQL 세션의 current_setting에서 null이므로 실제 Dashboard/Management 설정은 적용 전에 별도로 읽어야 합니다. null을 기본 public 설정으로 추정하지 않습니다.

## 로컬 검증 결과

전체 테스트 81개 통과, lint/build 통과. PostgreSQL 엔진에서 기존 public 데이터 유지, 비허용 계정 차단, 메타데이터를 통한 허용 우회 차단, 직접 쓰기 차단, 허용 취소, 멱등성·충돌·tombstone과 명시적 롤백을 검증했습니다. 실제 로컬 Supabase Auth/PostgREST/PostgreSQL에서도 Preview 프로필로 10개 통합 시나리오가 통과했습니다. 결과는 `.cache/supabase-native/preview-results.json`에 있습니다. 클라우드 적용 결과는 아닙니다.

같은 Preview 스키마로 임시 Chrome 프로필 두 개의 브라우저 시나리오 7개도 통과했습니다. `.cache/supabase-native/browser-results.json`에 schema=prompt_preview로 기록했습니다. 이어 실제 로컬 DB에서 rollback.sql을 실행해 Preview 스키마 두 개만 제거되고 기존 public 프롬프트와 Auth 사용자 수가 유지됨을 확인했습니다. 증거는 `.cache/supabase-native/preview-rollback-results.json`입니다. 로컬 PostgREST의 exposed schemas도 public/graphql_public으로 복원했습니다.

롤백은 Preview 기능을 먼저 끄고 생성 객체 목록을 기준으로 테스트 데이터·함수·정책·스키마만 제거하는 방식으로 준비합니다. 기존 사용자나 스키마를 지우는 포괄적인 CASCADE 명령은 사용하지 않습니다. 테스트 계정은 세션을 먼저 폐기한 후 종속 데이터와 함께 개별 정리합니다. Exposed schemas와 Preview 환경변수는 기록한 이전 값으로 복원합니다.

공식 스키마 사용 방법: https://supabase.com/docs/guides/api/using-custom-schemas
