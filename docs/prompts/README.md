# 프롬프트 중앙 저장소


> 현재: 앱 이름은 **프롬프트 저장소**이며 포털 사용자 `portal-owner@cxr542.invalid`로 연결됐다. 포털과 MCP가 같은 레코드 ID를 반환하는 것을 확인했다. [정식 소스 및 배포 방법](portal-unification.md)을 기준으로 작업한다. 아래 초기 파일럿 단계는 이력이다.

> 현재 상태 (2026-10-29): 운영 DB와 포털·ChatGPT MCP Production 반영 완료. 배포 ID, 검증 및 롤백은 [운영 반영 기록](production-release.md)을 참고하세요. 아래 파일럿 기록은 당시 이력입니다.

현재 ChatGPT 연결은 사용자 승인에 따라 MCP 플러그인으로 전환했습니다. [MCP 구현·로컬 검증·home 적용 승인 범위](mcp-verification.md)를 먼저 확인합니다. 기존 GPT Action 설명은 이전 설계 기록이며 현재 계정에서 새 GPT 생성은 불가능했습니다.


## 상태와 승인 경계

구현은 개발 브랜치에 있습니다. 명시적 승인 후 home에 격리된 Preview 스키마와 테스트 계정 2개를 적용해 클라우드 검증을 완료했습니다. 기존 업무 테이블·Production 배포·Production 환경변수는 변경하지 않았습니다. 실제 ChatGPT 연결은 아직 하지 않았습니다. 기본값은 중앙 저장소/OAuth 모두 비활성이며, 현재 Preview에서만 중앙 저장소를 활성화했습니다. [실제 적용 및 검증 기록](cloud-preview-verification.md)을 확인합니다.

개인·비상업 연동용 공개 테스트 주소도 별도 승인 후 생성했습니다: https://cxr542-prompt-actions-test.vercel.app/prompt-collection/index.html . 새 테스트 프로젝트에 한정한 빈 초기 Production 배포 1회는 별도 승인했고, 실제 앱은 Preview에서만 동작합니다. 기존 포털 Production과 보호 설정은 유지했습니다. [공개 테스트 주소 검증](public-pilot-verification.md)에 배포 ID·라우팅 규칙·검증 결과가 있습니다. OAuth는 아직 비활성입니다.

기존 `prompt-collection` v1 / `prompts`와 localStorage `prompt-collection-prompts`를 읽기 전용 원본으로 유지합니다. 새 캐시/초안 DB는 `prompt-collection-central` v1입니다. 원본 전체 삭제, 자동 이관, 자동 seed, 자동 양방향 병합은 하지 않습니다.

## 서버 설정

`.env.prompts.example`의 이름을 참고해 개발 셸에 export하거나 Vercel Preview 환경에 설정합니다. Vite는 이 서버용 값을 자동으로 `.env`에서 로드하지 않으므로 셸 환경으로 전달합니다. 어떤 값에도 `VITE_` 접두사를 붙이지 않습니다.

- `PROMPTS_ENABLED=true`
- `PROMPTS_SUPABASE_URL`: 승인된 home 프로젝트 URL
- `PROMPTS_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_` 키만 사용. service-role/secret/legacy JWT key 금지
- `PROMPTS_DB_SCHEMA`: 기본 public. home 내부 격리 테스트는 prompt_preview로 고정하며 Vercel Preview 또는 명시적 로컬 테스트만 허용합니다. [적용 후보 SQL과 승인 범위](home-preview-plan.md)를 먼저 확인합니다. Production에서는 prompt_preview 설정을 거부합니다.

인증은 Supabase Auth의 기존 등록·이메일 확인 완료 계정과 비밀번호 로그인입니다. 공개 회원가입 API는 제공하지 않습니다. 최초 사용자는 운영 승인 후 Dashboard에서 생성/초대하고 비밀번호·이메일 확인을 완료합니다. Auth 설정 변경은 기존 home 서비스에 미치는 영향을 확인한 후 별도로 수행합니다.

브라우저의 access/refresh token은 sessionStorage에만 저장됩니다. 서버는 요청마다 Auth `/user`로 사용자를 검증하고 익명·미확인 계정을 거절합니다. 갱신 토큰으로 세션을 갱신하며 로그아웃은 현재 세션을 폐기합니다. JWT는 만료 전 유효할 수 있으므로 짧은 만료 시간 및 외부 OAuth grant 취소를 운영 절차에 포함합니다. 다른 포털 모듈과 같은 origin이므로 전체 origin의 XSS 방어도 필요합니다.

## SQL 적용 및 검증

`supabase/migrations/*_portal_prompts.sql`은 추가 테이블·함수만 생성합니다. 기존 articles/collector 테이블은 변경하지 않습니다. 자동 CI DB push는 없습니다.

- `portal_prompts`: 원본 데이터, 소유자, version, tombstone, 최초 요청 hash/id와 legacy 원본 JSON
- `portal_private.prompt_limits`: 계정·scope별 분 단위 카운터, 계정당 읽기/쓰기 및 API 읽기/쓰기 4개 고정 scope
- `portal_private.prompt_audit`: 본문/토큰 없는 변경 이력. 사용자 다음 쓰기 때 90일 이전 이력을 정리

원본 생성 시각은 `legacy.createdAt` 등에 그대로 보관하고 중앙 `created_at`은 서버 등록 시각입니다. request_id 원장과 tombstone은 이관 재실행 방지를 위해 유지합니다.

직접 테이블 쓰기는 authenticated에도 허용하지 않습니다. public RPC는 SECURITY INVOKER이며, private SECURITY DEFINER 쓰기 함수에서 `auth.uid()` 소유권·입력·version을 검증합니다. API quota RPC를 별도 트랜잭션으로 먼저 확정하므로 후속 실패 요청도 API 제한에 합산됩니다. 함수 search_path는 비어 있고 PUBLIC/anon EXECUTE를 회수했습니다. 공개 조회 RPC는 RLS를 따릅니다. Data API의 private schema 노출은 금지합니다. Supabase Data API에 public 함수/테이블이 노출되는지도 확인해야 합니다.

실제 PostgreSQL 엔진(PGlite) 테스트는 RLS 역할 전환, 익명 접근 거절, 소유권 변경 거절, 멱등성, 충돌, tombstone, 감사 로그와 요청 제한을 실행합니다. Supabase의 실제 Auth/PostgREST 경로는 Preview용 격리 DB에서 추가 검증해야 합니다. Docker가 없어도 `npm test`로 로컬 SQL 검증이 가능합니다.

## API 동작

OpenAPI: `/prompt-collection/openapi.json`.

- 목록은 본문을 제외한 요약을 반환합니다. 본문 전체는 상세 조회합니다. 브라우저 목록 캐시와 백업은 include_content=true로 본문을 포함합니다. 이관 미리보기와 서버 백업은 include_deleted=true로 본인 tombstone과 원본 request_id/legacy도 보존합니다. Action 스키마에는 이 백업 파라미터를 노출하지 않습니다.
- 검색은 한글·영문 부분 문자열로 제목/본문/설명/태그를 검색합니다. category 일치, tags 전체 일치, favorite 조건을 지원합니다.
- 정렬은 `(updated_at DESC, id DESC)` 커서입니다. 조회 중 변경이 있으면 새로고침으로 목록을 다시 구성합니다.
- PATCH와 DELETE는 본문 `version` 필수. 충돌은 409입니다.
- POST는 UUID `request_id` 필수. 같은 요청 재시도는 같은 항목을 반환하고 다른 본문 재사용은 409입니다. 삭제된 요청 재실행은 410입니다.
- 요청 JSON 최대 256KiB, 제목 300자, 본문 40,000자, 설명 2,000자, 태그 20개/각 60자. UTF-8 바이트 제한이 먼저 적용될 수 있습니다.
- 읽기 RPC는 계정당 분당 240회, 쓰기는 60회입니다. 429에 Retry-After: 60을 반환합니다. 직접 Data API SELECT는 소유권 RLS를 따르지만 이 API의 요청 제한을 경유하지 않습니다. 외부 비인증 트래픽은 운영 시 Vercel WAF/IP 제한을 별도 설정해야 합니다.
- 로그인/토큰 교환의 제한은 Supabase Auth 제한에 의존합니다. Vercel의 공유 송신 IP 특성을 고려해 운영 전 로그인 시도를 실제 확인합니다.
- 로그는 요청 ID·메서드·상태만, DB 감사는 소유자·항목 ID·작업·version·시각만 기록합니다.

## 원본 이관

1. 기존에 사용하던 도메인·브라우저마다 `원본 백업`을 내려받습니다. IndexedDB와 localStorage를 모두 읽고 각각의 원본 및 알 수 없는 필드를 보존합니다.
2. 로그인 후 `기존 데이터 가져오기` 또는 JSON 파일을 선택합니다.
3. 신규·동일·동명 충돌·잘못된 형식을 확인합니다. 동명 충돌은 기본 미선택입니다.
4. 원본 백업을 보관했음을 체크하고 선택 항목을 업로드합니다. 기존 서버 항목을 덮어쓰지 않습니다.
5. 업로드 후 상세 재조회로 핵심 필드가 같은지 검증합니다. 실패 항목만 같은 request_id로 재시도합니다. 현재 항목 후 중지/닫기도 가능하며, 미처리 선택은 유지됩니다. 삭제된 원본 ID 또는 같은 내용이 tombstone과 일치하면 기본 미선택으로 복구를 막습니다.
6. 다른 기기·다른 도메인의 원본은 백업 파일을 같은 계정으로 가져옵니다. 원본이 동일하면 해시 기반 request_id도 같습니다.

파일 최대 20MB. 지원 형식은 기존 `{version:1,prompts:[...]}`, 호환 `ideas`, 새 로컬 원본 백업 및 중앙 백업입니다. unknown 필드·기존 시각은 legacy JSON과 원본 파일에 남습니다. 이관 완료 결과는 화면에서 확인하고 서버 백업으로 보관합니다. 서버 원장은 재실행 후에도 유지됩니다.

자동 캐시 업로드는 없습니다. 서버 연결이 끊기면 마지막 전체 목록 캐시를 표시하고 편집 내용은 초안으로 남깁니다. 필터 결과를 캐시 전체 목록으로 오인하지 않도록 오프라인 표기와 캐시의 전체/일부 여부를 확인합니다. 추가로 읽은 페이지도 보관하고 본문 열기/복사가 가능합니다. 탭에서 이전에 검증한 프로필은 오프라인 캐시 소유자를 고르는 용도로만 사용하며 서버 인증을 대체하지 않습니다. 계정별 초안은 다른 계정 화면에 나오지 않습니다. 로그인 전 기기 초안은 명시적으로 열어 서버 저장할 수 있습니다. IndexedDB 사용 불가 시 서버 저장은 계속 시도할 수 있고, 서버도 실패하면 본문 복사 안내를 제공합니다.

## 로컬 개발·검증

`npm ci`, `npm test`, `npm run lint`, `npm run build`. `npm run dev`와 `npm run preview` 모두 프롬프트 API 미들웨어를 실행합니다. 다른 Wiki API 프록시는 그대로입니다. API는 Supabase 환경을 지정하지 않으면 503으로 닫힙니다. 운영 키를 테스트에 넣지 마세요.

브라우저 회귀에는 등록/수정/삭제/복사/검색/카테고리/태그/즐겨찾기/로그아웃/초안/이관/오류/동시 수정과 맥북·아이폰 간 조회를 포함합니다. OOTD는 `tests/fixtures/ootd.json`에만 있으며 운영 자동 삽입은 없습니다.

## 배포와 롤백

Production workflow는 수동 실행 + `environment: production`으로 변경했습니다. GitHub Environment에 required reviewer가 실제 설정되어야 승인 대기가 강제됩니다. Vercel Git Integration의 별도 자동 Production 배포 여부도 확인 후 차단해야 합니다. main merge 자체를 운영 배포 승인으로 취급하지 마세요.

Preview에는 운영 사용자 데이터가 없는 별도 격리 DB 또는 테스트 전용 환경만 연결합니다. 새 유료 프로젝트는 생성하지 않습니다. 운영 home SQL 적용·Auth 변경·환경변수 변경·Production 배포는 별도 승인 후 진행합니다.

롤백: PROMPTS_ENABLED=false → 새 쓰기 차단 → 서버 최신 JSON 백업 → 이전 프론트 배포로 복귀. 중앙 테이블/tombstone을 DROP하거나 기존 IndexedDB를 지우지 않습니다. 서버 신규 데이터가 원본 브라우저에 자동 복제되는 것은 아니므로 프론트 롤백만으로 데이터를 되돌릴 수 없습니다.

## 비용

소규모 텍스트 저장을 가정하면 기존 home 재사용으로 별도 DB 프로젝트 비용을 피할 수 있습니다. 1,000개 × 평균 10KB는 원문 약 10MB, 인덱스/원장 포함 20~40MB 추가를 추정합니다. 감사 로그·백업·긴 본문·조회량에 따라 늘어납니다. 기존 요금제 및 전체 home 사용량은 운영 전 확인합니다. Supabase Free: DB 500MB, 월 MAU 50,000, egress 5GB, API 요청 수 무제한. Vercel Hobby: 개인 비상업 용도만 가능하므로 회사 업무 서비스에 무료 사용을 가정하지 않습니다.

공식 참고: https://supabase.com/pricing · https://vercel.com/docs/plans/hobby

최신 클라우드 적용 상태: [개인 MCP 클라우드 파일럿](mcp-cloud-verification.md). home Auth·Hook과 Preview 적용 후 실제 ChatGPT OAuth·자연어 CRUD/필터 검증까지 완료했습니다. [사용 방법](using-chatgpt-pilot.md).
