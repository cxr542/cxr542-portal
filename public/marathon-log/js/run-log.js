(function (global) {
  'use strict'

const BASE_HASHTAGS = ['#러닝', '#오런완', '#러닝기록']

const TYPE_LABELS = {
  daily: '데일리 런',
  long: 'LSD 런',
  race: '레이스',
  treadmill: '트레드밀 런',
  crew: '크루 런',
}

function text(value) {
  return String(value || '').trim()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function now() {
  return new Date().toISOString()
}

function detectType(memo) {
  const value = text(memo)
  if (/트레드밀|러닝머신/i.test(value)) return 'treadmill'
  if (/LSD|장거리/i.test(value)) return 'long'
  if (/크루/i.test(value)) return 'crew'
  if (/대회|레이스/i.test(value)) return 'race'
  return 'daily'
}

function detectShoe(memo) {
  const labelled = text(memo).match(/(?:러닝화|신발)\s*[:：]\s*([^\n/]+)/i)
  if (labelled) return text(labelled[1])
  const known = text(memo).match(/(뉴발(?:란스)?\s*[^\n/,.]{0,24}|나이키\s*[^\n/,.]{0,24}|아식스\s*[^\n/,.]{0,24}|아디다스\s*[^\n/,.]{0,24}|호카\s*[^\n/,.]{0,24}|온러닝\s*[^\n/,.]{0,24})/i)
  return known ? text(known[1]) : ''
}

function hasCrew(run) {
  return run.type === 'crew' || (run.tags || []).includes('crew') || /크루/i.test(run.memo)
}

function isLong(run) {
  return run.type === 'long' || /LSD|장거리/i.test(run.memo)
}

function isWeekend(date) {
  if (!date) return false
  const day = new Date(`${date}T12:00:00`).getDay()
  return day === 0 || day === 6
}

function shoeTags(shoe) {
  const value = text(shoe)
  if (!value) return []
  const tags = []
  if (/뉴발/i.test(value)) tags.push('#뉴발란스')
  if (/나이키/i.test(value)) tags.push('#나이키')
  if (/아식스/i.test(value)) tags.push('#아식스')
  if (/아디다스/i.test(value)) tags.push('#아디다스')
  if (/호카/i.test(value)) tags.push('#호카')
  const model = value
    .replace(/뉴발(?:란스)?|나이키|아식스|아디다스|호카|온러닝/gi, '')
    .trim()
    .replace(/\s+/g, '')
  if (model) tags.push(`#${model.replace(/[^0-9a-z가-힣]/gi, '')}`)
  return tags
}

function generateHashtags(run) {
  const tags = BASE_HASHTAGS.slice()
  if (isWeekend(run.date)) tags.push('#주말러닝')
  if (hasCrew(run)) tags.push('#크루런')
  if (isLong(run)) tags.push('#LSD', '#장거리러닝')
  if (run.type === 'treadmill') tags.push('#트레드밀러닝')
  return Array.from(new Set(tags.concat(shoeTags(run.shoe)).concat('#오늘뭐신지'))).join(' ')
}

function generateSnsText(run) {
  const distance = text(run.distanceKm) ? `${text(run.distanceKm)}km` : '오늘의 러닝'
  const shoe = text(run.shoe)
  const memo = text(run.memo)
  const context = hasCrew(run) ? '크루와 함께 한' : '혼자 차분히 채운'
  const shoeLine = shoe ? `${shoe} 신고 ${distance} 완료` : `${distance} 완료`
  const weatherLine = /습도/i.test(text(run.weather) + memo)
    ? '습도가 높아 무리하지 않고, 몸 상태를 보며 마무리했다'
    : '오늘 컨디션에 맞춰 페이스를 지키며 마무리했다'
  const consistency = isLong(run) || /못\s*채움|못한/i.test(memo)
    ? '목표 거리보다 오늘도 꾸준히 나간 시간에 의미 두기'
    : '오늘의 한 걸음이 다음 러닝으로 이어지길'
  return `${context} 러닝 기록\n\n${shoeLine}\n${weatherLine}\n\n${consistency}\n\n${generateHashtags(run)}`
}

function normalizeRunLog(raw = {}) {
  const memo = text(raw.memo || raw.notes)
  const date = text(raw.date) || today()
  const type = raw.type || detectType(memo)
  const tags = Array.from(new Set(Array.isArray(raw.tags) ? raw.tags : /크루/i.test(memo) ? ['crew'] : []))
  const createdAt = raw.createdAt || now()
  const run = {
    id: raw.id || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recordKind: 'run',
    date,
    type,
    tags,
    distanceKm: text(raw.distanceKm),
    duration: text(raw.duration),
    avgPace: text(raw.avgPace),
    avgHeartRate: text(raw.avgHeartRate),
    cadence: text(raw.cadence),
    shoe: text(raw.shoe) || detectShoe(memo),
    weather: text(raw.weather) || (/습도/i.test(memo) ? '습도 높음' : ''),
    condition: text(raw.condition) || (/습도/i.test(memo) ? '습도가 높아 무리하지 않고 마무리' : ''),
    memo,
    imageData: text(raw.imageData),
    createdAt,
    updatedAt: now(),
  }
  run.hashtags = text(raw.hashtags) || generateHashtags(run)
  run.snsText = text(raw.snsText) || generateSnsText(run)
  return run
}

function createRunDraft(input = {}) {
  return normalizeRunLog(input)
}

function runTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS.daily
}

global.MarathonRunLog = { createRunDraft, generateHashtags, generateSnsText, normalizeRunLog, runTypeLabel }
})(window)
