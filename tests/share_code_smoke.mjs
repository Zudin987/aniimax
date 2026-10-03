import {
  aniimaxCodeKind, decodeLayoutCode, decodeSetupCode, encodeLayoutCode, encodeSetupCode,
} from '../web/share-code.js';

const setup = {
  'mode-simple': false,
  'mode-advanced': true,
  'home-level': '13',
  'season-on': true,
  'season-wheat-budget': '600',
  'season-mutation-plots': '1',
  facilityTiers: {
    Mine: [{ count: 7, level: 4 }],
    'Bouncy Brew Keg': [{ count: 2, level: 3 }],
  },
  skippedRecipes: ['quick_potato'],
  roster: [{ name: 'Nimbi ✓', count: 1, abilities: { Leisure: 4 }, personalities: ['Instinctive', 'Nimble', 'Faithful', 'Playful'] }],
};

const setupCode = encodeSetupCode(setup);
if (aniimaxCodeKind(setupCode) !== 'setup') throw new Error('setup code kind not detected');
const setupRoundTrip = decodeSetupCode(setupCode);
if (JSON.stringify(setupRoundTrip) !== JSON.stringify(setup)) throw new Error('setup code round-trip changed data');

const drawn = {
  homeLevel: 13,
  layout: {
    pieces: [{ members: [{ facility: 'Mine', x: 1, y: 2, w: 5, h: 5 }] }],
    storage: { x: 0, y: 0, w: 2, h: 2 },
    storages: [{ x: 0, y: 0, w: 2, h: 2 }],
  },
};
const layoutCode = encodeLayoutCode(drawn);
if (aniimaxCodeKind(layoutCode) !== 'layout') throw new Error('layout code kind not detected');
const layoutRoundTrip = decodeLayoutCode(layoutCode);
if (layoutRoundTrip.homeLevel !== drawn.homeLevel
    || JSON.stringify(layoutRoundTrip.layout) !== JSON.stringify(drawn.layout)) {
  throw new Error('legacy layout code round-trip changed data');
}

for (const bad of ['', 'ANIIMAX2.bad', 'ANIIMAX1.bad', 'NOTANIIMAX.x']) {
  let rejected = false;
  try {
    if (bad.startsWith('ANIIMAX1.')) decodeLayoutCode(bad); else decodeSetupCode(bad);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`invalid code was accepted: ${bad}`);
}

console.log('share code smoke OK');
