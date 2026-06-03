/** Vercel build injects VERCEL_ENV (production | preview | development) */
const BUILD_ENV =
  typeof __PORTAL_BUILD_ENV__ !== 'undefined' ? __PORTAL_BUILD_ENV__ : 'development';

export const PORTAL_ENV_CONFIG = {
  development: {
    id: 'development',
    label: '개발',
    shortLabel: 'DEV',
    title: '로컬 개발 서버 · 이 origin의 브라우저 저장소',
    className: 'portal-env-badge--dev',
  },
  preview: {
    id: 'preview',
    label: '검증',
    shortLabel: 'PRE',
    title: 'Vercel Preview · PR/배포 전 확인용',
    className: 'portal-env-badge--preview',
  },
  production: {
    id: 'production',
    label: '운영',
    shortLabel: 'PROD',
    title: 'Production · 실제 사용 데이터',
    className: 'portal-env-badge--prod',
  },
};

const PRODUCTION_HOSTS = new Set(['cxr542-portal.vercel.app']);

export function resolvePortalEnvironment(hostname = window.location.hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return PORTAL_ENV_CONFIG.development;
  }

  if (PRODUCTION_HOSTS.has(hostname)) {
    return PORTAL_ENV_CONFIG.production;
  }

  if (hostname.endsWith('.vercel.app')) {
    return PORTAL_ENV_CONFIG.preview;
  }

  if (BUILD_ENV === 'production') {
    return PORTAL_ENV_CONFIG.production;
  }

  if (BUILD_ENV === 'preview') {
    return PORTAL_ENV_CONFIG.preview;
  }

  if (import.meta.env?.DEV) {
    return PORTAL_ENV_CONFIG.development;
  }

  return PORTAL_ENV_CONFIG.development;
}
