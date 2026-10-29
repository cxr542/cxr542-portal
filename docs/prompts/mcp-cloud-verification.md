# 개인 MCP 클라우드 파일럿 — 2026-10-28

상태: 개인 Preview에서 실제 ChatGPT OAuth 연결과 자연어 검색·등록·수정·필터·삭제 검증을 완료했습니다(2026-10-29). [사용 방법](using-chatgpt-pilot.md)을 확인합니다. 아래 대기/오류 기록은 완료 전의 이력이며 마지막 완료 항목이 최신 상태입니다.

## 적용한 리소스

- home: kkcvglldsoxglfjqnsga, migration prompt_preview_mcp_resource_hook 적용.
- 비공개 prompt_preview_private.mcp_oauth_resources 및 mcp_access_token_hook 생성. RLS와 제한된 grants 적용.
- Dashboard에서 Custom Access Token Hook을 Postgres 함수 prompt_preview_private.mcp_access_token_hook으로 활성화. 기존 Hook은 없었습니다.
- Site URL: http://localhost:3000 → https://cxr542-prompt-actions-test.vercel.app.
- OAuth Server: false → true. Authorization Path: /oauth/consent → /prompt-collection/index.html. 동적 OAuth 등록은 false 유지.
- 전용 client: a0d3a495-0a47-400e-b7fd-10bfd3089926, 이름 Prompt collection personal MCP pilot, confidential / client_secret_basic.
- ChatGPT 새 MCP 관리 화면에서 제공한 실제 callback: https://chatgpt.com/connector/oauth/8ou4Pa8h8uNM. 이 주소만 client에 등록했습니다. 새 생성 화면을 닫고 다시 만들면 callback이 달라질 수 있으므로 일치 여부를 다시 확인해야 합니다.
- 이 client 하나만 고정 resource https://cxr542-prompt-actions-test.vercel.app/api/prompt-mcp에 활성 매핑.

## 개인 Vercel Preview

프로젝트 prj_CHsmOwXJGP0ub6RQfYcQrQqzB3lg / cxr542-prompt-actions-pilot만 변경했습니다.

1. 메타데이터 확인용 Preview dpl_HZ4NMcatBzGJZrrk8kF2ecPwbmvs. client 등록 전 pending-registration-no-client로 데이터 접근 차단.
2. 전용 client 연결 후 현재 Preview dpl_8TSZASFn1zijgooUnGLzmxtwCVdk, READY, target=null(Preview).
3. 현재 고유 주소: https://cxr542-prompt-actions-pilot-i09d49z66-cxr542-1843s-projects.vercel.app.
4. 고정 개인 테스트 주소: https://cxr542-prompt-actions-test.vercel.app/prompt-collection/index.html.
5. MCP: https://cxr542-prompt-actions-test.vercel.app/api/prompt-mcp.
6. Metadata: https://cxr542-prompt-actions-test.vercel.app/.well-known/oauth-protected-resource/api/prompt-mcp.

PROMPTS_PUBLIC_ORIGIN, MCP_ENABLED=true, 전용 OAUTH_CLIENT_ID, 정확한 OAUTH_REDIRECT_URIS, OAUTH_ENABLED=true는 Preview에만 설정했습니다. client secret은 Vercel이나 저장소에 넣지 않았습니다. 기존 root .vercel 연결은 변경하지 않았습니다.

## 실제 클라우드 검증

Hook 활성화 직후와 Site URL/OAuth 변경 후, 기존 두 테스트 계정의 비밀번호 로그인과 refresh가 모두 정상이며 resource claim이 추가되지 않았음을 확인했습니다.

공개 Preview + 실제 home Auth 검증 7개 통과:

1. Canonical protected-resource metadata 200.
2. 무인증·위조 토큰 MCP 호출 401 및 resource_metadata challenge.
3. 악성 Origin 403.
4. 서명이 유효한 일반 비밀번호 로그인 토큰도 MCP에서 401.
5. 실제 client의 S256/resource authorize가 승인된 공개 origin의 /prompt-collection/index.html로 이동.
6. 동의 details가 정확한 client와 등록 callback에 연결됨.
7. 동의 거절은 access_denied와 기존 state를 정확한 callback으로 반환. 실제 ChatGPT callback을 따라가지는 않았습니다.

클라우드에서 client OAuth 토큰을 교환하거나 이 토큰으로 MCP 도구를 호출한 성공 증거는 아직 없습니다. 이 부분은 로컬의 실제 Auth/SDK/DB 검증과 구분합니다.

Supabase SQL로 anon의 매핑 SELECT, authenticated의 INSERT 및 Hook EXECUTE가 모두 false임을 확인했습니다. Advisor의 새 보안 오류는 없고 기존의 INFO 4개(의도한 내부 deny-all 포함) 및 leaked password protection 비활성 WARN은 유지됩니다. 요금제나 전역 비밀번호 정책은 변경하지 않았습니다.

기존 포털 prj_99WcsURX5Ws8FvWSTDp6uriQK6UQ의 최신 배포는 dpl_Abx7HnoLZeqgwGXh7CqymQ6Cf3Zq로 유지되고 SSO all_except_custom_domains 보호도 그대로입니다. 새 테스트 프로젝트의 승인된 빈 초기 Production 두 host는 /api/prompts에 계속 503을 반환합니다. 추가 Production 배포는 하지 않았습니다.

증거는 .cache/prompt-mcp-cloud의 login-results.json, boundary-results.json, deployment-client.json, auth-before.json입니다. 비밀키/토큰은 결과 파일에 남기지 않았습니다.

## 사용자 입력 대기

Supabase Dashboard에서 새 client를 생성한 뒤 secret 화면을 자동 추출하지 않았습니다. 브라우저 스킬의 자격증명 읽기 금지에 따라 사용자에게 ChatGPT 고급 OAuth 설정으로 직접 옮겨 달라고 도움을 요청했지만 시간 초과됐습니다. ChatGPT에는 public client ID와 client_secret_basic 선택 및 자동 discovery된 OAuth 설정까지 준비했습니다. 해당 사용자 입력을 기다리는 브라우저 작업은 진행 중입니다.

ChatGPT 새 MCP 생성 화면 및 Supabase client 탭을 유지합니다. 사용자가 secret 입력을 마쳤다고 알려주면 callback 일치와 scope를 확인한 후 개인 플러그인을 생성하고 OAuth 로그인 및 도구 호출을 검증합니다. 공개 디렉터리 출시는 하지 않습니다.

자동 승인 검토는 Site URL 변경 이전의 OAuth 저장 시도를 차단했습니다. 저장되지 않았고, 승인된 Site URL을 먼저 저장·재확인한 후 OAuth 설정을 다시 적용해 정상 완료했습니다. 남아 있는 승인 차단은 없습니다.

## 롤백

현재 단계 중단 시 Preview MCP/OAuth를 비활성화하고 alias를 이전 dpl_2uZNcsxqcs9uaQWxfBK4CAXZM41G로 되돌립니다. 전용 client/grant/session만 폐기하고 home Custom Access Token Hook을 비활성화한 뒤 mcp-resource-hook-rollback.sql의 새 함수/테이블만 제거합니다. 기록한 Site URL=http://localhost:3000, Authorization Path=/oauth/consent, OAuth=false로 복구합니다. 기존 프롬프트 데이터, 업무 테이블 및 IndexedDB는 제거하지 않습니다.

## 후속 연결 시도 — 2026-10-29

사용자가 client secret 입력 완료와 기존 callback 일치를 확인했습니다. 사용자 ChatGPT 탭을 허가된 tabBorrow로 가져와 secret 값을 읽지 않고 public client ID/callback/client_secret_basic 및 email/profile 선택만 확인했습니다. 개인 플러그인 생성 요청과 연결 버튼을 실행했고 실제 OAuth 로그인 화면으로 이동했습니다.

home OAuth authorization 기록에서 실제 ChatGPT 요청 scope=openid email offline_access profile, PKCE=s256, pending 상태를 확인했습니다. 이는 실제 ChatGPT의 PKCE 사용 증거이며 토큰 교환이나 MCP 도구 호출 성공 증거는 아닙니다. 현재 OAuth 로그인/사용자 동의를 기다립니다. 브라우저 도움 요청은 시간 초과돼 사용자 탭을 원래 창으로 반환했습니다. 비밀번호/secret/토큰은 읽지 않았습니다.

로그인 정보는 기존 .cache/prompt-cloud/accounts.json 첫 번째 테스트 계정을 사용합니다. 사용자가 로그인하고 ‘연결 허용’을 누른 뒤 실제 ChatGPT로 돌아오면 연결 결과와 읽기 도구부터 검증합니다. 아직 설치 완료·연결 완료·자연어 CRUD 성공으로 보고하지 않습니다. 새 플러그인 중복 생성은 하지 않습니다.

## Login completed; renewed OAuth consent — 2026-10-29

사용자가 테스트 계정 로그인 완료를 알렸습니다. 실제 브라우저에서도 로그인 상태와 서버 조회 완료를 확인했습니다. 이전 ChatGPT authorization은 expired여서 재사용하지 않았습니다.

기존 개인 플러그인 https://chatgpt.com/plugins/plugin_asdk_app_6ae290c031748191bbb429b4094365c2 를 발견했습니다. ‘내 클라우드 플러그인’, 앱 1개 및 ‘앱 연결 계속’ 상태였으며 중복 생성하지 않았습니다. 해당 버튼으로 새 요청을 시작하자 로그인 상태가 유지된 채 정확한 client/callback의 연결 승인 화면이 표시됐습니다. 사용자의 마지막 ‘연결 허용’을 기다립니다. 아직 OAuth 토큰 교환이나 도구 사용 성공으로 보고하지 않습니다.

## Consent approved; token exchange rejected — 2026-10-29

새 authorization은 사용자 동의 후 approved가 됐고 ChatGPT로 돌아왔습니다. 이후 플러그인 화면에 사용 가능한 도구가 없고 다시 연결을 제안하는 것을 확인했습니다. auth.sessions에서 해당 oauth_client_id의 세션 수는 0입니다.

Supabase unified Auth logs의 2026-10-29T00:37:01Z 기록은 error_code=invalid_credentials, error="400: invalid client credentials"입니다. 따라서 실제 토큰 교환이 client 인증에서 거부됐습니다. 코드/Hook/MCP 오류로 추정해 수정하지 않았습니다. 비밀값은 읽지 않았습니다. 토큰 교환 시 보낸 시크릿의 출처를 사용자에게 확인 요청했습니다. 기존 client/token 인증 방식은 confidential/client_secret_basic이며, 이전 생성 화면에서 public client ID와 callback 일치는 확인했습니다.

실제 개인 플러그인은 https://chatgpt.com/plugins/plugin_asdk_app_6ae290c031748191bbb429b4094365c2 에 존재하며 버전 1.0.0, 앱 ID asdk_app_6ae290c031748191bbb429b4094365c2, DEVELOPMENT 상태입니다. 이는 생성/설치 상태의 증거이고 인증·도구 호출 성공 증거는 아닙니다. 중복 플러그인을 생성하거나 기존 플러그인을 삭제하지 않았습니다.

이후 연결 버튼으로 시작한 추가 요청은 새 브라우저 탭에 로그인 세션이 없어 로그인 화면에 도착한 상태입니다. 사용자 자격증명 확인 전 추가 로그인·동의 재시도는 하지 않습니다. 기존의 로그인된 사용자 탭은 이미 원래 창으로 반환했습니다. 서버 설정·DB·Production은 이번 진단에서 변경하지 않았습니다.

## Client secret source confirmed; replacement decision pending — 2026-10-29

사용자는 시크릿을 Supabase OAuth Apps의 개인 MCP 앱에서 복사했다고 확인했습니다. 서버에서 기존 client의 ID/redirect/confidential/client_secret_basic를 재조회했으며 등록값이 유지됐습니다. 사용자 시크릿 값은 조회하지 않았습니다. ChatGPT 플러그인 상세·추가 작업·앱 관리 화면을 확인했지만 기존 시크릿 수정 항목은 표시되지 않았습니다. OAuth가 성공하지 않은 기존 플러그인을 중복 생성하거나 임의 삭제하지 않았습니다.

검토 가능한 다음 방안은 실패한 개인 플러그인만 삭제·교체하고, 같은 전용 Supabase client의 secret을 재발급한 뒤 새 생성 화면에서 제공하는 정확한 callback으로 갱신하는 것입니다. 기존 프롬프트 DB/API와 포털 Production을 보존합니다. 기존 플러그인 삭제는 이전 승인 범위에 명시되지 않아 별도 승인을 요청했습니다. 아직 삭제·시크릿 재발급·callback 변경은 하지 않았습니다. 이 단계에서 잘못된 입력이 원인이라고 단정하지 않으며, 원격 Auth의 invalid client credentials 응답만 확인된 사실로 유지합니다.

## Approved replacement started — 2026-10-29

사용자가 실패한 개인 테스트 플러그인 교체, 동일 Supabase client의 secret 재발급, 새 callback 갱신을 명시적으로 승인했습니다. 그 승인에 따라 기존 plugin_asdk_app_6ae290c031748191bbb429b4094365c2의 ‘플러그인 삭제’ 확인을 실행했습니다. 프롬프트 DB, API, 기존 포털 Production은 삭제 대상이 아닙니다. 이하 교체 결과를 추가 기록합니다.

## Replacement preparation — 2026-10-29

기존 실패 플러그인이 ChatGPT 설치 목록에서 제거된 것을 확인했습니다. 새 MCP 생성 화면을 같은 서버 URL로 준비했고, 제공된 callback은 기존 https://chatgpt.com/connector/oauth/8ou4Pa8h8uNM 과 동일했습니다. client ID/client_secret_basic 및 email/profile 설정을 입력했습니다. callback이 같으므로 관련 DB/Vercel 설정을 변경하지 않았습니다.

승인된 동일 client의 Dashboard ‘Regenerate client secret’ → 해당 client명 확인 → Confirm을 실행했습니다. 새 시크릿 화면은 자동 추출하지 않았으며 사용자에게 새 값을 ChatGPT의 비공개 필드로 직접 옮기도록 도움 요청을 띄웠습니다. 기존 시크릿은 더 이상 사용하지 않아야 합니다. 새 생성 요청은 이 입력 이후에만 진행합니다. 프롬프트 데이터/API/기존 포털 Production은 그대로입니다.

## Replacement OAuth and natural-language search/create/update succeeded — 2026-10-29

새 개인 플러그인은 https://chatgpt.com/plugins/plugin_asdk_app_6ae2996e36ac8191b9e5ae6113d2bb00 입니다. 사용자 입력 후 재발급 시크릿으로 생성했습니다. 최초의 새 flow를 다른 탭으로 옮겼을 때는 토큰 세션이 생기지 않았습니다. 로그인된 한 탭 안에서 연결을 새로 시작해 콜백까지 완료하자 해당 client의 실제 Auth 세션 수가 1이 됐고 ChatGPT 앱 상세에 Read2/Write3 도구 5개가 모두 표시됐습니다. 탭 간 state 이동은 피해야 합니다. 시크릿 값은 읽거나 저장하지 않았습니다.

실제 ChatGPT 대화 https://chatgpt.com/c/6ae29ade-86d4-83ec-9e52-42beab2e634d 에서 다음을 확인했습니다.

- ‘OOTD 프롬프트 찾아줘’ → 원래 fixture 39fa9cb4-1bf6-43ec-bdd5-617e1cadefdc, 이미지 생성, 즐겨찾기 true를 조회.
- ‘임시 항목을 저장해줘’ → MCP 연결 검증 2026-10-29, id=3ffd9899-fb58-45ae-8820-e0f02968260a, version=1 저장.
- ‘방금 저장한 임시 프롬프트만 수정해줘’ → 최신 version 조회 후 본문 변경 및 favorite=true, version=2.
- SQL로 실제 DB owner_id=기존 owner 테스트 계정, source=chatgpt, 수정 본문 일치/즐겨찾기 true를 교차 검증했습니다. 기존 OOTD는 version=1, updated_at=2026-10-28T02:20:04Z로 그대로 유지됐습니다.

임시 항목만 삭제하는 마지막 자연어 검증을 진행합니다. 실제 운영 public 프롬프트 테이블은 사용하지 않았습니다.

## Completed: real ChatGPT personal MCP integration — 2026-10-29

현재 상태는 **개인 Preview에서 실제 ChatGPT 연결 및 자연어 검증 완료**입니다. 앞의 대기/오류 항목은 이 완료 전의 이력입니다.

현재 개인 플러그인: https://chatgpt.com/plugins/plugin_asdk_app_6ae2996e36ac8191b9e5ae6113d2bb00
실제 검증 대화: https://chatgpt.com/c/6ae29ade-86d4-83ec-9e52-42beab2e634d

최종 자연어 요청 ‘즐겨찾기한 이미지 생성 프롬프트만 보여줘’는 OOTD 1개만 반환했습니다. 이어 지정한 임시 ID만 최신 version=2로 삭제하고 삭제 후 version=3을 반환했습니다. SQL로 deleted_at=2026-10-29T01:06:21Z, version=3을 확인했습니다. OOTD는 여전히 version=1, updated_at=2026-10-28T02:20:04Z, deleted_at=null로 변경되지 않았습니다. 임시 데이터를 하드 삭제하거나 기존 브라우저 데이터를 초기화하지 않았습니다.

검증된 실제 흐름은 ChatGPT OAuth S256 → 사용자 로그인/동의 → client secret 교환 → resource-bound 토큰으로 MCP 도구 목록 5개 조회 → 자연어 검색 → create → 최신 버전 get/update → category/favorite 필터 → get/delete입니다. Auth 세션 생성, 실제 DB source/owner/content/version/tombstone을 교차 확인했습니다. 시크릿을 재발급하고 새 플러그인에 직접 입력한 뒤 같은 탭에서 연결을 시작·완료하자 성공했습니다. 다른 탭으로 진행 중 OAuth URL을 옮기는 방식은 사용하지 않습니다.

사용자가 재발급 시크릿을 직접 비공개 필드에 입력했고 agent는 시크릿/토큰/비밀번호를 브라우저에서 읽거나 로그에 저장하지 않았습니다. 성공 화면은 .cache/prompt-mcp-cloud/chatgpt-natural-language-results.json에 테스트 대화 내용만 저장했습니다. 빌린 사용자 탭은 성공한 대화 상태로 원래 창에 반환하고 브라우저 제어 세션을 종료했습니다.

남은 검증 경계: 실제 ChatGPT의 토큰 만료 후 자동 refresh와 별도 사용자 ChatGPT 계정 연결은 이번 자연어 시나리오에서 수행하지 않았습니다. 실제 로컬 OAuth refresh 및 클라우드 API의 두 사용자 격리/일반 로그인 refresh는 이전 검증과 구분합니다. Codex CLI REST 호출 방법은 기존 문서에 있지만 이번에 Codex CLI OAuth client를 새로 생성하거나 CLI 연결 성공을 주장하지 않습니다. 기존 포털 Production 반영·public 운영 DB 마이그레이션·Git 커밋/PR/푸시는 하지 않았습니다.
