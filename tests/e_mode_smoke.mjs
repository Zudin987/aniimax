import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACILITIES } from '../web/facility-config.js';
import { pkg, plan } from './wasm_planner.mjs';

const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));

function checkPlan(result) {
    assert.equal(result.success, true, result.error);
    for (const row of result.coin_items.filter(row => row.status === 'producing')) {
        if (row.facility === 'Farmland' || row.facility === 'Woodland') {
            assert.doesNotMatch(row.item_name, /__electric/, `crops cannot use E-Mode: ${row.item_name}`);
        }
    }
    assert.ok(result.power_used <= result.power_capacity, 'powered station draw must fit supply');
}

test('automatic E-Mode can improve output but never forces power at the expense of coins', async () => {
    for (const aniimo of ['best', 'minimum', 'roster']) {
        const base = { currency: 'coins', aniimo, prioritize_byproducts: false,
            facilities: { ...none, Mine: [{ count: 1, level: 1 }],
                'Crackle Generator': [{ count: 1, level: 1 }] },
            roster: { members: [{ count: 3, abilities: { Earth: 4, Lightning: 1 },
                personalities: ['Playful'] }], residents: [] } };
        const manual = JSON.parse(await plan(pkg, JSON.stringify({ ...base, modules: { power_module: 0 } })));
        checkPlan(manual);
        assert.equal(manual.power_used, 0, 'disabled power must leave the Mine on Aniimo');
        const auto = JSON.parse(await plan(pkg, JSON.stringify({ ...base, modules: { power_module: 1 } })));
        checkPlan(auto);
        assert.ok(auto.rate_per_second >= manual.rate_per_second - 1e-6,
            `automatic power must not reduce optimal production in ${aniimo} mode`);
    }
});

test('a Lightning-only roster can power a Mine without an Earth production worker', async () => {
    const input = { currency: 'coins', aniimo: 'roster', prioritize_byproducts: false,
        modules: { power_module: 1 },
        facilities: { ...none, Mine: [{ count: 1, level: 1 }],
            'Crackle Generator': [{ count: 1, level: 1 }] },
        roster: { members: [{ count: 2, abilities: { Lightning: 1 }, personalities: [] }],
            residents: [] } };
    const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
    checkPlan(result);
    assert.ok(result.rate_per_second > 0);
    assert.equal(result.generators_used, 1);
    assert.ok(result.power_used > 0);
    const rock = result.coin_items.find(row => row.item_name?.startsWith('rock__electric'));
    assert.ok(rock);
    assert.equal(rock.minimum_facility_level, 1);
    assert.deepEqual(result.powered_facility_tiers, [['Mine', [[1, 1]]]]);
});

test('roster planning respects the family required by each hammock product', async () => {
    for (const [family, expected, other] of [['Celestis', 'star', 'gold_speck_cap'], ['Coinwisp', 'gold_speck_cap', 'star']]) {
        const input = { currency: 'coins', aniimo: 'roster', prioritize_byproducts: false,
            facilities: { ...none, 'Starfall Hammock': [{ count: 1, level: 2 }],
                'Heat Furnace': [{ count: 1, level: 1 }], 'Cooling Unit': [{ count: 1, level: 1 }] },
            roster: { members: [{ count: 2, family, abilities: { Leisure: 3 }, personalities: [] },
                { count: 2, abilities: { Fire: 1, Ice: 1 }, personalities: [] }],
                environment: { 'Heat Furnace': 'Fire', 'Cooling Unit': 'Ice' }, residents: [] } };
        const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
        checkPlan(result);
        const rows = result.coin_items.filter(row => row.status === 'producing');
        const hammock = rows.find(row => row.facility === 'Starfall Hammock');
        assert.equal(hammock.minimum_facility_level, family === 'Coinwisp' ? 2 : 1);
        const made = rows.map(row => row.item_name);
        assert.ok(made.some(name => name === expected || name.startsWith(expected + '__')), `${family}: ${made}`);
        assert.ok(!made.some(name => name === other || name.startsWith(other + '__')), `${family}: ${made}`);
    }
});

test('mixed tiers report recipe minimums instead of owned facility levels', async () => {
    const input = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false,
        modules: { power_module: 0 }, exclude: ['clay', 'shell'],
        facilities: { ...none, Mine: [{ count: 1, level: 3 }, { count: 2, level: 5 }] } };
    const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
    checkPlan(result);
    const rows = result.coin_items.filter(row => row.facility === 'Mine' && row.status === 'producing');
    const rock = rows.find(row => row.item_name === 'rock');
    const quartz = rows.find(row => row.item_name === 'quartz_ore');
    assert.equal(rock?.facility_count, 1);
    assert.equal(rock?.minimum_facility_level, 1);
    assert.equal(quartz?.facility_count, 2);
    assert.equal(quartz?.minimum_facility_level, 5);
});
