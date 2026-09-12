import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionCharacters,collectionStories} from '../content/collection.mjs';
import {starterCharacters,starterStory} from '../content/seed.mjs';
import {playthroughs} from '../content/playthroughs.mjs';
import {compile,validateContent} from '../app/core/schema.mjs';
import {createAdventure,planAction,commitAction,rewind} from '../app/core/engine.mjs';
import {availableOffers} from '../app/core/runtime.mjs';
import {MemoryRepository} from './support/memory-repository.mjs';
const stories=[starterStory,...collectionStories],characters=[...starterCharacters,...collectionCharacters];
const run=(c,s,a)=>{const plan=planAction(c,s,a);return commitAction(s,plan,{text:plan.semantic?.scene.authored || 'Synthetic local action response.',provider:'test-fixture',simulated:true});};
test('all launch content validates and has a complete adult cast',()=>{
 const seen=new Set();for(const item of [...stories,...characters]){assert.deepEqual(validateContent(item),[],item.id);assert.ok(!seen.has(item.kind+item.id));seen.add(item.kind+item.id);}
 for(const s of stories){const c=compile(s);const save=createAdventure(c,characters,{name:'Launch tester',rating:'sfw'});assert.equal(save.state.location,c.nodes.get(s.start).location || s.locations[0].id);}
});
for(const route of playthroughs)test('launch ending: '+route.storyId+' / '+route.ending,async()=>{
 const story=stories.find(s=>s.id===route.storyId),c=compile(story),repo=new MemoryRepository();
 let save=createAdventure(c,characters,{name:'Launch tester',rating:'sfw'});const initial=structuredClone(save);save.definitionKey=await repo.freeze(story);await repo.commitSave(save);
 for(const action of route.actions){const prior=save;save=run(c,save,action);await repo.commitSave(save,prior.revision,{from:prior.events.length});}
 assert.equal(save.state.node,route.ending);assert.equal(save.state.ending,c.nodes.get(route.ending).ending);
 for(const value of Object.values(save.state.resources))assert.ok(value>=0);
 const archive=await repo.exportArchive({saveId:save.id}),other=new MemoryRepository();await other.importArchive(archive);
 const restored=await other.readSave(save.id);assert.deepEqual(restored.state,save.state);assert.deepEqual(restored.events,save.events);
 assert.deepEqual(rewind(save,1).state,initial.state,'rewind removes all later rewards, expenses and introductions');
});
test('acceptance routes cover every authored launch ending',()=>{
 const expected=stories.flatMap(s=>s.nodes.filter(n=>n.ending).map(n=>s.id+':'+n.id)).sort();
 assert.deepEqual(playthroughs.map(r=>r.storyId+':'+r.ending).sort(),expected);
});
test('Copper & Clover consumes the stated shift duration and rejects unaffordable work',()=>{
 const c=compile(stories.find(s=>s.id==='copper-clover'));let save=createAdventure(c,characters,{name:'Tester',rating:'sfw'});
 save=run(c,save,{kind:'travel',location:'market'});const before=save.state.clock;
 save=run(c,save,{kind:'offer',offerId:'potting'});assert.equal(save.state.clock-before,2);assert.equal(save.state.resources.coins,32);
 assert.ok(!availableOffers(c,save.state).find(o=>o.id==='grow').available);
 save=run(c,save,{kind:'travel',location:'workshop'});
 assert.throws(()=>planAction(c,save,{kind:'recruit',characterId:'jun'}),/cannot join/,'paid collaborator cannot be recruited for free');
});
test('future cast is absent initially and introduced by the correct story effect',()=>{
 const c=compile(stories.find(s=>s.id==='ninth-bell'));let save=createAdventure(c,characters,{name:'Tester',rating:'sfw'});
 assert.ok(!save.state.present.includes('ada'));for(const a of playthroughs.find(r=>r.storyId==='ninth-bell'&&r.ending==='record').actions)save=run(c,save,a);
 assert.ok(save.state.present.includes('ada'));
});
