import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { harvestBudgetStatus } from '../web/harvest-budget.js';

const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
test('the actual stock renderer separates held output from sales and clears old plans', () => {
    const elements = new Map(['harvest-order-card', 'harvest-order-stock'].map(id => [id, { hidden: true, innerHTML: '' }]));
    const source = app.slice(app.indexOf('function renderHarvestOrderStock('), app.indexOf('function renderFacilityPlan('));
    const render = new Function('document', 'prettyItem', 'formatNumber', 'formatDuration', source + '\nreturn renderHarvestOrderStock;')(
        { getElementById: id => elements.get(id) }, name => name.replaceAll('_', ' '), String, n => `${n}s`);
    render({ harvest_order_stock: [{ item_name: 'magic_pumpkin', facility: 'Farmland', units: 1,
        units_per_second: 8 / 1350, first_batch_seconds: 1350 }] });
    assert.equal(elements.get('harvest-order-card').hidden, false);
    assert.match(elements.get('harvest-order-stock').innerHTML, /Held \/ day/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /magic pumpkin/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /512/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /1350s/);
    render({ success: true }); // Older imported/cached plans have no reserve report.
    assert.equal(elements.get('harvest-order-card').hidden, true);
    assert.equal(elements.get('harvest-order-stock').innerHTML, '');
});

test('the actual event budget note has optional plots and a player-set Jelly Bean cap', () => {
    const classes = new Set();
    const note = { textContent: '', classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
    let plots = 0, cap = 511;
    const source = app.slice(app.indexOf('function renderSeasonBudgetNote('), app.indexOf('function renderSeason()'));
    const render = new Function('document', 'seasonMutationPlots', 'seasonWheatBudget', 'selectedSetupTab',
        'roster', 'harvestBudgetStatus', 'formatNumber', source + '\nreturn renderSeasonBudgetNote;')(
        { getElementById: () => note }, () => plots, () => cap, () => 'best', [], harvestBudgetStatus, String);
    render();
    assert.equal(classes.has('warning'), false);
    assert.match(note.textContent, /No magical crop plots are required/);
    plots = 1;
    render();
    assert.equal(classes.has('warning'), true);
    assert.match(note.textContent, /512 Weird Jelly Beans\/day/);
    assert.match(note.textContent, /Raise the cap or lower the plot minimum/);
    cap = 600;
    render();
    assert.equal(classes.has('warning'), false);
    assert.match(note.textContent, /88 per day available/);
    plots = 2;
    render();
    assert.equal(classes.has('warning'), true);
    assert.match(note.textContent, /1024 Weird Jelly Beans\/day/);
});
