/** Explicit test double. It does not establish native IndexedDB acceptance. */
import {RepositoryBase,TABLES,eventKey} from '../../app/storage/base.mjs';
import {clone,requireThat} from '../../app/core/util.mjs';
export class MemoryRepository extends RepositoryBase {
  constructor(initial){super();this.tables=Object.fromEntries(TABLES.map(t=>[t,new Map(initial?.[t]?.map(r=>[r.key,clone(r.value)]) || [])]));this.failNext=null;}
  async open(){return this;}
  close(){}
  async get(table,key){return clone(this.tables[table].get(key));}
  async all(table){return [...this.tables[table].values()].map(clone);}
  async put(store,key,value){await this.atomic([{store,key,value}]);return value;}
  async remove(store,key){await this.atomic([{store,key,delete:true}]);}
  async atomic(ops,{checks=[],guard=()=>true,expectedStorageRevision=null}={}) {
    if(this.failNext){const e=this.failNext;this.failNext=null;throw e;}
    requireThat(guard(),'The operation was stopped before it could be saved.','CANCELLED');
    const revision=this.tables.meta.get('storageRevision') || 0;
    if(expectedStorageRevision!==null)requireThat(revision===expectedStorageRevision,'Local data changed during import.','CONFLICT');
    for(const c of checks){const value=this.tables[c.store].get(c.key);requireThat(c.expected===null?value===undefined:value?.[c.field]===c.expected,'Another tab changed this item.','CONFLICT');}
    const next=Object.fromEntries(TABLES.map(t=>[t,new Map(this.tables[t])]));
    for(const o of ops){const table=next[o.store];if(o.delete){if(o.range)for(const key of table.keys()){if(key>=o.range.lower&&key<=o.range.upper)table.delete(key);}else table.delete(o.key);}else table.set(o.key,clone(o.value));}
    next.meta.set('storageRevision',revision+1);this.tables=next;
  }
  async readSave(saveId){const head=await this.get('saves',saveId);if(!head)return null;const rows=[...this.tables.events].filter(([k])=>k.startsWith(saveId+'|')).sort(([a],[b])=>a.localeCompare(b));requireThat(rows.length===head.eventCount,'Incomplete history.');return {...head,events:rows.map(([,v])=>clone(v))};}
  async snapshot(stores=TABLES){return {revision:this.tables.meta.get('storageRevision')||0,tables:Object.fromEntries(stores.map(t=>[t,[...this.tables[t]].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,value:clone(value)}))]))};}
}
export {MemoryRepository as Repository};
