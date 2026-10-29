import { readdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
const assets=readdirSync('dist/shared').filter(n=>/^cloud-[A-Za-z0-9_-]+\.js$/.test(n));
if(assets.length!==1)throw new Error('Expected exactly one versioned cloud entry');
const entry='/shared/'+assets[0];
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())walk(file);else if(file.endsWith('.html')){const before=readFileSync(file,'utf8');const after=before.replaceAll('src="/shared/cloud.js"','src="'+entry+'"');if(after!==before)writeFileSync(file,after);}}}
walk('dist');
// Older open documents can still resolve the former URL while new HTML uses content hashes.
cpSync('dist/shared/'+assets[0],'dist/shared/cloud.js');
console.log('Versioned cloud entry: '+entry);
