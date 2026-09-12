# EA3 resume

Phase: recovery and first implementation.

Verified on 2026-09-12:
- Prior EA3 recovery archive contains zero project directories and zero source files.
- EA1 reference ZIP and EA2 0.9.0 source are available and extracted read-only as references outside this repository.
- Node 22.16.0, Chromium, Python Playwright, and local filesystem work.
- Git command-line network cannot resolve github.com. Use authorized GitHub connector read/write operations for checkpoints; do not assume a git push succeeded.
- GitHub main initially points to 944267fc88079a231c4a1f84061db982d384c793, the earlier temporary-file removal commit.

Next: implement and test the canonical runtime, render EA1 in a network-isolated reference browser, then implement the familiar main menu and adventure screen. Keep reviewing EA1 throughout. No prior implementation is claimed recovered.
