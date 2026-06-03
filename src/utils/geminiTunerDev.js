/** GeminiTuner 웹 데모 (/gemini-tuner/) — 개발 서버에서만 포털 iframe 임베드 */
export const GEMINI_TUNER_APP_URL = '/gemini-tuner/index.html';

export const GEMINI_TUNER_GITHUB_PAGES_URL =
  'https://cxr542.github.io/cxr542-ai/projects/gemini-tuner/';

export const GEMINI_TUNER_REPO_URL = 'https://github.com/cxr542/GeminiTuner';

export function isGeminiTunerWebDemoEmbed() {
  return import.meta.env.DEV;
}
