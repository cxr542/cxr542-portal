/** vision-font 웹 데모 (/vision-font/) — 개발 서버에서만 포털 iframe 임베드 */
export const VISION_FONT_APP_URL = '/vision-font/index.html';

export const VISION_FONT_GITHUB_PAGES_URL =
  'https://cxr542.github.io/cxr542-ai/projects/vision-font/';

export function isVisionFontGithubEmbed() {
  return import.meta.env.DEV;
}
