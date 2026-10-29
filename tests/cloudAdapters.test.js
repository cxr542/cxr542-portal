import fs from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

function loadAdapter(app, globalName, initial = []) {
  const namespaces = new Map([[app, new Map(initial.map(row => [row.id, row]))]])
  const table = name => {
    if (!namespaces.has(name)) namespaces.set(name, new Map())
    return namespaces.get(name)
  }
  const context = { Date, Math, Promise, crypto, console, PortalCloud: {
    list: namespace => [...table(namespace).values()].map(row => structuredClone(row)),
    read: (namespace, key) => structuredClone(table(namespace).get(key) || null),
    write: async (namespace, key, value) => {
      if (value === null) table(namespace).delete(key)
      else table(namespace).set(key, structuredClone(value))
      return structuredClone(value)
    },
    clear: async namespace => table(namespace).clear(),
  } }
  context.window = context
  vm.runInNewContext(fs.readFileSync(new URL(`../public/${app}/js/db.js`, import.meta.url), 'utf8'), context)
  return context[globalName]
}

describe('embedded tools using cloud records', () => {
  it.each([
    ['idea-bank', 'IdeaBankDb', 'Ideas', 'Idea', 'ideas'],
    ['how-many-points', 'HowManyPointsDb', 'Ratings', 'Rating', 'ratings'],
    ['marathon-log', 'MarathonDb', 'Races', 'Race', 'races'],
  ])('%s round trips imports and deletes through its cloud adapter', async (app, globalName, plural, singular, payloadKey) => {
    const db = loadAdapter(app, globalName)
    await expect(db.getStorageMode()).resolves.toBe('supabase')
    await expect(db.seedIfEmpty()).resolves.toEqual([])
    await db.importPayload({ [payloadKey]: [{ id: 'record', title: '제목', name: '대회', body: '본문', date: '2026-10-01' }] }, true)
    expect(await db['list' + plural]()).toHaveLength(1)
    expect((await db['get' + singular]('record')).id).toBe('record')
    expect(db.exportPayload(await db['list' + plural]())[payloadKey]).toHaveLength(1)
    await db['delete' + singular]('record')
    expect(await db['list' + plural]()).toEqual([])
  })

  it('normalizes legacy idea content when opening an imported record', async () => {
    const db = loadAdapter('idea-bank', 'IdeaBankDb', [{ id: 'old', content: '기존 본문' }])
    expect(await db.getIdea('old')).toMatchObject({ body: '기존 본문', content: '기존 본문', status: 'inbox' })
  })

  it('keeps an explicitly cleared idea body empty through save and reload', async () => {
    const db = loadAdapter('idea-bank', 'IdeaBankDb', [{ id: 'old', body: '원문', content: '원문', rawText: '원문' }])
    const draft = await db.getIdea('old')
    draft.body = ''
    await db.putIdea(draft)
    expect(await db.getIdea('old')).toMatchObject({ body: '', content: '', rawText: '' })
    expect((await db.listIdeas())[0].body).toBe('')
  })

  it('round trips the career singleton and independent lists without seeding personal data', async () => {
    const db = loadAdapter('who-are-you', 'WhoAreYouDb')
    expect((await db.seedIfEmpty()).profile.name).toBe('')
    await db.saveProfile({ name: '테스트', skills: ['개발'] })
    await db.putProject({ id: 'project', title: '작업' })
    const bundle = await db.loadBundle()
    expect(bundle.profile.name).toBe('테스트')
    expect(bundle.projects).toHaveLength(1)
    await db.deleteProject('project')
    expect(await db.listProjects()).toEqual([])
    expect((await db.getProfile()).name).toBe('테스트')
  })
})
