# EmberAdventures 3

A technical rebuild of EmberAdventures with the familiar game, a polished ember-and-black interface, and one canonical story timeline.

## Development status

Active rebuild. This initial checkpoint records recovery and the product contract; it is not a completed application. See RESUME.md for the latest verified state.

## Product contract

- EA1 defines the player experience: main menu, three-column adventure, libraries, specialized world tools, and visual authoring.
- EA2 contributes engineering ideas, not its reading-room identity.
- Editing/regenerating replaces unwanted history. No alternate-timeline interface.
- Continue advances NPCs/world without inventing player decisions. Auto has Observe and Delegate settings.
- State changes are validated, atomic, revision-bound, and cancellable.
- Review real browser screenshots repeatedly at desktop and mobile sizes.
- Preserve original imported files and report unsupported migration features.

## Recovery discipline

Source and tests must exist before a capability is reported. Push coherent checkpoints to this repository, verify the remote branch, and record exact verification results. A local temporary workspace is never the only intended copy. Do not commit credentials, personal saves, browser profiles, or font files.
