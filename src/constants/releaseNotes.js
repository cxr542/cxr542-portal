/** 사이드바 하단 전용 — 주 메뉴 순서·이름 변경 대상 아님 */
export const RELEASE_NOTES_MODULE_ID = 'release-notes';

export const RELEASE_NOTES_LABEL = '릴리즈 노트';

/** @typedef {{ type: 'feat'|'fix'|'docs'|'chore', text: string }} ReleaseNoteItem */

/** @type {{ version: string, date: string, title: string, items: ReleaseNoteItem[] }[]} */
export const RELEASE_NOTES = [
  {
    version: '0.2.0',
    date: '2026-06-03',
    title: '포털 모듈 확장 · 메뉴 순서 · 왓챠 가져오기',
    items: [
      { type: 'fix', text: 'vision-font — 운영에서도 개발과 동일한 /vision-font/ 웹 데모 iframe 사용 (MVP 프리셋 제거)' },
      { type: 'feat', text: '프롬프트 모음 — 제목·본문 저장, 복사, JSON 백업' },
      { type: 'feat', text: '너는몇점? — 영화·시리즈·책·웹툰 평점, 왓챠 CSV 가져오기 (v2, API 403 시 DOM 수집)' },
      { type: 'feat', text: '나는누구? — 자기소개서·근무·기술·학력·자격, 미리보기·인쇄' },
      { type: 'feat', text: 'vision-font, today-shoes, AI-Synapse Wiki, GeminiTuner 모듈 연동' },
      { type: 'feat', text: '설정 → 메뉴 순서 변경 (↑↓), 기본 순서: 홈 → 나는누구? → …' },
      { type: 'fix', text: '메뉴 표시명 「너는누구?」→「나는누구?」 자동 마이그레이션' },
      { type: 'docs', text: 'docs/how-many-points-watcha-import.md — 왓챠 403·Snippets 안내' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05',
    title: '포털 MVP',
    items: [
      { type: 'feat', text: '사이드바·환경 배지·모듈 iframe 임베드' },
      { type: 'feat', text: '마라톤 기록장, 아이디어 뱅크, 홈 모듈 카드·스냅샷' },
      { type: 'feat', text: '설정 → 메뉴 이름 변경' },
      { type: 'chore', text: 'Vercel 배포·GitHub Pages 연동' },
    ],
  },
];

export const RELEASE_NOTE_TYPE_LABEL = {
  feat: '기능',
  fix: '수정',
  docs: '문서',
  chore: '기타',
};

export function latestReleaseVersion() {
  return RELEASE_NOTES[0]?.version || '0.1.0';
}
