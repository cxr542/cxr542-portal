export const MARATHON_LOG_LS_KEY = 'marathon-log-races';

export const RACE_DISTANCE_KM = {
  full: 42.195,
  half: 21.097,
  '10k': 10,
  '5k': 5,
  '32k': 32,
  '50k': 50,
};

export function raceDistanceKm(distance) {
  return RACE_DISTANCE_KM[distance] ?? 0;
}

/** 포털 MVP 거리 로그 (km 숫자) */
export function summarizeMonthlyDistance(logs, targetDate = new Date()) {
  const month = targetDate.getMonth();
  const year = targetDate.getFullYear();
  const monthLogs = logs.filter((log) => {
    const createdAt = new Date(log.createdAt);
    return createdAt.getFullYear() === year && createdAt.getMonth() === month;
  });
  const totalKm = monthLogs.reduce((sum, log) => sum + Number(log.distance || 0), 0);
  return { count: monthLogs.length, totalKm };
}

/** marathon-log 대회 기록 (date, distance, status) */
export function summarizeMonthlyRaces(races, targetDate = new Date()) {
  const month = targetDate.getMonth();
  const year = targetDate.getFullYear();
  const monthRaces = races.filter((race) => {
    if (!race?.date || race.status === 'planned' || race.status === 'dns') return false;
    const raceDate = new Date(`${race.date}T12:00:00`);
    return raceDate.getFullYear() === year && raceDate.getMonth() === month;
  });
  const totalKm = monthRaces.reduce((sum, race) => sum + raceDistanceKm(race.distance), 0);
  return { count: monthRaces.length, totalKm };
}

export function readMarathonLogRacesFromStorage() {
  try {
    const raw = localStorage.getItem(MARATHON_LOG_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
