# 너는몇점? 안전 병합 운영 안내

## 저장 구조와 원인

최신 main은 `public/how-many-points/js/db.js` → `PortalCloud` (`src/cloud/storage.js`) → Supabase `public.portal_documents` 구조다. 기본키는 `(user_id, namespace, key)`이고 평점 namespace는 `how-many-points`다. `portal_write`는 revision으로 낡은 쓰기를 거부하며 RLS와 `portal_account`가 계정 접근을 제한한다.

IndexedDB `how-many-points/ratings`와 localStorage `how-many-points-ratings`는 이전 브라우저 데이터다. 현재는 `src/cloud/migration.js`의 별도 이관 경로에서만 읽는다. 이번 변경은 이관이나 기존 브라우저 데이터를 지우거나 수정하지 않는다.

기존 CSV 화면은 설명과 반대로 `!confirm(...)`을 사용해 확인 시 전체 삭제를 호출했고, 취소 시 중복 리뷰를 덮어썼다. JSON 경로에도 전체 삭제가 있었다. 건별 `Promise.all` 저장은 일부 성공 후 실패할 수 있었다.

## 새 동작

CSV와 JSON의 파일 파싱은 구분하고, 미리보기·백업·확인·병합은 공통 흐름을 사용한다. 기본값은 기존 레코드 전체 보존이다. `source + externalId`가 같으면 중복으로 보고 내부 ID가 달라도 기존 ID를 유지한다. 출처가 다르거나 ID가 충돌하는 신규 작품은 새로운 내부 ID를 배정한다. 파일 내 같은 identity는 첫 행만 사용한다. 외부 ID 없는 JSON 항목은 내부 ID로 구분한다. 기존 데이터에 중복 identity가 이미 있으면 자동 정리하지 않고 중단한다.

명시적 덮어쓰기는 미리보기의 선택이 필요하며 변경 예정 건수도 갱신된다. 빈 값도 덮어쓰므로 선택 전에 파일을 확인한다. 기존 `createdAt`, 빈 입력의 기존 포스터, 알 수 없는 기존 확장 필드는 보존한다. 전체 삭제 경로는 제거했고 레거시 `replace=true` 호출은 오류로 거부한다.

백업은 UUID 키로 `how-many-points-backups`에 별도 저장된다. `version`, `exportedAt`, 전체 `ratings`, revision과 tombstone을 포함한 `records`를 보존한다. 자동 삭제나 보존기간 제한은 없다. 성공한 백업은 이후 병합 실패에도 남는다. 가져오기 화면의 **최근 자동 백업 다운로드**로 다시 받을 수 있다.

`portal_merge_ratings`는 한 PostgreSQL 트랜잭션에서 현재 전체 snapshot과 백업을 대조한 뒤 변경분만 저장한다. 삭제는 실행하지 않는다. tombstone은 자동 복원하지 않는다. 기본 모드에서 기존 내부 ID 갱신과 중복 identity 추가는 서버에서도 차단한다. `SECURITY INVOKER`와 기존 RLS를 사용하며 anon 실행 권한은 없다.

동시 일반 쓰기까지 보호하기 위해 `portal_documents`에 짧은 `SHARE ROW EXCLUSIVE` 잠금을 사용한다. 읽기는 계속 가능하지만 다른 포털 쓰기가 잠시 대기할 수 있다. 잠금 획득은 5초 후 중단한다. 여러 장치가 같은 미리보기로 시도하면 먼저 성공한 뒤의 요청은 snapshot 불일치로 전체 취소된다.

## 오류 복구

1. **파일 파싱·백업 실패:** 평점 저장은 시작하지 않는다. 오류를 해결하고 파일을 다시 선택한다. 클라우드 저장 실패가 남으면 계정·저장의 다시 저장 또는 새로 불러오기로 먼저 해결한다.
2. **낡은 미리보기:** 다른 탭·기기의 변경을 보존하고 전체 병합을 취소한다. 새로 불러온 뒤 파일을 다시 선택하고 변경 건수를 확인한다.
3. **DB 처리 오류:** 한 트랜잭션이므로 변경분 전체가 롤백된다. 개별 항목만 저장되는 상태는 없다.
4. **통신 오류:** 응답을 잃으면 서버가 커밋했을 수 있다. 같은 화면의 재시도·추가 평점 저장을 막는다. 새로 불러와 총건수·신규 작품을 확인한 다음 파일을 다시 가져온다. 이미 반영됐으면 중복으로 표시되므로 기본 모드에서 다시 추가되지 않는다.
5. **의도하지 않은 명시적 덮어쓰기 복구:** 최근 자동 백업을 내려받아 JSON 가져오기에서 덮어쓰기를 선택하고 미리보기 후 복구한다. 현재 데이터도 다시 백업된다. 당시 이후 새로 추가된 작품은 삭제하지 않는다. 완전한 시점 복원이나 삭제된 작품 복원은 별도의 검토가 필요하며 자동 수행하지 않는다.

## 배포 전 확인

이 작업에서는 운영 Supabase에 연결해 변경하거나 Production을 배포하지 않았다. SQL 파일 생성과 PGlite의 임시 PostgreSQL 검증만 수행한다.

- 별도 비운영 DB에 기존 `portal-storage.sql`, `portal-single-account.sql` 구조와 새 `20261105045823_safe_ratings_merge.sql`을 적용하고 PostgREST RPC 노출·권한·잠금 대기를 확인한다.
- 새 RPC를 먼저 준비하고 앱을 배포한다. RPC가 없으면 백업 이후 병합이 실패하며 기존 평점은 변경하지 않는다. 파일 생성만으로 운영 마이그레이션이 적용되지는 않는다.
- 운영 적용 직전 별도 승인을 받고 1,122건(영화 800, TV 322)과 전체 JSON 백업을 확인한다. 운영 데이터로 테스트하지 않는다.
- 데이터가 들어 있는 origin과 계정이 맞는지 확인한다. Preview origin은 이전 브라우저 IndexedDB/localStorage를 공유하지 않는다.
- 실제 대상 브라우저/iframe에서 파일 저장 API 사용 가능 여부 또는 다운로드 확인 절차를 검증한다.
- 백업 namespace는 전체 데이터를 누적 보관하므로 저장량과 초기 로딩 비용을 점검한다. 삭제·보존기간 정책은 별도 승인 대상으로 남긴다.
- 클라이언트 롤백이 필요하면 가져오기를 사용 중지한 뒤 검토한다. 구버전 전체 삭제 UI를 그대로 다시 활성화하면 안 된다. 새 RPC 제거는 저장된 평점·백업 삭제를 요구하지 않는다.

## 화면 변경 범위

기존 버튼·색상 토큰을 사용하는 native dialog를 추가했다. 우선순위는 예상 건수, 덮어쓰기 선택, 백업 상태다. 기본 초점은 취소이며 Escape로 닫을 수 있다. 저장 중 닫기는 차단한다. 최종 병합 버튼은 백업 완료와 파일 확인 이후에만 활성화한다.

Layout: 가져오기 확인창 - 좁은 화면의 긴 안내와 작업 순서 → bounded native dialog + wrapping action cluster; scroll owner: `.safe-import`; 제목과 버튼을 화면 밖으로 넘기는 고정 너비와 중첩 스크롤을 피한다.

## 검증

`tests/howManyPointsImport.test.js`는 실제 PGlite PostgreSQL에 원본 스키마와 새 RPC를 설치하고 실제 `createPortalStorage`, 평점 DB 어댑터, CSV 파서를 실행한다. 영화 800 + TV 322, 재가져오기, 다른 identity 신규 추가, 기존 평점·리뷰 보존, 명시적 덮어쓰기 및 백업 원본, 저장 도중 실패의 전체 롤백, 백업 실패, 다른 장치의 수정, 커밋 응답 유실, malformed CSV, JSON 경로, RLS/anon 권한을 검사한다. 데이터는 모두 합성 데이터다.
