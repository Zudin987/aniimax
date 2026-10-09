import assert from 'node:assert/strict';

const epsilon = 1e-6;
const overlaps = (a, b) => a.x < b.x + b.w - epsilon && b.x < a.x + a.w - epsilon
    && a.y < b.y + b.h - epsilon && b.y < a.y + a.h - epsilon;
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const beside = (a, b) => (Math.abs(a.x + a.w - b.x) < epsilon || Math.abs(b.x + b.w - a.x) < epsilon)
    && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + epsilon
    || (Math.abs(a.y + a.h - b.y) < epsilon || Math.abs(b.y + b.h - a.y) < epsilon)
    && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + epsilon;

// Check the buildable result, independently of the search strategy used to obtain it.
export function assertPowerLayout(layout, cells, gap, storages, generators) {
    assert.equal(layout.storages.length, storages);
    assert.equal(layout.generators.length, generators);
    assert.deepEqual(layout.unplaced, [], 'all requested production pieces must fit');
    assert.equal(layout.unplacedGenerators, 0, 'all active generators must fit');
    const members = layout.pieces.flatMap(p => p.members);
    const solid = [...layout.storages, ...layout.generators, ...members];
    const spaces = layout.powerSpaces;
    for (const r of [...solid, ...spaces]) {
        assert.ok(cells.reduce((sum, cell) => sum + intersection(r, cell), 0) >= r.w * r.h - epsilon,
            `${r.facility || 'Storage'} left unlocked land`);
    }
    solid.forEach((a, i) => solid.slice(i + 1).forEach(b =>
        assert.equal(overlaps(a, b), false, 'building footprints must not overlap')));
    assert.equal(spaces.length, gap > 0 ? members.filter(m => m.electric).length + generators : 0);
    for (const space of spaces) {
        assert.equal(space.w, gap);
        assert.equal(space.h, gap);
        assert.ok(solid.every(r => !overlaps(space, r)), 'connection space must stay empty');
        assert.ok(solid.some(r => r.facility === space.facility && beside(space, r)),
            'connection space must be beside its powered station');
    }
}
