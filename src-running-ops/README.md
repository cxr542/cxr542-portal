# SRC RUNNING OPS

운영진 전용 러닝 동호회 관리 페이지 MVP입니다. 모바일 우선 UI로 회의록, Action Plan, 비상연락망, 자료 링크를 한 화면에서 다룹니다.

## 주요 기능

- 로그인 후 manager / viewer 권한 분리
- 대시보드 요약 카드와 빠른 바로가기
- 회의록 목록, 상세, 검색, manager용 작성·수정·삭제
- Action Plan 목록과 담당자 / 상태 필터
- 비상연락망 검색과 전화 걸기 UI
- 자료 링크 관리
- Google Sheets 연동 준비 구조와 mock data 기반 실행

## 권한 구조

- `manager`: 작성 / 수정 / 삭제 가능
- `viewer`: 조회만 가능

인증은 `api/running-ops-auth.js`에서 `MANAGER_PASSWORD` / `VIEWER_PASSWORD` 를 검증합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

앱은 `http://localhost:5173/src-running-ops/` 에서 확인할 수 있습니다.

## 환경변수

`.env.example`에는 placeholder만 둡니다.

- `MANAGER_PASSWORD`
- `VIEWER_PASSWORD`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_URL`
- `GOOGLE_SHEET_URL`

## Google Sheets 구조

### Meetings

- `id`
- `title`
- `dateTime`
- `location`
- `attendees`
- `agenda`
- `discussion`
- `decisions`
- `author`
- `updatedAt`

### ActionPlans

- `id`
- `meetingId`
- `task`
- `owner`
- `dueDate`
- `status`
- `memo`

### Contacts

- `id`
- `name`
- `role`
- `group`
- `phone`
- `emergencyPhone`
- `memo`
- `visible`

### Links

- `id`
- `title`
- `url`
- `category`
- `memo`
- `updatedAt`

## Vercel 배포

1. Vercel에서 이 repo를 import합니다.
2. 프로젝트 루트는 repo root 그대로 둡니다.
3. 환경변수에 위 항목을 설정합니다.
4. `src-running-ops/` 경로는 정적 페이지로 서빙됩니다.
5. 실제 프로젝트 생성과 도메인 연결은 이 작업에서 수행하지 않습니다.

희망 주소: `src-running-ops.vercel.app`

## Mock data

앱은 기본적으로 `src-running-ops/src/data/mockData.js` 의 가짜 데이터로 동작합니다.
실제 개인정보, 실명, 실제 전화번호, 실제 비밀번호는 포함하지 않습니다.

## MVP 보안 한계

이 앱은 운영진 내부용 MVP입니다. 공유 비밀번호 기반 접근 제어는 강한 인증 방식이 아니므로, 실제 개인정보를 다루기 전에는 계정 기반 로그인 또는 별도 인증 체계를 도입하는 것을 권장합니다.

또한 비상연락망은 내부용으로만 사용해야 하며, 외부 공유 및 무단 배포를 금지해야 합니다.

## 향후 개선

- Google OAuth 로그인
- 운영진별 계정 관리
- Google Sheets 실시간 연동
- Supabase 또는 DB 저장
- 변경 이력 기록
