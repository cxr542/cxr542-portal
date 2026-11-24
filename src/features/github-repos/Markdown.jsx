// Minimal, safe Markdown renderer for README previews.
// Output is React elements only (no innerHTML). Raw HTML in a README is first
// turned into plain Markdown text (htmlToMarkdown), never rendered as markup.
// Links allow http(s) only; images become labelled links instead of loading
// third-party content.
import { parseBlocks, safeHref } from './markdownParse.js';

function parseInline(text, base, keyPrefix = 'i') {
  const nodes = [];
  const pattern = /(`[^`]+`)|(!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\))|(\*\*([^*]+)\*\*|__([^_]+)__)|(\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;
  let last = 0;
  let match;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${index++}`;
    if (match[1]) nodes.push(<code key={key}>{match[1].slice(1, -1)}</code>);
    else if (match[2]) {
      const isImage = match[2].startsWith('!');
      const href = safeHref(match[4], base);
      const label = match[3] || match[4];
      const content = isImage ? `[이미지: ${label || '설명 없음'}]` : parseInline(label, base, key);
      nodes.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{content}</a> : <span key={key}>{content}</span>);
    } else if (match[5]) nodes.push(<strong key={key}>{parseInline(match[6] || match[7], base, key)}</strong>);
    else if (match[8]) nodes.push(<em key={key}>{parseInline(match[9] || match[10], base, key)}</em>);
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ source, baseUrl }) {
  const blocks = parseBlocks(source);
  return <div className="repo-md">{blocks.map((block, index) => {
    const key = `b${index}`;
    switch (block.type) {
      case 'heading': {
        const Tag = `h${Math.min(6, block.level + 3)}`;
        return <Tag key={key} className={`repo-md__h${block.level}`}>{parseInline(block.text, baseUrl, key)}</Tag>;
      }
      case 'code': return <pre key={key} tabIndex={0} aria-label={block.lang ? `${block.lang} 코드` : '코드'}><code>{block.text}</code></pre>;
      case 'quote': return <blockquote key={key}>{parseInline(block.text, baseUrl, key)}</blockquote>;
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return <List key={key}>{block.items.map((item, n) => <li key={n}>{parseInline(item, baseUrl, `${key}-${n}`)}</li>)}</List>;
      }
      case 'hr': return <hr key={key} />;
      default: return <p key={key}>{parseInline(block.text, baseUrl, key)}</p>;
    }
  })}</div>;
}
