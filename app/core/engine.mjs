/** The authoritative engine composes world transactions with reversible roster/presentation changes. */
import {createAdventure as createBase,planAction as planBase,commitAction as commitBase,rewind as rewindBase,rewriteBase as rewriteBaseCore,choices as baseChoices} from './runtime.mjs';
import {clone,id,now,requireThat,isRecord} from './util.mjs';
import {validateCharacter} from './schema.mjs';
export function projectCharacters(save){
  const base=save.baseCharacters || save.characters;
  const characters=[...base,...Object.values(save.state.addedCharacters || {})].map(c=>({...clone(c),...clone(save.state.presentation?.[c.id] || {})}));
  return {...save,baseCharacters:clone(base),characters};
}
export function createAdventure(...args){return projectCharacters(createBase(...args));}
export function planAction(compiled,save,action){
  requireThat(action&&typeof action.kind==='string','Choose a valid action.');
  if(save.state.ending&&compiled.story.afterEnding==='stop'&&['say','continue','auto','choice','travel','offer','recruit'].includes(action.kind))throw new Error('This story has ended. Rewind or begin another adventure to continue playing.');
  if(!['add-character','presentation','reset-presentation'].includes(action.kind))return planBase(compiled,save,action);
  requireThat(!save.events.some(e=>e.id===action.id),'This action was already committed.','DUPLICATE');
  const state=clone(save.state);let summary;
  if(action.kind==='add-character'){
    const c=clone(action.character);requireThat(!validateCharacter(c).length,'The character definition is invalid.');
    requireThat(!save.characters.some(x=>x.id===c.id),'This character already belongs to the adventure.');
    requireThat(save.profile.rating==='mature'||c.rating!=='mature','This character is unavailable in a SFW adventure.');
    state.addedCharacters ||= {};state.addedCharacters[c.id]=c;state.present.push(c.id);
    const outfits=(c.wardrobe || []).filter(o=>!o.locked&&(save.profile.rating==='mature'||o.rating!=='mature'));state.unlockedOutfits[c.id]=outfits.map(o=>o.id);if(outfits[0])state.outfits[c.id]=outfits[0].id;
    summary=`${c.name} joins the scene.`;
  }else{
    const c=save.characters.find(c=>c.id===action.characterId);requireThat(c,'This character is no longer in the adventure.');
    state.presentation ||= {};
    if(action.kind==='reset-presentation'){delete state.presentation[c.id];delete state.images[c.id];summary=`Restored ${c.name}’s original presentation.`;}
    else{
      requireThat(isRecord(action.presentation)&&isRecord(action.presentation.appearance),'A staged presentation is required.');
      requireThat(typeof action.assetId==='string'&&action.assetId.startsWith('image-'),'A matching owned preview is required.');
      requireThat(action.expectedRevision===save.revision,'The adventure changed while this preview was prepared. Generate or upload a fresh preview.','CONFLICT');
      const p=action.presentation;requireThat(typeof p.pronouns==='string'&&typeof p.species==='string','Presentation fields must be text.');
      for(const v of Object.values(p.appearance))requireThat(typeof v==='string'||typeof v==='number'&&Number.isFinite(v)&&v>=0,'Appearance values must be text or finite nonnegative numbers.');
      state.presentation[c.id]={pronouns:p.pronouns,species:p.species,appearance:clone(p.appearance)};state.images[c.id]=action.assetId;summary=`Updated ${c.name}’s presentation and matching portrait.`;
    }
  }
  return {id:action.id || id('turn'),baseRevision:save.revision,state,action:clone(action),playerText:null,summary,narrative:false,semantic:null,createdAt:now()};
}
export function commitAction(save,plan,result={}){return projectCharacters(commitBase(save,plan,result));}
export function rewind(save,eventCount){return projectCharacters(rewindBase(save,eventCount));}
export function rewriteBase(save,eventCount){return projectCharacters(rewriteBaseCore(save,eventCount));}

export const choices=baseChoices;
