# Development-preview acceptance

This document describes the implemented scope and remaining gaps. A green test suite means the listed tests passed; it does not establish full EA1 feature parity or production readiness.

## Implemented and exercised

| Area | Evidence and scope |
|---|---|
| Product identity | Original illustrated EA1 menu; ember-black game shell; character/world left, story center, images right; recurring screenshot review |
| Canonical history | Unit and browser coverage for replacement, rewind, state restoration, failed rewrite retention and stale-result rejection; no alternate-history tree |
| Gameplay | Authored choices, world travel, typed resource/item/relationship effects, shops, jobs, services, equipment, wardrobe, party introductions and scheduled developments |
| Authoring | Story graph and character forms, typed conditions/effects, world/economy/cast editing, draft recovery, editor Undo/Redo, validation, playtesting and owned artwork selection |
| Images | Real raster upload/decode/crop and explicit selection; favorites and owned history; preview-before-confirm presentation; protected deletion and complete-archive references |
| Memory | Manual entry plus additional explicit AI review with exact supporting quotations, valid subjects, stale-result checks and player-controlled keep/dismiss; review tests use a scripted provider |
| Browser saves | Real Chromium IndexedDB, reload, complete downloads and independent-context imports in native CI; concurrent-write and failure tests also use isolated in-memory fixtures |
| Recovery | Complete archive checks, conflict copies, standalone read-only raw recovery; folder-backup engine tested with controlled handles rather than an actual OS folder grant |
| Handoff | Consent-gated protocol, hashes, saved chunks, duplicate/timeout handling; real WebRTC between two independent browser contexts on a CI machine; no physical-network claim |
| Community | Isolated account/session, immutable publication, dependency-aware download, creator/uploader separation, uncertain-write reconciliation, exact-version feedback and server-authorized moderation |
| Development tools | Local Workbench, persisted requests, validation, explicit receipt inspection, separate protected Operator page |
| Launch collection | Seven stories, sixteen adult reusable characters, 63 nodes, twenty authored endings; domain tests persist/export/import/rewind every route; browser suite clicks every route |
| Build | Syntax/static-reference checks; allowlisted runtime manifest; two-build manifest reproducibility; byte-checked serving and private-file rejection |

The recorded native-CI artifact includes the exact source commit, test logs, JSON reports and screenshots. The final downloadable package includes its specific qualification record. Use that commit and those reports rather than inferring completion from a later documentation-only commit or an old screenshot.

## Not completed or not qualified

**Missing EA1 product functionality:** explicit adult-scene gameplay/state and physical Lovense output are absent. The mature profile in this preview is for non-explicit adult relationships. A simulator or generic status display is not substituted for physical-device support.

**Legacy compatibility:** the EA1 importer preserves original files and builds reviewable character/story-graph drafts. It does not reproduce all complex objective prerequisites, concurrent side objectives, rewards, cycles and input-group semantics, and it cannot continue an arbitrary EA1 saved session as an EA3 game. Unsupported behavior is reported and blocked where applicable. Large-graph indexing is not proof of gameplay parity. A verified converter and representative original-story playthroughs remain necessary before EA3 replaces EA1 for legacy content.

**Live AI and imagery:** text/image adapter contracts, cancellation, split streams and provider boundaries are tested. No real Perchance generation, live paid API account, image consistency/extreme-proportion calibration or emergent long-term character fidelity is established by those tests. The default Local story demo is authored/scripted. Included EA2 vector studies are not final AI portrait quality.

**Authoring and gameplay depth:** the new graph/editor exposes the EA3 typed model, not every advanced EA1 field or workflow. AI-assisted drafts and quoted memory review do not yet replace comprehensive automatic conversational-state reconciliation, fully generated worlds or every historical EA1 AI command.

**Physical/platform acceptance:** actual browser folder-picker grants, audible speech, physical-device handoff across networks, Safari, real phones and their on-screen keyboards, and a Windows double-click launch must still be manually checked. Native CI is Chromium on Linux; resized viewports do not turn that into a physical phone test.

**Public deployment:** the isolated Node/SQLite community is not connected to or migrated from the existing EA1 public/Supabase ecosystem. Account recovery, abuse operations, deployment hardening, production capacity, backups and a live hosting security review remain operator work. No production publication, moderation action or email was performed during development tests.

## What “ready to try” means here

The runnable preview can be opened locally, can play the complete authored collection, can create and edit its own supported content, and can keep/export its data. It is suitable for evaluating the rebuilt interaction and backend and for focused testing. It should not be described as the completed adult-first EA3, as an approved public production service, or as a lossless replacement for every EA1 story/save.

Before switching everyday use, retain EA1 and original content, keep complete backups, connect and test the intended live providers, and resolve the missing functionality that matters to that use case. Known gaps are part of the handoff, not hidden behind a test count.
