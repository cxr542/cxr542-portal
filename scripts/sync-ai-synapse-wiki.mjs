#!/usr/bin/env node
/**
 * AI-Synapse-Wiki 빌드 → public/ai-synapse-wiki/ 동기화
 * Default clone: .cache/AI-Synapse-Wiki (https://github.com/cxr542/AI-Synapse-Wiki)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(__dirname, '..');
const defaultWikiRoot = path.join(portalRoot, '.cache', 'AI-Synapse-Wiki');
const wikiRoot = process.env.WIKI_ROOT ? path.resolve(process.env.WIKI_ROOT) : defaultWikiRoot;
const dest = path.join(portalRoot, 'public', 'ai-synapse-wiki');
const WIKI_REPO = 'https://github.com/cxr542/AI-Synapse-Wiki.git';

function npxCmd() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function git(cmd, cwd) {
  return spawnSync('git', cmd, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function ensureWikiRepo() {
  if (fs.existsSync(path.join(wikiRoot, 'package.json'))) {
    if (fs.existsSync(path.join(wikiRoot, '.git'))) {
      console.log('→ git pull');
      run('git', ['-C', wikiRoot, 'pull', '--ff-only', 'origin', 'main']);
    }
    return;
  }
  fs.mkdirSync(path.dirname(wikiRoot), { recursive: true });
  console.log('→ git clone', WIKI_REPO);
  run('git', ['clone', '--depth', '1', WIKI_REPO, wikiRoot]);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'about.html') continue;
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  }
}

ensureWikiRepo();

console.log('Wiki:', wikiRoot);
console.log('Dest:', dest);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!fs.existsSync(path.join(wikiRoot, 'node_modules'))) {
  console.log('\n→ npm install (wiki)');
  run(npm, ['install'], { cwd: wikiRoot });
}

console.log('\n→ build:entries + vite build (VITE_BASE=/ai-synapse-wiki/)');
run(npm, ['run', 'build:entries'], { cwd: wikiRoot });
if (!process.env.WIKI_SYNC_SKIP_BUILD) {
  run(npxCmd(), ['vite', 'build'], {
    cwd: wikiRoot,
    env: {
      ...process.env,
      VITE_BASE: '/ai-synapse-wiki/',
      VITE_ADMIN_ENABLED: process.env.WIKI_ADMIN_ENABLED ?? 'true',
      VITE_ADMIN_PIN: process.env.WIKI_ADMIN_PIN || process.env.VITE_ADMIN_PIN || '',
    },
  });
  console.log('Tip: Wiki dev for portal → VITE_BASE=/ai-synapse-wiki/ npm run dev -- --port 5174');
} else {
  console.log('(WIKI_SYNC_SKIP_BUILD=1 — 기존 dist/ 복사만)');
}

const dist = path.join(wikiRoot, 'dist');
if (!fs.existsSync(dist)) {
  console.error('dist/ 없음 — Wiki 빌드 실패');
  process.exit(1);
}

console.log('\n→ public/ai-synapse-wiki/ 복사 (about.html 유지)');
emptyDir(dest);
copyDir(dist, dest);

const head = git(['log', '-1', '--format=%h %s (%ci)'], wikiRoot);
const meta = head.stdout?.trim() || 'unknown';
const entriesPath = path.join(wikiRoot, 'src', 'data', 'entries.json');
let entryCount = '?';
try {
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  entryCount = String(Array.isArray(entries) ? entries.length : Object.keys(entries).length);
} catch {
  /* ignore */
}

const metaPath = path.join(dest, 'SYNC.txt');
fs.writeFileSync(
  metaPath,
  [
    'AI-Synapse-Wiki → portal public/ai-synapse-wiki',
    `Source: ${WIKI_REPO.replace('.git', '')}`,
    `Commit: ${meta}`,
    `Entries: ${entryCount}`,
    'base: /ai-synapse-wiki/',
    'Build: npx vite build (npm run build의 tsc는 저장소 TS 이슈로 생략 가능)',
    '',
  ].join('\n'),
  'utf8',
);

console.log('\n완료.', meta);
console.log('포털: npm run dev → /ai-synapse-wiki/');
