import {
  readMarathonLogRacesFromStorage,
  summarizeMonthlyRaces,
} from './marathon';
import { readList } from './storage';

const SHOES_KEY = 'cxr542-today-shoes-v1';
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

function formatLatestRace(race) {
  if (!race?.name) return '';
  const dist = race.distance === 'full' ? '풀' : race.distance === 'half' ? '하프' : race.distance?.toUpperCase?.() || '';
  return dist ? ` · 최근 ${race.name} (${dist})` : ` · 최근 ${race.name}`;
}

/** 포털 홈 카드에 표시할 모듈별 연결 상태 한 줄 */
export function getHomeSnapshots(now = new Date()) {
  const shoes = readList(SHOES_KEY);
  const races = readMarathonLogRacesFromStorage();
  const raceSummary = summarizeMonthlyRaces(races, now);
  const ideas = readIdeaCount();

  const latestShoe = shoes[0];
  const latestRace = [...races].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  return {
    'vision-font': '프리셋 3종 · 샘플 미리보기 · CSS 복사',
    'today-shoes': shoes.length
      ? `기록 ${shoes.length}건${latestShoe?.model ? ` · 최근 ${latestShoe.model}` : ''}`
      : '착화 기록을 추가해 보세요',
    marathon: raceSummary.count
      ? `이번 달 대회 ${raceSummary.count}건 · ${raceSummary.totalKm.toFixed(1)}km${formatLatestRace(latestRace)}`
      : races.length
        ? `총 ${races.length}건 · PB·대회 기록 조회`
        : '대회 기록·PB·JSON 백업 · 기록장 열기',
    'idea-bank': ideas
      ? `아이디어 ${ideas}개 · 포털 도메인에 저장`
      : '생각을 모아 두세요 · JSON 백업 가능',
  };
}
