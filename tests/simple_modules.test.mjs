import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { simpleSetup, SIMPLE_MODULE_FIELDS, MODULE_MAX_LEVELS } from '../web/facility-config.js';
import { normalizeSetupSettings } from '../web/setup-config.js';
import { encodeSetupCode, readSetupImport } from '../web/share-code.js';
import { createShareUrl } from '../web/share-config.js';

const automatic = Object.fromEntries(SIMPLE_MODULE_FIELDS.map(({ id }) => [id, 'auto']));
const defaults = { 'home-level': '20', 'mode-simple': true, 'mode-advanced': false,
    'simple-toolkit-upgrades': true, facilityTiers: {}, ...automatic };
const owned = { ecological_module: '1', kitchen_module: '0', resource_detector: '1',
    crafting_module: 'auto', power_module: 'auto' };
const fields = levels => Object.fromEntries(SIMPLE_MODULE_FIELDS.map(({ id, module }) => [id, levels[module]]));

test('Simple owned module levels retain facilities and distinguish fixed levels from RV max', () => {
    const partial = simpleSetup(9, true, owned);
    assert.deepEqual(partial.facilities, simpleSetup(9).facilities);
    assert.deepEqual(partial.modules, { ecological_module: 1, kitchen_module: 0, resource_detector: 1,
        crafting_module: 2, power_module: 0 });
    const higher = simpleSetup(14, false, owned);
    assert.deepEqual(higher.modules, { ecological_module: 1, kitchen_module: 0, resource_detector: 1,
        crafting_module: 4, power_module: 2 });
    assert.equal(simpleSetup(3, true, owned).modules.resource_detector, 0, 'owned levels respect the RV cap');
    assert.ok(Object.values(simpleSetup(14, false).modules).every(level => level === 0), 'legacy toggle still works');
    assert.deepEqual(simpleSetup(14, true).modules, simpleSetup(14, false,
        Object.fromEntries(SIMPLE_MODULE_FIELDS.map(({ module }) => [module, 'auto']))).modules);
});

test('actual Simple form reader sends individual levels to the solver, independently of Advanced', () => {
    const source = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const code = source.slice(source.indexOf('function getSimpleSetup()'), source.indexOf('function renderSimpleModuleControls'));
    const values = { ...fields(owned), 'ecological-module-level': '7' };
    const read = new Function('document', 'SIMPLE_MODULE_FIELDS', 'simpleSetup', 'selectedHomeLevel',
        `${code}\nreturn getSimpleSetup;`)(
        { getElementById: id => ({ value: values[id], checked: false }) },
        SIMPLE_MODULE_FIELDS, simpleSetup, () => 9);
    assert.deepEqual(read().modules, simpleSetup(9, true, owned).modules);
    assert.equal(values['ecological-module-level'], '7', 'Simple must not overwrite Advanced');
});

test('individual Simple modules round trip through setup codes and links', async () => {
    const setup = { ...defaults, 'home-level': '14', 'simple-toolkit-upgrades': false,
        ...fields(owned), 'ecological-module-level': '5' };
    for (const raw of [encodeSetupCode(setup), await createShareUrl('https://example.test/aniimax/', setup)]) {
        const imported = await readSetupImport(raw);
        const result = normalizeSetupSettings(imported.settings, defaults);
        assert.deepEqual(result.settings, setup);
        assert.doesNotMatch(result.warnings.join(' '), /Unsupported setup fields/);
    }
});

test('old all-or-none codes use clean module defaults instead of recipient levels', () => {
    const previous = { ...defaults, 'simple-toolkit-upgrades': false, ...fields(owned) };
    for (const flag of [false, true, undefined]) {
        const old = { 'home-level': '14', ...(flag === undefined ? {} : { 'simple-toolkit-upgrades': flag }) };
        const { settings } = normalizeSetupSettings(old, previous);
        for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(settings[id], flag === false ? '0' : 'auto');
        assert.equal(settings['simple-toolkit-upgrades'], flag !== false);
    }
    const partial = normalizeSetupSettings({ 'home-level': '14', 'simple-toolkit-upgrades': false,
        'simple-ecological-module-level': '1', 'simple-power-module-level': 'auto' }, defaults).settings;
    assert.equal(partial['simple-ecological-module-level'], '1', 'explicit owned levels override the legacy flag');
    assert.equal(partial['simple-kitchen-module-level'], '0');
    assert.equal(partial['simple-power-module-level'], 'auto');
});

test('invalid Simple levels fail before application; above-RV levels are clamped with feedback', () => {
    for (const { id, module } of SIMPLE_MODULE_FIELDS) {
        for (const bad of [-1, 1.5, 'NaN', 'max', '', null, true, Math.max(...MODULE_MAX_LEVELS[module]) + 1]) {
            assert.throws(() => normalizeSetupSettings({ 'home-level': '14', [id]: bad }, defaults), undefined, `${id}: ${bad}`);
        }
    }
    const input = { 'home-level': '3', ...fields(owned) };
    const before = structuredClone(input);
    const defaultBefore = structuredClone(defaults);
    const { settings, warnings } = normalizeSetupSettings(input, defaults);
    assert.equal(settings['simple-resource-detector-level'], '0');
    assert.equal(settings['simple-ecological-module-level'], '1');
    assert.equal(settings['simple-crafting-module-level'], 'auto');
    assert.match(warnings.join(' '), /Simple module levels above the RV limit were reduced/);
    assert.deepEqual(input, before);
    assert.deepEqual(defaults, defaultBefore);
});
