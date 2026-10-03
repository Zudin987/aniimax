// Validate portable settings before touching the form or the browser's saved setup.
import { FACILITIES, MAX_HOME_LEVEL, PERSONALITY_PAIRS } from './facility-config.js';

const BOOL_FIELDS = [
    'strategy-level-up', 'strategy-priorities', 'force-e-mode', 'mode-simple', 'mode-advanced',
    'season-on', 'layout-sim-on', 'layout-whole', 'aniimo-best', 'aniimo-minimum', 'aniimo-custom',
];
const NUMBER_FIELDS = {
    'target-amount': [0, 1e15], 'current-amount': [0, 1e15],
    'home-level': [1, MAX_HOME_LEVEL, true], 'level-up-target': [2, MAX_HOME_LEVEL, true],
    'ecological-module-level': [0, 99, true], 'kitchen-module-level': [0, 99, true],
    'resource-detector-level': [0, 99, true], 'crafting-module-level': [0, 99, true],
    'power-module-level': [0, 99, true], 'season-wheat-budget': [0, 1e12],
    'season-mutation-plots': [0, 10, true], 'layout-storage-count': [1, 24, true],
};
const RADIO_GROUPS = [
    ['mode-simple', 'mode-advanced'], ['strategy-level-up', 'strategy-priorities'],
    ['aniimo-best', 'aniimo-minimum', 'aniimo-custom'],
];
const ABILITIES = new Set(['Earth', 'Grass', 'Water', 'Fire', 'Wind', 'Dark', 'Lightning',
    'Ice', 'Light', 'Artisanship', 'Leisure', 'Perfumery', 'Hauling']);
const PRIORITIES = new Set(['coins', 'aniimo_exp', 'aniipods', 'Wood Blocks', 'Mineral Sand', 'season_points']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);

function number(value, label, min, max, integer = false) {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') {
        throw new Error(`${label} must be a number`);
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        throw new Error(`${label} must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}`);
    }
    return n;
}

function abilities(value) {
    if (!record(value)) throw new Error('Invalid Aniimo abilities');
    return Object.fromEntries(Object.entries(value).filter(([key]) => ABILITIES.has(key))
        .map(([key, level]) => [key, number(level, `${key} ability`, 1, 4, true)]));
}

export function normalizeSetupSettings(input, defaults = {}) {
    if (!record(input) || (!own(input, 'facilityTiers') && !own(input, 'home-level'))) {
        throw new Error('This code contains no calculator setup');
    }
    const data = structuredClone(input);
    const settings = structuredClone(defaults);
    const warnings = [];
    if (!own(data, 'resource-detector-level') && own(data, 'mineral-detector-level')) {
        data['resource-detector-level'] = data['mineral-detector-level'];
    }
    if (!own(data, 'mode-simple') && !own(data, 'mode-advanced') && own(data, 'facilityTiers')) {
        data['mode-simple'] = false;
        data['mode-advanced'] = true;
    }
    for (const key of BOOL_FIELDS) {
        if (!own(data, key)) continue;
        if (typeof data[key] !== 'boolean') throw new Error(`${key} must be true or false`);
        settings[key] = data[key];
    }
    for (const group of RADIO_GROUPS) {
        if (!group.some(key => own(data, key))) continue;
        const picked = group.filter(key => data[key] === true);
        if (picked.length !== 1) throw new Error('Choose exactly one input, strategy or Aniimo mode');
        group.forEach(key => { settings[key] = key === picked[0]; });
    }
    for (const [key, limits] of Object.entries(NUMBER_FIELDS)) {
        if (!own(data, key)) continue;
        const value = typeof data[key] === 'string' && data[key].trim() === ''
            ? (limits[0] === 0 ? 0 : defaults[key] ?? limits[0]) : data[key];
        settings[key] = String(number(value, key, ...limits));
    }
    if (own(data, 'rate-unit')) {
        if (!['second', 'minute', 'hour', 'day'].includes(data['rate-unit'])) throw new Error('Invalid rate unit');
        settings['rate-unit'] = data['rate-unit'];
    }
    if (own(data, 'goalTarget')) {
        if (data.goalTarget !== '' && !PRIORITIES.has(data.goalTarget)) throw new Error('Invalid goal target');
        settings.goalTarget = data.goalTarget;
    }
    if (own(data, 'facilityTiers')) {
        if (!record(data.facilityTiers)) throw new Error('Invalid facility settings');
        if (!own(data.facilityTiers, 'Mine') && own(data.facilityTiers, 'Mineral Pile')) {
            data.facilityTiers.Mine = data.facilityTiers['Mineral Pile'];
        }
        settings.facilityTiers = structuredClone(defaults.facilityTiers || {});
        for (const [name, tiers] of Object.entries(data.facilityTiers)) {
            const facility = FACILITIES.find(f => f.name === name);
            if (!facility) {
                if (name !== 'Mineral Pile') warnings.push(`Unsupported facility skipped: ${name.slice(0, 80)}.`);
                continue;
            }
            if (!Array.isArray(tiers) || !tiers.length || tiers.length > 20) throw new Error(`Invalid tiers for ${name}`);
            settings.facilityTiers[name] = tiers.map(tier => {
                if (!record(tier)) throw new Error(`Invalid tier for ${name}`);
                return { count: number(tier.count, `${name} count`, 0, 1000, true),
                    level: facility.hasLevels === false ? 1 : number(tier.level, `${name} level`, 1, 99, true) };
            });
        }
    }
    if (own(data, 'levelUpStock')) {
        if (!record(data.levelUpStock)) throw new Error('Invalid RV stock');
        settings.levelUpStock = Object.fromEntries(Object.entries(data.levelUpStock)
            .filter(([key]) => /^[a-z][a-z0-9_]*$/.test(key))
            .map(([key, value]) => [key, number(value, `${key} stock`, 0, 1e15)]));
    }
    for (const key of ['skippedRecipes', 'unlockedSpecial']) {
        if (!own(data, key)) continue;
        if (!Array.isArray(data[key]) || data[key].length > 2000 || data[key].some(name =>
            typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name))) throw new Error(`Invalid ${key}`);
        settings[key] = [...new Set(data[key])];
    }
    if (own(data, 'priorities')) {
        if (!Array.isArray(data.priorities)) throw new Error('Invalid priorities');
        const seen = new Set();
        settings.priorities = data.priorities.filter(p => {
            if (!record(p) || typeof p.target !== 'string' || typeof p.on !== 'boolean') throw new Error('Invalid priority');
            if (!PRIORITIES.has(p.target)) { warnings.push('An unsupported priority was skipped.'); return false; }
            if (seen.has(p.target)) throw new Error('Duplicate priority');
            seen.add(p.target);
            return true;
        }).map(p => ({ target: p.target, on: p.on }));
    } else if (data['strategy-coins'] || data['strategy-exp'] || data['strategy-aniipods']) {
        const first = data['strategy-exp'] ? 'aniimo_exp' : data['strategy-aniipods'] ? 'aniipods' : 'coins';
        settings.priorities = [first, ...PRIORITIES].filter((key, i, all) => all.indexOf(key) === i)
            .map(target => ({ target, on: target === first }));
        settings['strategy-priorities'] = true;
        settings['strategy-level-up'] = false;
    }
    if (own(data, 'aniimoLevels')) settings.aniimoLevels = abilities(data.aniimoLevels);
    if (own(data, 'roster')) {
        if (!Array.isArray(data.roster) || data.roster.length > 200) throw new Error('Invalid Aniimo roster');
        settings.roster = data.roster.map(member => {
            if (!record(member) || (member.name !== undefined &&
                (typeof member.name !== 'string' || member.name.length > 200))) throw new Error('Invalid Aniimo name');
            return { name: member.name || '', count: number(member.count, 'Aniimo count', 1, 1000, true),
                abilities: abilities(member.abilities), personalities: PERSONALITY_PAIRS.map((pair, i) =>
                    pair.names.includes(member.personalities?.[i]) ? member.personalities[i] : pair.names[0]) };
        });
    }
    if (!['aniimo-best', 'aniimo-minimum', 'aniimo-custom'].some(key => own(data, key))) {
        warnings.push('Older setup: Aniimo mode was not included; using Best. Review the Aniimo settings.');
    }
    const known = new Set([...BOOL_FIELDS, ...Object.keys(NUMBER_FIELDS), 'rate-unit', 'goalTarget', 'facilityTiers',
        'levelUpStock', 'skippedRecipes', 'unlockedSpecial', 'priorities', 'aniimoLevels', 'roster',
        'mineral-detector-level', 'strategy-coins', 'strategy-exp', 'strategy-aniipods']);
    if (Object.keys(data).some(key => !known.has(key))) warnings.push('Unsupported setup fields were ignored.');
    return { settings, warnings: [...new Set(warnings)] };
}
