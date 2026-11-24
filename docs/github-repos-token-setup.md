# GitHub Repos 2-5 — GitHub 토큰 발급·등록 절차

> 상태: **1~4단계 완료 (2026-11-24).** 토큰 `cxr542-portal-github-repos-prod` 발급(만료 2027-02-22), Vercel Production에 `GITHUB_REPOS_TOKEN`(Secret) 등록. 5~7단계(병합·재배포·검증)는 승인 대기.
> 각 단계의 실행 주체는 표에 적었습니다. 토큰 값은 채팅·커밋·로그·이슈 어디에도 붙여 넣지 않습니다.

## 1. 무엇을 왜 만드나

- GitHub Repos 화면은 서버 Function `api/github-repos.mjs`가 GitHub REST API를 대신 호출합니다. 브라우저에는 토큰이 가지 않습니다.
- 서버에 토큰이 없으면 API는 `503 not_configured`를 돌려주고, 화면은 샘플 데이터와 "GitHub 연동 설정 전" 안내를 보여줍니다. 그래서 토큰 등록 전에 PR #12를 병합·배포해도 화면은 깨지지 않습니다.
- 토큰이 있어야 실제 저장소 목록, 공식 `fork` 값, README, 브랜치, Private 저장소를 볼 수 있습니다.

## 2. 권한 범위 (승인 항목)

| 항목 | 값 | 이유 |
| --- | --- | --- |
| 토큰 종류 | Fine-grained personal access token | 저장소·권한 단위로 좁힐 수 있음. Classic PAT(`repo` 범위)은 쓰기 권한까지 포함해 쓰지 않음 |
| Resource owner | `cxr542` | 화면 대상 계정. 서버도 `owner.login === GITHUB_REPOS_OWNER`(기본 `cxr542`)가 아닌 저장소는 403 처리 |
| Repository access | **All repositories** | 새 저장소도 자동 포함. Public만 보려면 "Public repositories (read-only)"로 더 좁힐 수 있음(이 경우 Private 저장소는 목록에 안 나옴) |
| Repository permissions | **Metadata: Read-only** (필수, 자동 선택), **Contents: Read-only** | Metadata = 목록·fork·언어·브랜치, Contents = README |
| 그 외 권한 | 모두 No access | Issues·PR·Actions·Administration·Secrets 등 불필요 |
| Account permissions | 모두 No access | 사용자 프로필·이메일 불필요 |
| 만료 | **90일** (예: 2027-02-22) | 유출 시 피해 기간 제한. 만료 전 교체(6절) |
| 이름 | `cxr542-portal-github-repos-prod` | 용도·환경 식별 |

이 권한으로 할 수 없는 일: 코드 수정·push, 이슈/PR 생성, 설정 변경, Actions 실행, Secret 조회. 토큰이 유출되면 Private 저장소의 **코드 읽기**가 가능해지는 것이 최대 위험입니다. Public만 허용하면 이 위험이 없어집니다.

## 3. 저장 위치

| 위치 | 저장 여부 |
| --- | --- |
| Vercel 프로젝트 `cxr542-portal` → Environment Variables, **Production만** | ✅ `GITHUB_REPOS_TOKEN`, Sensitive 체크 |
| Vercel Preview / Development 환경 | ❌ Preview는 Mock 모드이고 API가 403으로 막힘. 넣을 이유가 없음 |
| `.env`, `.env.local`, 소스, GitHub Secrets, 채팅 | ❌ |

함께 확인할 기존 Production 변수(이미 있어야 함, 새로 만들지 않음): `PORTAL_OWNER_USER_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`(없으면 코드의 Production 기본값 사용), `PORTAL_DATA_MODE`가 `mock`이 아닐 것.
선택 변수: `GITHUB_REPOS_OWNER`(기본 `cxr542`이므로 보통 생략).

## 4. 실행 순서

| # | 단계 | 실행 주체 | 승인 |
| --- | --- | --- | --- |
| 1 | 이 문서의 권한 범위(2절) 승인 | 사용자 | **필요** |
| 2 | GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. 2절 값대로 입력 후 생성 | **사용자 직접** (토큰 값은 사용자만 봄) | — |
| 3 | Vercel → `cxr542-portal` → Settings → Environment Variables → Add: Key `GITHUB_REPOS_TOKEN`, Value 붙여넣기, Environment **Production만**, Sensitive 체크 → Save | **사용자 직접** | Vercel 설정 변경 → **필요** |
| 4 | 브라우저에서 토큰 값을 지우고 창 닫기(클립보드 비우기) | 사용자 | — |
| 5 | PR #12 병합 | 사용자 또는 승인 후 Claude | **필요** |
| 6 | Production 재배포 (환경변수는 새 배포부터 적용됨) | 사용자 또는 승인 후 Claude | **필요** |
| 7 | 2-6 실계정 검증(5절) | 승인 후 Claude 또는 사용자 | **필요** |

3번과 5·6번은 순서가 바뀌어도 됩니다. 병합·배포를 먼저 하면 토큰 등록 전까지 샘플+안내 화면이 보이고, 토큰 등록 뒤 한 번 더 재배포하면 됩니다.

Claude가 하지 않는 일: 토큰 생성 화면 조작, 토큰 값 읽기·입력·출력, Vercel 환경변수 조회·편집. 토큰 값 입력은 보안 규칙상 사용자만 합니다.

## 5. 등록 후 확인 (2-6)

Production에서 로그인한 상태로 확인합니다. 토큰 값은 어떤 확인 단계에서도 보이지 않아야 합니다.

1. GitHub Repos 메뉴 → "GitHub 연동 설정 전이라 샘플 데이터를 표시합니다" 안내가 **사라지고** 실제 저장소 목록이 보임.
2. 저장소 수를 `https://github.com/cxr542?tab=repositories` 수와 대조(보관된 저장소 포함 여부도 확인).
3. fork 판정: GitHub에서 "forked from"이 붙은 저장소가 화면에서 "Fork"로, 나머지가 "직접 제작"으로("추정"이 붙지 않아야 함) 나오는지 3개 이상 대조.
4. 상세 패널: README 있는 저장소/없는 저장소, 브랜치 탭.
5. 메모 저장 → 새로고침 → 유지(Phase 3 실제 Supabase 확인).
6. 브라우저 DevTools Network: `/api/github-repos` 응답과 요청 헤더에 GitHub 토큰(`github_pat_`)이 없음. 요청은 같은 origin만.
7. 로그아웃 상태에서 `/api/github-repos?resource=list` 직접 호출 → `401 session_required`.
8. Vercel Function 로그에 토큰 값이 찍히지 않았는지 확인.

실패 시 원인 구분:

| 화면/응답 | 의미 | 조치 |
| --- | --- | --- |
| 샘플+"설정 전" 안내 유지 | 토큰 없음·형식 오류, 또는 재배포 안 함 | 변수 이름·환경(Production)·재배포 확인 |
| "GitHub 인증이 필요합니다"(502 `unauthorized`) | 토큰 만료·폐기·권한 부족 | 토큰 재발급(6절) |
| "접근 권한이 없습니다"(403) 또는 일부 저장소 403 | Resource owner가 `cxr542`가 아님 | 토큰 재발급 |
| "포털에 다시 로그인해 주세요"(401) | 포털 로그인 문제, 토큰과 무관 | 다시 로그인 |
| 한도 초과(429) | 5,000 req/h 초과 | 표시된 시각 이후 재시도 |

## 6. 교체·폐기

- **정기 교체:** 만료 7일 전 GitHub가 메일을 보냅니다. 새 토큰을 같은 권한으로 만들고 → Vercel `GITHUB_REPOS_TOKEN` 값 교체 → 재배포 → 화면 확인 → 이전 토큰 Delete.
- **유출 의심 시:** GitHub에서 즉시 토큰 Delete(화면은 곧바로 "GitHub 인증이 필요합니다"로 바뀌며 메모 데이터는 영향 없음) → 새 토큰 발급·등록 → 재배포. GitHub Settings → Security log에서 해당 토큰 사용 기록 확인.
- **기능 중단 시:** Vercel 변수 삭제 + 재배포 → 화면은 샘플+안내로 돌아갑니다. GitHub 토큰도 Delete.

## 7. 대안

- **Public만:** 2절 Repository access를 "Public repositories"로. 위험은 최소지만 Private 저장소는 보이지 않습니다.
- **GitHub App:** 설치 토큰(1시간 만료)으로 더 안전하지만 앱 생성·설치·private key 보관과 서버 코드 추가가 필요합니다. 현재 코드는 PAT 전제이므로 필요하면 별도 작업으로 진행합니다.
