import {id,now,requireThat,safeJSON} from '../core/util.mjs';
/** Two alternating complete files. A failed write never replaces the previous valid slot. */
export class FolderBackup {
  constructor(repo,{notify=()=>{}}={}){this.repo=repo;this.notify=notify;this.handle=null;this.pending=null;this.timer=null;this.enabled=false;this.status={state:'disabled'};}
  async init(){this.handle=await this.repo.get('handles','backup');this.enabled=!!this.handle;this.status=await this.repo.get('meta','backupStatus') || {state:this.enabled?'permission-needed':'disabled'};return this;}
  async connect(handle){requireThat(handle?.kind==='directory','Choose a backup folder.');this.handle=handle;this.enabled=true;await this.repo.put('handles','backup',handle);return this.write({requestPermission:true});}
  async disconnect(){clearTimeout(this.timer);if(this.pending)await this.pending.catch(()=>{});this.enabled=false;this.handle=null;await this.repo.remove('handles','backup');await this.setStatus({state:'disabled',lastSuccess:this.status.lastSuccess,message:'Disconnected. Existing backup files were not deleted.'});}
  schedule(){if(!this.enabled)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.write().catch(()=>{}),1800);}
  async setStatus(value){this.status={...this.status,...value};await this.repo.put('meta','backupStatus',this.status);this.notify(this.status);}
  async write({requestPermission=false}={}){if(this.pending){this.again=true;return this.pending;}clearTimeout(this.timer);const operation=()=>this.perform(requestPermission);this.pending=(globalThis.navigator?.locks?navigator.locks.request('ea3-folder-backup',operation):operation()).finally(()=>{this.pending=null;if(this.again){this.again=false;this.schedule();}});return this.pending;}
  async perform(requestPermission){
    requireThat(this.enabled&&this.handle,'Choose a backup folder first.');
    try{
      this.status=await this.repo.get('meta','backupStatus') || this.status;
      let permission=await this.handle.queryPermission({mode:'readwrite'});if(permission!=='granted'&&requestPermission)permission=await this.handle.requestPermission({mode:'readwrite'});requireThat(permission==='granted','Folder permission is required. Open Backups and choose Back up now to grant access.','PERMISSION');
      let installation=await this.repo.get('meta','backupInstallation');if(!installation){installation=id('device');await this.repo.put('meta','backupInstallation',installation);}
      const slot=this.status.slot==='A'?'B':'A',filename=`EA3-${installation}-${slot}.ea3.json`,archive=await this.repo.exportArchive(),text=JSON.stringify(archive);
      await this.setStatus({state:'writing',message:'Writing a complete backup…'});
      const folder=await this.handle.getDirectoryHandle('EmberAdventures3-backups',{create:true}),file=await folder.getFileHandle(filename,{create:true}),writer=await file.createWritable();
      try{await writer.write(text);await writer.close();}catch(error){await writer.abort?.().catch(()=>{});throw error;}
      const saved=safeJSON(await (await file.getFile()).text());await this.repo.inspectArchive(saved);requireThat(saved.hash===archive.hash,'The backup read-back did not match the archive.','CORRUPT');
      await this.setStatus({state:'ready',slot,filename,hash:archive.hash,lastSuccess:now(),message:'Complete backup written and verified.',bytes:new TextEncoder().encode(text).length});return this.status;
    }catch(error){await this.setStatus({state:error.code==='PERMISSION'?'permission-needed':'error',message:error.message});throw error;}
  }
}
