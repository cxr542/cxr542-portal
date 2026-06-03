# cxr542 모듈 스펙 (MVP)

## 1) vision-font
- 폰트 프리셋 3종 제공
- 샘플 문구 입력/미리보기
- CSS 코드 복사 버튼

## 2) today-shoes
- 입력: 신발 모델, 착화 느낌, 태그
- 저장: localStorage (`cxr542-today-shoes-v1`)
- 출력: 최신순 목록

## 3) 마라톤 기록장
- 입력: 거리, 페이스, 시간, 메모
- 저장: localStorage (`cxr542-marathon-log-v1`)
- 출력: 최신순 목록
- 요약: 이번 달 기록 수/총 거리

## 4) 아이디어 뱅크
- **경로:** `/idea-bank/` (포털과 동일 origin · `public/idea-bank/`)
- **UI:** 포털 홈 카드·사이드바 → iframe 또는 `/idea-bank/` 직접 접속
- **저장:** IndexedDB / `idea-bank-ideas` (포털 도메인 `vercel.app`)
- **기능:** 검색, 카테고리, 고정함, JSON 보내기/가져오기
- **이전:** [GitHub Pages idea-bank](https://cxr542.github.io/cxr542-ai/projects/idea-bank/) 데이터 → JSON보내기 후 포털 `/idea-bank/`에서 JSON 가져오기

## 공통 규칙
- 모든 모듈 데이터는 브라우저 localStorage 사용
- 서버 DB 연동은 차기 버전에서 검토
- 기본 CRUD와 빠른 입력 흐름에 집중
