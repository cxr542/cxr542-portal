# cxr542 배포 프로세스

## 1. 사전 설정

### GitHub Secrets
Repository Settings -> Secrets and variables -> Actions:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### GitHub Environment
Repository **Settings → Environments**:

- `production` 환경 생성
- Required reviewers에 **본인 계정**을 추가해야 Actions에 **Review deployments** 버튼이 보입니다
- `environment: production`은 유지합니다. 승인자를 설정하지 않은 환경은 승인 대기 없이 실행될 수 있으므로 GitHub 환경 설정도 확인합니다.

## 2. 파이프라인 구성

- `.github/workflows/ci-pr.yml`
  - PR에서 `npm test`, `npm run build`
- `.github/workflows/deploy-preview.yml`
  - PR opened/synchronize/reopened 시 preview 배포
  - PR 코멘트와 summary에 preview URL 기록
- `.github/workflows/deploy-production.yml`
  - main 브랜치에서 수동 실행(workflow_dispatch)할 때만 production job 시작
  - `environment: production` 승인 후 운영 배포

## 3. 릴리즈 플로우

1. feature 브랜치 -> PR 생성
2. CI/Preview 확인
3. PR merge to main
4. 운영 반영 승인 후 main에서 Production workflow 수동 실행
5. 환경 승인 후 운영 배포 및 스모크 체크

## 4. 장애 대응

- Production workflow 실패 시 Actions 로그 확인
- Vercel에서 최근 정상 배포로 rollback
- Secrets/Environment 누락 여부 재검증

## 5. 프롬프트 빌드

Node 24와 Vercel CLI 65.2.0을 기준으로 검증합니다. 루트 `npm run build`는 최신 포털을 생성합니다. ChatGPT 독립 화면은 `npm run package:prompt-actions`로 별도 패키징합니다. DB SQL은 Git 푸시나 빌드에서 자동 적용하지 않습니다. 상세 명령과 환경 가드는 [소스 마무리 문서](prompts/source-finalization.md)를 참고하세요.
