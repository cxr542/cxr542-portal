import { describe, expect, it } from 'vitest';
import { applyPreviewCsp, verifyPreviewCsp, previewCsp } from '../scripts/apply-preview-csp.mjs';
const preview = { VERCEL: '1', VERCEL_ENV: 'preview' };
const original = { version: 3, routes: [
  { src: '/legacy', dest: '/marathon-log/index.html', headers: { 'x-existing': 'retained' } },
  { handle: 'filesystem' }, { src: '/api/(.*)', dest: '/api/$1' },
  { src: '/(.*)', dest: '/index.html' }, { handle: 'error' }, { src: '/(.*)', status: 404, dest: '/404.html' },
], overrides: { 'index.html': { path: '' } } };
it('preserves routing, filesystem/API phases, overrides and existing headers without mutating input', () => {
  const before = structuredClone(original); const output = applyPreviewCsp(original, preview);
  expect(original).toEqual(before); expect(output.overrides).toEqual(original.overrides);
  expect(output.routes.filter(route => !route.headers?.['Content-Security-Policy'])).toEqual(original.routes);
});
describe('Build Output path coverage (not a Vercel edge execution)', () => {
  it.each(['/', '/marathon-log/index.html', '/ai-office/index.html', '/assets/app.js', '/api/portal-login', '/legacy', '/missing', '/404.html'])('has an unconditional first-pass CSP for %s', path => {
    const output = applyPreviewCsp(original, preview); const guard = output.routes[0];
    expect(new RegExp('^' + guard.src + '$').test(path)).toBe(true);
    expect(guard.continue).toBe(true); expect(guard.methods).toBeUndefined();
    expect(guard.headers['Content-Security-Policy']).toBe(previewCsp);
    expect(previewCsp).toContain("connect-src 'none'");
  });
});
it('refuses production and unknown transformations without changing their configuration', () => {
  for (const env of [{ VERCEL: '1', VERCEL_ENV: 'production' }, {}]) {
    const input = structuredClone(original);
    expect(() => applyPreviewCsp(input, env)).toThrow(); expect(input).toEqual(original);
  }
});
it('fails verification for a missing, late or phase-skipped CSP', () => {
  expect(() => verifyPreviewCsp(original, preview)).toThrow();
  const output = applyPreviewCsp(original, preview);
  expect(() => verifyPreviewCsp({ ...output, routes: [...output.routes.slice(1), output.routes[0]] }, preview)).toThrow();
  const errorIndex = output.routes.findIndex(route => route.handle === 'error');
  output.routes.splice(errorIndex + 1, 1);
  expect(() => verifyPreviewCsp(output, preview)).toThrow();
});
it.each([{ version: 2 }, { version: 3, routes: {} }, { version: 3, routes: [{ src: '/(.*)', middlewarePath: '/unreviewed' }] }, { version: 3, routes: [{ src: '/(.*)', headers: { 'content-security-policy': "default-src *" } }] }])('rejects unsupported or overriding output: %j', input => {
  expect(() => applyPreviewCsp(input, preview)).toThrow();
});

it('refuses an external rewrite or a malformed header before output mutation', () => {
  for (const route of [{src:'/(.*)',dest:'https://external.invalid/$1'}, {src:'/(.*)',headers:[]}, {src:'/(.*)',unreviewed:true}, {src:'/(.*)',headers:{Location:'//external.invalid'}}]) {
    const input = {version:3,routes:[route]}; const before=structuredClone(input);
    expect(() => applyPreviewCsp(input, preview)).toThrow(); expect(input).toEqual(before);
  }
});

it('rejects platform image proxies and additional execution surfaces', () => {
  for (const extra of [{images:{domains:['external.invalid']}},{services:[]},{crons:[]}]) {
    expect(() => applyPreviewCsp({...original,...extra}, preview)).toThrow();
  }
});

it.each(['/\\external.invalid/a', '//external.invalid/a', '/%5cexternal.invalid/a', '/%2fexternal.invalid/a', '/%252fexternal.invalid/a', '/%255cexternal.invalid/a', '/\texternal.invalid/a', '/%ZZ'])('rejects ambiguous or external URL destinations: %j', destination => {
  for (const route of [{src:'/(.*)',dest:destination},{src:'/(.*)',status:302,headers:{Location:destination}}]) {
    expect(() => applyPreviewCsp({version:3,routes:[route]}, preview)).toThrow();
  }
});
it('independent verification refuses unsafe routes introduced after CSP application', () => {
  for (const route of [{src:'/(.*)',dest:'https://external.invalid/a'}, {src:'/(.*)',headers:{Location:'/\\external.invalid/a'}}, {src:'/(.*)',middlewarePath:'/unreviewed'}]) {
    const output=applyPreviewCsp(original,preview);output.routes.push(route);
    expect(() => verifyPreviewCsp(output,preview)).toThrow();
  }
});
it('keeps safe internal normalized URLs, captures and existing headers intact', () => {
  const routes=[{src:'/a',dest:'/static/../index.html?name=a%20b'},{src:'/api/(.*)',dest:'/api/$1'},{src:'/old',status:302,headers:{Location:'/new?tab=one#top','x-existing':'yes'}}];
  const output=applyPreviewCsp({version:3,routes},preview);
  expect(output.routes.slice(1)).toEqual(routes);expect(() => verifyPreviewCsp(output,preview)).not.toThrow();
});
