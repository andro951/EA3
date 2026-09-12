import {requireThat} from '../core/util.mjs';
import {availableOffers} from '../core/runtime.mjs';
import {describeOffer} from '../presentation/offers.mjs';
import {esc,button,badge,empty,modal,onError} from './dom.mjs';
import {icon} from './icons.mjs';

export function offers(app){
  requireThat(app.session,'Begin or load an adventure first.');
  const session=app.session,compiled=session.compiled,save=session.save,state=save.state;
  const rows=availableOffers(compiled,state).filter(o=>!o.location||o.location===state.location);
  const d=modal('Shops, jobs & services',`<div class="offer-location row between"><p>${esc(compiled.locations.get(state.location)?.name || '')}</p><div class="row wrap">${Object.entries(state.resources).map(([k,v])=>badge(`${v} ${k}`,'warm')).join('')}</div></div><div class="stack">${rows.map(o=>{
    const p=describeOffer(compiled,save,o);
    return `<article class="list-row offer-row" data-offer-id="${esc(o.id)}"><span class="inventory-icon">${icon(o.kind==='job'?'compass':o.kind==='service'?'users':'bag')}</span><div class="grow"><div class="row wrap offer-title"><h3>${esc(o.name)}</h3>${badge(o.kind)}</div>${o.description?`<p>${esc(o.description)}</p>`:''}<div class="offer-pricing">${esc(p.pricing)}${p.time!==null?`<span>${p.time} ${p.time===1?'story-time unit':'story-time units'}</span>`:''}${p.remaining!==null?`<span>${p.remaining} available</span>`:''}</div>${p.outcomes.length?`<ul class="offer-outcomes">${p.outcomes.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}${p.reason?`<p class="offer-requirement">${esc(p.reason)}</p>`:''}</div>${button('take-offer',o.kind==='job'?'Take job':o.kind==='recruitment'?'Invite':'Choose','arrow','small',`data-id="${esc(o.id)}" ${!p.available||session.pending?'disabled':''}`)}</article>`;
  }).join('') || empty('Nothing on offer here','Try another location. The map shows where you can travel.')}</div>`,{wide:true,subtitle:'See the cost, return and time before accepting. Changes save together—or not at all.'});
  d.on('click','[data-action="take-offer"]',async(_e,t)=>{try{requireThat(app.session===session,'The active adventure changed. Open its offers again.');t.disabled=true;await app.act({kind:'offer',offerId:t.dataset.id});d.close();}catch(error){onError(error);t.disabled=false;}});
  return d;
}
