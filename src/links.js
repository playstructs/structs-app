/* The Structs link grammar — one grammar for the web, the desktop app and the Terminal.
 *
 *   https://structs.app/<view>/<subject>      what people share
 *   structs://<view>/<subject>                what the desktop app answers
 *   VIEW subject                              what the Terminal already takes
 *
 * A chain id names its own kind (the prefix is the object type), so the
 * shortest link is just the id — structs.app/1-61 — and the view is the
 * id's default. Like the Terminal, both orders are understood:
 * /map/1-61 and /1-61/map are the same link; the first is canonical.
 *
 * Pure: no I/O, no DOM. The desktop app can carry a copy of this file
 * verbatim; docs/links.md is the human-readable version of the same table.
 */

/* Object type prefixes — structs-webapp `ObjectTypes`. */
export const KIND = {
  0: 'guild', 1: 'player', 2: 'planet', 3: 'reactor', 4: 'substation',
  5: 'struct', 9: 'fleet', 10: 'provider',
};

/* view → which kinds it accepts. The first view listed for a kind is that
 * kind's default, which is what a bare id opens. */
export const VIEWS = {
  player:   { kinds: ['player'],                   word: 'PLAYER' },
  map:      { kinds: ['planet', 'fleet', 'player'], word: 'MAP' },
  record:   { kinds: ['player'],                   word: 'RECORD' },
  tally:    { kinds: ['player'],                   word: 'TALLY' },
  provider: { kinds: ['provider'],                 word: 'PROVIDER' },
  reactor:  { kinds: ['reactor'],                  word: 'REACTOR' },
};

const DEFAULT_VIEW = { player: 'player', planet: 'map', fleet: 'map', provider: 'provider', reactor: 'reactor' };

/* Words people might reasonably type for a view — the Terminal's aliases. */
const ALIASES = {
  p: 'player', profile: 'player',
  awards: 'record', achievements: 'record',
  hulls: 'tally', kills: 'tally',
  planet: 'map', fleet: 'map',
};

const ID_RE = /^(\d{1,2})-(\d{1,12})$/;
/* A simulator challenge code: base64url, bounded. A result rides after it as
 * one more segment (/sim/<code>/<result>); the loader decides whether it is a
 * valid result, and a bad one never loses the battle. */
const SIM_RE = /^[A-Za-z0-9_-]{4,2000}$/;
const RESULT_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function kindOf(id) {
  const m = ID_RE.exec(String(id || ''));
  return m ? KIND[Number(m[1])] || null : null;
}

function viewName(word) {
  const w = String(word || '').toLowerCase();
  return VIEWS[w] ? w : ALIASES[w] || null;
}

/**
 * A path (or a structs:// URL) → a link, or null.
 *
 *   { view: 'map', id: '9-61', kind: 'fleet' }
 *   { view: 'sim', code: '…' }             a simulator challenge
 *   { view: 'sim', code: '…', result: '…' } the same battle, with how it went
 *   { view: 'home' }
 */
export function parse(input) {
  let s = String(input || '').trim();
  s = s.replace(/^structs:\/\//i, '/').replace(/^https?:\/\/[^/]+/i, '');
  s = s.split(/[?#]/)[0];
  const parts = s.split('/').filter(Boolean).map(decodeURIComponentSafe);
  if (parts.length === 0) return { view: 'home' };

  if (parts[0].toLowerCase() === 'sim') {
    if (parts.length === 2 && SIM_RE.test(parts[1])) return { view: 'sim', code: parts[1] };
    // A result segment that is not even shaped like one still leaves a good battle: canonical, it is just /sim/<code>.
    if (parts.length === 3 && SIM_RE.test(parts[1])) return RESULT_RE.test(parts[2]) ? { view: 'sim', code: parts[1], result: parts[2] } : { view: 'sim', code: parts[1] };
    return null;
  }
  if (parts.length > 2) return null;

  let id, word;
  if (parts.length === 1) id = parts[0];
  else if (kindOf(parts[0])) [id, word] = parts;      // /1-61/map
  else [word, id] = parts;                            // /map/1-61

  const kind = kindOf(id);
  if (!kind) return null;
  const view = word === undefined ? DEFAULT_VIEW[kind] : viewName(word);
  if (!view || !VIEWS[view] || !VIEWS[view].kinds.includes(kind)) return null;
  return { view, id, kind };
}

function decodeURIComponentSafe(p) {
  try { return decodeURIComponent(p); } catch { return ''; }
}

/** The canonical path for a link: /map/9-61, /sim/<code>, /sim/<code>/<result>, /. */
export function path(link) {
  if (!link || link.view === 'home') return '/';
  if (link.view === 'sim') return '/sim/' + link.code + (link.result ? '/' + link.result : '');
  return '/' + link.view + '/' + link.id;
}

/** The desktop app's deep link for the same thing. */
export function appUrl(link) {
  return 'structs:/' + path(link);
}

/** The Terminal command for the same thing — what the desktop app runs. */
export function terminalLine(link) {
  if (!link || !VIEWS[link.view]) return null;
  return VIEWS[link.view].word + ' ' + link.id;
}
