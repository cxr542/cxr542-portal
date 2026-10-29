# ChatGPT 연결 경로 변경 검토 — 2026-10-28

현재 ChatGPT 연결은 사용자 승인에 따라 MCP 플러그인으로 전환했습니다. [MCP 구현·로컬 검증·home 적용 승인 범위](mcp-verification.md)를 먼저 확인합니다. 기존 GPT Action 설명은 이전 설계 기록이며 현재 계정에서 새 GPT 생성은 불가능했습니다.


## 실제 계정에서 확인한 상태

로그인된 ChatGPT의 /gpts 목록은 정상 표시됐습니다. ‘만들기’를 누르면 ‘대신 플러그인을 만드세요 / 이제는 GPT를 만들 수 없습니다. 이제 맞춤형 도구는 플러그인에서 제공됩니다.’ 모달이 표시됐습니다. 목록에는 ‘GPT는 12월 11일에 종료됩니다’ 안내도 있었습니다. 이는 이 계정에서 직접 확인한 UI 상태이며 전체 계정의 제공 상태를 일반화하지 않습니다.

‘플러그인 만들기’는 Plugin Creator가 선택된 새 Work 작성기로 이동했습니다. 메시지는 전송하지 않았습니다. GPT 초안, OAuth client, 새 플러그인은 생성하지 않았고 home 설정 및 배포는 변경하지 않았습니다. 실제 GPT callback은 확보되지 않았습니다.

## 권장 변경 범위

기존 REST API, 중앙 DB, IndexedDB와 포털 UI는 유지합니다. ChatGPT 연결용 MCP adapter를 별도로 추가하고 같은 인증·입력 검증·사용자 권한·version·idempotency·tombstone 로직을 재사용합니다. 기존 OpenAPI와 CLI REST 호출은 계속 보존합니다.

후보 파일:

- api/prompt-mcp.mjs: Streamable HTTP MCP 진입점
- server/prompts/mcp.mjs: initialize, tools/list, tools/call와 REST handler adapter
- server/prompts/oauth.mjs 및 http.mjs: MCP OAuth discovery/resource/audience 검증에 필요한 최소 확장
- api 및 public의 well-known metadata 경로, vercel.json의 명시적 rewrite
- scripts/build-prompts-pilot.mjs 및 check-prompts-pilot.mjs: 격리된 Preview bundle에 MCP 포함
- tests/promptMcp.test.js 및 OAuth 테스트: 프로토콜·권한·입력·동시성 회귀
- docs/prompts/chatgpt-and-cli.md: 실제 MCP 연결 절차와 CLI 재사용

도구 후보는 search_prompts, get_prompt, create_prompt, update_prompt, delete_prompt입니다. 검색·조회는 readOnlyHint, 삭제는 destructiveHint를 올바르게 표시합니다. 주석은 권한 검사를 대신하지 않습니다. 모든 데이터 호출은 서버에서 인증하고 소유자를 검증합니다. 본문은 비신뢰 데이터로 취급합니다.

## OAuth 호환성 검증

OpenAI 공식 문서는 MCP에서 authorization code + PKCE S256과 정적 client credentials를 지원한다고 설명합니다. 기존 Action의 미확인 PKCE 가정을 그대로 이어가지 않습니다. 실제 클라이언트 요청도 검증해야 합니다.

MCP protected-resource metadata, authorization-server discovery, WWW-Authenticate challenge, 정확한 resource와 토큰 audience/scope 검사가 필요합니다. 현재 REST용 OAuth proxy는 resource 매개변수를 허용하지 않으므로 그대로 연결하면 안 됩니다. Supabase가 발급하는 토큰의 resource/audience 처리와 MCP 요구사항의 호환성을 로컬에서 먼저 확인합니다. resource를 무시하거나 aud 검사를 제거해 통과시키지 않습니다. 호환되지 않으면 검증된 OAuth 공급자 또는 token broker 설계를 별도로 검토합니다.

동적 client 등록은 기본 비활성을 유지하고, 가능하면 이 개인 파일럿만의 사전 등록 client와 실제 관리 화면의 정확한 callback을 사용합니다. callback은 GPT의 /aip/g-ID 형식을 추측하지 않습니다. 비밀정보는 OpenAPI·대화·Git·브라우저 번들에 넣지 않습니다.

## 검증 및 승인 순서

1. 사용자의 연결 방식 선택: MCP 플러그인 전환 또는 기존 GPT 확인.
2. MCP adapter와 metadata 구현 및 로컬 프로토콜/OAuth 호환성 검증.
3. 기존 REST 회귀, 무인증·다른 사용자·잘못된 audience/scope·잘못된 Origin·과대 요청·재사용 코드·충돌·삭제 재업로드 테스트.
4. 기존 개인 테스트 프로젝트의 Preview에만 배포, 보호된 기존 포털과 Production은 유지.
5. 실제 관리 화면에서 callback과 client 설정을 확정한 뒤 home Auth 변경값을 제시해 별도 승인.
6. 개인 플러그인 연결 후 자연어 검색·등록·수정·삭제 확인, 타 사용자 격리 및 만료/갱신 검증.

현재 home은 Site URL=http://localhost:3000, Redirect URLs 없음, OAuth Server 비활성입니다. 이 문서는 설정 변경 승인이나 연결 완료의 증거가 아닙니다. 유료 전환이나 새 DB 프로젝트는 계획하지 않습니다.

## 공식 근거

- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
