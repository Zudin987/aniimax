# Automatic E-Mode recipe eligibility (updated 28 October 2026)

Aniimax now uses the same **verified E-Mode recipes** that are already listed in
`data/e_mode.csv`, including Mines, Wells, Rough Lumber and Coarse-Sifted Ore.
Those recipes have electric timers in public game data; the previous blanket
exclusion was a *planner preference*, not a game restriction. Remove the
exclusion so the solver can make the optimal choice rather than forcing Aniimo.

Every eligible station still retains its **normal Aniimo-worked recipe**.
The exact solver weighs income, RV materials, the actual powered facility level,
generator output, global E-Mode efficiency, its Lightning worker and the other
staffing needs. Powered recipes do **not** mean the user must power the station.
No "Force E-Mode" toggle is offered.

**Farmland and Woodland stay unpowered:** crops and trees require growing plots
and applicable worker/watering rules; they do not have fixed electric recipe
timers in the current game table. Every other facility can use E-Mode only when
a matching positive, unique fixed timer exists in `data/e_mode.csv`.

The E-Mode data records (including 27-second first-tier Bench/Kiln recipes,
15-minute Rock and 30-minute Well/Mine jobs) are corroborated by public
recipe/production listings: [Wikily Rough Lumber](https://wikily.gg/aniimo/homeland-crafting/recipes/rough-lumber-4010169),
[Wikily Coarse-Sifted Ore](https://wikily.gg/aniimo/homeland-crafting/recipes/coarse-sifted-ore-40101741),
[Wikily Rock](https://wikily.gg/aniimo/homeland-crafting/recipes/rock-40010531),
and [AniimoTools](https://aniimotools.dev/systems/homeland/stations/mine/).

**Model limitations:** E-Mode grid coverage and Power Pole layout still require
in-game confirmation; the planner separately optimizes production and sketches
physical placement. Supply above 100% can reach the modeled 120% band, but the
power-starved lower-efficiency curve is not modeled. This is not a guarantee
of maximum observed coins/hour in every real Home.
