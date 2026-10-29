# 개인 공개 테스트 주소 검증 — 2026-10-28

## 현재 상태

공개 테스트 주소: https://cxr542-prompt-actions-test.vercel.app/prompt-collection/index.html

OpenAPI: https://cxr542-prompt-actions-test.vercel.app/prompt-collection/openapi.json

사용자가 개인·비상업 용도와 새 테스트 프로젝트 생성을 승인한 범위로 적용했습니다. 프롬프트 사용자 인증은 필수이며 공개 무인증 쓰기는 없습니다. 실제 ChatGPT Action 연결은 아직 하지 않았고 PROMPTS_OAUTH_ENABLED=false입니다.

코드는 계속 cxr542-workspace/cxr542-portal 저장소에서 파생한 feat/prompt-centralization worktree에 있습니다. 새로운 Git 저장소나 별도 회사 업무 저장소로 옮기지 않았습니다. Vercel 프로젝트만 연동용 배포 단위로 추가했습니다. 커밋·푸시·PR은 하지 않았습니다.

## 배포와 라우팅

- 팀: cxr542-1843s-projects / team_Vp0kQleFtc5U7n4UQi8U7Ky9
- 새 프로젝트: cxr542-prompt-actions-pilot / prj_CHsmOwXJGP0ub6RQfYcQrQqzB3lg
- 실제 앱 배포: dpl_2uZNcsxqcs9uaQWxfBK4CAXZM41G, READY, target=staging(Preview)
- 실제 앱 고유 주소: https://cxr542-prompt-actions-pilot-py3ang3i7-cxr542-1843s-projects.vercel.app
- 고정 테스트 alias: cxr542-prompt-actions-test.vercel.app → 위 Preview 배포
- 승인된 빈 초기 배포: dpl_2p347e81jvLFrbUkBuqq2wDDimtY, READY, target=production. 새 테스트 프로젝트에 한 번만 적용했으며 DB·비밀정보 없이 안내 화면과 비활성 API만 포함합니다.

기존 cxr542-portal 프로젝트의 마지막 Preview는 dpl_Abx7HnoLZeqgwGXh7CqymQ6Cf3Zq 그대로이고 Vercel Authentication도 enabled=true/all_except_custom_domains 그대로임을 API로 확인했습니다. 원래 worktree의 .vercel/project.json 연결도 기존 portal ID로 유지됩니다. 기존 포털 Production·Protection·환경변수는 변경하지 않았습니다.

## 발견한 배포 문제와 처리

처음 CLI에 --environment preview를 지정했으나 새 프로젝트의 첫 배포가 Production으로 분류됐습니다. 잘못 분류된 dpl_J67c7wQ79iSVU5cdcoAJCMo8Dgbh는 API guard가 503을 반환함을 확인하고 제거했습니다. 배포와 자동 생성 alias 모두 삭제 후 404를 확인했습니다.

사용자에게 별도 승인을 받아 새 테스트 프로젝트에만 빈 초기 Production 배포를 만들었습니다. catch-all 파일은 일반 /api 경로에 자동 매핑되지 않아 안내 HTML로 fallback되는 문제를 발견했습니다. 추가 Production 배포 없이 새 프로젝트의 라우팅 규칙으로 두 빈 초기 배포 호스트의 ^/api(?:/.*)?$ 요청만 503으로 처리했습니다. 실제 요청에서 두 주소의 /api/prompts가 503임을 확인했습니다. 실제 앱 고유 Preview 주소와 고정 테스트 alias는 이 규칙에서 제외됩니다.

규칙 ID: 7716fce7-24ef-4b7f-beb3-28897f484d7e. live 라우팅 버전: 814a3793-147d-4eb4-b7f3-02d5440406b0. 기본 테스트 프로젝트 주소와 빈 초기 배포의 고유 주소에만 host 조건을 적용합니다. 기존 포털 프로젝트에는 라우팅 규칙을 추가하지 않았습니다.

이후 실제 앱은 REST 배포 API의 명시적 target=staging으로 생성했고, 반환 target과 런타임의 정상 config 응답을 확인했습니다. 유료 Custom Environment나 기본 포털의 보호 해제를 우회책으로 사용하지 않았습니다.

## 포함 파일과 환경

실제 소스 업로드는 프롬프트 화면·폰트·공용 셸·4개 API wrapper·서버 모듈·최소 설정 등 35개 파일, 약 375KB입니다. .cache 자격 증명, .omo 기록, 다른 포털 앱, DB SQL과 업무 파일은 업로드하지 않았습니다. Vercel 소스 공개도 비활성입니다.

새 프로젝트의 Preview에만 PROMPTS_ENABLED=true, PROMPTS_DB_SCHEMA=prompt_preview, home URL/publishable key, PROMPTS_OAUTH_ENABLED=false를 설정했습니다. Production에는 DB/인증 키를 설정하지 않았습니다. 실제 앱 wrapper는 Preview + VERCEL=1 + prompt_preview 조건이 아니면 503으로 닫힙니다.

OpenAPI의 서버와 OAuth authorize/token URL은 모두 고정 테스트 origin으로 맞췄습니다. 기존 포털용 OpenAPI 원본은 바꾸지 않고 별도 배포 묶음만 변환했습니다. 로컬 재생성:

```sh
npm run build
PROMPTS_PILOT_ORIGIN=https://cxr542-prompt-actions-test.vercel.app node scripts/build-prompts-pilot.mjs
node scripts/check-prompts-pilot.mjs
```

이 명령은 배포하지 않습니다. 배포 파일 목록과 import 해석, Production/public 스키마 오설정 시 차단, 원래 project linkage 유지 검사를 통과했습니다. 최신 lint 및 git diff --check도 통과했습니다.

## 실제 공개 주소 검증

Vercel OIDC·보호 우회 헤더·공유 링크 없이 검증했습니다. 공개 UI·OpenAPI·config는 200이고 인증 없는 프롬프트 GET/POST는 JSON 401입니다. OAuth authorize는 비활성 503을 반환합니다.

15개 API/브라우저 시나리오와 추가 보안·이관 5개, 합계 20개가 통과했습니다.

- 테스트 계정 두 개 로그인, 위조/누락 토큰 거절, 검색·등록·멱등 재시도
- 다른 소유자 데이터 조회·변경·삭제 거절과 owner 주입 거절
- 동시 수정의 200/409, 삭제 후 재실행 410
- 기존 보호된 Preview에서 저장한 OOTD의 같은 ID·본문을 새 공개 주소에서 조회
- 서로 다른 임시 Chrome 프로필 두 개의 등록→조회, 수정→충돌·초안 보존, 새로고침, 삭제 전파와 계정 분리
- 모바일 viewport의 목록 표시와 가로 넘침 확인
- refresh와 logout 후 갱신 세션 폐기
- 직접 PostgREST의 소유권 RLS와 직접 쓰기 403, private 스키마 비노출
- 테스트 계정의 기존 articles/collector_runs/collector_alert_state 읽기 차단
- 실제 클라우드 이관의 원본 JSON·unknown 필드 보존, 멱등 재실행과 삭제 후 오래된 원본 차단

실제 iPhone Safari 테스트 또는 실제 ChatGPT OAuth 로그인 성공을 의미하지 않습니다. 새 origin의 브라우저 저장소는 독립적이며 기존 사용자 브라우저의 IndexedDB/localStorage를 변경하거나 자동 업로드하지 않았습니다. 테스트 쓰기는 기존 home의 격리된 prompt_preview에만 수행했습니다.

증거: .cache/prompt-public-pilot/results.json(15개), extra-results.json(5개), cloud-mobile-list.png. 임시 브라우저 프로필은 종료 후 제거했고 테스트 API 세션 파일도 제거했습니다. 테스트 계정 정보는 기존 .cache/prompt-cloud/accounts.json(0600)에만 보관합니다.

## 비용·롤백·남은 단계

Hobby 요금제의 개인·비상업 테스트로 진행했습니다. 요금제 업그레이드, 도메인 구매, Pro trial, 유료 add-on, 새 Supabase 프로젝트는 만들지 않았습니다. 빌드·함수·DB 요청은 기존 무료 한도에 합산됩니다.

실제 앱을 중지할 때는 새 테스트 alias를 먼저 해제하고 해당 Preview만 정리합니다. 빈 초기 배포와 그 호스트 한정 라우팅 규칙은 별도로 기록했으므로 새 테스트 프로젝트 정리 시 함께 제거할 수 있습니다. 기존 포털과 home 스키마는 이 롤백에서 제거하지 않습니다. 생성 데이터 정리 전에는 백업하고 tombstone을 보존합니다.

다음은 실제 GPT ID/정확한 callback을 확보하고, 확정된 공개 origin을 기준으로 home OAuth Server·Site URL/Authorization Path·전용 confidential client 변경 범위를 검토하는 것입니다. 이 프로젝트 생성 승인이나 빈 초기 배포 승인에는 home Auth 변경과 GPT 공개가 포함되지 않습니다. 실제 GPT의 PKCE 지원은 여전히 미확인입니다.
