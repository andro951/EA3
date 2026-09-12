# Visual review journal

## Foundation pass — 2026-09-12

EA1 references: shell/page.html, styles/app.css, scripts/app/05-menus-profiles.js, original menu asset source URLs and supplied PNGs. The original five-action illustrated menu and three-column adventure screen define the product hierarchy. EA2's reading-room layout was not adopted.

KEEP: the original scenic background, flame wordmark and illustrated menu buttons; named Story Library and Character Library; main-menu entry points; character/world left, conversation center, images right; Continue and Auto beside the composer.
POLISH: warm near-black surfaces, consistent ember borders and focus states, consolidated contextual menus, readable conversation width, responsive side drawers, explicit save/provider status.
FIX: no player-facing timeline branches; independent scroll regions; old/failed output must not overwrite current history. Scene illustrations are explicitly labeled artwork when not actually generated.

Captured 12 actual Chromium screenshots at 1440x1000 and 390x844, with realistic authored story state and a completed shop purchase. Visually opened desktop home, desktop game, and mobile home. The home retains the recognizable original artwork and hierarchy; game presents a clear center conversation with compact contextual panels. Re-ran interaction checks after CSS/module separation; no page errors or phone horizontal overflow.

This is the early identity gate, not final visual qualification. More dense, long, empty, failed, editor and accessibility states must be reviewed during expansion. Local managed Chromium prohibits URL navigation; these captures use the real app in an offline DOM harness with explicitly substituted storage/transport. Native browser testing is a separate gate.


## Expanded collection pass — 2026-09-12

The seven-story library and two realistic opening scenes were captured at 1920x1080, 1366x768, 768x1024, 390x844 and 320x720. The local run uses explicitly labeled offline storage/network fixtures; it clicks the real application. No alternate layout or fake screenshots were substituted.

Visually opened and reviewed: launch library at 1920 and 320 pixels; the four-character Table Seven opening at 1366x768; Low Tide at 390x844; Copper & Clover's paid-work offers. The library retains the ember-and-black cards, familiar navigation and useful information hierarchy. The laptop game retains separate character/world, conversation and image columns. On the phone the conversation remains readable and the composer stays accessible without horizontal overflow. The original EA2 vector studies remain visibly simpler than the original EA1 menu illustration; they are not represented as finished model-generated portraits.

The twenty-ending browser playthrough caught a stale “Auto stopped” status inherited when another adventure was opened. Attach now resets the visible status and streaming text to the newly loaded, committed adventure. The complete rerun passed with no page errors and nineteen screenshots. Its native counterpart is added to CI separately.

One remaining polish issue found in the offers screenshot: paid work displayed only its zero upfront cost, obscuring pay and duration. That is recorded for the next UI pass rather than called finished here.


## Offer clarity pass — 2026-09-12

The paid-work review issue is now fixed. Offer summaries preview the same validated transaction as acceptance, without persisting or mutating it. They disclose upfront cost, gross payment, items received/used, story-time duration and remaining stock. Unavailable entries explain missing resources, requirements or sold-out status.

Re-ran all twenty authored routes through the UI after wiring the new offer view. Opened both desktop and 390-pixel phone screenshots. The potting shift now visibly says “Pays 8 coins” and “2 story-time units”; the sale identifies its consumed seedling. On phones the accept buttons move below the outcome text rather than squeezing the title into a thin column. The interface keeps the existing dark surfaces, ember accents and modal behavior. No page errors or horizontal overflow were recorded.

Native CI run 34719237333 passed at source 5266b74a0a06e85ed5f3bb543209bba16942fb60, including the new twenty-ending UI route suite. The subsequent offer polish must be verified at its own commit, not inferred from that earlier green run.
