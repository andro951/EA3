import {requireThat} from './core/util.mjs';
/** Browser speech adapter. Every chunk is revision-bound; stop cannot restart an old queue. */
export class NarrationVoice {
  constructor(synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance){this.synthesis=synthesis;this.Utterance=Utterance;this.epoch=0;this.state='idle';this.listeners=new Set();this.last=null;this.error='';}
  available(){return !!this.synthesis&&!!this.Utterance;}
  voices(){return this.synthesis?.getVoices() || [];}
  subscribe(fn){this.listeners.add(fn);fn(this.state);return()=>this.listeners.delete(fn);}
  emit(state){this.state=state;for(const fn of this.listeners)fn(state);}
  read(text,settings={}){
    requireThat(this.available(),'This browser does not provide speech synthesis. The written story remains available.');
    requireThat(typeof text==='string'&&text.trim(),'There is no narration to read.');
    this.stop();this.last={text,settings};this.error='';const epoch=this.epoch,queue=[];
    const names=Object.keys(settings.voiceAssignments || {}).filter(n=>n!=='Narrator');
    for(const paragraph of text.split(/\n\s*\n/)){
      const speaker=names.find(n=>paragraph.trimStart().startsWith(n+':')) || 'Narrator';
      const body=speaker==='Narrator'?paragraph:paragraph.trimStart().slice(speaker.length+1).trim();
      let rest=body;while(rest.length){let end=Math.min(650,rest.length);if(end<rest.length){const space=rest.lastIndexOf(' ',end);if(space>300)end=space;}queue.push({text:rest.slice(0,end),speaker});rest=rest.slice(end).trimStart();}
    }
    const next=()=>{if(epoch!==this.epoch)return;if(!queue.length){this.emit('idle');return;}const part=queue.shift(),u=new this.Utterance(part.text);this.speaker=part.speaker;u.rate=Math.min(2,Math.max(.5,Number(settings.voiceRate)||1));const choice=settings.voiceAssignments?.[part.speaker] || settings.voiceAssignments?.Narrator;u.voice=this.voices().find(v=>v.voiceURI===choice)||null;u.onend=next;u.onerror=e=>{if(epoch===this.epoch){this.error=e.error || 'Playback failed';this.emit('error');}};this.emit('speaking');this.synthesis.speak(u);};next();
  }
  pause(){if(this.state==='speaking'){this.synthesis.pause();this.emit('paused');}}
  resume(){if(this.state==='paused'){this.synthesis.resume();this.emit('speaking');}}
  stop(){this.epoch++;this.synthesis?.cancel();this.emit('idle');}
  replay(){requireThat(this.last,'Read a message first.');this.read(this.last.text,this.last.settings);}
}
export const voice=new NarrationVoice();
