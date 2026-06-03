/**
 * Wiki /api/admin — GitHub 저장소 쓰기 또는 WIKI_ADMIN_API_URL 프록시
 */
import { parseTopicSlugUrl } from './topic-md.mjs';
import {
  deleteTopicOnGithub,
  readAdminSettings,
  rebuildEntriesOnGithub,
  saveTopicOnGithub,
  writeProtectMode,
} from './github.mjs';

function readPin() {
  return (process.env.WIKI_ADMIN_PIN || process.env.VITE_ADMIN_PIN || '').trim();
}

function checkPin(req) {
  const pin = readPin();
  if (!pin) return { ok: true };
  const got = req.headers['x-wiki-admin-pin'] || req.headers['X-Wiki-Admin-Pin'];
  if (typeof got !== 'string' || got !== pin) {
    return { ok: false, status: 401, error: 'PIN이 필요하거나 올바르지 않습니다.' };
  }
  return { ok: true };
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function proxyToWikiAdmin(req, res, pathname) {
  const base = (process.env.WIKI_ADMIN_API_URL || '').replace(/\/$/, '');
  if (!base) return false;
  const url = `${base}${pathname}${req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  const headers = { ...req.headers, host: undefined };
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    init.body = Buffer.concat(chunks);
  }
  const upstream = await fetch(url, init);
  res.statusCode = upstream.status;
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'transfer-encoding') res.setHeader(k, v);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
  return true;
}

async function handleGithub(req, res, pathname) {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    json(res, 503, {
      ok: false,
      error:
        '운영 편집 API가 없습니다. Vercel에 GITHUB_TOKEN(저장소 쓰기)과 WIKI_ADMIN_PIN을 설정하거나 WIKI_ADMIN_API_URL(자체 Wiki dev)을 지정하세요.',
    });
    return;
  }

  try {
    if (pathname === '/api/admin/config' || pathname === '/api/admin/topics/nl-config') {
      if (req.method === 'GET') {
        const settings = await readAdminSettings();
        const protectLocked =
          process.env.WIKI_ADMIN_PROTECT === 'true' || process.env.VITE_ADMIN_PROTECT === 'true';
        const protectFromFile = Boolean(settings.protectMode);
        json(res, 200, {
          ok: true,
          llmConfigured: Boolean(process.env.WIKI_TOPIC_LLM_API_KEY?.trim()),
          llmModel: process.env.WIKI_TOPIC_LLM_MODEL?.trim() || 'gemini-2.5-flash',
          protectMode: protectLocked || protectFromFile,
          protectLocked,
          protectFromFile,
          storage: 'github',
        });
        return;
      }
      if (pathname === '/api/admin/config' && req.method === 'PATCH') {
        const auth = checkPin(req);
        if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
        const payload = await readBody(req);
        if (typeof payload.protectMode !== 'boolean') {
          return json(res, 400, { ok: false, error: 'protectMode (boolean) 가 필요합니다.' });
        }
        const state = await writeProtectMode(payload.protectMode);
        const protectLocked =
          process.env.WIKI_ADMIN_PROTECT === 'true' || process.env.VITE_ADMIN_PROTECT === 'true';
        json(res, 200, {
          ok: true,
          protectMode: protectLocked || Boolean(state.protectMode),
          protectLocked,
          protectFromFile: Boolean(state.protectMode),
        });
        return;
      }
    }

    const topicMatch = parseTopicSlugUrl(pathname);
    if (topicMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
      const auth = checkPin(req);
      if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
      const settings = await readAdminSettings();
      const protectLocked =
        process.env.WIKI_ADMIN_PROTECT === 'true' || process.env.VITE_ADMIN_PROTECT === 'true';
      if (req.method === 'DELETE' && (protectLocked || settings.protectMode)) {
        return json(res, 403, { ok: false, error: '보호 모드 — 삭제가 비활성화되어 있습니다.' });
      }
      let result;
      if (req.method === 'PUT') {
        const payload = await readBody(req);
        const cur = topicMatch.slug;
        const next = String(payload.slug || '').trim();
        if (cur !== next) {
          return json(res, 400, { ok: false, error: 'slug 변경은 아직 지원하지 않습니다.' });
        }
        result = await saveTopicOnGithub(payload, { create: false });
      } else {
        result = await deleteTopicOnGithub(topicMatch.slug);
      }
      return json(res, 200, { ok: true, ...result, note: '포털 읽기 화면 반영: npm run wiki:sync 후 배포' });
    }

    if (req.method === 'POST') {
      const auth = checkPin(req);
      if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.error });
      const payload = await readBody(req);

      if (pathname === '/api/admin/topics/nl-draft') {
        return json(res, 501, {
          ok: false,
          error:
            '운영 GitHub API는 자연어 초안을 지원하지 않습니다. 수동 등록을 쓰거나 WIKI_ADMIN_API_URL로 Wiki dev를 연결하세요.',
        });
      }
      if (pathname === '/api/admin/topics') {
        const result = await saveTopicOnGithub(payload, { create: true });
        return json(res, 200, {
          ok: true,
          ...result,
          note: '포털 읽기 화면 반영: npm run wiki:sync 후 배포',
        });
      }
      if (pathname === '/api/admin/rebuild') {
        const count = await rebuildEntriesOnGithub();
        return json(res, 200, { ok: true, count });
      }
      if (pathname === '/api/admin/promote-inbox') {
        return json(res, 501, { ok: false, error: 'inbox 승격은 로컬 Wiki dev에서만 지원합니다.' });
      }
    }

    json(res, 404, { ok: false, error: 'unknown route' });
  } catch (err) {
    json(res, 400, { ok: false, error: err instanceof Error ? err.message : 'error' });
  }
}

/** Vercel Node handler */
export default async function wikiAdminHandler(req, res) {
  const pathname = (req.url || '').split('?')[0];
  if (!pathname.startsWith('/api/admin/')) {
    json(res, 404, { ok: false, error: 'not found' });
    return;
  }

  if (await proxyToWikiAdmin(req, res, pathname)) return;
  await handleGithub(req, res, pathname);
}
