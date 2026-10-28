# E-Mode planning policy

Requested by the fork owner on 2026-10-05 to keep Aniimo speed bonuses on
primary production. These are planner exclusions, not claims that the game
cannot power a station.

Always use Aniimo at Mine, Well, Dewy House, Nimbus Bed, Tidewhisper Sandcastle,
Floral Windmill, Farmland, Starfall Hammock and Woodland. At Woodworking Bench,
keep Rough Lumber on Aniimo; at Chimney Kiln, keep Coarse-Sifted Ore on Aniimo.
Later recipes at those two stations remain eligible for E-Mode, as do other
processing stations with known E-Mode timers.

The rule applies to all setup modes, goals and automatic staffing refinements.
Variant loading, model construction and independent plan checking enforce it.
The planner chooses E-Mode only when it is useful for a valid production plan.

Known timers in `data/e_mode.csv`, including the screenshot-verified 30-minute
Quick Fresh Water timer, remain intact as in-game evidence. Saved/imported
setups use the new policy without a new setting or share-code version. Custom
rosters still need workers for protected jobs; a powered Well cannot replace a
missing Water worker for Harvest Moon order stock.
