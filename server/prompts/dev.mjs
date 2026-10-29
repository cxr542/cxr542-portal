import prompts from './handler.mjs';
import auth from './auth.mjs';
import oauth from './oauth.mjs';
import mcp from './mcp.mjs';

export function promptsDevPlugin() {
  const middleware = async (req, res, next) => {
    const path = (req.url || '').split('?')[0];
    if (path === '/api/prompt-mcp' || path === '/.well-known/oauth-protected-resource/api/prompt-mcp') return mcp(req,res);
    if (/^\/api\/prompts(?:\/[^/]+)?\/?$/.test(path)) return prompts(req,res);
    if (/^\/api\/prompt-auth\/[^/]+$/.test(path)) return auth(req,res);
    if (/^\/api\/prompt-oauth\/[^/]+$/.test(path)) return oauth(req,res);
    next();
  };
  return { name:'portal-prompts-api', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
