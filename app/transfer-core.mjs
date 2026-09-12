/** Reliable, consent-gated archive transfer over an ordered DataChannel-like transport. */
import {requireThat as assert,id as uid,hash as sha256,safeJSON} from './core/util.mjs';
export const CHUNK_BYTES=12*1024;
export const TRANSFER_MAX_BYTES=128*1024*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export function toBase64(bytes){let text='';for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);return btoa(text);}
export function fromBase64(text){assert(typeof text==='string'&&text.length<=CHUNK_BYTES*2&&/^[A-Za-z0-9+/]*={0,2}$/.test(text),'Invalid transfer chunk encoding.');const binary=atob(text);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
export async function prepareTransfer(archive,{id=uid('transfer'),title='Adventure'}={}){const bytes=encoder.encode(JSON.stringify(archive));assert(bytes.length<=TRANSFER_MAX_BYTES,'Direct handoff has a 128 MiB memory budget. Use a complete portable archive for this larger adventure; nothing was truncated.');return {manifest:{type:'offer',version:1,id,title:String(title).slice(0,200),bytes:bytes.length,chunkSize:CHUNK_BYTES,chunks:Math.ceil(bytes.length/CHUNK_BYTES),hash:await sha256(bytes)},bytes};}
function send(channel,value){assert(channel.readyState==='open','The transfer channel is not open. Pair the devices again.');channel.send(JSON.stringify(value));}
export class TransferSender {
 constructor(channel,prepared,{onProgress=()=>{},onComplete=()=>{},onError=()=>{},ackTimeout=4000,maxRetries=3}={}){Object.assign(this,{channel,...prepared,onProgress,onComplete,onError,ackTimeout,maxRetries});this.next=0;this.sent=0;this.retries=0;this.timer=null;this.closed=false;this.completed=false;this.accepted=false;this.onMessage=e=>{this.handle(e.data).catch(err=>this.fail(err));};channel.addEventListener('message',this.onMessage);this.onDrain=()=>{try{this.pump();}catch(e){this.fail(e);}};channel.addEventListener('bufferedamountlow',this.onDrain);}
 offer(){send(this.channel,this.manifest);this.onProgress('Waiting for the receiving device to approve.');this.armTimer();}
 armTimer(){clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.closed||this.completed)return;if(this.retries++>=this.maxRetries)return this.fail(new Error('Transfer acknowledgement timed out. The sending copy and received checkpoints are retained. Pair again to resume.'));try{if(!this.accepted)send(this.channel,this.manifest);else{this.sent=this.next;this.pump();}this.armTimer();}catch(e){this.fail(e);}},this.ackTimeout);}
 async handle(raw){assert(typeof raw==='string'&&raw.length<10000,'Invalid transfer control frame.');const m=safeJSON(raw);if(m.id!==this.manifest.id||this.closed)return;
  if(m.type==='accept'||m.type==='ack'){assert(Number.isInteger(m.next)&&m.next>=0&&m.next<=this.manifest.chunks,'Invalid acknowledgement.');if(m.type==='ack')assert(m.next<=this.sent,'Peer acknowledged unsent data.');const first=!this.accepted,progress=m.next>this.next;this.accepted=true;if(progress){this.next=m.next;this.sent=Math.max(this.sent,this.next);this.retries=0;}this.onProgress(`Sending ${Math.min(100,Math.round(this.next/this.manifest.chunks*100))}% · source retained`);this.pump();if(first||progress)this.armTimer();}
  if(m.type==='complete'){assert(m.hash===this.manifest.hash,'Completion digest mismatch.');this.completed=true;clearTimeout(this.timer);this.onComplete(m.result);}
  if(m.type==='reject'||m.type==='cancel')this.fail(new Error(m.reason||'The receiving device declined or cancelled.'));
 }
 pump(){if(this.closed||this.completed||!this.accepted)return;if(this.next===this.manifest.chunks){send(this.channel,{type:'finish',id:this.manifest.id,hash:this.manifest.hash});return;}
  const end=Math.min(this.next+8,this.manifest.chunks);while(this.sent<end){if((this.channel.bufferedAmount||0)>256*1024)return;const i=this.sent++;const data=toBase64(this.bytes.subarray(i*CHUNK_BYTES,Math.min(this.bytes.length,(i+1)*CHUNK_BYTES)));send(this.channel,{type:'chunk',id:this.manifest.id,index:i,data});}}
 cancel(){if(!this.closed&&this.channel.readyState==='open')send(this.channel,{type:'cancel',id:this.manifest.id,reason:'Sender cancelled.'});this.close();}
 fail(error){clearTimeout(this.timer);this.closed=true;this.channel.removeEventListener('message',this.onMessage);this.channel.removeEventListener('bufferedamountlow',this.onDrain);this.onError(error);}
 close(){clearTimeout(this.timer);this.closed=true;this.channel.removeEventListener('message',this.onMessage);this.channel.removeEventListener('bufferedamountlow',this.onDrain);}
}
export class TransferReceiver {
 constructor(channel,{approve=async()=>false,load=async()=>[],persist=async()=>{},importArchive=async()=>{},onProgress=()=>{},onComplete=()=>{},onError=()=>{}}={}){Object.assign(this,{channel,approve,load,persist,importArchive,onProgress,onComplete,onError});this.manifest=null;this.parts=new Map();this.next=0;this.closed=false;this.completed=false;this.queue=Promise.resolve();this.onMessage=e=>{this.queue=this.queue.then(()=>this.handle(e.data)).catch(err=>this.fail(err));};channel.addEventListener('message',this.onMessage);}
 async handle(raw){assert(typeof raw==='string'&&raw.length<CHUNK_BYTES*2+2000,'Invalid transfer frame size.');const m=safeJSON(raw);if(this.closed)return;
  if(m.type==='offer'){
   assert(m.version===1&&typeof m.id==='string'&&/^transfer-[a-zA-Z0-9-]+$/.test(m.id),'Unsupported transfer offer.');assert(Number.isSafeInteger(m.bytes)&&m.bytes>0&&m.bytes<=TRANSFER_MAX_BYTES,'Transfer exceeds the direct-transfer memory budget. Use a portable archive instead.');assert(m.chunkSize===CHUNK_BYTES&&m.chunks===Math.ceil(m.bytes/CHUNK_BYTES)&&/^[a-f0-9]{64}$/.test(m.hash),'Invalid transfer manifest.');
   if(this.manifest){assert(this.manifest.id===m.id&&this.manifest.hash===m.hash,'A different transfer cannot replace the active transfer.');send(this.channel,{type:this.completed?'complete':'accept',id:m.id,next:this.next,hash:m.hash,result:{duplicate:true}});return;}
   if(!await this.approve(m)){send(this.channel,{type:'reject',id:m.id,reason:'Recipient did not approve this archive.'});return;}this.manifest=m;
   for(const part of await this.load(m)){this.validatePart(part);this.parts.set(part.index,part.data);}while(this.parts.has(this.next))this.next++;
   await this.persist({type:'manifest',manifest:m});send(this.channel,{type:'accept',id:m.id,next:this.next});return;
  }
  assert(this.manifest&&m.id===this.manifest.id,'No approved matching transfer.');
  if(m.type==='chunk'){
   this.validatePart(m);if(this.parts.has(m.index)){assert(this.parts.get(m.index)===m.data,'A duplicate chunk changed its contents.');}else{await this.persist({type:'chunk',id:m.id,index:m.index,data:m.data});this.parts.set(m.index,m.data);}
   while(this.parts.has(this.next))this.next++;send(this.channel,{type:'ack',id:m.id,next:this.next});this.onProgress(`Receiving ${Math.round(this.next/this.manifest.chunks*100)}% · saved chunks acknowledged`);
  }else if(m.type==='finish'){
   if(this.completed){send(this.channel,{type:'complete',id:m.id,hash:this.manifest.hash,result:{duplicate:true}});return;}
   assert(this.next===this.manifest.chunks,'Transfer is incomplete. Missing chunks were not imported.');assert(m.hash===this.manifest.hash,'Finish digest does not match the approved offer.');const bytes=new Uint8Array(this.manifest.bytes);for(let i=0;i<this.manifest.chunks;i++)bytes.set(fromBase64(this.parts.get(i)),i*CHUNK_BYTES);assert(await sha256(bytes)===this.manifest.hash,'Transfer integrity failed. Nothing was imported.');
   const archive=safeJSON(decoder.decode(bytes));const result=await this.importArchive(archive);this.completed=true;await this.persist({type:'complete',id:m.id,hash:this.manifest.hash,result});send(this.channel,{type:'complete',id:m.id,hash:this.manifest.hash,result});this.onComplete(result);
  }else if(m.type==='cancel'){this.close();this.onError(new Error('Sender cancelled. Partial chunks were retained for an explicit resume.'));}else throw new Error('Unknown transfer frame.');
 }
 validatePart(p){assert(this.manifest,'Missing manifest.');assert(Number.isInteger(p.index)&&p.index>=0&&p.index<this.manifest.chunks,'Invalid chunk index.');const bytes=fromBase64(p.data),expected=p.index===this.manifest.chunks-1?this.manifest.bytes-p.index*CHUNK_BYTES:CHUNK_BYTES;assert(bytes.length===expected,'Chunk length does not match the approved manifest.');}
 fail(error){if(this.closed)return;if(this.channel.readyState==='open'&&this.manifest)send(this.channel,{type:'cancel',id:this.manifest.id,reason:error.message});this.closed=true;this.channel.removeEventListener('message',this.onMessage);this.onError(error);}
 close(){this.closed=true;this.channel.removeEventListener('message',this.onMessage);}
}
