import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { encodeSetupCode, encodeLayoutCode } from '../web/share-code.js';
import { createShareUrl } from '../web/share-config.js';
import { SIMPLE_MODULE_FIELDS, simpleSetup } from '../web/facility-config.js';

const root = fileURLToPath(new URL('../web/', import.meta.url));
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
        const content = await readFile(file);
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
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
page.on('pageerror', error => { errors.push(error.message); console.error('Browser exception:', error.message); });
page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
const key = 'aniimax-config-v1';
const saved = { 'mode-simple': true, 'mode-advanced': false, 'home-level': '2' };
const setup = {
    facilityTiers: { Mine: [{ count: 2, level: 3 }], Farmland: [{ count: 4, level: 1 }] },
    'mode-simple': false, 'mode-advanced': true, 'home-level': '13',
    'strategy-level-up': false, 'strategy-priorities': true,
    'aniimo-best': false, 'aniimo-minimum': false, 'aniimo-custom': true,
    roster: [{ name: 'Nimbi ✓', family: 'Nimbi', count: 1, abilities: { Leisure: 4, Ice: 2, Light: 1 },
        personalities: ['Instinctive', 'Nimble', 'Faithful', 'Playful'] }],
    aniimoLevels: { Earth: 4 }, levelUpStock: { wood_block: 25 },
    priorities: [{ target: 'season_points', on: true }, { target: 'coins', on: true }],
    skippedRecipes: ['quick_potato'], unlockedSpecial: ['rose_shortbread'],
    'season-on': true, 'season-wheat-budget': '600', 'season-mutation-plots': '1',
    'rv-order-variety': true, 'simple-toolkit-upgrades': false, 'season-points-min': '0', 'festival-batch-amount': '2',
    'force-e-mode': true, 'power-module-level': '1', 'layout-storage-count': '3', 'layout-whole': false,
    'rate-unit': 'day', goalTarget: 'season_points', 'target-amount': '123', 'current-amount': '5',
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
    const helpCard = page.locator('#context-help');
    const rvHelp = page.getByRole('button', { name: 'About RV level', exact: true });
    const beforeHelp = await config();
    // Hover help stays readable when the pointer enters the card, and closes on leaving.
    await rvHelp.hover();
    await helpCard.waitFor({ state: 'visible' });
    assert.match(await helpCard.innerText(), /every facility.*RV level/);
    const hoverBox = await helpCard.boundingBox();
    await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
    await page.waitForTimeout(200);
    assert.equal(await helpCard.isVisible(), true, 'the help card must be hoverable');
    await page.mouse.move(2, 2);
    await helpCard.waitFor({ state: 'hidden' });
    // Focus announces the help; Escape and Tab dismiss it without changing the form.
    await rvHelp.focus();
    assert.equal(await helpCard.isVisible(), true);
    assert.equal(await rvHelp.getAttribute('aria-describedby'), 'context-help');
    await page.keyboard.press('Escape');
    assert.equal(await helpCard.isVisible(), false);
    assert.equal(await rvHelp.getAttribute('aria-expanded'), 'false');
    assert.equal(await rvHelp.getAttribute('aria-describedby'), null);
    await rvHelp.click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    assert.equal(await helpCard.isVisible(), true, 'click keeps help open after the pointer leaves');
    await rvHelp.click();
    assert.equal(await helpCard.isVisible(), false, 'a second click closes help');
    await rvHelp.click();
    await page.keyboard.press('Tab');
    await helpCard.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'About Aniimo Team', exact: true }).click();
    assert.match(await helpCard.innerText(), /Best.*My Aniimo.*Minimum/s);
    assert.equal(await page.locator('#aniimo-toggle').getAttribute('aria-expanded'), 'false',
        'team help must not expand the team section');
    await page.mouse.click(2, 2);
    assert.equal(await helpCard.isVisible(), false, 'clicking outside dismisses help');
    assert.deepEqual(await config(), beforeHelp, 'reading help must preserve saved settings');
    assert.equal(await page.locator('#results-section').isVisible(), false, 'help must not calculate');
    // Exercise the deployed worker, WASM metadata and exact roster planner together.
    const evidence = await page.evaluate(async () => {
        const worker = new Worker('./worker.js', { type: 'module' });
        let id = 0;
        const ask = (type, input) => new Promise((resolve, reject) => {
            const requestId = ++id;
            const timeout = setTimeout(() => reject(new Error('Evidence worker timed out')), 60_000);
            worker.onmessage = ({ data }) => {
                if (data.id !== requestId || data.type === 'progress') return;
                clearTimeout(timeout);
                data.ok ? resolve(JSON.parse(data.result)) : reject(new Error(data.error));
            };
            worker.onerror = error => { clearTimeout(timeout); reject(new Error(error.message)); };
            worker.postMessage({ id: requestId, type, ...(input ? { payload: JSON.stringify(input) } : {}) });
        });
        try {
            const items = await ask('get_all_items');
            const { FACILITIES } = await import('./facility-config.js');
            // API callers inherit one of omitted facilities; the UI sends explicit zeroes.
            const facilities = Object.fromEntries(FACILITIES.map(f => [f.name, [{ count: 0, level: 1 }]]));
            const member = family => ({ count: 1, family, abilities: { Leisure: 3 }, personalities: [] });
            const input = { currency: 'coins', aniimo: 'roster', prioritize_byproducts: false,
                facilities: { ...facilities, 'Nimbus Bed': [{ count: 1, level: 2 }] }, modules: { resource_detector: 5 },
                roster: { members: [member('Celestis'), member('Nimbi')], residents: ['Nimbus Bed'] } };
            const matching = await ask('find_plan', input);
            const wrong = await ask('find_plan', { ...input,
                roster: { ...input.roster, members: [member('Celestis')] } });
            return { star: items.find(item => item.name === 'star'),
                scales: items.find(item => item.name === 'scales'), matching, wrong };
        } finally { worker.terminate(); }
    });
    assert.equal(evidence.star.family, 'Celestis');
    assert.equal(evidence.star.verified, true);
    assert.equal(evidence.scales.verified, false, 'an unseen recipe remains unverified');
    assert.equal(evidence.matching.success, true, evidence.matching.error || 'the matching family must produce');
    assert.ok(evidence.matching.rate_per_second > 0);
    assert.equal(evidence.matching.coin_items.find(row => row.status === 'producing').crew, 1,
        'real WASM must assign Nimbi, rather than another Leisure family');
    assert.ok(!evidence.wrong.success || !evidence.wrong.coin_items.some(row => row.status === 'producing'),
        'a Celestis-only roster cannot staff Nimbus Bed');
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
    assert.equal(await page.locator('#roster-editor .roster-family').inputValue(), 'Nimbi');
    assert.equal((await config()).roster[0].family, 'Nimbi');
    assert.equal((await config()).roster[0].abilities.Ice, 2);
    assert.equal((await config()).facilityTiers.Mine[0].count, 2);
    assert.equal((await config())['force-e-mode'], true);
    assert.equal((await config())['rv-order-variety'], true);
    assert.equal((await config())['simple-toolkit-upgrades'], false);
    assert.equal((await config())['festival-batch-amount'], '2');
    assert.equal((await config()).goalTarget, 'season_points');
    assert.equal((await config())['layout-whole'], false);
    assert.equal((await config())['target-amount'], '123');
    assert.deepEqual((await config()).skippedRecipes, ['quick_potato']);
    assert.equal(await page.locator('#results-section').isVisible(), false, 'Import must not calculate');
    await page.locator('#force-emode-info').click();
    assert.match(await page.locator('#context-help').innerText(), /Mine, Well/);
    assert.match(await page.locator('#context-help').innerText(), /Rough Lumber.*Coarse-Sifted Ore/);
    assert.equal((await config())['force-e-mode'], true, 'reading the rules must preserve imported settings');
    await page.keyboard.press('Escape');
    const mineHelp = page.getByRole('button', { name: 'About Mine', exact: true });
    await mineHelp.click();
    assert.match(await helpCard.innerText(), /Lv\.1: Rock\nLv\.2: Clay/,
        'generated facility buttons must preserve multiline help');
    await page.keyboard.press('Escape');
    const strategyHelp = page.getByRole('button', { name: 'About Strategy', exact: true });
    await strategyHelp.click();
    assert.match(await helpCard.innerText(), /95%/);
    await page.keyboard.press('Escape');
    await page.locator('#rv-order-variety').uncheck();
    await strategyHelp.click();
    assert.match(await helpCard.innerText(), /Fastest level-up with E-Mode/,
        'dynamic help must use the current settings, rather than cached text');
    await page.keyboard.press('Escape');
    await page.locator('#rv-order-variety').check();
    await page.locator('#facilitiesToggle').click();
    const recipeTimeHelp = page.locator('#facilitiesModal').getByRole('button', { name: 'About Time', exact: true }).first();
    await recipeTimeHelp.click();
    assert.match(await helpCard.innerText(), /Grow time.*workload/s);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#facilitiesModal').isVisible(), true,
        'Escape closes help before closing its parent modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#facilitiesModal').isVisible(), false);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    await page.locator('#setup-import-code').waitFor();
    assert.equal(await page.locator('#aniimo-custom').isChecked(), true, 'selected Aniimo mode survives reload');
    assert.equal(await page.locator('#roster-editor .roster-family').inputValue(), 'Nimbi', 'family survives reload');
    const before = await config();
    await load('ANIIMAX2.bad');
    assert.match(await page.locator('#setup-import-error').innerText(), /Could not import/);
    assert.deepEqual(await config(), before, 'invalid import must preserve saved settings');
    await page.locator('#setup-import-cancel').click();

    const older = structuredClone(setup);
    delete older.roster[0].family;
    await load(encodeSetupCode(older));
    assert.match(await page.locator('#setup-share-hint').innerText(), /Review Leisure Aniimo families/);
    assert.equal(await page.locator('#roster-editor .roster-family').inputValue(), '',
        'a nickname must not be used to infer family in older codes');
    assert.equal(await page.locator('#results-section').isVisible(), false);
    await page.locator('#roster-editor .roster-family').selectOption('Nimbi');
    assert.equal((await config()).roster[0].family, 'Nimbi', 'reviewed family selection is saved');
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await page.locator('#roster-editor').screenshot({ path: 'test-results/aniimo-family-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
        'the Advanced roster and family control must fit on mobile');
    await page.locator('#roster-editor').screenshot({ path: 'test-results/aniimo-family-mobile.png' });
    await page.setViewportSize({ width: 1000, height: 900 });

    // Review explicit conflict, exact 768 cap, unlimited cap and the mandatory order baseline.
    await page.locator('label:has(#aniimo-best)').click();
    assert.equal(await page.locator('#aniimo-best').isChecked(), true);
    const beforeDetails = await config();
    assert.equal(await page.locator('#season-details p').first().isVisible(), false,
        'crafting details should be collapsed so the setup stays concise');
    await page.locator('#season-info').click();
    assert.equal(await page.locator('#context-help').isVisible(), true);
    assert.match(await page.locator('#context-help').innerText(), /Sugarcane, Moondew Radish, Waxing Moon Pepper, Apple, Fresh Water and Sea Salt/);
    await page.keyboard.press('Escape');
    assert.deepEqual(await config(), beforeDetails, 'reading help must not change the setup');
    await page.locator('#season-section').screenshot({ path: 'test-results/harvest-setup-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
        'the compact Harvest Moon setup must fit on mobile');
    const budgetInput = await page.locator('#season-wheat-budget').boundingBox();
    const plotLabel = await page.locator('label[for="season-mutation-plots"]').boundingBox();
    const plotInput = await page.locator('#season-mutation-plots').boundingBox();
    const budgetNote = await page.locator('#season-budget-note').boundingBox();
    assert.ok(plotLabel.y - budgetInput.y - budgetInput.height < 40,
        'stacked controls must not keep a desktop flex basis as empty vertical space');
    assert.ok(budgetNote.y - plotInput.y - plotInput.height < 40,
        'the budget summary must sit close to the controls');
    await page.locator('#season-section').screenshot({ path: 'test-results/harvest-setup-mobile.png' });
    // A real touch context verifies tap-to-toggle and viewport-safe positioning.
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await touchPage.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved });
    await touchPage.goto(base);
    await touchPage.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    const touchHelp = touchPage.getByRole('button', { name: 'About RV level', exact: true });
    const touchCard = touchPage.locator('#context-help');
    await touchHelp.tap();
    assert.equal(await touchCard.isVisible(), true);
    const touchBox = await touchCard.boundingBox();
    assert.ok(touchBox.x >= 0 && touchBox.x + touchBox.width <= 390,
        'help must fit inside the mobile viewport');
    assert.ok(touchBox.y >= 0 && touchBox.y + touchBox.height <= 844);
    await touchPage.screenshot({ path: 'test-results/context-help-mobile.png' });
    await touchHelp.tap();
    assert.equal(await touchCard.isVisible(), false, 'a second tap closes help');
    await touchHelp.tap();
    await touchPage.touchscreen.tap(2, 2);
    assert.equal(await touchCard.isVisible(), false, 'an outside tap closes help');
    assert.equal(await touchPage.locator('#home-level').inputValue(), '2');
    assert.equal(await touchPage.locator('#results-section').isVisible(), false);
    await touchContext.close();
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.locator('#season-mutation-plots').fill('2');
    assert.match(await page.locator('#season-budget-note').innerText(), /Budget conflict.*768/);
    await page.locator('#season-wheat-budget').fill('768');
    assert.match(await page.locator('#season-budget-note').innerText(), /Within budget/);
    await page.locator('#season-wheat-budget').fill('0');
    assert.match(await page.locator('#season-budget-note').innerText(), /Unlimited seed spend/);
    await page.locator('#season-mutation-plots').fill('0');
    assert.match(await page.locator('#season-budget-note').innerText(), /Order stock keeps 1 plot per crop/);
    await page.locator('#season-wheat-budget').fill('383');
    assert.match(await page.locator('#season-budget-note').innerText(), /Budget conflict.*384/);
    await page.locator('#season-wheat-budget').fill('');
    await page.locator('#season-mutation-plots').fill('');
    await page.locator('#setup-copy-code').click();
    await page.waitForFunction(() => !document.getElementById('setup-export-panel').hidden);
    await load(await page.locator('#setup-export-value').inputValue());
    assert.equal(await page.locator('#season-wheat-budget').inputValue(), '0');
    assert.equal(await page.locator('#season-mutation-plots').inputValue(), '0');

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
    await page.goto(base + '#config=v99.invalid');
    await page.waitForFunction(() => document.getElementById('setup-share-hint').textContent.includes('could not be loaded'));
    assert.deepEqual(await config(), savedBeforeLink);
    await page.goto(await createShareUrl(base, linked));
    await page.waitForFunction(() => document.getElementById('setup-share-hint').textContent.includes('Shared setup loaded'));
    assert.equal(await page.locator('#home-level').inputValue(), '10');
    assert.deepEqual(await config(), savedBeforeLink);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('setup-share-hint').textContent.includes('Shared setup loaded'));
    assert.equal(await page.locator('#home-level').inputValue(), '10');
    assert.deepEqual(await config(), savedBeforeLink);
    await page.locator('#season-mutation-plots').fill('2');
    assert.equal(await page.evaluate(() => window.location.hash), '');
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
    assert.equal(await page.locator('#harvest-order-card').isVisible(), true);
    assert.equal(await page.locator('#harvest-order-stock tbody tr').count(), 6);
    assert.match(await page.locator('#harvest-order-card').innerText(), /Apple/);
    assert.match(await page.locator('#harvest-order-card').innerText(), /Fresh Water/);
    assert.match(await page.locator('#harvest-order-card').innerText(), /Sea Salt/);
    assert.match(await page.locator('#harvest-order-card').innerText(), /Sugarcane/);
    await page.locator('#harvest-order-card').screenshot({ path: 'test-results/harvest-order-stock-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
        'the six-item raw stock report must fit on mobile');
    await page.locator('#harvest-order-card').screenshot({ path: 'test-results/harvest-order-stock-mobile.png' });
    await page.setViewportSize({ width: 1000, height: 900 });
    assert.equal(await page.locator('#results-content').isVisible(), true, 'real WASM must calculate imported settings');
    assert.equal(await page.locator('#error-message').isVisible(), false);
    // Import another setup after a solve, then switch modes: no old plan may reappear.
    await load(encodeSetupCode({ facilityTiers: {}, 'home-level': '1', 'mode-simple': true, 'mode-advanced': false,
        'season-on': false, 'force-e-mode': false, 'aniimo-best': false, 'aniimo-minimum': true,
        'aniimo-custom': false, goalTarget: 'coins' }));
    assert.equal(await page.locator('#results-section').isVisible(), false);
    await page.locator('label:has(#aniimo-best)').click();
    assert.equal(await page.locator('#aniimo-best').isChecked(), true);
    assert.equal(await page.locator('#results-section').isVisible(), false);
    assert.equal(await page.locator('#season-mutation-plots').inputValue(), '1');
    assert.equal((await config()).goalTarget, 'coins', 'imported goal must replace the previous plan choice');
    assert.deepEqual((await config()).roster, [], 'partial old setup must not merge with recipient roster');

    // Both new controls work before solving; RV14 Fill persists the correct cap data.
    await load(encodeSetupCode({ 'home-level': '14', 'mode-simple': true, 'mode-advanced': false,
        'simple-toolkit-upgrades': false, 'season-on': true, 'force-e-mode': false,
        'strategy-level-up': true, 'strategy-priorities': false }));
    assert.equal(await page.locator('#simple-toolkit-upgrades').isChecked(), false);
    for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(await page.locator('#' + id).inputValue(), '0',
        'legacy unticked setup restores every Simple module to zero');
    assert.equal(await page.locator('#simple-emode-title').innerText(), 'E-Mode needs a Power Module');
    await page.locator('#festival-batch summary').click();
    await page.locator('#festival-batch-amount').fill('3');
    await page.locator('#festival-batch-build').click();
    await page.waitForFunction(() => document.getElementById('festival-batch-result').textContent.includes('Craft in this order'));
    assert.match(await page.locator('#festival-batch-result').innerText(), /120 Moonray Wheat/);
    assert.match(await page.locator('#festival-batch-result').innerText(), /Recipe Note not ticked/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.equal(await page.locator('#festival-batch-result').evaluate(result => result.scrollWidth > result.clientWidth), false,
        'checklist quantities and facility names must fit without horizontal scrolling');
    await page.locator('#festival-batch').screenshot({ path: 'test-results/festival-checklist-mobile.png' });
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.locator('#festival-batch-amount').fill('2');
    assert.equal(await page.locator('#festival-batch-result').innerText(), '', 'editing setup must clear stale quantities');
    await page.locator('#festival-batch-build').click();
    await page.waitForFunction(() => document.getElementById('festival-batch-result').textContent.includes('80 Moonray Wheat'));
    await page.locator('#festival-batch summary').click();

    // Partial Toolkit ownership is editable directly in Simple, before any plan exists.
    const partialModules = { 'simple-ecological-module-level': '1', 'simple-kitchen-module-level': '0',
        'simple-resource-detector-level': '1', 'simple-crafting-module-level': 'auto',
        'simple-power-module-level': 'auto' };
    await load(encodeSetupCode({ 'home-level': '9', 'mode-simple': true, 'mode-advanced': false,
        'simple-toolkit-upgrades': true, ...partialModules, 'ecological-module-level': '2',
        'season-on': false, 'force-e-mode': false, 'strategy-level-up': false,
        'strategy-priorities': true, 'aniimo-best': true, 'aniimo-minimum': false, 'aniimo-custom': false }));
    assert.equal(await page.locator('#results-section').isVisible(), false);
    for (const { id } of SIMPLE_MODULE_FIELDS) {
        assert.equal(await page.locator('#' + id).isVisible(), true);
        assert.equal(await page.locator('#' + id).inputValue(), partialModules[id]);
    }
    assert.equal(await page.locator('#simple-toolkit-upgrades').evaluate(el => el.indeterminate), true);
    await page.locator('#simple-ecological-module-level').selectOption('2');
    partialModules['simple-ecological-module-level'] = '2';
    assert.equal((await config())['simple-ecological-module-level'], '2');
    await page.locator('#setup-copy-code').click();
    await page.waitForFunction(() => !document.getElementById('setup-export-panel').hidden);
    const partialCode = await page.locator('#setup-export-value').inputValue();
    await page.locator('#home-level').selectOption('3');
    assert.equal(await page.locator('#simple-ecological-module-level').inputValue(), '1');
    assert.equal((await config())['simple-resource-detector-level'], '0', 'lowering RV saves clamped module levels');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    assert.equal(await page.locator('#simple-resource-detector-level').inputValue(), '0');
    assert.equal(await page.locator('#simple-ecological-module-level').inputValue(), '1');
    await load(partialCode);
    assert.equal(await page.locator('#home-level').inputValue(), '9');
    for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(await page.locator('#' + id).inputValue(), partialModules[id],
        'import must restore levels above the previously selected RV cap');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('version').textContent.includes('0.16.0'));
    for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(await page.locator('#' + id).inputValue(), partialModules[id]);
    await page.locator('#simple-config').screenshot({ path: 'test-results/simple-modules-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
        'the individual Simple module controls must fit on mobile');
    await page.locator('#simple-config').screenshot({ path: 'test-results/simple-modules-mobile.png' });
    await page.setViewportSize({ width: 1000, height: 900 });

    // The master control resets all modules together; the real worker receives owned levels.
    await page.locator('label:has(#simple-toolkit-upgrades)').click();
    for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(await page.locator('#' + id).inputValue(), 'auto');
    await page.locator('label:has(#simple-toolkit-upgrades)').click();
    for (const { id } of SIMPLE_MODULE_FIELDS) assert.equal(await page.locator('#' + id).inputValue(), '0');
    await load(partialCode);
    await page.locator('#home-level').selectOption('3');
    await page.evaluate(() => {
        const original = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function(message, ...args) {
            if (message.type === 'find_plan') window.simpleModulePayload = JSON.parse(message.payload);
            return original.call(this, message, ...args);
        };
        window.restoreWorkerPostMessage = () => { Worker.prototype.postMessage = original; };
    });
    await page.locator('#optimize-btn').click();
    await page.waitForFunction(() => !document.getElementById('optimize-btn').disabled, null, { timeout: 120_000 });
    assert.equal(await page.locator('#error-message').isVisible(), false);
    assert.equal(await page.locator('#results-content').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.simpleModulePayload.modules),
        { ecological_module: 1, kitchen_module: 0, resource_detector: 0, crafting_module: 0, power_module: 0 });
    await page.evaluate(() => window.restoreWorkerPostMessage());
    await page.locator('label:has(#mode-advanced)').click();
    assert.equal(await page.locator('#ecological-module-level').inputValue(), '2', 'Simple does not overwrite Advanced module levels');
    // Check the actual Advanced Fill button for RV14–20, not only the underlying table.
    for (let rv = 14; rv <= 20; rv++) {
        await page.locator('#fill-level').selectOption(String(rv));
        await page.locator('#fill-btn').click();
        const actual = (await config()).facilityTiers;
        for (const name of ['Farmland', 'Woodland', 'Well', 'Tidewhisper Sandcastle',
            'Dewy House', 'Nimbus Bed', 'Starfall Hammock', 'Heat Furnace',
            'Cooling Unit', 'Sunlamp', 'Crackle Generator', 'Blazing Stove',
            'Pickling Jar', 'Joy Wheel Loom', 'Woodworking Bench', 'Chimney Kiln']) {
            assert.equal(actual[name][0].count, simpleSetup(rv).facilities[name][0].count,
                `Advanced Fill ${name} RV${rv}`);
        }
    }

    // A real UI solve displays retained variety and a bounded RV tradeoff.
    await load(encodeSetupCode({ 'home-level': '3', 'mode-simple': false, 'mode-advanced': true,
        'strategy-level-up': true, 'strategy-priorities': false, 'level-up-target': '4',
        'rv-order-variety': true, 'season-on': false, 'force-e-mode': false,
        'aniimo-best': true, 'aniimo-minimum': false, 'aniimo-custom': false,
        facilityTiers: { Farmland: [{ count: 4, level: 2 }], Woodland: [{ count: 1, level: 1 }],
            Mine: [{ count: 1, level: 1 }], 'Carousel Mill': [{ count: 2, level: 1 }],
            'Claw Game Cooker': [{ count: 1, level: 1 }] } }));
    assert.equal(await page.locator('#festival-batch-result').innerText(), '', 'import must clear the previous checklist');
    await page.locator('#optimize-btn').click();
    await page.waitForFunction(() => !document.getElementById('optimize-btn').disabled, null, { timeout: 120_000 });
    assert.equal(await page.locator('#error-message').isVisible(), false);
    assert.equal(await page.locator('#order-variety-card').isVisible(), true);
    assert.ok(await page.locator('#order-variety-stock tbody tr').count() >= 3);
    assert.match(await page.locator('#order-variety-note').innerText(), /crafted items.*raw extra.*spare units/);
    await page.locator('#order-variety-card').screenshot({ path: 'test-results/order-variety-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.locator('#order-variety-card').screenshot({ path: 'test-results/order-variety-mobile.png' });
    await page.setViewportSize({ width: 1000, height: 900 });

    // RV14 matches the reported setup: required festival raw stock remains, but ordinary
    // raw order extras must explicitly come from spare gathering units.
    await load(encodeSetupCode({ 'home-level': '14', 'mode-simple': true, 'mode-advanced': false,
        'strategy-level-up': true, 'strategy-priorities': false, 'level-up-target': '15',
        'rv-order-variety': true, 'season-on': true, 'season-wheat-budget': '600', 'season-mutation-plots': '1',
        'simple-toolkit-upgrades': false, 'force-e-mode': false,
        'aniimo-best': false, 'aniimo-minimum': true, 'aniimo-custom': false }));
    await page.locator('#optimize-btn').click();
    await page.waitForFunction(() => !document.getElementById('optimize-btn').disabled, null, { timeout: 180_000 });
    assert.equal(await page.locator('#error-message').isVisible(), false);
    assert.equal(await page.locator('#order-variety-card').isVisible(), true);
    assert.equal(await page.locator('#harvest-order-stock tbody tr').count(), 6);
    assert.match(await page.locator('#order-variety-note').innerText(), /crafted items.*raw extra.*spare units/);
    const spareRows = page.locator('#facility-plan-container tr').filter({ hasText: 'for orders from spare units' });
    assert.ok(await spareRows.count() > 0, 'RV14 has spare gathering capacity for optional raw stock');
    await page.locator('#order-variety-card').screenshot({ path: 'test-results/order-variety-rv14.png' });
    await page.locator('#facility-plan-container').screenshot({ path: 'test-results/order-variety-rv14-facilities.png' });

    // A cheap real solve verifies that resource readiness does not claim the RV upgrade is instant.
    await load(encodeSetupCode({ facilityTiers: { 'Nimbus Bed': [{ count: 1, level: 2 }] },
        'home-level': '13', 'mode-simple': false, 'mode-advanced': true,
        'resource-detector-level': '5', 'season-on': false, 'force-e-mode': false,
        'aniimo-best': false, 'aniimo-minimum': true, 'aniimo-custom': false,
        'strategy-level-up': true, 'strategy-priorities': false, 'level-up-target': '14',
        'layout-storage-count': '6',
        levelUpStock: { coins: 2620000, standard_planks: 1590, sintered_ore_brick: 1060 } }));
    await page.locator('#optimize-btn').click();
    await page.waitForFunction(() => !document.getElementById('optimize-btn').disabled, null, { timeout: 120_000 });
    assert.equal(await page.locator('#error-message').isVisible(), false);
    assert.equal(await page.locator('#level-up-label').textContent(), 'Resources for RV 14');
    assert.equal(await page.locator('#level-up-time').innerText(), 'Ready now');
    assert.match(await page.locator('#level-up-prerequisites').innerText(), /6h.*upgrade timer/);
    await page.getByRole('button', { name: 'About RV upgrade time', exact: true }).click();
    assert.match(await page.locator('#context-help').innerText(), /placement, habitability, title and quest/);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#layout-storage-hint').innerText(), /RV 13.*at most 5.*uses 5 of the 6/);
    await page.waitForFunction(() => document.querySelector('#layout-diagram svg'));
    assert.equal(await page.locator('#layout-diagram .layout-storages > g').count(), 5,
        'the real layout worker must respect the verified RV13 storage placement limit');
    assert.equal((await config())['layout-storage-count'], '6', 'a constrained layout preserves the imported preference');
    await page.locator('#level-up-card').screenshot({ path: 'test-results/rv14-resource-timer.png' });

    // Storage denial still permits a reviewed import for this visit.
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage unavailable'); }; });
    await load(encodeSetupCode({ ...linked, 'home-level': '11' }));
    assert.equal(await page.locator('#home-level').inputValue(), '11');
    assert.match(await page.locator('#setup-share-hint').innerText(), /saving is unavailable/);
    assert.deepEqual(errors, [], 'browser/WASM should not raise uncaught errors');
    console.log('Setup UI/WASM smoke passed: import/export, Simple module levels and solver payload, family restore and staffing, old codes, shared links, raw order stock, budget feedback, RV upgrade timers, desktop/mobile and storage denial.');
} catch (error) {
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
    await page.screenshot({ path: 'test-results/setup-failure.png', fullPage: true });
    console.error('Browser state:', await page.evaluate(() => ({
        version: document.getElementById('version')?.textContent,
        error: document.getElementById('error-message')?.textContent,
        status: document.getElementById('setup-share-hint')?.textContent,
    })));
    throw error;
} finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
