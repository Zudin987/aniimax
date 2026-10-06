// Finite crafting quantities, independent of the steady-state income/RV optimizer.
// Aggregate shared ingredients before rounding batches so prerequisites are counted once.
export function festivalCraftChecklist(recipes, amount, setup = {}) {
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw new Error('Choose a whole amount from 1 to 100000.');
    const all = new Map(recipes.map(r => [r.name, r]));
    const targets = recipes.filter(r => r.season && r.ingredients.length);
    if (!targets.length) throw new Error('Recipe data is still loading. Try again shortly.');
    const visited = new Set(), visiting = new Set(), ordered = [];
    function visit(name) {
        if (visited.has(name)) return;
        if (visiting.has(name)) throw new Error(`Recipe cycle at ${name}.`);
        const recipe = all.get(name);
        if (!recipe) throw new Error(`Missing recipe data: ${name}.`);
        visiting.add(name);
        recipe.ingredients.forEach(visit);
        visiting.delete(name); visited.add(name); ordered.push(recipe);
    }
    targets.forEach(r => visit(r.name));
    const demand = new Map(targets.map(r => [r.name, amount]));
    const rows = new Map();
    for (const recipe of [...ordered].reverse()) {
        const need = demand.get(recipe.name) || 0;
        const batches = Math.ceil(need / recipe.yieldAmount);
        rows.set(recipe.name, { ...recipe, need, batches, produced: batches * recipe.yieldAmount });
        recipe.ingredients.forEach((name, i) => demand.set(name, (demand.get(name) || 0) + batches * recipe.amounts[i]));
    }
    const blocked = [];
    for (const recipe of ordered) {
        const owned = setup.facilities?.[recipe.facility];
        if (owned && !owned.some(t => t.count > 0 && t.level >= recipe.facilityLevel)) {
            blocked.push(`${recipe.name}: needs ${recipe.facility} Lv.${recipe.facilityLevel}`);
        }
        const requirement = recipe.moduleRequirement;
        if (requirement && (setup.modules?.[requirement[0]] || 0) < requirement[1]) {
            blocked.push(`${recipe.name}: needs ${requirement[0]} Lv.${requirement[1]}`);
        }
        if (setup.exclude?.includes(recipe.name)) blocked.push(`${recipe.name}: skipped or Recipe Note not ticked`);
    }
    const raw = ordered.filter(r => !r.ingredients.length).map(r => rows.get(r.name));
    const steps = ordered.filter(r => r.ingredients.length).map(r => rows.get(r.name));
    return { raw, steps, blocked,
        wheat: raw.reduce((sum, r) => sum + r.batches * (r.seasonSeedCost || 0), 0),
        targets: targets.map(r => ({ name: r.name, amount })) };
}
