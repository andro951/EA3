import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {canonical,safeJSON,requireThat} from '../app/core/util.mjs';
import {narrativePrompt,imagePrompt,authoringPrompt} from '../app/providers/prompts.mjs';
import {readSSE} from '../app/providers/stream.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,120}$/.test(value);
export class FileJournal {
  constructor(directory){this.directory=directory;}
  async open(){await mkdir(this.directory,{recursive:true,mode:0o700});return this;}
  path(owner,id){return join(this.directory,digest(owner+'\0'+id)+'.json');}
  async get(owner,id){try{return safeJSON(await readFile(this.path(owner,id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  async put(owner,record){const path=this.path(owner,record.id),temporary=path+'.tmp';await writeFile(temporary,JSON.stringify({...record,owner}),{mode:0o600});await rename(temporary,path);}
  async prune(){const files=(await readdir(this.directory)).filter(f=>f.endsWith('.json'));if(files.length<500)return;const records=await Promise.all(files.map(async f=>{try{return {file:f,record:safeJSON(await readFile(join(this.directory,f),'utf8'))};}catch{return null;}}));const finished=records.filter(r=>r&&['complete','failed-or-unknown','cancelled-unknown'].includes(r.record.state)).sort((a,b)=>a.record.at.localeCompare(b.record.at));for(const r of finished.slice(0,Math.max(0,files.length-450)))await unlink(join(this.directory,r.file)).catch(()=>{});}
}
export async function readJSON(req,limit=600000){requireThat(req.headers['content-type']?.split(';')[0]==='application/json','Send application/json.','BAD_REQUEST');let size=0,parts=[];for await(const chunk of req){size+=chunk.length;requireThat(size<=limit,'Request exceeds the disclosed input budget.','TOO_LARGE');parts.push(chunk);}return safeJSON(Buffer.concat(parts).toString('utf8'));}
export function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
export class GenerationService {
  constructor({env={},journal,fetcher=globalThis.fetch,authorize=req=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)?'local':null}={}){Object.assign(this,{env,journal,fetcher,authorize});this.active={text:0,image:0};this.locks=new Set();this.controllers=new Map();}
  capabilities(){return {text:{demo:true,configured:!!this.env.TEXT_ENDPOINT,format:this.env.TEXT_API_KIND || 'chat'},image:{upload:true,configured:!!this.env.IMAGE_ENDPOINT,format:this.env.IMAGE_API_KIND || 'images'},authoring:{configured:!!this.env.TEXT_ENDPOINT},secrets:'Server-side only; never included in browser settings or archives',automaticRetries:false};}
  async handle(req,res,url){
    if(url.pathname==='/api/providers'){json(res,200,this.capabilities());return true;}
    if(!url.pathname.startsWith('/api/generate/'))return false;
    const owner=await this.authorize(req);if(!owner){json(res,403,{error:'Generation requires an authorized local session or authenticated deployment.'});return true;}
    const parts=url.pathname.split('/'),kind=parts[3],requestId=parts[4];
    if(kind==='status'){
      if(req.method!=='GET'||!validId(requestId)){json(res,400,{error:'Invalid reconciliation request.'});return true;}
      const record=await this.journal.get(owner,requestId);json(res,record?200:404,record || {error:'No recorded request. No new generation was dispatched.'});return true;
    }
    if(kind==='cancel'){
      if(req.method!=='POST'||!validId(requestId)){json(res,400,{error:'Invalid cancellation request.'});return true;}
      this.controllers.get(owner+'|'+requestId)?.abort();json(res,200,{stopped:true,remoteCompletionMayBeUnknown:true});return true;
    }
    if(req.method!=='POST'||!['text','author','image'].includes(kind)){json(res,405,{error:'Unsupported generation operation.'});return true;}
    const lane=kind==='image'?'image':'text',endpoint=this.env[lane==='text'?'TEXT_ENDPOINT':'IMAGE_ENDPOINT'];
    if(!endpoint){json(res,503,{error:`No ${lane} provider is configured. Set the endpoint in the server environment or use the Perchance host bridge.`});return true;}
    let input,key,record,controller,ownedLock=false;
    try{
      input=await readJSON(req);requireThat(validId(input.id)&&input.request&&typeof input.request==='object','A stable request ID and semantic request are required.','BAD_REQUEST');
      key=owner+'|'+input.id;requireThat(!this.locks.has(key),'That request is running. It was not dispatched twice.','PENDING');this.locks.add(key);ownedLock=true;
      const fingerprint=digest(canonical({kind,request:input.request})),prior=await this.journal.get(owner,input.id);
      if(prior){requireThat(prior.requestHash===fingerprint,'That request ID belongs to different input.','CONFLICT');requireThat(prior.state==='complete','The previous request is incomplete or its remote result is unknown. Reconcile it before deliberately creating a new request.','UNKNOWN_RESULT');json(res,200,prior.result);return true;}
      requireThat(this.active[lane]<(lane==='text'?2:1),'The provider lane is busy. Nothing was dispatched.','BUSY');
      const target=new URL(endpoint);requireThat(['http:','https:'].includes(target.protocol)&&!target.username&&!target.password,'Invalid server endpoint configuration.');
      const prompt=kind==='image'?imagePrompt(input.request):kind==='author'?authoringPrompt(input.request):narrativePrompt(input.request,{budget:Number(this.env.TEXT_CONTEXT_CHARS || 64000)});
      controller=new AbortController();this.controllers.set(key,controller);this.active[lane]++;
      record={id:input.id,kind,state:'submitted',requestHash:fingerprint,request:input.request,prompt,at:new Date().toISOString()};await this.journal.put(owner,record);
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});
      const send=(event,data)=>{if(!res.destroyed&&!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
      try{
        record.state='running';await this.journal.put(owner,record);
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(Number(this.env.PROVIDER_TIMEOUT_MS || 180000))]);
        const result=kind==='image'?await this.image(target,prompt,signal):await this.text(target,prompt,input.request,signal,text=>send('chunk',{text}),kind==='author');
        requireThat(!signal.aborted,'The request was stopped.','CANCELLED');
        record={...record,state:'complete',finishedAt:new Date().toISOString(),result};await this.journal.put(owner,record);send('result',result);
      }catch(error){record={...record,state:controller.signal.aborted?'cancelled-unknown':'failed-or-unknown',finishedAt:new Date().toISOString(),error:error.code || error.name || 'PROVIDER_ERROR'};await this.journal.put(owner,record);send('error',{error:error.code?error.message:'Generation did not complete. No automatic retry was issued; inspect the recorded request.',code:record.error});}
      finally{res.off('close',disconnected);res.end();}
    }catch(error){if(!res.headersSent)json(res,['PENDING','CONFLICT','UNKNOWN_RESULT'].includes(error.code)?409:error.code==='BUSY'?429:error.code==='TOO_LARGE'?413:400,{error:error.message,code:error.code});else res.end();}
    finally{if(controller){this.active[lane]--;this.controllers.delete(key);}if(ownedLock)this.locks.delete(key);}
    return true;
  }
  async text(target,prompt,semantic,signal,onChunk,author=false){
    const native=this.env.TEXT_API_KIND==='ea3',headers={'Content-Type':'application/json'};if(this.env.TEXT_API_KEY)headers.Authorization=`Bearer ${this.env.TEXT_API_KEY}`;
    const model=this.env.TEXT_MODEL || 'local-model';
    const body=native?{request:semantic,promptVersion:prompt.version}:{model,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],stream:!author,max_tokens:Number(this.env.TEXT_MAX_TOKENS || (author?4096:1600))};
    const response=await this.fetcher(target,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'error'});
    requireThat(response.ok,`The configured text provider returned HTTP ${response.status}. No automatic retry was issued.`,'UPSTREAM');
    let text='',reportedModel=model,memories=[],finishReason,terminal=false;
    if(response.headers.get('content-type')?.includes('text/event-stream')){
      await readSSE(response.body,({data,type})=>{
        if(data==='[DONE]'){terminal=true;return;}const v=safeJSON(data);requireThat(!v.error,'The upstream text provider reported an error.','UPSTREAM');
        let piece=native?(type==='chunk'?v.text:''):v.choices?.[0]?.delta?.content;
        if(typeof piece==='string'){text+=piece;onChunk(piece);}
        if(native&&type==='result'){terminal=true;text=v.text || text;memories=v.memories || [];}
        if(v.model)reportedModel=v.model;if(v.choices?.[0]?.finish_reason){finishReason=v.choices[0].finish_reason;terminal=true;}
      },{signal,maxBytes:1200000,maxFrame:250000});
      requireThat(terminal,'The upstream stream ended before completion. Its result is unknown.','UNKNOWN_RESULT');
    }else{
      const raw=await response.text();requireThat(raw.length<=1200000,'The provider returned an oversized response.');const v=safeJSON(raw);requireThat(!v.error,'The upstream text provider reported an error.','UPSTREAM');
      text=native?v.text:v.choices?.[0]?.message?.content;reportedModel=v.model || model;memories=native&&Array.isArray(v.memories)?v.memories:[];if(typeof text==='string'&&!author)onChunk(text);
    }
    requireThat(typeof text==='string'&&text.trim()&&text.length<=200000,'The provider returned no usable narrative.');
    return {text,memories,provider:'http',model:reportedModel,simulated:false,promptVersion:prompt.version,context:prompt.context,finishReason};
  }
  async image(target,prompt,signal){
    const headers={'Content-Type':'application/json'};if(this.env.IMAGE_API_KEY)headers.Authorization=`Bearer ${this.env.IMAGE_API_KEY}`;
    const native=this.env.IMAGE_API_KIND==='ea3',model=this.env.IMAGE_MODEL || 'local-image-model';
    const body=native?prompt:{model,prompt:prompt.prompt,n:1,size:this.env.IMAGE_SIZE || '1024x1024',response_format:'b64_json'};
    const r=await this.fetcher(target,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'error'});requireThat(r.ok,`The image provider returned HTTP ${r.status}.`,'UPSTREAM');
    const raw=await r.text();requireThat(raw.length<=22000000,'Image response exceeded the 22 MB transfer budget.');const v=safeJSON(raw);
    const data=native?v.data:v.data?.[0]?.b64_json?`data:image/png;base64,${v.data[0].b64_json}`:null;
    requireThat(typeof data==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data),'This image adapter requires owned PNG/JPEG/WebP data. A remote image URL was not fetched automatically.');
    return {data,provider:'http',model:v.model || model,seed:v.seed ?? null,simulated:false,promptVersion:prompt.version};
  }
  close(){for(const controller of this.controllers.values())controller.abort();}
}
