import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../app/core/session.mjs';
import {createAdventure} from '../app/core/engine.mjs';
import {compile} from '../app/core/schema.mjs';
import {MemoryRepository} from './support/memory-repository.mjs';
import {starterStory,starterCharacters} from '../content/seed.mjs';
import {NarrationVoice} from '../app/voice.mjs';
test('Auto waits for configured playback and remains stoppable while waiting',async()=>{
 const story=structuredClone(starterStory);story.nodes[0].choices=[];story.nodes[0].next=undefined;
 const compiled=compile(story),repo=new MemoryRepository(),save=createAdventure(compiled,starterCharacters,{name:'Test',rating:'sfw'});save.definitionKey=await repo.freeze(story);await repo.commitSave(save);
 let finish,waited=false;const session=new Session({save,compiled,repository:repo,provider:{id:'fixture',generate:async()=>({text:'The world continues.'})},onAutoWait:()=>new Promise(resolve=>{waited=true;finish=resolve;})});
 const running=session.runAuto({limit:3,delayMs:0});while(!waited)await new Promise(r=>setTimeout(r,1));assert.equal(session.save.events.length,2);await new Promise(r=>setTimeout(r,10));assert.equal(session.save.events.length,2);session.stop();finish();await running;assert.equal(session.save.events.length,2);assert.equal(session.auto,false);
});
test('playback completion promise resolves after Stop, not from an obsolete end callback',async()=>{
 const utterances=[],speech={speak:u=>utterances.push(u),cancel(){},getVoices:()=>[]};class U{constructor(text){this.text=text;}}
 const v=new NarrationVoice(speech,U);v.read('The fire glows.');let done=false;const pending=v.finished().then(()=>done=true);await Promise.resolve();assert.equal(done,false);v.stop();await pending;assert.equal(done,true);utterances[0].onend();assert.equal(v.state,'idle');
});
