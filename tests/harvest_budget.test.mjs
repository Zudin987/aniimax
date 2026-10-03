import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { harvestBudgetStatus } from '../web/harvest-budget.js';

test('default reserve fits 600/day, two per crop conflicts, and zero means unlimited', () => {
    assert.deepEqual(harvestBudgetStatus(1, 600), { needed: 384, spare: 216, conflict: false, watered: true });
    assert.equal(harvestBudgetStatus(2, 600).conflict, true);
    assert.equal(harvestBudgetStatus(2, 600).needed, 768);
    assert.equal(harvestBudgetStatus(2, 768).conflict, false);
    assert.equal(harvestBudgetStatus(2, null).conflict, false);
    assert.equal(harvestBudgetStatus(0, 600).needed, 0);
    assert.equal(harvestBudgetStatus(2, 600, false).needed, 576);
    assert.equal(harvestBudgetStatus(2, 600, false).conflict, false);
});

test('budget estimate stays in sync with the modeled event seed costs and grow timers', () => {
    const rows = fs.readFileSync(new URL('../data/harvest_moon_festival.csv', import.meta.url), 'utf8')
        .split('\n').slice(1).filter(line => /^(moondew_radish|waxing_moon_pepper),/.test(line))
        .map(line => line.split(',').map(part => part.trim()));
    assert.equal(rows.length, 2);
    const wheat = rows.reduce((sum, row) => sum + Number(row[4]) * 86400 / (Number(row[7]) * .75), 0);
    assert.equal(harvestBudgetStatus(1, null).needed, wheat);
});
