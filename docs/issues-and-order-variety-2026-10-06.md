# Issue review and RV order variety

Reviewed fork main `00db3b41bef26f698922e634379e653c3403e16c` and upstream
main `c1544149ec162fa7c7bc447c5415103b4eafc62c`, issue bodies/comments,
open PRs and Actions on 2026-10-06. Fork main CI/Pages passed; no fork
issues or PRs were open. Upstream's only new main change since the last
review concerns issue templates. Its E-Mode and localization PRs remain open.

| Open upstream issue | Fork behavior |
| --- | --- |
| [#29 Toolkit recipes](https://github.com/ae-bii/aniimax/issues/29) | Simple has five editable module-level selectors before calculation: RV max, 0 (not upgraded), or an owned level up to the selected RV cap. A master checkbox sets all to RV max or all to 0. Default stays at RV max; old unticked codes/saves restore all zeroes. Individual values persist in saves, setup codes and links, independently of Advanced's module inputs. |
| [#32 Festival points and seed limits](https://github.com/ae-bii/aniimax/issues/32) | Existing whole-plot Wheat limits and raw ingredient reserves remain. Optional minimum festival points/day is a constraint in every exact solve, including RV and non-coin priority solves. Zero leaves strict priority behavior unchanged. Impossible targets fail visibly. |
| [#33 RV14–20 Fill](https://github.com/ae-bii/aniimax/issues/33) | RV14 originally fixed five caps and Advanced RV inference. The October 7 issue follow-up extends placement corrections through RV19 and reports no Farmland/Woodland increment at RV20. All RV1–20 milestone caps are covered by regressions. The October 3 recording verifies RV13 placement and RV12–20 level-up requirements only, NOT RV14–20 placement caps. |
| [#34 Every festival recipe](https://github.com/ae-bii/aniimax/issues/34) | A finite checklist accepts X of each of the six dishes. It includes additional roasted peppers/slices consumed by platters, aggregates shared ingredients, rounds batches, lists raw quantities and Wheat, and orders prerequisites before dependent dishes. Missing Recipe Notes, skipped recipes, modules and facility levels are reported. It is a crafting checklist, not a fastest finite-horizon schedule. |

## Issue #33: later placement caps (2026-10-07 follow-up)

The October 3 user recording remains the authority for **RV13** placement caps, RV12–20
level-up conditions and upgrade timers. Its level-up screen requirements (e.g. 40 Farmland
and 20 Woodland to reach RV20) are **not** evidence of RV20 max placement counts.
The reporter manually checked their higher-RV build allowances against aniimotools.dev;
the following are reporter-supplied observations, not independently video-verified caps.

| RV reached | Corrected/checked Max. Placement |
| --- | --- |
| 14 | Well 3, Tidewhisper Sandcastle 2, Joy Wheel Loom 2, Woodworking Bench 3, Chimney Kiln 3 (original fix) |
| 15 | Blazing Stove 2, Pickling Jar 2, Crackle Generator 2 (already correct) |
| 16 | Nimbus Bed 2 |
| 17 | Cooling Unit 3, Dewy House 2, Heat Furnace 3 |
| 18 | Chimney Kiln 4, Starfall Hammock 2, Woodworking Bench 4, Crackle Generator 3 (already correct) |
| 19 | Sunlamp 3, Well 4, Farmland 40, Woodland 20 |
| 20 | Farmland 40, Woodland 20 (stay at RV19 caps, **not** 42/21) |

The listed counts remain at the last observed value until the next recorded increase,
without extrapolating additional facilities or power-generation counts. Adjustments
flow into both Simple and Advanced Fill from a single facility-cap table, and Advanced
RV inference uses that same table. Unit regression snapshots pin every RV1–20 level;
browser smoke exercises the Fill button at RV14–20. Sources: issue #33 and
`docs/game-evidence-2026-10-03.md`.

## RV-first variety

“Add order variety” is an optional Level-up checkbox, off in old/default setups.
First find the best resource pace for the entered facilities, worker setup,
inventory, E-Mode rules and festival limits. Keep at least 95% of that pace
(at most about 5.3% longer resource gathering, excluding the fixed upgrade timer),
then maximize distinct crafted products retained daily. Raw ingredients cannot
compete with crafted products for variety.

Updated on 2026-10-07 after the RV14 screenshot showed raw crops/ores appearing
as order variety. Rechecked fork main `4ab766925a76e841f24a8bcf349b51c8ac9e98d3`,
upstream main and open issues/PRs/Actions before changing the planner. Upstream
main and the four open issue bodies were unchanged; no upstream writes were made.

Among equally broad crafted plans, prefer fewer gathering units. Rebuild and
independently check that plan, then protect its gathering allocations, working
supply rates and crafted stock. These come directly from the solver so roster
and uncovered variants retain their identities. A separate search adds raw stock only if it assigns an additional
whole gathering unit beyond those allocations. Surplus output from a protected
ingredient unit alone does not qualify as a spare slot. This phase has a
five-second limit; without a feasible answer, keep the checked crafted plan.
Required RV ingredients and the six festival reserves still run even when no
spare slots remain.

Each retained product gets the smallest regular/quick recipe batch yield in
the available variants per day. Quick, electric, uncovered and roster variants
count as the same product. A real output balance subtracts retained items
before sales and RV resources; merely consuming an ingredient does not count
as stocking it. Six raw festival reserves are excluded from this extra-stock
count, because they are already retained separately.

After crafted then raw breadth, maximize extra coin income; when power is available, minimize
the Aniimo team without losing the RV pace, protected allocations, stock or income. Force E-Mode
still requires real eligible powered work; all previous manual exclusions hold.
Variety is not applied if the RV target is already funded or unreachable.
Facilities can remain idle when ingredients, workers, tiers, grid capacity or
RV pace prevent another product. Real order lists/quantities are not known,
so breadth is an order-readiness heuristic, not a guaranteed coverage percentage.

The report counts crafted items and raw extras separately from income and compares RV resource
time with the best pace found. Timed-out searches are labeled; the 95% figure
is relative to the best feasible pace found, not a proof of the unknown optimum.
If the later income search finds no plan before timing out, the already-found
variety allocation is rebuilt and checked rather than discarded.

## Archived requests

Reviewed all 27 comments on closed upstream [#1](https://github.com/ae-bii/aniimax/issues/1)
and the other closed issues. Existing fork functionality already covers the
ranked priorities, seed forecasts, environment overlap, specific worker families,
rosters, multiple storage placement, saved settings and calculator sharing.

Remaining larger requests are not silently claimed as complete: generating
game Combo Codes has no verified external API; general finite inventory-aware
multi-phase optimization, feed consumption targets, and complete translations
need separate modeling or verified data. The checklist does not compute Aniimo
availability, current inventory, optimal machine scheduling or an ETA. It uses
standard crop inputs and does not guess mutation probabilities.

## Regression coverage

Native tests cover retained balances, shared processor limits, duplicate quick
variants, the RV pace floor, protected gathering allocations, spare-unit raw
stock, forged plans and mandatory points with coin goals.
Real WASM/HiGHS tests cover Automatic, Force E-Mode and roster variety, points
behind coin/EXP priorities, impossible targets, fully occupied gatherers, RV14
with festival reserves and both raw-search/income-refinement timeouts. JS tests cover corrected
RV inference, setup compatibility and exact event quantities/crafting order.
Browser smoke covers import/persistence, Fill, pre-calculation checklist,
actual variety calculation, and desktop/mobile rendering.
Simple module regressions cover partial upgrades, RV caps, old all-or-none codes,
reloads/sharing, separate Advanced values, the real solver payload and Quick Potato gating.
