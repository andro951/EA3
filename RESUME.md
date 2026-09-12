# EA3 resume

Phase: runtime, session, and storage implemented; first player interface next.

Verified locally on 2026-09-12: Node 22.16.0; 37 tests pass. Core implements canonical replacement/rewind, reversible state deltas, validated graph actions, atomic economy, equipment/outfits, timed developments, and reviewable memory candidates. Session persists jobs before dispatch, rejects stale output, supports manual narration replacement, Observe/Delegate Auto, and optimistic multi-tab writes. Persistence implements normalized IndexedDB records, complete hashed archives, conflict-safe imports, frozen definitions, and owned image assets.

Important qualification: storage tests use an explicit MemoryRepository. Native Chromium navigation to localhost returns ERR_BLOCKED_BY_ADMINISTRATOR. Offline DOM rendering works; use it for real interface interaction and screenshot review with clearly labeled storage/network doubles. Do not change managed policies. Keep a separate native acceptance runner.

Recovery: prior EA3 archive had no source. EA1/EA2 reference packages survived outside this repository. See docs/RECOVERY.md. GitHub connector is the active remote transport because command-line DNS is unavailable. Core local file hashes have been compared successfully against remote Git blobs.

Next: implement content, provider simulators, static service, and the EA1-style main menu / three-column adventure UI; screenshot and compare before broad expansion. No player UI is claimed finished in this checkpoint.
