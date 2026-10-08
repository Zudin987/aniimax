import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { FACILITIES, simpleSetup, homeLevelForSetup, SIMPLE_MODULE_FIELDS } from '../web/facility-config.js';
import { normalizeSetupSettings } from '../web/setup-config.js';
import { encodeSetupCode, readSetupImport } from '../web/share-code.js';
import { festivalCraftChecklist } from '../web/festival-crafting.js';

function csv(file) {
    const [head, ...lines] = fs.readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8').trim().split('\n');
    const keys = head.split(',').map(s => s.trim());
    return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v.trim()])));
}
const recipes = FACILITIES.flatMap(f => {
    if (f.category === 'Environment' || f.category === 'Power') return [];
    return csv(`${f.slug.replaceAll('-', '_')}.csv`).map(r => ({ name: r.name, facility: f.name,
        facilityLevel: Number(r.facility_level), yieldAmount: Number(r.yield || 1),
        ingredients: r.raw_materials ? r.raw_materials.split(';') : [],
        amounts: r.required_amount ? r.required_amount.split(';').map(Number) : [], season: false }));
}).concat(csv('harvest_moon_festival.csv').map(r => ({ name: r.name, facility: r.facility,
    facilityLevel: Number(r.facility_level), yieldAmount: Number(r.yield), season: true,
    seasonSeedCost: Number(r.seed_cost), ingredients: r.raw_materials ? r.raw_materials.split(';') : [],
    amounts: r.required_amount ? r.required_amount.split(';').map(Number) : [] })));

test('RV14 Fill counts increase exactly the reported facilities and inference stays at RV14', () => {
    const current = simpleSetup(14);
    for (const [name, n] of [['Well', 3], ['Tidewhisper Sandcastle', 2], ['Joy Wheel Loom', 2],
        ['Woodworking Bench', 3], ['Chimney Kiln', 3]]) assert.equal(current.facilities[name][0].count, n);
    assert.equal(homeLevelForSetup(current), 14);
    assert.equal(homeLevelForSetup(simpleSetup(13)), 13);
    for (let rv = 1; rv <= 20; rv++) {
        assert.equal(homeLevelForSetup(simpleSetup(rv)), rv, `RV${rv}`);
        assert.ok(Object.values(simpleSetup(rv, false).modules).every(level => level === 0));
    }
});

// Issue #33 follow-up: placement counts are caps AFTER reaching an RV, not the
// Farmland/Woodland counts required on the previous RV's level-up screen.
// Independently pin the reported milestones and test every RV1–20 Fill level.
test('RV1–20 facility caps follow reported milestones without altering RV13 footage', () => {
    const milestones = {
        'Farmland': { 1: 4, 2: 6, 3: 8, 4: 10, 5: 12, 6: 14, 7: 16, 8: 18, 9: 20,
            10: 22, 11: 24, 12: 26, 13: 28, 14: 30, 15: 32, 16: 34,
            17: 36, 18: 38, 19: 40, 20: 40 },
        'Woodland': { 1: 0, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9,
            9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16,
            16: 17, 17: 18, 18: 19, 19: 20, 20: 20 },
        'Well': { 1: 0, 4: 1, 8: 2, 14: 3, 19: 4 },
        'Tidewhisper Sandcastle': { 1: 0, 5: 1, 14: 2 },
        'Dewy House': { 1: 0, 6: 1, 17: 2 },
        'Nimbus Bed': { 1: 0, 10: 1, 16: 2 },
        'Starfall Hammock': { 1: 0, 12: 1, 18: 2 },
        'Heat Furnace': { 1: 0, 7: 1, 12: 2, 17: 3 },
        'Cooling Unit': { 1: 0, 7: 1, 13: 2, 17: 3 },
        'Sunlamp': { 1: 0, 9: 1, 13: 2, 19: 3 },
        'Crackle Generator': { 1: 0, 12: 1, 15: 2, 18: 3 },
        'Blazing Stove': { 1: 0, 8: 1, 15: 2 },
        'Pickling Jar': { 1: 0, 8: 1, 15: 2 },
        'Joy Wheel Loom': { 1: 0, 7: 1, 14: 2 },
        'Woodworking Bench': { 1: 0, 6: 1, 10: 2, 14: 3, 18: 4 },
        'Chimney Kiln': { 1: 0, 6: 1, 10: 2, 14: 3, 18: 4 },
    };
    for (const [name, changes] of Object.entries(milestones)) {
        let expected = 0;
        for (let rv = 1; rv <= 20; rv++) {
            if (Object.hasOwn(changes, rv)) expected = changes[rv];
            assert.equal(simpleSetup(rv).facilities[name][0].count, expected,
                `${name} Max. Placement at RV${rv}`);
        }
    }
    // The 2026-10-03 video proves these caps only at RV13.
    for (const [name, expected] of [['Farmland', 28], ['Woodland', 14], ['Mine', 7],
        ['Well', 2], ['Dewy House', 1], ['Nimbus Bed', 1], ['Starfall Hammock', 1],
        ['Woodworking Bench', 2], ['Chimney Kiln', 2], ['Joy Wheel Loom', 1],
        ['Heat Furnace', 2], ['Cooling Unit', 2], ['Sunlamp', 2]]) {
        assert.equal(simpleSetup(13).facilities[name][0].count, expected, name);
    }
    for (let rv = 1; rv <= 20; rv++) {
        assert.equal(homeLevelForSetup(simpleSetup(rv)), rv, `Advanced RV inference for RV${rv}`);
    }
});

test('new options round trip while old setup codes inherit conservative defaults', async () => {
    const defaults = { 'home-level': '14', 'rv-order-variety': false, 'simple-toolkit-upgrades': true,
        'season-points-min': '0', 'festival-batch-amount': '1',
        ...Object.fromEntries(SIMPLE_MODULE_FIELDS.map(({ id }) => [id, 'auto'])) };
    const data = { ...defaults, 'rv-order-variety': true, 'simple-toolkit-upgrades': false,
        'season-points-min': '24', 'festival-batch-amount': '3',
        ...Object.fromEntries(SIMPLE_MODULE_FIELDS.map(({ id }) => [id, '0'])) };
    const imported = await readSetupImport(encodeSetupCode(data));
    assert.deepEqual(normalizeSetupSettings(imported.settings, defaults).settings, data);
    assert.deepEqual(normalizeSetupSettings({ 'home-level': '14' }, defaults).settings, defaults);
    for (const bad of [{ 'rv-order-variety': 'yes' }, { 'simple-toolkit-upgrades': 0 },
        { 'season-points-min': -1 }, { 'festival-batch-amount': 1.5 }]) {
        assert.throws(() => normalizeSetupSettings({ ...defaults, ...bad }, defaults));
    }
});

test('real festival checklist keeps every finished target plus ingredients for later dishes', () => {
    for (const amount of [1, 3]) {
        const list = festivalCraftChecklist(recipes, amount, simpleSetup(14));
        assert.equal(list.targets.length, 6);
        const raw = new Map(list.raw.map(r => [r.name, r.need]));
        for (const [name, need] of [['moondew_radish', 40], ['waxing_moon_pepper', 40],
            ['sugarcane', 12], ['fresh_water', 24], ['sea_salt', 69], ['apple', 8]]) assert.equal(raw.get(name), need * amount);
        assert.equal(list.wheat, 40 * amount);
        const steps = new Map(list.steps.map((r, i) => [r.name, { ...r, index: i }]));
        assert.equal(steps.get('roasted_waxing_moon_pepper').need, 2 * amount);
        assert.equal(steps.get('moondew_radish_slices').need, 2 * amount);
        assert.equal(steps.get('rock_candy').need, 2 * amount);
        assert.ok(steps.get('rock_candy').index < steps.get('moondew_radish_slices').index);
        assert.ok(steps.get('moondew_radish_slices').index < steps.get('harvest_platter').index);
        assert.ok(steps.get('cider_vinegar').index < steps.get('umbral_pickle').index);
    }
    const low = festivalCraftChecklist(recipes, 1, { ...simpleSetup(10), exclude: ['harvest_platter'] });
    assert.ok(low.blocked.some(s => s.includes('harvest_platter')));
    assert.throws(() => festivalCraftChecklist(recipes, 0));
    assert.throws(() => festivalCraftChecklist(recipes, 1.5));
    assert.throws(() => festivalCraftChecklist(recipes.filter(r => r.name !== 'rock_candy'), 1), /Missing recipe/);
});

test('variety report distinguishes crafted goods and spare-unit raw extras and clears old results', () => {
    const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const elements = new Map(['order-variety-card', 'order-variety-note', 'order-variety-stock']
        .map(id => [id, { hidden: true, innerHTML: '', textContent: '' }]));
    const source = app.slice(app.indexOf('function renderOrderVariety('), app.indexOf('function renderHarvestOrderStock('));
    const render = new Function('document', 'prettyItem', 'formatNumber', source + '\nreturn renderOrderVariety;')(
        { getElementById: id => elements.get(id) }, name => name.replaceAll('_', ' '), String);
    render({ order_variety: { count: 3, processed_count: 2, raw_count: 1, fastest_seconds: 100, proven: true },
        level_up: { seconds: 104 }, order_stock: [['wheatmeal', 1 / 86400], ['bread', 1 / 86400], ['wheat', 5 / 86400]] });
    assert.equal(elements.get('order-variety-card').hidden, false);
    assert.match(elements.get('order-variety-note').textContent, /2 crafted items, 1 raw extra stocked daily.*spare units.*4.0%/);
    assert.match(elements.get('order-variety-stock').innerHTML, /wheatmeal/);
    assert.match(elements.get('order-variety-stock').innerHTML, /Held \/ day/);
    render({ order_variety: { count: 3, fastest_seconds: 100, proven: false }, order_stock: [] });
    assert.match(elements.get('order-variety-note').textContent, /^3 items.*best found/);
    render({ success: true });
    assert.equal(elements.get('order-variety-card').hidden, true);
    assert.equal(elements.get('order-variety-stock').innerHTML, '');
});
