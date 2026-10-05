# Harvest Moon raw order stock — 2026-10-05

All eight user-supplied recipe screenshots were reviewed at their original resolution.
Required amounts are the denominators beside ingredient icons; the numerators are the
player's current inventory and are not recipe quantities.

| Screenshot filename | Recipe | Facility / minimum level | Required ingredients | Workload | Points | Food Energy shown |
| --- | --- | --- | --- | --- | --- | --- |
| `image(20261005-010613).png` | Umbral Pickle | Pickling Jar 1 | 8 Moondew Radish, 8 Waxing Moon Pepper, 1 Cider Vinegar | 203 | 8 | — |
| `image(20261005-010626).png` | Cider Vinegar | Pickling Jar 2 | 8 Apple | 68 | — | — |
| `image(20261005-010637).png` | Umbral Hot Pot | Blazing Stove 1 | 8 Moondew Radish, 8 Waxing Moon Pepper, 8 Fresh Water | 203 | 8 | 38,810 |
| `image(20261005-010645).png` | Moondew Radish Slices | Blazing Stove 1 | 8 Moondew Radish, 1 Rock Candy | 203 | 4 | 45,280 |
| `image(20261005-010654).png` | Rock Candy | Simmering Pot 3 | 6 Sugarcane, 8 Fresh Water | 135 | — | — |
| `image(20261005-010703).png` | Umbral Sweet Spicy Sauce | Simmering Pot 1 | 8 Moondew Radish, 8 Waxing Moon Pepper, 23 Sea Salt | 243 | 8 | — |
| `image(20261005-010721).png` | Roasted Waxing Moon Pepper | Claw Game Cooker 1 | 8 Waxing Moon Pepper, 23 Sea Salt | 162 | 4 | 26,040 |
| `image(20261005-010729).png` | Harvest Platter | Crafting Table 1 | 1 Roasted Waxing Moon Pepper, 1 Moondew Radish Slices | 405 | 8 | — |

Ingredients, quantities, levels, workloads and festival points already agree with the
recipe data. The three visible food Energy values were missing from the seasonal data
and are now stored in its optional `energy` column. Older CSVs remain readable. These
screenshots do not verify prices, crop timers, mutation probabilities or order frequency.
The sauce's displayed name now matches the screenshot, omitting “and”; its existing
internal ID remains compatible.

## Raw dependencies and policy

Recursing through every festival recipe, including Recipe Notes not selected for
automatic production, finds exactly six raw ingredients:

| Raw ingredient | One reserved production unit | What the player may craft later |
| --- | --- | --- |
| Sugarcane | Farmland, level 5+ | Rock Candy → Radish Slices → Harvest Platter |
| Moondew Radish | Farmland, level 1+ | Radish Slices, Hot Pot, Sauce, Pickle, Platter |
| Waxing Moon Pepper | Farmland, level 1+ | Roasted Pepper, Hot Pot, Sauce, Pickle, Platter |
| Apple | Woodland, level 3+ | Cider Vinegar → Umbral Pickle |
| Fresh Water | Well, level 2+ | Rock Candy and Umbral Hot Pot |
| Sea Salt | Tidewhisper Sandcastle, level 1+ | Roasted Pepper and Sauce |

Enabling Harvest Moon reserves **one continuously producing whole unit** of each raw
ingredient. That unit's entire output stays raw, after accounting for all other recipe
inputs and sales. Extra output may follow the player's priorities. The reserve is a
constraint in every exact solve, including RV leveling, priority refinement and worker
minimization, and is independently checked before accepting a plan.

Quick dispatch recipes, uncovered environments and custom workers use their actual
yield and timer. The [E-Mode policy](e-mode-policy-2026-10-05.md) keeps Wells and other
primary stations on Aniimo. Sea Salt retains the Susuta-family restriction. The raw
stock report separates held amounts from income and points and shows the wait for a
first batch. This is ongoing production, not a claim that the player already owns an
inventory sufficient for an unknown order.

No Rock Candy, Cider Vinegar or festival dish is required to be pre-crafted. Players
craft on demand using their unlocked Notes and suitable processors; the screens verify
that Rock Candy needs Simmering Pot 3 and Cider Vinegar needs Pickling Jar 2. Holding raw
stock does not pretend to unlock these recipes. The calculator does not predict order
timing, quantities or rewards.

## Wheat and setup compatibility

Order stock always includes one Radish and one Pepper plot, even with event plots set
to zero. Higher settings require more cycling plots for mutation attempts. The minimum
Wheat spend is therefore based on `max(1, configured event plots)` per crop. Under the
existing grow-time model, the baseline spends 384/day watered, or 288/day unwatered.
The default 600/day cap still fits.

Real WASM testing exposed a related mismatch: the old model could stay within the cap
by pausing an assigned event plot, while the seed table assumed it ran continuously.
Capped event plots now run full cycles; the shown plots, seed forecast and independent
budget check agree. A 600/day cap permits three continuously watered event plots
(576/day), rather than a fourth plot with an unreported pause.

Existing saved setups and share codes need no new field: the reserve follows the
Harvest Moon toggle. Imported setups remain reviewable before calculation. Turning
the festival off releases all six reserves. Missing facilities/levels, skipped raw
ingredients, insufficient plot counts or incompatible workers report a setup error
rather than dropping a reserve. The backup heuristic cannot enforce this policy and
returns a retry message instead of an unreserved or over-budget festival plan.
