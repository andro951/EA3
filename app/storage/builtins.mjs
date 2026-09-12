import {clone,id,now,requireThat} from '../core/util.mjs';
import {validateContent} from '../core/schema.mjs';
import {metadata} from './base.mjs';

/** Add a bundled collection once, without overwriting user edits or resurrecting deletions. */
export async function installBuiltins(repo,{key,items}) {
  requireThat(typeof key==='string' && /^[a-z0-9-]+$/.test(key),'Invalid collection key.');
  requireThat(Array.isArray(items),'A collection must contain a list of definitions.');
  const seen=new Set();
  for(const item of items){
    const errors=validateContent(item),identity=item.kind+':'+item.id;
    requireThat(!errors.length,errors.join('\n'),'CONTENT_INVALID');
    requireThat(!seen.has(identity),'Duplicate bundled identity: '+identity);seen.add(identity);
  }
  const marker='builtin-collection:'+key;
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=await repo.snapshot(['meta','library']);
    if(snapshot.tables.meta.some(r=>r.key===marker))return {installed:0,alreadyInstalled:true};
    const existing=new Set(snapshot.tables.library.map(r=>r.key)),operations=[];
    let installed=0;
    for(const item of items){
      const identity=item.kind+':'+item.id;if(existing.has(identity))continue;
      const value={...clone(item),contentRevision:id('revision'),updatedAt:now()};
      operations.push({store:'library',key:identity,value},{store:'index',key:identity,value:metadata(value)});installed++;
    }
    operations.push({store:'meta',key:marker,value:{installedAt:now(),count:installed}});
    try{await repo.atomic(operations,{expectedStorageRevision:snapshot.revision});return {installed,alreadyInstalled:false};}
    catch(error){if(error.code!=='CONFLICT'||attempt===3)throw error;}
  }
}
