/** AI-Synapse Wiki (/ai-synapse-wiki/) — 개발 서버에서만 포털 iframe 임베드 */
export const AI_SYNAPSE_WIKI_APP_URL = '/ai-synapse-wiki/index.html';

export const AI_SYNAPSE_WIKI_GITHUB_PAGES_URL =
  'https://cxr542.github.io/cxr542-ai/projects/ai-synapse-wiki/';

export const AI_SYNAPSE_WIKI_REPO_URL = 'https://github.com/cxr542/AI-Synapse-Wiki';

export const WIKI_IMPROVE_DOC = '/docs/ai-synapse-wiki-improve.md';

/** Wiki Vite dev (포털 5173과 분리) */
export const WIKI_DEV_API_DEFAULT_URL = 'http://localhost:5174';

/** 포털 정적 경로 (읽기·SPA fallback) */
export const AI_SYNAPSE_WIKI_ADMIN_HOME = '/ai-synapse-wiki/admin';
export const AI_SYNAPSE_WIKI_ADMIN_TOPICS = '/ai-synapse-wiki/admin/topics';
export const AI_SYNAPSE_WIKI_ADMIN_REGISTER_NL = '/ai-synapse-wiki/admin/topics/register/nl';
export const AI_SYNAPSE_WIKI_ADMIN_REGISTER_NEW = '/ai-synapse-wiki/admin/topics/register/new';

/** Wiki dev Vite base — `VITE_BASE=/ai-synapse-wiki/` 로 dev 실행 시 포털과 동일 */
export const WIKI_DEV_APP_BASE = '/ai-synapse-wiki';

export const WIKI_DEV_PATH_HOME = '/';
export const WIKI_DEV_PATH_ADMIN_TOPICS = '/admin/topics';
export const WIKI_DEV_PATH_REGISTER_NL = '/admin/topics/register/nl';
export const WIKI_DEV_PATH_REGISTER_NEW = '/admin/topics/register/new';

export function isAiSynapseWikiWebDemoEmbed() {
  return import.meta.env.DEV;
}

export function getWikiDevOrigin() {
  const fromEnv = import.meta.env.VITE_WIKI_DEV_URL;
  return (fromEnv || WIKI_DEV_API_DEFAULT_URL).replace(/\/$/, '');
}

/** @param {string} [path] React Router pathname (e.g. `/admin/topics`) */
export function wikiStaticFrameUrl(path = '/') {
  if (!path || path === '/') return AI_SYNAPSE_WIKI_APP_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/ai-synapse-wiki${p}`;
}

/** @param {string} [path] Wiki dev pathname (예: `/admin/topics`) */
export function wikiDevFrameUrl(path = '/') {
  const origin = getWikiDevOrigin();
  const appBase = WIKI_DEV_APP_BASE.replace(/\/$/, '');
  if (!path || path === '/') return `${origin}${appBase}/`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${appBase}${p}`;
}

/** @param {'static' | 'dev'} mode */
export function resolveWikiFrameUrl(mode, path = '/') {
  return mode === 'dev' ? wikiDevFrameUrl(path) : wikiStaticFrameUrl(path);
}

/** 포털 dev가 Wiki dev API에 연결됐는지 (/api/admin/config) */
export async function fetchWikiAdminConfig() {
  let res;
  try {
    res = await fetch('/api/admin/config', { method: 'GET', cache: 'no-store' });
  } catch {
    throw new Error('Wiki dev 서버에 연결할 수 없습니다.');
  }
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(
      res.status >= 500
        ? `프록시 실패 (${getWikiDevOrigin()} 에 Wiki dev가 떠 있는지 확인)`
        : '관리 API 응답 형식 오류',
    );
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error || 'Wiki admin API unavailable');
  }
  return body;
}

export const WIKI_DEV_SETUP_COMMANDS = {
  wiki: '$env:VITE_BASE="/ai-synapse-wiki/"; npm run dev -- --port 5174 --host localhost',
  portal: 'npm run dev',
  check: 'npm run wiki:check',
  sync: 'npm run wiki:sync',
};
