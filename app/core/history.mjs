/** Compact reversible state changes; this is an undo journal, never alternate timelines. */
import {clone, isRecord, own, validKey, requireThat} from './util.mjs';
export function difference(before, after, path = [], result = []) {
  if (Object.is(before, after)) return result;
  if (isRecord(before) && isRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      requireThat(validKey(key), 'Unsafe state key.');
      if (own(before,key) && own(after,key)) difference(before[key],after[key],[...path,key],result);
      else result.push({path:[...path,key], hadBefore:own(before,key), hadAfter:own(after,key), ...(own(before,key)?{before:clone(before[key])}:{}), ...(own(after,key)?{after:clone(after[key])}:{})});
    }
  } else if (JSON.stringify(before) !== JSON.stringify(after)) result.push({path,hadBefore:true,hadAfter:true,before:clone(before),after:clone(after)});
  return result;
}
export function applyDifference(state, changes, direction = 'after') {
  let next = clone(state);
  for (const change of changes) {
    requireThat(Array.isArray(change.path) && change.path.every(validKey), 'Invalid state path.');
    const present = direction === 'after' ? change.hadAfter : change.hadBefore;
    if (change.path.length === 0) {requireThat(present,'Cannot delete game state.'); next=clone(change[direction]);continue;}
    let target = next;
    for (const segment of change.path.slice(0,-1)) {requireThat(isRecord(target[segment]),'State journal path is missing.');target=target[segment];}
    const key = change.path.at(-1);
    if (present) target[key]=clone(change[direction]);else delete target[key];
  }
  return next;
}
export function stateAt(save, eventCount) {
  requireThat(Number.isInteger(eventCount) && eventCount >= 0 && eventCount <= save.events.length,'Invalid rewind point.');
  if (eventCount > save.events.length / 2) {
    let state = clone(save.state);
    for (let i=save.events.length-1;i>=eventCount;i--) state=applyDifference(state,save.events[i].changes,'before');
    return state;
  }
  let state = clone(save.initial);
  for (let i=0;i<eventCount;i++) state=applyDifference(state,save.events[i].changes);
  return state;
}
