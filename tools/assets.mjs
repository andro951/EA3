/** Optional, content-verified retrieval of the user's public EA1 menu artwork. */
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const entries=JSON.parse(await readFile(resolve(root,'tools/reference-assets.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
let failed=0;
for(const entry of entries){
  const target=resolve(root,entry.path);
  if(!target.startsWith(root+'/public/art/'))throw new Error('Unsafe asset destination.');
  let existing;try{existing=await readFile(target);}catch{}
  if(existing && digest(existing)===entry.sha256){console.log('Verified '+entry.path);continue;}
  let last;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const u=new URL(entry.url);if(u.protocol!=='https:'||u.hostname!=='user.uploads.dev')throw new Error('Unapproved art source.');
      const response=await fetch(u,{signal:AbortSignal.timeout(30000),redirect:'error'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>12*1024*1024)throw new Error('Oversized asset.');chunks.push(chunk);}
      const bytes=Buffer.concat(chunks);if(digest(bytes)!==entry.sha256)throw new Error('Artwork checksum mismatch.');
      await mkdir(dirname(target),{recursive:true});await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);
      console.log('Installed '+entry.path);last=null;break;
    }catch(error){last=error;}
  }
  if(last){failed++;console.error(entry.path+': '+last.message);}
}
if(failed){console.error(`${failed} artwork file(s) unavailable. Existing files were not replaced; the UI has a fallback.`);process.exitCode=1;}
