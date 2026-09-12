# EA3 resume

2026-09-12 community backend checkpoint. The isolated Node/SQLite community service now implements account sessions, creator/uploader separation, immutable version publication, owned assets, story cast dependencies, uncertain-publication receipts, discovery, ratings/reports, and protected exact-version moderation/audit. server/main.mjs integrates it while keeping anonymous local play. Privileged account creation is never exposed through the registration API.

115 unit/contract tests pass locally. The community suite uses fresh temporary databases and synthetic accounts only. It checks ownership, immutable reported JSON, corrective reclassification, locks/restrictions, reply drafts not being sent, lost-response reconciliation, and Host/origin/private-file protections. No production actions or real email were performed. Native player/operator community UI is the next qualification slice, not yet claimed complete.

Last verified integrated native run: 34683301257 on cc538cdd318c65049d0102f18bda9bb0b0a37747 (foundation, authoring, media, backup/rescue, independent-context RTC). Migration review is on main; it preserves full source and graph nodes but does not provide full EA1 gameplay or saved-session parity. Actual Inspector benchmark metadata is local and ready to preserve; never commit private raw reference content.

Next: finish community client/UI and protected Workbench/Operator screens; add native isolated-community UI testing and migration UI testing; push outstanding small local graph/bridge/style fixes; expand safe launch content; implement build/check/performance scripts and packaging; final source/evidence audit. No full EA3 release claimed. Continue frequent verified non-force GitHub checkpoints.
