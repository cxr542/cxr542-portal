import prompts from '../../server/prompts/handler.mjs';
export default function handler(req, res) {
  req.promptCollection = true;
  return prompts(req, res);
}
