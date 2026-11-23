import { rejectLiveRequest } from '../../server/portalMode.js';

export default async function handler(req, res) {
  if (rejectLiveRequest(res)) return;
  const { default: liveHandler } = await import('../../scripts/portal-wiki-admin/handler.mjs');
  return liveHandler(req, res);
}
