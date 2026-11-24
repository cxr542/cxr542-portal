// GitHub metadata and user-defined data are kept apart.
// - RepoRecord: read-only, comes from a RepoSource (fixture now, GitHub API in Phase 2).
// - UserMeta: category/tags/favorite/note/hidden, keyed by RepoRecord.key (Phase 3 persists it).
// Keys use GitHub's stable numeric repository id, so renames keep user data attached.

export const ORIGIN_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'own', label: '내 프로젝트' },
  { id: 'fork', label: 'Fork·외부 원본' },
];

export function repoKey(id) {
  return `github:${id}`;
}

/** Maps a GitHub REST `GET /user/repos` / `GET /users/{u}/repos` item to a RepoRecord. */
export function normalizeGithubRepo(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isSafeInteger(raw.id) || typeof raw.name !== 'string') {
    throw new TypeError('invalid_repository');
  }
  return {
    key: repoKey(raw.id),
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name || raw.name,
    description: raw.description || '',
    fork: raw.fork === true,
    forkVerified: true,
    visibility: raw.private ? 'private' : (raw.visibility || 'public'),
    archived: raw.archived === true,
    language: raw.language || '',
    topics: Array.isArray(raw.topics) ? raw.topics.filter(t => typeof t === 'string') : [],
    stars: Number(raw.stargazers_count) || 0,
    defaultBranch: raw.default_branch || '',
    pushedAt: raw.pushed_at || null,
    updatedAt: raw.updated_at || null,
    url: typeof raw.html_url === 'string' && raw.html_url.startsWith('https://github.com/') ? raw.html_url : `https://github.com/${raw.full_name || raw.name}`,
  };
}

export function originLabel(repo) {
  if (repo.forkVerified) return repo.fork ? 'Fork' : '직접 제작';
  return repo.fork ? '외부 원본 추정' : '직접 제작 추정';
}

export const MAX_TAGS = 12;

export function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const id = tag.toLocaleLowerCase();
    if (tag && !seen.has(id)) { seen.add(id); out.push(tag); }
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export const EMPTY_META = Object.freeze({ category: '', status: '', tags: [], favorite: false, note: '', hidden: false });

export function toRepoView(repo, meta) {
  const m = { ...EMPTY_META, ...(meta || {}) };
  return { ...repo, category: m.category || '미분류', status: m.status || (repo.archived ? '보관' : ''), tags: m.tags, favorite: m.favorite, note: m.note, hidden: m.hidden, origin: originLabel(repo) };
}

export function filterRepoViews(views, { query = '', category = '전체', origin = 'all', visibility = 'all', includeHidden = false } = {}) {
  const keyword = query.trim().toLocaleLowerCase();
  return views.filter(repo => (includeHidden || !repo.hidden)
    && (category === '전체' || repo.category === category)
    && (origin === 'all' || (origin === 'fork') === repo.fork)
    && (visibility === 'all' || repo.visibility === visibility)
    && (!keyword || [repo.name, repo.description, repo.language, repo.category, ...repo.topics, ...repo.tags]
      .some(value => String(value || '').toLocaleLowerCase().includes(keyword))));
}

export const SORTS = [
  { id: 'name', label: '이름순' },
  { id: 'category', label: '카테고리순' },
  { id: 'pushed', label: '최근 활동순' },
];

export function sortRepoViews(views, sort = 'name') {
  const byName = (a, b) => a.name.localeCompare(b.name, 'ko', { sensitivity: 'base' });
  const compare = {
    name: byName,
    category: (a, b) => a.category.localeCompare(b.category, 'ko') || byName(a, b),
    pushed: (a, b) => (b.pushedAt || '').localeCompare(a.pushedAt || '') || byName(a, b),
  }[sort] || byName;
  return [...views].sort((a, b) => Number(b.favorite) - Number(a.favorite) || compare(a, b));
}
