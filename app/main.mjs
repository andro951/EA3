import {Repository} from './storage/repository.mjs';
import {compile,validateContent} from './core/schema.mjs';
import {createAdventure,planAction,commitAction} from './core/runtime.mjs';
import {Session} from './core/session.mjs';
import {clone,id,now,requireThat,safeJSON,download} from './core/util.mjs';
import {DemoNarrator} from './providers/demo.mjs';
import {starterCharacters,starterStory} from '../content/seed.mjs';
import {home,header,library,libraryCards,game} from './ui/screens.mjs';
import {$,$$,esc,button,badge,image,field,modal,confirmDialog,toast,onError,closeDialogs,readForm,empty} from './ui/dom.mjs';
import {contentDetail,storySetup,profiles,settings,autoSettings,cast,inspectCharacter,worldMap,inventory,offers,memory,saves,bookmarks,editTurn,guidance,dataTools,about} from './ui/dialogs.mjs';

const defaults={textProvider:'demo',imageProvider:'upload',storySize:16,storyFont:'sans',autoMode:'observe',autoLimit:4,voiceAuto:false,reduceMotion:false,guidance:''};
const app={repo:new Repository(),settings:{...defaults},profile:{id:'default',name:'Traveler',description:'A traveler at the crossroads',pronouns:'',rating:'sfw'},view:'home',session:null,saves:[],assetCache:new Map(),libraryItems:[],libraryQuery:'',libraryGenre:'',librarySort:'name',libraryPage:0,historyLimit:45,draft:'',mobilePanel:null,navEpoch:0,status:{phase:'ready',label:'Saved locally'},stream:'',
  providerLabel(){return this.settings.textProvider==='demo'?'Local story demo':this.settings.textProvider==='perchance'?'Perchance':'Configured AI';},
  imageSource(source){if(!source)return '';const key=source.startsWith('asset:')?source.slice(6):source;return this.assetCache.get(key)?.data || source;},
  async refreshAssets(){this.assetCache=new Map((await this.repo.all('assets')).map(a=>[a.id,a]));},
  async refreshSaves(){this.saves=await this.repo.listSaves();},
  async persistProfile(){const rows=await this.repo.get('meta','profiles') || [];await this.repo.put('meta','profiles',[...rows.filter(p=>p.id!==this.profile.id),this.profile]);await this.repo.put('meta','activeProfile',this.profile.id);},
  async saveSettings(value){await this.repo.put('meta','settings',value);this.settings=value;this.applySettings();if(this.session)this.session.provider=await this.provider();},
  applySettings(){document.documentElement.style.setProperty('--story-size',`${this.settings.storySize}px`);document.documentElement.style.setProperty('--story-font',this.settings.storyFont==='serif'?'Georgia,serif':'var(--font)');document.body.classList.toggle('reduce-motion',!!this.settings.reduceMotion);},
  async provider(){if(this.settings.textProvider==='demo')return new DemoNarrator();const {makeTextProvider}=await import('./providers/registry.mjs');return makeTextProvider(this.settings);},
  async begin(story,characters,profile,options){this.session?.stop();const compiled=compile(story),key=await this.repo.freeze(story);const save=createAdventure(compiled,characters,profile,{...options,definitionKey:key});await this.repo.commitSave(save,null);await this.repo.put('meta','activeSave',save.id);await this.attach(save,compiled);await this.navigate('adventure');},
  async attach(save,compiled){this.session?.stop();const provider=await this.provider();this.session=new Session({save,compiled,repository:this.repo,provider,onChange:next=>{this.stream='';if(this.view==='adventure')this.render({scrollEnd:true});this.refreshSaves().catch(onError);this.scheduleBackup?.();if(this.settings.voiceAuto)this.speak(next.events.at(-1)?.narration || '');},onStatus:status=>{this.status=status;if(status.phase==='generating'){this.stream='';}this.paintStatus();},onChunk:chunk=>{this.stream+=chunk;const el=$('#stream-text');if(el){el.textContent=this.stream;const thread=$('#thread');if(thread && thread.scrollHeight-thread.scrollTop-thread.clientHeight<220)thread.scrollTop=thread.scrollHeight;}}});await this.refreshAssets();},
  async loadSave(key){this.session?.stop();const save=await this.repo.readSave(key);requireThat(save,'That adventure is no longer available.');if(save.profile.rating==='mature'&&this.profile.rating!=='mature'){const confirmed=await confirmDialog('Mature adventure','This adventure uses a mature profile. Open it with its saved content preferences?',{confirm:'Open mature adventure'});if(!confirmed)return;}const story=await this.repo.get('definitions',save.definitionKey);requireThat(story,'This save is missing its story definition. Use a complete archive or the recovery page.');await this.attach(save,compile(story));await this.repo.put('meta','activeSave',save.id);await this.navigate('adventure');},
  async act(action){requireThat(this.session,'Begin an adventure first.');return this.session.turn(action);},
  async navigate(view){const epoch=++this.navEpoch;if(view!=='adventure'){this.session?.stop();this.mobilePanel=null;}closeDialogs();this.view=view;if(['stories','characters'].includes(view)){this.libraryPage=0;this.libraryQuery='';this.libraryGenre='';this.libraryItems=await this.repo.listContent(view==='stories'?'story':'character');}await this.refreshSaves();if(epoch!==this.navEpoch)return;this.render({scrollEnd:view==='adventure' && this.session?.save.events.length>1});},
  async refresh(){await this.refreshAssets();await this.refreshSaves();if(['stories','characters'].includes(this.view))this.libraryItems=await this.repo.listContent(this.view==='stories'?'story':'character');this.render();},
  render({scrollEnd=false}={}){const root=$('#app');if(this.view==='adventure'&&this.session){root.innerHTML=game(this);this.paintStatus();if(scrollEnd)queueMicrotask(()=>{const thread=$('#thread');if(thread)thread.scrollTop=thread.scrollHeight;});}else if(this.view==='stories'||this.view==='characters')root.innerHTML=library(this,this.view==='stories'?'story':'character');else root.innerHTML=home(this);document.title=(this.view==='adventure'&&this.session?this.session.save.title+' · ':'')+'EmberAdventures 3';},
  paintStatus(){const text=$('#save-status-text'),dot=$('#save-status-dot');if(text)text.textContent=this.status.label;if(dot)dot.className='status-dot'+(['generating','saving'].includes(this.status.phase)?' busy':this.status.phase==='error'?' error':'');const holder=$('#stream-holder');if(holder)holder.hidden=!(this.session?.pending && this.status.phase==='generating');for(const b of $$('[data-generation-control]'))b.disabled=!!this.session?.pending;const stop=$('[data-action="stop"]');if(stop)stop.hidden=!(this.session?.pending||this.session?.auto);for(const b of $$('#story-choices button'))b.disabled=!!this.session?.pending || b.title==='Requirements not met';const auto=$('.auto-split');if(auto)auto.classList.toggle('active',!!this.session?.auto);},
  async openEditor(kind,content=null){this.session?.stop();const {openEditor}=await import('./ui/editor.mjs');return openEditor(this,kind,content);},
  async appearance(c){const {appearanceDialog}=await import('./ui/images.mjs');return appearanceDialog(this,c);},
  async gallery(){const {gallery}=await import('./ui/images.mjs');return gallery(this);},
  async generateImage(){const {generateImageDialog}=await import('./ui/images.mjs');return generateImageDialog(this);},
  async backupDialog(){const {backupDialog}=await import('./ui/backups.mjs');return backupDialog(this);},
  async transferDialog(){const {transferDialog}=await import('./ui/transfer.mjs');return transferDialog(this);},
  async speak(text){if(!text)return;const {voice}=await import('./voice.mjs');voice.read(text,this.settings);},
  async addCharacter(c){const {addCharacterToAdventure}=await import('./core/characters.mjs');await addCharacterToAdventure(this,c);},
  async pickImport(){return pickImport(this);}
};
async function pickImport(app){
  const input=document.createElement('input');input.type='file';input.accept='.json,.ea3';input.hidden=true;document.body.append(input);
  input.addEventListener('cancel',()=>input.remove(),{once:true});input.addEventListener('change',async()=>{const file=input.files[0];input.remove();if(!file)return;try{requireThat(file.size<=180*1024*1024,'This file exceeds the 180 MiB import budget. It was not truncated or modified.');const text=await file.text(),data=safeJSON(text);
    if(data.schema==='ea3/envelope/1'){const checked=await app.repo.inspectArchive(data);const n=checked.payload.tables.saves?.length || 0,c=checked.payload.tables.library?.length || 0;if(!await confirmDialog('Import complete archive?',`${n} adventures and ${c} library items were verified. Conflicts will become separate copies.`,{confirm:'Import verified archive'}))return;const result=await app.repo.importArchive(checked);await app.refresh();toast(result.duplicate?'This archive was already imported.':`Imported successfully. ${result.copies} conflict copies created.`);}
    else if(data.schema==='ea3/1'){const errors=validateContent(data);requireThat(!errors.length,errors.join('\n'));const copy=clone(data);if(await app.repo.getContent(copy.kind,copy.id)){copy.id=id(copy.kind);if(copy.kind==='story')copy.title+=' · imported';else copy.name+=' · imported';}delete copy.contentRevision;await app.repo.putContent(copy);await app.navigate(copy.kind==='story'?'stories':'characters');toast('Imported into your library.');}
    else {const {legacyImportDialog}=await import('./ui/migration.mjs');await legacyImportDialog(app,data,{name:file.name,text});}
  }catch(error){onError(error);}}, {once:true});input.click();
}
const actions={
 home:()=>app.navigate('home'),stories:()=>app.navigate('stories'),characters:()=>app.navigate('characters'),'local-library':()=>app.navigate(app.view),
 'continue-save':async()=>{if(app.session)await app.navigate('adventure');else if(app.saves[0])await app.loadSave(app.saves[0].id);},
 'content-detail':t=>contentDetail(app,t.dataset.kind,t.dataset.id),'new-story':()=>app.openEditor('story'),'new-character':()=>app.openEditor('character'),'import-content':()=>app.pickImport(),
 'library-prev':()=>{app.libraryPage=Math.max(0,app.libraryPage-1);$('#library-cards').innerHTML=libraryCards(app,app.view==='stories'?'story':'character');},'library-next':()=>{app.libraryPage++;$('#library-cards').innerHTML=libraryCards(app,app.view==='stories'?'story':'character');},
 profiles:()=>profiles(app),settings:()=>settings(app),saves:()=>saves(app),'data-tools':()=>dataTools(app),about,
 cast:()=>cast(app),'inspect-character':t=>inspectCharacter(app,t.dataset.id),map:()=>worldMap(app),inventory:()=>inventory(app),offers:()=>offers(app),memory:()=>memory(app),bookmarks:()=>bookmarks(app),guidance:()=>guidance(app),
 continue:()=>app.act({kind:'continue'}),choose:t=>app.act({kind:'choice',choiceId:t.dataset.id}),stop:()=>{app.session?.stop();app.paintStatus();},auto:async()=>{if(app.session.auto){app.session.stop();return;}await app.session.runAuto({mode:app.settings.autoMode,limit:app.settings.autoLimit});app.paintStatus();},'auto-settings':()=>autoSettings(app),
 'edit-turn':t=>editTurn(app,+t.dataset.index),'read-turn':t=>app.speak(app.session.save.events[+t.dataset.index]?.narration),
 'regenerate-turn':async t=>{const index=+t.dataset.index;if(index<app.session.save.events.length-1&&!await confirmDialog('Regenerate from here?','Later history and its world changes will be replaced only after the new response saves successfully.',{confirm:'Regenerate'}))return;await app.session.regenerate(index);},
 'delete-turn':async t=>{const index=+t.dataset.index;if(await confirmDialog('Delete from this moment?','This turn and everything after it will be removed. The world state returns to just before this moment.',{confirm:'Delete later history',danger:true})){await app.session.rewind(index);}},
 'earlier-messages':()=>{const el=$('#thread'),old=el.scrollHeight;app.historyLimit+=50;app.render();$('#thread').scrollTop=$('#thread').scrollHeight-old;},
 'toggle-info':()=>{app.mobilePanel=app.mobilePanel==='info'?null:'info';app.render();},'toggle-images':()=>{app.mobilePanel=app.mobilePanel==='images'?null:'images';app.render();},'close-drawer':()=>{app.mobilePanel=null;app.render();},
 gallery:()=>app.gallery(),'generate-image':()=>app.generateImage(),'view-scene':()=>app.gallery(),
 community:async()=>{const {communityDialog}=await import('./ui/community.mjs');await communityDialog(app);},
 workbench:()=>{window.open('/workbench.html','_blank','noopener');}
};
document.addEventListener('click',event=>{const t=event.target.closest('[data-action]');if(!t||t.disabled)return;const fn=actions[t.dataset.action];if(fn){event.preventDefault();Promise.resolve().then(()=>fn(t,event)).catch(onError);}});
document.addEventListener('submit',event=>{if(event.target.id!=='composer-form')return;event.preventDefault();const input=$('#player-input'),text=input.value.trim();if(!text)return;app.draft=text;app.act({kind:'say',text}).then(()=>{app.draft='';const next=$('#player-input');if(next){next.value='';next.focus();}}).catch(onError);});
document.addEventListener('input',event=>{if(event.target.id==='player-input')app.draft=event.target.value;if(event.target.id==='library-search'){app.libraryQuery=event.target.value;app.libraryPage=0;$('#library-cards').innerHTML=libraryCards(app,app.view==='stories'?'story':'character');}});
document.addEventListener('change',event=>{if(event.target.id==='library-sort')app.librarySort=event.target.value;else if(event.target.id==='library-genre')app.libraryGenre=event.target.value;else return;app.libraryPage=0;$('#library-cards').innerHTML=libraryCards(app,app.view==='stories'?'story':'character');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&app.mobilePanel&&!document.querySelector('dialog[open]')){app.mobilePanel=null;app.render();}if(event.target.id==='player-input'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.target.form.requestSubmit();}});
document.addEventListener('error',event=>{const img=event.target;if(img.tagName!=='IMG')return;img.hidden=true;if(img.classList.contains('home-logo')){const fallback=document.createElement('h1');fallback.className='home-title-fallback';fallback.textContent='EmberAdventures';img.after(fallback);}else if(img.parentElement?.classList.contains('card-art-button'))img.parentElement.classList.add('image-fallback');},true);
window.addEventListener('pagehide',()=>{app.session?.stop();if('speechSynthesis'in window)speechSynthesis.cancel();});
async function boot(){
  await app.repo.open();app.repo.onWarning=message=>toast(message,true);
  const existing=await app.repo.get('meta','settings');app.settings={...defaults,...existing};app.applySettings();
  const profiles=await app.repo.get('meta','profiles'),active=await app.repo.get('meta','activeProfile');if(profiles?.length)app.profile=profiles.find(p=>p.id===active)||profiles[0];else await app.persistProfile();
  if(!await app.repo.get('meta','seedVersion')){for(const c of starterCharacters)if(!await app.repo.getContent('character',c.id))await app.repo.putContent(c);if(!await app.repo.getContent('story',starterStory.id))await app.repo.putContent(starterStory);await app.repo.put('meta','seedVersion',1);}
  await app.refreshAssets();await app.refreshSaves();app.render();
  const jobs=await app.repo.all('jobs');if(jobs.some(j=>j.state==='submitted'||j.state==='failed-or-unknown'))toast('A previous generation was interrupted. Your last committed story is intact. Review pending jobs in Workbench; no request was silently resubmitted.',true);
}
boot().catch(error=>{$('#app').innerHTML=`<main id="main" class="boot"><h1>Your stories have not been deleted.</h1><p>${esc(error.message)}</p><div class="row wrap"><button class="button" data-action="reload-app">Try again</button><a class="button primary" href="/recovery.html">Open independent recovery</a></div><small style="margin-top:18px">Keep this browser’s data. Do not clear storage as a troubleshooting step.</small></main>`;});
actions['reload-app']=()=>location.reload();
