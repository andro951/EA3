import {requireThat} from '../core/util.mjs';
/** SSE parser with chunk-boundary, UTF-8, CRLF, and explicit terminal-event handling. */
export async function readSSE(body,onEvent,{signal,maxBytes=24000000,maxFrame=22000000}={}) {
  requireThat(body?.getReader,'The server did not return a readable stream.');
  const reader=body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0,finished=false;
  const abort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  function consume(final=false) {
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))) {
      const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);emit(frame);
    }
    if(final && buffer.trim()){emit(buffer);buffer='';}
    requireThat(buffer.length<=maxFrame,'Provider returned an oversized stream event.');
  }
  function emit(frame) {
    let type='message',data=[];
    for(const line of frame.split(/\r?\n/)){if(line.startsWith('event:'))type=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));}
    if(data.length)onEvent({type,data:data.join('\n')});
  }
  try{
    while(true){if(signal?.aborted)throw new DOMException('Stopped','AbortError');const next=await reader.read();if(next.done){finished=true;break;}bytes+=next.value.byteLength;requireThat(bytes<=maxBytes,'Provider stream exceeded the disclosed response limit.');buffer+=decoder.decode(next.value,{stream:true});consume();}
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');buffer+=decoder.decode();consume(true);
  }finally{signal?.removeEventListener('abort',abort);if(!finished)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function normalizedResponse(response,{signal,onChunk=()=>{}}={}) {
  if(!response.ok){let message=`Provider service returned HTTP ${response.status}.`;try{const e=await response.json();if(typeof e.error==='string')message=e.error;}catch{}throw Object.assign(new Error(message),{status:response.status});}
  if(!response.headers.get('content-type')?.includes('text/event-stream')){const r=await response.json();requireThat(r && !r.error,r?.error || 'Invalid provider response.');return r;}
  let result=null;
  await readSSE(response.body,({type,data})=>{
    const value=JSON.parse(data);
    if(type==='chunk'){requireThat(typeof value.text==='string','Malformed narrative chunk.');onChunk(value.text);}
    else if(type==='result'){requireThat(!result,'Duplicate terminal provider result.');result=value;}
    else if(type==='error')throw Object.assign(new Error(value.error || 'Provider generation failed.'),{code:value.code});
  },{signal});
  requireThat(result,'The connection ended without a completed result. Check the recorded request before retrying.','UNKNOWN_RESULT');return result;
}
