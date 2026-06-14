# cxr542 포털

업무 외 개발 서비스(vision-font, today-shoes, 마라톤 기록장, 아이디어 뱅크, AI-Synapse Wiki, GeminiTuner)를 한곳에서 관리하는 개인 포털입니다.

## Portal Role

`cxr542-ai-portal`은 개인 프로젝트 포털입니다.

> **워크스페이스:** 이 repo(`cxr542-portal`)만 clone·열어도 됩니다.  
> 교육팀 TMS(업무)는 별도 repo [`edu-team-tms`](https://github.com/cxr542/edu-team-tms) — 집(윈도우)에서는 포털, 회사(맥)에서는 TMS.

## Project Status Board

홈 화면은 프로젝트를 `Active Projects`, `Experiments`, `Paused`, `Ideas`로 분류합니다.

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

브라우저에서 알림 호출을 임시로 끄려면 콘솔에서 `localStorage.setItem('cxr542-task-email-notify', '0')`을 실행하세요. 다시 켜려면 값을 삭제하거나 `1`로 바꾸면 됩니다.

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
