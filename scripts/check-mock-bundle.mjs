// Verifies a built Mock Preview output contains no live Supabase runtime.
// Usage: VERCEL_ENV=preview PORTAL_DATA_MODE=mock npm run build && node scripts/check-mock-bundle.mjs [dist]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || 'dist'
const forbidden = [/supabase\.co\b/, /signInWithPassword/, /GoTrueClient/, /RealtimeClient/, /\/rest\/v1\//, /\/storage\/v1\//, /\/auth\/v1\//]
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
const hits = []
for (const file of walk(root).filter(f => /\.(m?js|html)$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  for (const pattern of forbidden) if (pattern.test(text)) hits.push(`${file}: ${pattern}`)
}
if (!walk(root).some(f => /mockBootstrap-.*\.js$/.test(f))) hits.push(`${root}: mockBootstrap chunk missing (not a Mock build?)`)
if (hits.length) {
  console.error('MOCK_BUNDLE_FAIL\n' + hits.join('\n'))
  process.exit(1)
}
console.log('MOCK_BUNDLE_PASS: no live Supabase runtime in', root)
