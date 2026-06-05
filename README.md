# cxr542 포털

업무 외 개발 서비스(vision-font, today-shoes, 마라톤 기록장, 아이디어 뱅크, AI-Synapse Wiki, GeminiTuner)를 한곳에서 관리하는 개인 포털입니다.

> **워크스페이스:** 이 repo(`cxr542-portal`)만 clone·열어도 됩니다.  
> 교육팀 TMS(업무)는 별도 repo [`edu-team-tms`](https://github.com/cxr542/edu-team-tms) — 집(윈도우)에서는 포털, 회사(맥)에서는 TMS.

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

- ci/cd smoke test

- CI/CD smoke test commit
