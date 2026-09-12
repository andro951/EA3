import {clone,id,now,hash,canonical,requireThat,isRecord} from './core/util.mjs';
import {validateContent} from './core/schema.mjs';
import {metadata} from './storage/base.mjs';

/** A same-origin client. Credentials never enter portable content or archives. */
export class CommunityClient {
  constructor({transport=(...args)=>globalThis.fetch(...args),instance=globalThis.location?.origin || 'local'}={}){this.transport=transport;this.instance=instance;this.user=null;}
  async request(path,{method='GET',body,signal}={}){
    requireThat(path.startsWith('/api/'),'Community requests must use this instance.');
    const response=await this.transport(path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error || 'Community request failed.'),{status:response.status,code:data.code});
    return data;
  }
  async session(){const data=await this.request('/api/session');this.user=data.user;return data;}
  async signIn(username,password,register=false){const data=await this.request(register?'/api/register':'/api/login',{method:'POST',body:{username,password}});this.user=data.user;return data;}
  async signOut(){await this.request('/api/logout',{method:'POST',body:{}});this.user=null;}
  async publish(repo,content,{hidePrevious=false}={}){
    const payload=await preparePublication(repo,content,{hidePrevious,itemId:content.public?.instance===this.instance&&content.public.ownerId===this.user?.id?content.public.itemId:null});
    const key='publication:'+payload.operationId;
    await repo.put('jobs',key,{id:key,kind:'publication',state:'submitted',instance:this.instance,payload,baseRevision:content.contentRevision,createdAt:now()});
    let result;
    try{result=await this.request('/api/publish',{method:'POST',body:payload});}
    catch(error){
      try{result=await this.request('/api/operations/'+payload.operationId);}
      catch{await repo.put('jobs',key,{id:key,kind:'publication',state:'failed-or-unknown',instance:this.instance,payload,baseRevision:content.contentRevision,error:error.message,createdAt:now()});throw error;}
    }
    return this.finishPublication(repo,key,payload,result,content.contentRevision);
  }
  async reconcile(repo,job){
    requireThat(job.instance===this.instance,'This receipt belongs to a different community instance.');
    const result=await this.request('/api/operations/'+job.payload.operationId);
    return this.finishPublication(repo,job.id,job.payload,result,job.baseRevision);
  }
  async finishPublication(repo,key,payload,result,baseRevision){
    const receipt={...result,instance:this.instance};
    await repo.put('jobs',key,{id:key,kind:'publication',state:'committed',instance:this.instance,receipt,payload,baseRevision,createdAt:now()});
    const local=await repo.getContent(payload.content.kind,payload.content.id);
    if(local&&local.contentRevision===baseRevision){
      try{await repo.putContent({...local,public:receipt},{expectedRevision:baseRevision});await repo.remove('jobs',key);return {...receipt,localLinked:true};}
      catch(error){return {...receipt,localLinked:false,warning:'Published successfully. The local item changed before its public reference could be saved. The receipt is retained.'};}
    }
    return {...receipt,localLinked:false,warning:'Published successfully. A newer local draft was preserved; this publication receipt remains in Workbench.'};
  }
}
const imageFields=new Set(['image','thumbnail','originalImage']);
async function transformImages(value,convert){
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)await transformImages(value[i],convert);return;}
  if(!isRecord(value))return;
  for(const [k,v]of Object.entries(value))if(imageFields.has(k)&&typeof v==='string'&&v)value[k]=await convert(v);else if(v&&typeof v==='object')await transformImages(v,convert);
}
export async function preparePublication(repo,content,{operationId=id('publish'),itemId=null,hidePrevious=false}={}){
  requireThat(!validateContent(content).length,'Repair content validation errors before publishing.');
  const primary=clone(content),dependencies=[];
  if(primary.kind==='story')for(const key of new Set([...(primary.cast||[]),...(primary.backgroundCast||[])])){
    const c=await repo.getContent('character',key);requireThat(c,'Missing character dependency: '+key);dependencies.push(clone(c));
  }
  const assets=new Map();
  for(const c of [primary,...dependencies]){
    delete c.public;delete c.publicDependency;delete c.contentRevision;delete c.updatedAt;delete c.migration;
    await transformImages(c,async source=>{
      if(source.startsWith('asset:')||/^image-[a-f0-9]{64}$/.test(source)){
        const a=await repo.get('assets',source.replace(/^asset:/,''));requireThat(a,'A referenced image is missing.');assets.set(a.id,{id:a.id,data:a.data,hash:a.hash,width:a.width,height:a.height});return a.data;
      }
      requireThat(/^data:image\/(png|jpeg|webp);base64,/.test(source)||/^\/public\/art\/[a-z0-9_-]+\.(svg|png|webp|jpg)$/.test(source),'Upload remote or unsupported images before publishing.');return source;
    });
    c.assets=[];
  }
  return {operationId,itemId,hidePrevious,content:primary,characters:dependencies,assets:[...assets.values()]};
}
function remapStory(story,map){
  const actor=key=>map[key]||key;
  for(const f of ['cast','backgroundCast'])if(story[f])story[f]=story[f].map(actor);
  const effects=rows=>{for(const e of rows||[])if(['relationship','memory','presence','recruit','outfit','unlockOutfit','equip'].includes(e.type))e.key=actor(e.key);};
  const conditions=rows=>{for(const c of rows||[]){if(['relationship','member'].includes(c.type))c.key=actor(c.key);if(c.conditions)conditions(c.conditions);}};
  for(const node of story.nodes||[]){if(node.cast)node.cast=node.cast.map(actor);conditions(node.requires);effects(node.effects);for(const choice of node.choices||[]){conditions(choice.requires);effects(choice.effects);}}
  for(const loc of story.locations||[]){if(loc.cast)loc.cast=loc.cast.map(actor);conditions(loc.requires);}
  for(const offer of story.offers||[]){if(offer.actor)offer.actor=actor(offer.actor);conditions(offer.requires);effects(offer.effects);}
  for(const event of story.developments||[]){conditions(event.requires);effects(event.effects);}
  for(const group of Object.values(story.effectGroups||{}))effects(group);
  if(story.initial?.relationships)story.initial.relationships=Object.fromEntries(Object.entries(story.initial.relationships).map(([k,v])=>[actor(k),v]));
}
/** Download creates independent local copies and inserts their entire dependency closure atomically. */
export async function importPublication(repo,bundle,{instance='local'}={}){
  requireThat(isRecord(bundle?.content)&&isRecord(bundle?.summary),'Invalid publication package.');
  const summary=bundle.summary;
  requireThat(typeof summary.versionId==='string'&&typeof summary.itemId==='string','Publication identity is missing.');
  const receipt='publication-import:'+await hash(instance+'|'+summary.versionId);
  if(await repo.get('meta',receipt))return {duplicate:true};
  const main=clone(bundle.content),chars=clone(bundle.characters||[]);
  requireThat(Array.isArray(chars)&&chars.every(c=>c.kind==='character'),'Invalid cast dependencies.');
  const all=main.kind==='character'?[main]:[...chars,main];
  for(const c of all)requireThat(!validateContent(c).length,'The downloaded definition is invalid: '+(c.title||c.name));
  if(main.kind==='story')for(const k of [...(main.cast||[]),...(main.backgroundCast||[])])requireThat(chars.some(c=>c.id===k),'A downloaded cast dependency is missing.');
  requireThat(main.rating!=='sfw'||chars.every(c=>c.rating==='sfw'),'An SFW story contains a mature dependency.');
  const snapshot=await repo.snapshot(['library','assets','meta']),existing=new Map(snapshot.tables.library.map(r=>[r.key,r.value])),priorAssets=new Map(snapshot.tables.assets.map(r=>[r.key,r.value]));
  const map={},used=new Set(),ops=[],assets=new Map();
  for(const c of all){requireThat(!used.has(c.kind+':'+c.id),'Duplicate downloaded content ID.');used.add(c.kind+':'+c.id);const original=c.id;if(existing.has(c.kind+':'+original))c.id=id(c.kind);if(c.kind==='character')map[original]=c.id;}
  if(main.kind==='story')remapStory(main,map);
  for(const c of all){
    delete c.assets;delete c.contentRevision;c.contentRevision=id('revision');c.updatedAt=now();
    const link='library:'+c.kind+':'+c.id;
    await transformImages(c,async source=>{
      if(/^data:image\/(png|jpeg|webp);base64,/.test(source)){
        const digest=await hash(source),key='image-'+digest,prior=assets.get(key)||priorAssets.get(key);
        assets.set(key,{...prior,id:key,hash:digest,data:source,createdAt:prior?.createdAt||now(),links:{...prior?.links,[link]:true}});return 'asset:'+key;
      }
      requireThat(/^\/public\/art\/[a-z0-9_-]+\.(svg|png|webp|jpg)$/.test(source),'Downloaded content contains an unsafe or missing image reference.');return source;
    });
    if(c===main)c.public={itemId:summary.itemId,versionId:summary.versionId,number:summary.number,uploader:summary.uploader,ownerId:summary.ownerId,instance};
    else{delete c.public;c.publicDependency={versionId:summary.versionId,instance};}
    ops.push({store:'library',key:c.kind+':'+c.id,value:c},{store:'index',key:c.kind+':'+c.id,value:metadata(c)});
  }
  for(const[key,value]of assets)ops.push({store:'assets',key,value});
  ops.push({store:'meta',key:receipt,value:{at:now(),localId:main.id}});
  await repo.atomic(ops,{expectedStorageRevision:snapshot.revision});
  return {duplicate:false,localId:main.id,kind:main.kind,characters:chars.length};
}
