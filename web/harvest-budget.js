// Matches the current CSV: each of the two mutation crops costs 4 Wheat per
// planting and grows for 40 minutes, or 30 minutes after both watering jobs.
export function harvestBudgetStatus(plots, budget, watered = true) {
    const seconds = 2400 * (watered ? .75 : 1);
    const needed = plots * 2 * 4 * 86400 / seconds;
    return { needed, spare: budget === null ? null : Math.max(0, budget - needed),
        conflict: budget !== null && budget + 1e-9 < needed, watered };
}
