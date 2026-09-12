import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './db.mjs';
import {RateLimiter,json,fail} from './http-utils.mjs';
import {handleAuth} from './auth.mjs';
import {handleCommunity} from './community.mjs';
export async function createAPI({dataDir=process.env.EA3_DATA_DIR||resolve(fileURLToPath(new URL('../.runtime/community',import.meta.url))),config={},clock=Date.now,hooks={}}={}){
 const db=await openDatabase(dataDir),ctx={db,clock,hooks,limiter:new RateLimiter({clock}),config:{instanceName:process.env.EA3_INSTANCE_NAME||'Local EmberAdventures community',registration:process.env.EA3_REGISTRATION!=='false',secureCookies:process.env.EA3_SECURE_COOKIES==='true',testInstance:process.env.EA3_TEST_INSTANCE==='1',...config}};
 const handler=async(req,res,url)=>{
  if(!/^\/api\/(session|register|login|logout|public|versions|items|mine|operations|publish|ratings|reports|admin)(\/|$)/.test(url.pathname))return false;
  try{if(!['GET','HEAD'].includes(req.method)&&!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail(415,'Send an application/json request.');return await handleAuth(ctx,req,res,url)||await handleCommunity(ctx,req,res,url);}
  catch(error){if(!res.headersSent&&!res.destroyed)json(res,error.status||500,{error:error.status?error.message:'The local community service encountered an error.',code:error.code||'SERVICE_ERROR'});return true;}
 };
 handler.close=()=>db.close();handler.context=ctx;return handler;
}
