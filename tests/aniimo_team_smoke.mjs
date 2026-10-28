import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aniimoTeamCount } from '../web/aniimo-team.js';
import { SIMPLE_MODULE_FIELDS } from '../web/facility-config.js';

const row = (facility, ability, busy, bonus = true, level = 4) => ({
    facility, status: 'producing', facility_count: 1,
    aniimo_tasks: [{ ability, level, personality_bonus: bonus, busy }],
});
assert.equal(aniimoTeamCount({ coin_items: [row('Claw Game Cooker', 'Fire', 0.4), row('Simmering Pot', 'Fire', 0.3)] }), 2,
    'Compatible personalities can share one worker, plus the hauler');
assert.equal(aniimoTeamCount({ coin_items: [row('Claw Game Cooker', 'Fire', 0.4), row('Blazing Stove', 'Fire', 0.3)] }), 3,
    'Opposite personalities require separate workers');
assert.equal(aniimoTeamCount({ coin_items: [row('Nimbus Bed', 'Leisure', 0.4), row('Starfall Hammock', 'Leisure', 0.3)] }), 3,
    'Compatible personalities cannot merge Nimbi and Celestis families');
assert.equal(aniimoTeamCount({ coin_items: [], generator_tiers: [[1, 1], [3, 2]] }), 4,
    'Every active generator needs its own resident, plus the hauler');
assert.equal(aniimoTeamCount({ coin_items: [{ crew: 0, status: 'producing', busy_units: 0.1, facility_count: 1 }],
    staffing: [['Crackle Generator Lv.1', 1, 1]], grower_staffing: [['rice', 'Sowing', 0, 0.2]] },
    { aniimo: 'roster', roster: { members: [{ count: 2 }, { count: 1 }], residents: [] } }), 2,
    'Roster jobs share a member, while the generator remains staffed');

// Exercise the actual worker's staging/acceptance code, with deterministic solver replies.
const source = fs.readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('// Seconds HiGHS'), source.indexOf('// Ranks changes'));
const options = [];
const exactPlanJson = new Function('newHighs', 'aniimoTeamCount', `${code}\nreturn exactPlanJson;`)(
    async () => ({ solve(lp, opt) {
        options.push({ lp, ...opt });
        return { Status: 'Optimal', ObjectiveValue: lp === 'FREE' ? -1 : 10, Columns: { x0: { Primal: 1 } } };
    } }), aniimoTeamCount);
const base = { success: true, rate_per_second: 10, power_capacity: 600, power_used: 0,
    coin_items: [row('Carousel Mill', 'Wind', 0.1), row('Jukebox Dryer', 'Dark', 0.1), row('Crafting Table', 'Artisanship', 0.1)] };
const candidate = { success: true, rate_per_second: 10, power_capacity: 600, power_used: 45,
    coin_items: [], generator_tiers: [[1, 1]] };
const stages = [];
const pkg = {
    exact_byproduct_problems: () => '[]', exact_level_up_problem: () => '{}',
    exact_priority_problem: () => '{}',
    exact_problem: (_, stage) => {
        const s = JSON.parse(stage); stages.push(s);
        return JSON.stringify({ lp: s.free_aniimo ? 'FREE' : 'COINS', variables: 1 });
    },
    exact_plan: (_, stage) => JSON.stringify(JSON.parse(stage).free_aniimo ? candidate : base),
};
let plan = JSON.parse(await exactPlanJson(pkg, JSON.stringify({ aniimo: 'best', priorities: [] })));
assert.equal(plan.workforce_optimized, true);
assert.equal(plan.aniimo_slots_saved, 2);
assert.equal(stages.at(-1).coins, base.rate_per_second, 'Staffing preserves the verified production rate');
assert.equal(options.at(-1).time_limit, 5, 'Staffing refinement has a short time budget');

pkg.exact_plan = (_, stage) => JSON.stringify(JSON.parse(stage).free_aniimo
    ? { ...candidate, coin_items: [...base.coin_items, row('Well', 'Water', 1, false)] } : base);
plan = JSON.parse(await exactPlanJson(pkg, JSON.stringify({ aniimo: 'best', priorities: [] })));
assert.equal(plan.power_used, 0, 'A refinement that increases the real team is rejected');
assert.equal(plan.workforce_optimized, undefined);
assert.equal(plan.rate_per_second, 10, 'The verified production plan survives a rejected staffing refinement');

const setupInput = { aniimo: 'minimum', priorities: [], modules: { power_module: 1 },
    facilities: { 'Crackle Generator': [{ count: 1, level: 1 }] },
    level_up: { cost: [['coins', 1000]], stock: [] } };
const budgetError = 'Harvest Moon: 2 mutation plots per crop need at least 768 Moonray Wheat/day.';
pkg.plan_input_error = () => JSON.stringify(budgetError);
await assert.rejects(exactPlanJson(pkg, JSON.stringify(setupInput)), error => error.noFallback && error.message === budgetError);
new Function('self', 'ready', 'exactPlanJson', source.slice(source.indexOf('self.onmessage =')))(
    self, Promise.resolve({ find_plan: () => { backupCalls++; return JSON.stringify(base); } }),
    async () => { throw Object.assign(new Error(budgetError), { noFallback: true }); });
await self.onmessage({ data: { id: 2, type: 'find_plan', payload: '{}' } });
assert.equal(backupCalls, 0, 'A conflicting season budget is not hidden by a Normal-only backup plan');
assert.equal(JSON.parse(replies.at(-1).result).error, budgetError);

// Both UI payload paths must omit the retired flags while retaining regular plan inputs.
const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const getInputsCode = app.slice(app.indexOf('function getPlanInputValues()'), app.indexOf('// parseInt/parseFloat'));
for (const simple of [true, false]) {
    const getInputs = new Function('document', 'isSimpleMode', 'getSimpleSetup', 'selectedHomeLevel',
        'activePriorities', 'levelUpInput', 'excludedRecipes', 'seasonActive', 'FACILITIES', 'facilityTiers',
        'numberOrDefault', 'isLevelUpStrategy', 'floatOrDefault', `${getInputsCode}\nreturn getPlanInputValues;`)(
        { getElementById: id => ({ checked: ['simple-toolkit-upgrades'].includes(id), value: '1' }) },
        () => simple, () => ({ facilities: setupInput.facilities, modules: setupInput.modules }), () => 12,
        () => [], () => setupInput.level_up, () => [], () => false,
        [{ name: 'Crackle Generator' }], setupInput.facilities, Number, () => true, Number);
    const input = getInputs();
    assert.equal(Object.hasOwn(input, 'force_e_mode'), false);
    assert.equal(Object.hasOwn(input, 'order_variety'), false);
    assert.equal(input.season_points_per_day, 0);
    assert.deepEqual(input.level_up, setupInput.level_up);
    assert.deepEqual(input.priorities, [], 'RV plans do not require Home Coins only');
}
const persisted = new Function('SIMPLE_MODULE_FIELDS', app.slice(app.indexOf('function getPersistedFieldIds()'), app.indexOf('// Reads and parses'))
    + '\nreturn getPersistedFieldIds();')(SIMPLE_MODULE_FIELDS);
assert.ok(!persisted.includes('force-e-mode') && !persisted.includes('rv-order-variety'),
    'Removed settings are no longer persisted');
for (const { id } of SIMPLE_MODULE_FIELDS) assert.ok(persisted.includes(id), `${id} survives saves and sharing`);
console.log('Aniimo team and E-Mode staffing smoke checks passed.');
