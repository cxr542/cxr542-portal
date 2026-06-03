import { RELEASE_NOTES_MODULE_ID } from './releaseNotes';

export const NAV_LABELS_STORAGE_KEY = 'cxr542-portal-nav-labels-v1';
export const NAV_ORDER_STORAGE_KEY = 'cxr542-portal-nav-order-v1';
export const SIDEBAR_COLLAPSED_KEY = 'cxr542-portal-sidebar-collapsed';

export const PORTAL_NAV_ITEMS = [
  { id: 'home', icon: '🏠', defaultLabel: '포털 홈', tooltip: '모듈 목록·바로가기 홈' },
  {
    id: 'who-are-you',
    icon: '👤',
    defaultLabel: '나는누구?',
    tooltip: '자기소개서·근무·기술경력·학력 관리 · 미리보기',
    homeCta: '나는누구? 열기 →',
    embedPath: '/who-are-you/index.html',
    externalUrl: 'https://career.sw.or.kr',
    externalLabel: 'SW기술자 경력관리(공식)',
  },
  {
    id: 'vision-font',
    icon: '🔤',
    defaultLabel: 'vision-font',
    tooltip: '폰트 프리셋 미리보기·CSS 복사',
    homeCta: 'vision-font 열기 →',
    embedPath: null,
    externalUrl: null,
  },
  {
    id: 'today-shoes',
    icon: '👟',
    defaultLabel: 'today-shoes',
    tooltip: '신발 착화 기록·태그',
    homeCta: 'today-shoes 열기 →',
    embedPath: null,
    externalUrl: 'https://cxr542.github.io/today-shoes/',
    externalLabel: 'Expo 앱 (사진 분석)',
  },
  {
    id: 'marathon',
    icon: '🏃',
    defaultLabel: '마라톤 기록장',
    tooltip: '대회 기록·PB·통계·JSON 백업',
    homeCta: '마라톤 기록장 열기 →',
    embedPath: '/marathon-log/index.html',
    externalUrl: 'https://cxr542.github.io/cxr542-ai/projects/marathon-log/',
    externalLabel: 'GitHub Pages (이전 데이터)',
  },
  {
    id: 'idea-bank',
    icon: '💡',
    defaultLabel: '아이디어 뱅크',
    tooltip: '아이디어 노트·검색·JSON 백업',
    homeCta: '아이디어 뱅크 열기 →',
    embedPath: '/idea-bank/index.html',
    externalUrl: null,
  },
  {
    id: 'prompt-collection',
    icon: '📝',
    defaultLabel: '프롬프트 모음',
    tooltip: 'AI·업무 프롬프트 제목·본문 저장·복사·JSON 백업',
    homeCta: '프롬프트 모음 열기 →',
    embedPath: '/prompt-collection/index.html',
    externalUrl: null,
  },
  {
    id: 'how-many-points',
    icon: '⭐',
    defaultLabel: '너는몇점?',
    tooltip: '영화·시리즈·책·웹툰 평점 · 왓챠 CSV 가져오기',
    homeCta: '너는몇점? 열기 →',
    embedPath: '/how-many-points/index.html',
    externalUrl: null,
  },
  {
    id: 'ai-synapse-wiki',
    icon: '🧠',
    defaultLabel: 'AI-Synapse Wiki',
    tooltip: '한글 AI 지식 Wiki · 주제·허브·스토리',
    homeCta: 'Wiki 열기 →',
    embedPath: null,
    externalUrl: 'https://cxr542.github.io/cxr542-ai/projects/ai-synapse-wiki/',
    externalLabel: 'GitHub Pages Wiki',
  },
  {
    id: 'gemini-tuner',
    icon: '✨',
    defaultLabel: 'GeminiTuner',
    tooltip: 'Gemini FinOps · 토큰·예산 (Chrome 확장)',
    homeCta: 'GeminiTuner 열기 →',
    embedPath: null,
    externalUrl: 'https://github.com/cxr542/GeminiTuner',
    externalLabel: 'Chrome 확장 저장소',
  },
];

export const NAV_IDS = PORTAL_NAV_ITEMS.map((item) => item.id);

export { RELEASE_NOTES_MODULE_ID };

/** URL·라우팅에 쓰는 모듈 id (주 메뉴 + 하단 유틸) */
export const ROUTABLE_MODULE_IDS = [...NAV_IDS, RELEASE_NOTES_MODULE_ID];

export function isRoutableModuleId(id) {
  return ROUTABLE_MODULE_IDS.includes(id);
}

/** 사이드바·홈 카드 기본 순서 (홈 다음에 나는누구?) */
export const DEFAULT_NAV_ORDER = NAV_IDS.slice();

export const DEFAULT_NAV_LABELS = Object.fromEntries(
  PORTAL_NAV_ITEMS.map((item) => [item.id, item.defaultLabel]),
);

export const MODULE_HINTS = Object.fromEntries(
  PORTAL_NAV_ITEMS.filter((item) => item.id !== 'home').map((item) => [item.id, item.tooltip]),
);

const navById = Object.fromEntries(PORTAL_NAV_ITEMS.map((item) => [item.id, item]));

/** 저장된 id 순서로 메뉴 항목 정렬. 없는 id는 기본 순서 뒤에 붙임 */
export function applyNavOrder(order) {
  const safe = Array.isArray(order) ? order.filter((id) => NAV_IDS.includes(id)) : [];
  const seen = new Set();
  const result = [];
  safe.forEach((id) => {
    if (navById[id] && !seen.has(id)) {
      result.push(navById[id]);
      seen.add(id);
    }
  });
  PORTAL_NAV_ITEMS.forEach((item) => {
    if (!seen.has(item.id)) {
      result.push(item);
      seen.add(item.id);
    }
  });
  return result;
}

export function normalizeNavOrder(order) {
  const base = applyNavOrder(order).map((item) => item.id);
  if (base[0] !== 'home') {
    const rest = base.filter((id) => id !== 'home');
    return ['home', ...rest];
  }
  return base;
}
