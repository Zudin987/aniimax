// The browser's real WASM/HiGHS planner, without an HTTP server or DOM mocks.
import assert from 'node:assert/strict';
import { pkg, plan } from './wasm_planner.mjs';
import { FACILITIES, simpleSetup, SEASON } from '../web/facility-config.js';

const items = JSON.parse(pkg.get_all_items());
const raw = ['apple', 'fresh_water', 'moondew_radish', 'sea_salt', 'sugarcane', 'waxing_moon_pepper'];
const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
const input = {
    currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false,
    season: true, harvest_mutation_plots: 0, season_currency_per_day: 600,
    // Every raw unit is needed; automatic cooking must not consume its output.
    facilities: { ...none, Farmland: [{ count: 3, level: 5 }], Woodland: [{ count: 1, level: 3 }],
        Well: [{ count: 1, level: 3 }], 'Tidewhisper Sandcastle': [{ count: 1, level: 2 }],
        'Blazing Stove': [{ count: 1, level: 3 }], 'Simmering Pot': [{ count: 1, level: 3 }],
        'Pickling Jar': [{ count: 1, level: 2 }], 'Claw Game Cooker': [{ count: 1, level: 3 }],
        'Crafting Table': [{ count: 1, level: 3 }] },
    modules: { resource_detector: 2 }, exclude: [],
};
function stockCheck(result) {
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.harvest_order_stock.map(row => row.item_name).sort(), raw);
    for (const row of result.harvest_order_stock) {
        assert.equal(row.units, 1, row.item_name);
        assert.ok(row.units_per_second > 0 && row.first_batch_seconds > 0, row.item_name);
        const supply = result.coin_items.filter(step => step.status === 'producing' && step.facility === row.facility
            && step.reason.includes("Keep 1 unit's output raw"));
        assert.ok(supply.length > 0, `${row.item_name} must appear in the facility plan`);
    }
}
function wheatPerDay(result) {
    return result.coin_items.filter(step => step.status === 'producing')
        .reduce((sum, step) => sum + (items.find(item => item.name === step.item_name)?.season_seed_cost || 0)
            * step.facility_count * 86400 / step.cycle_time, 0);
}

const held = JSON.parse(await plan(pkg, JSON.stringify(input)));
stockCheck(held);
assert.equal(held.income_streams.length, 0, 'no unit may sell its reserved output');
assert.ok(!held.coin_items.some(row => row.status === 'producing' && !row.is_grower), 'do not pre-craft festival dishes or intermediates');
assert.equal(held.season_points, 0, 'raw stock earns no points while held');
assert.equal(wheatPerDay(held), 384);
assert.ok(held.rate_per_second <= 0, 'a valid stock-only plan still accounts for regular crop seed expenses');
const time = JSON.parse(pkg.time_to_reach(JSON.stringify({ plan: held, target: 1_000, current: 0 })));
assert.equal(time.success, false, 'a stock-only plan must not claim to reach a coin goal');

const extraInput = { ...input, facilities: { ...input.facilities,
    Farmland: [{ count: 6, level: 5 }], Woodland: [{ count: 2, level: 3 }],
    Well: [{ count: 2, level: 3 }], 'Tidewhisper Sandcastle': [{ count: 2, level: 2 }] },
    priorities: ['coins', 'season_points'] };
const extra = JSON.parse(await plan(pkg, JSON.stringify(extraInput)));
stockCheck(extra);
assert.ok(extra.rate_per_second > 0, 'extra units can earn income');
assert.ok(wheatPerDay(extra) <= 600 + 1e-5, 'the shown continuously cycling plots must fit the Wheat cap');
const locked = JSON.parse(await plan(pkg, JSON.stringify({ ...input, exclude: SEASON.recipeNotes.map(r => r.name) })));
stockCheck(locked);
assert.equal(locked.income_streams.length, 0);
assert.equal(JSON.parse(pkg.plan_input_error(JSON.stringify({ ...input, season_currency_per_day: 383 })))
    .includes('384 Moonray Wheat/day'), true);
assert.equal(JSON.parse(pkg.plan_input_error(JSON.stringify({ ...input, season_currency_per_day: 0 }))), null);
const skipped = JSON.parse(pkg.plan_input_error(JSON.stringify({ ...input, exclude: ['apple'] })));
assert.match(skipped, /raw apple/);
const missing = JSON.parse(pkg.plan_input_error(JSON.stringify({ ...input,
    facilities: { ...input.facilities, Farmland: [{ count: 2, level: 5 }] } })));
assert.match(missing, /3 Farmland units/);
const fallback = JSON.parse(pkg.find_plan(JSON.stringify(input)));
assert.equal(fallback.success, false, 'a backup plan must never drop reserves');
assert.match(fallback.error, /exact planner/);

// Custom workers, lineage restrictions and power constraints must apply to reserves too.
const residents = FACILITIES.filter(f => f.family).map(f => f.name);
const team = { members: [{ count: 4, abilities: { Earth: 1, Grass: 1, Dark: 1, Water: 3 }, personalities: [] },
    { count: 1, family: 'Susuta', abilities: { Leisure: 2 }, personalities: [] }], residents };
const rosterInput = { ...input, aniimo: 'roster', roster: team };
stockCheck(JSON.parse(await plan(pkg, JSON.stringify(rosterInput))));
const wrongFamily = { ...rosterInput, roster: { ...team, members: [team.members[0], { ...team.members[1], family: 'Nimbi' }] } };
assert.match(JSON.parse(pkg.plan_input_error(JSON.stringify(wrongFamily))), /raw sea salt/);
const poweredInput = { ...input, aniimo: 'roster', force_e_mode: true,
    facilities: { ...input.facilities, Farmland: [{ count: 4, level: 5 }],
        'Carousel Mill': [{ count: 1, level: 1 }], 'Crackle Generator': [{ count: 1, level: 1 }] },
    modules: { ...input.modules, power_module: 1 },
    roster: { members: [{ count: 3, abilities: { Earth: 1, Grass: 1, Dark: 1, Lightning: 1 }, personalities: [] },
        { count: 2, abilities: { Water: 2 }, personalities: [] }, team.members[1]], residents } };
const powered = JSON.parse(await plan(pkg, JSON.stringify(poweredInput)));
stockCheck(powered);
assert.ok(powered.power_used > 0);
const water = powered.coin_items.find(row => row.status === 'producing' && row.facility === 'Well');
assert.doesNotMatch(water.item_name, /__electric/);
assert.notEqual(water.crew, null);
assert.equal(water.aniimo.ability, 'Water');
assert.equal(wheatPerDay(powered), 384);
assert.match(JSON.parse(pkg.plan_input_error(JSON.stringify({ ...poweredInput,
    roster: { ...poweredInput.roster, members: [poweredInput.roster.members[0], team.members[1]] } }))), /raw fresh water/,
    'a powered Well cannot replace the Water worker');

// Check the real RV10 Simple setup, where this event first becomes available.
const rv10 = simpleSetup(10);
stockCheck(JSON.parse(await plan(pkg, JSON.stringify({ ...extraInput, facilities: rv10.facilities,
    modules: rv10.modules, aniimo: 'best' }))));
const off = JSON.parse(await plan(pkg, JSON.stringify({ ...extraInput, season: false, priorities: [] })));
assert.deepEqual(off.harvest_order_stock, [], 'turning the event off releases the reserves');
console.log('Harvest Moon real WASM/HiGHS order-stock checks passed.');
