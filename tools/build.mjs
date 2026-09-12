/** Deterministic, allowlisted runnable build. Never packages browser data or credentials. */
import {readFile,writeFile,mkdir,rm,copyFile,lstat,chmod} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkProject,walk} from './check.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
export async function buildProject({root=ROOT}={}){
 await checkProject(root);
 const target=resolve(root,'dist/EmberAdventures3');await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
 const files=[];
 for(const folder of ['app','server','content','public','integrations','docs'])files.push(...await walk(resolve(root,folder)));
 for(const name of ['index.html','recovery.html','operator.html','workbench.html','package.json','package-lock.json','.env.example','START-WINDOWS.cmd','START-MAC-LINUX.sh','README.md','tools/admin.mjs'])files.push(resolve(root,name));
 const entries=[];
 for(const file of [...new Set(files)].sort()){
  const name=relative(root,file).replaceAll('\\','/');
  if((await lstat(file)).isSymbolicLink()||/\.(?:ttf|otf|woff2?|pem|key|sqlite|db)$/i.test(name)||name.split('/').some(p=>['.runtime','.git','node_modules'].includes(p)))throw Error('Refusing unsafe build input: '+name);
  const destination=resolve(target,name);await mkdir(dirname(destination),{recursive:true});
  let data=await readFile(file);
  if(name==='package.json'){
   const pkg=JSON.parse(data);pkg.scripts={start:pkg.scripts.start,admin:'node tools/admin.mjs'};data=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
  }
  await writeFile(destination,data);if(name.endsWith('.sh'))await chmod(destination,0o755);
  entries.push({path:name,bytes:data.length,sha256:sha(data)});
 }
 const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 const manifest={format:'ea3/build-manifest/1',version:pkg.version,files:entries};
 await writeFile(resolve(target,'BUILD-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 return {target,fileCount:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0),manifestSha256:sha(JSON.stringify(manifest)),version:pkg.version};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildProject(),null,2));
