import {id,requireThat} from '../core/util.mjs';
import {normalizedResponse} from './stream.mjs';
export class HttpProvider {
  constructor(kind='text',{fetcher=(...args)=>globalThis.fetch(...args),base='/api/generate'}={}){this.id='http';this.kind=kind;this.fetcher=fetcher;this.base=base;}
  async generate(request,{signal,onChunk=()=>{}}={}) {
    const requestId=request.action?.id || request.requestId || id('request');
    const response=await this.fetcher(`${this.base}/${this.kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,request}),signal});
    const result=await normalizedResponse(response,{signal,onChunk});
    if(this.kind==='text')requireThat(typeof result.text==='string'&&result.text.trim(),'The provider returned no narration.');
    if(this.kind==='image')requireThat(/^data:image\/(png|jpeg|webp);base64,/.test(result.data),'The provider did not return an owned raster image.');
    return {...result,simulated:false};
  }
  async status(requestId,{signal}={}){const r=await this.fetcher(`${this.base}/status/${encodeURIComponent(requestId)}`,{signal});if(!r.ok)throw new Error('Unable to reconcile that request.');return r.json();}
}
