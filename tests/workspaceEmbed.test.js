import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe,it,expect } from 'vitest';
const source=readFileSync(new URL('../public/shared/js/workspace-embed.js',import.meta.url),'utf8');
function boot({embedded=true,query='?portal=workspace'}={}) {
  const handlers={};const classes=new Set();const root={dataset:{},classList:{add:value=>classes.add(value)}};
  const parent={location:{origin:'https://portal.example'},document:{documentElement:{dataset:{theme:'dark'}}}};
  const window={parent,addEventListener:(name,fn)=>handlers[name]=fn};if(!embedded)window.parent=window;
  const document={querySelector:()=>null,documentElement:root,head:{append(){}},createElement:()=>({}),readyState:'loading',addEventListener(){}};
  vm.runInNewContext(source,{window,document,location:{origin:'https://portal.example',search:query},URLSearchParams});
  return {handlers,root,classes,parent};
}
describe('portal embedded tool boundary',()=>{
  it('leaves standalone pages unchanged',()=>{expect(boot({embedded:false}).classes.size).toBe(0);expect(boot({query:''}).classes.size).toBe(0);});
  it('inherits theme only from its same-origin parent',()=>{const state=boot();expect(state.root.dataset.portalTheme).toBe('dark');state.handlers.message({source:{},origin:'https://portal.example',data:{type:'portal:theme',theme:'light'}});expect(state.root.dataset.portalTheme).toBe('dark');state.handlers.message({source:state.parent,origin:'https://other.example',data:{type:'portal:theme',theme:'light'}});expect(state.root.dataset.portalTheme).toBe('dark');state.handlers.message({source:state.parent,origin:'https://portal.example',data:{type:'portal:theme',theme:'light'}});expect(state.root.dataset.portalTheme).toBe('light');});
});
