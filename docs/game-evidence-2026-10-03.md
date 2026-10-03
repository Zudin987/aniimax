# Homeland evidence — 2026-10-03 recording

Source: user-provided `2026 10 03 17 05 52.mp4`, 1280×720, 30 fps,
duration 274.25 seconds (4:34.25). SHA-256:
`203eb946f485a610d0d61ddcedd924db0dbae3728e3b0a36fbb4dfbd8c9a1d81`.
The player is at RV 13 throughout. The entire timeline was reviewed at 0.5-second
intervals, with full-resolution close-ups of the relevant UI. The audio is silent.
Timestamps below refer to this recording, not the wall clock in its filename.

## Timeline and scope

| Time | Screens reviewed | Useful evidence |
| --- | --- | --- |
| 0:00–0:03 | Homeland overview | Current RV 13 |
| 0:03–1:09 | RV level-up pages 1–20, including scrolling the unlock lists | Placement, habitability, title and quest requirements; resident caps; Home Season at RV 10; costs and countdowns for RV 14–20 |
| 1:09–1:17 | RV overview and rotation | Navigation, no additional production values |
| 1:17–1:23 | Rest Module | Maximum stamina bonus; no Aniimo recovery or duty-cycle measurement |
| 1:23–1:42 | Ecological Module | Each Quick crop/tree recipe and its component/RV gate |
| 1:42–1:53 | Kitchen Module | Feeding unlock and Premium recipes |
| 1:53–2:03 | Resource Detector | Quick gathering recipes |
| 2:03–2:11 | Crafting Module | Premium/Advanced recipe names and unlocks |
| 2:11–2:20 | Power Module | Generator tiers and Power Pole availability |
| 2:20–2:25 | Plant Research Module | Mutation types and qualitative chance increases |
| 2:25–2:27 | Incubation Reaction Module | Hatching efficiency upgrade, no numeric multiplier |
| 2:27–2:32 | Signal Transmitter | Dispatch and RV Park capacity, distinct from Homeland residents |
| 2:32–3:04 | Build menu, Materials Production | Placement caps and higher facility-level gates |
| 3:04–3:47 | Build menu, Materials Processing | Placement caps, higher levels and E-Mode descriptions |
| 3:47–4:04 | Item Production, auxiliary facilities and Hatchinator | Lightning machines, generators, environment devices, storage and egg station |
| 4:04–4:11 | Nimbus Bed formula and Quick Wool tooltip | Price, yield, workload, Nimbi family |
| 4:11–4:15 | Sandcastle formula and Quick Sea Salt tooltip | Price, yield, workload, Susuta family |
| 4:15–4:20 | Dewy House formula and Quick Aromathyst tooltip | Price, yield, workload, Dewy family |
| 4:20–4:24 | Well formula and Quick Fresh Water tooltip | Price, yield and fixed E-Mode time |
| 4:24–4:29 | Home Management map navigation | Layout and multiple Storage Units; no measured hauling rate |
| 4:29–4:34.25 | Starfall Hammock formula and Star tooltip | Price, yield, workload, Cool environment, Celestis family |

## Production and Aniimo families

| Recipe | Facility level | Unit price | Batch yield | Workload / displayed time | Evidence |
| --- | --- | --- | --- | --- | --- |
| Quick Wool | Nimbus Bed 2 | 140 | 6 | 2,700 workload | 4:07.5–4:10 |
| Quick Sea Salt | Sandcastle 2 | 16 | 23 | 2,250 workload | 4:12–4:13.5 |
| Quick Aromathyst | Dewy House 2 | 56 | 12 | 2,700 workload | 4:17.5–4:19 |
| Quick Fresh Water | Well 3 | 46 | 17 | 30m fixed recipe time in E-Mode | 4:21.5–4:22 |
| Star | Starfall Hammock (no upgrades) | 390 | 2 | 2,700 workload; recommends Cool | 4:31–4:34 |

These numeric values already match the CSVs. Star is now removed from the
unverified list. Scales and Quick Scales are **not** verified by merely seeing the
Floral Windmill in the build menu.

| Resident station | Required Aniimo family | Explicit family tooltip |
| --- | --- | --- |
| Tidewhisper Sandcastle | Susuta | 4:12.5–4:13.5 |
| Dewy House | Dewy | 4:18.5–4:19 |
| Nimbus Bed | Nimbi | 4:09–4:10 |
| Starfall Hammock | Celestis | 4:32–4:34 |

The tooltips describe which family may be assigned to production at the station,
not an interchangeable Leisure worker. The model now applies this station
restriction alongside the existing ability/level requirements to its recipes.
Family and ability are independent: the correct family with too little Leisure
still cannot make a recipe. The family is a lineage, not a nickname; evolved
members are represented by the same family selection.

The exact planner and independent plan recheck enforce family membership.
Best/Minimum recommendations identify the family; staffing refinement keeps
families in separate worker pools. Old roster saves/codes remain readable, with
missing families treated as unspecified and a review hint before calculation.
An unspecified member may still work ordinary jobs. Floral Windmill's required
family is not shown, so its family is not guessed.

The live timers beside the current production icons (for example Wool at 1m58s
and Aromathyst at 23m31s) count down during filming. They are **remaining** times,
not fresh-cycle durations. The Well tooltip has a time and no worker portrait,
consistent with the visible E-Mode controls: its 30m must not replace the normal
mode's workload or imply an Aniimo speed measurement.

## Component upgrade screens

Each list is in module-level order, beginning at level 1. These are availability
gates, not proof that a player has bought the upgrade. The recording's RV13
player owns Ecological 5, Kitchen 5, Resource Detector 5, Crafting 4 and Power 1.

| Component | Required RV levels | Unlocks, in component-level order |
| --- | --- | --- |
| Ecological | 3, 7, 8, 11, 12, 14, 17, 18 | Quick Wheat; Quick Bamboo; Quick Potato; Quick Lemon; Quick Rice; Quick Maple Syrup; Quick Strawberry; Quick Coconut |
| Kitchen | 2, 4, 8, 10, 13, 16, 19 | Aniimo Feeding; Premium Bread; Premium Potato Soup; Premium Sweet Rice Wine; Premium Salted Lemon; Premium Jello; Premium Berry Chocolate Coconut Pudding |
| Resource Detector | 5, 8, 11, 12, 13, 15, 17, 19 | Quick Well Water; Quick Sea Salt; Quick Aromathyst; Quick Fresh Water; Quick Wool; Quick Deep Rock Spring Water; Quick Natural Mineral Water; Quick Scales |
| Crafting | 5, 7, 10, 12, 17, 18, 19 | Premium River-Washed Stones; Premium Rose Freshener; Advanced Lemon Incense; Premium Wind Chime; Premium Soap; Premium Gemstone Dust; Premium Mixed Perfume |
| Power | 12, 14, 16, 18, 20 | Crackle Generator levels 1–5; Power Pole at level 1, increased Pole placement limit at later levels |

The source's RV/module gates and recipe requirements already match these
screens. Two display names are corrected: `advanced_wind_chime` is displayed as
**Premium Wind Chime**, and `advanced_gemstone_dust` as **Premium Gemstone Dust**.
Internal recipe IDs remain stable for old codes, saved skips and priorities.
Advanced setup now explicitly asks for **purchased** module levels, rather than
assuming an RV unlock means the Toolkit upgrade is owned.

Costs visible for upgrades the player does not own:

| Component | Level → Home Coins + Toolkits |
| --- | --- |
| Ecological | 6 → 12,000 + 1; 7 → 22,000 + 1; 8 → 28,000 + 1 |
| Kitchen | 6 → 20,000 + 1; 7 → 30,000 + 1 |
| Resource Detector | 6 → 14,000 + 1; 7 → 22,000 + 1; 8 → 30,000 + 1 |
| Crafting | 5 → 22,000 + 1; 6 → 28,000 + 1; 7 → 30,000 + 1 |
| Power | 2 → 12,000 + 1; 3 → 20,000 + 1; 4 → 28,000 + 1; 5 → 30,000 + 1 |
| Plant Research | 2 → 3,600 + 2; 3 → 8,700 + 2; 4 → 14,000 + 2 |
| Incubation Reaction | 1 → 3,600 + 2 |
| Signal Transmitter | 3 → 20,000 + 2 |

### Conflicting RV summary text

The RV level-up unlock summaries are not fully consistent with the component
screens in this same recording. Examples:

- RV13 summary says Resource Detector level 4; the component screen shows level
  5 available at RV13 and already purchased.
- RV16 summary says Ecological level 7; that component's level 7 explicitly
  requires RV17.
- RV18 summary says Ecological level 9, but the component picker ends at level 8.

Do not change recipe gates to those conflicting summary numbers. The specific
component's upgrade conditions and its working owned state are the evidence used
for availability. The discrepancy itself remains an in-game UI uncertainty.

## RV progression

The level-up conditions describe what must already be placed **before** reaching
the target. They must not be mistaken for that target RV's new placement caps.
For example, RV14 requires 28 Farmland / 14 Woodland / 7 Mines; the actual RV13
build menu already allows those counts.

| Target RV | Farmland / Woodland placement requirements | Other visible requirements |
| --- | --- | --- |
| 2 | 4 / — | The Wondrous RV quest |
| 3 | 6 / 3 | Together with Aniimo quest |
| 4 | 8 / 4 | 2 Mines; Richer Yields quest |
| 5 | 10 / 5 | 1 Well; New Recipes quest |
| 6 | 12 / 6 | 3 Mines; Time to Explore: Part 1 quest |
| 7 | 14 / 7 | Student III title; Environmental Control System: Part 1 quest |
| 8 | 16 / 8 | 4 Mines; Dream Cottage: Part 1 quest |
| 9 | 18 / 9 | 2 Wells |
| 10 | 20 / 10 | 5 Mines; 13,000 habitability; Dream Cottage: Part 2 quest; Home Season unlock |
| 11 | 22 / 11 | 13,500 habitability; Wayfarer I; Festival of Astra quest |
| 12 | 24 / 12 | 6 Mines; 14,000 habitability; Facilities, Orders, and Life: Part 1 quest |
| 13 | 26 / 13 | 14,500 habitability |
| 14 | 28 / 14 | 7 Mines; 15,000 habitability; Facilities, Orders, and Life: Part 2 quest |
| 15 | 30 / 15 | 15,500 habitability; Wayfarer II |
| 16 | 32 / 16 | 8 Mines; 16,000 habitability |
| 17 | 34 / 17 | 17,000 habitability |
| 18 | 36 / 18 | 9 Mines; 18,000 habitability |
| 19 | 38 / 19 | 19,000 habitability; Wayfarer III |
| 20 | 40 / 20 | 10 Mines; 20,000 habitability; Lucky Gift quest |

Costs and countdowns visible from 0:03–0:05 and 0:41.5–1:09:

| Target | Home Coins | Materials | Separate upgrade timer |
| --- | --- | --- | --- |
| RV14 | 2,620,000 | 1,590 Standard Planks + 1,060 Sintered Ore Brick | 6h |
| RV15 | 3,760,000 | 390 Laminated Beams + 150 Refined Ore | 7h |
| RV16 | 4,900,000 | 480 Laminated Beams + 310 Refined Ore | 8h |
| RV17 | 8,630,000 | 630 Laminated Beams + 380 Refined Ore | 9h |
| RV18 | 11,600,000 | 800 Laminated Beams + 520 Refined Ore | 10h |
| RV19 | 17,100,000 | 400 Densified Timber Components + 220 Microcrystalline Ore Plates | 11h |
| RV20 | 20,800,000 | 490 Densified Timber Components + 270 Microcrystalline Ore Plates | 12h |

The costs match the existing data. The UI now calls the production estimate
**Resources for RV …**, explains that it is time to afford the upgrade, and shows
the verified separate timer. It does not predict how long a player needs for the
other prerequisites. Earlier countdowns are not extrapolated: already upgraded
pages do not show their costs or timers.

## Build menu at RV13

These values are **Max. Placement**, not the currently owned thumbnail quantity
or level. Earlier RV caps not displayed here retain their previous evidence;
higher RV placement counts are not newly verified by this video.

| Facilities selected | RV13 placement cap | Locked higher facility levels shown |
| --- | --- | --- |
| Farmland | 28 | Lv7 → RV16 |
| Woodland | 14 | Lv5 → RV14; Lv6 → RV18 |
| Mine | 7 | Lv5 → RV15; Lv6 → RV18 |
| Well | 2 | Lv5 → RV17 |
| Tidewhisper Sandcastle | 1 | All 3 levels available |
| Dewy House | 1 | Both levels available |
| Nimbus Bed | 1 | Lv3 → RV16 |
| Starfall Hammock | 1 | No level picker |
| Floral Windmill | 1 when unlocked | Requires RV18; not available at RV13 |
| Carousel Mill | 2 | Lv5 → RV16; Lv6 → RV18 |
| Jukebox Dryer | 2 | Lv6 → RV14; Lv7 → RV18 |
| Simmering Pot | 2 | Lv5 → RV15; Lv6 → RV18 |
| Phonolfactory Table | 2 | Lv4 → RV14; Lv5 → RV17; Lv6 → RV19 |
| Bouncy Brew Keg | 2 | Lv4 → RV17; Lv5 → RV19 |
| Woodworking Bench, Chimney Kiln | 2 each | Lv3 → RV14; Lv4 → RV18 |
| Joy Wheel Loom | 1 | Lv3 → RV15; Lv4 → RV19 |
| Blazing Stove | 1 | Lv4 → RV16; Lv5 → RV18 |
| Pickling Jar | 1 | Lv4 → RV16; Lv5 → RV19 |
| Dance Pad Polisher, Aniipod Maker | 1 each | Three levels, all available; earlier gates are not shown |
| Crackle Generator | 1 | Levels 2–5 require the corresponding Power Module upgrade |
| Heat Furnace, Cooling Unit, Sunlamp | 2 each | No level picker |
| Storage Unit | 5 | Hauling transfers facility produce into storage |
| Hatchinator | 10 | Egg hatching; no production recipe data shown |

The source's displayed facility level gates and RV13 production/environment caps
match. Storage's **5 at RV13** is an additional observed cap. Generated RV13
layouts now use at most five, with a visible explanation if the requested count
is higher. The imported/saved preference is preserved. Other RV levels retain
the user-entered count and explicitly ask the player to check their in-game cap;
the video does not show that progression. Storage positioning does not establish
numerical hauling throughput.
Crafting Table and Claw Game Cooker thumbnails are visible, but their own detail
cards are not selected here, so no new cap/recipe confirmation is claimed for them.

## Useful mechanics that need further measurement

| Mechanic | What is established | What remains unknown / model treatment |
| --- | --- | --- |
| Plant Research 1, RV6 | Unlocks Colorful; raises Giant chance | No probabilities, mutation yields, seed rules or event-specific interactions. Harvest reservation still creates attempts, not predicted rewards. |
| Plant Research 2, RV9 | Unlocks Shining; raises Giant and Colorful chance | Costs 3,600 coins + 2 Toolkits; no numeric expected-value model |
| Plant Research 3, RV12 | Unlocks Crystalline and other special mutations; raises Giant, Colorful and Shining chance | Costs 8,700 + 2; names of all special types and numeric odds not shown |
| Plant Research 4, RV15 | Raises chance of all mutation types | Costs 14,000 + 2; no numeric odds |
| Rest Module | Level 1 increases maximum stamina 3%; level 3 at RV5 shows 10% | Does not establish Aniimo work stamina drain, recovery, rest scheduling or a production multiplier |
| Incubation Reaction 1, RV9 | Raises Homeland Hatchinator efficiency; 3,600 coins + 2 Toolkits | No numeric multiplier or egg timer; hatching is outside current production objectives |
| Signal Transmitter 1/2/3 | RV6/11/16; RV Park holds 1/2/3 Aniimo; Dispatch, Adventure, Camping | RV Park slots are not Homeland resident slots. Dispatch travel/rewards and any resident interaction are not measured. |
| Power Poles | Power Module 1 unlocks them; later upgrades raise placement limits | Exact Pole caps, ranges and overloaded-grid scaling are absent. Existing separately verified power bands are unchanged. |
| Family restrictions | Four station families explicitly shown | Floral Windmill's family, each evolution's ability levels and family-specific bonuses are not shown. Selection does not infer species abilities. |
| Storage and map layout | Multiple Storage Units, fixed station footprints and a hauling description | This does not measure travel-speed penalties, assignment walking distance, storage cap progression or rest interruptions. Layout distance remains a placement heuristic. |

The regression tests capture the facts that affect existing calculation or UI.
No unseen numeric probability, stamina schedule, recipe price, facility cap or
work-speed multiplier is invented from descriptive upgrade text.
