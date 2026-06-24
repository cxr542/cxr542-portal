import fs from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

function loadIdeaBankDb() {
  const values = new Map()
  const context = {
    Date,
    Math,
    Promise,
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null
      },
      setItem(key, value) {
        values.set(key, String(value))
      },
      removeItem(key) {
        values.delete(key)
      },
    },
  }
  context.window = context
  vm.runInNewContext(
    fs.readFileSync(new URL('../public/idea-bank/js/db.js', import.meta.url), 'utf8'),
    context,
  )
  return context.IdeaBankDb
}

describe('idea-bank data compatibility', () => {
  it('creates a quick-capture compatible idea with inbox defaults', () => {
    const db = loadIdeaBankDb()
    const idea = db.normalizeIdea({ body: '첫 줄 제목\n추가 설명' })

    expect(idea.title).toBe('첫 줄 제목')
    expect(idea.status).toBe('inbox')
    expect(idea.content).toBe('첫 줄 제목\n추가 설명')
    expect(idea.rawText).toBe('첫 줄 제목\n추가 설명')
    expect(idea.tags).toEqual([])
  })

  it('derives an editable title from the first non-empty content line', () => {
    const db = loadIdeaBankDb()

    expect(db.titleFromBody('\n\n바로 저장한 아이디어\n세부 내용')).toBe('바로 저장한 아이디어')
  })

  it('keeps existing status and JSON fields when normalizing legacy ideas', () => {
    const db = loadIdeaBankDb()
    const idea = db.normalizeIdea({
      id: 'legacy-idea',
      title: '기존 아이디어',
      body: '기존 본문',
      status: 'promoted',
      tags: ['product'],
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    expect(idea.id).toBe('legacy-idea')
    expect(idea.status).toBe('promoted')
    expect(idea.tags).toEqual(['product'])
    expect(idea.createdAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('preserves JSON import fields used by the detail editor', async () => {
    const db = loadIdeaBankDb()
    await db.importPayload(
      {
        ideas: [
          {
            id: 'imported-idea',
            title: '가져온 아이디어',
            content: 'JSON에서 가져온 본문',
            status: 'planning',
            tags: ['product'],
            links: 'https://example.com',
            memo: '상세 메모',
          },
        ],
      },
      true,
    )

    await expect(db.getIdea('imported-idea')).resolves.toMatchObject({
      body: 'JSON에서 가져온 본문',
      status: 'planning',
      tags: ['product'],
      links: 'https://example.com',
      memo: '상세 메모',
    })
  })
})
