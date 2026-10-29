(function () {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('portal') !== 'workspace') return;
  try { if (window.parent.location.origin !== location.origin) return; } catch { return; }
  const root = document.documentElement;
  root.classList.add('portal-integrated');
  const applyTheme = theme => { root.dataset.portalTheme = theme === 'dark' ? 'dark' : 'light'; };
  applyTheme(window.parent.document.documentElement.dataset.theme);
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'portal:theme') applyTheme(event.data.theme);
  });
  const sheet = document.querySelector('link[href="/shared/css/workspace-embed.css"]');
  function ready() {
    const nav = document.querySelector('.project-sidebar-nav');
    const main = document.querySelector('.project-main');
    if (nav && main) {
      const wrap = document.createElement('div');wrap.className='integrated-section-nav';wrap.setAttribute('aria-label','도구 내부 메뉴');
      main.prepend(wrap);wrap.append(nav);
    }
    let scheduled = false, lastHeight = 0;
    const measure = () => {
      scheduled = false;
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      if (height !== lastHeight) { lastHeight=height;window.parent.postMessage({type:'tool:height',height},location.origin); }
    };
    const schedule = () => { if (!scheduled) {scheduled=true;requestAnimationFrame(measure);} };
    new ResizeObserver(schedule).observe(document.body);
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','open']});
    window.addEventListener('resize',schedule);
    sheet?.addEventListener('load',schedule);
    document.addEventListener('load',schedule,true);
    window.parent.postMessage({type:'tool:ready'},location.origin);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
