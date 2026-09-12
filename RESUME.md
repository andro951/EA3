# EA3 resume

Phase: playable interface foundation; expansion is in progress.

Verified 2026-09-12 06:30 UTC:
- 37 core/session/storage unit tests pass.
- Actual offline Chromium UI actions pass: original illustrated menu, library, story details/setup, three-column game, authored choices, paid shop transaction, inventory, character inspection, map, settings, phone layout and drawers.
- Twelve screenshots captured locally. Desktop menu, desktop game, and phone menu were visually inspected; the original EA1 illustrated menu and familiar three-column hierarchy are retained with ember-and-black polish.
- All source for this playable foundation is saved in this checkpoint. Native browser navigation remains blocked locally; offline UI uses explicit storage/network doubles. Do not claim native IndexedDB acceptance from it.
- Original EA1 menu PNGs were retrieved by the repository's checksum-verifying workflow and committed at eb948aa06ed613f7c99c71716b9feec55ec0d69f.

Current launch content: The Ember Road (11 story nodes, 4 endings), Rhea, Calder and Fen. Portraits are EA2 vector studies, not live generated images. Default narrator is explicitly labeled a local authored/scripted demo, not an LLM.

Next: commit test tooling and independent native CI; complete provider registry, story/character graph editor, images/staged appearance, folder backups, transfer, voice, canonical character additions, legacy import review, community/workbench/operator/recovery interfaces. These optional UI destinations are NOT finished in this checkpoint. No full EA3 release is claimed.

Remote GitHub connector works; CLI Git DNS does not. Use non-force main updates, preserve collaborator commits, and verify remote blob hashes. If local work disappears, recover this repository rather than making another empty scaffold.
