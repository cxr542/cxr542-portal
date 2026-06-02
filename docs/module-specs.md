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
- 입력: 아이디어 이름, 설명
- 저장: localStorage (`cxr542-idea-bank-v1`)
- 규칙: 중복 이름 방지
- 기능: 등록/목록/삭제

## 공통 규칙
- 모든 모듈 데이터는 브라우저 localStorage 사용
- 서버 DB 연동은 차기 버전에서 검토
- 기본 CRUD와 빠른 입력 흐름에 집중
