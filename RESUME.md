# EA3 resume

2026-09-12 community UI checkpoint. Source restored exactly from e212aded before continuing. New source includes community discovery, filtering, explicit single/bulk publishing, version visibility, atomic downloads, local-copy exact-version feedback, and durable publication receipts. Operator and Workbench are separate pages; every privileged action is server-authorized. Trusted local role assignment is tools/admin.mjs, not a public endpoint.

Verification: 122 unit/contract tests pass locally. Five community UI assertions pass in offline Chromium with an explicitly scripted community transport. Desktop and phone community screenshots were inspected. Native CI now runs the community test against an explicitly marked isolated instance, including role assignment via local CLI, immutable report inspection, corrective moderation, audit history and Workbench. Check that CI result before claiming native acceptance for this new slice.

No private reference stories or real player data are committed. Registration/feedback tests use synthetic accounts. No emails are sent. Original EA1 menu art and familiar game layout remain; one canonical story timeline only.

Next: verify native community CI; inspect its operator/workbench screenshots; fix any integration defects; fill missing build/check/performance commands, broaden launch content, audit remaining UI destinations and quality gates, and package a verified build. Live AI quality, physical devices, native folder grants and full EA1 saved-session parity remain separate open requirements. Continue frequent non-force source checkpoints to GitHub.
