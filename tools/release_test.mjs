/** Start the isolated built runtime and verify manifest bytes and private-file boundaries. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
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
const report={passed:true,reproducibleManifest:true,fileCount:manifest.files.length,verifiedStaticResponses:responses,manifestSha256:second.manifestSha256,privateFileChecks:6,scope:'Built runtime HTTP/static acceptance. Separate native UI suites and live providers are not implied.'};await mkdir('evidence',{recursive:true});await writeFile('evidence/release-package.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
