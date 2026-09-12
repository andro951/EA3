# EA3 resume

2026-09-12 continuation. Restored exact source at 35503141aa4eeb595f51d063a56ca5017df110fc from artifact 10300409493. ZIP SHA-256 abc2036ffff8b03536bcdfcf268aacd5f0ed3dcc32c7910dc110f985b979ce85 and Git tree 18eca63e1d2128b602eb2afeaebc9aa09bc5741e both verified locally. Re-ran the baseline: 141 tests pass. Native CI for that baseline succeeded at run 34702471270.

This checkpoint adds an atomic built-in collection installer with six passing focused tests. Concurrent first boots converge; existing content is never overwritten, intentionally deleted built-ins are not resurrected, and failed installation leaves neither partial library records nor a misleading completion marker. The new installer is not wired to boot yet.

Current work: adapt and thoroughly playtest EA2's original six showcase stories inside EA3 without adopting EA2's visual identity; preserve their prose, correct schema/state/time mappings, and retain the original artwork. Then dense/responsive screenshot review, complete running/acceptance docs and verified package. EA1 reference shell/page.html and menu code were inspected again; the current three-column screen retains their hierarchy.

Keep one canonical timeline. Push coherent tested source regularly without force-updating main. Native/live-provider/physical-device evidence must be labeled separately. No full EA1 legacy-save/adult/device parity or completed release is claimed.
