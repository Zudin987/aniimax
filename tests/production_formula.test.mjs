import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

function csv(name) {
    const rows = fs.readFileSync(new URL(`../data/${name}.csv`, import.meta.url), 'utf8').trim().split(/\r?\n/);
    const headers = rows.shift().split(',').map(value => value.trim());
    return Object.fromEntries(rows.map(line => {
        const fields = line.split(',').map(value => value.trim());
        const record = Object.fromEntries(headers.map((key, index) => [key, fields[index]]));
        return [record.name, record];
    }));
}

test('Wheat throughput agrees with timer, yield and two watering reductions', () => {
    const wheat = csv('farmland').wheat;
    const plots = 4, secondsPerHour = 3600;
    const unwatered = plots * Number(wheat.yield) * secondsPerHour / Number(wheat.production_time);
    const watered = plots * Number(wheat.yield) * secondsPerHour / (Number(wheat.production_time) * (1 - 2 / 8));
    assert.equal(unwatered, 300);
    assert.equal(watered, 400);
    assert.equal(Number(wheat.cost), 0);
    assert.equal(Number(wheat.sell_value), 1);
});

test('Wheatmeal coin value must account for the wheat consumed', () => {
    const wheat = csv('farmland').wheat, meal = csv('carousel_mill').wheatmeal;
    assert.equal(Number(meal.workload), 54);
    assert.equal(Number(meal.required_amount), 50);
    assert.equal(Number(meal.sell_value) - Number(meal.required_amount) * Number(wheat.sell_value), 20);
});

test('Ore and RV crafting tiers preserve verified input and byproduct math', () => {
    const rock = csv('mine').rock;
    assert.equal(Number(rock.yield) * Number(rock.sell_value), 42);
    assert.equal(Number(rock.byproduct_yield), 3);
    const wood = csv('woodworking_bench'), ore = csv('chimney_kiln');
    for (const chain of [[wood, ['rough_lumber', 'standard_planks', 'laminated_beams', 'densified_timber_component']],
        [ore, ['coarse_sifted_ore', 'sintered_ore_brick', 'refined_ore', 'microcrystalline_ore_plate']]]) {
        assert.deepEqual(chain[1].map(item => Number(chain[0][item].required_amount)), [8, 8, 8, 4]);
        assert.deepEqual(chain[1].map(item => Number(chain[0][item].workload)), [34, 34, 41, 41]);
    }
});


test('Real E-Mode data enables fast RV stages and powered raw production', () => {
    const timers = csv('e_mode');
    const examples = { rough_lumber: 27, coarse_sifted_ore: 27, rock: 900,
        clay: 1800, fresh_water: 1800, quick_fresh_water: 1800 };
    for (const [name, expected] of Object.entries(examples)) {
        assert.equal(Number(timers[name]?.production_time), expected, name);
    }
    for (const [name, row] of Object.entries(timers)) {
        assert.ok(Number.isFinite(Number(row.production_time)) && Number(row.production_time) > 0,
            `E-Mode timer ${name} must be finite and positive`);
    }
    const source = fs.readFileSync(new URL('../data/e_mode.csv', import.meta.url), 'utf8');
    const names = source.trim().split(/\r?\n/).slice(1).map(line => line.split(',')[0]);
    assert.equal(new Set(names).size, names.length, 'E-Mode source cannot contain duplicate recipe names');
});

test('Deprecated options have no frontend or planner entry points', () => {
    const files = ['web/index.html', 'web/app.js', 'web/worker.js', 'web/setup-config.js',
        'src/wasm.rs', 'src/exact.rs', 'src/models.rs'];
    for (const path of files) {
        const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
        for (const term of ['force_e_mode', 'force-e-mode', 'rv-order-variety', 'order_variety']) {
            assert.equal(source.includes(term), false, `${path} retains ${term}`);
        }
    }
});
