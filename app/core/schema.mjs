import {isRecord, validKey, requireThat, clone} from './util.mjs';
export const SCHEMA = 'ea3/1';
export const SAVE_SCHEMA = 'ea3/save/1';
export const EFFECTS = ['resource','item','flag','relationship','memory','discover','travel','presence','recruit','outfit','unlockOutfit','equip','clock','ending','bundle'];
export const CONDITIONS = ['resource','item','flag','relationship','clock','visited','member','completed','all','any','not'];
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' && value.trim().length > 0;
function common(value, errors) {
  if (value.schema !== SCHEMA) errors.push(`Expected format ${SCHEMA}.`);
  if (!validKey(value.id)) errors.push('A valid stable ID is required.');
  if (!['sfw','mature'].includes(value.rating)) errors.push('Choose a content rating.');
  for (const key of ['description','creator','genre','image']) if (value[key] !== undefined && typeof value[key] !== 'string') errors.push(`${key} must be text.`);
  if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.some(t => typeof t !== 'string'))) errors.push('Tags must be a list of text.');
}
function unique(rows, name, errors) {
  const ids = new Set();
  if (!Array.isArray(rows)) {errors.push(`${name} must be a list.`); return ids;}
  for (const row of rows) {
    if (!isRecord(row) || !validKey(row.id) || ids.has(row.id)) errors.push(`${name}: duplicate or invalid ID ${row?.id ?? '(missing)'}.`);
    else ids.add(row.id);
  }
  return ids;
}
export function validateCharacter(c) {
  if (!isRecord(c)) return ['Character must be an object.'];
  const errors = []; common(c, errors);
  if (c.kind !== 'character') errors.push('This is not a character definition.');
  if (!text(c.name)) errors.push('Character name is required.');
  if (!Number.isInteger(c.age) || c.age < 18) errors.push('Set an adult age of 18 or older.');
  if (!text(c.personality)) errors.push('Describe the character’s personality.');
  for (const key of ['pronouns','species','speech','backstory','opening']) if (c[key] !== undefined && typeof c[key] !== 'string') errors.push(`${key} must be text.`);
  if (c.appearance !== undefined && !isRecord(c.appearance)) errors.push('Appearance must be an object.');
  unique(c.wardrobe || [], 'Wardrobe', errors);
  for (const outfit of list(c.wardrobe)) {
    if (!text(outfit.name)) errors.push('Every outfit needs a name.');
    if (outfit.rating && !['sfw','mature'].includes(outfit.rating)) errors.push('Invalid outfit rating.');
  }
  return errors;
}
export function validateConditions(rows, at = 'Conditions', errors = [], depth = 0) {
  if (rows === undefined) return errors;
  if (!Array.isArray(rows)) {errors.push(`${at} must be a list.`); return errors;}
  if (depth > 16) {errors.push(`${at}: conditions nest too deeply.`); return errors;}
  for (const c of rows) {
    if (!isRecord(c) || !CONDITIONS.includes(c.type)) {errors.push(`${at}: unknown condition type.`); continue;}
    if (['all','any','not'].includes(c.type)) {validateConditions(c.conditions, at, errors, depth + 1); continue;}
    if (c.type !== 'clock' && !validKey(c.key)) errors.push(`${at}: condition key is required.`);
    if (c.op && !['eq','ne','gt','gte','lt','lte'].includes(c.op)) errors.push(`${at}: invalid comparison.`);
    if (['resource','item','relationship','clock'].includes(c.type) && !Number.isFinite(c.value)) errors.push(`${at}: numeric condition needs a number.`);
  }
  return errors;
}
export function validateEffects(rows, at = 'Effects', errors = [], story) {
  if (rows === undefined) return errors;
  if (!Array.isArray(rows)) {errors.push(`${at} must be a list.`); return errors;}
  for (const e of rows) {
    if (!isRecord(e) || !EFFECTS.includes(e.type)) {errors.push(`${at}: unknown effect type ${e?.type}.`); continue;}
    if (!['clock','ending'].includes(e.type) && !validKey(e.key)) errors.push(`${at}: effect key is required.`);
    if (['resource','item','clock','relationship'].includes(e.type) && !Number.isSafeInteger(e.amount)) errors.push(`${at}: amount must be a safe whole number.`);
    if (['memory','outfit','unlockOutfit','equip'].includes(e.type) && typeof e.value !== 'string') errors.push(`${at}: ${e.type} needs a text value.`);
    if (e.type === 'bundle' && !Array.isArray(story?.effectGroups?.[e.key])) errors.push(`${at}: effect group ${e.key} does not exist.`);
    if (['discover','travel'].includes(e.type) && story && !list(story.locations).some(l => l.id === e.key)) errors.push(`${at}: location ${e.key} does not exist.`);
  }
  return errors;
}
export function validateStory(s) {
  if (!isRecord(s)) return ['Story must be an object.'];
  const errors = []; common(s, errors);
  if (s.kind !== 'story') errors.push('This is not a story definition.');
  if (!text(s.title)) errors.push('Story title is required.');
  if (!['player','shared','npc'].includes(s.initiative)) errors.push('Choose player, shared, or NPC initiative.');
  const nodeIds = unique(s.nodes, 'Story nodes', errors), locIds = unique(s.locations, 'Locations', errors);
  unique(s.offers || [], 'Shops, jobs, and services', errors); unique(s.items || [], 'Items', errors); unique(s.developments || [], 'Developments', errors);
  if (!nodeIds.size) errors.push('Add at least one story node.');
  if (!nodeIds.has(s.start)) errors.push('Select a valid opening node.');
  if (!locIds.size) errors.push('Add at least one location.');
  for (const field of ['cast','backgroundCast']) if (s[field] !== undefined && (!Array.isArray(s[field]) || s[field].some(x => !validKey(x)))) errors.push(`${field} must be a list of character IDs.`);
  for (const n of list(s.nodes)) {
    if (!isRecord(n)) continue;
    if (!text(n.text)) errors.push(`Node ${n.id}: narration is required.`);
    if (n.next && !nodeIds.has(n.next)) errors.push(`Node ${n.id}: next node ${n.next} is missing.`);
    if (n.location && !locIds.has(n.location)) errors.push(`Node ${n.id}: location ${n.location} is missing.`);
    validateConditions(n.requires, `Node ${n.id}`, errors); validateEffects(n.effects, `Node ${n.id}`, errors, s);
    unique(n.choices || [], `Choices in ${n.id}`, errors);
    for (const c of list(n.choices)) {
      if (!isRecord(c)) continue;
      if (!text(c.label)) errors.push(`Node ${n.id}: a choice needs a label.`);
      if (c.to && !nodeIds.has(c.to)) errors.push(`Choice ${c.id}: destination ${c.to} is missing.`);
      validateConditions(c.requires, `Choice ${c.id}`, errors); validateEffects(c.effects, `Choice ${c.id}`, errors, s);
    }
  }
  for (const l of list(s.locations)) {
    if (!isRecord(l)) continue;
    if (!text(l.name)) errors.push(`Location ${l.id}: name is required.`);
    if (l.links !== undefined && !Array.isArray(l.links)) errors.push(`Location ${l.id}: connections must be a list.`);
    for (const link of list(l.links)) if (!locIds.has(link)) errors.push(`Location ${l.id}: connection ${link} is missing.`);
    validateConditions(l.requires, `Location ${l.id}`, errors);
  }
  for (const o of list(s.offers)) {
    if (!isRecord(o)) continue;
    if (!text(o.name)) errors.push(`Offer ${o.id}: name is required.`);
    if (!['shop','job','service','recruitment'].includes(o.kind)) errors.push(`Offer ${o.id}: choose a kind.`);
    if (o.location && !locIds.has(o.location)) errors.push(`Offer ${o.id}: location is missing.`);
    for (const [k,v] of Object.entries(o.cost || {})) if (!validKey(k) || !Number.isSafeInteger(v) || v < 0) errors.push(`Offer ${o.id}: costs must be nonnegative whole numbers.`);
    validateConditions(o.requires, `Offer ${o.id}`, errors); validateEffects(o.effects, `Offer ${o.id}`, errors, s);
  }
  for (const d of list(s.developments)) {
    validateConditions(d?.requires, `Development ${d?.id}`, errors); validateEffects(d?.effects, `Development ${d?.id}`, errors, s);
    if (!Number.isSafeInteger(d?.at) || d.at < 0) errors.push(`Development ${d?.id}: set a nonnegative story time.`);
    if (d?.interval !== undefined && (!Number.isSafeInteger(d.interval) || d.interval < 1)) errors.push(`Development ${d?.id}: interval must be positive.`);
  }
  for (const [k,v] of Object.entries(s.effectGroups || {})) {if (!validKey(k)) errors.push('Invalid effect group ID.'); validateEffects(v, `Effect group ${k}`, errors, s);}
  for (const field of ['resources','inventory']) for (const [k,v] of Object.entries(s.initial?.[field] || {})) if (!validKey(k) || !Number.isSafeInteger(v) || v < 0) errors.push(`Initial ${field}.${k}: use a nonnegative whole number.`);
  return errors;
}
export const validateContent = c => c?.kind === 'character' ? validateCharacter(c) : validateStory(c);
export function compile(story) {
  const errors = validateStory(story); requireThat(errors.length === 0, errors.join('\n'), 'CONTENT_INVALID');
  const s = clone(story);
  return {story:s, nodes:new Map(s.nodes.map(n => [n.id,n])), locations:new Map(s.locations.map(l => [l.id,l])), offers:new Map((s.offers || []).map(o => [o.id,o])), items:new Map((s.items || []).map(i => [i.id,i]))};
}
