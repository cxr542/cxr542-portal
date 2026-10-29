# cxr542 포털

업무 외 개발 서비스(vision-font, today-shoes, 마라톤 기록장, 아이디어 뱅크, AI-Synapse Wiki, GeminiTuner)를 한곳에서 관리하는 개인 포털입니다.

## Portal Role

`cxr542-ai-portal`은 개인 프로젝트 포털입니다.

> **워크스페이스:** 이 repo(`cxr542-portal`)만 clone·열어도 됩니다.  
> 교육팀 TMS(업무)는 별도 repo [`edu-team-tms`](https://github.com/cxr542/edu-team-tms) — 집(윈도우)에서는 포털, 회사(맥)에서는 TMS.

## Project Status Board

홈 화면은 프로젝트를 `Active Projects`, `Experiments`, `Paused`, `Ideas`로 분류합니다.

## Running Ops

러닝 동호회 운영진 전용 MVP는 [src-running-ops/README.md](src-running-ops/README.md) 에서 확인합니다.

## Project Card Metadata

각 프로젝트 카드는 상태, 한 줄 설명, 다음 할 일을 표시합니다.

## 환경

| 환경 | URL | 용도 |
|------|-----|------|
| 개발 | `http://localhost:5173` | 기능 개발/디버깅 |
| 검증 | PR Preview URL | 리뷰/검증 |
| 운영 | Vercel production URL | 실제 사용 |

## 로컬 실행

```bash
npm install
npm run dev
```

터미널에 나온 **Local URL** 로 접속하세요 (기본 `http://localhost:5173`).

- AI-Synapse Wiki 모듈: `http://localhost:5173/?m=ai-synapse-wiki`
- Wiki만 직접: `http://localhost:5173/ai-synapse-wiki/`

5173·5174가 이미 쓰이면 Vite가 5175 등 다른 포트를 씁니다 → URL을 터미널 기준으로 맞추세요. Windows에서는 `127.0.0.1` 대신 **`localhost`** 를 쓰는 것이 안전합니다.

### AI-Synapse Wiki — 주제 등록 (개발만)

포털에 보이는 **「주제 등록 API 없음」** 은 정상입니다. 읽기용 정적 빌드에는 관리 API가 없고, [AI-Synapse-Wiki](https://github.com/cxr542/AI-Synapse-Wiki) **Vite dev** 가 `/api/admin` 을 제공합니다. Wiki 기본 포트(5173)는 포털과 겹치므로 **5174** 로 띄웁니다.

```bash
# 터미널 1 — Wiki (저장소 클론 경로, base를 포털과 맞춤)
cd AI-Synapse-Wiki
npm install
copy .env.example .env   # VITE_ADMIN_ENABLED=true (관리 화면)
$env:VITE_BASE="/ai-synapse-wiki/"
npm run dev -- --port 5174 --host localhost
# → http://localhost:5174/ai-synapse-wiki/  관리: /admin (PIN 1234 기본)

# 터미널 2 — 포털
cd cxr542-portal
npm run dev
```

포털 모듈에서 **연결 다시 확인** → **편집(Wiki dev)** 모드 → 자연어/수동 등록. (`npm run wiki:check` 로 API만 먼저 확인 가능)

전체 개선 로드맵: [docs/ai-synapse-wiki-improve.md](docs/ai-synapse-wiki-improve.md)

## 작업 완료 이메일 알림

포털 하위 모듈에서 저장 작업이 끝나면 `/api/notify-task-done`으로 완료 알림을 보냅니다. Vercel 환경변수가 설정되어 있으면 Resend로 이메일이 발송되고, 설정이 없으면 저장 기능은 그대로 동작하며 서버 로그에만 `missing_email_config`로 남습니다.

필수 환경변수:

- `RESEND_API_KEY`: Resend API Key
- `NOTIFY_EMAIL_TO`: 알림 받을 이메일. 여러 개면 쉼표로 구분
- `NOTIFY_EMAIL_FROM`: 발신자 주소. 미설정 시 `cxr542 Portal <onboarding@resend.dev>` 사용

브라우저에서 알림 호출을 임시로 끄려면 로그인 후 콘솔에서 `PortalStorage.setItem('cxr542-task-email-notify', '0')`을 실행하세요. 다시 켜려면 값을 삭제하거나 `1`로 바꾸면 됩니다.

## 품질 명령

```bash
npm test
npm run build
npm run lint
```

## CI/CD

- PR: `CI PR Checks` (test + build) + `Deploy Preview`
- main: `Deploy Production` (GitHub Environment `production` 승인 후 배포)

필수 GitHub Secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

상세 절차:

- [docs/deployment-process.md](docs/deployment-process.md)
- [docs/module-specs.md](docs/module-specs.md)

## Safety Notes

- Wiki admin/API는 별도 승인 없이 변경하지 않습니다.
- 모듈 라우팅과 외부 링크는 별도 승인 없이 변경하지 않습니다.
- 홈 화면 상태 보드는 기존 라우팅을 보조하는 표시용 구조입니다.

- ci/cd smoke test

- CI/CD smoke test commit

## Supabase 저장소

포털과 내장 도구의 사용자 데이터·설정은 Supabase `home` 프로젝트의
`public.portal_documents`에 계정별로 저장합니다. 프롬프트는 포털·ChatGPT·CLI가 함께 사용하는
전용 `public.portal_prompts`와 인증된 API를 사용합니다. 단일 아이디·비밀번호 로그인을 사용하며,
사용자 계정은 Supabase Dashboard → Authentication → Users에서 준비합니다.
브라우저에는 Supabase Auth 로그인 세션만 유지합니다. Wiki의 임시 관리 PIN과
외부 왓챠피디아 사이트에서 실행하는 내보내기 스크립트의 인증은 각 서비스의 기존 방식입니다.

- 아이디어, 평점, 대회·훈련 기록, 이력서: 항목별 문서
- 프롬프트: 전용 테이블/API, 사용자별 RLS와 version 검사. [소스·빌드·연동 안내](docs/prompts/source-finalization.md)
- 신발 사진(data URL 포함), 시력·GeminiTuner 설정, 즐겨찾기·메뉴 설정: 설정 문서
- SRC Running Ops: 로그인한 포털 계정의 운영 데이터. 기존 운영진/열람자 화면 게이트는 유지하지만
  공유 비밀번호만으로 다른 포털 계정의 데이터에 접근할 수는 없습니다.
- 데이터는 RLS로 소유자에게만 허용합니다. `anon`은 테이블·쓰기 함수에 접근할 수 없습니다.
- 쓰기는 revision 검사로 오래된 탭의 덮어쓰기를 거부합니다. 같은 origin의 탭·iframe 사이에는
  변경 알림을 표시합니다. 열린 편집본의 기준은 유지해 충돌을 검사합니다. 다른 탭·기기에서 수정한 내용은 다시 접속하거나 계정·저장의
  **새로 불러오기**로 갱신합니다.
- 동기 방식의 기존 화면은 메모리에서 먼저 갱신한 뒤 서버에 저장합니다. 공통 저장 상태에
  저장 중·실패가 표시되며, 미저장 상태에서 나가면 브라우저가 경고합니다.
  실패 시 **다시 저장**, 충돌 시 필요한 내용을 복사한 다음 **새로 불러오기**를 사용합니다.
  네트워크 오류 때 브라우저 저장소로 자동 전환하지 않습니다.

### 기존 데이터 이관

처음 로그인하면 **원본 JSON 백업 → 이 계정으로 가져오기**를 선택합니다.
현재 origin의 알려진 localStorage 키와 다섯 IndexedDB 데이터베이스를 읽습니다.
동일 ID는 IndexedDB 값을 우선하며, 이미 클라우드에 있는 ID(삭제된 ID 포함)는 유지합니다.
도중 실패해도 원본은 삭제하지 않으며, 재시도 시 이미 이관된 항목은 건너뜁니다.
다른 브라우저·기기의 로컬 기록은 해당 브라우저에서도 로그인한 뒤 **계정·저장 → 브라우저 기록 이관**으로 옮깁니다.
GitHub Pages 등 다른 origin의 기록은 기존 도구의 JSON 내보내기/가져오기를 이용합니다.

배포 전 데이터는 기존 운영 origin에 남아 있습니다. localhost에서 실행한 이관은 localhost의
기록만 대상으로 하므로 운영 브라우저 데이터 이관을 대신하지 않습니다.

### 연결 설정

기본 연결은 `home` 프로젝트의 URL과 공개용 publishable key입니다. 키 자체는 비밀이 아니며,
접근 권한은 로그인 JWT와 RLS가 결정합니다. 다른 프로젝트를 연결할 때는 아래 Vite 환경변수를 설정합니다.

```text
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

새 프로젝트에는 먼저 [supabase/portal-storage.sql](supabase/portal-storage.sql)을 적용합니다.
`service_role`이나 secret key를 프런트엔드에 넣지 않습니다.
`home`에는 이 SQL이 적용되어 있습니다. 기존 articles/collector 테이블은 변경하지 않습니다.

공개 회원가입은 제공하지 않습니다. 단일 소유자의 최초 계정·비밀번호 설정 절차는
[개인 계정 설정](docs/portal-single-account.md)을 따릅니다.
