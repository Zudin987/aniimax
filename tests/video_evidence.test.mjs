import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { FACILITIES, MODULE_MAX_LEVELS, LEVEL_UP_COSTS, LEVEL_UP_TIMERS, STORAGE_PLACEMENT_LIMITS, simpleSetup } from '../web/facility-config.js';

test('component upgrade gates match the video, rather than conflicting RV summary text', () => {
    // Each position is module level 1 onward. Component UI at 01:23–02:19.
    const gates = {
        ecological_module: [3, 7, 8, 11, 12, 14, 17, 18],
        kitchen_module: [2, 4, 8, 10, 13, 16, 19],
        resource_detector: [5, 8, 11, 12, 13, 15, 17, 19],
        crafting_module: [5, 7, 10, 12, 17, 18, 19],
        power_module: [12, 14, 16, 18, 20],
    };
    for (const [module, levels] of Object.entries(gates)) {
        for (let rv = 1; rv <= 20; rv++) {
            assert.equal(MODULE_MAX_LEVELS[module][rv - 1], levels.filter(gate => gate <= rv).length, `${module} at RV ${rv}`);
        }
    }
});

test('RV13 build limits and locked higher facility levels match the build menu', () => {
    const setup = simpleSetup(13);
    assert.equal(STORAGE_PLACEMENT_LIMITS[13], 5);
    assert.equal(STORAGE_PLACEMENT_LIMITS[14], undefined, 'the video does not establish other RV storage caps');
    for (const [name, count] of [['Farmland', 28], ['Woodland', 14], ['Mine', 7], ['Well', 2],
        ['Tidewhisper Sandcastle', 1], ['Dewy House', 1], ['Nimbus Bed', 1], ['Starfall Hammock', 1],
        ['Carousel Mill', 2], ['Jukebox Dryer', 2], ['Simmering Pot', 2], ['Phonolfactory Table', 2],
        ['Bouncy Brew Keg', 2], ['Woodworking Bench', 2], ['Chimney Kiln', 2], ['Joy Wheel Loom', 1],
        ['Blazing Stove', 1], ['Pickling Jar', 1], ['Dance Pad Polisher', 1], ['Aniipod Maker', 1],
        ['Crackle Generator', 1], ['Heat Furnace', 2], ['Cooling Unit', 2], ['Sunlamp', 2]]) {
        assert.equal(setup.facilities[name][0].count, count, name);
    }
    for (const [name, level, rv] of [['Farmland', 7, 16], ['Woodland', 5, 14], ['Woodland', 6, 18],
        ['Mine', 5, 15], ['Mine', 6, 18], ['Well', 5, 17], ['Nimbus Bed', 3, 16],
        ['Carousel Mill', 5, 16], ['Carousel Mill', 6, 18], ['Jukebox Dryer', 6, 14], ['Jukebox Dryer', 7, 18],
        ['Simmering Pot', 5, 15], ['Simmering Pot', 6, 18], ['Phonolfactory Table', 4, 14],
        ['Phonolfactory Table', 5, 17], ['Phonolfactory Table', 6, 19], ['Bouncy Brew Keg', 4, 17],
        ['Bouncy Brew Keg', 5, 19], ['Joy Wheel Loom', 3, 15], ['Joy Wheel Loom', 4, 19],
        ['Blazing Stove', 4, 16], ['Blazing Stove', 5, 18], ['Pickling Jar', 4, 16], ['Pickling Jar', 5, 19]]) {
        assert.equal(FACILITIES.find(f => f.name === name).unlocks[level], rv, `${name} Lv.${level}`);
    }
});

test('RV14–20 material costs and upgrade timers match the level-up screen', () => {
    const observed = [
        [14, 2620000, 'standard_planks', 1590, 'sintered_ore_brick', 1060, 6],
        [15, 3760000, 'laminated_beams', 390, 'refined_ore', 150, 7],
        [16, 4900000, 'laminated_beams', 480, 'refined_ore', 310, 8],
        [17, 8630000, 'laminated_beams', 630, 'refined_ore', 380, 9],
        [18, 11600000, 'laminated_beams', 800, 'refined_ore', 520, 10],
        [19, 17100000, 'densified_timber_component', 400, 'microcrystalline_ore_plate', 220, 11],
        [20, 20800000, 'densified_timber_component', 490, 'microcrystalline_ore_plate', 270, 12],
    ];
    for (const [rv, coins, first, a, second, b, hours] of observed) {
        assert.deepEqual(LEVEL_UP_COSTS[rv], { coins, items: [[first, a], [second, b]] });
        assert.equal(LEVEL_UP_TIMERS[rv], hours * 3600);
    }
    assert.equal(LEVEL_UP_TIMERS[13], undefined, 'already upgraded targets did not display their countdown');
});

test('real rendering functions show current recipe names and required families', () => {
    const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const labels = new Function(app.slice(app.indexOf('const ITEM_NAMES ='), app.indexOf('function isLevelUpStrategy()')) + '\nreturn ITEM_NAMES;')();
    assert.equal(labels.advanced_wind_chime, 'Premium Wind Chime');
    assert.equal(labels.advanced_gemstone_dust, 'Premium Gemstone Dust');
    assert.equal(labels.umbral_sweet_and_spicy_sauce, 'Umbral Sweet Spicy Sauce');
    const code = app.slice(app.indexOf('function taskLabel('), app.indexOf('function facilityPlanTable('));
    const taskLabel = new Function('FACILITIES', 'personalityLetter', code + '\nreturn taskLabel;')(FACILITIES, () => 'J');
    assert.match(taskLabel({ ability: 'Leisure', level: 3, personality_bonus: false }, 'Nimbus Bed'), /Nimbi family/);
    assert.match(taskLabel({ ability: 'Leisure', level: 3, personality_bonus: true }, 'Starfall Hammock'), /Celestis family/);
    assert.doesNotMatch(taskLabel({ ability: 'Fire', level: 3, personality_bonus: false }, 'Blazing Stove'), /family/);
});
