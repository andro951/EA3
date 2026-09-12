# EmberAdventures 3

A playable **development preview** of the EmberAdventures rebuild: the original illustrated menu and ember-and-black, three-column game interface, with a new canonical-history runtime, visual authoring tools, owned images and local-first saves.

**This is not yet a complete replacement for EA1.** Explicit adult-scene functionality, physical Lovense integration and full EA1 complex-story/save compatibility are not implemented. Live AI/image-provider quality and several physical-browser/device behaviors still need qualification. See [Acceptance and remaining gaps](docs/ACCEPTANCE.md).

## Run

Use **Node.js 22.16.0 or newer**. The tested runtime is 22.16.0. There are no runtime packages to install.

On Windows, extract the runnable package and double-click `START-WINDOWS.cmd`. On macOS/Linux, run `sh START-MAC-LINUX.sh`. Or, from the project folder:

```sh
npm start
```

Open **http://127.0.0.1:4173** and keep the terminal open. Do not open `index.html` directly. No account, paid service or key is needed for the included authored stories.

The default **Local story demo is scripted, not a language model**. It plays the authored content and choices. For open-ended AI conversation, configure a text provider and select it in Settings; image providers are configured separately. Details are in [Providers](docs/PROVIDERS.md).

## Included

- Seven authored stories, sixteen reusable adult characters, 63 story nodes and twenty endings. [Collection and adaptation notes](docs/LAUNCH_CONTENT.md).
- Familiar adventure controls, cast inspection, travel, inventory, wardrobe, equipment, shops, jobs, services, memories and relationship state.
- One player-visible timeline. Rewriting earlier history replaces later events and restores their associated state. Failed generation does not destroy the currently saved story.
- Continue without invented player speech; Observe/Delegate Auto with explicit Stop and authored safe-choice limits.
- Graph-first story and character editors, typed conditions/effects, draft recovery, editor Undo/Redo, validation, artwork selection and playtesting.
- Owned image upload, history, favorites, cropping, explicit selection, export and staged appearance changes requiring a matching preview.
- Manual memories and optional quote-backed AI memory proposals that the player reviews before keeping.
- Complete archives, conflict-safe imports, optional verified folder backups, independent raw recovery and manually paired direct-device handoff.
- Optional instance-local community publishing, immutable versions, ratings, reports, uploader ownership, durable publication receipts, protected Operator tools and a separate developer Workbench.

## Keep your data

Adventures are stored in the **browser**, separately from the Node service. Keep using the same browser profile and URL. `localhost`, `127.0.0.1`, different ports and different browsers have different local stores. A missing save on another origin does not mean the old save was deleted.

Use **Your data → Export complete archive** for a complete archive before changing computers, browser profiles or hosting. The emergency recovery page is read-only and exports raw records; it is not a normal validated backup. Community accounts do not cloud-sync adventures.

## Development and verification

The source package includes tests and tooling. The smaller runnable package deliberately omits them.

```sh
npm test
npm run check
npm run test:performance
npm run test:release
npm run build
```

`npm run build` creates `dist/EmberAdventures3` with an allowlisted, hashed manifest. The release test builds twice, compares manifests, starts the built entry point and verifies its served bytes, private-file boundaries and protected API behavior. Native browser CI separately exercises actual IndexedDB, reload, downloads/import, editors, images, recovery, direct RTC handoff, community/operator flows and all twenty authored endings. Live AI is not implied by those tests.

## Guides

[Running, upgrading and troubleshooting](docs/RUNNING.md) · [Acceptance and remaining gaps](docs/ACCEPTANCE.md) · [Authoring](docs/AUTHORING.md) · [Memory review](docs/MEMORY.md) · [Provider integration](docs/PROVIDERS.md) · [Visual review](docs/VISUAL_REVIEW.md) · [Testing](docs/TESTING.md)

`RESUME.md` identifies the latest development checkpoint. Real source history is in `andro951/EA3`; temporary local workspaces are not the sole backup. No credentials, private player saves, original reference archives or font files belong in the public repository.
