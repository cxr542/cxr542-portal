const TMS_ORIGIN = 'https://okestro-edu-team-tms.vercel.app';

export const WORKSPACE_LAUNCHER_ORIGIN = 'https://cxr542-launcher-brown.vercel.app';

export const WORKSPACE_LAUNCHER_DEV_ORIGIN =
  import.meta.env.VITE_LAUNCHER_ORIGIN || 'http://localhost:4321';

export const WORKSPACE_MOCKUP_PATH = '/preview/cxr542-launcher-landing-mockup-20260605-131312.html';

function isPortalProduction() {
  if (typeof window === 'undefined') return true;
  const { hostname } = window.location;
  return hostname === 'cxr542-portal.vercel.app' || hostname.endsWith('.vercel.app');
}

/** Portal → 팀장 Workspace 랜딩 */
export function getWorkspaceUrl() {
  if (typeof window === 'undefined') {
    return `${WORKSPACE_LAUNCHER_ORIGIN}/`;
  }

  if (isPortalProduction()) {
    return `${WORKSPACE_LAUNCHER_ORIGIN}/`;
  }

  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${WORKSPACE_LAUNCHER_DEV_ORIGIN}/`;
  }

  return `${TMS_ORIGIN}${WORKSPACE_MOCKUP_PATH}`;
}
