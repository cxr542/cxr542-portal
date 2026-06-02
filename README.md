# cxr542 포털

업무 외 개발 서비스(vision-font, today-shoes, 마라톤 기록장, 아이디어 뱅크)를 한곳에서 관리하는 개인 포털입니다.

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
