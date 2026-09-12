import {CommunityClient} from '../community.mjs';
import {$,field,modal,button,esc} from './dom.mjs';
export function communityClient(app){return app.community ||= new CommunityClient();}
export async function signInDialog(client){
  if(client.user)return true;
  return new Promise(resolve=>{
    let accepted=false,register=false;
    const d=modal('Community account',`<p class="editor-help">An account is only needed to publish, rate or report on this instance. Local play remains account-free.</p><form id="community-auth" class="stack">${field('Username','username','',{required:true,extra:'autocomplete="username" minlength="3" maxlength="40"'})}${field('Password','password','',{type:'password',required:true,extra:'autocomplete="current-password" minlength="12" maxlength="1024"'})}<p id="auth-error" role="alert" class="inline-error" hidden></p><div class="row wrap"><button type="submit" class="button primary" id="auth-submit">Sign in</button>${button('auth-mode','Create an account',null)}</div></form>`,{onClose:()=>resolve(accepted)});
    d.on('click','[data-action="auth-mode"]',(_e,t)=>{register=!register;$('#auth-submit',d.element).textContent=register?'Create account':'Sign in';t.querySelector('span').textContent=register?'Use existing account':'Create an account';$('[name="password"]',d.element).autocomplete=register?'new-password':'current-password';});
    d.on('submit','#community-auth',async e=>{e.preventDefault();const submit=$('#auth-submit',d.element);submit.disabled=true;try{const f=new FormData(e.target);await client.signIn(String(f.get('username')).trim(),String(f.get('password')),register);e.target.reset();accepted=true;d.close();}catch(error){const el=$('#auth-error',d.element);el.hidden=false;el.textContent=error.message;submit.disabled=false;}});
  });
}
