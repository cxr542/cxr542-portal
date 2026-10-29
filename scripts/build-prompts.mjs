import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { transform } from 'lightningcss';

const source = 'apps/prompt-actions/public/prompt-collection';
const root = '.cache/prompt-actions-assets/public';
mkdirSync(root, { recursive:true });
cpSync(source, root + '/prompt-collection', { recursive:true });
cpSync('public/shared', root + '/shared', { recursive:true });
const styles = [
  ['/prompt-collection/fonts/fonts.css', source + '/fonts/fonts.css'],
  ['/shared/css/project-shell.css?v=portal2', 'public/shared/css/project-shell.css'],
  ['/prompt-collection/css/app.css?v=portal2', source + '/css/app.css'],
];
const css = transform({ filename:'prompt-collection.css',code:Buffer.from(styles.map(([,file]) => readFileSync(file,'utf8')).join('\n')),minify:true }).code.toString();
const target = root + '/prompt-collection/index.html';
let html = readFileSync(target,'utf8');
let replaced = 0;
html = html.replace(/<link\b[^>]*>/g, tag => {
  if (!styles.some(([href]) => tag.includes(`href="${href}"`))) return tag;
  replaced++;
  return '';
});
if (replaced !== styles.length) throw new Error('Prompt stylesheet links changed; update the scoped build step.');
html = html.replace('</head>',`<style>${css}</style>\n</head>`);
writeFileSync(target,html);
console.info(`Standalone prompt assets: ${Buffer.byteLength(css)} CSS bytes; portal UI unchanged.`);
