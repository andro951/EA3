import {clone,requireThat} from '../core/util.mjs';

/** Saving a snapshot must not mark edits made during that write as saved. */
export async function saveDraftSnapshot(model,repository,expectedRevision=null){
  const errors=model.errors();requireThat(!errors.length,errors.join('\n'),'CONTENT_INVALID');
  const revision=model.revision,content=clone(model.value);
  const stored=await repository.putContent(content,{expectedRevision});
  model.value.contentRevision=stored.contentRevision;
  model.savedRevision=revision;
  return {stored,revision,unchanged:model.revision===revision};
}
