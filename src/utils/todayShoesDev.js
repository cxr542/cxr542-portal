/** today-shoes 웹 데모 (/today-shoes/) — 개발 서버에서만 포털 iframe 임베드 */
export const TODAY_SHOES_APP_URL = '/today-shoes/index.html';

export const TODAY_SHOES_GITHUB_PAGES_URL = 'https://cxr542.github.io/today-shoes/';

export const TODAY_SHOES_REPO_URL = 'https://github.com/cxr542/today-shoes';

export function isTodayShoesWebDemoEmbed() {
  return import.meta.env.DEV;
}
