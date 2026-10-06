// Use the real browser worker planner and HiGHS against compiled WASM.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import highsModule from '../web/vendor/highs/highs.mjs';
import { aniimoTeamCount } from '../web/aniimo-team.js';

const pkgDir = process.env.ANIIMAX_WASM_DIR || new URL('../web/pkg/', import.meta.url);
const pkgUrl = pkgDir instanceof URL ? pkgDir : pathToFileURL(path.resolve(pkgDir) + path.sep);
export const pkg = await import(new URL('aniimax.js', pkgUrl));
await pkg.default({ module_or_path: fs.readFileSync(new URL('aniimax_bg.wasm', pkgUrl)) });
export const newHighs = async () => highsModule({ wasmBinary: fs.readFileSync(new URL('../web/vendor/highs/highs.wasm', import.meta.url)),
    print: () => {}, printErr: () => {} });
const worker = fs.readFileSync(new URL('../web/worker.js', import.meta.url), 'utf8');
const plannerSource = worker.slice(worker.indexOf('// Seconds HiGHS'), worker.indexOf('// Ranks changes'));
export const createPlanner = (solverFactory = newHighs) =>
    new Function('newHighs', 'aniimoTeamCount', plannerSource + '\nreturn exactPlanJson;')(solverFactory, aniimoTeamCount);
export const plan = createPlanner();
