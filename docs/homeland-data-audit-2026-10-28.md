# Aniimo Homeland data and formula spot audit (28 October 2026)

This is a **spot audit**, not a claim that all game data or all optimizer outputs are fully verified. It compares selected rows in the repository with independent, dated community references. The automatic E-Mode model and the Harvest Moon raw-order reserve policy remain enabled.

## Independent references
- [AniimoTools: current recipe directory](https://aniimotools.dev/systems/recipes/) — updated 16 October 2026; covers work-rate tables, recipe inputs, timings, outputs and electric variants.
- [AniimoTools: Carousel Mill](https://aniimotools.dev/systems/homeland/stations/carousel-mill/) and [Mine](https://aniimotools.dev/systems/homeland/stations/mine/) — both dated 25 October 2026.
- [AniimoTools: Woodworking Bench](https://aniimotools.dev/systems/homeland/stations/woodworking-bench/) — dated 27 October 2026.
- [Aniiland: Wheat/watering worked example](https://aniiland.pages.dev/guides/watering-example/) — browser result tested 21 October 2026.
- [Aniiland: calculation methodology](https://aniiland.pages.dev/guides/how-aniiland-works) — documents solver assumptions, validation flags and unmodeled events.

## Checked values

| Local file | Independent check | Result |
| --- | --- | --- |
| `data/farmland.csv` | Wheat: 5 items per 240 seconds; 1 coin per item. Two waterings shorten grow timer by 25%. Four plots make 300 unwatered items/hour or 400 fully watered items/hour: `4 * 5 * 3600 / 180 = 400`. | Matches source values and Aniiland's worked example. |
| `data/carousel_mill.csv` | Wheatmeal consumes 50 Wheat, takes 54 work and sells for 70 coins. Raw Wheat is worth 50 coins; the *incremental sale value* is 20 coins per Wheatmeal, before staffing/other costs. | Matches AniimoTools. |
| `data/mine.csv` | Rock produces 6 × 7 coins = 42 coins per completed batch plus 3 Mineral Sand; 900 work. | Matches AniimoTools. |
| `data/woodworking_bench.csv`, `data/chimney_kiln.csv` | Each tier consumes 8 previous-tier items, except the final tier's 4; workloads are 34, 34, 41, 41. | Woodworking Bench confirmed with AniimoTools; the ore chain follows the same local rule. |
| `src/models.rs` and `README.md` | Manual processing work at recommended level is 60 work/min; one level higher is 180; one matching station personality improves speed by 20%. | Consistent with AniimoTools work-rate descriptions. |

`tests/production_formula.test.mjs` locks down the deterministic arithmetic and checks the discontinued feature switches do not reappear.

## Differences requiring in-game confirmation

**Electric recipe eligibility is a policy choice, not a missing timer.** AniimoTools lists powered recipes for Rough Lumber, Coarse-Sifted Ore and the Well. The local [E-Mode policy](e-mode-policy-2026-10-05.md) intentionally **keeps** first-tier RV materials and primary gathering on Aniimo to preserve speed/production requirements; see the policy's explicit statement that this is not a claim the game cannot power these stations. Do not copy the site's electric list into the planner automatically.

**Not fully re-verified:** The game may change RV-level placement limits, exact power-band thresholds, storage/hauling delays and some recipe records. `data/unverified.csv` still lists `scales` and `quick_scales` at Floral Windmill. The absence of additional discrepancies in this spot sample is **not proof** the whole dataset is current.

## What projected income does not guarantee

Steady-state production rates assume the selected tasks are executed continuously at modeled efficiency. Actual income may be lower with walking/hauling, full output bins, missing workers, food changes, manual interactions, player absence, random mutation or newly locked recipes. An optimal MIP result only proves optimality **within the encoded model and data**; it is not a proof of best possible live gameplay income. Watering and ingredient opportunity costs must be considered when comparing recipe profit.
