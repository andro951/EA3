/** Source and static dependency audit. This does not substitute for browser or visual tests. */
import {readdir,readFile,lstat,access} from 'node:fs/promises';
import {resolve,dirname,relative,extname,sep,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateContent} from '../app/core/schema.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function walk(path){const files=[];for(const entry of await readdir(path,{withFileTypes:true})){const child=resolve(path,entry.name);if(entry.isSymbolicLink())throw Error('Symlinks are not allowed in a release: '+child);if(entry.isDirectory())files.push(...await walk(child));else if(entry.isFile())files.push(child);}return files.sort();}
export async function checkProject(root=ROOT){
 const errors=[],files=[];
 for(const folder of ['app','server','content','public','integrations','tools','tests'])for(const file of await walk(resolve(root,folder)))if(!file.includes('/__pycache__/'))files.push(file);
 for(const name of ['index.html','recovery.html','operator.html','workbench.html'])files.push(resolve(root,name));
 const exists=async(file,owner)=>{if(relative(root,file)==='..'||relative(root,file).startsWith('..'+sep)||isAbsolute(relative(root,file))){errors.push(owner+': reference outside the project');return;}try{await access(file);}catch{errors.push(owner+': missing '+relative(root,file));}};
 for(const file of files){
  const name=relative(root,file),ext=extname(file);if(!['.mjs','.js','.css','.html'].includes(ext))continue;
  const source=await readFile(file,'utf8');
  if(['.mjs','.js'].includes(ext)){
   const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)errors.push(name+': '+result.stderr.trim());
   for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g))if(m[1].startsWith('.'))await exists(resolve(dirname(file),m[1]),name);
  }
  if(ext==='.css')for(const m of source.matchAll(/(?:@import\s+url\(|url\()\s*['"]?([^)'"\s]+)/g))if(!/^(data:|https?:|#)/.test(m[1]))await exists(m[1].startsWith('/')?resolve(root,'.'+m[1]):resolve(dirname(file),m[1]),name);
  if(ext==='.html')for(const m of source.matchAll(/(?:src|href)=["']([^"']+)["']/g))if(m[1].startsWith('/')&&m[1]!=='/')await exists(resolve(root,'.'+m[1].split(/[?#]/)[0]),name);
 }
 const {starterStory,starterCharacters}=await import(pathToFileURL(resolve(root,'content/seed.mjs')));
 let launch=[...starterCharacters,starterStory];
 try{const extra=await import(pathToFileURL(resolve(root,'content/collection.mjs')));launch.push(...extra.collectionCharacters,...extra.collectionStories);}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
 for(const content of launch)for(const error of validateContent(content))errors.push(`${content.id}: ${error}`);
 for(const content of launch){const stack=[content];while(stack.length){const obj=stack.pop();for(const [key,v]of Object.entries(obj||{})){if((key==='image'||key==='thumbnail')&&typeof v==='string'&&v.startsWith('/public/'))await exists(resolve(root,'.'+v),content.id);else if(v&&typeof v==='object')stack.push(v);}}}
 const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 for(const[name,command]of Object.entries(pkg.scripts||{}))for(const m of command.matchAll(/\b((?:tools|tests|server)\/[\w./-]+\.(?:mjs|py))/g))await exists(resolve(root,m[1]),'npm '+name);
 for(const file of files)if(/\.(?:ttf|otf|woff2?|pem|p12|pfx|key)$/i.test(file))errors.push('Unexpected private or font file: '+relative(root,file));
 if(errors.length)throw Error(errors.join('\n'));
 return {checkedFiles:files.length,launchDefinitions:launch.length,syntaxAndStaticReferences:'passed',note:'This checks source integrity, not live provider quality or visual acceptance.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await checkProject(),null,2));
