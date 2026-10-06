import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { FACILITIES, simpleSetup, homeLevelForSetup } from '../web/facility-config.js';
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

test('new options round trip while old setup codes inherit conservative defaults', async () => {
    const defaults = { 'home-level': '14', 'rv-order-variety': false, 'simple-toolkit-upgrades': true,
        'season-points-min': '0', 'festival-batch-amount': '1' };
    const data = { ...defaults, 'rv-order-variety': true, 'simple-toolkit-upgrades': false,
        'season-points-min': '24', 'festival-batch-amount': '3' };
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
