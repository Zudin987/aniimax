# Magical Wonder Night — pre-release evidence, 2026-10-29

**Status: staging only.** The current, deployed Aniimax calculator must continue using Harvest Moon data. This file and `data/magical_wonder_night.csv` prepare a separate season; nothing automatically switches seasons. The announcement provided by the player says that **Magical Wonder Night** begins *after the December 10, 2026 version update*, lasts until 03:59 on December 10 in the listed server's UTC offset, and is open at RV 10 after the festival tutorial quest. Confirm the actual regional start/end dates before launch; the supplied end-time wording is ambiguous.

## Evidence

The player provided 19 in-game screenshots from the Seed Shop and individual material cards, plus an announcement covering the new season, Dream Spark Exchange, Home level additions and conversion of old season currencies. Product names and quantities below are direct visual transcriptions, not inferred from similar Harvest Moon recipes.

| Product | Station / minimum level | Input / quantity | Yield | Base time or workload | Home Coins | Whimsy Point shown |
| --- | --- | --- | --- | --- | ---: | ---: |
| Magic Pumpkin | Farmland Lv.5 | one seed at 4 pink seasonal tokens | 8 | 30 minutes | 61 | 1 |
| Memory Lanternfruit | Farmland Lv.5 | one seed at 4 pink seasonal tokens | 8 | 30 minutes | 61 | 1 |
| Sea Salt Roasted Pumpkin | Claw Game Cooker Lv.4 | Magic Pumpkin 8 + Sea Salt 23 | 1 | workload 135 | 1,180 | 8 |
| Magic Pumpkin Cake | Blazing Stove Lv.2 | Magic Pumpkin 8 + Wheatmeal 1 | 1 | workload 135 | 1,120 | 10 |
| Magic Pumpkin Lantern | Crafting Table Lv.4 | Magic Pumpkin 8 | 1 | workload 68 | 650 | 8 |
| Candied Lanternfruit | Pickling Jar Lv.2 | Memory Lanternfruit 8 + Rock Candy 1 | 1 | workload 203 | 2,260 | 8 |
| Gleam Fruit Nectar | Bouncy Brew Keg Lv.2 | Memory Lanternfruit 8 + Plain Fresh Water 8 | 1 | workload 135 | 1,180 | 10 |
| Golden Lantern Pumpkin Soup | Simmering Pot Lv.3 | Magic Pumpkin 8 + Memory Lanternfruit 8 + Plain Fresh Water 8 | 1 | workload 203 | 1,830 | 20 |
| Memory Lantern | Crafting Table Lv.4 | Memory Lanternfruit 8 + Cotton Thread 1 | 1 | workload 135 | 1,220 | 8 |
| Honey-Glazed Pumpkin Cup | Blazing Stove Lv.2 | Sea Salt Roasted Pumpkin 1 + Candied Lanternfruit 1 | 1 | workload 338 | 4,430 | 4 |
| Glowfruit Lantern Set | Crafting Table Lv.5 | Memory Lantern 1 + Magic Pumpkin Lantern 1 | 1 | workload 243 | 2,710 | 4 |

Both Farmland crop cards state **Adequate** sunlight environment and **1,350 Energy**. Verified processed-product Energy: Sea Salt Roasted Pumpkin 25,920; Magic Pumpkin Cake 30,190; Candied Lanternfruit 86,250. The other cards do not show an Energy value, so the CSV leaves it blank.

Source card names map to the existing data keys `wheatmeal`, `sea_salt`, `rock_candy`, `fresh_water` (displayed as *Plain Fresh Water*) and `cotton_thread`. New names are snake_case, following the existing data style.

## Mechanics that need independent confirmation before enabling

1. The seed-shop icon is a pink seasonal token and the two seeds each cost **4**. The screenshots do not identify the token's official name, how many tokens are earned per day, or whether the old Moonray Wheat 600/day budgeting assumption still applies. **Do not reuse the Harvest Moon cap without evidence.**
2. Whimsy Points are listed on crop and crafted-item tooltips. The screenshots alone do not prove whether points are granted by *selling*, *crafting*, *offering*, or another event interaction. Aniimax's current season model assumes points per sale; confirm before using these values as an optimization objective.
3. The seed cards themselves show **Whimsy Point +2** separately from the actual crop's **+1**. Seed-card tooltip points are **not** recorded as crop-production points in the CSV.
4. The new season's manual-order raw-stock rules, mutation plot requirements, recipe unlocks/Notes, crop watering-speed effect and E-Mode timings are not established by these screenshots.
5. The announcement says the old **Moonbeam Wheat** seed currency and old event seeds become Home Coins at rollover, and **Waxing Moondew** mutation exchange currency becomes **Wonder Sugar Crystal**. These are two separate conversion statements; neither establishes the new seed token's exact name.
6. New RV upgrades, weather, blueprint features and three-story RV require their own screenshots of costs, timing and constraints; this dataset does not invent those values.

## Integration plan

Keep `data/harvest_moon_festival.csv` and its existing UI unchanged until the release is confirmed. Once the new season mechanics are verified, add a season selector/activation policy and distinct per-season currency/budget/points handling in WASM and the UI, migrate old saved settings carefully, update the recipe checklist and optimizer tests, then run full CI/browser tests. **Do not merge this staging PR as a claim that Magical Wonder Night is playable in Aniimax yet.**
