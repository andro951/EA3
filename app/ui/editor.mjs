import {DraftModel,newContent,defaultEffect,defaultCondition,valueAt,reviewProposal} from '../authoring/model.mjs';
import {saveDraftSnapshot} from '../authoring/save.mjs';
import {artworkPicker} from './artwork-picker.mjs';
import {GraphView} from './graph-view.mjs';
import {autoLayout} from '../authoring/graph.mjs';
import {nodeFields,detailsFields,worldFields,offersFields,stateFields,castFields,appearanceFields,pathAttr} from './editor-fields.mjs';
import {clone,id,now,safeJSON,requireThat,validKey,download} from '../core/util.mjs';
import {makeAuthorProvider} from '../providers/registry.mjs';
import {parseDraft} from '../providers/prompts.mjs';
import {storySetup} from './library-dialogs.mjs';
import {$,$$,esc,button,field,modal,confirmDialog,toast,onError,readForm} from './dom.mjs';

export async function openEditor(app,kind,content=null){
  const base=content || newContent(kind),draftKey=`editor:${kind}:${content?.id || 'new'}`;let source=base,usingRecovered=false;
  const recovered=await app.repo.get('drafts',draftKey);
  if(recovered && await confirmDialog('Recover your draft?','An unfinished draft is stored on this device. Recover it without changing the published or library version?',{confirm:'Recover draft'})){source=recovered.value;usingRecovered=true;}
  let expected=usingRecovered?recovered.baseRevision:content?.contentRevision || null,selected=source.start,tab=kind==='story'?'graph':'details',graph=null,graphCollapsed=false,closed=false,timer,saveQueue=Promise.resolve(),lastPersisted=-1,request=null,saving=false;
  const characters=await app.repo.listContent('character');
  const persist=()=>{clearTimeout(timer);const revision=model.revision,value=clone(model.value),baseRevision=expected;saveQueue=saveQueue.catch(()=>{}).then(async()=>{if(revision===lastPersisted)return;await app.repo.put('drafts',draftKey,{value,baseRevision,updatedAt:now()});lastPersisted=revision;if(!closed&&revision===model.revision)status('Draft saved on this device');}).catch(e=>{status('Draft could not be saved');onError(e);});return saveQueue;};
  const model=new DraftModel(source,{onChange:()=>{status('Unsaved draft changes');clearTimeout(timer);timer=setTimeout(persist,350);}});
  if(usingRecovered)model.savedRevision=-1;
  const tabs=kind==='story'?[['graph','Story graph'],['details','Details'],['cast','Cast'],['world','World & items'],['offers','Shops & jobs'],['state','State & events'],['advanced','Advanced']]:[['details','Character'],['appearance','Appearance & wardrobe'],['advanced','Advanced']];
  const d=modal(kind==='story'?'Story Editor':'Character Editor',`<div class="editor-toolbar">${button('ed-save','Save to library','check','primary')}${button('ed-play','Playtest','play')}${button('ed-undo','Undo','back')}${button('ed-redo','Redo','forward')}${button('ed-artwork','Artwork','image')}${button('ed-assist','AI suggestions','spark')}${button('ed-export','Export','download')}<span class="spacer"></span><span class="editor-status" role="status">Draft ready</span></div><nav class="editor-tabs" aria-label="Editor sections">${tabs.map(([v,label])=>`<button type="button" class="editor-tab" data-ed-tab="${v}">${label}</button>`).join('')}</nav><ul class="editor-error-list" hidden role="alert"></ul><div class="editor-content"></div>`,{klass:'editor-dialog',subtitle:'Create freely. Review and validate before saving.',wide:true,onClose:()=>{closed=true;request?.abort();graph?.destroy();persist();}});
  function status(text){if(!closed){$('.editor-status',d.element).textContent=text;const a=$('[data-action="ed-undo"]',d.element),b=$('[data-action="ed-redo"]',d.element);a.disabled=!model.past.length;b.disabled=!model.future.length;}}
  function showErrors(errors){const el=$('.editor-error-list',d.element);el.hidden=!errors.length;el.innerHTML=errors.map(e=>`<li>${esc(e)}</li>`).join('');return errors.length===0;}
  function set(path,value){for(let i=1;i<path.length;i++){if(valueAt(model.value,path.slice(0,i))===undefined)model.set(path.slice(0,i),typeof path[i]==='number'?[]:{});}model.set(path,value);}
  function inspector(){const el=$('.editor-inspector',d.element);if(el)el.innerHTML=nodeFields(model.value,selected);}
  function render(){const oldView=graph?{...graph.view}:null;graph?.destroy();graph=null;const area=$('.editor-content',d.element);$$('[data-ed-tab]',d.element).forEach(b=>{b.classList.toggle('active',b.dataset.edTab===tab);b.setAttribute('aria-current',b.dataset.edTab===tab?'page':'false');});
    if(tab==='graph'){
      if(!model.value.nodes.some(n=>n.id===selected))selected=model.value.start;
      area.innerHTML=`<div class="editor-graph-shell ${graphCollapsed?'graph-collapsed':''}"><section class="graph-column" style="display:flex;flex-direction:column;min-width:0;min-height:0"><div class="editor-toolbar">${button('ed-add-node','Add moment','plus','small')}${button('ed-fit','Fit','map','small')}${button('ed-layout','Arrange','layers','small')}${button('ed-toggle-graph',graphCollapsed?'Show graph':'Hide graph','map','small editor-mobile-button')}<div class="editor-search"><input id="editor-search" type="search" placeholder="Find a moment…" aria-label="Find a story moment"><select id="editor-results" aria-label="Search results"><option value="">Select a moment</option></select></div></div><div class="graph-workspace" style="flex:1"></div></section><aside class="editor-inspector"></aside></div>`;
      graph=new GraphView($('.graph-workspace',d.element),model.value,{selected,select:key=>{selected=key;inspector();},move:(key,p)=>{set(['editor','positions',key],p);},connect:async(from,to)=>{if(await confirmDialog('Connect story moments?','Use this connection for Continue? Existing choices remain unchanged.',{confirm:'Connect'})){set(['nodes',model.value.nodes.findIndex(n=>n.id===from),'next'],to);render();}}});if(oldView)Object.assign(graph.view,oldView);inspector();requestAnimationFrame(()=>{graph?.draw();});
    }else{const c=model.value;area.innerHTML=`<div class="editor-form">${tab==='details'?detailsFields(c,v=>app.imageSource(v)):tab==='world'?worldFields(c):tab==='offers'?offersFields(c):tab==='state'?stateFields(c):tab==='cast'?castFields(c,characters):tab==='appearance'?appearanceFields(c):`<h3>Complete definition</h3><p class="editor-help">Advanced editing preserves fields that are not exposed in the forms. Applying invalid data is refused. Export always preserves the current draft.</p><textarea id="editor-json" class="editor-code" aria-label="Complete JSON definition">${esc(JSON.stringify(c,null,2))}</textarea><div class="row wrap" style="margin-top:15px">${button('ed-apply-json','Validate & apply JSON','check')}${button('ed-discard','Discard saved draft','trash','danger')}</div>`}</div>`;}
    status(model.dirty?'Draft changes':'Ready');
  }
  async function save(){
    requireThat(!saving,'A library save is already in progress.');
    if(!showErrors(model.errors()))return false;
    saving=true;const button=$('[data-action="ed-save"]',d.element);button.disabled=true;
    try{
      clearTimeout(timer);await persist();
      const result=await saveDraftSnapshot(model,app.repo,expected);expected=result.stored.contentRevision;
      if(result.unchanged){await app.repo.remove('drafts',draftKey);lastPersisted=result.revision;}
      if(model.revision===result.revision)status('Saved to your library');
      else{lastPersisted=-1;await persist();status('Earlier snapshot saved · newer draft changes remain');}
      toast('Saved to your library. Existing adventures keep their frozen story.');await app.refresh();return true;
    }finally{saving=false;button.disabled=false;}
  }
  function inputChange(e,t){try{const path=safeJSON(t.dataset.path);let value=t.value;if(t.dataset.castRole){const key=path[1];model.transaction('Change cast',()=>{set(['cast'],[...(model.value.cast || []).filter(k=>k!==key),...(value==='opening'?[key]:[])]);set(['backgroundCast'],[...(model.value.backgroundCast || []).filter(k=>k!==key),...(value==='background'?[key]:[])]);});return;}
    if(t.dataset.ruleKind){const parent=path.slice(0,-1);set(parent,t.dataset.ruleKind==='effect'?defaultEffect(value):defaultCondition(value));render();return;}
    if(t.dataset.format==='number'){value=value===''?undefined:Number(value);requireThat(value===undefined||Number.isFinite(value),'Enter a finite number.');}
    if(t.dataset.format==='boolean')value=value==='true';if(t.dataset.format==='literal'){if(value==='true'||value==='false')value=value==='true';else if(value.trim()!==''&&Number.isFinite(Number(value)))value=Number(value);}
    if(t.dataset.format==='list'){value=[...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))];if(path.length>1 && path.at(-1)==='cast'&&!value.length)value=undefined;}
    set(path,value);if(graph && ['title','text','next','ending'].includes(path.at(-1)))graph.update(model.value);
  }catch(error){onError(error);}}
  d.on('change','[data-path]',inputChange);
  d.on('input','input[data-path],textarea[data-path]',(e,t)=>{if(t.dataset.format!=='list')inputChange(e,t);});
  d.on('input','#editor-search',(e,t)=>{const found=graph.index.search(t.value);$('#editor-results',d.element).innerHTML='<option value="">'+found.total+' matching moments</option>'+found.nodes.map(n=>`<option value="${esc(n.id)}">${esc(n.title || n.id)}</option>`).join('');});
  d.on('change','#editor-results',(e,t)=>{if(t.value){selected=t.value;graph.focus(selected);inspector();}});
  d.on('click','[data-ed-tab]',(e,t)=>{tab=t.dataset.edTab;render();});
  const factories={effect:()=>defaultEffect(),condition:()=>defaultCondition(),choice:()=>({id:id('choice'),label:'A new choice',effects:[],requires:[]}),location:()=>({id:id('location'),name:'New location',description:'',links:[],discovered:false}),item:()=>({id:id('item'),name:'New item',description:''}),offer:()=>({id:id('offer'),name:'New offer',kind:'shop',cost:{},effects:[],requires:[]}),development:()=>({id:id('event'),at:1,text:'Something changes in the world.',effects:[]}),outfit:()=>({id:id('outfit'),name:'New outfit',description:'',rating:'sfw'})};
  const actions={
    'ed-save':save,'ed-artwork':()=>artworkPicker(app,{owner:'draft:'+draftKey,current:model.value.image||'',onSelect:asset=>{set(['image'],asset?'asset:'+asset.id:'');render();}}),'ed-export':()=>download(`${model.value.id}.ea3.json`,model.value),
    'ed-play':async()=>{if(!showErrors(model.errors()))return;await persist();if(kind==='story')await storySetup(app,clone(model.value));else{const {characterStart}=await import('./library-dialogs.mjs');await characterStart(app,clone(model.value));}},
    'ed-undo':()=>{model.undo();render();},'ed-redo':()=>{model.redo();render();},'ed-fit':()=>graph?.fit(),'ed-toggle-graph':()=>{graphCollapsed=!graphCollapsed;render();},
    'ed-add-node':()=>{selected=model.addNode();render();graph.focus(selected);},'ed-duplicate-node':()=>{selected=model.duplicateNode(selected);render();graph.focus(selected);},
    'ed-delete-node':async()=>{if(await confirmDialog('Delete story moment?','Incoming connections will be removed too. Editor Undo can restore this change.',{confirm:'Delete moment',danger:true})){model.removeNode(selected);selected=model.value.start;render();}},
    'ed-opening':t=>{set(['start'],t.dataset.id);render();},'ed-layout':()=>{set(['editor','positions'],autoLayout(model.value));render();graph.fit();},
    'ed-add':t=>{const path=safeJSON(t.dataset.path),rows=valueAt(model.value,path);if(!Array.isArray(rows))set(path,[]);model.splice(path,valueAt(model.value,path).length,0,factories[t.dataset.kind]());render();},
    'ed-remove':t=>{const path=safeJSON(t.dataset.path);model.splice(path.slice(0,-1),path.at(-1),1);render();},
    'ed-map-remove':t=>{set(safeJSON(t.dataset.path),undefined);render();},
    'ed-map-add':t=>mapAdd(safeJSON(t.dataset.path),t.dataset.format),
    'ed-group-add':()=>mapAdd(['effectGroups'],'group'),
    'ed-discard':async()=>{if(await confirmDialog('Discard this draft?','The library version will not be changed.',{confirm:'Discard draft',danger:true})){clearTimeout(timer);await saveQueue;model.value=clone(base);model.markSaved();lastPersisted=model.revision;await app.repo.remove('drafts',draftKey);d.close();}},
    'ed-apply-json':()=>{const candidate=safeJSON($('#editor-json',d.element).value),review=reviewProposal(model.value,candidate);if(showErrors(review.errors)){model.set([],candidate);render();toast('Validated definition applied to the draft.');}},
    'ed-assist':()=>assist()
  };
  async function mapAdd(path,format){const p=modal(format==='group'?'New effect group':'New entry',field('Stable key','key','',{required:true})+field('Initial value','value',format==='number'?'0':'true'),{footer:button('map-create','Add','plus','primary')});p.on('click','[data-action="map-create"]',()=>{try{const key=$('[name="key"]',p.element).value.trim();requireThat(validKey(key),'Choose a valid stable key.');requireThat(valueAt(model.value,[...path,key])===undefined,'That key already exists.');const input=$('[name="value"]',p.element).value;let v=format==='group'?[]:format==='number'?Number(input):input==='true'?true:input==='false'?false:input;requireThat(format!=='number'||Number.isFinite(v),'Enter a number.');set([...path,key],v);p.close();render();}catch(e){onError(e);}});}
  async function assist(){const a=modal('AI authoring suggestions',field('What should change?','instruction','',{type:'textarea',rows:4,help:'The AI proposes a complete draft. You review changes before anything is applied.'})+'<div id="proposal-status" role="status"></div>',{wide:true,footer:button('proposal-request','Generate proposal','spark','primary')+button('proposal-stop','Stop','stop')});let proposal=null,baseRevision=model.revision;const abort=()=>request?.abort();a.on('click','[data-action="proposal-stop"]',abort);a.element.addEventListener('close',abort,{once:true});
    a.on('click','[data-action="proposal-request"]',async(e,t)=>{try{requireThat(!request,'An authoring request is already running.');const provider=makeAuthorProvider(app.settings);request=new AbortController();t.disabled=true;baseRevision=model.revision;$('#proposal-status',a.element).textContent='Generating a reviewable draft…';const result=await provider.generate({kind,draft:clone(model.value),instruction:$('[name="instruction"]',a.element).value,requestId:id('author')},{signal:request.signal});const candidate=result.draft || parseDraft(result.text,kind);proposal=reviewProposal(model.value,candidate);$('#proposal-status',a.element).innerHTML=`<p>${proposal.changes.length} proposed changes</p>${proposal.errors.map(x=>`<p class="inline-error">${esc(x)}</p>`).join('')}<pre class="code-block">${esc(proposal.changes.map(c=>`${c.path}\nBefore: ${JSON.stringify(c.before)}\nAfter: ${JSON.stringify(c.after)}`).join('\n\n'))}</pre>${button('proposal-apply','Apply reviewed proposal','check','primary',proposal.errors.length?'disabled':'')}`;}catch(error){onError(error);$('#proposal-status',a.element).textContent=error.message;}finally{request=null;t.disabled=false;}});
    a.on('click','[data-action="proposal-apply"]',()=>{try{requireThat(model.revision===baseRevision,'The draft changed while this proposal was generated. Generate a new proposal.');requireThat(proposal&&!proposal.errors.length,'The proposal has validation errors.');model.set([],proposal.draft);a.close();render();}catch(e){onError(e);}});
  }
  d.on('click','[data-action]',(e,t)=>{const fn=actions[t.dataset.action];if(!fn)return;e.preventDefault();Promise.resolve().then(()=>fn(t)).catch(onError);});
  d.element.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save().catch(onError);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();e.shiftKey?model.redo():model.undo();render();}});
  render();return d;
}
