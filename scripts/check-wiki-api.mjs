#!/usr/bin/env node
/**
 * AI-Synapse Wiki 관리 API 연결 확인
 * Usage: node scripts/check-wiki-api.mjs [baseUrl]
 * Default: http://127.0.0.1:5174
 */
const base = (process.argv[2] || process.env.WIKI_DEV_API_URL || 'http://localhost:5174').replace(
  /\/$/,
  '',
);
const url = `${base}/api/admin/config`;

async function main() {
  console.log(`GET ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      console.error('FAIL: JSON이 아닌 응답', res.status, text.slice(0, 200));
      process.exit(1);
    }
    if (!res.ok || !body.ok) {
      console.error('FAIL:', body.error || res.status);
      process.exit(1);
    }
    console.log('OK: Wiki admin API');
    console.log('  llmConfigured:', body.llmConfigured);
    console.log('  protectMode:', body.protectMode);
    console.log('');
    console.log('포털: npm run dev → AI-Synapse Wiki → 편집(Wiki dev) 모드');
    process.exit(0);
  } catch (e) {
    console.error('FAIL:', e instanceof Error ? e.message : e);
    console.error('');
    console.error('Wiki dev 실행:');
    console.error('  cd AI-Synapse-Wiki && npm run dev -- --port 5174');
    process.exit(1);
  }
}

main();
