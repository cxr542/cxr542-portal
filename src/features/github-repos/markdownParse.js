// Pure Markdown helpers (no JSX) for README previews.

const MAX_BLOCKS = 400;
const SAFE_URL = /^https?:\/\//i;

export function safeHref(url, base) {
  const value = String(url || '').trim();
  if (SAFE_URL.test(value)) return value;
  if (base && value && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//')) {
    try {
      const resolved = new URL(value.replace(/^\.?\//, ''), base.endsWith('/') ? base : `${base}/`);
      return SAFE_URL.test(resolved.href) ? resolved.href : null;
    } catch { return null; }
  }
  return null;
}

export function parseBlocks(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length && blocks.length < MAX_BLOCKS) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }
    const listItem = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/;
    if (listItem.test(line)) {
      const ordered = Boolean(line.match(listItem)[1]);
      const items = [];
      while (i < lines.length && listItem.test(lines[i]) && Boolean(lines[i].match(listItem)[1]) === ordered) {
        items.push(lines[i].match(listItem)[2].replace(/^\[( |x)\]\s+/i, (_, done) => (done.trim() ? '☑ ' : '☐ ')));
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const body = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*~~~|\s*>|\s*(?:[-*+]|\d+[.)])\s)/.test(lines[i])) body.push(lines[i++].trim());
    blocks.push({ type: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}
