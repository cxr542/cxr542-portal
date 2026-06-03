/** Topic markdown pack/unpack (from AI-Synapse-Wiki admin-api-handlers) */

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** @param {string} s */
function yamlQuote(s) {
  if (/[:#\[\]{}&*!|>'"%@`]/.test(s) || s.includes('\n')) {
    return JSON.stringify(s);
  }
  return s;
}

/** @param {Record<string, unknown>} data @param {string} body */
export function packMd(data, body) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(data)) {
    if (val == null) continue;
    if (key === 'related' && Array.isArray(val)) {
      lines.push('related:');
      for (const r of val) {
        if (r && typeof r === 'object' && 'kind' in r && 'slug' in r) {
          lines.push(`  - kind: ${r.kind}`);
          lines.push(`    slug: ${r.slug}`);
        }
      }
      continue;
    }
    if (Array.isArray(val)) {
      lines.push(`tags: [${val.join(', ')}]`);
      continue;
    }
    lines.push(`${key}: ${yamlQuote(String(val))}`);
  }
  lines.push('---', '', body.trim(), '');
  return lines.join('\n');
}

/** @param {string} body */
export function assertTopicBody(body) {
  if (body.includes('채워 주세요') || (body.includes('(항목)') && body.includes('(설명)'))) {
    throw new Error('본문이 템플릿 플레이스홀더입니다. 내용을 채운 뒤 저장하세요.');
  }
}

const RESERVED = new Set(['nl-draft', 'nl-config', 'new', 'nl']);

/** @param {string} url */
export function parseTopicSlugUrl(url) {
  const pathOnly = url.split('?')[0];
  const m = pathOnly.match(/^\/api\/admin\/topics\/([a-z0-9][a-z0-9-]*)$/i);
  if (!m || RESERVED.has(m[1])) return null;
  return { slug: m[1] };
}
