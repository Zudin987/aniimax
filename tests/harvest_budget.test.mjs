import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { harvestBudgetStatus } from '../web/harvest-budget.js';

test('Wonder Night has optional seed cap and never reserves historical orders', () => {
    assert.deepEqual(harvestBudgetStatus(0, 600), { needed: 0, spare: 600, conflict: false, watered: true });
    assert.equal(harvestBudgetStatus(1, 600).needed, 512);
    assert.equal(harvestBudgetStatus(2, 600).needed, 1024);
    assert.equal(harvestBudgetStatus(2, 600).conflict, true);
    assert.equal(harvestBudgetStatus(1, 512).conflict, false);
    assert.equal(harvestBudgetStatus(2, null).conflict, false);
    assert.equal(harvestBudgetStatus(0, 0).conflict, false);
    assert.equal(harvestBudgetStatus(1, 511).conflict, true);
    assert.equal(harvestBudgetStatus(1, 600, false).needed, 384);
});

test('budget estimate agrees with the new event crop costs and cycle times', () => {
    const crops = fs.readFileSync(new URL('../data/magical_wonder_night.csv', import.meta.url), 'utf8')
        .trim().split('\n').slice(1).filter(row => /^(magic_pumpkin|memory_lanternfruit),/.test(row))
        .map(row => row.split(',').map(value => value.trim()));
    assert.equal(crops.length, 2);
    const needed = crops.reduce((sum, crop) => sum + Number(crop[4]) * 86400 / (Number(crop[7]) * .75), 0);
    assert.equal(harvestBudgetStatus(1, null).needed, needed);
});
