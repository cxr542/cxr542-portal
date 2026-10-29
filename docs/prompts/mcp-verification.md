# MCP 구현 및 로컬 검증 — 2026-10-28

상태: 로컬 구현/검증 후 별도 사용자 승인을 받아 home Auth/Hook과 개인 MCP Preview까지 적용했습니다. [현재 클라우드 상태와 남은 사용자 입력](mcp-cloud-verification.md)을 확인합니다. 실제 ChatGPT 연결·자연어 CRUD/필터 검증도 2026-10-29 완료했습니다. 아래 내용은 적용 전 설계와 로컬 검증 기록입니다.

## 구현

공식 @modelcontextprotocol/sdk 1.32.2를 정확히 고정했습니다. server/prompts/mcp.mjs와 api/prompt-mcp.mjs는 stateless Streamable HTTP JSON 응답을 제공합니다. 세션을 기기 메모리에 보관하지 않으며 GET 스트림/DELETE 세션 요청은 405입니다.

search_prompts/get_prompt/create_prompt/update_prompt/delete_prompt는 기존 createPromptsHandler를 호출합니다. 기존 사용자별 rate limit, 입력 검증, RPC/RLS 소유권 검사, request_id, version, tombstone 처리를 재사용합니다. source는 chatgpt로 고정하고 owner_id/source/legacy 외부 주입을 거부합니다. 상세 본문은 비신뢰 데이터로 취급하도록 도구 설명에 명시했습니다. 읽기/삭제 annotation과 OAuth securitySchemes 및 SDK 호환 _meta를 제공합니다.

요청 256KiB 제한과 전체 UTF-8 도구 응답 90KB 제한을 적용했습니다. Origin은 지정한 public origin 또는 https://chatgpt.com만 허용하며 서버 간 요청의 Origin 생략은 허용합니다. 토큰이나 프롬프트 본문은 로그에 남기지 않습니다. PROMPTS_MCP_ENABLED=false 또는 설정 누락이면 503입니다.

/.well-known/oauth-protected-resource/api/prompt-mcp는 canonical resource와 실제 Supabase issuer를 제공합니다. Vercel rewrite가 원래 URL을 바꾸는 경우도 테스트했습니다. MCP에서는 원래 Action OAuth proxy로 authorize/token을 우회시키지 않고 Supabase의 실제 discovery/issuer를 사용합니다. 기존 proxy의 details/consent와 승인 UI는 유지합니다.

## 인증 호환성에서 발견한 문제와 해결 후보

실제 로컬 Supabase Auth에 PKCE S256과 resource를 포함해 authorize/token을 호출했습니다. 기본 토큰은 aud=authenticated, scope=email profile이며 resource claim이 없었습니다. 서명이 유효해도 MCP는 이 일반 토큰을 401로 거부했습니다.

supabase/preview/mcp-resource-hook.sql은 적용 전 검토 후보입니다. 비공개 prompt_preview_private.mcp_oauth_resources에 명시적으로 활성화한 client_id→resource만 저장하고, SECURITY INVOKER/빈 search_path의 Auth hook이 해당 client 토큰에 서명될 resource를 추가합니다. aud와 기존 필수 claims는 바꾸지 않습니다. user_metadata를 권한 판단에 사용하지 않습니다. 다른 client와 비밀번호 로그인 event는 그대로 반환합니다. 매핑 테이블은 RLS를 적용하고 Auth admin에만 SELECT/함수 EXECUTE를 허용하며 anon/authenticated에는 접근을 주지 않습니다.

현재 파일럿은 하나의 client와 하나의 고정 resource만 사용합니다. 일반적인 다중 resource OAuth server 구현이나 token broker를 주장하지 않습니다. 다른 resource를 추가하려면 별도 검토해야 합니다. 기존에 발급된 토큰의 resource는 매핑 삭제만으로 즉시 사라지지 않으므로 중단 시 client/session 폐기와 MCP 비활성화를 먼저 수행합니다.

MCP는 Auth /user에서 토큰 서명과 사용자를 검증한 뒤 issuer/sub/client_id/exp/nbf, resource 또는 audience, email/profile scope를 검사합니다. DB 호출에서도 기존 Auth 검증과 RLS를 거칩니다. 서명 claim을 확인하지 않고 aud 검사를 생략하는 우회는 없습니다.

## 검증

- Vitest: 20개 파일, 99개 테스트 통과. 새 MCP 테스트는 실제 loopback HTTP와 공식 SDK 클라이언트를 사용합니다. 이 단위 테스트의 Auth/RPC는 명시적 mock이며 실제 OAuth 검증과 구분합니다.
- 실제 로컬 Auth/DB: scripts/check-prompts-mcp-native.mjs --with-hook의 6개 검증 묶음 통과. PKCE/서명된 resource, 일반 비밀번호 토큰 거부, hook 권한/user_metadata 위조 방어, 공식 SDK의 실제 DB 등록·조회·수정·409·삭제, refresh 시 binding 보존을 확인했습니다.
- 기본 Auth의 resource 미반영 및 401 거부 결과: .cache/supabase-native/mcp-results.json.
- hook 적용 후 결과: .cache/supabase-native/mcp-hook-results.json. 실제 ChatGPT 클라이언트의 성공 증거는 아닙니다.
- lint/build 통과, npm audit 0 vulnerabilities. 개인 Preview 묶음 38개 파일 검증 통과: 비밀 파일 제외, import 해석, 잘못된 환경/스키마에서 모든 API 차단.
- 테스트 사용자/client/client 매핑은 정리했습니다. 로컬 hook 함수/테이블은 rollback SQL로 제거했고 config.toml을 작업 전 값으로 복원했습니다. 전용 로컬 스택만 중지했습니다. 기존 브라우저 데이터는 읽거나 삭제하지 않았습니다.

## home 적용 전 확인 및 승인 범위

Dashboard를 읽기 전용으로 확인했습니다: 기존 Auth Hook 없음, OAuth Server 비활성. 앞서 확인한 Site URL은 http://localhost:3000, Redirect URLs 없음입니다. 비활성 화면에서 Authorization Path의 저장된 이전 값은 보이지 않으므로 실제 변경 전 기록해야 합니다.

별도 승인이 필요한 구체적인 후보:

1. home에 위 검토 SQL의 매핑 테이블과 함수/정책을 생성하고 Custom Access Token Hook을 연결.
2. OAuth Server를 false→true로 활성화, dynamic registration은 false 유지.
3. Site URL을 http://localhost:3000→https://cxr542-prompt-actions-test.vercel.app, Authorization Path를 /prompt-collection/index.html로 설정. 기본 이메일/로그인 리다이렉트에도 영향을 주는 프로젝트 전체 설정입니다.
4. 개인 파일럿용 confidential client 하나만 생성. 실제 MCP 관리 화면이 제공하는 정확한 callback만 등록하며, GPT의 /aip/g-ID callback이나 와일드카드를 추측하지 않음. 그 client만 고정 resource https://cxr542-prompt-actions-test.vercel.app/api/prompt-mcp에 매핑.
5. 기존 개인 테스트 프로젝트 Preview에만 MCP/client/origin/OAuth 환경변수 연결 및 배포. 기존 포털 Production·보호 설정과 회사 테이블·업무 저장소는 변경하지 않음.
6. 개인 플러그인으로 설치/검증하며 공개 디렉터리 출시는 하지 않음. 추가 유료 프로젝트나 도메인 구매 없음.

hook은 모든 토큰 발급 시 호출됩니다. 정상적인 비대상 event는 그대로 반환하지만 함수 오류는 다른 로그인에도 영향을 줄 수 있으므로 활성화 직후 일반 로그인·refresh 및 대상 OAuth를 모두 검증해야 합니다. 기존 hook이 새로 생겼다면 덮어쓰지 않고 중단해 병합 범위를 재검토합니다.

## 롤백

개인 Preview의 MCP/OAuth를 먼저 비활성화하고 전용 OAuth client/session을 폐기합니다. home의 Custom Access Token Hook을 원래 비활성 상태로 되돌린 다음 mcp-resource-hook-rollback.sql로 새 함수/테이블만 제거합니다. 기존 비공개 스키마와 프롬프트 데이터는 제거하지 않습니다. 기록한 Site URL/Authorization Path/OAuth 상태를 복구합니다. 이전 공개 테스트 Preview로 alias를 복구할 수 있습니다.

## 공식 문서

- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- https://supabase.com/docs/guides/auth/oauth-server/token-security
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
