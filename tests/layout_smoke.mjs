import { layOut, layOutHomeland } from '../web/layout.js';
import assert from 'node:assert/strict';
import { assertPowerLayout } from './layout_assertions.mjs';

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const cells = [
  { x: 0, y: 0, w: 20, h: 15 },
  { x: 20, y: 0, w: 20, h: 15 },
];

const pieces = Array.from({ length: 8 }, (_, i) => ({
  members: [{
    x: 0, y: 0, w: 2, h: 2,
    weight: i + 1,
    cycle: 60,
    crop: `test_${i}`,
    facility: i < 4 ? 'Crafting Table' : 'Farmland',
    sensitive: false,
    electric: i < 3,
  }],
}));

const one = layOutHomeland(pieces, cells, { w: 2, h: 2 }, 1, 0);
const two = layOutHomeland(pieces, cells, { w: 2, h: 2 }, 2, 0);

if ((one.storages || []).length !== 1) throw new Error('single-storage layout lost its Storage Unit');
if ((two.storages || []).length !== 2) throw new Error('two-storage layout did not place two Storage Units');
if (overlaps(two.storages[0], two.storages[1])) throw new Error('Storage Units overlap');

for (const store of two.storages) {
  const areaInside = cells.reduce((sum, cell) => {
    const x = Math.max(0, Math.min(store.x + store.w, cell.x + cell.w) - Math.max(store.x, cell.x));
    const y = Math.max(0, Math.min(store.y + store.h, cell.y + cell.h) - Math.max(store.y, cell.y));
    return sum + x * y;
  }, 0);
  if (areaInside < store.w * store.h - 1e-6) throw new Error('Storage Unit left the unlocked Homeland plots');
}

const powered = layOutHomeland(pieces, cells, { w: 2, h: 2 }, 2, 1);
assertPowerLayout(powered, cells, 1.5, 2, 1);
if ((powered.generators || []).length !== 1) throw new Error('active Crackle Generator was not placed');
const generator = powered.generators[0];
if (generator.w !== 1 || generator.h !== 1) throw new Error('Crackle Generator footprint must be 1x1');
if (generator.coverage.w !== 11 || generator.coverage.h !== 11) throw new Error('Crackle Generator direct coverage must be 11x11');

const original = structuredClone(pieces);
for (const gap of [0, 0.5, 1, 2]) {
    const layout = layOutHomeland(pieces, cells, { w: 2, h: 2 }, 2, 1, { powerGap: gap });
    assertPowerLayout(layout, cells, gap, 2, 1);
    assert.equal(layout.pieces.flatMap(p => p.members).length, pieces.length,
        'reserved ground must not become an extra producing facility');
}
assert.deepEqual(pieces, original, 'layout search must not change solver pieces');

// A busy ring fills the space beside the first Storage Unit. The next facility should use
// the clear, distant unit, rather than stopping the search around the origin.
const ring = { members: [
    { x: -2, y: -2, w: 1, h: 4, weight: 100 }, { x: 1, y: -2, w: 1, h: 4, weight: 100 },
    { x: -1, y: -2, w: 2, h: 1, weight: 100 }, { x: -1, y: 1, w: 2, h: 1, weight: 100 },
] };
const distant = layOut([ring, { members: [{ x: 0, y: 0, w: 1, h: 1, weight: 1 }] }], {
    storages: [{ x: -1, y: -1, w: 2, h: 2 }, { x: 39, y: -1, w: 2, h: 2 }],
    cells: [{ x: -10, y: -10, w: 60, h: 20 }],
});
assert.ok(distant.pieces[1].members[0].x > 30, 'the search must reach every Storage Unit');
assert.ok(distant.pieces[1].cost < 1.51, 'busy output should use the clear nearest storage');

// A narrow corner needs rotation to fit a machine and its connection square.
const corner = [{ x: 0, y: 0, w: 6, h: 3 }, { x: 0, y: 3, w: 3, h: 3 }];
const cornerPieces = [{ members: [{ x: 0, y: 0, w: 2.5, h: 1.75, weight: 5,
    facility: 'Blazing Stove', electric: true }] }];
assertPowerLayout(layOutHomeland(cornerPieces, corner, { w: 2, h: 2 }, 1, 1), corner, 1.5, 1, 1);

// If the land cannot fit the requested gap, report it instead of silently closing the gap.
const crowded = layOutHomeland(cornerPieces, [{ x: 0, y: 0, w: 3, h: 3 }], { w: 2, h: 2 }, 1, 1);
assert.ok(crowded.unplaced.length || crowded.unplacedGenerators, 'insufficient connection room must be reported');
assert.equal(crowded.powerGap, 1.5);

// Temperature-sensitive crops keep their planned environment even beside reserved power space.
const climatePieces = [...pieces, { cluster: true,
    buildings: [{ x: 0, y: 0, w: 1, h: 1, weight: 0, facility: 'Heat Furnace', building: true }],
    plots: [{ w: 2, h: 2, weight: 2, facility: 'Farmland', zone: 0 }], planned: [{ x: 1, y: 0 }] }];
const climate = layOutHomeland(climatePieces, cells, { w: 2, h: 2 }, 2, 1);
assertPowerLayout(climate, cells, 1.5, 2, 1);
const [heater, crop] = climate.pieces.at(-1).members;
assert.ok(overlaps(crop, { x: heater.x + heater.w / 2 - 4.5, y: heater.y + heater.h / 2 - 4.5, w: 9, h: 9 }));

console.log('layout smoke OK', {
  storages: two.storages.map(s => [s.x, s.y]),
  generator: [generator.x, generator.y],
  needsPowerPole: powered.needsPowerPole,
});
