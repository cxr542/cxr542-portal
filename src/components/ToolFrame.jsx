import { useContext, useEffect, useId, useRef, useState } from 'react';
import './ToolFrame.css';
import { WorkspaceTheme } from './WorkspaceTheme';
const integratedPaths = new Set(['today-shoes','marathon-log','how-many-points','idea-bank','prompt-collection','who-are-you','vision-font','gemini-tuner']);
export default function ToolFrame({ src, title, ...props }) {
  const appearance = useContext(WorkspaceTheme);
  const themeGroup = useId();
  const frame = useRef(null);
  const more = useRef(null);
  useEffect(()=>{
    const closeOutside=event=>{if(more.current&&!more.current.contains(event.target))more.current.open=false;};
    document.addEventListener('pointerdown',closeOutside);
    return()=>document.removeEventListener('pointerdown',closeOutside);
  },[]);
  const [height,setHeight] = useState(640);
  const url = new URL(src,location.origin);
  const integrated = url.origin === location.origin && integratedPaths.has(url.pathname.split('/')[1]);
  if (integrated) url.searchParams.set('portal','workspace');
  const toolName=url.pathname.split('/')[1];
  const presentation=({'today-shoes':['오늘뭐신지','나의 러닝화 컬렉션','shoe'],'marathon-log':['마라톤 기록장','대회와 러닝 기록을 차곡차곡','run'],'how-many-points':['너는몇점?','보고 읽은 것에 나만의 점수','film']})[toolName];
  const source = integrated ? url.pathname+url.search+url.hash : src;
  useEffect(()=>{
    if (!integrated) return;
    const sendTheme=()=>frame.current?.contentWindow?.postMessage({type:'portal:theme',theme:document.documentElement.dataset.theme==='dark'?'dark':'light'},location.origin);
    const receive=event=>{
      if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='tool:ready')sendTheme();
      if(event.data?.type==='tool:height'&&Number.isFinite(event.data.height))setHeight(Math.min(50000,Math.max(200,Math.ceil(event.data.height))));
    };
    window.addEventListener('message',receive);
    const observer=new MutationObserver(sendTheme);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    sendTheme();
    return()=>{window.removeEventListener('message',receive);observer.disconnect();};
  },[integrated,source]);
  if(!integrated)return <iframe {...props} src={src} title={title}/>;
  return <section className="integrated-tool"><div className="integrated-tool__heading"><div className="integrated-tool__identity">{presentation&&<img src={`/workspace/icons/${presentation[2]}.svg`} alt="" width="52" height="52"/>}<div><h1>{presentation?.[0]||title}</h1><p>{presentation?.[1]||'나의 워크스페이스'}</p></div></div><details className="tool-more" ref={more} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();more.current.open=false;more.current.querySelector('summary').focus();}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;}}><summary aria-label="더보기" title="더보기">⋯</summary><div className="tool-more__panel">{appearance&&<fieldset className="tool-theme"><legend>화면 모드</legend><p>포털 전체에 적용됩니다</p>{[['light','☀','라이트','클라우드 블루'],['dark','☾','다크','블랙 · 레드']].map(([value,glyph,name,palette])=><label key={value} className={appearance.theme===value?'is-selected':''}><input type="radio" name={themeGroup} value={value} checked={appearance.theme===value} onChange={()=>appearance.setTheme(value)}/><span className="tool-theme__glyph" aria-hidden="true">{glyph}</span><span><strong>{name}</strong><small>{palette}</small></span></label>)}</fieldset>}<a href={src} target="_blank" rel="noopener noreferrer" onClick={()=>{more.current.open=false;}}>새 창에서 열기 ↗</a></div></details></div><iframe {...props} ref={frame} src={source} title={title} className="integrated-tool-frame" style={{height}} /></section>;
}
