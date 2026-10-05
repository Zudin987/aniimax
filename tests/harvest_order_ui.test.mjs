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
    render({ harvest_order_stock: [{ item_name: 'moondew_radish', facility: 'Farmland', units: 1,
        units_per_second: 8 / 1800, first_batch_seconds: 1800 }] });
    assert.equal(elements.get('harvest-order-card').hidden, false);
    assert.match(elements.get('harvest-order-stock').innerHTML, /Held \/ day/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /moondew radish/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /384/);
    assert.match(elements.get('harvest-order-stock').innerHTML, /1800s/);
    render({ success: true }); // Older imported/cached plans have no reserve report.
    assert.equal(elements.get('harvest-order-card').hidden, true);
    assert.equal(elements.get('harvest-order-stock').innerHTML, '');
});

test('the actual budget note preserves order stock at zero and explains a too-small cap', () => {
    const classes = new Set();
    const note = { innerHTML: '', classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
    let plots = 0, cap = 383;
    const source = app.slice(app.indexOf('function renderSeasonBudgetNote('), app.indexOf('function renderSeason()'));
    const render = new Function('document', 'seasonMutationPlots', 'seasonWheatBudget', 'selectedSetupTab',
        'roster', 'harvestBudgetStatus', 'formatNumber', source + '\nreturn renderSeasonBudgetNote;')(
        { getElementById: () => note }, () => plots, () => cap, () => 'best', [], harvestBudgetStatus, String);
    render();
    assert.equal(classes.has('warning'), true);
    assert.match(note.innerHTML, /Order stock still keeps 1 plot of each event crop/);
    assert.match(note.innerHTML, /384 Wheat\/day/);
    assert.doesNotMatch(note.innerHTML, /reduce extra event plots/, 'mandatory raw stock cannot be reduced');
    cap = 600;
    render();
    assert.equal(classes.has('warning'), false);
    assert.match(note.innerHTML, /216\/day remains/);
    plots = 2;
    render();
    assert.match(note.innerHTML, /768 Wheat\/day/);
    assert.match(note.innerHTML, /reduce extra event plots/);
});
