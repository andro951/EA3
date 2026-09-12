import {collectionCharacters as originalCharacters} from './collection-characters.mjs';
import {collectionStories as originalStories} from './collection-stories.mjs';

// Small continuity corrections are kept separate from the adapted source prose.
export const collectionCharacters=structuredClone(originalCharacters);
const ada=collectionCharacters.find(c=>c.id==='ada');
ada.description='The bell keeper whose name was removed from the town records.';
ada.appearance.presentation=ada.pronouns;
export const collectionStories=structuredClone(originalStories);
const tide=collectionStories.find(s=>s.id==='low-tide');
tide.cast=['mira'];tide.backgroundCast=['oren'];
tide.nodes.find(n=>n.id==='repair').effects=[{type:'presence',key:'oren',value:true}];
