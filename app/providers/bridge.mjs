import {id,requireThat} from '../core/util.mjs';
import {narrativePrompt,imagePrompt,authoringPrompt} from './prompts.mjs';
export class HostBridge {
  constructor({parent=globalThis.window?.parent,target=globalThis.window,origin='https://perchance.org',timeout=240000}={}){Object.assign(this,{parent,target,origin,timeout});this.pending=new Map();this.port=null;this.ready=null;}
  async connect() {
    if(this.ready)return this.ready;
    requireThat(this.parent && this.parent!==this.target,'Perchance requires the documented embedded host. Select the local demo or configure a server provider for standalone play.');
    requireThat(/^https?:\/\//.test(this.origin)&&new URL(this.origin).origin===this.origin,'Configure an exact trusted host origin.');
    this.ready=new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),nonce=id('handshake');this.port=channel.port1;
      const timer=setTimeout(()=>{this.close();reject(new Error('The host did not answer. Verify its allowed game origin and provider setup.'));},10000);
      this.port.onmessage=event=>{const m=event.data;if(m?.type==='EA3_READY'&&m.nonce===nonce){clearTimeout(timer);this.capabilities=m.capabilities;resolve(m.capabilities);return;}const job=this.pending.get(m?.id);if(!job)return;if(m.type==='chunk'){job.onChunk(m.text);return;}if(m.type==='result')job.finish(null,m.result);else if(m.type==='status')job.finish(null,m.record);else if(m.type==='error')job.finish(Object.assign(new Error(m.error),{code:m.code || 'HOST_ERROR'}));};
      this.port.start();this.parent.postMessage({type:'EA3_HELLO',version:1,nonce},this.origin,[channel.port2]);
    }).catch(e=>{this.ready=null;throw e;});return this.ready;
  }
  async request(kind,payload,{signal,onChunk=()=>{},requestId=id('request'),status=false}={}) {
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    const capabilities=await this.connect();if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    requireThat(status||capabilities[kind],`The host does not support ${kind} generation.`);
    requireThat(!this.pending.has(requestId),'This request is already in progress.');
    return new Promise((resolve,reject)=>{
      let timer;
      const finish=(error,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);this.pending.delete(requestId);error?reject(error):resolve(result);};
      const abort=()=>{this.port?.postMessage({type:'cancel',id:requestId});finish(new DOMException('Stopped','AbortError'));};
      this.pending.set(requestId,{finish,onChunk:text=>{if(!signal?.aborted&&typeof text==='string')onChunk(text);}});
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{this.port?.postMessage({type:'cancel',id:requestId});finish(Object.assign(new Error('Host response timed out. Remote completion is unknown; reconcile before retrying.'),{code:'UNKNOWN_RESULT'}));},this.timeout);
      this.port.postMessage(status?{type:'status',id:requestId}:{type:'request',id:requestId,kind,payload});
    });
  }
  close(){for(const job of [...this.pending.values()])job.finish(new DOMException('Host disconnected','AbortError'));this.port?.close();this.port=null;this.ready=null;}
}
export class PerchanceProvider {
  constructor(kind,bridge){this.id='perchance';this.kind=kind;this.bridge=bridge;}
  async generate(request,options={}){
    const p=this.kind==='image'?imagePrompt(request):this.kind==='author'||request.schema==='ea3/authoring/1'?authoringPrompt(request):narrativePrompt(request);
    const payload=this.kind==='image'?p:{instruction:p.system+'\n\n'+p.user};
    const result=await this.bridge.request(this.kind==='author'?'text':this.kind,payload,{...options,requestId:request.action?.id || request.requestId || id('request')});
    return {...result,promptVersion:p.version,context:p.context,provider:'perchance',simulated:false};
  }
  status(requestId,options={}){return this.bridge.request(this.kind,null,{...options,requestId,status:true});}
}
