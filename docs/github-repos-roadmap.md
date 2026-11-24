# GitHub Repos Workspace — Phase 2·3 실행 계획

이 문서는 실제 GitHub 저장소 관리 서비스로 가기 위한 후속 설계입니다. Phase 1.5(Mock Preview 격리)까지의 로컬 구현 위에서 진행합니다. 로컬 구현 완료와 운영 서비스 완성은 별개입니다.

## 현재 데이터 경계

| 계층 | 파일 | 현재 구현 | 다음 구현 |
| --- | --- | --- | --- |
| RepoRecord (GitHub 원본) | `src/features/github-repos/repoModel.js` | `normalizeGithubRepo`: REST 필드 → 레코드, key = `github:<repository id>` | 그대로 사용 |
| RepoSource | `src/features/github-repos/repoSource.js` | `createFixtureRepoSource` (15건, `verified:false`) | `createServerRepoSource` (Phase 2) |
| 오류 분류 | `repoSource.js` | `classifyGithubResponse`: 401/403/404/429/5xx → `unauthorized`·`forbidden`·`rate_limited`·`network` | 서버 프록시에서 사용 |
| UserMetaStore | `repoSource.js` | `createFixtureMetaStore` (메모리, `persistent:false`) | `createCloudMetaStore` (Phase 3) |
| UI | `GithubReposPage.jsx` | Loading·Error·Empty·Retry·새로고침·정렬, `verified`일 때만 "추정" 표기 제거 | README 탭, 메모 편집 |

페이지는 `source`/`metaStore` prop만 의존합니다. Phase 2·3은 구현체를 바꾸는 작업이며 UI 구조 변경은 최소입니다.

## Phase 2 — GitHub 실연동

### API 방식: REST 권장

- 목록: `GET /user/repos?affiliation=owner&per_page=100&sort=pushed` (Private 포함, 인증 필요). Public만이면 `GET /users/cxr542/repos`.
- 공식 fork 판정: 응답의 `fork` 필드. 원본 정보가 필요하면 상세 `GET /repos/{owner}/{repo}`의 `parent`.
- README: `GET /repos/{owner}/{repo}/readme` (`Accept: application/vnd.github.raw+json`), 404 → "README 없음".
- 언어: 목록의 `language`, 상세 비율은 `GET /repos/{o}/{r}/languages`(선택 시에만 호출).
- 브랜치: `GET /repos/{o}/{r}/branches?per_page=100`(선택 시에만), 기본 브랜치는 목록의 `default_branch`.
- 활동: `pushed_at`·`updated_at`. 세부 커밋 활동은 범위 밖(필요 시 `GET /repos/{o}/{r}/commits?per_page=5`).
- Pagination: `Link: rel="next"` 추적. 저장소 수백 개 수준이면 REST가 단순합니다. GraphQL은 목록+언어+기본브랜치를 한 번에 받는 장점이 있지만 토큰이 항상 필요하고 비용 계산이 복잡해 1차에는 쓰지 않습니다.
- Rate limit: 인증 5,000 req/h. `x-ratelimit-remaining`·`x-ratelimit-reset`을 `classifyGithubResponse`로 해석, `ETag`/`If-None-Match` 조건부 요청(304는 한도 차감 없음).

### 인증·토큰 보관 (최소 권한)

브라우저에 GitHub 토큰을 두지 않습니다. 서버 Function `api/github-repos.mjs`가 GitHub를 호출하고, 포털 로그인 세션(Supabase access token)으로 소유자만 허용합니다.

권장안: **Fine-grained PAT, 저장소 범위 = All repositories (cxr542 소유), 권한 = Metadata: Read, Contents: Read** (README 조회용). 만료 90일 이내. Vercel Production 환경변수 `GITHUB_REPOS_TOKEN`에만 저장, Preview에는 넣지 않음.

대안: GitHub App(설치 토큰, 1시간 만료)은 더 안전하지만 앱 생성·설치가 필요합니다. Public만 필요하면 토큰 없이 시작 가능(60 req/h 한도, Private·README 일부 불가).

### 서버 Function 설계

- `api/github-repos.mjs`: `rejectLiveRequest` 가드 첫 줄(모든 `api/` 파일 대상 Mock 테스트가 자동 검증), 포털 세션 검증 → `GET ?resource=list|readme|branches&id=<repository id>`.
- 응답은 정규화된 레코드만 반환(토큰·원본 헤더 미노출), `Cache-Control: private, max-age=60`.
- 서버 캐시: ETag 기억(메모리/Supabase 캐시 테이블은 Phase 3에서 판단).
- 이름 변경: key가 repository id라 메모 유지. 삭제/권한 상실: 목록에서 사라진 key는 UserMeta를 지우지 않고 "GitHub에서 찾을 수 없음" 보관 섹션으로 표시.

### 2-1 구현 메모

- `createGithubClient({ token, env, fetcher })`는 `liveDataDenial(env)`이 거부하면 생성 자체를 거부합니다(Mock·잘못된 배포에서 네트워크 0건).
- 메서드: `listRepos()`(`/user/repos?affiliation=owner`), `getRepo(id)`(`/repositories/{id}`, 이름 변경 추적), `getReadme(fullName)`(raw, 404 → null, 512KB 상한), `listBranches(fullName)`, `rateLimit()`.
- 토큰은 `https://api.github.com` 요청 헤더에만 들어가며 반환값·오류에 포함되지 않습니다. 다음 페이지 링크나 리다이렉트가 API origin을 벗어나면 `invalid_response`로 중단합니다.
- ETag 캐시는 인스턴스 메모리(최대 200개)입니다. Function 콜드 스타트마다 초기화되므로, 지속 캐시가 필요하면 2-2에서 결정합니다.
- 오류 코드는 UI와 같은 `repoErrors.js`를 공유합니다(Node에서 바로 import 가능하도록 import 없는 모듈로 분리).

### 2-2 구현 메모

- `GET /api/github-repos?resource=list|readme|branches[&id=<repository id>]`. 진입점이 `rejectLiveRequest`로 Mock을 먼저 거부하고, 핸들러도 한 번 더 확인합니다.
- 세션 확인: `Authorization: Bearer <포털 Supabase access token>`을 포털 Supabase `/auth/v1/user`로 검증하고, `user.id === PORTAL_OWNER_USER_ID`일 때만 통과합니다. 실패하면 GitHub를 호출하지 않고 `401 session_required`를 반환합니다. GitHub 토큰 오류(`502 unauthorized`)와는 구분됩니다.
- README·브랜치는 저장소 **id**로 요청하고, 서버가 `/repositories/{id}`로 현재 이름을 찾은 뒤 `GITHUB_REPOS_OWNER`(기본값 `cxr542`) 소유인지 확인합니다. 다른 계정 저장소는 `403 forbidden`입니다.
- 오류 상태 코드: `session_required` 401, `forbidden` 403, `rate_limited` 429(+`Retry-After`, `resetAt`), `not_configured` 503, GitHub 토큰 거부·네트워크·응답 오류 502.
- 응답은 `Cache-Control: private, no-store`입니다. 효율은 서버의 ETag 재검증(웜 인스턴스에서 클라이언트 재사용)으로 확보합니다.
- 필요한 서버 환경변수(Production만): `GITHUB_REPOS_TOKEN`(2-5 승인 후 등록), `PORTAL_OWNER_USER_ID`·`SUPABASE_URL`·`SUPABASE_PUBLISHABLE_KEY`(기존), 선택 `GITHUB_REPOS_OWNER`.
- 로컬 `npm run dev`에서도 같은 핸들러가 `/api/github-repos`로 동작합니다(`PORTAL_DATA_MODE=supabase`와 위 변수가 셸 환경에 있어야 함).

### 2-3 구현 메모

- 실데이터 런타임(`supabaseBootstrap.js`)만 `globalThis.PortalSession = { mode: 'supabase', getAccessToken() }`을 노출합니다. 세션은 이미 같은 origin 저장소에 있으므로 새로 노출되는 정보는 없습니다. Mock 런타임은 이 객체를 만들지 않습니다.
- `selectRepoSource`: `PortalCloud.mode === 'mock'`이거나 세션이 없으면 항상 샘플 소스(`?repoState=` 미리보기 포함)를 씁니다. 그 외에는 서버 소스를 씁니다.
- 서버에 GitHub 토큰이 아직 없으면(`503 not_configured`) 오류 화면 대신 샘플 데이터와 "GitHub 연동 설정 전" 안내를 보여줍니다. 그래서 2-5 승인 전에 병합해도 Production 화면이 깨지지 않습니다. 세션 만료·한도 초과·네트워크 같은 실제 오류는 숨기지 않습니다.
- README·브랜치는 레코드 key 접두사(`github:` / `fixture:`)로 어느 소스에 물을지 정합니다.
- 실데이터에서도 사용자 메모·태그는 아직 메모리 저장입니다(Phase 3).
- 브라우저 검증 범위: Mock Preview에서 가짜 `PortalSession`을 심어도 샘플 소스가 유지되고 `/api/` 요청이 0건인 것을 확인했습니다. 실제 로그인 상태의 화면은 운영 Supabase 접속이 필요해 검증하지 않았습니다(배포 승인 후 확인).

### 작업 순서

| # | 작업 | 예상 변경 파일 | 필요 권한 | 테스트 | 승인 |
| --- | --- | --- | --- | --- | --- |
| 2-1 ✅ | 서버 GitHub 클라이언트(페이지네이션, ETag, 오류 분류) — 로컬 구현 완료 | `server/github/client.mjs`, `src/features/github-repos/repoErrors.js`, `tests/githubClient.test.js` | 없음(로컬, fetch mock) | 31개: Mock/설정 오류 시 생성 거부, 토큰 미노출, Link 페이지네이션·외부 origin 차단·페이지 상한, ETag 304, 401/403/429/5xx, README 404·크기 상한, 저장소 이름 검증, 브랜치 | 불필요 |
| 2-2 ✅ | `api/github-repos.mjs` + 포털 소유자 세션 확인 + Mock 거부 — 로컬 구현 완료 | `api/github-repos.mjs`, `server/github/reposApi.mjs`, `vercel.json`, `vite.config.js`, `tests/githubReposApi.test.js` | 없음 | 27개: Mock·잘못된 설정 거부, 세션 없음/타 사용자/익명/만료 401, 소유자 미설정 503, id 검증, 타 계정 저장소 403, 토큰 미노출, rate limit 429+Retry-After, ETag 재사용, rewrite 순서 | 불필요 |
| 2-3 ✅ | 화면을 서버 API에 연결 (`createServerRepoSource`, `createLiveRepoSource`, `selectRepoSource`) — 로컬 구현 완료 | `repoSource.js`, `GithubReposPage.jsx`, `src/cloud/supabaseBootstrap.js`, `tests/githubReposServerSource.test.js` | 없음 | 27개: 세션 토큰 전달·없음, 오류 코드 변환, 비 GitHub 레코드 제거, id 기반 상세 요청, 설정 전 샘플 대체, 실제 오류는 숨기지 않음, Mock에서는 항상 샘플 소스 | 불필요 |
| 2-4 | README·브랜치 탭 | `GithubReposPage.jsx`, CSS | 없음 | README 404·마크다운 안전 렌더(HTML 미삽입) | 불필요 |
| 2-5 | 토큰 발급·등록 | — | **GitHub PAT 발급, Vercel Production env 추가** | — | **필요** |
| 2-6 | 실계정 조회 검증 | — | 2-5 이후 Production 또는 별도 승인된 환경 | 실제 목록 수·fork 판정 대조 | **필요** |

## Phase 3 — 사용자 메모·태그 영구 관리

- 저장 위치: 기존 `PortalCloud`(Supabase `portal_documents` + RLS 소유자) 네임스페이스 `github-repos/meta`, 문서 key = `github:<id>`. 새 테이블·RLS 변경 없이 기존 구조 재사용이 1안. DB 구조 변경이 필요해지면 별도 승인.
- 값: `{ category, status, tags[], favorite, note, hidden, updatedAt }`. GitHub 메타데이터는 저장하지 않음(동기화가 사용자 데이터를 덮어쓰지 않음).
- `createCloudMetaStore(PortalCloud)`: `get/all/set`, 낙관적 업데이트, 실패 시 롤백 + 기존 `remoteChanges` 경고 재사용. Mock에서는 `createMockStorage` 기반 메모리 저장.
- UI: 메모 편집(저장/취소), 태그 입력, 즐겨찾기 토글, 숨김·보관 보기, 카테고리 변경.
- 테스트: 동기화 후 메타 보존, 이름 변경 후 메모 유지, 삭제 저장소 보관 표시, Mock에서 클라우드 미호출.

## Phase 4 — 통합·배포 (모두 승인 필요)

1. PR 생성·리뷰. 2. 승인 시 Preview(Mock) 수동 배포 → 실제 배포 산출물 `check:mock-bundle`, 직접 API 403, 네트워크 확인. 3. Production 배포 승인 → 로그인·저장·기존 메뉴 회귀 확인. 4. 모니터링: Function 오류율, GitHub rate limit 잔량.
