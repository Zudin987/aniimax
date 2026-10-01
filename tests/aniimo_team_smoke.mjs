import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aniimoTeamCount } from '../web/aniimo-team.js';

const row = (facility, ability, busy, bonus = true, level = 4) => ({
    facility, status: 'producing', facility_count: 1,
    aniimo_tasks: [{ ability, level, personality_bonus: bonus, busy }],
});
assert.equal(aniimoTeamCount({ coin_items: [row('Claw Game Cooker', 'Fire', 0.4), row('Simmering Pot', 'Fire', 0.3)] }), 2,
    'Compatible personalities can share one worker, plus the hauler');
assert.equal(aniimoTeamCount({ coin_items: [row('Claw Game Cooker', 'Fire', 0.4), row('Blazing Stove', 'Fire', 0.3)] }), 3,
    'Opposite personalities require separate workers');
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
console.log('Aniimo team and E-Mode staffing smoke checks passed.');
