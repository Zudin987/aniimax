import { layOutHomeland } from '../web/layout.js';

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
if ((powered.generators || []).length !== 1) throw new Error('active Crackle Generator was not placed');
const generator = powered.generators[0];
if (generator.w !== 1 || generator.h !== 1) throw new Error('Crackle Generator footprint must be 1x1');
if (generator.coverage.w !== 11 || generator.coverage.h !== 11) throw new Error('Crackle Generator direct coverage must be 11x11');

console.log('layout smoke OK', {
  storages: two.storages.map(s => [s.x, s.y]),
  generator: [generator.x, generator.y],
  needsPowerPole: powered.needsPowerPole,
});
