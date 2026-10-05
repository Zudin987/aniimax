import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACILITIES } from '../web/facility-config.js';
import { pkg, plan } from './wasm_planner.mjs';

const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
const protectedStations = new Set(['Mine', 'Well', 'Dewy House', 'Nimbus Bed', 'Tidewhisper Sandcastle',
    'Floral Windmill', 'Farmland', 'Starfall Hammock', 'Woodland']);
function checkPolicy(result) {
    assert.equal(result.success, true, result.error);
    for (const row of result.coin_items.filter(row => row.status === 'producing')) {
        if (protectedStations.has(row.facility) || /^(rough_lumber|coarse_sifted_ore)(?:__|$)/.test(row.item_name)) {
            assert.doesNotMatch(row.item_name, /__electric/, `${row.facility}: ${row.item_name}`);
        }
    }
}

test('automatic E-Mode keeps the Mine on workers in every Aniimo setup', async () => {
    for (const aniimo of ['best', 'minimum', 'roster']) {
        const input = { currency: 'coins', aniimo, prioritize_byproducts: false, modules: { power_module: 1 },
            facilities: { ...none, Mine: [{ count: 1, level: 1 }], 'Crackle Generator': [{ count: 1, level: 1 }] },
            roster: { members: [{ count: 3, abilities: { Earth: 4, Lightning: 1 }, personalities: ['Playful'] }], residents: [] } };
        const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
        checkPolicy(result);
        assert.ok(result.rate_per_second > 0);
        assert.equal(result.power_used, 0);
        assert.equal(result.generators_used, 0);
        const forced = JSON.stringify({ ...input, force_e_mode: true });
        assert.match(JSON.parse(pkg.plan_input_error(forced)), /eligible processing recipe/);
        await assert.rejects(plan(pkg, forced), error => error.noFallback && /eligible processing recipe/.test(error.message));
    }
});

test('RV materials keep first stages manual while later stages can use real E-Mode', async () => {
    const input = { currency: 'coins', aniimo: 'minimum', prioritize_byproducts: false,
        force_e_mode: true, modules: { power_module: 1 },
        facilities: { ...none, Woodland: [{ count: 1, level: 1 }], Mine: [{ count: 1, level: 1 }],
            'Woodworking Bench': [{ count: 2, level: 2 }], 'Chimney Kiln': [{ count: 2, level: 2 }],
            'Crackle Generator': [{ count: 1, level: 1 }] },
        level_up: { cost: [['standard_planks', 64], ['sintered_ore_brick', 64]], stock: [] } };
    const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
    checkPolicy(result);
    assert.ok(result.level_up?.seconds > 0);
    assert.ok(result.power_used > 0);
    const producing = result.coin_items.filter(row => row.status === 'producing');
    for (const first of ['rough_lumber', 'coarse_sifted_ore']) {
        assert.ok(producing.some(row => row.item_name === first), `must still make ${first} with Aniimo`);
    }
    assert.ok(producing.some(row => /^(standard_planks|sintered_ore_brick)__electric/.test(row.item_name)),
        'one of the later Bench/Kiln stages must satisfy Force E-Mode');
});

test('a level-one Bench or Kiln cannot satisfy Force E-Mode with its protected recipe', () => {
    for (const facility of ['Woodworking Bench', 'Chimney Kiln']) {
        const input = { currency: 'coins', aniimo: 'minimum', force_e_mode: true, modules: { power_module: 1 },
            facilities: { ...none, [facility]: [{ count: 1, level: 1 }], 'Crackle Generator': [{ count: 1, level: 1 }] } };
        assert.match(JSON.parse(pkg.plan_input_error(JSON.stringify(input))), /eligible processing recipe/);
        input.facilities[facility][0].level = 2;
        assert.equal(JSON.parse(pkg.plan_input_error(JSON.stringify(input))), null,
            'upgrading unlocks an eligible recipe without changing the saved Force E-Mode setting');
    }
});
