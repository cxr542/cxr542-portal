# 안전 병합 검증 결과

작업 기준: `origin/main` 99bc983. 브랜치: `fix/how-many-points-safe-import`.
운영 Supabase 데이터 변경, 운영 마이그레이션 적용, Production 배포는 수행하지 않았다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `public/how-many-points/js/import-plan.js` | 출처·외부 ID 기준 미리보기, 기본 보존, 명시적 덮어쓰기, 파일 내 중복 처리 |
| `public/how-many-points/js/import-flow.js` | CSV·JSON 확인창, 백업·파일 확인·병합 단계와 오류 복구 안내 |
| `public/how-many-points/js/db.js` | 전체 삭제 제거, snapshot과 전체 JSON 백업 생성, 원자적 RPC 호출 |
| `public/how-many-points/js/import-watcha.js` | 여러 줄·따옴표·BOM 처리 및 잘못된 CSV 거부 |
| `public/how-many-points/js/app.js` | CSV·JSON 두 진입 경로를 안전 확인창에 연결, 자동 백업 다운로드 |
| `public/how-many-points/index.html` | 스크립트 순서 및 새 자산 버전 |
| `public/how-many-points/css/app.css` | 모바일·테마 대응 native dialog |
| `src/cloud/storage.js` | snapshot, 단일 RPC 병합, 결과 불명확 시 쓰기 차단, 해당 백업만 재시도 |
| `supabase/migrations/20261105045823_safe_ratings_merge.sql` | 백업·revision 검증, 기존 항목 보호, 원자적 쓰기, RLS 유지 |
| `tests/howManyPointsImport.test.js` | PGlite PostgreSQL·실제 cloud 어댑터를 통한 회귀 테스트 |
| `tests/cloudAdapters.test.js` | 새 비파괴 가져오기 계약에 맞춘 어댑터 통합 검사 |
| `docs/how-many-points-watcha-import.md` | 사용자 안내 정정 |
| `docs/how-many-points-safe-import.md` | 저장 구조, 복구, 위험 요소, 배포 순서 |
| `docs/how-many-points-safe-import-validation.md` | 검증 결과와 변경 파일 목록 |

## 자동 검증

- `npm test`: **29개 파일, 163개 테스트 통과**.
- `npm run lint`: 통과.
- 기본 린트가 `public/**`를 제외하므로 새 모듈·DB 어댑터·CSV 파서는 `npx eslint --no-ignore`로 별도 검사: 통과.
- `npm run build`: 통과.
- `git diff --check`: 통과.
- 새 확인창의 draft guard: 통과.

원본 코드의 문제도 격리된 합성 데이터에서 재현했다. 기존 `importItems(..., false)`는 중복 리뷰를 덮어썼고, `importItems(..., true)`는 1,122건을 신규 1건으로 교체했다. 새 코드는 기본 병합에서 기존 레코드를 그대로 보존하고 전체 교체 호출을 거부한다.

| 시나리오 | 결과 |
| --- | --- |
| 영화 CSV 800건 후 TV CSV 322건 | 영화 800 + 시리즈 322 = 1,122건 |
| 변경된 중복 CSV 800건 재입력 | 추가 0, 변경 예정 0, 기존 1,122건 전체 동일 |
| 신규·다른 출처 작품 및 파일 내 반복 | 신규 identity만 추가, 기존 데이터 동일, 반복 행 추가 없음 |
| 명시적 덮어쓰기 | 선택한 중복만 변경, 기존 createdAt 및 전체 백업 보존 |
| 여러 줄 리뷰·쉼표·따옴표·BOM | 리뷰 내용 유지 |
| 중간 항목의 DB 오류 | 앞서 수행한 삽입도 전체 롤백 |
| 백업 저장 실패·백업 내용 손상 | 병합 거부, 기존 데이터 동일 |
| 백업 실패 후 같은 미리보기에서 재시도 | 해당 백업 실패만 복구, 백업 1개 보존 후 병합 성공 |
| 다른 기기에서 평점 수정 | stale preview 거부, 최신 리뷰 유지 |
| 커밋 응답 유실 | 쓰기 차단, 새로 읽고 재입력해 중복 생성 없음 |
| 삭제 tombstone | 별도 신규 작품 병합 가능, 삭제 항목 자동 복원 거부 |
| JSON 기존 custom ID·확장 필드 | 기존 평점·리뷰·확장 필드 유지 |
| JSON 포스터만 변경 | 명시적 덮어쓰기 시 변경 건수·포스터 반영 |
| JSON 잘못된 형식·CSV 잘못된 형식 | 저장 전 거부 |
| RLS·anon 권한 | 타 계정 데이터 비노출, anon RPC 실행 불가 |

## 브라우저 검증

설치된 Chrome의 별도 임시 프로필과 로컬 PGlite 서버만 사용했다. 운영 클라우드 bootstrap을 로컬 QA transport로 대체하고 실제 빌드된 HTML·스크립트·cloud storage 어댑터를 실행했다. 실제 Supabase 로그인, 읽기, 쓰기는 없었다.

확인한 경로는 CSV 가져오기, JSON 도구막대, JSON 가져오기 패널이다. 미리보기·백업 확인·성공·JSON 미리보기·백업 오류·병합 오류를 390 CSS px 모바일(DPR 3)과 1,440px 데스크톱, light/dark에서 캡처했다. 백업 재시도 성공도 추가 캡처했다. 새 dialog에는 기존 화면의 재설계를 적용하지 않았다.

실제 다운로드된 JSON의 전체 `ratings`가 합성 원본 1,122건과 일치했다. 백업 파일 확인 전 병합 버튼이 비활성이고 취소 시 저장이 없는 것을 관찰했다. 신규 1건 병합 후 1,123건과 기존 리뷰 유지, 같은 CSV 재선택 시 신규 0건, 오류 시 기존 데이터와 백업 보존을 확인했다. 기본 파일 다운로드 방식은 브라우저가 완료 상태를 앱에 제공하지 않으므로 사용자의 파일 확인 단계를 검증했다. 네이티브 OS 파일 선택기는 이 headless QA에서 직접 조작하지 않았다.

| 접근성·화면 항목 | 결과 | 근거 |
| --- | --- | --- |
| light/dark 글자 대비·한글 줄바꿈 | PASS | 24개 캡처의 읽기 전용 화면 검토, 계산된 스타일 검사에서 대비 오류 없음 |
| 버튼 크기 | PASS | 높이 44 CSS px 이상 |
| 좁은 화면 reflow | PASS | 320·390·1,440px에서 dialog 가로 넘침 없음 |
| 텍스트 간격 확대 | PASS | 확대 스타일 적용 시 가로 넘침 없음 |
| 키보드·초점 | native dialog 사용 | 기본 취소 초점과 `:focus-visible`, 저장 중 닫기 차단. 별도 스크린리더 감사는 수행하지 않음 |
| 드래그·인증 | N/A | 새 확인창에는 해당 동작 없음 |

전체 사이트의 WCAG 준수 인증이나 Lighthouse 성능 감사를 의미하지 않는다. 자동 스타일 검사기의 일부 text-occlusion 경고는 native modal 뒤의 비활성 배경 텍스트와 겹친다는 보고였으며 캡처에서 확인창 텍스트의 실제 가림은 없었다. 코드에 무시 속성이나 규칙 완화를 추가하지 않았다.

로컬 QA 원본: `/tmp/ratings-import-evidence/`의 `base-reproduction.json`, `browser-report.json`, PNG, 전체 백업 파일, `layout-probes.json`, `detect.json`. 합성 데이터만 포함하며 운영 데이터 파일은 생성하지 않았다.

## 남은 위험·배포 조건

배포 전 별도 비운영 Supabase에서 RPC 노출·실제 PostgREST 호출·동시 연결의 잠금 동작을 확인해야 한다. PGlite는 PostgreSQL 기능을 검증하지만 운영 네트워크와 PostgREST 설정까지 재현하지 않는다. 새 RPC 미설치 시 가져오기는 실패하며 기존 평점은 보존한다.

테이블 잠금으로 다른 포털 저장이 잠시 대기할 수 있고 전체 백업 누적으로 로딩·저장 비용이 늘 수 있다. 원본 lockfile 설치 시 npm이 기존 의존성 취약점 11건(중간 5, 높음 6)을 보고했으며 이번 변경은 의존성이나 lockfile을 수정하지 않았다. 자세한 적용·복구 절차는 [운영 안내](how-many-points-safe-import.md)를 따른다.
