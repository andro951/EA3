# EA3 resume

2026-09-12 media checkpoint. Graph-first authoring and draft recovery were pushed at c0a2298019f09398501127f824bb4459d7eab9c6 and passed native CI run 34681958398 (foundation and authoring). Current slice adds owned raster gallery/upload/favorites/crop/selection/download/protected deletion; staged character appearance requiring a matching preview; and canonical character introductions/presentation rollback through app/core/engine.mjs.

Verification: 77 unit tests pass locally. Eight media UI assertions pass with explicit offline storage/network doubles and real browser raster decoding. Desktop gallery, desktop appearance and phone appearance screenshots were inspected. A duplicate-image metadata issue was fixed so identical uploads/crops do not erase prior favorites. Export includes owned unselected gallery images and historical references. Default image workflow is upload; live model/image quality remains unverified.

Core entry: Session imports engine.mjs, which composes the original runtime with reversible character projections. Do not modify character arrays outside canonical transactions. Image generation never silently selects a late result. The gallery currently exposes scene and character portraits; title/location/item selection UI remains future work even though providers support semantic requests.

Next: preserve media UI runner and add it to native CI; voice/playback controls; optional filesystem backup, independent recovery and handoff; migration review and community/workbench/operator tools. Also push the small local editor/bridge fixes for pointer selection, search control styling and author request schema. Keep EA1 identity, not a redesign. No completed EA3 release is claimed.

Remote source is the recovery authority; local Git DNS is unavailable. Use authorized connector commits and non-force ref updates. Recover exact source from native-CI artifacts/tree if the temporary workspace disappears.
