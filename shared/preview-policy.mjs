/** Platform environment only; request headers are never policy inputs. */
export function deploymentEnvironment(env) {
  if (env.VERCEL !== '1') return 'unknown';
  switch (env.VERCEL_ENV) {
    case 'production': return 'production';
    case 'preview': return 'preview';
    case 'development': return 'development';
    default: return 'unknown';
  }
}

export function allowsExternalConnections(env) {
  return deploymentEnvironment(env) === 'production';
}

export function browserAllowsExternalConnections(environment, origin) {
  return environment === 'production' && origin === 'https://cxr542-portal.vercel.app';
}

export function refuseExternalRequest(res, env) {
  if (allowsExternalConnections(env)) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 503;
  res.end(JSON.stringify({ error: 'external_connections_disabled' }));
  return true;
}
