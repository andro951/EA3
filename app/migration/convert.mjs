import {clone,id,isRecord,validKey,hash,safeImage} from '../core/util.mjs';
import {validateContent} from '../core/schema.mjs';
const rows=v=>Array.isArray(v)?v:isRecord(v)?Object.values(v):[];
const text=v=>typeof v==='string'?v:v===undefined?'':JSON.stringify(v,null,2);
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
const meaningful=v=>v!==undefined&&v!==null&&v!==''&&!(Array.isArray(v)&&!v.length)&&!(isRecord(v)&&!Object.keys(v).length);
const stable=(v,prefix)=>validKey(v)?v:id(prefix);
function issue(report,path,message,severity='review'){report.issues.push({path,message,severity});}
function imageRef(value,report,path){if(!value)return '';if(typeof value==='string'&&safeImage(value))return value;issue(report,path,'Image reference was preserved in the original. Remote or unsupported image URLs are not fetched automatically. Upload a local matching image in EA3.');return '';}
function block(requirements,report,path,message){issue(report,path,message,'blocked');requirements.push({type:'flag',key:'import-review-'+report.issues.length,op:'eq',value:true});}
function ea1Character(c,report,path){
 if(!isRecord(c))return null;
 const age=Number(c.age);if(!Number.isInteger(age)||age<18||c.loli===true){issue(report,path,'This character needs an explicitly adult, eligible definition before import. No age was invented or changed.','blocked');return null;}
 const wardrobe=rows(c.outfits).map((o,i)=>({id:stable(o.id,'outfit'),name:text(o.name)||`Outfit ${i+1}`,description:text(o.description || o.clothing),rating:c.nsfw?'mature':'sfw'}));
 const current=wardrobe.findIndex(o=>o.id===c.starting_outfit_id);if(current>0)wardrobe.unshift(...wardrobe.splice(current,1));
 const candidate={schema:'ea3/1',kind:'character',id:stable(c.id,'character'),name:text(c.name),age,rating:c.nsfw?'mature':'sfw',creator:text(c.creator),description:text(c.description || c.role),genre:'Imported',tags:list(c.genres),pronouns:text(c.pronouns),species:text(c.appearance?.species || c.species || ''),personality:text(c.personality_description || c.personality),speech:text(c.speech_style || c.speech),backstory:text(c.backstory),opening:text(c.opening || rows(c.chat_story_template?.messages).find(m=>m.role==='assistant')?.text),appearance:{description:text(c.appearance)},wardrobe,image:imageRef(c.default_profile_image || c.image,report,path+'.image'),migration:{source:'EA1',originalId:c.id || null}};
 const handled=new Set(['id','name','age','nsfw','creator','description','role','genres','pronouns','species','appearance','personality_description','personality','speech_style','speech','backstory','opening','chat_story_template','outfits','starting_outfit_id','default_profile_image','image','loli']);
 const remaining=Object.keys(c).filter(k=>!handled.has(k)&&meaningful(c[k]));if(remaining.length)issue(report,path,'Additional original character fields require review: '+remaining.join(', '));
 for(const error of validateContent(candidate))issue(report,path,error,'blocked');return candidate;
}
function fromEA2(c,report,path){
 const out=clone(c);out.schema='ea3/1';out.migration={source:'EA2',originalId:c.id};
 if(c.kind==='story'){
  out.nodes=clone(c.beats || []);delete out.beats;out.backgroundCast=clone(c.roster || []);delete out.roster;
  out.initial={resources:clone(c.resources || {}),inventory:clone(c.inventory || {}),flags:clone(c.flags || {})};delete out.resources;delete out.inventory;delete out.flags;
  out.developments=clone(c.timed || []);delete out.timed;out.afterEnding=c.freeplay===false?'stop':'freeplay';delete out.freeplay;
  out.locations=(out.locations || []).map((l,i)=>({...l,discovered:l.discovered!==false||i===0}));
  out.offers=(c.offers || []).map(o=>({...o,kind:['shop','job','service','recruitment'].includes(o.kind)?o.kind:'shop',cost:typeof o.cost==='number'?{[o.currency || 'coins']:o.cost}:clone(o.cost || {}),response:o.result || o.response || '',...(o.repeatable===false?{stock:1}:{})}));
  const fix=effects=>{for(const e of effects || [])if(e.type==='flag'&&e.value===undefined)e.value=true;};
  for(const n of out.nodes){fix(n.effects);for(const choice of n.choices || [])fix(choice.effects);}
  for(const o of out.offers)fix(o.effects);for(const d of out.developments)fix(d.effects);for(const g of Object.values(out.effectGroups || {}))fix(g);
  issue(report,path,'EA2 story fields were mapped to the EA3 format. Review outfit availability, ending behavior, and time semantics before playtesting.');
 }
 for(const error of validateContent(out))issue(report,path,error,'blocked');return out;
}
function ea1Story(t,report){
 const s=t.state || {},characters=[],names=new Map(),future=new Set();
 function add(c,path,isFuture=false){const raw=c?.character_definition || c?.full_character || c?.definition || c?.character || c;if(!isRecord(raw))return;const existing=characters.find(x=>x.id===raw.id);if(existing){if(isFuture)future.add(existing.id);return;}const candidate=ea1Character(raw,report,path);if(!candidate)return;characters.push(candidate);names.set(raw.name,candidate.id);names.set(raw.id,candidate.id);if(isFuture)future.add(candidate.id);}
 for(const [i,c]of rows(s.characters).entries())add(c,`characters.${i}`);
 for(const [i,l]of rows(s.npc_directory?.locations).entries())for(const [j,c]of rows(l.characters).entries())add(c,`npc_directory.${i}.${j}`);
 for(const [i,c]of rows(s.future_cast?.items).entries())add(c,`future_cast.${i}`,true);
 const locations=rows(s.world_map?.locations).map(l=>({id:stable(l.id,'location'),name:text(l.name),description:text(l.summary || l.detail),links:rows(l.connections).map(c=>typeof c==='string'?c:c.target_id || c.location_id || c.id).filter(Boolean),discovered:l.discovered===true}));
 if(!locations.length){locations.push({id:'imported-location',name:text(s.location?.specific_place || t.title)||'Imported location',description:text(s.scene?.summary),links:[],discovered:true});issue(report,'world_map','No explicit map was found. Review the imported starting location.');}
 const locationIds=new Set(locations.map(l=>l.id));for(const l of locations){const missing=l.links.filter(k=>!locationIds.has(k));if(missing.length)issue(report,`location.${l.id}`,'Missing linked locations: '+missing.join(', '),'blocked');}
 const objectives=rows(s.objectives?.items),nodeIds=new Set(objectives.map(n=>n.id));
 const nodes=objectives.map((n,i)=>{
  const node={id:stable(n.id,'moment'),title:text(n.title),text:text(n.summary || n.completion_message || n.notes),requires:[],effects:[],choices:[]};
  if(!node.text)node.text=text(n.title);
  if(locationIds.has(n.travel_location_id))node.location=n.travel_location_id;
  for(const req of rows(n.requires))if(typeof req==='string'&&nodeIds.has(req))block(node.requires,report,`objectives.${i}.requires`,'Legacy completion prerequisites need review: EA1 completion is not equivalent to entering an EA3 moment.');else if(meaningful(req))block(node.requires,report,`objectives.${i}.requires`,'Unsupported prerequisite was retained in the original; it was not silently removed.');
  for(const [j,c]of rows(n.choices).entries()){
   const choice={id:stable(c.id,'choice'),label:text(c.title || c.label || c.summary),requires:[],effects:[]};if(c.next_objective_id)choice.to=c.next_objective_id;
   if(rows(c.rewards).length||rows(c.effects).length||rows(c.requirements).length||c.target_input_group_id)block(choice.requires,report,`objectives.${i}.choices.${j}`,'Choice rewards, requirements or input-group semantics need an explicit EA3 replacement. This imported choice remains blocked until repaired.');
   node.choices.push(choice);
  }
  for(const [j,destination]of rows(n.next_objectives).entries()){const key=typeof destination==='string'?destination:destination.id || destination.next_objective_id;if(key)node.choices.push({id:id('route'),label:text(objectives.find(o=>o.id===key)?.title)||text(key),to:key,requires:[{type:'flag',key:'legacy-completion-reviewed',value:true}],effects:[]});}
  const mechanics=['rewards','outcome_routes','input_groups','completion_criteria','while_active_guidance','completion_instruction','locked_until_complete','exclusive_group'].filter(k=>meaningful(n[k]));
  if(mechanics.length)block(node.requires,report,`objectives.${i}`,'Original behavior needs review: '+mechanics.join(', ')+'. The original is retained; this is a graph-review draft, not equivalent gameplay.');
  return node;
 });
 const opening=rows(t.messages).filter(m=>m.role==='assistant').map(m=>text(m.text)).join('\n\n');
 if(!nodes.length)nodes.push({id:'imported-opening',title:text(t.title)||'Opening',text:opening||text(s.scene?.summary)||text(t.description),choices:[]});
 const start=nodeIds.has(s.objectives?.active_id)?s.objectives.active_id:nodes[0].id;
 if(objectives.length)issue(report,'objectives','All objective nodes and explicit route destinations were retained for visual review. Automatic completion, side-objective concurrency and input-group rules are not silently emulated.','review');
 for(const k of ['reward_bundles','story_shops','timed_events','story_job_offers','story_clock','story_memory','story_inventory','players','player'])if(meaningful(s[k]))issue(report,'state.'+k,'Original '+k+' is preserved in the source archive and requires migration review.');
 const cast=characters.filter(c=>!future.has(c.id)).map(c=>c.id),present=list(s.scene?.npcs_present).map(n=>names.get(n)).filter(Boolean);
 if(present.length)nodes.find(n=>n.id===start).cast=present;
 const story={schema:'ea3/1',kind:'story',id:stable(t.id,'story'),title:text(t.title),description:text(t.description),creator:text(t.creator),genre:list(t.genres)[0] || 'Imported',tags:list(t.genres),rating:t.nsfw?'mature':'sfw',initiative:'shared',start,cast,backgroundCast:[...future],nodes,locations,initial:{resources:{},inventory:{},flags:{}},items:[],offers:[],developments:[],rules:rows(s.story_rules).map(text).join('\n'),afterEnding:'freeplay',image:imageRef(t.title_card_image,report,'title_card_image'),migration:{source:'EA1',originalId:t.id,reviewOnly:true,opening}};
 if(!locations.some(l=>l.discovered))locations[0].discovered=true;
 for(const error of validateContent(story))issue(report,'story',error,'blocked');return [...characters,story];
}
export async function inspectLegacy(input,{name='import.json',rawText=JSON.stringify(input)}={}){
 const report={schema:'ea3/migration-review/1',sourceName:name,sourceHash:await hash(rawText),kind:'unknown',candidates:[],issues:[],counts:{}};
 if(input?.schema==='ea2/1'&&['story','character'].includes(input.kind)){report.kind='EA2 content';report.candidates=[fromEA2(input,report,'content')];}
 else if(input?.character_definition||input?.exportType==='character'){report.kind='EA1 character';const c=ea1Character(input.character_definition || input.character,report,'character');if(c)report.candidates=[c];}
 else if(input?.storyTemplate){report.kind='EA1 story';report.candidates=ea1Story(input.storyTemplate,report);}
 else if(input?.state&&Array.isArray(input?.messages)){report.kind='EA1 saved session';report.candidates=ea1Story({id:id('story'),title:name.replace(/\.json$/i,''),description:'Recovered definition for manual review',state:input.state,messages:input.messages},report);issue(report,'save','Live EA1 history cannot be resumed as an EA3 save without a verified state-journal converter. The original save is retained unchanged.','blocked');}
 else issue(report,'format','This format has no verified converter. Preserve the original for a dedicated migration rather than guessing its contents.','blocked');
 report.counts={characters:report.candidates.filter(c=>c.kind==='character').length,stories:report.candidates.filter(c=>c.kind==='story').length,nodes:report.candidates.filter(c=>c.kind==='story').reduce((n,c)=>n+c.nodes.length,0),issues:report.issues.length,blocked:report.issues.filter(i=>i.severity==='blocked').length};
 for(const c of report.candidates)c.migration={...c.migration,sourceHash:report.sourceHash};return report;
}
