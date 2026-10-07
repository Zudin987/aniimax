import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACILITIES, LEVEL_UP_COSTS, SEASON, simpleSetup } from '../web/facility-config.js';
import { pkg, plan, createPlanner, newHighs } from './wasm_planner.mjs';

const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
const items = new Map(JSON.parse(pkg.get_all_items()).map(item => [item.name, item]));
const canonical = recipe => {
    const name = recipe.split('__')[0];
    return name.startsWith('quick_') && items.has(name.slice(6)) ? name.slice(6) : name;
};

async function checkedVariety(input, planner = plan) {
    let core;
    const observed = { ...pkg, exact_problem: (payload, stageJson) => {
        const stage = JSON.parse(stageJson);
        if (stage.order_core) core = stage.order_core;
        return pkg.exact_problem(payload, stageJson);
    } };
    const result = JSON.parse(await planner(observed, JSON.stringify({ ...input, order_variety: true })));
    assert.equal(result.success, true, result.error);
    assert.ok(core, 'variety must protect a checked crafted plan before adding raw stock');
    const assigned = new Map(Object.entries(result.order_allocations.gatherer_units));
    for (const [recipe, units] of Object.entries(core.gatherer_units)) {
        assert.ok((assigned.get(recipe) || 0) >= units, `raw extras displaced ${recipe}`);
    }
    for (const [recipe, rate] of Object.entries(core.gatherer_rates)) {
        assert.ok(result.order_allocations.gatherer_rates[recipe] + 1e-9 >= rate * (1 - 1e-4),
            `raw extras displaced working supply from ${recipe}`);
    }
    const stocked = new Set(result.order_stock.map(([name]) => name));
    for (const name of core.processed_stock) {
        assert.ok(items.get(name).raw_materials, `${name} must be crafted`);
        assert.ok(stocked.has(name), `raw extras displaced crafted ${name}`);
    }
    const raw = result.order_stock.filter(([name]) => !items.get(name).raw_materials);
    for (const [name] of raw) {
        const total = entries => entries.filter(([recipe]) => canonical(recipe) === name)
            .reduce((sum, [, units]) => sum + units, 0);
        assert.ok(total([...assigned]) >= total(Object.entries(core.gatherer_units)) + 1,
            `${name} must use a spare whole unit beyond RV/crafted allocations`);
    }
    assert.equal(result.order_variety.processed_count, core.processed_stock.length);
    assert.equal(result.order_variety.raw_count, raw.length);
    assert.equal(result.order_variety.count, core.processed_stock.length + raw.length);
    assert.ok(result.level_up.seconds <= result.order_variety.fastest_seconds / 0.95 * 1.001);
    return result;
}

const small = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false,
    modules: {}, facilities: { ...none, Farmland: [{ count: 4, level: 2 }],
        Woodland: [{ count: 1, level: 1 }], Mine: [{ count: 1, level: 1 }], 'Carousel Mill': [{ count: 2, level: 1 }] },
    level_up: { cost: [['coins', 100], ['wood_block', 4], ['mineral_sand', 4]], stock: [] }, exclude: [] };

test('a coin refinement timeout preserves the verified variety allocation and RV pace', async () => {
    let calls = 0;
    const interrupted = createPlanner(async () => {
        const solver = await newHighs();
        return { solve: (...args) => ++calls === 4 ? { Status: 'Time limit reached' } : solver.solve(...args) };
    });
    const result = await checkedVariety(small, interrupted);
    assert.ok(result.order_variety.processed_count >= 1);
    assert.equal(result.proven_optimal, false, 'timed-out coin refinement cannot claim optimal income');
    assert.ok(result.rate_per_second > 0);
});

test('an optional raw search timeout keeps the checked crafted plan', async () => {
    let calls = 0;
    const interrupted = createPlanner(async () => {
        const solver = await newHighs();
        return { solve: (...args) => ++calls === 3 ? { Status: 'Time limit reached' } : solver.solve(...args) };
    });
    const result = await checkedVariety(small, interrupted);
    assert.ok(result.order_variety.processed_count >= 1);
    assert.equal(result.order_variety.raw_count, 0);
    assert.equal(result.order_variety.proven, false);
});

test('occupied gathering units cannot retain raw variety even with surplus ingredients', async () => {
    const result = await checkedVariety({ ...small, facilities: { ...none,
        Farmland: [{ count: 1, level: 1 }], Woodland: [{ count: 1, level: 1 }],
        Mine: [{ count: 1, level: 1 }], 'Carousel Mill': [{ count: 1, level: 1 }] } });
    assert.deepEqual(result.order_stock.map(([name]) => name), ['wheatmeal']);
    assert.equal(result.order_variety.raw_count, 0);
    assert.ok(result.coin_items.some(row => row.status === 'producing' && row.item_name === 'wheat'),
        'required ingredients must still be grown');
});

test('RV14 with Harvest Moon protects crafted variety and festival ingredients before raw extras', async () => {
    const cost = LEVEL_UP_COSTS[15];
    const result = await checkedVariety({ ...simpleSetup(14, false), currency: 'coins', aniimo: 'minimum',
        prioritize_byproducts: false, season: true, season_currency_per_day: 600, harvest_mutation_plots: 1,
        level_up: { cost: [['coins', cost.coins], ...cost.items], stock: [] },
        exclude: SEASON.recipeNotes.map(recipe => recipe.name) });
    assert.ok(result.order_variety.processed_count > 1, 'RV14 must supply crafted order variety');
    assert.deepEqual(result.harvest_order_stock.map(row => row.item_name).sort(),
        ['apple', 'fresh_water', 'moondew_radish', 'sea_salt', 'sugarcane', 'waxing_moon_pepper']);
    for (const row of result.harvest_order_stock) assert.equal(row.units, 1);
    assert.ok(!result.order_stock.some(([name]) => result.harvest_order_stock.some(row => row.item_name === name)),
        'mandatory festival reserves do not count as extra raw variety');
});

test('real RV variety retains goods and pace in automatic, forced-power and roster plans', async () => {
    const input = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false, modules: { power_module: 1 },
        facilities: { ...none, Farmland: [{ count: 4, level: 2 }], Woodland: [{ count: 1, level: 1 }],
            Mine: [{ count: 1, level: 1 }], 'Carousel Mill': [{ count: 2, level: 1 }],
            'Claw Game Cooker': [{ count: 1, level: 1 }], 'Crackle Generator': [{ count: 1, level: 1 }] },
        level_up: { cost: [['coins', 100], ['wood_block', 4], ['mineral_sand', 4]], stock: [] }, exclude: [] };
    for (const variant of [{}, { force_e_mode: true }, { aniimo: 'roster', roster: {
        members: [{ count: 8, abilities: { Earth: 3, Grass: 3, Water: 3, Fire: 3, Wind: 3, Lightning: 3, Dark: 3 }, personalities: [] }],
        residents: [], environment: {} } }]) {
        const normal = JSON.parse(await plan(pkg, JSON.stringify({ ...input, ...variant })));
        assert.ok(normal.level_up?.seconds > 0, 'test roster must support the RV materials and crop jobs');
        const result = await checkedVariety({ ...input, ...variant });
        assert.ok(result.order_variety.processed_count >= 1, 'limited facilities must retain crafted goods first');
        assert.ok(result.level_up.seconds <= normal.level_up.seconds / 0.95 * 1.001,
            'variety may spend at most 5% of the best RV pace');
        assert.ok(result.order_stock.every(([, rate]) => rate > 0));
        assert.equal(new Set(result.order_stock.map(([name]) => name)).size, result.order_stock.length);
        assert.ok(!result.order_stock.some(([name]) => /__|^quick_/.test(name)), 'variants cannot inflate breadth');
        assert.ok(result.coin_items.some(row => row.reason.includes('/day for orders')));
        if (variant.force_e_mode) assert.ok(result.power_used > 0);
        assert.equal(normal.order_stock.length, 0, 'ordinary RV plans keep their existing behavior');
    }
});

test('festival minimum holds behind coin and EXP priorities and impossible targets explain the conflict', async () => {
    const input = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false, season: true,
        season_points_per_day: 24, season_currency_per_day: 600, harvest_mutation_plots: 0,
        exclude: SEASON.recipeNotes.map(r => r.name), modules: { resource_detector: 2 },
        facilities: { ...none, Farmland: [{ count: 4, level: 5 }], Woodland: [{ count: 1, level: 3 }],
            Well: [{ count: 1, level: 3 }], 'Tidewhisper Sandcastle': [{ count: 1, level: 2 }] } };
    for (const priorities of [['coins', 'season_points'], ['aniimo_exp', 'season_points']]) {
        const result = JSON.parse(await plan(pkg, JSON.stringify({ ...input, priorities })));
        assert.equal(result.success, true, result.error);
        assert.ok(result.season_points * 86400 >= 24 - 1e-4);
        assert.equal(result.harvest_order_stock.length, 6, 'a point floor cannot consume the raw reserve');
    }
    await assert.rejects(plan(pkg, JSON.stringify({ ...input, season_points_per_day: 1e9, priorities: ['coins'] })),
        error => error.noFallback && /minimum festival points/.test(error.message));
});
