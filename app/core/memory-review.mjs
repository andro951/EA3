/** Source-backed continuity suggestions. Nothing here mutates authoritative world state. */
import {clone,id,now,requireThat,isRecord,safeJSON} from './util.mjs';
const normalize=s=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function memoryRequest(save,{maxCharacters=36000,maxTurns=12}={}){
 const transcript=[],all=save.events.filter(e=>e.narration);let size=0;
 for(const e of [...all].reverse()){
  const row={id:e.id,player:e.playerText||'',narration:e.narration},length=row.player.length+row.narration.length;
  if(transcript.length>=maxTurns||size+length>maxCharacters)break;
  transcript.unshift(row);size+=length;
 }
 requireThat(transcript.length,'The latest response exceeds the memory review budget. Record its important details manually; no saved text was truncated.');
 const known=(save.state.memory||[]).filter(m=>save.profile.rating==='mature'||m.rating!=='mature').map(m=>({subject:m.subject,text:m.text}));
 requireThat(JSON.stringify(known).length<16000,'Existing memory exceeds this review budget. Review or consolidate it manually before requesting more suggestions.');
 return {kind:'memory',requestId:id('memory-review'),draft:{schema:'ea3/memory-review/1',saveId:save.id,baseRevision:save.revision,rating:save.profile.rating||'sfw',subjects:[{id:'world',name:'World'},{id:'player',name:save.profile.name},...save.characters.map(c=>({id:c.id,name:c.name}))],known,transcript,omittedEarlierTurns:all.length-transcript.length}};
}
export function reviewMemories(request,result){
 const context=request.draft;requireThat(context?.schema==='ea3/memory-review/1','Invalid memory review request.');
 let data=result;if(typeof data==='string'){let text=data.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');data=safeJSON(text);}
 requireThat(isRecord(data)&&Array.isArray(data.memories)&&data.memories.length<=12,'Return a JSON object containing at most 12 memory suggestions.');
 const subjects=new Set(context.subjects.map(s=>s.id)),turns=new Map(context.transcript.map(t=>[t.id,t])),seen=new Set(context.known.map(m=>m.subject+'|'+normalize(m.text))),proposals=[];
 let duplicates=0;
 for(const m of data.memories){
  requireThat(isRecord(m)&&subjects.has(m.subject),'A suggestion refers to an unknown character.');
  requireThat(typeof m.text==='string'&&m.text.trim().length>0&&m.text.length<=1600,'Memory text must contain 1–1600 characters.');
  requireThat(typeof m.quote==='string'&&m.quote.length>=6&&m.quote.length<=1000,'Each suggestion needs a short supporting quote.');
  const source=turns.get(m.sourceEvent);requireThat(source,'A suggestion cites a turn outside this review.');
  requireThat([source.player,source.narration].some(text=>text.includes(m.quote)),'The supporting quote does not occur in the cited story turn.');
  const rating=m.rating==='mature'?'mature':'sfw';requireThat(context.rating==='mature'||rating==='sfw','Mature-only memory cannot enter an SFW review.');
  const key=m.subject+'|'+normalize(m.text);if(seen.has(key)){duplicates++;continue;}seen.add(key);
  proposals.push({id:id('candidate'),subject:m.subject,text:m.text.trim(),rating,sourceEvent:m.sourceEvent,quote:m.quote,origin:'source-backed review'});
 }
 return {proposals,duplicates};
}
export async function suggestMemories({session,repository,provider,signal}){
 requireThat(!session.pending,'Finish or stop the current response before reviewing memory.');
 const request=memoryRequest(session.save),key=request.requestId,revision=session.save.revision,saveId=session.save.id;
 const job={id:key,kind:'memory-review',provider:provider.id,request,saveId,baseRevision:revision,createdAt:now(),state:'submitted'};
 await repository.put('jobs',key,job);
 try{
  const response=await provider.generate(request,{signal});
  requireThat(!signal?.aborted,'Memory review stopped.','CANCELLED');
  const reviewed=reviewMemories(request,response.text??response);
  requireThat(session.save.id===saveId&&session.save.revision===revision&&!session.pending,'The adventure changed during memory review. No suggestions were applied.','CONFLICT');
  const prior=session.save.memoryCandidates||[],existing=new Set(prior.map(m=>m.subject+'|'+normalize(m.text)));
  const proposals=reviewed.proposals.filter(m=>!existing.has(m.subject+'|'+normalize(m.text)));
  if(proposals.length)await session.updateMetadata({memoryCandidates:[...prior,...proposals]});
  await repository.remove('jobs',key);
  return {...reviewed,added:proposals.length,omittedEarlierTurns:request.draft.omittedEarlierTurns};
 }catch(error){await repository.put('jobs',key,{...job,state:error.code==='CONFLICT'?'stale-review':signal?.aborted?'cancelled-unknown':'failed-or-unknown',error:error.message}).catch(()=>{});throw error;}
}
