# marathon-log — 개발·운영 워크플로 (파일럿)

로컬 마라톤 기록장. **코드는 Git**, **기록 데이터는 브라우저**에만 있습니다.

| URL | 용도 |
|-----|------|
| https://cxr542.github.io/cxr542-ai/projects/marathon-log/ | **운영** (실제 기록) |
| http://localhost:8080/projects/marathon-log/ | **개발** (`npm run preview`) |

## 브랜치

| 브랜치 | 역할 |
|--------|------|
| `develop` | 일상 개발 — commit + push 반복 (브랜치 새로 만들 필요 없음) |
| `main` | 운영 — merge 시 GitHub Pages 자동 배포 |

## 일상 개발 (집·사무실 공통)

```bash
cd cxr542-ai
git checkout develop
git pull origin develop

npm run preview
# → http://localhost:8080/projects/marathon-log/

# ... 수정 후 ...
git add projects/marathon-log/   # 또는 필요한 경로
git commit -m "marathon-log: 변경 요약"
git push origin develop
```

- localhost 데이터와 운영(github.io) 데이터는 **origin이 달라 분리**됩니다.
- 테스트용 기록은 localhost, **실제 기록은 운영 URL**에서 관리하는 것을 권장합니다.

## 운영 배포 (릴리스)

1. 운영 URL에서 **JSON보내기**로 백업 (OneDrive 등에 보관)
2. `develop`에서 로컬 preview로 최종 확인
3. GitHub에서 PR: `develop` → `main` (체크리스트 확인)
4. merge 후 Pages 배포 (수 분 소요)
5. 운영 URL에서 동작 확인 — 문제 시 JSON 가져오기로 복구

## 데이터 동기화 (운영 ↔ 로컬)

기록 데이터는 브라우저 저장소(IndexedDB / localStorage)에 들어가서, **운영 URL과 로컬 preview는 origin이 달라 자동 동기화되지 않습니다.**
대신 앱 안의 `JSON보내기 / JSON 가져오기`로 “사실상 동기화”할 수 있습니다.

### 운영 → 로컬 동기화(추천, 덮어쓰기)

목표: 로컬 preview를 운영 데이터와 동일하게 맞춥니다.

1. 운영 URL(`https://cxr542.github.io/cxr542-ai/projects/marathon-log/`)에서 **JSON보내기**
2. 로컬 preview URL(`http://localhost:8080/projects/marathon-log/`)에서 **가져오기 (전체 교체)**
3. 확인 팝업에서 **확인(OK)** 선택

### 로컬 → 운영 동기화(주의)

목표: 로컬에서 만든/정리한 데이터를 운영에 반영합니다.

1. 로컬 preview에서 **JSON보내기** (운영 복구용 백업도 함께 권장)
2. 운영 URL에서 **JSON 가져오기** 또는 **가져오기 (전체 교체)** 선택
3. 필요한 방식으로 반영
   - 운영까지 완전 교체: **가져오기 (전체 교체)**
   - 운영 데이터 유지 + 추가/수정 반영: **JSON 가져오기**

## 데이터 백업

- **Git에 올라가지 않음:** IndexedDB / localStorage의 기록 데이터
- **백업:** 데이터 메뉴 「JSON보내기」
- **복구:** 데이터 메뉴 「JSON 가져오기」 또는 「가져오기 (전체 교체)」
- 운영 URL 사용 시 2주마다 export 권장 (앱 배너에 안내 표시)

## 코드 변경 시 주의 (`js/db.js`)

- `DB_VERSION`을 올리면 기존 사용자 DB 마이그레이션이 필요합니다. **운영 배포 전에 로컬에서 충분히 검증**하세요.
- 시드(`SEED_RACES`) 변경은 초기/재시드 흐름에만 반영됩니다.

## 관련 파일

| 파일 | 설명 |
|------|------|
| `index.html` | 앱 셸 |
| `js/app.js` | UI·라우팅 |
| `js/db.js` | IndexedDB / localStorage |
| `js/keep-seed.js` | Keep 기반 시드 데이터 |
| `../shared/` | project-shell (사이드바·배너) |
