import {installBuiltins} from './builtins.mjs';
import {starterCharacters,starterStory} from '../../content/seed.mjs';
import {collectionCharacters,collectionStories} from '../../content/collection.mjs';

/** Upgrade the installed examples, not the player's library definitions. */
export async function installLaunchContent(repo){
  // Older EA3 builds used this marker; do not resurrect original items they deleted.
  if(!await repo.get('meta','seedVersion')){
    await installBuiltins(repo,{key:'ember-road-v1',items:[...starterCharacters,starterStory]});
    await repo.put('meta','seedVersion',1);
  }
  return installBuiltins(repo,{key:'showcase-v1',items:[...collectionCharacters,...collectionStories]});
}
