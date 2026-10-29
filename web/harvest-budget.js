// Magical Wonder Night: both new crops cost four Weird Jelly Beans per
// planting and have a 30-minute card timer, modeled with optional watering
// reducing production time to 75%. No minimum crop reserve is automatic.
export function harvestBudgetStatus(plots, budget, watered = true) {
    const seconds = 1800 * (watered ? 0.75 : 1);
    const count = Math.max(0, Number(plots) || 0);
    const needed = count * 2 * 4 * 86400 / seconds;
    return { needed, spare: budget === null ? null : Math.max(0, budget - needed),
        conflict: budget !== null && budget + 1e-9 < needed, watered };
}
