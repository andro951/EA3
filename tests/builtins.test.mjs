import test from 'node:test';
import assert from 'node:assert/strict';
import {installBuiltins} from '../app/storage/builtins.mjs';
import {MemoryRepository} from './support/memory-repository.mjs';
import {starterCharacters,starterStory} from '../content/seed.mjs';
const pack={key:'original-launch-v1',items:[...starterCharacters,starterStory]};

test('bundled collection installs definitions and search indexes in one transaction',async()=>{
 const repo=new MemoryRepository(),before=(await repo.snapshot()).revision;
 const result=await installBuiltins(repo,pack);
 assert.equal(result.installed,4);assert.equal((await repo.listContent()).length,4);
 assert.equal((await repo.snapshot()).revision,before+1);
});
test('reopening does not overwrite edited content or restore intentionally deleted builtins',async()=>{
 const repo=new MemoryRepository();await installBuiltins(repo,pack);
 const rhea=await repo.getContent('character','rhea');await repo.putContent({...rhea,name:'My own Rhea'},{expectedRevision:rhea.contentRevision});
 await repo.removeContent('character','calder');
 const before=await repo.snapshot();assert.equal((await installBuiltins(repo,pack)).alreadyInstalled,true);
 assert.deepEqual(await repo.snapshot(),before);
});
test('upgrading a collection preserves existing definitions and adds only missing IDs',async()=>{
 const repo=new MemoryRepository();const original=await repo.putContent({...starterCharacters[0],name:'Existing character'});
 const r=await installBuiltins(repo,pack);assert.equal(r.installed,3);
 assert.equal((await repo.getContent('character','rhea')).contentRevision,original.contentRevision);
 assert.equal((await repo.getContent('character','rhea')).name,'Existing character');
});
test('failed seeding leaves no partial library or misleading installation marker',async()=>{
 const repo=new MemoryRepository(),before=await repo.snapshot();repo.failNext=Error('Storage full');
 await assert.rejects(installBuiltins(repo,pack),/Storage full/);assert.deepEqual(await repo.snapshot(),before);
});
test('concurrent tabs converge on one collection installation',async()=>{
 const repo=new MemoryRepository();const result=await Promise.all([installBuiltins(repo,pack),installBuiltins(repo,pack)]);
 assert.equal(result.reduce((n,r)=>n+r.installed,0),4);assert.equal((await repo.listContent()).length,4);
});
test('invalid or duplicated definitions are rejected before any write',async()=>{
 const repo=new MemoryRepository(),before=await repo.snapshot();
 await assert.rejects(installBuiltins(repo,{...pack,items:[starterStory,starterStory]}),/Duplicate/);
 await assert.rejects(installBuiltins(repo,{...pack,items:[{...starterStory,start:'missing'}]}),/opening/);
 assert.deepEqual(await repo.snapshot(),before);
});

test('launch installer adds seven stories and sixteen characters on a new installation',async()=>{
 const {installLaunchContent}=await import('../app/storage/launch.mjs');const repo=new MemoryRepository();
 await installLaunchContent(repo);assert.equal((await repo.listContent('story')).length,7);assert.equal((await repo.listContent('character')).length,16);
});
test('launch upgrade respects the original seed marker when earlier examples were deleted',async()=>{
 const {installLaunchContent}=await import('../app/storage/launch.mjs');const repo=new MemoryRepository();await repo.put('meta','seedVersion',1);
 await installLaunchContent(repo);assert.equal(await repo.getContent('character','rhea'),undefined);assert.equal((await repo.listContent('story')).length,6);
});
