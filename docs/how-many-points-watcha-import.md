# 너는몇점? — 왓챠피디아 평점 가져오기

## 결론

| 방법 | 가능 여부 | 비고 |
|------|-----------|------|
| 왓챠피디아 **공식 Export API** | ❌ 없음 | 개발자용 데이터보내기 미제공 |
| **브라우저 스크립트 → CSV** | ✅ (비공식) | 로그인·전체공개 프로필 필요, API 변경 시 스크립트 수정 필요 |
| 포털 **너는몇점?** CSV 가져오기 | ✅ | `watchapedia-export` 형식 (영화·TV) 지원 |

책·웹툰 평점은 왓챠 export 스크립트 대부분이 **영화·TV만** 수집합니다. 해당 항목은 앱에서 수동 입력하거나, 추후 JSON으로 병합하세요.

## 권장 절차 (watchapedia-export)

### 준비

1. Chrome으로 [pedia.watcha.com](https://pedia.watcha.com) 로그인
2. 프로필 공개 범위를 **전체 공개**로 설정

### Console 노란 경고 (`allow pasting`)

Chrome·Edge가 **콘솔 붙여넣기를 막을 때** 나오는 정상 안내입니다. 오류가 아닙니다.

- **Console에 붙여넣을 때:** 입력줄에 `allow pasting` 을 **손으로** 입력(따옴표 없음) → Enter → 그다음 `Ctrl+V`
- **번거로우면:** 아래 Snippets 방법 사용 → `allow pasting` **불필요**

### 방법 A — Snippets (추천)

1. 포털 **가져오기** → **스크립트 복사**
2. 왓챠 탭 `F12` → **Sources(소스)** → 왼쪽 **Snippets** → **+ New snippet**
3. 편집 칸에 `Ctrl+V` → `Ctrl+S` 저장
4. 스니펫 우클릭 **Run** (또는 `Ctrl+Enter`)
5. `{아이디}-watcha.csv` 다운로드

### 방법 B — Console

1. 스크립트 복사 후 `F12` → **Console**
2. `allow pasting` 입력 → Enter
3. `Ctrl+V` → Enter

`Images loaded lazily…` 는 무시해도 됩니다.

### 방법 B — 주소창

1. 주소창에 `javascript:` 입력 (콜론까지, **Enter는 아직 누르지 않음**)
2. [스크립트 원문](https://raw.githubusercontent.com/erinyskim/watchapedia-export/main/watchapedia_export.js)을 `javascript:` **바로 뒤**에 붙여넣기
3. Enter → CSV 다운로드  
   (차단 메시지가 나오면 방법 A 사용)

### 포털에 넣기

5. 다운로드된 `{username}-watcha.csv` 를 **너는몇점? → 가져오기 → 왓챠 CSV 가져오기** 에 업로드

### CSV 컬럼 (스크립트 기준)

`ID, URL, Title, Type, Year, Directors, WatchedAt, Rating, Review, Spoiler`

- **Type:** `MOVIE` → 영화, `TV` → 시리즈
- **Rating:** 스크립트에서 왓챠 10점 척도를 5점 만점으로 변환한 값

## 포털 앱 동작

- 같은 왓챠 **ID**가 있으면 병합 시 **덮어쓰기** (리뷰·평점 갱신)
- 가져오기 대화상자: **확인** = 기존 데이터와 병합, **취소** = 전체 삭제 후 가져오기
- 원본 링크는 `sourceUrl`에 보관 (편집 화면에서 왓챠피디아 링크)

## `403 Forbidden` — 전체 공개·내 평가 페이지인데도

설정이 맞아도 **왓챠가 비공식 API(`api-pedia.watcha.com`)를 차단**하는 경우가 있습니다. 포털/스크립트 버그가 아닙니다.

**대응:** 포털 **가져오기 → 「① v2 스크립트 복사」** (`watchapedia_export_v2.js`)

- API가 되면: 예전처럼 전체 CSV
- API가 403이면: **화면에 로드된 평가 카드만** 수집 (평가 목록 **끝까지 스크롤** 후 실행·대기)
- 그래도 비어 있으면: **너는몇점?** 에 수동 입력

v1 (구 스크립트): `/how-many-points/assets/watchapedia_export.js`

## 한계·주의

- 스크립트는 Watcha **내부 API**를 호출하므로 서비스 업데이트 시 **동작이 끊길 수 있음**
- 본 날짜(`WatchedAt`)는 리뷰(코멘트)가 있는 경우에만 채워지는 경우가 많음
- 포털은 왓챠에 로그인하지 않으며, **사용자 PC에서 받은 CSV만** 처리합니다

## 참고 링크

- https://github.com/erinyskim/watchapedia-export
- 레터박스 등 타 서비스 이전 글 (동일한 CSV 추출 아이디어): 익스트림무비 등 커뮤니티 가이드
