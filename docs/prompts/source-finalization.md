# 프롬프트 연동 소스 마무리

## 정식 구조

- `src/cloud/promptTransport.js`: 기존 포털 세션을 사용하는 인증된 전용 API 클라이언트.
- `public/prompt-collection`: 현재 워크스페이스에 포함되는 최신 포털 UI.
- `apps/prompt-actions/public/prompt-collection`: ChatGPT OAuth 승인 및 기존 브라우저 원본 복구에 사용하는 독립 화면. 포털 UI와 빌드 경로를 분리한다.
- `server/prompts`, `api/prompts`, `api/prompt-auth`, `api/prompt-oauth`, `api/prompt-mcp.mjs`: 공통 인증/API/MCP 구현.
- `supabase/migrations`, `supabase/preview`: 검증된 SQL과 별도 Preview 스키마. Git 푸시나 빌드가 DB SQL을 자동 적용하지 않는다.

운영에만 존재했던 최신 UI와 공통 로그인·저장 소스를 해시로 보존해 통합했다. 다른 체크아웃의 미커밋 작업은 수정하지 않았다. 마라톤을 포함한 다른 도구의 기존 기능을 보존한다.

## 재현

```sh
npm ci
npm test
npm run lint
npm run build
npm run build:prompt-actions
PROMPTS_PILOT_ORIGIN=https://cxr542-prompt-actions-test.vercel.app npm run package:prompt-actions
node scripts/check-prompts-pilot.mjs
```

서버 환경변수는 `.env.prompts.example`을 참고한다. 로컬 Vite에서는 서버 변수들을 셸에서 내보낸 뒤 실행한다. 비밀키를 VITE_ 변수로 전달하지 않는다.

Production 전용 MCP 패키지를 만들 때만 `PROMPTS_BUNDLE_TARGET=production`을 지정한다. public/preview 스키마와 Vercel 환경의 일치 여부를 서버에서 검사한다. 포털과 MCP를 같은 사용자로 연결하고, 계정이 여러 개면 도구 메타데이터에 제공된 올바른 link_id를 사용한다.

## 배포·복구

- 기본 `npm run build`는 최신 포털을 생성하며, 독립 OAuth 화면을 덮어쓰지 않는다.
- CI는 Node 24, Vercel CLI 65.2.0을 사용한다. Production 워크플로는 main에서 수동 실행하며 production 환경을 거친다.
- `npm ci`에 필요한 잠금 파일을 보존한다. Zod 전이 의존성은 취약점 수정 버전 4.6.7로 고정했다. 참고: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- `.cache`, `.vercel`, `.omo`, 비밀 환경 파일과 사용자 원본 백업은 커밋/배포하지 않는다.
- 사용자 프롬프트 원본의 복구 여부와 운영 조회 확인은 `portal-unification.md`에 기록했다. 기억하신 예전 3건 중 나머지 원본은 확인되지 않았다. 추가 원본을 발견할 때까지 임의로 복원했다고 주장하지 않는다.
- DB와 계정, OAuth client secret은 이번 소스 통합에서 변경하지 않는다. 기능 롤백 시 데이터 테이블을 삭제하지 않고 이전 배포로 주소를 복원한다.
