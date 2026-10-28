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

