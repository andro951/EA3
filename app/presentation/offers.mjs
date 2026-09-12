import {planAction} from '../core/engine.mjs';
import {meets} from '../core/runtime.mjs';

const label=key=>String(key).replaceAll('-',' ').replaceAll('_',' ');
/** Preview the same validated transaction used on acceptance. Never save the plan. */
export function describeOffer(compiled,save,offer){
  const state=save.state,costs=Object.entries(offer.cost || {}).filter(([,v])=>v>0);
  const pricing=costs.length?'Cost: '+costs.map(([k,v])=>`${v} ${label(k)}`).join(' + '):'No upfront cost';
  const result={pricing,outcomes:[],time:null,remaining:offer.stock>=0?Math.max(0,offer.stock-(state.purchases[offer.id] || 0)):null,available:false,reason:''};
  if(offer.location&&offer.location!==state.location){result.reason='Travel to this offer’s location first.';return result;}
  if(offer.actor&&!state.present.includes(offer.actor)){result.reason='The character offering this service is not here.';return result;}
  if(result.remaining===0){result.reason='This offer has been completed or sold out.';return result;}
  const short=costs.filter(([k,v])=>(state.resources[k] || 0)<v);
  if(short.length){result.reason='Need '+short.map(([k,v])=>`${v-(state.resources[k] || 0)} more ${label(k)}`).join(' and ')+'.';return result;}
  if(!meets(state,offer.requires)){result.reason='Story or inventory requirements are not met yet.';return result;}
  try{
    const plan=planAction(compiled,save,{kind:'offer',offerId:offer.id}),next=plan.state;
    result.available=true;result.time=next.clock-state.clock;
    for(const key of new Set([...Object.keys(state.resources),...Object.keys(next.resources)])){
      const net=(next.resources[key] || 0)-(state.resources[key] || 0);
      // Fees are already disclosed separately. Show the gross return after paying them.
      const earned=net+(offer.cost?.[key] || 0);
      if(earned>0)result.outcomes.push(`Pays ${earned} ${label(key)}`);
      else if(earned<0)result.outcomes.push(`Uses ${-earned} additional ${label(key)}`);
    }
    for(const key of new Set([...Object.keys(state.inventory),...Object.keys(next.inventory)])){
      const amount=(next.inventory[key] || 0)-(state.inventory[key] || 0),name=compiled.items.get(key)?.name || label(key);
      if(amount)result.outcomes.push(`${amount>0?'Receive':'Use'} ${Math.abs(amount)} × ${name}`);
    }
    for(const key of next.party.filter(k=>!state.party.includes(k)))result.outcomes.push(`${save.characters.find(c=>c.id===key)?.name || label(key)} joins your party`);
    const memories=next.memory.length-state.memory.length;if(memories>0)result.outcomes.push(`Records ${memories} ${memories===1?'memory':'memories'}`);
    const flags=Object.keys(next.flags).filter(k=>next.flags[k]!==state.flags[k]);
    if(flags.length)result.outcomes.push('Updates: '+flags.map(label).join(', '));
  }catch(error){result.reason=error.message;}
  return result;
}
