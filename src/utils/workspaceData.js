import { raceDistanceKm } from './marathon';
export const TOOL_META = {
  'idea-bank': ['idea','AI·지식','green','떠오른 생각을 놓치지 않게'],
  'prompt-collection': ['prompt','AI·지식','blue','좋은 질문은 다시 쓰세요'],
  marathon: ['run','기록','sand','달린 만큼 쌓이는 기록'],
  'today-shoes': ['shoe','기록','mauve','나의 러닝화 컬렉션'],
  'ai-synapse-wiki': ['wiki','AI·지식','blue','연결하며 쌓아가는 AI 지식'],
  'who-are-you': ['user','개인','green','경력과 나의 이야기를 한곳에'],
  'vision-font': ['eye','개인','sand','내 눈에 편안한 읽기 환경'],
  'how-many-points': ['film','기록','mauve','보고 읽은 것에 나만의 점수'],
  'gemini-tuner': ['sliders','AI·지식','sand','AI 사용량과 비용 살펴보기'],
};
export function recentRecords(cloud) {
  return [['idea-bank','idea-bank'],['prompt-collection','prompt-collection'],['marathon-log','marathon'],['how-many-points','how-many-points']].flatMap(([ns,tool]) =>
    cloud.list(ns).map(row => ({id:row.id,tool,title:String(row.title || row.name || '제목 없는 기록'),at:row.updatedAt || row.createdAt || row.date || ''})))
    .sort((a,b) => (Date.parse(b.at) || 0)-(Date.parse(a.at) || 0)).slice(0,8);
}
export function monthlyRunning(cloud, now = new Date()) {
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const rows = cloud.list('marathon-log').filter(r => String(r.date || '').startsWith(prefix) && r.status !== 'planned' && r.status !== 'dns');
  const distance = r => r.recordKind === 'run' ? Number(r.distanceKm || 0) : raceDistanceKm(r.distance);
  const weeks = [0,0,0,0,0];
  rows.forEach(r => { const day=Number(String(r.date).slice(8,10)); if(day>=1 && day<=31) weeks[Math.floor((day-1)/7)] += Math.max(0,distance(r)||0); });
  return {count:rows.length,totalKm:weeks.reduce((a,b)=>a+b,0),weeks};
}
