import {clone, id, now, requireThat, validKey, isRecord} from './util.mjs';
import {SAVE_SCHEMA, validateCharacter, validateEffects} from './schema.mjs';
import {difference, stateAt} from './history.mjs';

const add = (a,b) => {const value=(a || 0)+b;requireThat(Number.isSafeInteger(value),'The quantity is outside the supported safe range.');return value;};
const appendUnique = (array,value) => {if(!array.includes(value))array.push(value);};
const actorMap = save => new Map(save.characters.map(c => [c.id,c]));
export function meets(state, conditions = []) {
  const compare = (a,op,b) => ({eq:()=>a===b, ne:()=>a!==b, gt:()=>a>b, gte:()=>a>=b, lt:()=>a<b, lte:()=>a<=b}[op || 'eq']?.() ?? false);
  return conditions.every(c => {
    if(c.type==='all')return meets(state,c.conditions || []);
    if(c.type==='any')return (c.conditions || []).some(x=>meets(state,[x]));
    if(c.type==='not')return !meets(state,c.conditions || []);
    const source={resource:state.resources,item:state.inventory,flag:state.flags,relationship:state.relationships};
    const value=c.type==='clock'?state.clock:c.type==='visited'?state.visited.includes(c.key):c.type==='member'?state.party.includes(c.key):c.type==='completed'?state.completed.includes(c.key):source[c.type]?.[c.key] ?? (['resource','item','relationship'].includes(c.type)?0:false);
    return compare(value,c.op,c.value);
  });
}
function actor(context,key) {const c=context.characters.get(key);requireThat(c,`Character ${key} is unavailable.`);return c;}
function quantity(state,type,key,amount) {
  requireThat(validKey(key) && Number.isSafeInteger(amount),'Invalid quantity change.');
  const map=type==='resource'?state.resources:state.inventory;
  const value=add(map[key],amount);requireThat(value>=0,`Not enough ${key}.`,'INSUFFICIENT');
  if(type==='item') {
    const equipped=Object.values(state.equipment).reduce((n,slots)=>n+Object.values(slots).filter(v=>v===key).length,0);
    requireThat(value>=equipped,`Unequip ${key} before removing it.`);
  }
  map[key]=value;
}
function changeLocation(compiled,state,key,context) {
  const location=compiled.locations.get(key);requireThat(location,`Unknown location ${key}.`);
  state.location=key;appendUnique(state.discovered,key);appendUnique(state.visited,key);
  if(location.cast)state.present=[...new Set([...state.party,...location.cast.filter(c=>context.characters.has(c))])];
}
export function applyEffects(compiled, state, effects = [], context, stack = []) {
  const errors=validateEffects(effects,'State change',[],compiled.story);requireThat(!errors.length,errors.join('\n'));
  for(const e of effects) {
    switch(e.type) {
      case 'resource': case 'item': quantity(state,e.type,e.key,e.amount);break;
      case 'flag': requireThat(['string','boolean','number'].includes(typeof e.value),'Flags need a simple value.');state.flags[e.key]=e.value;break;
      case 'relationship': actor(context,e.key);state.relationships[e.key]=add(state.relationships[e.key],e.amount);break;
      case 'memory': {
        if(!['world','player'].includes(e.key))actor(context,e.key);
        requireThat(e.value.trim().length>0 && e.value.length<=8000,'Memory must contain 1–8000 characters.');
        if(e.rating==='mature')requireThat(context.rating==='mature','This profile cannot store mature-only memory.');
        if(!state.memory.some(m=>m.subject===e.key && m.text===e.value))state.memory.push({id:id('memory'),subject:e.key,text:e.value,sourceEvent:context.eventId,rating:e.rating || 'sfw'});
        break;
      }
      case 'discover': requireThat(compiled.locations.has(e.key),'Unknown location.');appendUnique(state.discovered,e.key);break;
      case 'travel': changeLocation(compiled,state,e.key,context);break;
      case 'presence': actor(context,e.key);if(e.value===false)state.present=state.present.filter(x=>x!==e.key);else appendUnique(state.present,e.key);break;
      case 'recruit': actor(context,e.key);appendUnique(state.party,e.key);appendUnique(state.present,e.key);break;
      case 'unlockOutfit': {
        const c=actor(context,e.key);requireThat(c.wardrobe?.some(o=>o.id===e.value),'Unknown outfit.');
        state.unlockedOutfits[e.key] ||= [];appendUnique(state.unlockedOutfits[e.key],e.value);break;
      }
      case 'outfit': {
        const c=actor(context,e.key),outfit=c.wardrobe?.find(o=>o.id===e.value);requireThat(outfit,'Unknown outfit.');
        requireThat((state.unlockedOutfits[e.key] || []).includes(e.value),'This outfit has not been acquired.');
        requireThat(outfit.rating!=='mature' || context.rating==='mature','This outfit is unavailable in this profile.');
        state.outfits[e.key]=e.value;break;
      }
      case 'equip': {
        requireThat(e.key==='player' || context.characters.has(e.key),'Unknown equipment owner.');requireThat(validKey(e.slot),'Choose an equipment slot.');
        state.equipment[e.key] ||= {};
        if(e.value===''){delete state.equipment[e.key][e.slot];break;}
        const item=compiled.items.get(e.value);requireThat(item,'Unknown item.');
        if(item.slot)requireThat(item.slot===e.slot,'That item does not fit this slot.');
        const inUse=Object.entries(state.equipment).reduce((n,[owner,slots])=>n+Object.entries(slots).filter(([slot,value])=>value===e.value && !(owner===e.key && slot===e.slot)).length,0);
        requireThat((state.inventory[e.value] || 0)>inUse,'No unequipped copy is available.');state.equipment[e.key][e.slot]=e.value;break;
      }
      case 'clock': state.clock=add(state.clock,e.amount);requireThat(state.clock>=0,'Story time cannot be negative.');break;
      case 'ending': state.ending=String(e.value || e.key || 'The end');break;
      case 'bundle': requireThat(stack.length<16 && !stack.includes(e.key),'Effect group cycle detected.');applyEffects(compiled,state,compiled.story.effectGroups[e.key],context,[...stack,e.key]);break;
      default: throw new Error(`Unsupported effect ${e.type}.`);
    }
  }
  return state;
}
function enter(compiled,state,nodeId,context) {
  const node=compiled.nodes.get(nodeId);requireThat(node,'That story node does not exist.');requireThat(meets(state,node.requires),'This part of the story is not available yet.');
  state.node=nodeId;
  if(node.location)changeLocation(compiled,state,node.location,context);
  if(node.cast)state.present=[...new Set([...state.party,...node.cast.filter(c=>context.characters.has(c))])];
  if(node.repeat || !state.completed.includes(nodeId))applyEffects(compiled,state,node.effects,context);
  appendUnique(state.completed,nodeId);
  if(node.ending)state.ending=node.ending;
  return node;
}
function developments(compiled,state,context) {
  const narration=[];
  for(const d of compiled.story.developments || []) {
    const count=state.fired[d.id] || 0;
    if(count && !d.interval)continue;
    if(state.clock>=d.at+count*(d.interval || 0) && meets(state,d.requires)) {
      applyEffects(compiled,state,d.effects,context);state.fired[d.id]=count+1;if(d.text)narration.push(d.text);
    }
  }
  return narration;
}
export function createAdventure(compiled, characters, profile, options = {}) {
  requireThat(profile && typeof profile.name==='string' && profile.name.trim(),'Choose a player name.');
  const rating=profile.rating || 'sfw';requireThat(rating==='mature' || compiled.story.rating!=='mature','Choose a compatible content profile.');
  const needed=new Set([...(compiled.story.cast || []),...(compiled.story.backgroundCast || [])]);
  const selected=characters.filter(c=>needed.has(c.id));
  for(const c of selected) {requireThat(validateCharacter(c).length===0,`Invalid character ${c.name}.`);requireThat(rating==='mature'||c.rating!=='mature',`Character ${c.name} is not compatible with this profile.`);}
  for(const key of needed)requireThat(selected.some(c=>c.id===key),`Missing reusable character ${key}.`);
  const story=compiled.story,node=compiled.nodes.get(story.start);
  const state={node:story.start,location:node.location || story.locations[0].id,clock:0,resources:clone(story.initial?.resources || {}),inventory:clone(story.initial?.inventory || {}),flags:clone(story.initial?.flags || {}),relationships:clone(story.initial?.relationships || {}),present:[...(story.cast || [])],party:[],discovered:story.locations.filter(l=>l.discovered).map(l=>l.id),visited:[],completed:[],memory:[],outfits:{},unlockedOutfits:{},equipment:{},fired:{},purchases:{},images:{},ending:null};
  for(const c of selected) {
    const wardrobe=(c.wardrobe || []).filter(o=>(rating==='mature' || o.rating!=='mature') && !o.locked);
    state.unlockedOutfits[c.id]=wardrobe.map(o=>o.id);if(wardrobe[0])state.outfits[c.id]=wardrobe[0].id;
  }
  const initial=clone(state),eventId=id('turn');
  enter(compiled,state,story.start,{characters:new Map(selected.map(c=>[c.id,c])),rating,eventId});
  const event={id:eventId,kind:'opening',action:{kind:'opening'},playerText:null,narration:options.opening?.trim() || node.text,summary:'Adventure begins',changes:difference(initial,state),createdAt:now(),provider:'authored',model:'story definition'};
  return {schema:SAVE_SCHEMA,id:id('adventure'),title:options.title || story.title,storyId:story.id,definitionKey:options.definitionKey || null,characters:clone(selected),profile:clone(profile),initial,state,events:[event],revision:1,createdAt:now(),updatedAt:now(),bookmarks:[],memoryCandidates:[],assets:[]};
}
export function choices(compiled,state) {
  return (compiled.nodes.get(state.node)?.choices || []).map(c=>({...c,available:meets(state,c.requires)}));
}
export function availableOffers(compiled,state) {
  return [...compiled.offers.values()].map(o=>({...o,available:(!o.location || o.location===state.location) && (!o.actor || state.present.includes(o.actor)) && (o.stock===undefined || o.stock<0 || (state.purchases[o.id] || 0)<o.stock) && meets(state,o.requires) && Object.entries(o.cost || {}).every(([k,v])=>(state.resources[k] || 0)>=v)}));
}
export function planAction(compiled,save,action) {
  requireThat(isRecord(action) && typeof action.kind==='string','Choose a valid action.');
  const eventId=action.id || id('turn');requireThat(!save.events.some(e=>e.id===eventId),'This action was already committed.','DUPLICATE');
  const state=clone(save.state),context={characters:actorMap(save),rating:save.profile.rating || 'sfw',eventId};
  let node=compiled.nodes.get(state.node),authored='',playerText=null,summary='',narrative=true;
  switch(action.kind) {
    case 'opening': node=enter(compiled,state,compiled.story.start,context);authored=node.text;break;
    case 'say': requireThat(typeof action.text==='string' && action.text.trim() && action.text.length<=32000,'Write a message of 1–32000 characters.');playerText=action.text.trim();summary='Player message';break;
    case 'continue': case 'auto': {
      if(state.ending && compiled.story.afterEnding==='stop')throw new Error('This story has ended. Load a checkpoint or begin another adventure.');
      if(node?.next && !state.ending){node=enter(compiled,state,node.next,context);authored=node.text;}
      summary='Continue';break;
    }
    case 'choice': {
      const choice=choices(compiled,state).find(c=>c.id===action.choiceId);requireThat(choice?.available,'This choice is no longer available.');
      applyEffects(compiled,state,choice.effects,context);playerText=choice.label;summary=choice.label;
      if(choice.to){node=enter(compiled,state,choice.to,context);authored=node.text;}else authored=choice.response || '';
      break;
    }
    case 'travel': {
      const from=compiled.locations.get(state.location),to=compiled.locations.get(action.location);
      requireThat(to && state.discovered.includes(to.id) && (from?.links || []).includes(to.id) && meets(state,to.requires),'There is no available route to that location.');
      changeLocation(compiled,state,to.id,context);summary=`Travel to ${to.name}`;playerText=summary;authored=to.arrival || to.description || '';break;
    }
    case 'offer': {
      const offer=availableOffers(compiled,state).find(o=>o.id===action.offerId);requireThat(offer?.available,'This offer is unavailable or unaffordable.');
      for(const [key,value] of Object.entries(offer.cost || {}))quantity(state,'resource',key,-value);
      applyEffects(compiled,state,offer.effects,context);state.purchases[offer.id]=add(state.purchases[offer.id],1);
      summary=offer.name;playerText=offer.name;authored=offer.response || `${offer.name} is complete.`;break;
    }
    case 'recruit': {
      const c=actor(context,action.characterId);requireThat(state.present.includes(c.id),'That character is not present.');requireThat(c.recruitable!==false,'This character cannot join the party.');
      appendUnique(state.party,c.id);summary=`${c.name} joins your party.`;authored=summary;break;
    }
    case 'dismiss': state.party=state.party.filter(c=>c!==action.characterId);summary='Party updated';narrative=false;break;
    case 'outfit': case 'equip': applyEffects(compiled,state,[{type:action.kind,key:action.characterId || 'player',value:action.value,slot:action.slot}],context);summary=action.kind==='outfit'?'Outfit changed':'Equipment changed';narrative=false;break;
    case 'memory': {
      if(action.sourceEvent)requireThat(save.events.some(e=>e.id===action.sourceEvent),'The source of this memory was removed.');
      applyEffects(compiled,state,[{type:'memory',key:action.subject || 'world',value:action.text,rating:action.rating}],{...context,eventId:action.sourceEvent || eventId});summary='Memory recorded';narrative=false;break;
    }
    case 'forget': state.memory=state.memory.filter(m=>m.id!==action.memoryId);summary='Memory removed';narrative=false;break;
    case 'image': requireThat(validKey(action.subject) && typeof action.assetId==='string','Invalid image selection.');state.images[action.subject]=action.assetId;summary='Image selected';narrative=false;break;
    default: throw new Error(`Unknown action ${action.kind}.`);
  }
  if(narrative && action.kind!=='opening')state.clock=add(state.clock,1);
  const extra=narrative?developments(compiled,state,context):[];
  if(extra.length)authored=[authored,...extra].filter(Boolean).join('\n\n');
  const semantic={schema:'ea3/narration/1',action:clone(action),story:{title:compiled.story.title,description:compiled.story.description,rules:compiled.story.rules || '',initiative:compiled.story.initiative},player:clone(save.profile),scene:{id:state.node,title:node?.title || '',text:node?.text || '',authored},location:clone(compiled.locations.get(state.location)),cast:save.characters.filter(c=>state.present.includes(c.id)).map(c=>({...clone(c),outfit:c.wardrobe?.find(o=>o.id===state.outfits[c.id])})),state:clone(state),recent:save.events.filter(e=>e.narration).slice(-12).map(e=>({player:e.playerText,text:e.narration})),playerText,continueWithoutPlayerDecision:['continue','auto'].includes(action.kind)};
  return {id:eventId,baseRevision:save.revision,state,action:clone(action),playerText,summary,narrative,semantic,createdAt:now()};
}
export function commitAction(save,plan,result = {}) {
  requireThat(save.revision===plan.baseRevision,'A newer action changed this adventure. Nothing was overwritten.','CONFLICT');
  requireThat(!save.events.some(e=>e.id===plan.id),'This action was already committed.','DUPLICATE');
  if(plan.narrative)requireThat(typeof result.text==='string' && result.text.trim() && result.text.length<=200000,'The narrator returned an empty or oversized response.');
  const next={...save,state:clone(plan.state),revision:save.revision+1,updatedAt:now(),events:[...save.events,{id:plan.id,kind:plan.narrative?plan.action.kind:'state',action:plan.action,playerText:plan.playerText,narration:plan.narrative?result.text.trim():'',summary:plan.summary,changes:difference(save.state,plan.state),createdAt:plan.createdAt,provider:result.provider || 'local',model:result.model || '',simulated:!!result.simulated}]};
  next.memoryCandidates=[...(save.memoryCandidates || []),...(Array.isArray(result.memories)?result.memories:[]).filter(m=>isRecord(m)&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=8000&&(['world','player'].includes(m.subject)||save.characters.some(c=>c.id===m.subject))).map(m=>({id:id('candidate'),subject:m.subject,text:m.text,rating:m.rating==='mature'?'mature':'sfw',sourceEvent:plan.id}))];
  return next;
}
export function rewind(save,eventCount) {
  const state=stateAt(save,eventCount),events=save.events.slice(0,eventCount),ids=new Set(events.map(e=>e.id));
  return {...save,state,events,revision:save.revision+1,updatedAt:now(),bookmarks:(save.bookmarks || []).filter(b=>b.eventCount<=eventCount),memoryCandidates:(save.memoryCandidates || []).filter(m=>ids.has(m.sourceEvent))};
}
export function rewriteBase(save,eventCount) {
  const next=rewind(save,eventCount);next.revision=save.revision;return next;
}
export function validateSave(save) {
  const errors=[];
  if(save?.schema!==SAVE_SCHEMA || !validKey(save?.id))return ['Invalid adventure format.'];
  if(!Number.isSafeInteger(save.revision) || save.revision<1)errors.push('Invalid save revision.');
  if(!Array.isArray(save.events) || !isRecord(save.initial) || !isRecord(save.state))return [...errors,'Missing adventure history.'];
  const ids=new Set();for(const event of save.events) {if(!validKey(event.id)||ids.has(event.id)||!Array.isArray(event.changes))errors.push('Invalid or duplicate history event.');ids.add(event.id);}
  for(const key of ['resources','inventory'])for(const [k,v] of Object.entries(save.state[key] || {}))if(!validKey(k)||!Number.isSafeInteger(v)||v<0)errors.push(`Invalid ${key}.`);
  return errors;
}
