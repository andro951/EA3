import {clone,hash,canonical,requireThat,id,now,safeJSON,isRecord} from '../core/util.mjs';
import {validateContent,validateStory} from '../core/schema.mjs';
import {validateSave} from '../core/runtime.mjs';
import {applyDifference} from '../core/history.mjs';
export const DATABASE='emberadventures3';
export const TABLES=['meta','library','index','definitions','saves','events','assets','drafts','jobs','quarantine','handles'];
export const PORTABLE=TABLES.filter(t=>!['jobs','handles','index'].includes(t));
export const eventKey=(saveId,index)=>`${saveId}|${String(index).padStart(16,'0')}`;
export const metadata=c=>({id:c.id,kind:c.kind,title:c.title || c.name,description:c.description || '',genre:c.genre || '',creator:c.creator || '',rating:c.rating,tags:c.tags || [],image:c.image || '',updatedAt:c.updatedAt || ''});
const put=(store,key,value)=>({store,key,value});
const remapAssets=(value,ownerMap)=>{
  for(const asset of value)if(asset.value.links) {
    const links={};for(const [owner,link] of Object.entries(asset.value.links))links[ownerMap[owner] || owner]=link;asset.value.links=links;
  }
};
function remapCast(story,map) {
  for(const f of ['cast','backgroundCast'])if(story[f])story[f]=story[f].map(k=>map[k] || k);
  if(story.initial?.relationships)story.initial.relationships=Object.fromEntries(Object.entries(story.initial.relationships).map(([k,v])=>[map[k] || k,v]));
  for(const row of [...(story.nodes || []),...(story.locations || [])])if(row.cast)row.cast=row.cast.map(k=>map[k] || k);
  const effects=rows=>{for(const e of rows || [])if(['relationship','memory','presence','recruit','outfit','unlockOutfit','equip'].includes(e.type))e.key=map[e.key] || e.key;};
  const conditions=rows=>{for(const c of rows || []){if(['relationship','member'].includes(c.type))c.key=map[c.key] || c.key;if(c.conditions)conditions(c.conditions);}};
  for(const n of story.nodes || []){effects(n.effects);conditions(n.requires);for(const c of n.choices || []){effects(c.effects);conditions(c.requires);}}
  for(const o of story.offers || []){o.actor=map[o.actor] || o.actor;effects(o.effects);conditions(o.requires);}
  for(const d of story.developments || []){effects(d.effects);conditions(d.requires);}
  for(const e of Object.values(story.effectGroups || {}))effects(e);
}
export class RepositoryBase {
  async getContent(kind,key) {return this.get('library',`${kind}:${key}`);}
  async putContent(content,{expectedRevision=null}={}) {
    const errors=validateContent(content);requireThat(errors.length===0,errors.join('\n'),'CONTENT_INVALID');
    const key=`${content.kind}:${content.id}`,value={...clone(content),contentRevision:id('revision'),updatedAt:now()};
    await this.atomic([put('library',key,value),put('index',key,metadata(value))],{checks:[{store:'library',key,field:'contentRevision',expected:expectedRevision}]});
    return value;
  }
  async listContent(kind) {return (await this.all('index')).filter(c=>!kind || c.kind===kind);}
  async removeContent(kind,key) {
    const full=`${kind}:${key}`;
    await this.atomic([{store:'library',key:full,delete:true},{store:'index',key:full,delete:true}]);
  }
  async freeze(story) {
    const errors=validateStory(story);requireThat(!errors.length,errors.join('\n'));
    const key=await hash(canonical(story));if(!await this.get('definitions',key))await this.put('definitions',key,story);return key;
  }
  async commitSave(save,expectedRevision=null,{from=0,guard=()=>true,jobId}={}) {
    const errors=validateSave(save);requireThat(!errors.length,errors.join('\n'));
    requireThat(Number.isInteger(from) && from>=0 && from<=save.events.length,'Invalid history write range.');
    const {events,...rest}=save,head=clone(rest);head.eventCount=events.length;
    const operations=[{store:'events',range:{lower:eventKey(save.id,from),upper:`${save.id}|\uffff`},delete:true},...events.slice(from).map((value,i)=>put('events',eventKey(save.id,from+i),clone(value))),put('saves',save.id,head)];
    if(jobId)operations.push({store:'jobs',key:jobId,delete:true});
    await this.atomic(operations,{checks:[{store:'saves',key:save.id,field:'revision',expected:expectedRevision}],guard});
    return save;
  }
  async listSaves() {
    return (await this.all('saves')).map(s=>({id:s.id,title:s.title,storyId:s.storyId,updatedAt:s.updatedAt,createdAt:s.createdAt,revision:s.revision,eventCount:s.eventCount,profile:s.profile,ending:s.state?.ending})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  async removeSave(saveId) {
    await this.atomic([{store:'saves',key:saveId,delete:true},{store:'events',range:{lower:eventKey(saveId,0),upper:`${saveId}|\uffff`},delete:true}]);
  }
  async copySave(save,title) {
    const copy={...clone(save),id:id('adventure'),title:title || `${save.title} · saved copy`,createdAt:now(),updatedAt:now(),revision:1};
    const owned=(await this.all('assets')).filter(a=>a.links?.['save:'+save.id]).map(a=>a.id);
    copy.assets=[...new Set([...(copy.assets || []),...owned])];
    await this.commitSave(copy,null);return copy;
  }
  async putAsset(asset) {
    requireThat(typeof asset.data==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(asset.data),'Use a PNG, JPEG, or WebP image.');
    const digest=await hash(asset.data),key=`image-${digest}`;
    const prior=await this.get('assets',key);
    const value={...clone(asset),...clone(prior || {}),id:key,hash:digest,createdAt:prior?.createdAt || now(),links:{...prior?.links,...asset.links}};
    await this.put('assets',key,value);return value;
  }
  async exportArchive({saveId=null}={}) {
    const snapshot=await this.snapshot(PORTABLE),tables=snapshot.tables;
    tables.meta=(tables.meta || []).filter(r=>['settings','profiles','activeProfile'].includes(r.key));
    // In-progress handoff chunks are local transport caches, not recursively portable user drafts.
    tables.drafts=(tables.drafts || []).filter(r=>!r.key.startsWith('transfer:'));
    if(saveId) {
      const head=tables.saves.find(r=>r.key===saveId);requireThat(head,'Adventure not found.');
      tables.saves=[head];tables.events=tables.events.filter(r=>r.key.startsWith(saveId+'|'));
      tables.definitions=tables.definitions.filter(r=>r.key===head.value.definitionKey);
      const wanted=new Set(head.value.assets || []),pending=[head.value,...tables.definitions.map(r=>r.value),...tables.events.map(r=>r.value)];
      while(pending.length){const v=pending.pop();if(typeof v==='string'){if(v.startsWith('asset:image-'))wanted.add(v.slice(6));else if(/^image-[a-f0-9]{64}$/.test(v))wanted.add(v);}else if(v&&typeof v==='object')pending.push(...Object.values(v));}
      tables.assets=tables.assets.filter(r=>wanted.has(r.key)||r.value.links?.['save:'+saveId]);tables.library=[];tables.drafts=[];tables.quarantine=[];tables.meta=[];
    }
    const payload={schema:'ea3/archive/1',id:id('archive'),createdAt:now(),tables};
    return {schema:'ea3/envelope/1',hash:await hash(canonical(payload)),payload};
  }
  async inspectArchive(input) {
    const envelope=typeof input==='string'?safeJSON(input):clone(input);
    requireThat(envelope?.schema==='ea3/envelope/1' && envelope.payload?.schema==='ea3/archive/1','This is not an EA3 complete archive.');
    requireThat(await hash(canonical(envelope.payload))===envelope.hash,'Archive integrity failed. Nothing was imported.','CORRUPT');
    const tables=envelope.payload.tables;requireThat(isRecord(tables),'Archive tables are missing.');
    for(const [table,rows] of Object.entries(tables)) {
      requireThat(PORTABLE.includes(table) && Array.isArray(rows),`Invalid archive table ${table}.`);
      const keys=new Set();
      for(const r of rows) {requireThat(typeof r?.key==='string' && r.value!==undefined && !keys.has(r.key),`Invalid or duplicate ${table} record.`);keys.add(r.key);}
    }
    for(const row of tables.library || []){requireThat(!validateContent(row.value).length,`Invalid library item ${row.key}.`);requireThat(row.key===`${row.value.kind}:${row.value.id}`,'Library identity mismatch.');}
    for(const row of tables.definitions || []){requireThat(!validateStory(row.value).length,'Invalid frozen story definition.');requireThat(await hash(canonical(row.value))===row.key,'Frozen story hash does not match.');}
    for(const row of tables.assets || []){requireThat(row.key===row.value.id && row.key===`image-${await hash(row.value.data)}` && row.value.hash===row.key.slice(6),'An image is corrupted.');requireThat(/^data:image\/(png|jpeg|webp);base64,/.test(row.value.data),'Unsupported image payload.');}
    const definitions=new Set((tables.definitions || []).map(r=>r.key)),assets=new Set((tables.assets || []).map(r=>r.key));
    // Verify every owned reference, including portraits that are used only in earlier history.
    const references=[...(tables.library || []),...(tables.definitions || []),...(tables.saves || []),...(tables.events || [])].map(r=>r.value);
    while(references.length){const value=references.pop();if(typeof value==='string'){const key=value.replace(/^asset:/,'');if(/^image-[a-f0-9]{64}$/.test(key))requireThat(assets.has(key),`Missing referenced image ${key}.`);}else if(value&&typeof value==='object')for(const child of Object.values(value))references.push(child);}
    for(const head of tables.saves || []) {
      requireThat(head.key===head.value.id,'Adventure identity mismatch.');
      const rows=(tables.events || []).filter(r=>r.key.startsWith(head.key+'|')).sort((a,b)=>a.key.localeCompare(b.key));
      requireThat(rows.length===head.value.eventCount && rows.every((r,i)=>r.key===eventKey(head.key,i)),'Adventure history is incomplete.');
      const save={...head.value,events:rows.map(r=>r.value)};
      requireThat(!validateSave(save).length,'Invalid saved adventure.');
      let state=clone(save.initial);for(const e of save.events)state=applyDifference(state,e.changes);
      requireThat(canonical(state)===canonical(save.state),'Saved state does not match its history.');
      requireThat(definitions.has(save.definitionKey),'The adventure’s frozen story definition is missing.');
      for(const key of [...(save.assets || []),...Object.values(save.state.images || {})])requireThat(assets.has(key),`Missing image ${key}.`);
    }
    return envelope;
  }
  async importArchive(input) {
    const envelope=await this.inspectArchive(input);
    if(await this.get('meta',`import:${envelope.hash}`))return {duplicate:true,copies:0,imported:0};
    const current=await this.snapshot(TABLES.filter(t=>t!=='handles'));
    const tables=clone(envelope.payload.tables),existing={};for(const [t,rows] of Object.entries(current.tables))existing[t]=new Map(rows.map(r=>[r.key,r.value]));
    const ownerMap={},castMap={};let copies=0;
    for(const row of tables.saves || []) {
      const prior=existing.saves.get(row.key);if(!prior)continue;
      const oldEvents=(current.tables.events || []).filter(r=>r.key.startsWith(row.key+'|'));
      const newEvents=(tables.events || []).filter(r=>r.key.startsWith(row.key+'|'));
      if(canonical(prior)===canonical(row.value) && canonical(oldEvents)===canonical(newEvents))continue;
      const old=row.key,key=id('adventure');row.key=key;row.value.id=key;row.value.title+=' · imported copy';row.value.revision=1;copies++;
      ownerMap['save:'+old]='save:'+key;
      for(const e of tables.events || [])if(e.key.startsWith(old+'|'))e.key=key+e.key.slice(old.length);
    }
    for(const row of tables.library || []) {
      const prior=existing.library.get(row.key);if(!prior || canonical(prior)===canonical(row.value))continue;
      const old=row.key,oldId=row.value.id;row.value.id=id(row.value.kind);row.value.contentRevision=id('revision');row.key=`${row.value.kind}:${row.value.id}`;copies++;
      ownerMap['library:'+old]='library:'+row.key;if(row.value.kind==='character')castMap[oldId]=row.value.id;
    }
    for(const row of tables.library || [])if(row.value.kind==='story') {
      remapCast(row.value,castMap);
      const prior=existing.library.get(row.key);
      if(prior && canonical(prior)!==canonical(row.value)) {
        const old=row.key;row.value.id=id('story');row.value.contentRevision=id('revision');row.key='story:'+row.value.id;
        ownerMap['library:'+old]='library:'+row.key;copies++;
      }
    }
    remapAssets(tables.assets || [],ownerMap);
    for(const row of tables.assets || []){const prior=existing.assets.get(row.key);if(prior)row.value.links={...prior.links,...row.value.links};}
    const operations=[];
    for(const [table,rows] of Object.entries(tables))for(const row of rows) {
      if(table==='meta' && existing.meta.has(row.key))continue;
      operations.push(put(table,row.key,row.value));
      if(table==='library')operations.push(put('index',row.key,metadata(row.value)));
    }
    operations.push(put('meta',`import:${envelope.hash}`,{at:now()}));
    await this.atomic(operations,{expectedStorageRevision:current.revision});
    return {duplicate:false,copies,imported:(tables.saves?.length || 0)+(tables.library?.length || 0)};
  }
}
