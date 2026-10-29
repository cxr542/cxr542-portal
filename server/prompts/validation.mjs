import { HttpError } from './http.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ['title', 'content', 'description', 'category', 'tags', 'favorite', 'source'];
const sources = ['portal', 'chatgpt', 'cli', 'legacy_import'];
export function invalid() { throw new HttpError(400, 'invalid_input'); }
export function version(v) { if (!Number.isSafeInteger(v) || v < 1 || v > 2147483646) invalid(); return v; }
export function uuid(v) { if (typeof v !== 'string' || !UUID.test(v)) invalid(); return v; }
export function validate(data, create) {
  const allowed = [...fields, ...(create ? ['request_id', 'legacy'] : ['version'])];
  if (Object.keys(data).some(k => !allowed.includes(k))) invalid();
  const out = {};
  for (const [key, max] of [['title', 300], ['content', 40000], ['description', 2000], ['category', 100]]) {
    if (data[key] !== undefined) {
      if (typeof data[key] !== 'string' || data[key].length > max || data[key].includes('\u0000')) invalid();
      out[key] = key === 'content' ? data[key] : data[key].trim();
    }
  }
  if ((create || data.title !== undefined) && !out.title) invalid();
  if (create && data.content === undefined) invalid();
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags) || data.tags.length > 20 || data.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 60 || t.includes('\u0000'))) invalid();
    out.tags = [...new Set(data.tags.map(t => t.trim()))];
  }
  if (data.favorite !== undefined) { if (typeof data.favorite !== 'boolean') invalid(); out.favorite = data.favorite; }
  if (data.source !== undefined) { if (!sources.includes(data.source)) invalid(); out.source = data.source; }
  if (create) {
    uuid(data.request_id);
    if (data.legacy !== undefined) {
      if (out.source !== 'legacy_import' || !data.legacy || typeof data.legacy !== 'object' || Array.isArray(data.legacy)) invalid();
      if (Buffer.byteLength(JSON.stringify(data.legacy)) > 128 * 1024) invalid();
      out.legacy = data.legacy;
    }
  } else { version(data.version); if (!Object.keys(out).length) invalid(); }
  return out;
}
