// Browser's real WASM/HiGHS planner for the current Magical Wonder Night season.
import assert from 'node:assert/strict';
import { pkg, plan } from './wasm_planner.mjs';
import { FACILITIES, SEASON } from '../web/facility-config.js';

const items = JSON.parse(pkg.get_all_items());
const base = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
const input = {
    currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false,
    season: true, harvest_mutation_plots: 0, season_currency_per_day: 600,
    facilities: { ...base, Farmland: [{ count: 4, level: 5 }],
        Sunlamp: [{ count: 1, level: 1 }] },
    modules: {}, exclude: SEASON.recipeNotes.map(r => r.name),
};

assert.equal(SEASON.name, 'Magical Wonder Night');
assert.equal(SEASON.currency, 'Weird Jelly Beans');
assert.equal(SEASON.recipeNotes.length, 7);
for (const name of ['magic_pumpkin', 'memory_lanternfruit']) {
    const crop = items.find(item => item.name === name);
    assert.ok(crop, name);
    assert.equal(crop.season_seed_cost, 4);
    assert.equal(crop.yield_amount, 8);
    assert.equal(crop.facility_level, 5);
    assert.equal(crop.environment, 'Adequate');
}
assert.ok(!items.some(item => item.name === 'moondew_radish'));
assert.equal(JSON.parse(pkg.plan_input_error(JSON.stringify(input))), null);
assert.match(JSON.parse(pkg.plan_input_error(JSON.stringify({
    ...input, harvest_mutation_plots: 1, season_currency_per_day: 511,
}))), /512 Weird Jelly Beans\/day/);
assert.match(JSON.parse(pkg.plan_input_error(JSON.stringify({
    ...input, harvest_mutation_plots: 2, season_currency_per_day: 600,
}))), /1024 Weird Jelly Beans\/day/);

const zero = JSON.parse(await plan(pkg, JSON.stringify(input)));
assert.equal(zero.success, true, zero.error);
assert.deepEqual(zero.harvest_order_stock, [], 'unrequested Pumpkin God orders are never reserved');
assert.equal(zero.season_points, 0, 'unverified sale-based Whimsy scoring must be disabled');

const limited = JSON.parse(await plan(pkg, JSON.stringify({ ...input, harvest_mutation_plots: 1 })));
assert.equal(limited.success, true, limited.error);
assert.deepEqual(limited.harvest_order_stock, []);
const crops = limited.coin_items.filter(row => row.status === 'producing'
    && ['magic_pumpkin', 'memory_lanternfruit'].includes(row.item_name));
for (const name of ['magic_pumpkin', 'memory_lanternfruit']) {
    assert.ok(crops.some(row => row.item_name === name && row.facility_count >= 1), name);
}
const spent = crops.reduce((sum, row) => sum + 4 * row.facility_count * 86400 / row.cycle_time, 0);
assert.ok(spent <= 600 + 1e-5, 'planted event crops must fit the player-set seed budget');

const noBudget = JSON.parse(pkg.plan_input_error(JSON.stringify({
    ...input, harvest_mutation_plots: 2, season_currency_per_day: 0,
})));
assert.equal(noBudget, null, 'zero spending limit means unlimited');

const disabled = JSON.parse(await plan(pkg, JSON.stringify({ ...input, season: false })));
assert.equal(disabled.success, true, disabled.error);
assert.ok(!disabled.coin_items.some(r => ['magic_pumpkin', 'memory_lanternfruit'].includes(r.item_name)));
assert.equal(disabled.season_points, null);
console.log('Magical Wonder Night real WASM/HiGHS regression checks passed.');
