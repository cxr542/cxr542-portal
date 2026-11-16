import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const previewCsp = "default-src 'self'; connect-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
const headerRoute = () => ({ src: '/(.*)', headers: { 'Content-Security-Policy': previewCsp }, continue: true });

export class PreviewCspError extends Error {}

function requirePreview(env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview') {
    throw new PreviewCspError('CSP output transformation requires explicit Vercel Preview');
  }
}

function validateDestination(value) {
  const base = 'https://preview-routing.invalid';
  if (typeof value !== 'string' || value.trim() !== value) throw new PreviewCspError('Invalid route destination');
  let decoded = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split(/[?#]/)[0].includes(' ') || /^\/\$(?:[0-9A-Za-z_{])/.test(decoded)) {
      throw new PreviewCspError('Ambiguous or external route destination');
    }
    let url;
    try { url = new URL(decoded, base); }
    catch { throw new PreviewCspError('Invalid route URL'); }
    if (url.origin !== base || url.pathname.startsWith('//')) throw new PreviewCspError('External route destination');
    let next;
    try { next = decodeURIComponent(decoded); }
    catch { throw new PreviewCspError('Invalid destination encoding'); }
    if (next === decoded) return;
    decoded = next;
  }
  throw new PreviewCspError('Ambiguous nested destination encoding');
}

function validateRouting(config, allowGuards) {
  if (config?.version !== 3 || (config.routes !== undefined && !Array.isArray(config.routes))) {
    throw new PreviewCspError('Unsupported Build Output configuration');
  }
  if (config.services || config.daemons || config.crons || config.images) {
    throw new PreviewCspError('Additional execution surfaces require manual review');
  }
  const routes = config.routes || [];
  const sourceKeys = new Set(['src', 'dest', 'headers', 'methods', 'continue', 'caseSensitive', 'check', 'status', 'has', 'missing', 'locale']);
  for (const route of routes) {
    if (allowGuards && JSON.stringify(route) === JSON.stringify(headerRoute())) continue;
    if (!route || typeof route !== 'object' || Array.isArray(route) ||
        (route.handle ? !['filesystem', 'rewrite', 'error', 'resource', 'miss', 'hit'].includes(route.handle) : typeof route.src !== 'string') ||
        Object.keys(route).some(key => route.handle ? key !== 'handle' : !sourceKeys.has(key)) ||
        (route.headers !== undefined && (!route.headers || typeof route.headers !== 'object' || Array.isArray(route.headers) || Object.values(route.headers).some(value => typeof value !== 'string'))) ||
        Object.keys(route.headers || {}).some(key => key.toLowerCase() === 'content-security-policy')) {
      throw new PreviewCspError('Route may bypass or replace CSP; manual review required');
    }
    if (route.dest !== undefined) validateDestination(route.dest);
    for (const [key, value] of Object.entries(route.headers || {})) {
      if (key.toLowerCase() === 'location') validateDestination(value);
    }
  }
  return routes;
}

export function applyPreviewCsp(config, env) {
  requirePreview(env);
  const routes = validateRouting(config, false);
  const output = { ...config, routes: [headerRoute(), ...routes.flatMap(route => route.handle ? [route, headerRoute()] : [route])] };
  verifyPreviewCsp(output, env);
  return output;
}

export function verifyPreviewCsp(config, env) {
  requirePreview(env);
  const routes = validateRouting(config, true);
  const isGuard = route => JSON.stringify(route) === JSON.stringify(headerRoute());
  if (!Array.isArray(routes) || !isGuard(routes[0])) throw new PreviewCspError('CSP must precede routing');
  for (let index = 0; index < routes.length; index += 1) {
    if (routes[index].handle && !isGuard(routes[index + 1])) throw new PreviewCspError('Missing CSP after routing phase');
    const csp = Object.entries(routes[index].headers || {}).filter(([key]) => key.toLowerCase() === 'content-security-policy');
    if (csp.some(([, value]) => value !== previewCsp)) throw new PreviewCspError('Conflicting CSP');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = '.vercel/output/config.json';
  const config = JSON.parse(readFileSync(file, 'utf8'));
  if (process.argv[2] === '--verify') verifyPreviewCsp(config, process.env);
  else {
    const output = applyPreviewCsp(config, process.env);
    writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
    verifyPreviewCsp(JSON.parse(readFileSync(file, 'utf8')), process.env);
  }
}
