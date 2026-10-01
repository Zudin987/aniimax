import { FACILITIES, personalityLetter, opposedPersonality } from './facility-config.js';

// Count the team with the same whole-slot and compatible-personality rules as the Team card.
// The worker uses this to reject a staffing refinement that would increase the displayed team.
export function aniimoTeamCount(plan, input = {}) {
    if (input.aniimo?.startsWith('roster')) {
        const members = input.roster?.members || [];
        const residents = new Set(input.roster?.residents || []);
        const busy = members.map(() => 0);
        for (const row of plan.coin_items || []) {
            if (row.status !== 'producing' || row.crew == null || !members[row.crew]) continue;
            busy[row.crew] += residents.has(row.facility) ? row.facility_count : (row.busy_units ?? row.facility_count);
        }
        for (const [, member, share] of plan.staffing || []) if (members[member]) busy[member] += share;
        for (const [, , member, share] of plan.grower_staffing || []) if (members[member]) busy[member] += share;
        return members.reduce((sum, member, i) => sum + Math.min(member.count, Math.max(0, Math.ceil(busy[i] - 1e-6))), 0);
    }
    const groups = new Map();
    for (const row of plan.coin_items || []) {
        for (const task of row.aniimo_tasks || []) {
            const personality = task.personality_bonus ? FACILITIES.find(f => f.name === row.facility)?.personality : null;
            const label = `${task.ability} Lv.${task.level}${personality ? ` · ${personality} (${personalityLetter(personality)})` : ''}`;
            if (!groups.has(label)) groups.set(label, { label, ability: task.ability, level: task.level, bonus: task.personality_bonus, personality, busy: 0 });
            groups.get(label).busy += task.busy;
        }
    }
    const resident = (label, ability, level, count) => {
        if (!count || !ability) return;
        if (!groups.has(label)) groups.set(label, { label, ability, level, busy: 0, environment: true });
        groups.get(label).busy += count;
    };
    const environmentAbility = { 'Heat Furnace': 'Fire', 'Cooling Unit': 'Ice', Sunlamp: 'Light' };
    const pairs = new Map();
    for (const a of plan.environment_assignments || []) {
        if (a.partner) {
            const key = `${a.building}|${a.partner[0]}`;
            pairs.set(key, Math.max(pairs.get(key) || 0, a.units));
        } else {
            resident(`${environmentAbility[a.building]} any level`, environmentAbility[a.building], 1, a.units);
        }
    }
    for (const [key, count] of pairs) {
        for (const building of key.split('|')) resident(`${environmentAbility[building]} any level`, environmentAbility[building], 1, count);
    }
    for (const [tier, count] of plan.generator_tiers || []) {
        const level = tier <= 1 ? 1 : tier === 2 ? 2 : 3;
        resident(`Lightning Lv.${level} (generator)`, 'Lightning', level, count);
    }
    const rows = [...groups.values()].sort((a, b) => b.level - a.level || Number(!!b.bonus) - Number(!!a.bonus) || a.label.localeCompare(b.label));
    const kept = [];
    for (const row of rows) {
        const host = row.environment ? null : kept.find(k => k.ability === row.ability && k.level >= row.level
            && k.spare >= row.busy - 1e-6 && (!row.personality || !k.personalities.has(opposedPersonality(row.personality))));
        if (host) {
            host.spare -= row.busy;
            if (row.personality) host.personalities.add(row.personality);
        } else {
            const count = Math.max(1, Math.ceil(row.busy - 1e-6));
            kept.push({ ...row, count, spare: count - row.busy, personalities: new Set(row.personality ? [row.personality] : []) });
        }
    }
    return kept.reduce((sum, row) => sum + row.count, 1); // The Team card includes one hauler.
}
