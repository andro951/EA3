import {requireThat} from '../core/util.mjs';
export async function readRaster(file,{maxDimension=4096}={}){
  requireThat(file instanceof Blob && file.size>0 && file.size<=40*1024*1024,'Choose a PNG, JPEG or WebP image no larger than 40 MiB.');
  requireThat(['image/png','image/jpeg','image/webp'].includes(file.type),'Only PNG, JPEG and WebP images are supported.');
  const bitmap=await createImageBitmap(file);try{
    requireThat(bitmap.width*bitmap.height<=64000000,'The image exceeds the 64-megapixel decode budget.');
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return {data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,originalWidth:bitmap.width,originalHeight:bitmap.height,resized:scale<1};
  }finally{bitmap.close();}
}
export function dataBlob(data){requireThat(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data),'Invalid owned raster image.');const [prefix,encoded]=data.split(',');return new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:prefix.slice(5,prefix.indexOf(';'))});}
export function cropRect(width,height,{ratio=width/height,zoom=1,x=.5,y=.5}={}){
  requireThat([width,height,ratio,zoom,x,y].every(Number.isFinite)&&width>0&&height>0&&ratio>0&&zoom>=1&&zoom<=8&&x>=0&&x<=1&&y>=0&&y<=1,'Invalid crop dimensions.');
  const w=Math.min(width,height*ratio)/zoom,h=w/ratio;return{x:(width-w)*x,y:(height-h)*y,width:w,height:h};
}
export async function cropRaster(data,options){const bitmap=await createImageBitmap(dataBlob(data));try{const r=cropRect(bitmap.width,bitmap.height,options),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(r.width));canvas.height=Math.max(1,Math.round(r.height));canvas.getContext('2d').drawImage(bitmap,r.x,r.y,r.width,r.height,0,0,canvas.width,canvas.height);return{data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};}finally{bitmap.close();}}
export function containsAsset(value,key){const stack=[value];while(stack.length){const v=stack.pop();if(v===key||v==='asset:'+key)return true;if(v&&typeof v==='object')for(const child of Object.values(v))stack.push(child);}return false;}
export async function removeUnusedAsset(repo,key){const snapshot=await repo.snapshot(['saves','events','library','definitions','drafts']);for(const [table,rows]of Object.entries(snapshot.tables))for(const row of rows)requireThat(!containsAsset(row.value,key),`This image is still used by ${table==='events'?'story history':table}. Remove that reference before deleting the image.`);await repo.atomic([{store:'assets',key,delete:true}],{expectedStorageRevision:snapshot.revision});}
