import {DemoNarrator} from './demo.mjs';
import {HttpProvider} from './http.mjs';
import {HostBridge,PerchanceProvider} from './bridge.mjs';
import {requireThat} from '../core/util.mjs';
let bridge;
function host(settings){return bridge ||= new HostBridge({origin:settings.hostOrigin || (typeof location!=='undefined'?new URLSearchParams(location.search).get('hostOrigin'):null) || 'https://perchance.org'});}
function preferences(provider,settings){const generate=provider.generate.bind(provider);provider.generate=(request,options)=>generate({...request,guidance:String(settings.guidance || '')},options);return provider;}
export function makeTextProvider(settings={}){
  if(!settings.textProvider||settings.textProvider==='demo')return new DemoNarrator();
  if(settings.textProvider==='http')return preferences(new HttpProvider('text'),settings);
  if(settings.textProvider==='perchance')return preferences(new PerchanceProvider('text',host(settings)),settings);
  throw new Error('Unknown text provider. Your save was not changed.');
}
export function makeImageProvider(settings={}){
  if(settings.imageProvider==='http')return new HttpProvider('image');
  if(settings.imageProvider==='perchance')return new PerchanceProvider('image',host(settings));
  throw new Error('Choose an image provider in Settings, or upload an existing image.');
}
export function makeAuthorProvider(settings={}){
  requireThat(settings.textProvider&&settings.textProvider!=='demo','AI assistance requires a configured server or Perchance provider. Manual creation and local templates work without one.');
  return settings.textProvider==='http'?new HttpProvider('author'):new PerchanceProvider('author',host(settings));
}
