import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Markdown from '../src/features/github-repos/Markdown.jsx';
import { parseBlocks, safeHref } from '../src/features/github-repos/markdownParse.js';
import { RepoStaleBanner, RepoStatePanel } from '../src/features/github-repos/RepoStatePanel.jsx';
import RepoMetaEditor from '../src/features/github-repos/RepoMetaEditor.jsx';
import RepoDetail from '../src/features/github-repos/RepoDetail.jsx';
import GithubReposPage from '../src/features/github-repos/GithubReposPage.jsx';
import { MAX_TAGS, toRepoView } from '../src/features/github-repos/repoModel.js';
import { createFixtureRepoSource, createMemoryMetaStore, demoStateFromSearch, DEMO_STATES, fixtureRepoRecords } from '../src/features/github-repos/repoSource.js';

const render = (type, props) => renderToStaticMarkup(h(type, props));
const BASE = 'https://github.com/cxr542/alpha/blob/HEAD/';

describe('safe README markdown', () => {
  it('renders raw HTML as text, never as markup', () => {
    const html = render(Markdown, { source: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>', baseUrl: BASE });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('allows only http(s) links and resolves relative ones against the repository', () => {
    const html = render(Markdown, { source: '[bad](javascript:alert(1)) [data](data:text/html,x) [proto](//evil.example) [ok](https://example.com) [doc](./docs/a.md)', baseUrl: BASE });
    expect(html).not.toMatch(/href="(javascript|data|\/\/)/i);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(`href="${BASE}docs/a.md"`);
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('turns images into labelled links instead of loading them', () => {
    const html = render(Markdown, { source: '![build badge](https://img.example/badge.svg)', baseUrl: BASE });
    expect(html).not.toContain('<img');
    expect(html).toContain('[이미지: build badge]');
  });

  it('renders headings below the panel heading level, lists, task items, quotes, code', () => {
    const html = render(Markdown, { source: '# Title\n## Sub\n- [x] done\n- [ ] todo\n1. one\n> quote **bold**\n\n```sh\nnpm i <pkg>\n```\n\nText with `code` and *em*.', baseUrl: BASE });
    expect(html).toContain('<h4 class="repo-md__h1">Title</h4>');
    expect(html).toContain('<h5 class="repo-md__h2">Sub</h5>');
    expect(html).toContain('☑ done');
    expect(html).toContain('☐ todo');
    expect(html).toContain('<ol>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('npm i &lt;pkg&gt;');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<em>em</em>');
  });

  it('caps block count for huge READMEs', () => {
    expect(parseBlocks(Array.from({ length: 1000 }, (_, i) => `# h${i}`).join('\n')).length).toBe(400);
  });

  it.each([
    ['https://a.example/x', 'https://a.example/x'],
    ['javascript:alert(1)', null],
    ['vbscript:x', null],
    ['//evil.example', null],
    ['README.md', `${BASE}README.md`],
    ['', null],
  ])('safeHref(%s)', (url, expected) => {
    expect(safeHref(url, BASE)).toBe(expected);
  });
});

describe('list state screens', () => {
  it.each(['unauthorized', 'forbidden', 'rate_limited', 'not_configured', 'network', 'invalid_response', 'unknown'])('renders an actionable %s state', code => {
    const html = render(RepoStatePanel, { kind: 'error', code, resetAt: '2026-11-24T03:15:00Z', onRetry: () => {} });
    expect(html).toContain('role="alert"');
    expect(html).toContain('다시 시도');
    expect(html).toMatch(/<h3>[^<]+<\/h3>/);
    if (code === 'rate_limited') expect(html).toContain('재시도 가능 시각');
  });

  it('renders an accessible loading skeleton', () => {
    const html = render(RepoStatePanel, { kind: 'loading' });
    expect(html).toContain('불러오는 중');
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(5);
  });

  it('renders empty and stale-data states', () => {
    expect(render(RepoStatePanel, { kind: 'empty', onRetry: () => {} })).toContain('다시 불러오기');
    expect(render(RepoStaleBanner, { code: 'network', onRetry: () => {} })).toContain('이전에 불러온 목록');
  });

  it('starts the page in its loading state before data arrives', () => {
    const html = render(GithubReposPage, { source: createFixtureRepoSource({ state: 'loading' }), metaStore: createMemoryMetaStore() });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('불러오는 중');
  });
});

describe('detail and meta editor', () => {
  const repo = toRepoView(fixtureRepoRecords()[0], { category: '개인 서비스', tags: ['portal', 'react'], note: 'memo', favorite: true });

  it('shows favorite state, tags and metadata in the overview', () => {
    const html = render(RepoDetail, { repo, source: createFixtureRepoSource(), verified: false, persistent: false, categories: ['개인 서비스'], tab: '개요', onTabChange: () => {}, onSaveMeta: () => {} });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('즐겨찾기 해제');
    expect(html).toContain('#portal');
    expect(html).toContain('동기화 후 표시');
  });

  it('labels the sample-mode memo editor and its controls', () => {
    const html = render(RepoMetaEditor, { repo, categories: ['개인 서비스', 'AI·에이전트'], persistent: false, onSave: () => {} });
    expect(html).toContain('샘플 모드');
    expect(html).toContain('aria-label="태그 portal 삭제"');
    expect(html).toContain('>개인 메모</label>');
    expect(html).toMatch(/<button type="button" class="is-primary" disabled="">메모 저장<\/button>/);
    expect(html).toContain('목록에서 숨기기');
  });

  it('hides the sample notice for a persistent store', () => {
    expect(render(RepoMetaEditor, { repo, categories: [], persistent: true, onSave: () => {} })).not.toContain('샘플 모드');
  });
});

describe('memory meta store', () => {
  it('merges patches, normalizes tags and notifies subscribers', async () => {
    const store = createMemoryMetaStore({ a: { category: 'X', tags: [], note: '' } });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.all();
    await store.set('a', { tags: [' MCP ', 'mcp', 'Edu', ...Array.from({ length: 20 }, (_, i) => `t${i}`)], note: 'x'.repeat(6000) });
    const saved = store.get('a');
    expect(saved.category).toBe('X');
    expect(saved.tags.slice(0, 2)).toEqual(['MCP', 'Edu']);
    expect(saved.tags).toHaveLength(MAX_TAGS);
    expect(saved.note).toHaveLength(5000);
    expect(store.all()).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await store.set('b', { favorite: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get('b')).toMatchObject({ favorite: true, hidden: false, tags: [] });
  });

  it('does not share state between stores or mutate the initial object', async () => {
    const initial = { a: { tags: ['x'] } };
    const store = createMemoryMetaStore(initial);
    await store.set('a', { tags: ['y'] });
    expect(initial.a.tags).toEqual(['x']);
    expect(createMemoryMetaStore(initial).get('a').tags).toEqual(['x']);
  });
});

describe('fixture demo states', () => {
  it('accepts only allowlisted ?repoState values', () => {
    expect(demoStateFromSearch('?m=github-repos&repoState=rate_limited')).toBe('rate_limited');
    expect(demoStateFromSearch('?repoState=__proto__')).toBeNull();
    expect(demoStateFromSearch('')).toBeNull();
    expect(DEMO_STATES).toContain('readme_missing');
  });

  it('simulates each state without network access', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const now = () => new Date('2026-11-24T00:00:00Z');
    expect((await createFixtureRepoSource({ state: 'empty', now }).list()).repos).toEqual([]);
    await expect(createFixtureRepoSource({ state: 'rate_limited', now }).list()).rejects.toMatchObject({ code: 'rate_limited', resetAt: '2026-11-24T00:15:00.000Z' });
    await expect(createFixtureRepoSource({ state: 'unauthorized' }).list()).rejects.toMatchObject({ code: 'unauthorized' });
    const pending = await Promise.race([createFixtureRepoSource({ state: 'loading' }).list(), new Promise(resolve => setTimeout(() => resolve('pending'), 20))]);
    expect(pending).toBe('pending');
    const record = fixtureRepoRecords()[0];
    expect(await createFixtureRepoSource({ state: 'readme_missing' }).readme(record)).toBeNull();
    expect(await createFixtureRepoSource().readme(record)).toMatchObject({ sample: true, text: expect.stringContaining(`# ${record.name}`) });
    expect(await createFixtureRepoSource().branches(record)).toMatchObject({ sample: true, items: [{ name: 'main' }] });
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
