# OAuth 파일럿 준비 및 로컬 검증 — 2026-10-28

상태: 실제 로컬 OAuth 서버 검증 완료. 실제 ChatGPT Action 연결은 미완료입니다. 이번 작업에서 home OAuth 설정, Production, Vercel 보호 설정은 변경하지 않았습니다. 클라우드 Preview의 PROMPTS_OAUTH_ENABLED=false도 유지했습니다.

## 확인한 호환성 조건

OpenAI 공식 [Actions 인증 문서](https://developers.openai.com/api/docs/actions/authentication)는 사용자별 OAuth와 state 사용을 설명하지만 PKCE 지원을 명시하지 않습니다. 문서의 요청 예시만으로 지원 또는 미지원을 단정할 수 없습니다. 실제 GPT의 요청에 code_challenge/code_verifier가 포함되는지 확인해야 합니다. 현재 프록시의 S256 검사는 유지합니다.

공식 [Actions 운영 문서](https://developers.openai.com/api/docs/actions/production)는 임의 커스텀 헤더를 지원하지 않는다고 명시합니다. 따라서 브라우저 테스트에 사용한 Vercel 전용 OIDC 헤더를 GPT가 보낼 것으로 가정할 수 없습니다. 현재 Vercel Authentication으로 보호된 Preview는 그대로 GPT 연결 주소로 사용할 수 없습니다. 전체 프로젝트 보호를 해제하거나 인증 토큰을 OpenAPI에 넣는 방식으로 해결하지 않습니다.

Supabase의 [OAuth Server 시작 문서](https://supabase.com/docs/guides/auth/oauth-server/getting-started)에 따르면 기능 활성화·Authorization Path·OAuth client 등록이 필요하고, 승인 화면 주소는 프로젝트 Site URL과 결합됩니다. home의 설정 변경은 해당 프로젝트 전체에 적용됩니다. [OAuth 흐름 문서](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)에 따라 confidential client의 POST/Basic 인증과 PKCE를 로컬에서 검증했습니다.

## 실제 서버에서 발견하고 수정한 문제

기존 프록시는 authorization_id에 프롬프트 UUID 검사를 재사용했습니다. 실제 Supabase OAuth 서버는 UUID가 아닌 불투명 문자열 ID를 발급했고, 이 때문에 정상 details/consent 요청이 400이 됐습니다.

server/prompts/oauth.mjs에서 길이가 제한된 URL-safe opaque ID를 허용하도록 수정했습니다. 경로 구분자, URL 인코딩 삽입, 쿼리 삽입, 누락/과대 입력은 계속 거부합니다. 프롬프트 자체의 UUID 검증은 변경하지 않았습니다. tests/promptOAuth.test.js에 실제 형태 및 악성 입력 회귀 검사를 추가했습니다. 이 수정은 현재 개발 worktree에 있으며 아직 기존 클라우드 Preview에 재배포하지 않았습니다.

## 검증 결과

scripts/check-prompts-oauth-native.mjs는 전용 loopback Supabase Auth와 기존 포털 OAuth/API handler를 실제 HTTP로 연결합니다. Auth 응답이나 토큰 교환을 모의 처리하지 않습니다. 로컬 관리자 키는 로컬 테스트 사용자/client 생성에만 사용하고 코드·응답·로그에 실제 secret을 출력하지 않습니다. 유효한 네트워크 주소로 리다이렉트를 따라가지 않으며 portal.invalid/client.invalid는 콜백 검사용 주소입니다.

8개 통과:

1. Confidential client와 이메일 확인 완료 로컬 사용자 생성
2. PKCE/state 누락 거부
3. 실제 details 조회와 client/사용자 연결, 거절의 error/state 반환
4. 승인·코드 교환·JWT client_id와 사용자 일치, 코드 재사용 거부
5. OAuth bearer token으로 기존 프롬프트 API 등록·소유자 확인·삭제
6. refresh 후 동일 사용자 확인 및 client secret 응답 제외
7. 잘못된 verifier와 client secret 거부
8. HTTP Basic 방식의 코드 교환과 refresh

증거: .cache/supabase-native/oauth-results.json. 전체 회귀 테스트 82개와 lint/build도 통과했습니다. 이 결과는 실제 ChatGPT 클라이언트의 PKCE 지원을 증명하지 않습니다.

재실행 시 전용 .cache/supabase-native/supabase/config.toml에서만 OAuth를 활성화하고 Site URL=https://portal.invalid, authorization_url_path=/prompt-collection/index.html, dynamic registration=false로 시작합니다. 그런 다음 node scripts/check-prompts-oauth-native.mjs를 실행합니다. 기존 native-validation.md의 loopback 네트워크·프로젝트·포트를 유지하고, 테스트 후 이 로컬 설정을 원래 값으로 되돌리고 전용 스택만 중지합니다. 클라우드 config push는 사용하지 않습니다.

## 실제 ChatGPT 파일럿에 필요한 입력과 승인 범위

먼저 외부에서 접근할 수 있는 공개 HTTPS 테스트 주소를 결정해야 합니다. 기존 공개 테스트 도메인을 제공하거나, 프롬프트 전용 최소 파일만 포함하는 별도 Vercel 테스트 배포안을 검토할 수 있습니다. 새 유료 프로젝트나 도메인을 자동 생성하지 않습니다. 공개 주소에서도 사용자 인증, 테스트 사용자 허용 목록, RLS, quota는 유지하며 무인증 쓰기는 허용하지 않습니다. 기존 포털 Preview 보호는 유지합니다.

사용자는 이후 새 주소가 필요하다고 정정했고, 새 주소의 용도를 개인·비상업 테스트로 확인했습니다. 현재 Hobby 팀을 조회하고 최소 배포 묶음을 준비했습니다. 아직 새 프로젝트/주소를 생성하지 않았으며, [생성 후보·비용·승인 범위](pilot-deployment-plan.md)를 검토할 수 있습니다.

추가 승인 후 공개 개인 테스트 주소 https://cxr542-prompt-actions-test.vercel.app 를 생성하고 실제 앱을 Preview로 배포했습니다. [배포·검증 기록](public-pilot-verification.md)을 확인합니다. home OAuth나 실제 GPT 연결은 아직 변경하지 않았습니다.

주소와 실제 GPT ID/콜백이 확정되면 다음을 검토 가능한 값으로 정리한 뒤 home Auth 변경 승인을 받아야 합니다.

- home OAuth Server 활성화, dynamic registration=false 유지
- 기존 Site URL/Authorization Path의 정확한 이전 값과 적용할 새 값, 기존 서비스 영향
- 전용 confidential client의 정확한 GPT callback만 등록, 와일드카드 금지
- client secret은 ChatGPT 인증 설정의 비공개 필드에만 전달하고 OpenAPI/대화/저장소에 넣지 않음
- 테스트 배포에서만 OAuth 환경변수 활성화, 기존 Production 배포 제외
- 실제 GPT에서 로그인 시작 요청의 PKCE 필드 존재 확인 후 토큰 교환 진행
- 성공 시 사용자별 CRUD·거절·refresh·코드 재사용·유효기간·다른 계정 접근 차단 확인

PKCE가 전달되지 않으면 현재 프록시는 계속 거부해야 합니다. 보안 검사를 제거하거나 모든 사용자의 공용 키를 사용하는 방식으로 우회하지 않습니다. 이 경우 공급자/broker 변경은 별도 설계·검증 대상입니다.

이번에 연결 브라우저에서 ChatGPT GPT 편집기를 확인하려 했으나 DOM과 화면이 빈 상태였고 도움 요청이 시간 초과됐습니다. GPT 초안을 생성·저장·공개하지 않았고 GPT ID/실제 callback은 확보하지 못했습니다. 이후 사용자가 실제 편집기 화면을 열면 이 검증을 이어갈 수 있습니다.

## 롤백

파일럿 OAuth 환경변수를 먼저 비활성화합니다. 새 client의 grant/session을 폐기한 후 해당 client만 제거하고, 기록한 이전 Site URL/Authorization Path/OAuth 활성화 상태로 복원합니다. 공개 테스트 주소를 제거할 때는 테스트 데이터 백업을 남깁니다. 기존 프롬프트 데이터와 IndexedDB 원본은 삭제하지 않습니다.

## 후속 읽기 전용 확인 — 2026-10-28

공개 테스트 주소 생성 후 다시 연결 브라우저로 확인했습니다. home의 Site URL은 `http://localhost:3000`, Redirect URLs는 비어 있고 OAuth Server 스위치는 비활성입니다. 비활성 화면에서는 Authorization Path 값이 표시되지 않아 확인하지 못했습니다. 설정 저장이나 OAuth 활성화는 하지 않았습니다.

ChatGPT 홈은 로그인된 화면으로 표시됐지만 `/gpts/editor`는 로딩 완료 후 빈 화면이었습니다. 사용자 도움 요청 후 다시 열어도 동일해 GPT ID/콜백을 확보하지 못했습니다. 실제 GPT 편집기 접근이 해결되면 공개 OpenAPI를 가져와 정확한 콜백을 확인하고, home Auth의 이전/변경 값과 전용 client 범위를 확정한 뒤 승인받습니다.

## 계정 UI에서 확인한 연결 경로 변경

후속 확인에서 GPT 목록은 정상 표시됐지만 새 GPT 생성은 차단되고 플러그인 생성으로 안내됐습니다. 기존 GPT Action 경로의 다음 단계는 보류하고 [MCP 전환 검토](mcp-transition.md)에 실제 UI 증거와 변경 범위·검증 게이트를 기록했습니다. 사용자에게 연결 방식 선택을 요청했으며 아직 MCP 구현이나 home OAuth 변경은 하지 않았습니다.
