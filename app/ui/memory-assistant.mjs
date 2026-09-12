import {suggestMemories,memoryRequest} from '../core/memory-review.mjs';
import {makeAuthorProvider} from '../providers/registry.mjs';
import {$,button,modal,toast,onError,esc} from './dom.mjs';
export function memoryAssistant(app,{onComplete=()=>{}}={}){
 const session=app.session,preview=memoryRequest(session.save);let controller=null,closed=false;
 const d=modal('Find important memories',`<p>Review the most recent ${preview.draft.transcript.length} story responses for facts, promises and relationship changes worth keeping.</p><p class="editor-help">This makes an additional request to your selected text provider and may use its quota or incur its normal cost. It does not advance the story. Each suggestion must cite a matching quote; you still decide whether the proposed fact is accurate.</p>${preview.draft.omittedEarlierTurns?`<p class="editor-help">${preview.draft.omittedEarlierTurns} earlier responses are outside this review window. They remain in your adventure.</p>`:''}<div id="memory-review-status" role="status"></div>`,{wide:true,footer:button('memory-review-start','Review recent story','spark','primary')+button('memory-review-stop','Stop','stop'),onClose:()=>{closed=true;controller?.abort();}});
 d.on('click','[data-action="memory-review-stop"]',()=>controller?.abort());
 d.on('click','[data-action="memory-review-start"]',async(_e,t)=>{
  if(controller)return;t.disabled=true;controller=new AbortController();
  try{
   const provider=makeAuthorProvider(app.settings);$('#memory-review-status',d.element).textContent='Finding source-backed suggestions…';
   const result=await suggestMemories({session,repository:app.repo,provider,signal:controller.signal});
   if(!closed){d.close();toast(result.added?`${result.added} suggested memories are ready to review.`:'No new source-backed memories were proposed.');await onComplete();}
  }catch(error){if(!closed)$('#memory-review-status',d.element).textContent=controller.signal.aborted?'Review stopped. Existing memory is unchanged.':error.message;onError(error);}
  finally{controller=null;t.disabled=false;}
 });return d;
}
