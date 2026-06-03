/**
 * GitHub Contents API — 운영 Wiki admin (docs/topics, entries.json)
 * Env: GITHUB_TOKEN, WIKI_GITHUB_REPO (default cxr542/AI-Synapse-Wiki), WIKI_GITHUB_BRANCH (main)
 */

import { packMd, assertTopicBody, today } from './topic-md.mjs';

function repoParts() {
  const spec = (process.env.WIKI_GITHUB_REPO || 'cxr542/AI-Synapse-Wiki').trim();
  const [owner, repo] = spec.split('/');
  if (!owner || !repo) throw new Error('WIKI_GITHUB_REPO 형식: owner/repo');
  return { owner, repo, branch: process.env.WIKI_GITHUB_BRANCH || 'main' };
}

function ghHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error('GITHUB_TOKEN 이 설정되지 않았습니다.');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function ghFetch(path, opts = {}) {
  const { owner, repo } = repoParts();
  const url = path.startsWith('http')
    ? path
    : `https://api.github.com/repos/${owner}/${repo}${path}`;
  const res = await fetch(url, { ...opts, headers: { ...ghHeaders(), ...opts.headers } });
  return res;
}

/** @param {string} filePath repo-relative */
export async function getRepoFile(filePath) {
  const { branch } = repoParts();
  const res = await ghFetch(`/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
  const content = Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString(
    'utf8',
  );
  return { content, sha: data.sha };
}

/** @param {string} filePath @param {string} content @param {string} [sha] */
export async function putRepoFile(filePath, content, sha) {
  const { branch } = repoParts();
  const body = {
    message: `wiki(admin): update ${filePath}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await ghFetch(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub PUT ${res.status}`);
  return data;
}

/** @param {string} filePath @param {string} sha */
export async function deleteRepoFile(filePath, sha) {
  const { branch } = repoParts();
  const res = await ghFetch(`/contents/${filePath}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `wiki(admin): delete ${filePath}`,
      sha,
      branch,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub DELETE ${res.status}`);
  return data;
}

export async function readAdminSettings() {
  try {
    const f = await getRepoFile('.wiki-admin-settings.json');
    if (!f) return {};
    return JSON.parse(f.content);
  } catch {
    return {};
  }
}

export async function writeProtectMode(enabled) {
  if (process.env.WIKI_ADMIN_PROTECT === 'true' || process.env.VITE_ADMIN_PROTECT === 'true') {
    throw new Error('WIKI_ADMIN_PROTECT 로 보호 모드가 고정되어 있습니다.');
  }
  const prev = await readAdminSettings();
  const next = { ...prev, protectMode: Boolean(enabled) };
  const path = '.wiki-admin-settings.json';
  const existing = await getRepoFile(path);
  const content = `${JSON.stringify(next, null, 2)}\n`;
  await putRepoFile(path, content, existing?.sha);
  return next;
}

function topicPath(slug) {
  return `docs/topics/${slug}.md`;
}

/**
 * @param {{
 * title: string; slug: string; body: string;
 * source_url?: string | null; tags?: string[]; related?: unknown[];
 * visibility?: string; collected_at?: string;
 * }} payload
 * @param {{ create?: boolean }} opts
 */
export async function saveTopicOnGithub(payload, opts = {}) {
  const slug = String(payload.slug || '').trim();
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    throw new Error('slug 형식이 올바르지 않습니다');
  }
  if (slug === 'new-topic') {
    throw new Error('slug이 new-topic 입니다. 영문 slug(예: gemini)로 바꾸세요.');
  }
  const body = String(payload.body ?? '').trim();
  assertTopicBody(body);
  const path = topicPath(slug);
  const existing = await getRepoFile(path);
  if (opts.create && existing) throw new Error(`이미 존재: topics/${slug}.md`);
  if (!opts.create && !existing) throw new Error(`없음: topics/${slug}.md`);

  let collected_at = payload.collected_at ?? today();
  if (!opts.create && existing) {
    const m = existing.content.match(/^collected_at:\s*(\S+)/m);
    if (m) collected_at = m[1];
  }
  const fm = {
    title: String(payload.title || '').trim(),
    visibility: payload.visibility ?? 'published',
    collected_at,
    tags: payload.tags?.length ? payload.tags : ['topic'],
    related: payload.related ?? [],
  };
  if (payload.source_url) fm.source_url = payload.source_url;

  const md = packMd(fm, body);
  await putRepoFile(path, md, existing?.sha);
  const count = await rebuildEntriesOnGithub();
  return { slug, count };
}

/** @param {string} slug */
export async function deleteTopicOnGithub(slug) {
  const s = slug.trim();
  const path = topicPath(s);
  const existing = await getRepoFile(path);
  if (!existing) throw new Error(`없음: topics/${slug}.md`);
  await deleteRepoFile(path, existing.sha);
  const count = await rebuildEntriesOnGithub();
  return { slug: s, count };
}

/** Minimal front matter parse */
function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, content: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { data: {}, content: raw };
  const block = raw.slice(3, end).trim();
  const content = raw.slice(end + 4).replace(/^\r?\n/, '');
  const data = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { data, content };
}

export async function rebuildEntriesOnGithub() {
  const { branch } = repoParts();
  const res = await ghFetch(`/contents/docs/topics?ref=${encodeURIComponent(branch)}`);
  const items = await res.json();
  if (!res.ok) throw new Error(items.message || 'topics list failed');
  const topicPaths = (Array.isArray(items) ? items : [])
    .filter((t) => t.type === 'file' && t.name?.endsWith('.md'))
    .map((t) => t.path);

  const entries = [];
  for (const p of topicPaths) {
    const f = await getRepoFile(p);
    if (!f) continue;
    const slug = p.replace('docs/topics/', '').replace(/\.md$/, '');
    const { data, content } = parseFrontMatter(f.content);
    entries.push({
      kind: 'topics',
      slug,
      route: `/topics/${slug}`,
      title: data.title ?? slug,
      visibility: data.visibility ?? 'published',
      source_url: data.source_url ?? null,
      collected_at: data.collected_at ?? null,
      updated_at: today(),
      tags: [],
      related: [],
      body: content.trim(),
      meta: data,
    });
  }

  const out = JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2);
  const entriesPath = 'src/data/entries.json';
  const existing = await getRepoFile(entriesPath);
  await putRepoFile(entriesPath, `${out}\n`, existing?.sha);
  return entries.length;
}
