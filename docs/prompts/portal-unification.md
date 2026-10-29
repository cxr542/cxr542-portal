# 최신 포털 프롬프트 통합 — 2026-10-29

## 원인과 변경

운영 포털의 후속 배포는 `portal_documents` 기반 범용 저장 어댑터를 사용했고 기존 전용 프롬프트 API가 빠져 있었다. 동시에 포털 계정과 MCP 계정의 사용자 ID도 달랐다. 동일 Supabase 프로젝트만 사용하는 것으로는 같은 데이터가 표시되지 않는다.

현재 운영 기준 배포 `dpl_HbiZEJk14Nmkbjyxoo4uNUZuNVXR`의 소스 253개를 확인하고 환경 파일은 복사하지 않았다. 최신 워크스페이스 UI, 포털 로그인, 마라톤·신발·업무 기능은 그대로 보존하며 프롬프트 연결만 변경한다.

통합된 정식 소스는 `src/cloud/promptTransport.js`, `public/prompt-collection/js/db.js`, `src/cloud/bootstrap.js` 및 `src/cloud/migration.js`다. 임시 패치 도구 없이 루트에서 빌드한다. ChatGPT OAuth/원본 이관 화면은 `apps/prompt-actions/public/prompt-collection`로 분리했다.

- 포털: `npm ci && npm test && npm run build`
- ChatGPT 전용 배포 패키지: `npm run package:prompt-actions` (HTTPS `PROMPTS_PILOT_ORIGIN` 지정)
- 운영 전용 패키지: `PROMPTS_BUNDLE_TARGET=production PROMPTS_PILOT_ORIGIN=https://cxr542-prompt-actions-test.vercel.app npm run package:prompt-actions`
- 계정·비밀번호·토큰·원본 백업은 Git/Vercel 업로드에서 제외한다.

- 기존 Supabase 포털 세션을 재사용하는 전용 `/api/prompts` transport.
- body/content, pinned/favorite 변환 및 기존 편집 화면 유지. 숨겨진 category/tags/description 보존.
- 실제 JWT 사용자별 RLS 유지. 다른 사용자 ID로 임의 접근하거나 API에서 소유자를 대체하지 않음.
- 편집을 시작한 version으로 수정/삭제하며 충돌 시 입력을 유지하고 알림.
- 신규 저장 재시도에 같은 request_id 사용.
- JSON 및 공통 브라우저 이관도 같은 전용 API 사용. 원본 메타데이터 보존, 결정적 request_id, 전체 삭제 가져오기 거부, 삭제 항목 자동 복원 금지.
- 다른 도구는 기존 portal_documents 저장 경로 유지. 프롬프트 API 장애가 홈에서 다른 도구 진입을 막지 않도록 분리.
- 목록 진입/화면 복귀 시 서버 재조회. 편집 중인 초안은 자동 새로고침하지 않음.

## 계정 통합

포털 사용자: `portal-owner@cxr542.invalid`.
기존 ChatGPT 사용자: `prompt-preview-owner-f17a91e7@example.invalid`.

서로 다른 사용자라 프롬프트 API를 통일해도 데이터는 합쳐지지 않는다. 마지막 단계에서 사용자가 ChatGPT의 기존 앱 연결을 포털 사용자로 다시 인증해야 한다. 포털 이메일과 기존 포털 비밀번호를 사용한다. 시크릿 재발급, 앱 삭제, RLS 완화, 소유자 우회 매핑은 필요하지 않다.

복구 OOTD 원본은 기존 계정에 보존한다. 포털 계정에 가져오기 후 본문·태그·즐겨찾기를 검증하며 기존 레코드는 삭제하지 않는다. 신규 공유 DB 스키마/다른 회사 저장소 변경 없음.

## 검증

- 전용 API 및 bridge: 105개 테스트 통과.
- 최신 운영 기준 UI/로그인/마라톤/공통 저장 회귀: 71개 테스트 통과.
- 실제 배포 API: 인증 401, 기존 OOTD 조회, 새 임시 등록, 타 사용자 조회 404, 수정, stale version 409, 삭제 검증. 임시 레코드는 soft delete.
- 최종 운영 배포: dpl_BPWYyPTxBGgAnXcUEzEy45WBGgDT.

## 확장 범위

마라톤 등 다른 도구는 이미 사용자별 공통 Supabase 저장을 사용한다. ChatGPT에서 관리하려면 도구별 스키마·입력 검증·소유권·중복 방지·revision·감사 기록을 갖춘 API 및 MCP 도구가 별도로 필요하다. 이번 변경은 프롬프트에 한정하며, 다른 도구가 자동으로 ChatGPT에 노출되지 않는다.

## 롤백

운영 주소를 기준 배포 HbiZEJk14Nmkbjyxoo4uNUZuNVXR로 복원 가능. 전용 프롬프트 데이터는 삭제하지 않는다. 롤백하면 UI는 이전 범용 저장소를 다시 조회하므로 데이터가 삭제된 것이 아니라 경로가 달라졌음을 명확히 안내한다.

Safari 실사용: 최신 워크스페이스에서 OOTD 1건을 포털 사용자로 가져오기 완료. id `aa26dab3-def9-49c4-a16d-c86622c0149d`, 본문 해시·태그·즐겨찾기 일치 확인. 기존 테스트 계정 레코드 `c28a36e9-04b6-4d17-9ec0-cb7012a60b7c` 보존. ChatGPT 계정 재인증은 사용자 진행 대기.

Safari가 이전 고정 이름 cloud.js를 캐시한 상태와 새 어댑터가 섞이는 문제를 실제 관측했다. cloud entry 파일명을 콘텐츠 해시로 생성하고 HTML 참조를 갱신했으며, 이전 문서 호환용 cloud.js도 남겼다. 배포 후 일반 새로고침으로 확인한다.

최종 확인: Safari 일반 새로고침 후 최신 UI에서 전체 프롬프트 1개/OOTD 정상 표시. ChatGPT 관리 화면에는 기존 테스트 계정이 Primary로 연결되어 있고, 다른 계정 연결 버튼이 있다. 기존 연결 해제 없이 추가 연결 가능. 추가 연결 확인 창까지 열었으나 최종 연결 버튼은 자동 승인 검토에서 사용자 명시 승인 부족으로 차단되어 누르지 않았다. 사용자가 직접 클릭하거나 연결 시작을 명시 승인한 뒤 포털 계정 인증과 Primary 변경/동일 레코드 조회를 검증해야 한다.

최종 계정 통합 완료: 사용자 명시 승인 후 ChatGPT 관리 화면에서 기존 테스트 사용자 OAuth 연결만 해제했다. 포털 사용자 연결은 유지했다. 갱신된 도구 스키마의 포털 계정 link_id를 명시해 get_prompt 및 favorite OOTD 검색을 수행했고, 둘 다 포털 레코드 `aa26dab3-def9-49c4-a16d-c86622c0149d`와 소유자 `e9618f3b-cb70-4d54-84e5-fea326f278d3`를 반환했다. 본문/태그/favorite/version=1 일치. 기존 테스트 사용자 프롬프트 데이터는 삭제하지 않았다. 이후 이 대화에서 앱을 사용할 때는 포털 계정 연결을 선택한다.
