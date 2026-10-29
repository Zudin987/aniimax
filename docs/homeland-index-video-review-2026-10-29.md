# Homeland index recording review (29 October 2026)

This is a spot review of a user-provided five-minute gameplay recording, not a complete verification of game data. Times are approximate. The recording shows the in-game index; it does not demonstrate production speeds, selling prices, rewards or current placement limits.

## Confirmed examples already in the data

| Approx. time | In-game index | Existing data |
| --- | --- | --- |
| 1:18 | Wheatmeal: Carousel Mill Lv. 1, 50 Wheat | Matches `data/carousel_mill.csv` |
| 1:21 | Ginseng Powder: Carousel Mill Lv. 4, 3 Ginseng | Matches `data/carousel_mill.csv` |
| 2:00 | Premium River-Washed Stones: Crafting Table Lv. 2, 18 Rock and 5 Well Water | Matches ingredients and level in `data/crafting_table.csv` |
| 2:18 | Wheat Tea: Bouncy Brew Keg Lv. 1, 50 Wheat and 10 Well Water | Matches `data/bouncy_brew_keg.csv` |
| 2:42 | Rose Concentrate: Simmering Pot Lv. 2, 12 Rose and 8 Well Water | Matches `data/simmering_pot.csv` |
| 3:09 | Salted Cherry Blossom: Pickling Jar Lv. 1, 7 Cherry Blossom and 13 Sea Salt | Matches `data/pickling_jar.csv` |

The Candied Lanternfruit screen around 3:12 shows Pickling Jar Lv. 2, an ingredient icon labeled 8, and a Rock Candy icon, consistent with the existing seasonal row. Its first ingredient's image is blank, so that screen alone does not identify it.

## Items missing from modeled production data

The recording shows the following entries, absent from the relevant CSVs on the reviewed main branch:

| Approx. time | Index entry | What is visible |
| --- | --- | --- |
| 0:57 | Silver Ore | Mine Lv. 7 |
| 1:03 | Snowmelt Cold Spring | Well Lv. 6 |
| 1:24 | Bright Silver Powder | Carousel Mill Lv. 7; 2 Silver Ore shown by icon |
| 1:33 | Shredded Coconut Cake | Blazing Stove Lv. 6; two ingredient icons |
| 2:12 | Star Diamond | Crafting Table Lv. 8; two ingredient icons, each showing quantity 2 |

The index does not show the sale values, production workloads or gathering yields required by the optimizer. These records have therefore **not** been added to the solver. The icons in the Star Diamond screen should be identified by name in-game before assigning ingredients. Recipe requirements and E-Mode details also need confirmation.

## Still unverified

The video does not establish how Whimsy Points are earned, mutation probabilities, Pumpkin God order mechanics, or high-RV facility placement caps. The index also includes previous-season items; their presence there does not establish that Harvest Moon is active or selectable. Magical Wonder Night remains the only active season in the app.

To complete the missing production rows, capture each facility's production screen with the item selected, showing ingredient names and quantities, output per batch, workload or timer with the Aniimo efficiency, required ability level, facility level and any E-Mode details. Capture the corresponding item sale value as well. For Silver Ore and Snowmelt Cold Spring, include batch yield and any byproducts.
