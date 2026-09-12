export function fail(status,message,code='REQUEST_FAILED') {const e=new Error(message);e.status=status;e.code=code;throw e;}
export function json(res,status,value,headers={}) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(value));
}
export async function readBody(req,limit=2*1024*1024) {
  let length=0;const chunks=[];
  for await(const chunk of req) {length+=chunk.length;if(length>limit)fail(413,'Request exceeds the documented transport size limit.');chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}',(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe field: '+key);return value;});}
  catch(e) {fail(400,'Invalid JSON: '+e.message);}
}
export async function responseBytes(response,limit,signal) {
  const reader=response.body?.getReader();if(!reader)fail(502,'Provider returned no body.');const chunks=[];let size=0;
  try {while(true){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)fail(502,'Provider response exceeds the configured transport budget.');chunks.push(Buffer.from(value));}}
  finally {reader.releaseLock();}
  return Buffer.concat(chunks);
}
export class RateLimiter {
  constructor({clock=Date.now}={}) {this.clock=clock;this.entries=new Map();}
  take(key,{limit=60,windowMs=60000}={}) {
    const now=this.clock();let entry=this.entries.get(key);
    if(!entry||entry.until<=now){entry={used:0,until:now+windowMs};this.entries.set(key,entry);}
    if(entry.used>=limit)fail(429,'Too many requests. Wait before trying again.');entry.used++;
    if(this.entries.size>10000)for(const [key,value] of this.entries)if(value.until<=now)this.entries.delete(key);
  }
}
