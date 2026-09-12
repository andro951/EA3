# EA3 resume

Phase: canonical runtime implemented; persistence and UI next.

Verified locally on 2026-09-12: Node 22.16.0; native Chromium launches; 21 runtime tests pass. The new source is in app/core/{util,schema,history,runtime}.mjs. It implements validated story graphs, reversible state deltas, canonical replacement/rewind, atomic economy, equipment/outfits, typed conditions/effects, timed developments, and reviewable memory candidates. No UI is claimed finished yet.

Recovery: prior EA3 archive had no source. EA1 and EA2 reference packages survived. See docs/RECOVERY.md. GitHub connector is the active remote transport because command-line DNS is unavailable. Main is updated without force at checkpoints. Source has been read back/checked against remote trees at release gates, not assumed saved because a local commit exists.

Next: normalize IndexedDB persistence, implement the session cancellation/Auto controller, and recreate EA1 main menu plus its three-column adventure screen. Reference EA1 shell/page.html, styles/app.css, and 05-menus-profiles.js throughout. Capture screenshots with real local Chromium and isolated data.
