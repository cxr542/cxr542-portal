import {
  readMarathonLogRacesFromStorage,
  summarizeMonthlyRaces,
} from './marathon';
import { isGeminiTunerWebDemoEmbed } from './geminiTunerDev';

const TODAY_SHOES_LS_KEY = 'today-shoes-shoes-v1';
const IDEA_LS_KEY = 'idea-bank-ideas';
const PROMPT_LS_KEY = 'prompt-collection-prompts';
const RATINGS_LS_KEY = 'how-many-points-ratings';

function readWhoAreYouSummary() {
  try {
    const raw = localStorage.getItem('who-are-you-summary');
    const s = raw ? JSON.parse(raw) : null;
    if (!s) return null;
    const n = (s.employments || 0) + (s.documents || 0);
    return n ? s : null;
  } catch {
    return null;
  }
}

function readIdeaCount() {
  try {
    const raw = localStorage.getItem(IDEA_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readPromptCount() {
  try {
    const raw = localStorage.getItem(PROMPT_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readRatingsCount() {
  try {
    const raw = localStorage.getItem(RATINGS_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readTodayShoesCount() {
  try {
    const raw = localStorage.getItem(TODAY_SHOES_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readLatestShoeNickname() {
  try {
    const raw = localStorage.getItem(TODAY_SHOES_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || !parsed.length) return '';
    const sorted = [...parsed].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    return String(sorted[0]?.nickname || sorted[0]?.model || '').trim();
  } catch {
    return '';
  }
}

function formatLatestRace(race) {
  if (!race?.name) return '';
  const dist = race.distance === 'full' ? '풀' : race.distance === 'half' ? '하프' : race.distance?.toUpperCase?.() || '';
  return dist ? ` · 최근 ${race.name} (${dist})` : ` · 최근 ${race.name}`;
}

/** 포털 홈 카드에 표시할 모듈별 연결 상태 한 줄 */
export function getHomeSnapshots(now = new Date()) {
  const shoeCount = readTodayShoesCount();
  const latestShoeName = readLatestShoeNickname();
  const races = readMarathonLogRacesFromStorage();
  const raceSummary = summarizeMonthlyRaces(races, now);
  const ideas = readIdeaCount();
  const prompts = readPromptCount();
  const ratings = readRatingsCount();
  const career = readWhoAreYouSummary();

  const latestRace = [...races].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  return {
    'vision-font': '시력 테스트 · 맞춤 글꼴 · 기사 읽기 · JSON 백업',
    'today-shoes': shoeCount
      ? `신발 ${shoeCount}켤${latestShoeName ? ` · 최근 ${latestShoeName}` : ''}`
      : '신발장 · 사진 등록 · AI 분석 · JSON 백업',
    marathon: raceSummary.count
      ? `이번 달 대회 ${raceSummary.count}건 · ${raceSummary.totalKm.toFixed(1)}km${formatLatestRace(latestRace)}`
      : races.length
        ? `총 ${races.length}건 · PB·대회 기록 조회`
        : '대회 기록·PB·JSON 백업 · 기록장 열기',
    'idea-bank': ideas
      ? `아이디어 ${ideas}개 · 포털 도메인에 저장`
      : '생각을 모아 두세요 · JSON 백업 가능',
    'prompt-collection': prompts
      ? `프롬프트 ${prompts}개 · 검색·복사·JSON 백업`
      : 'Keep 대신 제목·본문으로 정리 · JSON 백업',
    'how-many-points': ratings
      ? `평가 ${ratings}건 · 영화·시리즈·책·웹툰`
      : '왓챠피디아형 평점 · CSV·JSON 가져오기',
    'who-are-you': career
      ? `근무 ${career.employments || 0} · 프로젝트 ${career.projects || 0} · 자소서 ${career.documents || 0}`
      : '자기소개서·경력 구조화 · 미리보기·JSON',
    'ai-synapse-wiki': '한글 AI Wiki · 주제·허브·검색 · 정적 빌드',
    'gemini-tuner': isGeminiTunerWebDemoEmbed()
      ? '웹 데모 · Gemini FinOps · 스파클'
      : 'Chrome 확장 · 토큰·예산 FinOps',
  };
}
