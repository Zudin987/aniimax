import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSetupSettings } from '../web/setup-config.js';
import { createShareUrl, readShareHash, urlWithoutShare } from '../web/share-config.js';
import { readSetupImport, encodeSetupCode, decodeLayoutCode } from '../web/share-code.js';

const defaults = {
    'mode-simple': true, 'mode-advanced': false, 'home-level': '19',
    'strategy-level-up': true, 'strategy-priorities': false,
    'aniimo-best': true, 'aniimo-minimum': false, 'aniimo-custom': false,
    'season-wheat-budget': '600', 'season-mutation-plots': '1',
    facilityTiers: { Mine: [{ count: 0, level: 1 }] },
    roster: [], skippedRecipes: [], unlockedSpecial: [], levelUpStock: {}, aniimoLevels: {},
};
const input = {
    ...defaults, 'home-level': '13', 'mode-simple': false, 'mode-advanced': true,
    'aniimo-best': false, 'aniimo-custom': true,
    facilityTiers: { Mine: [{ count: 4, level: 3 }, { count: 3, level: 4 }] },
    roster: [{ name: 'Nimbi 雲 ✓', family: 'Nimbi', count: 2, abilities: { Leisure: 4, Ice: 2, Light: 1 },
        personalities: ['Instinctive', 'Nimble', 'Faithful', 'Playful'] }],
    skippedRecipes: ['quick_potato'], unlockedSpecial: ['rose_shortbread'],
    priorities: [{ target: 'season_points', on: true }, { target: 'coins', on: true }],
    levelUpStock: { wood_block: 123 }, aniimoLevels: { Earth: 4, Water: 3 },
    'force-e-mode': true, 'season-on': true, 'season-wheat-budget': '768',
    'season-mutation-plots': '2', 'layout-storage-count': '24', 'rate-unit': 'day', goalTarget: 'coins',
};

test('complete setup codes and compressed upstream-compatible links preserve setup and Unicode', async () => {
    for (const raw of [encodeSetupCode(input), await createShareUrl('https://example.test/aniimax/', input)]) {
        const imported = await readSetupImport(raw);
        assert.equal(imported.kind, 'setup');
        assert.deepEqual(normalizeSetupSettings(imported.settings, defaults).settings, input);
    }
    const url = new URL(await createShareUrl('https://example.test/aniimax/', input));
    assert.ok(url.href.length < encodeSetupCode(input).length);
    for (const raw of [url.hash, url.hash.slice(1), new URLSearchParams(url.hash.slice(1)).get('config')]) {
        assert.deepEqual((await readSetupImport(raw)).settings, input);
    }
});

test('older names and missing fields use clean defaults, independently of previous recipient values', () => {
    const legacy = { facilityTiers: { 'Mineral Pile': [{ count: 2, level: 3 }] }, 'mineral-detector-level': '2' };
    const { settings, warnings } = normalizeSetupSettings(legacy, defaults);
    assert.equal(settings['mode-advanced'], true);
    assert.equal(settings['mode-simple'], false);
    assert.deepEqual(settings.facilityTiers.Mine, [{ count: 2, level: 3 }]);
    assert.equal(settings['resource-detector-level'], '2');
    assert.equal(settings['season-mutation-plots'], '1');
    assert.deepEqual(settings.roster, []);
    assert.equal(settings['aniimo-best'], true);
    assert.match(warnings.join(' '), /Older setup/);
    assert.equal(legacy['mode-simple'], undefined, 'validation must not mutate input');
    assert.deepEqual(defaults.facilityTiers.Mine, [{ count: 0, level: 1 }]);
    const blank = normalizeSetupSettings({ 'home-level': '13', 'season-wheat-budget': '',
        'season-mutation-plots': '', 'target-amount': '' }, { ...defaults, 'target-amount': '1000' }).settings;
    assert.equal(blank['season-wheat-budget'], '0', 'cleared cap still means unlimited after import');
    assert.equal(blank['season-mutation-plots'], '0', 'cleared reserve still means no minimum');
    assert.equal(blank['target-amount'], '0', 'cleared goal still means zero rather than the default target');
});

test('invalid structures, non-finite values and conflicting modes are rejected before application', () => {
    for (const bad of [null, [], {}, { ...input, facilityTiers: [] },
        { ...input, 'home-level': 'NaN' }, { ...input, 'season-wheat-budget': -1 },
        { ...input, 'mode-simple': true }, { ...input, 'aniimo-custom': 'false' },
        { ...input, facilityTiers: { Mine: [{ count: -2, level: 1 }] } },
        { ...input, levelUpStock: { wood_block: 'Infinity' } },
        { ...input, roster: [{ count: 0, abilities: { Earth: 1 } }] },
        { ...input, roster: [{ count: 1, family: 'Nimbi" onclick="bad()', abilities: { Leisure: 4 } }] },
        { ...input, priorities: [{ target: 'coins', on: true }, { target: 'coins', on: true }] }]) {
        assert.throws(() => normalizeSetupSettings(bad, defaults));
    }
});

test('older Leisure rosters load without guessing family from a nickname or ability', () => {
    const old = { ...input, roster: input.roster.map(({ family, ...member }) => member) };
    const { settings, warnings } = normalizeSetupSettings(old, defaults);
    assert.equal(settings.roster[0].name, 'Nimbi 雲 ✓');
    assert.equal(settings.roster[0].family, undefined);
    assert.match(warnings.join(' '), /Review Leisure Aniimo families/);
    assert.equal(normalizeSetupSettings(input, defaults).warnings.length, 0);
    const cleared = normalizeSetupSettings({ ...input, roster: [{ ...input.roster[0], family: '' }] }, defaults);
    assert.equal(cleared.settings.roster[0].family, '');
});

test('unknown fields and prototype keys are ignored with compatibility feedback', () => {
    const data = JSON.parse(JSON.stringify(input).replace('"home-level":"13"', '"__proto__":{"polluted":true},"home-level":"13"'));
    data.futureSetting = true;
    data.facilityTiers['Future Station'] = [{ count: 1, level: 1 }];
    const { settings, warnings } = normalizeSetupSettings(data, defaults);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.hasOwn(settings, '__proto__'), false);
    assert.equal(settings.futureSetting, undefined);
    assert.ok(warnings.length >= 2);
});

test('damaged/unsupported/oversized codes and gzip bombs fail, unrelated hashes survive edits', async () => {
    for (const bad of ['', 'ANIIMAX3.abc', 'ANIIMAX2.bad', 'abcdefgh', '#config=v9.foo',
        '#config=v1.notgzip', 'https://example.test/', 'ANIIMAX2.' + 'a'.repeat(500_000)]) {
        await assert.rejects(readSetupImport(bad));
    }
    const huge = await new Response(new Blob([new Uint8Array(1_000_001)]).stream()
        .pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const token = Buffer.from(huge).toString('base64url');
    await assert.rejects(readShareHash('#config=v1.' + token), /too large/);
    await assert.rejects(createShareUrl('https://example.test/', { padding: 'x'.repeat(1_000_001) }), /too large/);
    assert.equal(await readShareHash('#other=1'), null);
    assert.equal(urlWithoutShare('https://example.test/#other=1&config=v1.abc'), 'https://example.test/#other=1');
});

test('malformed legacy layouts cannot inject SVG attributes or crash the renderer', () => {
    const code = value => 'ANIIMAX1.' + Buffer.from(JSON.stringify(value)).toString('base64url');
    for (const layout of [{ pieces: [] }, { pieces: [{ members: null }], storage: { x: 0, y: 0, w: 2, h: 2 } },
        { pieces: [], storage: { x: '0" onload="alert(1)', y: 0, w: 2, h: 2 } }]) {
        assert.throws(() => decodeLayoutCode(code({ v: 1, homeLevel: 13, layout })));
    }
});
