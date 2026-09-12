/** New EA3 host equipment. No EA1 runtime logic. Never accepts privileged credentials. */
export function browserJournal(name='ea3-provider-host-v1'){
 let database;const open=()=>database||(database=new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('jobs',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));
 const tx=async(mode,fn)=>{const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction('jobs',mode),r=fn(t.objectStore('jobs'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Host journal transaction failed.'));});};
 return{get:id=>tx('readonly',s=>s.get(id)),put:value=>tx('readwrite',s=>s.put(value)),all:()=>tx('readonly',s=>s.getAll())};
}
export function installHost({gameOrigin,sourceWindow,providers,journal=browserJournal(),target=globalThis.window,onStatus=()=>{},maxQueued=4}={}){
 if(!/^https?:\/\//.test(gameOrigin)||new URL(gameOrigin).origin!==gameOrigin)throw Error('Configure an exact game origin without a path.');
 if(typeof sourceWindow!=='function')throw Error('An explicit trusted source-window resolver is required.');
 const jobs=new Map(),queues={text:[],image:[]},active={text:0,image:0},ports=new Set();let closed=false;
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id),message=(port,value)=>{try{port.postMessage(value);}catch{}};
 const publish=()=>onStatus({active:{...active},queued:{text:queues.text.length,image:queues.image.length},provider:providers.id,model:providers.model||'not reported',simulated:!!providers.simulated});
 async function pump(kind){if(closed||active[kind]||!queues[kind].length)return;const job=queues[kind].shift();if(job.cancelled){pump(kind);return;}active[kind]++;publish();
  try{job.record.state='running';job.record.startedAt=new Date().toISOString();await journal.put(job.record);
   const result=await providers[kind](job.record.payload,{signal:job.controller.signal,onChunk:text=>{if(!job.cancelled&&typeof text==='string')message(job.port,{type:'chunk',id:job.record.id,text});}});
   if(job.cancelled){job.record.state='cancelled-result-discarded';job.record.finishedAt=new Date().toISOString();await journal.put(job.record);return;}
   job.record={...job.record,state:'complete',finishedAt:new Date().toISOString(),result:{...result,provider:providers.id,model:result.model||providers.model||'not reported by provider',simulated:!!providers.simulated}};
   await journal.put(job.record);message(job.port,{type:'result',id:job.record.id,result:job.record.result});
  }catch(error){job.record.state=job.cancelled?'cancelled-unknown':'failed-unknown';job.record.error=String(error.message||error);job.record.finishedAt=new Date().toISOString();try{await journal.put(job.record);}catch{}if(!job.cancelled)message(job.port,{type:'error',id:job.record.id,error:job.record.error});}
  finally{active[kind]--;jobs.delete(job.record.id);publish();pump(kind);}
 }
 async function handle(port,m){
  if(closed||!validId(m?.id))return;
  if(m.type==='status'){const record=await journal.get(m.id);return message(port,{type:'status',id:m.id,record:record || {id:m.id,state:'not-found'}});}
  if(m.type==='cancel'){const job=jobs.get(m.id);if(job&&job.port===port){job.cancelled=true;job.controller.abort();job.record.state=active[job.record.kind]?'cancelled-unknown':'cancelled';await journal.put(job.record);}return;}
  if(m.type!=='request'||!['text','image'].includes(m.kind)||typeof providers[m.kind]!=='function')return message(port,{type:'error',id:m.id,error:'Unsupported provider capability.'});
  const raw=JSON.stringify(m.payload);if(typeof raw!=='string'||raw.length>524288)return message(port,{type:'error',id:m.id,error:'Host payload exceeds its disclosed 512 KiB budget.'});
  if(queues[m.kind].length>=maxQueued)return message(port,{type:'error',id:m.id,error:'Host lane queue is full. Nothing was dispatched.'});
  if(jobs.has(m.id))return message(port,{type:'error',id:m.id,error:'This job is already queued or running; it was not dispatched twice.'});
  const job={port,cancelled:false,controller:new AbortController(),record:{id:m.id,kind:m.kind,payload:JSON.parse(raw),requestJSON:raw,provider:providers.id,model:providers.model||'not reported',simulated:!!providers.simulated,state:'checking',submittedAt:new Date().toISOString()}};jobs.set(m.id,job);
  try{const prior=await journal.get(m.id);if(prior){jobs.delete(m.id);if(prior.requestJSON!==raw||prior.kind!==m.kind)throw Error('This job ID was previously used with different input.');if(prior.state==='complete')return message(port,{type:'result',id:m.id,result:prior.result});throw Error(`Recorded job is ${prior.state}. Reconcile it before creating a new request; remote completion may be unknown.`);}
   job.record.state='queued';await journal.put(job.record);if(job.cancelled){jobs.delete(m.id);return;}queues[m.kind].push(job);publish();pump(m.kind);
  }catch(e){jobs.delete(m.id);message(port,{type:'error',id:m.id,error:e.message});}
 }
 function hello(event){const m=event.data,sources=sourceWindow();if(closed||event.origin!==gameOrigin||!(Array.isArray(sources)?sources:[sources]).includes(event.source)||m?.type!=='EA3_HELLO'||m.version!==1||!validId(m.nonce)||!event.ports?.[0])return;
  const port=event.ports[0];ports.add(port);port.onmessage=e=>handle(port,e.data).catch(error=>message(port,{type:'error',id:e.data?.id,error:error.message}));port.start?.();message(port,{type:'EA3_READY',nonce:m.nonce,capabilities:{text:typeof providers.text==='function',image:typeof providers.image==='function',streaming:true,provider:providers.id,model:providers.model||'not reported',simulated:!!providers.simulated,separateLanes:true,maxQueued}});
 }
 target.addEventListener('message',hello);publish();return{status:()=>({active:{...active},queued:{text:queues.text.length,image:queues.image.length}}),exportJournal:()=>journal.all(),close(){closed=true;target.removeEventListener('message',hello);for(const j of jobs.values()){j.cancelled=true;j.controller.abort();}for(const p of ports)p.close();}};
}
/** Calls official plugin functions injected by the Perchance host page. Live acceptance is separate. */
export function perchancePlugins({text=globalThis.aiTextPlugin,image=globalThis.textToImagePlugin}={}){
 return{id:'perchance',model:'not reported by plugin',simulated:false,
  ...(typeof text==='function'?{text:async(payload,{signal,onChunk})=>{
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   let previous='';
   const result=await text({...payload,onChunk:chunk=>{if(signal.aborted)return;const full=chunk?.fullTextSoFar;const part=typeof full==='string'?full.slice(previous.length):typeof chunk==='string'?chunk:chunk?.textChunk||chunk?.text||chunk?.chunk||'';if(typeof full==='string')previous=full;else previous+=part;if(part)onChunk(part);}});
   const output=typeof result==='string'?result:result?.generatedText??result?.text??result?.response??result?.output??previous;
   if(typeof output!=='string'||!output.trim())throw Error('Text plugin returned no usable text. Inspect the host journal.');return{text:output,model:result?.model||'not reported by plugin'};
  }}:{}),
  ...(typeof image==='function'?{image:async(payload,{signal})=>{
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   let resolveFinish;const finish=new Promise(r=>resolveFinish=r);
   const returned=await image({...payload,negative:payload.negativePrompt,onFinish:resolveFinish});
   const owned=async r=>{let data=typeof r==='string'?r:r?.data||r?.dataUrl||r?.dataURL||r?.imageUrl||r?.url||r?.image?.src;if(r?.canvas?.toDataURL)data=r.canvas.toDataURL('image/png');if(typeof data==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(data))return data;return null;};
   let data=await owned(returned),result=returned,node=null,timer;
   try{if(!data){if(returned?.iframeHtml||typeof returned==='string'&&/^\s*<iframe[\s>]/i.test(returned)){node=document.createElement('div');node.hidden=true;node.innerHTML=returned.iframeHtml||returned;document.body.append(node);}result=await Promise.race([finish,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Image plugin did not produce an owned raster. Remote URL/iframe output requires a compatible onFinish callback; no automatic retry was issued.')),170000))]);data=await owned(result);}
    if(!data)throw Error('Image plugin returned a remote URL or unsupported result rather than an owned raster. Upload the image manually; no proxy bypass is used.');return{data,mime:data.slice(5,data.indexOf(';')),seed:result?.seed??payload.seed??null,model:result?.model||'not reported by plugin'};
   }finally{clearTimeout(timer);node?.remove();}
  }}:{})};
}
