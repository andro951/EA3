# Launch collection

The initial collection contains seven stories, sixteen reusable adult characters, 63 story nodes and twenty authored endings. The Ember Road is the EA3 foundation story. The other six stories and thirteen characters are adapted from the original EA2 0.9.0 source package, not from downloaded community content.

| Story | Focus | Endings |
|---|---|---:|
| The Ember Road | Introductory exploration, choices and economy | 4 |
| The House at Low Tide | NPC-led, quiet connection and respected distance | 3 |
| A Map of Borrowed Skies | Exploration and evidence-dependent decisions | 3 |
| The Ninth Bell | Mystery, future cast and privacy choices | 2 |
| The Last Table Seven | Social ensemble and a closing restaurant | 3 |
| Copper & Clover | Work, growing, selling, paid services and collaboration | 3 |
| The Last Lantern | Gentle forest adventure with adult fantasy characters | 2 |

## What was preserved and adapted

The six EA2 stories retain their authored node prose and ending routes. Their original vector illustrations are included; these are illustrative studies, not live generated portraits or evidence of image-model quality. The game still uses EA1's illustrated menu and ember-black three-column interface, not EA2's reading-room interface.

The data adaptation changes beats to nodes, roster to background cast, resources/inventory to initial state, after-based timers to absolute story-clock thresholds, and ending booleans to named ending milestones. Flag effects become explicit booleans. Memory entries use an actual subject rather than an arbitrary mnemonic key. Scalar prices become named resource costs. Item definitions are included for inspectable inventory. Nonrepeatable offers use finite stock.

In Copper & Clover, the normal action already advances time once, so a two-unit shift adds only one extra unit. Jun appears in his workshop and his paid collaboration cannot be bypassed by direct free recruitment. The low-tide house initially contains Mira; Oren is introduced with his authored arrival. Ada's duplicated short description and mismatched presentation pronouns are corrected separately in collection.mjs. These are continuity fixes, not a claim of complete EA1 or EA2 feature parity.

## Installation and ownership

Built-in packs install transactionally under versioned markers. Existing library definitions are not overwritten. Reopening does not resurrect examples that the player intentionally deleted. Earlier EA3 installations keep their original seed marker; the new collection adds only missing definitions. Active adventures retain frozen stories and character copies.

## Verification

content/playthroughs.mjs contains a reproducible route to every one of the twenty endings, including the paid-work and collaboration routes. tests/launch-content.test.mjs validates all definitions, plays those routes through real domain transactions, persists every turn, round-trips a complete archive into independent storage and verifies canonical rewind. These are authored/domain tests, not language-model evaluations. The browser launch suite separately clicks the actual interface.
