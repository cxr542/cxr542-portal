import { describe, expect, it } from 'vitest';
import { resolvePortalEnvironment } from '../src/utils/portalEnvironment';

describe('resolvePortalEnvironment', () => {
  it('returns development for localhost', () => {
    expect(resolvePortalEnvironment('localhost').id).toBe('development');
    expect(resolvePortalEnvironment('127.0.0.1').id).toBe('development');
  });

  it('returns production for the portal production host', () => {
    expect(resolvePortalEnvironment('cxr542-portal.vercel.app').id).toBe('production');
  });

  it('returns preview for other vercel.app hosts', () => {
    expect(resolvePortalEnvironment('cxr542-portal-git-main-cxr542.vercel.app').id).toBe('preview');
  });
});
