import assert from 'node:assert/strict';
import fs from 'node:fs';

const revision = 'a'.repeat(40);
const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const workerUrlCode = app.slice(app.indexOf('const workerUrl ='), app.indexOf('function initWorker()'))
    .replaceAll('import.meta.url', 'scriptAddress');
const workerUrl = new Function('scriptAddress', `${workerUrlCode}\nreturn WORKER_URL;`)(
    `https://zudin987.github.io/aniimax/app.js?v=${revision}`);
assert.equal(new URL(workerUrl).searchParams.get('v'), revision, 'The app must pass its build to the worker');
assert.equal(new URL(workerUrl).pathname, '/aniimax/worker.js');
assert.ok(new URL(workerUrl).searchParams.get('load'));

const worker = fs.readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8');
const loader = worker.slice(0, worker.indexOf('// Seconds HiGHS'))
    .replace(/^import .+;$/gm, '')
    .replaceAll('import.meta.url', 'workerAddress')
    .replace("import('./pkg/aniimax.js' + load)", "importPkg('./pkg/aniimax.js' + load)");
for (const [address, query, cache] of [
    [workerUrl, `?v=${revision}`, 'default'],
    ['https://example.test/worker.js?load=123', '?load=123', 'no-cache'],
]) {
    const imports = [];
    const fetches = [];
    const runtime = new Function('workerAddress', 'fetch', 'importPkg', 'highsModule',
        `${loader}\nreturn { ready, newHighs };`)(
        address,
        async (url, options) => {
            fetches.push({ url: new URL(url), options });
            return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
        },
        async (url) => {
            imports.push(url);
            return { default: async ({ module_or_path }) => { await module_or_path; } };
        },
        async ({ wasmBinary }) => { assert.equal(wasmBinary.byteLength, 1); return {}; },
    );
    await runtime.ready;
    await runtime.newHighs();
    assert.deepEqual(imports, ['./pkg/aniimax.js' + query]);
    assert.equal(fetches[0].url.pathname, new URL('./pkg/aniimax_bg.wasm', address).pathname);
    assert.equal(fetches[0].url.search, query, 'The actual optimizer WASM must use the module build');
    assert.equal(fetches[0].options.cache, cache);
    assert.equal(fetches[1].url.pathname, new URL('./vendor/highs/highs.wasm', address).pathname);
    assert.equal(fetches[1].url.search, query, 'HiGHS WASM must use the same build');
}
console.log('Browser asset version propagation passed.');
