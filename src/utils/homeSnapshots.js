import { summarizeMonthlyDistance } from './marathon';
import { readList } from './storage';

const SHOES_KEY = 'cxr542-today-shoes-v1';
const MARATHON_KEY = 'cxr542-marathon-log-v1';
const IDEA_LS_KEY = 'idea-bank-ideas';

function readIdeaCount() {
  try {
    const raw = localStorage.getItem(IDEA_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** 포털 홈 카드에 표시할 모듈별 연결 상태 한 줄 */
export function getHomeSnapshots(now = new Date()) {
  const shoes = readList(SHOES_KEY);
  const marathon = readList(MARATHON_KEY);
  const summary = summarizeMonthlyDistance(marathon, now);
  const ideas = readIdeaCount();

  const latestShoe = shoes[0];
  const latestRun = marathon[0];

  return {
    'vision-font': '프리셋 3종 · 샘플 미리보기 · CSS 복사',
    'today-shoes': shoes.length
      ? `기록 ${shoes.length}건${latestShoe?.model ? ` · 최근 ${latestShoe.model}` : ''}`
      : '착화 기록을 추가해 보세요',
    marathon: summary.count
      ? `이번 달 ${summary.count}회 · ${summary.totalKm.toFixed(1)}km${latestRun ? ` · 최근 ${latestRun.distance}km` : ''}`
      : marathon.length
        ? `총 ${marathon.length}건 · 이번 달 기록을 추가해 보세요`
        : '러닝 기록을 추가해 보세요',
    'idea-bank': ideas
      ? `아이디어 ${ideas}개 · 포털 도메인에 저장`
      : '생각을 모아 두세요 · JSON 백업 가능',
  };
}
