# Visual review journal

## Foundation pass — 2026-09-12

EA1 references: shell/page.html, styles/app.css, scripts/app/05-menus-profiles.js, original menu asset source URLs and supplied PNGs. The original five-action illustrated menu and three-column adventure screen define the product hierarchy. EA2's reading-room layout was not adopted.

KEEP: the original scenic background, flame wordmark and illustrated menu buttons; named Story Library and Character Library; main-menu entry points; character/world left, conversation center, images right; Continue and Auto beside the composer.
POLISH: warm near-black surfaces, consistent ember borders and focus states, consolidated contextual menus, readable conversation width, responsive side drawers, explicit save/provider status.
FIX: no player-facing timeline branches; independent scroll regions; old/failed output must not overwrite current history. Scene illustrations are explicitly labeled artwork when not actually generated.

Captured 12 actual Chromium screenshots at 1440x1000 and 390x844, with realistic authored story state and a completed shop purchase. Visually opened desktop home, desktop game, and mobile home. The home retains the recognizable original artwork and hierarchy; game presents a clear center conversation with compact contextual panels. Re-ran interaction checks after CSS/module separation; no page errors or phone horizontal overflow.

This is the early identity gate, not final visual qualification. More dense, long, empty, failed, editor and accessibility states must be reviewed during expansion. Local managed Chromium prohibits URL navigation; these captures use the real app in an offline DOM harness with explicitly substituted storage/transport. Native browser testing is a separate gate.
