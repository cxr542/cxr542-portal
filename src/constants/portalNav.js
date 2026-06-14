import { RELEASE_NOTES_MODULE_ID } from './releaseNotes';

export const NAV_LABELS_STORAGE_KEY = 'cxr542-portal-nav-labels-v1';
export const NAV_ORDER_STORAGE_KEY = 'cxr542-portal-nav-order-v1';
export const SIDEBAR_COLLAPSED_KEY = 'cxr542-portal-sidebar-collapsed';

export const PORTAL_NAV_ITEMS = [
  { id: 'home', icon: '🧭', defaultLabel: '포털 홈', tooltip: '모듈 목록·바로가기 홈' },
  {
    id: 'who-are-you',
    icon: '🪪',
    defaultLabel: '나는누구?',
    tooltip: '자기소개서·근무·기술경력·학력 관리 · 미리보기',
    homeCta: '나는누구? 열기 →',
    embedPath: '/who-are-you/index.html',
    externalUrl: 'https://career.sw.or.kr',
    externalLabel: 'SW기술자 경력관리(공식)',
    boardSection: 'active',
    boardStatus: 'Active',
    boardDescription: '정체성/소개 페이지 실험 모듈입니다.',
    boardNextAction: '최신 스냅샷과 소개 문구를 점검합니다.',
  },
  {
    id: 'vision-font',
    icon: '🔎',
    defaultLabel: 'vision-font',
    tooltip: '시력 테스트 · 맞춤 글꼴 · 기사 읽기 · JSON 백업',
    homeCta: 'vision-font 열기 →',
    embedPath: '/vision-font/index.html',
    externalUrl: 'https://cxr542.github.io/cxr542-ai/projects/vision-font/',
    externalLabel: 'GitHub Pages (이전 데모)',
    boardSection: 'active',
    boardStatus: 'Active',
    boardDescription: '시각/폰트 실험 프로젝트입니다.',
    boardNextAction: '샘플 페이지와 외부 링크를 정리합니다.',
  },
  {
    id: 'today-shoes',
    icon: '👟',
    defaultLabel: 'today-shoes',
    tooltip: '신발장 · 3각도 사진 · AI 분석 · JSON 백업',
    homeCta: 'today-shoes 열기 →',
    embedPath: '/today-shoes/index.html',
    externalUrl: 'https://cxr542.github.io/today-shoes/',
    externalLabel: 'Expo 앱 (GitHub Pages)',
    boardSection: 'active',
    boardStatus: 'Active',
    boardDescription: '오늘의 신발/스타일 기록 프로젝트입니다.',
    boardNextAction: '최근 기록 화면과 링크 상태를 확인합니다.',
  },
  {
    id: 'marathon',
    icon: '🏁',
    defaultLabel: '마라톤 기록장',
    tooltip: '대회 기록·PB·통계·JSON 백업',
    homeCta: '마라톤 기록장 열기 →',
    embedPath: '/marathon-log/index.html',
    externalUrl: 'https://cxr542.github.io/cxr542-ai/projects/marathon-log/',
    externalLabel: 'GitHub Pages (이전 데이터)',
    boardSection: 'experiments',
    boardStatus: 'Experiment',
    boardDescription: '마라톤 기록/훈련 로그 실험 프로젝트입니다.',
    boardNextAction: '데이터 구조와 표시 방식을 점검합니다.',
  },
  {
    id: 'idea-bank',
    icon: '💡',
    defaultLabel: '아이디어 뱅크',
    tooltip: '아이디어 노트·검색·JSON 백업',
    homeCta: '아이디어 뱅크 열기 →',
    embedPath: '/idea-bank/index.html',
    externalUrl: null,
    boardSection: 'experiments',
    boardStatus: 'Experiment',
    boardDescription: '아이디어와 실험 후보를 모아두는 프로젝트입니다.',
    boardNextAction: 'workspace ideabank와의 관계를 정리합니다.',
  },
  {
    id: 'prompt-collection',
    icon: '✍️',
    defaultLabel: '프롬프트 모음',
    tooltip: 'AI·업무 프롬프트 제목·본문 저장·복사·JSON 백업',
    homeCta: '프롬프트 모음 열기 →',
    embedPath: '/prompt-collection/index.html',
    externalUrl: null,
    boardSection: 'experiments',
    boardStatus: 'Experiment',
    boardDescription: '프롬프트 모음과 작업 지시문을 정리하는 프로젝트입니다.',
    boardNextAction: 'Codex/Cursor용 프롬프트 분류를 정리합니다.',
  },
  {
    id: 'how-many-points',
    icon: '🎬',
    defaultLabel: '너는몇점?',
    tooltip: '영화·시리즈·책·웹툰 평점 · 왓챠 CSV 가져오기',
    homeCta: '너는몇점? 열기 →',
    embedPath: '/how-many-points/index.html',
    externalUrl: null,
    boardSection: 'paused',
    boardStatus: 'Paused',
    boardDescription: '점수/계산 실험 모듈입니다.',
    boardNextAction: '유지 여부를 검토합니다.',
  },
  {
    id: 'ai-synapse-wiki',
    icon: '🧠',
    defaultLabel: 'AI-Synapse Wiki',
    tooltip: '한글 AI 지식 Wiki · 주제·허브·스토리 · 검색',
    homeCta: 'Wiki 열기 →',
    embedPath: '/ai-synapse-wiki/index.html',
    externalUrl: 'https://cxr542.github.io/cxr542-ai/projects/ai-synapse-wiki/',
    externalLabel: 'GitHub Pages Wiki (미러)',
    boardSection: 'active',
    boardStatus: 'Active',
    boardDescription: 'AI Synapse Wiki 문서를 관리하는 지식 모듈입니다.',
    boardNextAction: '편집 모드와 정적 모드 안내를 분리합니다.',
  },
  {
    id: 'gemini-tuner',
    icon: '🎛️',
    defaultLabel: 'GeminiTuner',
    tooltip: 'FinOps 패널 미리보기 · 스파클 · 한도·예산 (데모)',
    homeCta: 'GeminiTuner 열기 →',
    embedPath: '/gemini-tuner/index.html',
    externalUrl: 'https://github.com/cxr542/GeminiTuner',
    externalLabel: 'Chrome 확장 (실사용)',
    boardSection: 'experiments',
    boardStatus: 'Experiment',
    boardDescription: 'Gemini 관련 튜닝/실험 도구입니다.',
    boardNextAction: 'GitHub 링크와 사용 목적을 명확히 합니다.',
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
