// Portable Aniimax setup/layout codes.
//
// Setup codes can be created before running the optimizer, so another player can import the
// calculator inputs first, review them, then calculate on their own device. Layout codes remain
// backwards-compatible with the original ANIIMAX1 format.

const SETUP_PREFIX = 'ANIIMAX2.';
const LAYOUT_PREFIX = 'ANIIMAX1.';
const MAX_CODE_LENGTH = 500_000;

function encodeUtf8(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeUtf8(body) {
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
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
    if (!drawn?.layout || !Array.isArray(drawn.layout.pieces)) {
        throw new Error('missing layout data');
    }
    return LAYOUT_PREFIX + encodeUtf8({ v: 1, homeLevel: drawn.homeLevel, layout: drawn.layout });
}

export function decodeLayoutCode(code) {
    const value = checkedCode(code);
    if (!value.startsWith(LAYOUT_PREFIX)) throw new Error('not an Aniimax layout code');
    const parsed = decodeUtf8(value.slice(LAYOUT_PREFIX.length));
    if (parsed?.v !== 1 || !parsed.layout || !Array.isArray(parsed.layout.pieces)) {
        throw new Error('missing layout data');
    }
    return { homeLevel: Number(parsed.homeLevel) || 1, layout: parsed.layout };
}

export function aniimaxCodeKind(code) {
    const value = String(code || '').trim();
    if (value.startsWith(SETUP_PREFIX)) return 'setup';
    if (value.startsWith(LAYOUT_PREFIX)) return 'layout';
    return null;
}
