import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACILITIES, simpleSetup } from '../web/facility-config.js';
import { pkg, plan } from './wasm_planner.mjs';

test('real Simple module levels gate Quick Potato without disabling other Toolkit modules', async () => {
    const none = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
    const crops = JSON.parse(pkg.get_all_items()).filter(item => item.facility === 'Farmland');
    for (const level of ['1', '3']) {
        const setup = simpleSetup(9, true, { ecological_module: level, kitchen_module: '0' });
        const input = { ...setup, currency: 'coins', aniimo: 'best', prioritize_byproducts: false,
            facilities: { ...none, Farmland: setup.facilities.Farmland },
            exclude: crops.filter(item => !['potato', 'quick_potato'].includes(item.name)).map(item => item.name) };
        const result = JSON.parse(await plan(pkg, JSON.stringify(input)));
        assert.equal(result.success, true, result.error);
        assert.ok(result.rate_per_second > 0);
        const producing = result.coin_items.filter(row => row.status === 'producing');
        assert.ok(producing.length > 0);
        const expected = level === '1' ? /^potato(?:__|$)/ : /^quick_potato(?:__|$)/;
        for (const row of producing) assert.match(row.item_name, expected);
        assert.equal(input.modules.kitchen_module, 0);
        assert.equal(input.modules.resource_detector, 2, 'other modules keep their own RV max');
    }
});
