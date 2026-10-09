// Portable Aniimax setup/layout codes.
//
// Setup codes can be created before running the optimizer, so another player can import the
// calculator inputs first, review them, then calculate on their own device. Layout codes remain
// backwards-compatible with the original ANIIMAX1 format.
import { readShareHash } from './share-config.js';
import { FACILITIES, MAX_HOME_LEVEL } from './facility-config.js';

const SETUP_PREFIX = 'ANIIMAX2.';
const LAYOUT_PREFIX = 'ANIIMAX1.';
const MAX_CODE_LENGTH = 500_000;

function encodeUtf8(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    if (bytes.length > 350_000) throw new Error('code is too large');
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeUtf8(body) {
    if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error('damaged code');
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function checkedCode(code) {
    const value = String(code || '').trim();
    if (!value) throw new Error('empty code');
    if (value.length > MAX_CODE_LENGTH) throw new Error('code is too large');
    return value;
}

export function encodeSetupCode(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('missing setup data');
    }
    return SETUP_PREFIX + encodeUtf8({ v: 2, kind: 'setup', settings });
}

export function decodeSetupCode(code) {
    const value = checkedCode(code);
    if (!value.startsWith(SETUP_PREFIX)) throw new Error('not an Aniimax setup code');
    const parsed = decodeUtf8(value.slice(SETUP_PREFIX.length));
    if (parsed?.v !== 2 || parsed?.kind !== 'setup' || !parsed.settings
        || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)) {
        throw new Error('missing setup data');
    }
    return parsed.settings;
}

export function encodeLayoutCode(drawn) {
    validateLayout(drawn);
    return LAYOUT_PREFIX + encodeUtf8({ v: 1, homeLevel: drawn.homeLevel, layout: drawn.layout });
}

export function decodeLayoutCode(code) {
    const value = checkedCode(code);
    if (!value.startsWith(LAYOUT_PREFIX)) throw new Error('not an Aniimax layout code');
    const parsed = decodeUtf8(value.slice(LAYOUT_PREFIX.length));
    if (parsed?.v !== 1 || !parsed.layout || !Array.isArray(parsed.layout.pieces)) {
        throw new Error('missing layout data');
    }
    const drawn = { homeLevel: parsed.homeLevel === undefined ? 1 : Number(parsed.homeLevel), layout: parsed.layout };
    validateLayout(drawn);
    return drawn;
}

function validateLayout(drawn) {
    const layout = drawn?.layout;
    if (!Number.isInteger(drawn?.homeLevel) || drawn.homeLevel < 1 || drawn.homeLevel > MAX_HOME_LEVEL
        || !layout || !Array.isArray(layout.pieces) || layout.pieces.length > 2000) {
        throw new Error('missing or invalid layout data');
    }
    const rectangle = r => {
        if (!r || !['x', 'y', 'w', 'h'].every(k => typeof r[k] === 'number' && Number.isFinite(r[k])
            && Math.abs(r[k]) <= 1000) || r.w <= 0 || r.h <= 0) throw new Error('invalid layout coordinates');
    };
    const storages = layout.storages?.length ? layout.storages : [layout.storage];
    if (!Array.isArray(storages) || storages.length > 24) throw new Error('invalid layout storage');
    storages.forEach(rectangle);
    let members = 0;
    layout.pieces.forEach(piece => {
        if (!piece || !Array.isArray(piece.members) || !piece.members.length) throw new Error('invalid layout pieces');
        members += piece.members.length;
        if (members > 4000) throw new Error('layout is too large');
        piece.members.forEach(member => {
            rectangle(member);
            if (!FACILITIES.some(f => f.name === member.facility)) throw new Error('unsupported layout facility');
            if (member.weight !== undefined && (!Number.isFinite(member.weight) || member.weight < 0)) throw new Error('invalid layout weight');
        });
    });
    if (layout.generators !== undefined) {
        if (!Array.isArray(layout.generators) || layout.generators.length > 20) throw new Error('invalid layout generators');
        layout.generators.forEach(g => { rectangle(g); rectangle(g.coverage); });
    }
    if (layout.powerSpaces !== undefined) {
        if (!Array.isArray(layout.powerSpaces) || layout.powerSpaces.length > 4000) throw new Error('invalid connection spaces');
        layout.powerSpaces.forEach(rectangle);
    }
    // Imported coordinates and metadata are eventually rendered in SVG attributes. Reject
    // unexpected markup as well as non-finite numbers anywhere in the legacy snapshot.
    let nodes = 0;
    const walk = (value, depth = 0) => {
        if (++nodes > 50_000 || depth > 15) throw new Error('layout is too complex');
        if (typeof value === 'string' && /[<>"'`]/.test(value)) throw new Error('invalid layout text');
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('invalid layout number');
        if (value && typeof value === 'object') Object.values(value).forEach(child => walk(child, depth + 1));
    };
    walk(layout);
}

// Accept both fork codes and upstream's compressed v1 setup links/tokens. A pasted URL
// is only parsed locally; importing never navigates to it or fetches its contents.
export async function readSetupImport(raw) {
    const value = checkedCode(raw);
    if (value.startsWith(SETUP_PREFIX)) return { kind: 'setup', settings: decodeSetupCode(value) };
    if (value.startsWith(LAYOUT_PREFIX)) return { kind: 'layout', drawn: decodeLayoutCode(value) };
    let hash;
    if (/^https?:\/\//i.test(value)) hash = new URL(value).hash;
    else if (value.startsWith('v1.')) hash = '#config=' + value;
    else if (value.startsWith('#') || value.startsWith('config=')) hash = value;
    if (hash !== undefined) {
        const settings = await readShareHash(hash);
        if (settings) return { kind: 'setup', settings };
    }
    if (/^[A-Za-z0-9]{8}$/.test(value)) throw new Error('Game Combo Codes cannot be imported into this calculator');
    throw new Error('Use an Aniimax setup code, layout code or shared setup link (unsupported format or version)');
}

export function aniimaxCodeKind(code) {
    const value = String(code || '').trim();
    if (value.startsWith(SETUP_PREFIX)) return 'setup';
    if (value.startsWith(LAYOUT_PREFIX)) return 'layout';
    return null;
}
