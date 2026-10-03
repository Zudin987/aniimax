import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { encodeSetupCode, encodeLayoutCode } from '../web/share-code.js';
import { createShareUrl } from '../web/share-config.js';

const root = fileURLToPath(new URL('../web/', import.meta.url));
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
        const content = await readFile(file);
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
            '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)];
        response.writeHead(200, { 'Content-Type': type || 'application/octet-stream' }).end(content);
    } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true,
    ...(process.env.ANIIMAX_CHROMIUM_PATH ? { executablePath: process.env.ANIIMAX_CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
const key = 'aniimax-config-v1';
const saved = { 'mode-simple': true, 'mode-advanced': false, 'home-level': '2' };
const setup = {
    facilityTiers: { Mine: [{ count: 2, level: 3 }], Farmland: [{ count: 4, level: 1 }] },
    'mode-simple': false, 'mode-advanced': true, 'home-level': '13',
    'strategy-level-up': false, 'strategy-priorities': true,
    'aniimo-best': false, 'aniimo-minimum': false, 'aniimo-custom': true,
    roster: [{ name: 'Nimbi ✓', count: 1, abilities: { Leisure: 4, Ice: 2, Light: 1 },
        personalities: ['Instinctive', 'Nimble', 'Faithful', 'Playful'] }],
    aniimoLevels: { Earth: 4 }, levelUpStock: { wood_block: 25 },
    priorities: [{ target: 'season_points', on: true }, { target: 'coins', on: true }],
    skippedRecipes: ['quick_potato'], unlockedSpecial: ['rose_shortbread'],
    'season-on': true, 'season-wheat-budget': '600', 'season-mutation-plots': '1',
    'force-e-mode': true, 'power-module-level': '1', 'layout-storage-count': '3', 'rate-unit': 'day',
};
async function load(raw) {
    await page.locator('#setup-import-code').click();
    await page.locator('#setup-import-value').fill(raw);
    await page.locator('#setup-import-apply').click();
    await page.waitForFunction(() => !document.getElementById('setup-import-apply').disabled);
}
async function config() { return page.evaluate(k => JSON.parse(localStorage.getItem(k)), key); }
try {
    await page.goto(base);
    await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    assert.equal(await page.locator('#home-level').inputValue(), '2');
    assert.equal(await page.locator('#results-section').isVisible(), false);
    assert.equal(await page.locator('#aniimo-custom').isVisible(), true, 'Aniimo controls must be reviewable before solving');
    await page.locator('#setup-copy-code').click();
    await page.waitForFunction(() => !document.getElementById('setup-export-panel').hidden);
    assert.match(await page.locator('#setup-export-value').inputValue(), /^ANIIMAX2\./);
    await load(encodeSetupCode(setup));
    assert.equal(await page.locator('#setup-import-panel').isVisible(), false);
    assert.equal(await page.locator('#mode-advanced').isChecked(), true);
    assert.equal(await page.locator('#aniimo-custom').isChecked(), true);
    assert.equal(await page.locator('#roster-editor').isVisible(), true);
    assert.equal(await page.locator('#roster-editor .roster-name').inputValue(), 'Nimbi ✓');
    assert.equal((await config()).roster[0].abilities.Ice, 2);
    assert.equal((await config()).facilityTiers.Mine[0].count, 2);
    assert.equal((await config())['force-e-mode'], true);
    assert.deepEqual((await config()).skippedRecipes, ['quick_potato']);
    assert.equal(await page.locator('#results-section').isVisible(), false, 'Import must not calculate');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    await page.locator('#setup-import-code').waitFor();
    assert.equal(await page.locator('#aniimo-custom').isChecked(), true, 'selected Aniimo mode survives reload');
    const before = await config();
    await load('ANIIMAX2.bad');
    assert.match(await page.locator('#setup-import-error').innerText(), /Could not import/);
    assert.deepEqual(await config(), before, 'invalid import must preserve saved settings');
    await page.locator('#setup-import-cancel').click();

    // Review explicit conflict, exact 768 cap, unlimited cap and no reserve.
    await page.locator('#aniimo-best').check();
    await page.locator('#season-mutation-plots').fill('2');
    assert.match(await page.locator('#season-budget-note').innerText(), /Budget conflict.*768/);
    await page.locator('#season-wheat-budget').fill('768');
    assert.match(await page.locator('#season-budget-note').innerText(), /Fits this budget/);
    await page.locator('#season-wheat-budget').fill('0');
    assert.match(await page.locator('#season-budget-note').innerText(), /Unlimited seed spend/);
    await page.locator('#season-mutation-plots').fill('0');
    assert.match(await page.locator('#season-budget-note').innerText(), /No mutation reserve/);

    // Legacy layout can open on a fresh calculator without changing setup values.
    const layout = encodeLayoutCode({ homeLevel: 13, layout: {
        pieces: [{ members: [{ facility: 'Mine', x: 4, y: 4, w: 3, h: 3, weight: 1 }] }],
        storage: { x: 0, y: 0, w: 2, h: 2 }, storages: [{ x: 0, y: 0, w: 2, h: 2 }],
    } });
    const beforeLayout = await config();
    await load(layout);
    assert.equal(await page.locator('#imported-layout-card').isVisible(), true);
    assert.equal(await page.locator('#imported-layout-diagram svg').count(), 1);
    assert.deepEqual(await config(), beforeLayout);

    // Opening a link preserves browser defaults until the shared setup is edited.
    const linked = { ...setup, 'mode-simple': true, 'mode-advanced': false, 'home-level': '10',
        'aniimo-best': true, 'aniimo-custom': false, 'force-e-mode': false };
    const savedBeforeLink = await config();
    await page.goto(await createShareUrl(base, linked));
    await page.waitForFunction(() => document.getElementById('setup-share-hint').textContent.includes('Shared setup loaded'));
    assert.equal(await page.locator('#home-level').inputValue(), '10');
    assert.deepEqual(await config(), savedBeforeLink);
    await page.locator('#season-mutation-plots').fill('2');
    assert.equal(new URL(page.url()).hash, '');
    assert.equal((await config())['season-mutation-plots'], '2');
    await page.locator('#season-mutation-plots').fill('1');
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await page.screenshot({ path: 'test-results/setup-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#setup-import-code').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'mobile setup must not overflow');
    await page.screenshot({ path: 'test-results/setup-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    await page.locator('#optimize-btn').click();
    await page.waitForFunction(() => !document.getElementById('optimize-btn').disabled, null, { timeout: 120_000 });
    assert.equal(await page.locator('#results-content').isVisible(), true, 'real WASM must calculate imported settings');
    assert.equal(await page.locator('#error-message').isVisible(), false);
    // Import another setup after a solve, then switch modes: no old plan may reappear.
    await load(encodeSetupCode({ facilityTiers: {}, 'home-level': '1', 'mode-simple': true, 'mode-advanced': false,
        'season-on': false, 'force-e-mode': false, 'aniimo-best': false, 'aniimo-minimum': true, 'aniimo-custom': false }));
    assert.equal(await page.locator('#results-section').isVisible(), false);
    await page.locator('#aniimo-best').check();
    assert.equal(await page.locator('#results-section').isVisible(), false);
    assert.equal(await page.locator('#season-mutation-plots').inputValue(), '1');
    assert.deepEqual((await config()).roster, [], 'partial old setup must not merge with recipient roster');

    // Storage denial still permits a reviewed import for this visit.
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage unavailable'); }; });
    await load(encodeSetupCode({ ...linked, 'home-level': '11' }));
    assert.equal(await page.locator('#home-level').inputValue(), '11');
    assert.match(await page.locator('#setup-share-hint').innerText(), /saving is unavailable/);
    assert.deepEqual(errors, [], 'browser/WASM should not raise uncaught errors');
    console.log('Setup UI/WASM smoke passed: pre-plan import/export, full restore, saved mode, invalid/legacy codes, shared links, budget feedback, desktop/mobile and storage denial.');
} finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
