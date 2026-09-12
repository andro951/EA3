import {readRaster} from '../media/raster.mjs';
import {now,requireThat} from '../core/util.mjs';
import {$,esc,button,image,modal,toast,onError,empty} from './dom.mjs';

/** Selects owned artwork for a draft without touching the current adventure. */
export async function artworkPicker(app,{owner='library:images',onSelect=()=>{},current=''}={}){
  let selected=current.replace(/^asset:/,''),busy=false,closed=false;
  const d=modal('Artwork for this draft','',{
    wide:true,klass:'gallery-dialog',subtitle:'Keep the original. Pick what belongs to this character or story.',
    footer:button('artwork-remove','No artwork','close')+button('artwork-use','Use selected artwork','check','primary'),
    onClose:()=>{closed=true;}
  });
  async function render(){
    await app.refreshAssets();if(closed)return;
    const all=[...app.assetCache.values()].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    const active=app.assetCache.get(selected);
    d.body.innerHTML=`<div class="gallery-layout"><section class="gallery-preview">${active?image(active.data,active.label||'Selected artwork','gallery-large'):empty('Give your draft a face','Select an owned image, or upload a local PNG, JPEG or WebP.')}<p class="editor-help">The draft changes when you confirm. Your library version changes only when you choose Save to library.</p><label class="field"><span>Upload artwork</span><input id="artwork-file" type="file" accept="image/png,image/jpeg,image/webp"><small>Original files stay untouched. Images larger than 4096 px on their longest edge are resized in a separate working copy.</small></label><p id="artwork-status" role="status"></p></section><section><div class="eyebrow">${all.length} owned images</div><div class="gallery-grid">${all.map(a=>`<button type="button" class="gallery-thumb ${a.id===selected?'selected':''}" data-action="artwork-select" data-id="${esc(a.id)}" aria-pressed="${a.id===selected}" aria-label="Select ${esc(a.label||'image')}">${image(a.data,a.label||'Artwork','','loading="lazy"')}<span>${esc(a.label||'Your image')}</span></button>`).join('')}</div></section></div>`;
    $('[data-action="artwork-use"]',d.element).disabled=!active||busy;
  }
  d.on('change','#artwork-file',async(_e,input)=>{
    const file=input.files?.[0];if(!file||busy)return;busy=true;input.disabled=true;
    try{const raster=await readRaster(file),asset=await app.repo.putAsset({...raster,label:file.name,provider:'upload',createdAt:now(),links:{[owner]:true}});selected=asset.id;await render();}
    catch(error){onError(error);}finally{busy=false;if(!closed){input.disabled=false;$('[data-action="artwork-use"]',d.element).disabled=!app.assetCache.has(selected);}}
  });
  d.on('click','[data-action="artwork-select"]',(_e,t)=>{selected=t.dataset.id;render().catch(onError);});
  async function apply(asset){if(busy)return;busy=true;try{await onSelect(asset);d.close();toast(asset?'Artwork selected for this draft.':'Artwork removed from this draft.');}catch(error){onError(error);busy=false;}}
  d.on('click','[data-action="artwork-use"]',()=>{const asset=app.assetCache.get(selected);if(asset)apply(asset);});
  d.on('click','[data-action="artwork-remove"]',()=>apply(null));
  await render();return d;
}
