# EA3 authoring

Open Story Library or Character Library, choose an item, and use Edit. New items use the same editors. No JSON is needed for normal story, character, wardrobe, location, offer, condition, or effect editing. The Advanced tab preserves the complete definition and supports validated JSON edits and export.

Story graph: add moments, edit their narration, set Continue destinations, add choices, and attach typed effects/requirements. Drag the background to pan, wheel to zoom, Fit to frame the graph, Arrange to recompute layout, drag cards to place them, and drag output ports to set Continue links. A destination can also be selected with the keyboard in the inspector. Graph routes are authored possibilities, not retained alternate player timelines.

Library save is explicit and validates the definition. Editor drafts are separately saved locally, including invalid in-progress edits. On reopening, recover or decline the stored draft. A recovered draft retains its base content revision so it cannot silently overwrite another tab's newer library content. Undo/Redo concerns editor changes only. Player history remains canonical.

Character playtest uses the current draft even before library publication. Starting a playtest makes a separate adventure with a frozen definition; editing library content does not rewrite active games.

AI suggestions require a configured provider. They produce a reviewable change list; malformed, stale, identity-changing, or invalid proposals cannot be applied. No live model-quality claim is made by transport tests.

Verification: `npm test`; `python tools/authoring_ui_test.py` for explicitly labeled offline Chromium fixtures; `python tools/authoring_ui_test.py --native` against a running server for real browser persistence. The native CI workflow runs both foundation and authoring suites and retains screenshots and exact source. Draft recovery, node edits/duplicate/delete/undo, library save, character wardrobe and playtest are exercised through actual DOM actions.
