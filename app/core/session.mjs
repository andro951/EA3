import {id, now, requireThat, sleep, clone} from './util.mjs';
import {planAction,commitAction,rewind,rewriteBase,choices} from './engine.mjs';

/** The only coordinator allowed to commit generated narrative to an adventure. */
export class Session {
  constructor({save,compiled,repository,provider,onChange=()=>{},onStatus=()=>{},onChunk=()=>{}}) {
    Object.assign(this,{save,compiled,repository,provider,onChange,onStatus,onChunk});
    this.pending=null;this.epoch=0;this.autoToken=0;this.auto=false;
  }
  async turn(action,{replaceFrom=null,resultOverride=null}={}) {
    requireThat(!this.pending,'A response is already in progress. Stop it before making another change.','BUSY');
    const original=this.save,base=replaceFrom===null?original:rewriteBase(original,replaceFrom);
    const plan=planAction(this.compiled,base,{...action,id:id('turn')});
    const epoch=++this.epoch,controller=new AbortController();this.pending={id:plan.id,epoch,controller};
    const valid=()=>this.epoch===epoch && !controller.signal.aborted;
    let failure=null;
    this.onStatus({phase:plan.narrative?'generating':'saving',label:plan.narrative?'The story is unfolding…':'Saving changes…'});
    try {
      if(plan.narrative && !resultOverride)await this.repository.put('jobs',plan.id,{id:plan.id,saveId:original.id,state:'submitted',provider:this.provider.id,request:plan.semantic,baseRevision:original.revision,at:now()});
      if(!valid())throw new DOMException('Stopped','AbortError');
      const result=resultOverride || (plan.narrative?await this.provider.generate(plan.semantic,{signal:controller.signal,onChunk:chunk=>{if(valid())this.onChunk(chunk);}}):{});
      if(!valid())throw new DOMException('Stopped','AbortError');
      const next=commitAction(base,plan,result);
      this.onStatus({phase:'saving',label:'Saving adventure…'});
      await this.repository.commitSave(next,original.revision,{from:replaceFrom===null?original.events.length:replaceFrom,guard:valid,jobId:plan.id});
      this.save=next;this.onChange(next);
      return next;
    } catch(error) {
      failure=error;if(error.code==='CANCELLED')error.name='AbortError';
      if(plan.narrative && !resultOverride)await this.repository.put('jobs',plan.id,{id:plan.id,saveId:original.id,state:error.name==='AbortError'?'cancelled':'failed-or-unknown',provider:this.provider.id,request:plan.semantic,error:error.message,at:now()}).catch(()=>{});
      if(error.name!=='AbortError')this.onStatus({phase:'error',label:error.message,code:error.code});
      throw error;
    } finally {
      if(this.pending?.id===plan.id){this.pending=null;if(!failure)this.onStatus({phase:'ready',label:'Saved locally'});}
    }
  }
  stop() {
    this.auto=false;this.autoToken++;this.epoch++;
    const pending=this.pending;this.pending=null;pending?.controller.abort();
    this.onStatus({phase:'ready',label:pending?'Generation stopped · nothing committed':'Auto stopped'});
  }
  async rewind(eventCount) {
    this.stop();const old=this.save,next=rewind(old,eventCount),epoch=this.epoch;
    await this.repository.commitSave(next,old.revision,{from:eventCount,guard:()=>epoch===this.epoch});
    this.save=next;this.onChange(next);return next;
  }
  async regenerate(index) {
    requireThat(Number.isInteger(index) && this.save.events[index],'Choose an existing message.');
    const action=clone(this.save.events[index].action);delete action.id;
    this.stop();return this.turn(action,{replaceFrom:index});
  }
  async edit(index,text) {
    requireThat(Number.isInteger(index) && this.save.events[index],'Choose an existing message.');
    this.stop();return this.turn({kind:'say',text},{replaceFrom:index});
  }
  async replaceNarration(index,text) {
    requireThat(Number.isInteger(index) && this.save.events[index],'Choose an existing message.');
    const action=clone(this.save.events[index].action);delete action.id;
    this.stop();return this.turn(action,{replaceFrom:index,resultOverride:{text,provider:'manual',model:'player edit'}});
  }
  async updateMetadata(change) {
    requireThat(!this.pending,'Finish or stop generation first.');
    const allowed=Object.fromEntries(Object.entries(change).filter(([k])=>['title','bookmarks','characters','profile','assets','memoryCandidates'].includes(k)));
    const old=this.save,next={...old,...clone(allowed),id:old.id,state:old.state,initial:old.initial,events:old.events,revision:old.revision+1,updatedAt:now()};
    await this.repository.commitSave(next,old.revision,{from:old.events.length});this.save=next;this.onChange(next);return next;
  }
  async runAuto({mode='observe',limit=4,delayMs=1800}={}) {
    requireThat(['observe','delegate'].includes(mode),'Choose Observe or Delegate Auto.');
    requireThat(Number.isInteger(limit) && limit>=1 && limit<=100,'Auto budget must be 1–100 turns.');
    requireThat(!this.pending && !this.auto,'A response or Auto run is already active.');
    const token=++this.autoToken;this.auto=true;
    try {
      for(let count=0;count<limit && this.auto && token===this.autoToken;count++) {
        const available=choices(this.compiled,this.save.state).filter(c=>c.available);
        const safe=available.find(c=>c.autoSafe===true);
        const action=mode==='delegate' && safe?{kind:'choice',choiceId:safe.id}:{kind:'auto'};
        await this.turn(action);
        if(!this.auto || token!==this.autoToken || this.save.state.ending)break;
        if(available.length && !this.compiled.nodes.get(this.save.state.node)?.next && (mode==='observe' || !safe)) {
          this.onStatus({phase:'ready',label:'Auto paused for your decision'});break;
        }
        this.onStatus({phase:'auto',label:`Auto ${count+1}/${limit} · ${mode==='observe'?'Observe':'Delegate'}`});
        for(let elapsed=0;elapsed<delayMs && this.auto && token===this.autoToken;elapsed+=100)await sleep(Math.min(100,delayMs-elapsed));
      }
    } catch(error) {if(error.name!=='AbortError')throw error;}
    finally {if(token===this.autoToken){this.auto=false;this.onStatus({phase:'ready',label:'Auto finished'});}}
  }
}
