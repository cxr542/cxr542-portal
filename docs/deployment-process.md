# cxr542 배포 프로세스

## 1. 사전 설정

### GitHub Secrets
Repository Settings -> Secrets and variables -> Actions:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### GitHub Environment
Repository Settings -> Environments:

- `production` 환경 생성
- Required reviewers 설정 (운영 승인자)

## 2. 파이프라인 구성

- `.github/workflows/ci-pr.yml`
  - PR에서 `npm test`, `npm run build`
- `.github/workflows/deploy-preview.yml`
  - PR opened/synchronize/reopened 시 preview 배포
  - PR 코멘트와 summary에 preview URL 기록
- `.github/workflows/deploy-production.yml`
  - main push/수동 실행 시 production job 시작
  - `environment: production` 승인 후 운영 배포

## 3. 릴리즈 플로우

1. feature 브랜치 -> PR 생성
2. CI/Preview 확인
3. PR merge to main
4. Production workflow 승인 대기
5. 승인 후 운영 배포 및 스모크 체크

## 4. 장애 대응

- Production workflow 실패 시 Actions 로그 확인
- Vercel에서 최근 정상 배포로 rollback
- Secrets/Environment 누락 여부 재검증
