import {RepositoryBase,DATABASE,TABLES,eventKey} from './base.mjs';
import {requireThat} from '../core/util.mjs';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error || new Error('Storage transaction aborted.'));tx.onerror=()=>{};});
export class Repository extends RepositoryBase {
  async open() {
    requireThat(typeof indexedDB!=='undefined','This browser does not provide local database storage. Use another browser or export from recovery.','STORAGE_UNAVAILABLE');
    const opening=indexedDB.open(DATABASE,1);
    opening.onupgradeneeded=()=>{for(const name of TABLES)if(!opening.result.objectStoreNames.contains(name))opening.result.createObjectStore(name,{keyPath:'key'});};
    opening.onblocked=()=>this.onWarning?.('Another tab is blocking a database upgrade. Close the other tab and retry.');
    this.db=await request(opening);this.db.onversionchange=()=>{this.db.close();this.onWarning?.('Database changed in another tab. Reload before continuing.');};return this;
  }
  close(){this.db?.close();}
  async get(store,key) {const tx=this.db.transaction(store,'readonly'),done=complete(tx),value=await request(tx.objectStore(store).get(key));await done;return value?.value;}
  async all(store) {const tx=this.db.transaction(store,'readonly'),done=complete(tx),rows=await request(tx.objectStore(store).getAll());await done;return rows.map(r=>r.value);}
  async put(store,key,value) {await this.atomic([{store,key,value}]);return value;}
  async remove(store,key) {await this.atomic([{store,key,delete:true}]);}
  async atomic(operations,{checks=[],guard=()=>true,expectedStorageRevision=null}={}) {
    const names=[...new Set(['meta',...operations.map(o=>o.store),...checks.map(c=>c.store)])];
    requireThat(names.every(n=>TABLES.includes(n)),'Unknown storage table.');
    const tx=this.db.transaction(names,'readwrite'),done=complete(tx);let failure;
    const pending=[{store:'meta',key:'storageRevision'},...checks];let remaining=pending.length;const values=[];
    const commit=()=>{
      try {
        requireThat(guard(),'The operation was stopped before it could be saved.','CANCELLED');
        const revision=values[0]?.value || 0;
        if(expectedStorageRevision!==null)requireThat(revision===expectedStorageRevision,'Local data changed during import. Retry the import.','CONFLICT');
        checks.forEach((check,i)=>{const value=values[i+1]?.value;requireThat(check.expected===null?value===undefined:value?.[check.field]===check.expected,'Another tab changed this item. Reload or import a separate copy; nothing was overwritten.','CONFLICT');});
        for(const op of operations) {
          const store=tx.objectStore(op.store);
          if(op.delete)store.delete(op.range?IDBKeyRange.bound(op.range.lower,op.range.upper):op.key);
          else store.put({key:op.key,value:op.value});
        }
        tx.objectStore('meta').put({key:'storageRevision',value:revision+1});
      } catch(e) {failure=e;tx.abort();}
    };
    pending.forEach((entry,index)=>{const r=tx.objectStore(entry.store).get(entry.key);r.onsuccess=()=>{values[index]=r.result;if(--remaining===0)commit();};});
    try{await done;}catch(e){throw failure || e;}
  }
  async readSave(saveId) {
    const tx=this.db.transaction(['saves','events'],'readonly'),done=complete(tx);
    const [row,events]=await Promise.all([request(tx.objectStore('saves').get(saveId)),request(tx.objectStore('events').getAll(IDBKeyRange.bound(eventKey(saveId,0),`${saveId}|\uffff`)))]);
    await done;if(!row)return null;
    requireThat(events.length===row.value.eventCount,'This adventure has incomplete history. Export raw recovery data; nothing has been removed.','CORRUPT');
    return {...row.value,events:events.map(r=>r.value)};
  }
  async snapshot(stores=TABLES) {
    const names=[...new Set([...stores,'meta'])],tx=this.db.transaction(names,'readonly'),done=complete(tx),tables={};
    await Promise.all(names.map(async name=>{tables[name]=await request(tx.objectStore(name).getAll());}));await done;
    const revision=tables.meta.find(r=>r.key==='storageRevision')?.value || 0;
    if(!stores.includes('meta'))delete tables.meta;return {revision,tables};
  }
}
