# 개인·비상업 OAuth 테스트 주소 구성안 — 2026-10-28

상태: 사용자의 진행 승인 및 빈 초기 배포 별도 승인 후 실제 앱을 Preview로 배포했습니다. 공개 주소 https://cxr542-prompt-actions-test.vercel.app 에서 검증 20개를 완료했습니다. [최신 배포·검증 기록](public-pilot-verification.md)을 확인합니다. 아래는 생성 전에 작성한 범위와 첫 배포 문제 기록입니다.

## 생성 후보와 공개 범위

- 팀: cxr542-1843s-projects / team_Vp0kQleFtc5U7n4UQi8U7Ky9
- 새 프로젝트 이름 후보: cxr542-prompt-actions-pilot
- 고정 테스트 alias 후보: cxr542-prompt-actions-test.vercel.app. 아직 생성·예약하지 않았으므로 사용 가능 여부는 생성 전에 확인합니다.
- 배포 대상: 새 프로젝트의 Preview. 기존 cxr542-portal 프로젝트·Protection·Production 환경변수·주소를 변경하지 않습니다.
- 새 테스트 프로젝트의 페이지와 API 진입점은 인터넷에서 접근 가능하게 구성합니다. 프롬프트 API는 사용자 토큰·home의 테스트 계정 허용 목록·소유자 RLS를 그대로 요구합니다. 공개 무인증 쓰기는 제공하지 않습니다.
- 프롬프트 페이지와 기존 API·인증/OAuth proxy만 포함합니다. 다른 포털 앱, 회사 업무 파일, .cache 자격 증명, .omo 기록, SQL·운영 도구는 포함하지 않습니다.

## 비용 확인

Vercel MCP의 팀 응답에는 요금제가 없어, 기존 CLI 인증으로 /v2/teams/{id}를 읽기 전용 조회했습니다. billing.plan=hobby, billing.status=active였습니다. 접근 가능한 팀 목록에는 이 팀 하나만 있었습니다. 비공개 원문은 .cache/prompt-cloud/team-billing.json에 있고 요금제 필드만 확인했습니다.

사용자가 확인한 개인·비상업 용도는 [Hobby 플랜의 사용 범위](https://vercel.com/docs/plans/hobby)에 해당합니다. 도메인을 구매하거나 Pro 전환·트라이얼·유료 add-on을 활성화하지 않습니다. 기본 vercel.app 주소를 사용하며 팀의 무료 사용 한도에 합산됩니다. 한도에 도달하면 테스트를 중지하고 자동 유료 전환을 하지 않습니다. 향후 회사 업무용으로 바뀌면 이 판단을 재검토해야 합니다. 참고로 [Pro 기본료](https://vercel.com/docs/plans/pro-plan)는 현재 월 $20에 1 deploying seat·$20 사용 credit을 포함하며 세금·초과 사용료는 별도입니다.

## 검토 가능한 배포 묶음

```sh
npm run build
node scripts/build-prompts-pilot.mjs
node scripts/check-prompts-pilot.mjs
```

생성 위치는 .cache/prompt-actions-pilot이며 Git와 원래 포털 배포에서 제외됩니다. 파일 36개로 프롬프트 화면·폰트·공용 셸·4개 API wrapper·서버 모듈·최소 package/config를 포함합니다. manifest.json에 파일 목록이 있습니다. 비밀키와 실제 계정 비밀번호는 넣지 않았습니다. 기존 본문·기능을 복제하되 이 묶음의 포털 홈 링크만 기존 포털 주소로 연결합니다. 원래 public/ 파일은 수정하지 않습니다.

새 API wrapper에는 Preview + VERCEL=1 + PROMPTS_DB_SCHEMA=prompt_preview를 모두 요구하는 추가 guard를 넣었습니다. Production 또는 public 스키마로 오설정하면 503으로 닫힙니다. 4개 wrapper에 대해 세 가지 오설정 조합을 검사했고, 정상 Preview 구성에서 disabled config 응답도 확인했습니다. import 파일 존재·다른 앱 제외·라우팅 제한 검사와 lint가 통과했습니다. 실제 Vercel 빌드 성공을 의미하지 않으며 생성 승인 후 실제 배포로 확인해야 합니다.

OpenAPI에는 실제 공개 주소가 확정되기 전까지 pilot-origin-required.invalid를 넣습니다. 배포와 alias가 확정되면 같은 origin으로 servers/authorizationUrl/tokenUrl을 함께 바꿔 재배포합니다. GPT에 미확정 스키마를 넣거나 실제 연결 완료로 표시하지 않습니다.

## 생성 승인 후 실행 순서

1. 프로젝트 이름·alias 충돌 여부를 읽기 전용 확인하고 새 프로젝트를 생성합니다. Git 자동 배포 연결과 유료 옵션은 추가하지 않습니다.
2. 새 프로젝트만 공개 연동용으로 구성합니다. 기존 포털 Preview의 Vercel Authentication을 해제하지 않습니다.
3. home publishable key와 prompt_preview 프로필을 새 프로젝트의 Preview에만 설정합니다. service-role key는 넣지 않습니다. 초기 OAuth는 false입니다.
4. 로컬 묶음을 Preview로 배포하고 별도 테스트 alias를 연결합니다. Production target을 사용하지 않습니다.
5. 익명 API 401, 테스트 계정 로그인·RLS·검색·등록·삭제·이관, 원래 포털 회귀를 실제 공개 주소에서 확인합니다. 새 origin의 IndexedDB는 별개이며 기존 브라우저 원본을 자동 읽거나 옮기지 않습니다.
6. 확정 주소의 OpenAPI와 실제 GPT callback을 준비합니다. home OAuth Server 활성화·Site URL/Authorization Path 변경·전용 OAuth client 등록은 별도 구체적 승인 후 진행합니다.

## 이번에 승인할 범위와 제외 범위

이번 생성 승인은 새 개인 테스트 Vercel 프로젝트, 그 프로젝트의 공개 Preview, 별도 vercel.app 테스트 alias, 테스트 DB에 연결할 Preview 환경변수에 한정했습니다.

이 범위는 이후 승인되어 프로젝트와 Preview 변수 생성까지 진행했습니다. 기존 포털 프로젝트의 로컬 .vercel 연결이 유지되고 업로드 파일 35개(약 375KB)에 프롬프트 전용 파일만 포함됨을 dry-run으로 확인했습니다.

유료 전환·도메인 구매·새 Supabase 프로젝트·기존 포털 보호 해제·Production 배포·home Auth 설정 변경·GPT 공개는 포함하지 않습니다. home Auth 변경 승인은 실제 공개 origin과 GPT callback이 정해진 후 정확한 이전/이후 값으로 요청합니다.

## 롤백

새 alias와 테스트 배포를 비활성화한 후 새 프로젝트만 정리합니다. 기존 포털 프로젝트와 home 프롬프트 스키마는 제거하지 않습니다. 테스트로 작성한 프롬프트를 정리할 때도 먼저 백업하고 tombstone을 유지해 오래된 원본이 되살아나지 않도록 합니다.

## 첫 배포 분류 문제와 다음 승인 범위

명시적으로 --environment preview를 전달했지만 설치된 CLI 65.2.0은 새 프로젝트의 첫 배포 dpl_J67c7wQ79iSVU5cdcoAJCMo8Dgbh를 target=production으로 만들고 새 프로젝트의 기본 alias에 연결했습니다. 원래 포털의 Production은 변경하지 않았습니다. 추가 pilot-only guard가 실제 요청에서 503/pilot_not_configured를 반환했고 Production 환경변수에는 DB 설정을 넣지 않았으므로 이 배포는 DB에 연결되지 않았습니다.

대상 분류를 확인한 즉시 위 배포 ID 하나를 제거했습니다. 제거 로그는 .cache/prompt-cloud/pilot-rollback.log에 있습니다. 기존 프로젝트의 배포나 전체 프로젝트 삭제 명령은 사용하지 않았습니다.

[Vercel 공개 이슈 #17069](https://github.com/vercel/vercel/issues/17069)에는 CLI뿐 아니라 명시적인 staging REST 요청도 첫 배포에서 Production으로 분류되는 사례가 보고되어 있습니다. 같은 부작용을 반복하지 않기 위해 실제 앱의 재배포는 보류했습니다.

별도 승인을 요청한 대안은 새 테스트 프로젝트에만 연결정보가 없는 빈 초기 Production 배포를 1회 만든 뒤, 실제 앱을 Preview로 배포하는 것입니다. 빈 묶음은 .cache/prompt-pilot-bootstrap에 있고 DB 라이브러리·환경변수 접근·계정정보 없이 안내 HTML과 항상 503을 반환하는 API만 포함합니다. 로컬에서 503을 검증했습니다. 이 초기 배포도 Production이라는 분류를 갖기 때문에 이전 Preview 전용 승인으로 간주하지 않고 명시적 승인을 요청했습니다. 기존 포털 Production, home OAuth, 유료 옵션은 변경 범위에 포함하지 않습니다.
