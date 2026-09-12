import {escapeHTML,safeImage} from '../core/util.mjs';
import {icon} from './icons.mjs';
export const $=(query,root=document)=>root.querySelector(query);
export const $$=(query,root=document)=>[...root.querySelectorAll(query)];
export const esc=escapeHTML;
export const button=(action,label,ico,cls='',extra='')=>`<button type="button" class="button ${cls}" data-action="${esc(action)}" ${extra}>${ico?icon(ico):''}<span>${esc(label)}</span></button>`;
export const ibutton=(action,label,ico,extra='')=>`<button type="button" class="icon-button" data-action="${esc(action)}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(ico)}</button>`;
export const badge=(text,cls='')=>`<span class="badge ${cls}">${esc(text)}</span>`;
export const paragraphs=text=>String(text || '').split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
export function image(source,alt='',cls='',extra=''){
  const url=safeImage(source);
  return url?`<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" decoding="async" ${extra}>`:`<div class="image-fallback ${cls}" role="img" aria-label="${esc(alt || 'No image selected')}">${icon('flame')}</div>`;
}
export function field(label,name,value='',{type='text',placeholder='',help='',required=false,rows=3,options=null,extra=''}={}) {
  const input=options?`<select name="${esc(name)}" ${extra}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`:type==='textarea'?`<textarea name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}" ${required?'required':''} ${extra}>${esc(value)}</textarea>`:`<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required?'required':''} ${extra}>`;
  return `<label class="field"><span>${esc(label)}</span>${input}${help?`<small>${esc(help)}</small>`:''}</label>`;
}
export function empty(title,description,action=''){return `<div class="empty-state">${icon('compass')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;}
export function toast(message,error=false){
  const region=$('#toasts');if(!region)return;const el=document.createElement('div');el.className='toast'+(error?' error':'');el.setAttribute('role',error?'alert':'status');el.textContent=message;region.append(el);setTimeout(()=>el.remove(),error?12000:5500);
}
const stack=[];
export function modal(title,body,{wide=false,subtitle='',footer='',onClose,klass=''}={}){
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className=`dialog ${wide?'wide':''} ${klass}`;
  dialog.innerHTML=`<header class="dialog-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${ibutton('dialog-close','Close dialog','close')}</header><div class="dialog-body">${body}</div>${footer?`<footer class="dialog-foot">${footer}</footer>`:''}`;
  let closed=false;const api={element:dialog,body:$('.dialog-body',dialog),close:()=>{if(closed)return;closed=true;dialog.close();dialog.remove();const i=stack.indexOf(api);if(i>=0)stack.splice(i,1);onClose?.();if(previous?.isConnected)previous.focus();},on:(event,selector,fn)=>{dialog.addEventListener(event,e=>{const t=e.target.closest(selector);if(t && dialog.contains(t))fn(e,t,api);});return api;}};
  dialog.addEventListener('cancel',e=>{e.preventDefault();api.close();});
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-action="dialog-close"]'))api.close();if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)api.close();}});
  document.body.append(dialog);stack.push(api);dialog.showModal();return api;
}
export function closeDialogs(){for(const d of [...stack].reverse())d.close();}
export function confirmDialog(title,message,{confirm='Continue',danger=false}={}){
  return new Promise(resolve=>{let answer=false;const d=modal(title,`<p class="dialog-message">${esc(message)}</p>`,{footer:button('cancel','Cancel',null)+button('confirm',confirm,danger?'trash':'check',danger?'danger':'primary'),onClose:()=>resolve(answer)});d.on('click','[data-action="cancel"]',()=>d.close());d.on('click','[data-action="confirm"]',()=>{answer=true;d.close();});});
}
export function readForm(form){return Object.fromEntries(new FormData(form));}
export function formatDate(value){try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return 'Unknown date';}}
export function onError(error){if(error?.name!=='AbortError')toast(error?.message || String(error),true);}
