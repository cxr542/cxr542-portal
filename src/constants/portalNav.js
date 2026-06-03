export const NAV_LABELS_STORAGE_KEY = 'cxr542-portal-nav-labels-v1';
export const SIDEBAR_COLLAPSED_KEY = 'cxr542-portal-sidebar-collapsed';

export const PORTAL_NAV_ITEMS = [
  { id: 'home', icon: '🏠', defaultLabel: '포털 홈', tooltip: '모듈 목록·바로가기 홈' },
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
];

export const NAV_IDS = PORTAL_NAV_ITEMS.map((item) => item.id);

export const DEFAULT_NAV_LABELS = Object.fromEntries(
  PORTAL_NAV_ITEMS.map((item) => [item.id, item.defaultLabel]),
);

export const MODULE_HINTS = Object.fromEntries(
  PORTAL_NAV_ITEMS.filter((item) => item.id !== 'home').map((item) => [item.id, item.tooltip]),
);
