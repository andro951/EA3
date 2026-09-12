import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {GenerationService,FileJournal} from './generation.mjs';
import {createAPI} from './service.mjs';
import {actorFor} from './auth.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
export function createServer({root=ROOT,port=4173,host='127.0.0.1',apiHandler=null}={}){
  const server=http.createServer(async(req,res)=>{
    const reply=(status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; media-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://perchance.org https://*.perchance.org");
    const hostname=String(req.headers.host||'').toLowerCase().replace(/:\d+$/,'').replace(/^\[|\]$/g,'');
    const allowed=new Set(['127.0.0.1','localhost',host,...String(process.env.ALLOWED_HOSTS||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean)]);
    if(!allowed.has(hostname))return reply(403,{error:'Host is not allowed. Bind explicitly for a trusted deployment.'});
    if(req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin))return reply(403,{error:'Cross-origin requests are not allowed.'});
    try{
      const url=new URL(req.url,'http://localhost');
      if(apiHandler && await apiHandler(req,res,url))return;
      if(url.pathname==='/integrations/perchance-host.js'&&req.method==='GET'){
        const source=await readFile(resolve(root,'integrations/host.mjs'),'utf8');
        res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
        return reply(200,'(()=>{\n'+source.replace(/^export /gm,'')+'\nglobalThis.EA3Host={installHost,perchancePlugins};\n})();','text/javascript; charset=utf-8');
      }
      if(url.pathname==='/api/health')return reply(200,{ok:true,app:'EmberAdventures 3',version:'3.0.0-rc.1'});
      if(url.pathname==='/api/providers')return reply(200,{text:{demo:true,configured:!!process.env.TEXT_ENDPOINT},image:{upload:true,configured:!!process.env.IMAGE_ENDPOINT},secrets:'server-side only'});
      if(!['GET','HEAD'].includes(req.method))return reply(405,{error:'Method not allowed.'});
      let path=decodeURIComponent(url.pathname);if(path==='/')path='/index.html';if(['/operator.html','/workbench.html'].includes(path))res.setHeader('Content-Security-Policy',String(res.getHeader('Content-Security-Policy')).replace(/frame-ancestors[^;]+/,"frame-ancestors 'none'"));
      if(!/^\/(?:index\.html|recovery\.html|workbench\.html|operator\.html|app\/[\w./-]+|public\/[\w./-]+|content\/[\w./-]+|integrations\/[\w./-]+)$/.test(path)||path.includes('..')||path.split('/').some(p=>p.startsWith('.')))return reply(404,{error:'Not found.'});
      const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return reply(404,{error:'Not found.'});
      const resolved=await realpath(file);if(!resolved.startsWith(root+sep))return reply(404,{error:'Not found.'});
      const info=await stat(file);if(!info.isFile())return reply(404,{error:'Not found.'});
      const type=MIME[extname(file)];if(!type)return reply(404,{error:'Not found.'});
      res.setHeader('Cache-Control',path.startsWith('/public/art/')?'public, max-age=3600':'no-cache');
      res.writeHead(200,{'Content-Type':type,'Content-Length':info.size});if(req.method==='HEAD')return res.end();
      const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch(error){if(!res.headersSent)reply(error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Not found.':'The local service encountered an error.'});else res.destroy();}
  });return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT || 4173),host=process.env.HOST || '127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid TCP port.');
  const journal=await new FileJournal(resolve(ROOT,'.runtime','generation')).open();
  await journal.prune();
  const community=await createAPI();
  const generation=new GenerationService({env:process.env,journal,authorize:req=>{if(['127.0.0.1','localhost','::1'].includes(host)&&process.env.PUBLIC_MODE!=='1')return 'local';const actor=actorFor(community.context.db,req);return actor&&!actor.restricted?actor.id:null;}});
  const server=createServer({port,host,apiHandler:async(req,res,url)=>await community(req,res,url)||await generation.handle(req,res,url)});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Set PORT in .env or close the other instance.`:error.message);process.exitCode=1;});
  server.listen(port,host,()=>console.log(`EmberAdventures 3\nOpen http://${host}:${port}\nLocal saves live in your browser. Use Your data for backups.\nPress Ctrl+C to stop the service.`));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{generation.close();server.close(()=>{community.close();process.exit(0);});});
}
