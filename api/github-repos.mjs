import { rejectLiveRequest } from '../server/portalMode.js';
import { createGithubReposHandler } from '../server/github/reposApi.mjs';

let handler;

export default function githubRepos(req, res) {
  if (rejectLiveRequest(res)) return;
  handler ||= createGithubReposHandler();
  return handler(req, res);
}
