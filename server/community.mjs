import {randomUUID,createHash} from 'node:crypto';
import {validateContent} from '../app/core/schema.mjs';
import {canonical} from '../app/core/util.mjs';
import {readBody,json,fail} from './http-utils.mjs';
import {actorFor,requireActor,requireModerator} from './auth.mjs';
import {transaction,audit,userSummary} from './db.mjs';
import {inspectRaster} from './image-validation.mjs';
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const parse=JSON.parse;
const clipped=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const reasons=['classification','unsafe','ownership','spam','broken','other'];
function safeImages(content){
  const stack=[content];while(stack.length){const value=stack.pop();if(!value||typeof value!=='object')continue;for(const[k,v]of Object.entries(value)){
    if(['image','thumbnail'].includes(k)&&v){if(typeof v!=='string')fail(422,'Image references must be strings.');if(v.startsWith('data:'))inspectRaster(v);else if(!/^\/public\/art\/[a-z0-9_-]+\.(svg|png|webp|jpg)$/.test(v))fail(422,'Images must be owned PNG/JPEG/WebP data URLs or included original artwork. Remote tracking URLs and uploaded SVG are not accepted.');}
    if(v&&typeof v==='object')stack.push(v);
  }}
}
function fullVersion(db,id){return db.prepare('SELECT v.*,i.owner_id,i.kind,i.locked,i.featured,u.username AS uploader FROM versions v JOIN items i ON i.id=v.item_id JOIN users u ON u.id=i.owner_id WHERE v.id=?').get(id);}
function visible(version,actor){return version&&(version.status==='public'||actor&&(actor.id===version.owner_id||['admin','moderator'].includes(actor.role)));}
function summary(v){return {itemId:v.item_id,versionId:v.id,number:v.number,title:v.name,description:v.description,genre:v.genre,tags:parse(v.tags),rating:v.rating,status:v.status,kind:v.kind,creator:v.creator,thumbnail:v.thumbnail||'',uploader:v.uploader,ownerId:v.owner_id,locked:!!v.locked,featured:!!v.featured,createdAt:v.created_at,score:v.score??null,ratings:v.ratings||0};}
function downloadVersion(db,v){
  const content=parse(v.payload);content.rating=v.rating;content.public={itemId:v.item_id,versionId:v.id,number:v.number,uploader:v.uploader,ownerId:v.owner_id};
  const assets=db.prepare('SELECT a.* FROM assets a JOIN version_assets va ON va.asset_id=a.id WHERE va.version_id=?').all(v.id).map(a=>({...parse(a.metadata),id:a.id,data:a.data,mime:a.mime,hash:a.hash,owners:[]}));
  return {summary:summary(v),content,characters:parse(v.dependencies),assets,integrity:{algorithm:'SHA-256',originalPayloadHash:v.hash,publicMetadataAdded:true}};
}
function operationId(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(value))fail(422,'Use a unique operation ID of 8–100 safe characters.');return value;}
function reportDetail(db,id){
  const report=db.prepare('SELECT r.*,u.username AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id WHERE r.id=?').get(id);if(!report)fail(404,'Report not found.');
  const version=fullVersion(db,report.version_id),history=db.prepare('SELECT a.*,u.username AS actor FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.report_id=? ORDER BY a.at,a.id').all(id);
  return {report,version:downloadVersion(db,version),uploader:userSummary(db.prepare('SELECT * FROM users WHERE id=?').get(version.owner_id)),history,reportedContent:parse(version.payload),snapshotMatches:report.snapshot_hash===version.hash};
}
export async function handleCommunity(ctx,req,res,url){
  const {db,clock,limiter,config}=ctx,path=url.pathname,actor=actorFor(db,req,clock);
  if(path==='/api/public/items'&&req.method==='GET'){
    const query=url.searchParams,q=clipped(query.get('q')).toLowerCase(),genre=clipped(query.get('genre')),creator=clipped(query.get('creator')),kind=clipped(query.get('kind')),mode=query.get('mode')==='mature'?'mature':'sfw';
    const page=Math.max(0,Math.min(1000000,Number.parseInt(query.get('page')||'0',10)||0)),size=Math.min(40,Math.max(1,Number.parseInt(query.get('size')||'20',10)||20));
    let where="v.status='public' AND v.number=(SELECT MAX(v2.number) FROM versions v2 WHERE v2.item_id=v.item_id AND v2.status='public')",params=[];
    if(mode==='sfw')where+=" AND v.rating='sfw'";
    if(kind){where+=' AND i.kind=?';params.push(kind);}if(genre){where+=' AND v.genre=?';params.push(genre);}if(creator){where+=' AND v.creator=?';params.push(creator);}
    if(q){where+=" AND LOWER(v.name||' '||v.description||' '||v.tags||' '||v.creator) LIKE ? ESCAPE '\\'";params.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');}
    const from=' FROM versions v JOIN items i ON i.id=v.item_id JOIN users u ON u.id=i.owner_id WHERE '+where;
    const total=db.prepare('SELECT COUNT(*) AS n'+from).get(...params).n;
    const sort={name:'v.name COLLATE NOCASE ASC',recent:'v.created_at DESC',rating:'score DESC,ratings DESC',featured:'i.featured DESC,v.created_at DESC'}[query.get('sort')]||'i.featured DESC,v.created_at DESC';
    const rows=db.prepare('SELECT v.id,v.item_id,v.number,v.name,v.description,v.genre,v.tags,v.rating,v.status,v.created_at,v.creator,v.thumbnail,i.kind,i.owner_id,i.locked,i.featured,u.username AS uploader,(SELECT AVG(r.score) FROM ratings r WHERE r.item_id=i.id) AS score,(SELECT COUNT(*) FROM ratings r WHERE r.item_id=i.id) AS ratings'+from+` ORDER BY ${sort} LIMIT ? OFFSET ?`).all(...params,size,page*size);
    const filters=db.prepare("SELECT DISTINCT v.genre,v.creator FROM versions v JOIN items i ON i.id=v.item_id WHERE v.status='public' AND (?='mature' OR v.rating='sfw')").all(mode);
    json(res,200,{items:rows.map(summary),total,page,size,genres:[...new Set(filters.map(r=>r.genre).filter(Boolean))].sort(),creators:[...new Set(filters.map(r=>r.creator).filter(Boolean))].sort(),instance:config.instanceName});return true;
  }

  const visibility=path.match(/^\/api\/items\/([a-zA-Z0-9_-]+)\/visibility$/);
  if(visibility&&req.method==='POST'){
    requireActor(actor);const item=db.prepare('SELECT * FROM items WHERE id=?').get(visibility[1]);if(!item||item.owner_id!==actor.id)fail(403,'Only the uploader can change publication visibility.');
    const b=await readBody(req,8192);if(!['hidden','public'].includes(b.status))fail(422,'Choose public or hidden.');if(item.locked&&b.status==='public')fail(423,'Moderation locked this publication.');
    const version=db.prepare('SELECT id FROM versions WHERE id=? AND item_id=?').get(String(b.versionId||''),item.id);if(!version)fail(404,'That version does not belong to the item.');
    transaction(db,()=>{db.prepare('UPDATE versions SET status=? WHERE id=?').run(b.status,version.id);audit(db,actor,version.id,'owner-'+b.status,'Uploader changed version visibility.');});json(res,200,{ok:true,versionId:version.id,status:b.status});return true;
  }
  const versionMatch=path.match(/^\/api\/versions\/([a-zA-Z0-9_-]+)$/);
  if(versionMatch&&req.method==='GET'){const v=fullVersion(db,versionMatch[1]);if(!visible(v,actor))fail(404,'This version is unavailable.');json(res,200,downloadVersion(db,v));return true;}
  const itemMatch=path.match(/^\/api\/items\/([a-zA-Z0-9_-]+)$/);
  if(itemMatch&&req.method==='GET'){
    const versions=db.prepare('SELECT id FROM versions WHERE item_id=? ORDER BY number DESC').all(itemMatch[1]).map(r=>fullVersion(db,r.id)).filter(v=>visible(v,actor));if(!versions.length)fail(404,'Item not found.');
    const ratings=db.prepare('SELECT AVG(score) AS average,COUNT(*) AS count FROM ratings WHERE item_id=?').get(itemMatch[1]);const mine=actor?db.prepare('SELECT score,comment FROM ratings WHERE item_id=? AND user_id=?').get(itemMatch[1],actor.id)||null:null;
    json(res,200,{versions:versions.map(summary),ratings,mine});return true;
  }
  if(path==='/api/mine'&&req.method==='GET'){
    requireActor(actor);const versions=db.prepare('SELECT v.id FROM versions v JOIN items i ON i.id=v.item_id WHERE i.owner_id=? ORDER BY v.created_at DESC').all(actor.id).map(r=>summary(fullVersion(db,r.id)));json(res,200,{user:userSummary(actor),versions});return true;
  }
  const receipt=path.match(/^\/api\/operations\/([a-zA-Z0-9_-]+)$/);
  if(receipt&&req.method==='GET'){requireActor(actor);const row=db.prepare('SELECT result FROM operations WHERE user_id=? AND operation_id=?').get(actor.id,receipt[1]);if(!row)fail(404,'No committed receipt exists for this operation.');json(res,200,{...parse(row.result),reconciled:true});return true;}
  if(path==='/api/publish'&&req.method==='POST'){
    requireActor(actor);limiter.take('publish:'+actor.id,{limit:40,windowMs:60000});const body=await readBody(req,config.publishLimit||128*1024*1024),op=operationId(body.operationId),requestHash=hash(body);
    const old=db.prepare('SELECT request_hash,result FROM operations WHERE user_id=? AND operation_id=?').get(actor.id,op);if(old){if(old.request_hash!==requestHash)fail(409,'This operation ID was already used with different data.');json(res,200,{...parse(old.result),reconciled:true});return true;}
    const content=body.content,errors=validateContent(content);if(errors.length)fail(422,errors.join('\n'));safeImages(content);
    const characters=body.characters||[];if(!Array.isArray(characters)||characters.some(c=>c?.kind!=='character'||validateContent(c).length))fail(422,'Story character dependencies must be valid reusable adult characters.');
    for(const c of characters)safeImages(c);
    if(content.kind==='story')for(const id of [...(content.cast||[]),...(content.backgroundCast||[])])if(!characters.some(c=>c.id===id))fail(422,`Story dependency ${id} is missing. Include the cast with this version.`);
    if(content.rating==='sfw'&&characters.some(c=>c.rating!=='sfw'))fail(422,'An SFW story cannot include mature-classified characters.');
    if(!Array.isArray(body.assets||[]))fail(422,'Assets must be a list.');
    const assets=(body.assets||[]).map(a=>{if(!a||typeof a.id!=='string')fail(422,'Every asset needs an ID.');const checked=inspectRaster(a.data);if(a.hash&&a.hash!==checked.hash)fail(422,'An asset integrity check failed.');return {...a,...checked};});
    const ids=new Set(assets.map(a=>a.id));if(ids.size!==assets.length)fail(422,'Asset IDs must be unique.');for(const c of [content,...characters])for(const id of c.assets||[])if(!ids.has(id))fail(422,`Referenced asset ${id} was not included. Nothing was published.`);
    let existing=body.itemId?db.prepare('SELECT * FROM items WHERE id=?').get(body.itemId):null;if(body.itemId&&!existing)fail(404,'Publication not found.');if(existing&&existing.owner_id!==actor.id)fail(403,'Only the uploader account can publish another version. Publish an attributed fork as a new item instead.');if(existing?.locked)fail(423,'This item is locked by moderation.');if(existing&&existing.kind!==content.kind)fail(422,'An item cannot change between character and story.');
    const result=transaction(db,()=>{
      const at=clock(),itemId=existing?.id||randomUUID(),versionId=randomUUID(),last=existing?db.prepare('SELECT id,number FROM versions WHERE item_id=? ORDER BY number DESC LIMIT 1').get(itemId):null,number=(last?.number||0)+1;
      if(!existing)db.prepare('INSERT INTO items(id,owner_id,kind,creator,created_at) VALUES(?,?,?,?,?)').run(itemId,actor.id,content.kind,clipped(content.creator,200)||actor.username,at);
      else db.prepare('UPDATE items SET creator=? WHERE id=?').run(clipped(content.creator,200)||existing.creator,itemId);
      const idMap={};for(const a of assets){const known=db.prepare('SELECT id FROM assets WHERE owner_id=? AND hash=?').get(actor.id,a.hash);const id=known?.id||randomUUID();idMap[a.id]=id;if(!known){const{data,owners,...metadata}=a;db.prepare('INSERT INTO assets(id,owner_id,hash,mime,data,metadata,created_at) VALUES(?,?,?,?,?,?,?)').run(id,actor.id,a.hash,a.mime,a.data,JSON.stringify({...metadata,id}),at);}}
      const rewrite=c=>{const copy=structuredClone(c);delete copy.public;copy.assets=(copy.assets||[]).map(id=>idMap[id]);return copy;};const stored=rewrite(content),dependencies=characters.map(rewrite),payload=JSON.stringify(stored),payloadHash=hash(stored);
      db.prepare('INSERT INTO versions(id,item_id,number,name,description,genre,tags,creator,thumbnail,rating,status,payload,hash,dependencies,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(versionId,itemId,number,content.title||content.name,content.description||content.role||'',content.genre||content.species||'',JSON.stringify(content.tags||[]),clipped(content.creator,200)||actor.username,content.thumbnail?.length<=262144?content.thumbnail:content.image?.startsWith('/public/art/')?content.image:'',content.rating,'public',payload,payloadHash,JSON.stringify(dependencies),at);
      for(const id of new Set(Object.values(idMap)))db.prepare('INSERT INTO version_assets(version_id,asset_id) VALUES(?,?)').run(versionId,id);
      if(body.hidePrevious===true&&last)db.prepare("UPDATE versions SET status='hidden' WHERE id=?").run(last.id);
      const result={itemId,versionId,number,operationId:op,hiddenPrevious:body.hidePrevious===true?last?.id||null:null,ownerId:actor.id,uploader:actor.username,hash:payloadHash};
      db.prepare('INSERT INTO operations(user_id,operation_id,request_hash,result,created_at) VALUES(?,?,?,?,?)').run(actor.id,op,requestHash,JSON.stringify(result),at);audit(db,actor,versionId,'publish',`Version ${number}; ${body.hidePrevious?'only immediately previous version hidden':'older versions retained'}`);return result;
    });
    if(ctx.hooks?.afterPublication)await ctx.hooks.afterPublication(result,req,res);if(!res.destroyed&&!res.writableEnded)json(res,201,result);return true;
  }
  if(path==='/api/ratings'&&req.method==='PUT'){
    requireActor(actor);limiter.take('ratings:'+actor.id,{limit:30,windowMs:60000});const b=await readBody(req,8192),version=fullVersion(db,String(b.versionId||''));if(!visible(version,actor)||version.status!=='public')fail(404,'That public version is unavailable.');if(!Number.isInteger(b.score)||b.score<1||b.score>5)fail(422,'Choose a whole rating from 1 to 5.');
    db.prepare('INSERT INTO ratings(item_id,user_id,score,comment,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(item_id,user_id) DO UPDATE SET score=excluded.score,comment=excluded.comment,updated_at=excluded.updated_at').run(version.item_id,actor.id,b.score,clipped(b.comment,2000),clock());json(res,200,{ok:true,itemId:version.item_id});return true;
  }
  if(path==='/api/reports'&&req.method==='POST'){
    requireActor(actor);limiter.take('reports:'+actor.id,{limit:8,windowMs:60000});const b=await readBody(req,16384),version=fullVersion(db,String(b.versionId||''));if(!visible(version,actor))fail(404,'That version is unavailable.');if(!reasons.includes(b.reason))fail(422,'Choose a report reason.');if(!clipped(b.details,8000))fail(422,'Describe the problem in this exact version.');const contact=clipped(b.contact,320);if(contact&&!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(contact))fail(422,'Enter a valid reply email or leave it blank.');const id=randomUUID();
    db.prepare('INSERT INTO reports(id,version_id,reporter_id,reason,details,contact,snapshot_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,version.id,actor.id,b.reason,clipped(b.details,8000),contact,version.hash,clock());json(res,201,{id,versionId:version.id,state:'open',replySent:false});return true;
  }
  if(path.startsWith('/api/admin/')){
    requireModerator(actor);
    if(path==='/api/admin/reports'&&req.method==='GET'){
      const state=url.searchParams.get('state')==='resolved'?'resolved':'open',page=Math.max(0,Number.parseInt(url.searchParams.get('page')||'0')||0);const reports=db.prepare('SELECT r.id,r.reason,r.state,r.created_at,v.name,v.number,u.username AS uploader FROM reports r JOIN versions v ON v.id=r.version_id JOIN items i ON i.id=v.item_id JOIN users u ON u.id=i.owner_id WHERE r.state=? ORDER BY r.created_at DESC LIMIT 30 OFFSET ?').all(state,page*30);json(res,200,{reports,page,state,total:db.prepare('SELECT COUNT(*) AS n FROM reports WHERE state=?').get(state).n});return true;
    }
    const report=path.match(/^\/api\/admin\/reports\/([a-zA-Z0-9_-]+)$/);
    if(report&&req.method==='GET'){json(res,200,reportDetail(db,report[1]));return true;}
    if(report&&req.method==='POST'){
      const detail=reportDetail(db,report[1]),b=await readBody(req,16384),action=b.action,note=clipped(b.note,6000),v=detail.version.summary;
      const allowed=['hide','restore','reclassify','lock','unlock','restrict-uploader','unrestrict-uploader','feature','unfeature','resolve','reopen','reply-draft','reply-sent'];if(!allowed.includes(action))fail(422,'Choose an available moderation action.');if(note.length<8)fail(422,'Record an action explanation of at least eight characters.');
      transaction(db,()=>{
        if(action==='hide'||action==='restore')db.prepare('UPDATE versions SET status=? WHERE id=?').run(action==='hide'?'hidden':'public',v.versionId);
        if(action==='reclassify'){if(!['sfw','mature'].includes(b.rating))fail(422,'Choose a content classification.');db.prepare('UPDATE versions SET rating=? WHERE id=?').run(b.rating,v.versionId);}
        if(['lock','unlock','feature','unfeature'].includes(action)){const column=['lock','unlock'].includes(action)?'locked':'featured';db.prepare(`UPDATE items SET ${column}=? WHERE id=?`).run(['lock','feature'].includes(action)?1:0,v.itemId);}
        if(action==='restrict-uploader'||action==='unrestrict-uploader'){
          const uploader=db.prepare('SELECT * FROM users WHERE id=?').get(v.ownerId);if(uploader.id===actor.id)fail(403,'You cannot restrict your own operator account.');if(uploader.role!=='player'&&actor.role!=='admin')fail(403,'An administrator must review restrictions on privileged accounts.');db.prepare('UPDATE users SET restricted=?,restriction_reason=? WHERE id=?').run(action==='restrict-uploader'?1:0,note,uploader.id);
        }
        if(action==='resolve'||action==='reopen')db.prepare('UPDATE reports SET state=? WHERE id=?').run(action==='resolve'?'resolved':'open',report[1]);
        if(action==='reply-draft')db.prepare('UPDATE reports SET reply_draft=? WHERE id=?').run(note,report[1]);
        if(action==='reply-sent'){if(b.confirmedOutsideApplication!==true)fail(422,'Explicitly confirm the reply was actually sent outside this application. Opening a composer is not sending.');db.prepare('UPDATE reports SET reply_sent_at=? WHERE id=?').run(clock(),report[1]);}
        audit(db,actor,v.versionId,action,note,report[1]);
      });json(res,200,reportDetail(db,report[1]));return true;
    }
    if(path==='/api/admin/traces'&&req.method==='GET'){const rows=db.prepare('SELECT id,kind,state,started_at,completed_at,error FROM provider_jobs ORDER BY started_at DESC LIMIT 100').all();json(res,200,{jobs:rows,containsCredentials:false,scope:'This local instance only; provider response bodies are not exposed here.'});return true;}
    if(path==='/api/admin/audit'&&req.method==='GET'){json(res,200,{history:db.prepare('SELECT a.*,u.username AS actor FROM audit a JOIN users u ON u.id=a.actor_id ORDER BY at DESC LIMIT 200').all()});return true;}
    fail(404,'Administrative endpoint not found.');
  }
  return false;
}
