/** Start the isolated built runtime and verify manifest bytes and private-file boundaries. */
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer as createPortProbe} from 'node:net';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {buildProject} from './build.mjs';
const first=await buildProject(),second=await buildProject();assert.equal(first.manifestSha256,second.manifestSha256,'Build is not reproducible.');
const root=second.target,manifest=JSON.parse(await readFile(resolve(root,'BUILD-MANIFEST.json'),'utf8'));
for(const entry of manifest.files){const data=await readFile(resolve(root,entry.path));assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256,entry.path);}
const {createServer}=await import(pathToFileURL(resolve(root,'server/main.mjs'))),server=createServer({root,port:0});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let responses=0;
try{
 for(const file of manifest.files.filter(e=>/^(app|public|content)\//.test(e.path)||e.path.endsWith('.html'))){const res=await fetch(origin+'/'+file.path);assert.equal(res.status,200,file.path);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);responses++;}
 for(const path of ['/.env','/.env.example','/server/db.mjs','/package.json','/.runtime/community.sqlite','/tools/admin.mjs'])assert.equal((await fetch(origin+path)).status,404,path);
 const health=await (await fetch(origin+'/api/health')).json();assert.equal(health.ok,true);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
// Exercise the actual built entry point too, not only its exported static handler.
const directory=await mkdtemp(resolve(tmpdir(),'ea3-built-start-'));
const probe=createPortProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));
const port=probe.address().port;await new Promise(r=>probe.close(r));
let log='',startupChecked=false;
const child=spawn(process.execPath,['--env-file-if-exists=.env','server/main.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),EA3_DATA_DIR:directory,EA3_TEST_INSTANCE:'1',TEXT_ENDPOINT:'',IMAGE_ENDPOINT:'',TEXT_API_KEY:'',IMAGE_API_KEY:''},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const closed=new Promise(resolve=>child.once('close',resolve));let spawnError;
child.once('error',error=>{spawnError=error;});
try{
 const base='http://127.0.0.1:'+port;let healthy=false;
 for(let attempt=0;attempt<100;attempt++){
  if(spawnError)throw spawnError;
  if(child.exitCode!==null)throw Error('Built entry point exited: '+log);
  try{const result=await fetch(base+'/api/health');healthy=result.ok;}catch{}
  if(healthy)break;await sleep(50);
 }
 assert.ok(healthy,'Built entry point failed to start: '+log);
 const info=await (await fetch(base+'/api/session')).json();assert.equal(info.user,null);assert.equal(info.testInstance,true);
 const providers=await (await fetch(base+'/api/providers')).json();assert.equal(providers.text.configured,false);assert.equal(providers.image.configured,false);
 assert.equal((await fetch(base+'/api/admin/reports')).status,401);
 assert.equal((await fetch(base+'/.env')).status,404);
 assert.equal((await fetch(base+'/')).status,200);startupChecked=true;
}finally{
 child.kill('SIGTERM');await Promise.race([closed,sleep(3000)]);
 if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await closed;}
 await rm(directory,{recursive:true,force:true});await rm(resolve(root,'.runtime'),{recursive:true,force:true});
}
const report={passed:true,builtEntrypointStarted:startupChecked,anonymousSessionChecked:true,privilegedAPIRejected:true,reproducibleManifest:true,fileCount:manifest.files.length,verifiedStaticResponses:responses,manifestSha256:second.manifestSha256,privateFileChecks:6,scope:'Built runtime HTTP/static and actual entry-point startup acceptance. Separate native UI suites and live providers are not implied.'};await mkdir('evidence',{recursive:true});await writeFile('evidence/release-package.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
