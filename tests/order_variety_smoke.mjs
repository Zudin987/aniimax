import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACILITIES, SEASON } from '../web/facility-config.js';
import { pkg, plan } from './wasm_planner.mjs';

const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));

test('real RV variety retains goods and pace in automatic, forced-power and roster plans', async () => {
    const input = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false, modules: { power_module: 1 },
        facilities: { ...none, Farmland: [{ count: 4, level: 2 }], Woodland: [{ count: 1, level: 1 }],
            Mine: [{ count: 1, level: 1 }], 'Carousel Mill': [{ count: 2, level: 1 }],
            'Claw Game Cooker': [{ count: 1, level: 1 }], 'Crackle Generator': [{ count: 1, level: 1 }] },
        level_up: { cost: [['coins', 100], ['wood_block', 4], ['mineral_sand', 4]], stock: [] }, exclude: [] };
    for (const variant of [{}, { force_e_mode: true }, { aniimo: 'roster', roster: {
        members: [{ count: 8, abilities: { Earth: 3, Grass: 3, Water: 3, Fire: 3, Wind: 3, Lightning: 3 }, personalities: [] }],
        residents: [], environment: {} } }]) {
        const normal = JSON.parse(await plan(pkg, JSON.stringify({ ...input, ...variant })));
        const result = JSON.parse(await plan(pkg, JSON.stringify({ ...input, ...variant, order_variety: true })));
        assert.equal(result.success, true, result.error);
        assert.ok(result.order_variety?.count >= 3, 'limited facilities must retain a useful mix');
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
