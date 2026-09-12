# Running and maintaining EA3

## First launch

Extract the runnable archive into a normal writable folder. Install Node.js 22.16.0 or newer; 22.16.0 is the version used by the test suite. No `npm install` is required for normal play.

Windows: double-click `START-WINDOWS.cmd`. macOS/Linux: open a terminal in the extracted folder and run `sh START-MAC-LINUX.sh`. Both launch the same Node service. Alternatively run `npm start`.

Visit `http://127.0.0.1:4173`. Leave the terminal open while playing. Close the application tab when finished, then press Ctrl+C in the terminal. Changing an environment variable requires restarting the service.

Opening `index.html` as a local file is not supported: module loading, browser persistence and provider endpoints expect the local service. On launch, the seven-story example collection installs transactionally. It does not overwrite existing definitions or restore examples that were deliberately deleted after their collection was installed.

## Begin playing

Choose Story Library, open a story, and select Begin this adventure. Choose a player name and description. The authored opening and choices work with the built-in Local story demo, which is deliberately labeled as scripted. It is not a local language model and cannot provide the same open-ended experience as a live narrator.

Use the map for travel and Shops, jobs & services for explicit transactions. Offer previews show the fee, return, affected items and story-time duration before acceptance. The runtime validates the actual action again when accepted. Continue advances authored transitions or lets the narrator advance the world without inventing a player message. Auto Observe does not make consequential player choices; Delegate can select choices the author explicitly marked safe.

Editing/regenerating a prior turn replaces the later timeline. A failed rewrite leaves the previously committed adventure intact. Make a manual save copy before an edit when you specifically want a separate backup; no automatic alternate-history tree is created.

## Where data lives

| Data | Location |
|---|---|
| Adventures, reusable content, owned images, settings and drafts | Browser IndexedDB on the exact page origin |
| Selected backup-folder permission | Browser storage, never portable archives |
| Optional community accounts, publications, reports and audit records | `.runtime/community/community.sqlite`, unless `EA3_DATA_DIR` selects another directory |
| Local server generation receipts | `.runtime/generation` |
| Provider configuration and credentials | `.env` in the application folder |

Keep the same URL and browser profile. `http://127.0.0.1:4173` and `http://localhost:4173` are different origins; changing the port also changes the origin. Private browsing and browser storage eviction can affect retention. Complete archives outside the browser are the practical protection against losing a profile or device.

The optional community account is not cloud storage for personal adventures. Publishing explicitly selected library content does not publish conversation history. Server storage and browser storage are separate and need separate backups.

## Complete backups and device handoff

Open Your data. Export all local data for a complete portable archive, or export the current adventure for a smaller handoff. The latter includes its frozen story, current and historical state references and owned gallery images. Import checks integrity and preserves conflicting existing saves as separate copies.

On browsers exposing a folder picker, optional folder backup writes into an `EmberAdventures3-backups` subfolder and alternates two complete files. Each write is read back and verified. Lost permissions are shown to the player rather than silently prompting. The folder engine is tested with controlled filesystem fixtures; actual platform permission dialogs are a separate manual acceptance step. Unsupported browsers retain manual archive download.

Direct handoff requires both pages to remain open, copy/pasted connection messages and explicit receiver approval. It uses no STUN service, TURN relay or cloud-sync backend. It may not work across networks that cannot connect directly; use a portable file in that case. Direct transfer has a documented 128 MiB memory budget and never silently truncates a larger adventure.

When the main application cannot boot, open `http://127.0.0.1:4173/recovery.html` on the same browser origin. It reads existing records without resetting or repairing the database. Its raw rescue export preserves damaged or partial records for repair and is **not** an ordinary complete-archive import.

## Configure AI independently

Copy `.env.example` to `.env`, configure the full text and/or image endpoint, model and optional API key, then restart the service. Select each provider independently in Settings. Keep keys on the server; never paste them into a story, image prompt, public report or Git commit.

The HTTP adapters and Perchance host bridge are implemented and contract-tested. Live response quality, costs, quotas and appearance consistency depend on the selected provider and have not been qualified by the scripted local tests. See PROVIDERS.md for the existing protocol and embedding examples. There is no automatic paid-provider fallback.

## Optional community and operator tools

The Community Library belongs to the current server instance. A local instance does not automatically become the shared EA1 community. Registering locally does not create an account on another deployment. Publishing, rating and reporting use explicit forms; tests use synthetic accounts on an isolated instance.

After registering an operator account on a trusted local instance, the filesystem operator can assign a role:

```sh
node --env-file-if-exists=.env tools/admin.mjs role YOUR_USERNAME moderator
```

Use the same `EA3_DATA_DIR` as the server. This is a privileged local command, not a public registration option. Operator tools are at `/operator.html`; developer tools are at `/workbench.html`. Server permissions are checked for every privileged operation. Reply drafts are not sent as email.

Do not expose the development server directly to the public internet. Public hosting needs HTTPS, secure cookies, a deliberate allowed-host list, protected generation, registration/rate/quota policy, database backups and operational security review. `PUBLIC_MODE=1` removes the anonymous local-generation shortcut; it does not by itself complete that deployment work.

## Upgrade without losing data

First export a complete browser archive. Stop the old server. Extract the new runtime separately; retain `.env` privately. Keep private server data separate or back up `.runtime` with the server stopped before moving it. Do not put those private files into the source archive or public repository.

Start the new service at the **same URL and port** to use the same browser store. Existing adventures retain frozen definitions. Library edits and new bundled examples do not rewrite an ongoing adventure.

## Troubleshooting

**Node command missing or SQLite/module startup error:** check `node --version`. Use 22.16.0 or newer. Do not delete browser storage to fix a server installation problem.

**Port in use:** stop the other instance, or put `PORT=4174` in `.env` and use the address printed by the server. Remember that a new port has a separate browser store; import a complete archive there when moving intentionally.

**No images generated:** Upload/existing images is the default image mode. It does not generate images. Configure an image endpoint or the Perchance host separately from text generation.

**Provider failed or completion unknown:** your last committed story remains. Inspect the recorded request in Workbench before retrying. A lost network response does not prove a remote model or publication did nothing.

**Another tab changed a save:** stop editing in one tab and reload the newer save in the other. The revision conflict deliberately prevents overwriting newer work.

**Legacy story imports into review, not gameplay:** that is intentional. Unsupported EA1 objective/completion/reward mechanics remain flagged or blocked rather than being silently dropped. Preserve the original and use the review report. Full legacy saved-session continuation is not supported by this preview.
