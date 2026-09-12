import test from 'node:test';import assert from 'node:assert/strict';
import {newContent,DraftModel} from '../app/authoring/model.mjs';
import {saveDraftSnapshot} from '../app/authoring/save.mjs';
import {MemoryRepository} from './support/memory-repository.mjs';
import {removeUnusedAsset} from '../app/media/raster.mjs';

test('editing during a library write leaves the newer draft dirty',async()=>{
 const repo=new MemoryRepository(),model=new DraftModel(newContent('character')),write=repo.putContent.bind(repo);let entered,release;
 const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
 repo.putContent=async(...args)=>{entered();await hold;return write(...args);};
 const save=saveDraftSnapshot(model,repo);await started;model.set(['name'],'The newer draft');release();const result=await save;
 assert.equal(result.unchanged,false);assert.equal(model.dirty,true);assert.equal(model.value.name,'The newer draft');assert.equal(result.stored.name,'New character');
 const next=await saveDraftSnapshot(model,repo,result.stored.contentRevision);assert.equal(next.unchanged,true);assert.equal(model.dirty,false);assert.equal(next.stored.name,'The newer draft');
});
test('a conflicting save leaves the unsaved draft and revision untouched',async()=>{
 const repo=new MemoryRepository(),model=new DraftModel(newContent('character'));const first=await repo.putContent(model.value);
 model.set(['name'],'My draft');await assert.rejects(saveDraftSnapshot(model,repo,'stale'),/Another tab/);assert.equal(model.value.name,'My draft');assert.equal(model.dirty,true);assert.equal((await repo.getContent('character',first.id)).name,'New character');
});
test('owned artwork used by an unfinished editor draft is protected',async()=>{
 const repo=new MemoryRepository(),asset=await repo.putAsset({data:'data:image/png;base64,AA=='});await repo.put('drafts','editor:character:new',{value:{image:'asset:'+asset.id}});
 await assert.rejects(removeUnusedAsset(repo,asset.id),/still used/);await repo.remove('drafts','editor:character:new');await removeUnusedAsset(repo,asset.id);assert.equal(await repo.get('assets',asset.id),undefined);
});
