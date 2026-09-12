import {sleep} from '../core/util.mjs';
/** Deterministic, explicitly labeled local demonstration; it is not an LLM. */
export class DemoNarrator {
  id='demo';label='Local story demo';capabilities={streaming:true,memories:false,live:false};
  async generate(request,{signal,onChunk=()=>{}}={}) {
    const {scene,cast,action}=request,person=cast[0],name=person?.name?.split(' ')[0] || 'Your companion';
    let text=scene.authored;
    if(!text){
      const message=(request.playerText || '').toLowerCase();
      if(/\b(no|stop|leave me|not now|decline)\b/.test(message))text=`${name} gives the words their full weight. “All right.” The invitation is set aside, without an argument or a fresh attempt to persuade you.\n\nThe scene has room to take a different direction. The next decision remains yours.`;
      else if(request.continueWithoutPlayerDecision){
        const pauses=[`${name} lets the silence stand for a moment, then turns back to the task at hand. The invitation remains open; no answer is assumed.`, `A little time passes. ${name} notices a small detail in the room and points it out, giving the evening something to do without deciding your part in it.`, `${name} looks toward ${request.location?.name || 'the doorway'}. “There is no hurry,” they say. “We can think about what comes next.”`];
        text=pauses[request.state.clock%pauses.length];
      }else text=`${name} listens. The room holds a brief, thoughtful quiet before the conversation resumes.\n\n${scene.text.split('\n\n').at(-1) || 'The next step is yours to choose.'}`;
    }
    // Authored choices and local transactions provide deterministic consequences.
    const words=text.match(/\S+\s*/g) || [];
    for(let i=0;i<words.length;i+=5){await sleep(18,signal);onChunk(words.slice(i,i+5).join(''));}
    return {text,provider:this.id,model:'authored-story simulator',simulated:true};
  }
}
