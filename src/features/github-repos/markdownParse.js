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

// Raw HTML embedded in READMEs (centered logos, badges, <details>) is turned into
// plain Markdown text before parsing. Nothing here produces markup: the result
// is still rendered as React text, links still go through safeHref, and images
// still become labelled links. Only known HTML tag names are touched, so text
// like `npm i <pkg>` stays as written. Fenced code and inline code are left alone.
const HTML_TAGS = 'a|abbr|b|blockquote|br|center|code|dd|del|details|div|dl|dt|em|figcaption|figure|font|h[1-6]|hr|i|img|ins|kbd|li|mark|ol|p|picture|pre|s|samp|small|source|span|strike|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|tt|u|ul|video|var|wbr';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', mdash: '—', ndash: '–', hellip: '…', middot: '·' };

function attrs(source) {
  const out = {};
  for (const m of source.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

const decodeEntities = text => text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, name) => {
  if (name[0] === '#') {
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : whole;
  }
  return ENTITIES[name.toLowerCase()] ?? whole;
});

// Characters that would end a Markdown link label or URL early.
const label = text => text.replace(/\s+/g, ' ').trim().replace(/\[/g, '(').replace(/\]/g, ')');
const url = text => text.trim().replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
const stripTags = text => text.replace(new RegExp(`<\\/?(?:${HTML_TAGS})\\b[^>]*>`, 'gi'), '');

function convertHtml(text) {
  const codes = [];
  let out = text
    .replace(/`[^`\n]+`/g, code => `\uE000${codes.push(code) - 1}\uE000`)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|svg|iframe|object|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  const image = tag => {
    const a = attrs(tag);
    return { alt: label(a.alt || a.title || ''), src: a.src || '' };
  };
  // A linked image (badge, logo) becomes one link labelled as an image.
  out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_, attr, inner) => {
    const href = attrs(attr).href || '';
    const imgs = [...inner.matchAll(/<img\b[^>]*>/gi)].map(m => image(m[0]));
    const text = label(decodeEntities(stripTags(inner.replace(/<img\b[^>]*>/gi, ' '))));
    const name = text || (imgs.length ? `이미지: ${imgs.map(i => i.alt).filter(Boolean).join(', ') || '설명 없음'}` : '');
    if (!name) return '';
    return href ? `[${name}](${url(href)})` : name;
  });
  out = out
    .replace(/<img\b[^>]*>/gi, tag => {
      const { alt, src } = image(tag);
      return src ? `![${alt}](${url(src)})` : alt ? `[이미지: ${alt}]` : '';
    })
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_, level, inner) => {
      const text = stripTags(inner).replace(/\s+/g, ' ').trim();
      return text ? `\n\n${'#'.repeat(Number(level))} ${text}\n\n` : '\n\n';
    })
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, (_, inner) => `\n\n\`\`\`\n${decodeEntities(stripTags(inner)).replace(/^\n+|\n+$/g, '')}\n\`\`\`\n\n`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_, _tag, inner) => (inner.trim() ? `**${inner.trim()}**` : ''))
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_, _tag, inner) => (inner.trim() ? `*${inner.trim()}*` : ''))
    .replace(/<code\b[^>]*>([^<`]*)<\/code\s*>/gi, (_, inner) => (inner.trim() ? `\`${inner}\`` : ''))
    .replace(/<hr\b[^>]*>/gi, '\n\n---\n\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(td|th)\s*>/gi, ' · ')
    .replace(/<\/?(p|div|center|details|summary|table|thead|tbody|tfoot|tr|ul|ol|dl|dt|dd|blockquote|figure|figcaption|picture|video)\b[^>]*>/gi, '\n\n');
  out = decodeEntities(stripTags(out));
  return out.replace(/\uE000(\d+)\uE000/g, (_, n) => codes[Number(n)]);
}

/** Converts raw HTML outside fenced code into Markdown text (see notes above). */
export function htmlToMarkdown(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let buffer = [];
  let fence = null;
  const flush = () => { if (buffer.length) out.push(convertHtml(buffer.join('\n'))); buffer = []; };
  for (const line of lines) {
    const marker = line.match(/^\s*(```|~~~)/);
    if (fence) {
      out.push(line);
      if (marker && line.trim().startsWith(fence)) fence = null;
    } else if (marker) {
      flush();
      fence = marker[1];
      out.push(line);
    } else buffer.push(line);
  }
  flush();
  return out.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}

export function parseBlocks(source) {
  const lines = htmlToMarkdown(source).split('\n');
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
