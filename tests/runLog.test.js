import fs from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const context = { Date, Math }
context.window = context
vm.runInNewContext(
  fs.readFileSync(new URL('../public/marathon-log/js/run-log.js', import.meta.url), 'utf8'),
  context,
)
const { createRunDraft, generateHashtags, generateSnsText, normalizeRunLog } = context.MarathonRunLog

describe('run-log helpers', () => {
  it('creates an editable long crew draft from a running memo', () => {
    const draft = createRunDraft({
      date: '2026-06-21',
      memo: '러닝화: 뉴발 엘리트 v4\n어제 못한 LSD를 하려했는데 습도가 높아서 20k 못채움. 크루와 함께 하는 주말 러닝',
      imageData: 'data:image/png;base64,abc',
    })

    expect(draft.type).toBe('long')
    expect(draft.tags).toContain('crew')
    expect(draft.shoe).toBe('뉴발 엘리트 v4')
    expect(draft.weather).toBe('습도 높음')
    expect(draft.condition).toBe('습도가 높아 무리하지 않고 마무리')
    expect(draft.imageData).toBe('data:image/png;base64,abc')
  })

  it('builds Threads copy and hashtags from record context', () => {
    const run = normalizeRunLog({
      date: '2026-06-21',
      type: 'long',
      tags: ['crew'],
      distanceKm: '16',
      duration: '1:36:00',
      avgPace: '6:00',
      shoe: '뉴발 엘리트 v4',
      weather: '습도 높음',
      memo: '어제 못한 LSD를 하려 했지만 습도가 높아서 20k 못 채움. 크루와 함께 하는 주말 러닝',
    })

    expect(generateHashtags(run)).toContain('#주말러닝')
    expect(generateHashtags(run)).toContain('#크루런')
    expect(generateHashtags(run)).toContain('#LSD')
    expect(generateHashtags(run)).toContain('#오늘뭐신지')
    expect(generateSnsText(run)).toContain('16km')
    expect(generateSnsText(run)).toContain('#러닝')
  })

  it('keeps legacy race data intact while adding RunLog defaults', () => {
    const run = normalizeRunLog({ id: 'run-1', memo: '트레드밀 러닝' })

    expect(run.recordKind).toBe('run')
    expect(run.type).toBe('treadmill')
    expect(run.snsText).toContain('#트레드밀러닝')
    expect(run.createdAt).toBeTruthy()
  })
})
