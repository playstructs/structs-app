/* Preview data for every view, shaped exactly as data.js hands it to the
 * cards (the `og` object), from today's typical values to the worst cases.
 *
 *   typical   today's data
 *   longest   real extremes: the chain's 20-character names, the unit
 *             ladders' longest readings, four-digit counts
 *   widest    valid but pathological: a 20-letter all-M name, the widest
 *             string the pixel faces can draw
 *   sparse    what is missing: no username, no guild, nothing raided
 *   overflow  past every limit (an unclamped guild label, a raw IBC denom):
 *             an ellipsis there is the design working
 *
 * The same samples sit behind the design canvas's Sample switch.
 */
const PFP_A = JSON.stringify({ background: 1, arms: 1, body: 1, neck: 1, head: 1 });
const PFP_B = JSON.stringify({ background: 3, arms: 10, body: 10, neck: 3, head: 20 });

const M20 = 'MMMMMMMMMMMMMMMMMMMM';
const LONG = 'Constance-Sutherland';
const OVER_GUILD = '[GUILDTAG] The Extremely Long Guild Name Nobody Clamped';

function person(id, name, guildLabel, extra = {}) {
  return { id, name: name || id, pfp: extra.pfp ?? PFP_A, guildLabel, planetId: '2-1', charge: 5, alpha: 108e6, structs: 14, ...extra };
}

const COUNTERS = {
  typical: { kills: 616, cmd_kills: 98, raids_won: 88, raids_repelled: 39, ore_seized: 12153, alpha_refined: 86e6, structs_built: 387, damage_dealt: 2922 },
  max: { kills: 99999, cmd_kills: 9999, raids_won: 9999, raids_repelled: 9999, ore_seized: 99999999990, alpha_refined: 999999.99e9, structs_built: 99999, damage_dealt: 9999999 },
  none: { kills: 0, cmd_kills: 0, raids_won: 0, raids_repelled: 0, ore_seized: 0, alpha_refined: 0, structs_built: 0, damage_dealt: 0 },
  over: { kills: 123456789, cmd_kills: 1234567, raids_won: 1234567, raids_repelled: 1234567, ore_seized: 1.8446744073709552e19, alpha_refined: 1.8446744073709552e19, structs_built: 1234567, damage_dealt: 123456789012 },
};

const PEOPLE = {
  typical: person('1-61', 'JPEG', '[OH] Orbital Hydro'),
  longest: person('1-99999', LONG, '[ABCDE] Orbital Hydro Cartel', { pfp: PFP_B, alpha: 999999.99e9, structs: 33 }),
  widest: person('1-99999', M20, `[MMMMM] ${M20}`, { alpha: 999999.99e9, structs: 33 }),
  sparse: person('1-3079', null, '', { pfp: null, charge: null, alpha: 0, structs: 0 }),
  overflow: person('1-999999999999', LONG, OVER_GUILD, { pfp: PFP_B, charge: 2, alpha: 1.8446744073709552e19, structs: 999 }),
};
const COUNTER_FOR = { typical: 'typical', longest: 'max', widest: 'max', sparse: 'none', overflow: 'over' };

export const player = Object.fromEntries(Object.entries(PEOPLE).map(([k, p]) => [k, { player: p, counters: COUNTERS[COUNTER_FOR[k]] }]));
export const record = player;

const hull = (type, kills, lost, built = 1) => ({ type, kills, lost, built });
const MAX_HULLS = ['High Altitude Interceptor', 'Planetary Defense Cannon', 'Orbital Shield Generator', 'Continental Power Plant', 'Mobile Artillery',
  'Battleship', 'Starfighter', 'Frigate', 'Pursuit Fighter', 'Stealth Bomber', 'Tank', 'SAM Launcher', 'Cruiser', 'Destroyer', 'Submersible',
  'Ore Extractor', 'Ore Refinery', 'Jamming Satellite', 'Ore Bunker', 'Field Generator', 'World Engine', 'Command Ship'].map((t, i) => hull(t, i < 5 ? 9999 : 1, i < 5 ? 9999 : 1));
export const tally = {
  typical: { player: PEOPLE.typical, hulls: [hull('Tank', 187, 50), hull('Mobile Artillery', 160, 9), hull('Starfighter', 76, 14), hull('Battleship', 41, 14), hull('Cruiser', 39, 18), hull('Stealth Bomber', 21, 16)] },
  longest: { player: PEOPLE.longest, hulls: MAX_HULLS },
  widest: { player: PEOPLE.widest, hulls: MAX_HULLS },
  sparse: { player: PEOPLE.sparse, hulls: [] },
  overflow: { player: PEOPLE.overflow, hulls: [hull('World Engine', 1234567, 1234567), hull('Ore Refinery', 123456, 0), hull('SAM Launcher', 0, 123456), hull('Destroyer', 12, 3), hull('Jamming Satellite', 1, 1), ...MAX_HULLS.slice(5)] },
};

/* ── boards ───────────────────────────────────────────────────────────────── */

const unit = (side, ambit, slot, type, command = false) => ({ side, ambit, slot, command, type, health: 3, maxHealth: 3, built: true, online: true, hidden: false });
const fleet = (side, ambit, types) => types.map((t, i) => unit(side, ambit, i, t));

const RAIDED = [
  unit('defender', 'space', 0, 'Command Ship', true), ...fleet('defender', 'space', ['Starfighter']), ...fleet('planet', 'space', ['Orbital Shield Generator']),
  unit('attacker', 'space', 0, 'Command Ship', true), ...fleet('attacker', 'space', ['Frigate', 'Battleship']),
  ...fleet('defender', 'air', ['High Altitude Interceptor']), ...fleet('attacker', 'air', ['Stealth Bomber']),
  ...fleet('planet', 'land', ['Planetary Defense Cannon', 'Ore Extractor', 'Ore Refinery']), ...fleet('defender', 'land', ['Tank']),
  ...fleet('attacker', 'land', ['Tank', 'Mobile Artillery']),
  ...fleet('defender', 'water', ['Submersible']), ...fleet('attacker', 'water', ['Cruiser']),
];
const FULL = [
  unit('defender', 'space', 0, 'Command Ship', true), ...fleet('planet', 'space', ['Orbital Shield Generator', 'Jamming Satellite']),
  ...fleet('defender', 'space', ['Starfighter', 'Frigate', 'Battleship', 'Starfighter']),
  unit('attacker', 'space', 0, 'Command Ship', true), ...fleet('attacker', 'space', ['Frigate', 'Battleship', 'Starfighter', 'Battleship']),
  ...fleet('defender', 'air', ['High Altitude Interceptor', 'Stealth Bomber', 'Pursuit Fighter', 'Stealth Bomber']),
  ...fleet('attacker', 'air', ['Stealth Bomber', 'High Altitude Interceptor', 'Stealth Bomber', 'Pursuit Fighter']),
  ...fleet('planet', 'land', ['Planetary Defense Cannon', 'Ore Extractor', 'Ore Refinery', 'Field Generator']),
  ...fleet('defender', 'land', ['Tank', 'Mobile Artillery', 'SAM Launcher', 'Tank']),
  ...fleet('attacker', 'land', ['Tank', 'Mobile Artillery', 'Tank', 'Mobile Artillery']),
  ...fleet('defender', 'water', ['Submersible', 'Cruiser', 'Destroyer', 'Cruiser']),
  ...fleet('attacker', 'water', ['Cruiser', 'Submersible', 'Destroyer', 'Submersible']),
];
const AWAY = [
  unit('defender', 'space', 0, 'Command Ship', true), ...fleet('defender', 'space', ['Battleship', 'Starfighter']),
  ...fleet('defender', 'air', ['Stealth Bomber']), ...fleet('defender', 'land', ['Tank', 'Tank']), ...fleet('defender', 'water', ['Cruiser']),
];
const owner = (id, name, tag, pfp) => ({ id, name: name || id, tag, pfp });

export const map = {
  typical: { planet: { id: '2-16116', name: 'Owycu Iota', shield: 87, ore: 3 }, owner: owner('1-2564', 'T2608191236', 'ONE', PFP_B), attacker: owner('1-61', 'JPEG', 'OH', PFP_A), units: RAIDED, kind: 'planet', id: '2-16116' },
  longest: { planet: { id: '2-999999', name: 'Proxima Trela Omicron VII', shield: 9999, ore: 5 }, owner: owner('1-99999', LONG, 'ABCDE', PFP_B), attacker: owner('1-88888', LONG, 'ABCDE', PFP_A), units: FULL, kind: 'planet', id: '2-999999' },
  widest: { planet: { id: '2-999999', name: 'Proxima Trela Omicron Minor', shield: 9999, ore: 999990 }, owner: owner('1-99999', M20, 'MMMMM', PFP_B), attacker: owner('1-88888', M20, 'MMMMM', PFP_A), units: FULL, kind: 'planet', id: '2-999999' },
  sparse: { planet: { id: '2-49490', name: '2-49490', shield: 0, ore: 0 }, owner: null, attacker: null, units: [], kind: 'planet', id: '2-49490' },
  drained: { planet: { id: '2-5995', name: 'Proxima Trela Mu Minor', shield: 0, ore: 0, status: 'complete' }, owner: owner('1-61', 'JPEG', 'OH', PFP_A), attacker: null, units: [...fleet('planet', 'land', ['World Engine']), unit('defender', 'space', 0, 'Command Ship', true)], kind: 'planet', id: '2-5995' },
  fleet: { planet: null, owner: owner('1-61', 'JPEG', 'OH', PFP_A), attacker: null, units: AWAY, kind: 'fleet', id: '9-61' },
  overflow: { planet: { id: '2-999999999999', name: 'Proxima Trela Omicron Minor Prime Secundus Tertius', shield: 1234567, ore: 99999999990 }, owner: owner('1-999999999999', null, 'GUILDTAG', null), attacker: owner('1-88888', LONG, 'GUILDTAG', PFP_A), units: [...FULL, ...fleet('planet', 'land', ['World Engine', 'Ore Bunker'])], kind: 'planet', id: '2-999999999999' },
};

/* ── provider + reactor ───────────────────────────────────────────────────── */

const POLICY = { open: { text: 'OPEN', mod: 'default' }, guild: { text: 'GUILD', mod: 'warning' }, closed: { text: 'CLOSED', mod: 'destructive' } };
const prov = (o) => ({ provider: { substation: '4-4', agreements: 0, ...o }, policy: POLICY[o.policyKey] || POLICY.closed });
export const provider = {
  typical: prov({ id: '10-1', policyKey: 'open', rate: { value: '1eep', denomLabel: '' }, capacity: { min: '1W', max: '1MW' }, duration: { min: '9m', max: '61d' }, owner: owner('1-170', null, 'OH', PFP_B) }),
  longest: prov({ id: '10-999', policyKey: 'closed', substation: '4-9999', rate: { value: '1000000', denomLabel: 'uguild.0-12' }, capacity: { min: '1W', max: '999999.99MW' }, duration: { min: '1d', max: '1127301026726695d' }, agreements: 9999, owner: owner('1-99999', LONG, 'ABCDE', PFP_B) }),
  widest: prov({ id: '10-999', policyKey: 'guild', substation: '4-9999', rate: { value: '999999.99Kg', denomLabel: 'alpha' }, capacity: { min: '999999.99MW', max: '999999.99MW' }, duration: { min: '1127301026726695d', max: '1127301026726695d' }, agreements: 9999, owner: owner('1-99999', M20, 'MMMMM', PFP_B) }),
  sparse: prov({ id: '10-7', policyKey: null, substation: '4-1', rate: { value: '—', denomLabel: 'alpha' }, capacity: { min: '—', max: '—' }, duration: { min: '0s', max: '0s' }, agreements: 1, owner: owner('0-5', null, null, null) }),
  overflow: prov({ id: '10-999999999999', policyKey: 'open', substation: '4-999999999999', rate: { value: '1000000000000', denomLabel: 'IBC/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2' }, capacity: { min: '1W', max: '18446744.07TW' }, duration: { min: '1s', max: '1127301026726695d' }, agreements: 123456789, owner: owner('1-999999999999', LONG, 'GUILDTAG', PFP_B) }),
};

const reac = (o) => ({ reactor: { validator: 'structsvaloper1u8sd7nk573au2gyzzun2ahxqzrq0qg7f8g7t2', ...o } });
export const reactor = {
  typical: reac({ id: '3-1', guildLabel: '[OH] Orbital Hydro', fuel: '3.41Kg', capacity: '136.24KW', commissionPct: 4, infusers: 16 }),
  longest: reac({ id: '3-999', guildLabel: '[ABCDE] Orbital Hydro Cartel', fuel: '999999.99Kg', capacity: '999999.99MW', commissionPct: 33.3, infusers: 9999 }),
  widest: reac({ id: '3-999', guildLabel: `[MMMMM] ${M20}`, fuel: '999999.99Kg', capacity: '999999.99MW', commissionPct: 100, infusers: 9999 }),
  sparse: reac({ id: '3-14', guildLabel: '', fuel: '—', capacity: '0mW', commissionPct: 0, infusers: 0 }),
  overflow: reac({ id: '3-999999999999', guildLabel: OVER_GUILD, fuel: '18.45Tg', capacity: '18446744.07TW', commissionPct: 100, infusers: 123456789 }),
};

/* ── simulator ────────────────────────────────────────────────────────────── */

/* A battle as data.js sim() hands it over: defender = the player, attacker = the computer. */
function battle(level, blockMs, charge, spec) {
  const units = [];
  for (const [side, ambit, types] of spec) {
    types.forEach((t, i) => units.push({ side, ambit, slot: t === 'Command Ship' ? 0 : i - (types[0] === 'Command Ship' ? 1 : 0), command: t === 'Command Ship', type: t, built: true, online: true }));
  }
  return { layout: { difficulty: level.toLowerCase(), blockMs, charge }, units, level };
}
const FEW = [
  ['defender', 'space', ['Command Ship', 'Starfighter']], ['attacker', 'space', ['Battleship', 'Command Ship']],
  ['defender', 'air', ['High Altitude Interceptor', 'Stealth Bomber']], ['attacker', 'air', ['Stealth Bomber', 'High Altitude Interceptor']],
  ['defender', 'land', ['Tank', 'Mobile Artillery']], ['attacker', 'land', ['Mobile Artillery', 'Tank', 'Tank']],
  ['defender', 'water', ['Submersible', 'Cruiser']], ['attacker', 'water', ['Cruiser', 'Submersible']],
];
const SIM_FULL = [
  ['defender', 'space', ['Command Ship', 'Starfighter', 'Frigate', 'Battleship', 'Starfighter']], ['attacker', 'space', ['Battleship', 'Frigate', 'Starfighter', 'Battleship']],
  ['defender', 'air', ['High Altitude Interceptor', 'Stealth Bomber', 'High Altitude Interceptor', 'Stealth Bomber']], ['attacker', 'air', ['Stealth Bomber', 'High Altitude Interceptor', 'Stealth Bomber', 'High Altitude Interceptor']],
  ['defender', 'land', ['Tank', 'Mobile Artillery', 'Tank', 'Mobile Artillery']], ['attacker', 'land', ['Mobile Artillery', 'Tank', 'Mobile Artillery', 'Tank']],
  ['defender', 'water', ['Submersible', 'Cruiser', 'Submersible', 'Cruiser']], ['attacker', 'water', ['Command Ship', 'Cruiser', 'Submersible', 'Cruiser', 'Submersible']],
];
const ONE = [['defender', 'space', ['Command Ship']], ['attacker', 'space', ['Command Ship']], ['attacker', 'land', ['Tank']]];

export const sim = {
  typical: battle('Hard', 6000, { player: 9, computer: 12 }, FEW),
  longest: battle('Difficult', 6000, { player: 30, computer: 30 }, SIM_FULL),
  sparse: battle('Easy', 2000, { player: 0, computer: 0 }, ONE),
};

const tallies = (p, c) => ({ player: { lost: p[0], attacks: p[1], damage: p[2], evaded: 0, blocked: 0, countered: 0 }, computer: { lost: c[0], attacks: c[1], damage: c[2], evaded: 0, blocked: 0, countered: 0 } });
const res = (b, r) => ({ ...b, result: { version: 1, revision: 1, forfeit: false, stalemate: null, ...r } });
export const simResult = {
  typical: res(battle('Hard', 6000, { player: 9, computer: 12 }, FEW), { winner: 'player', blocks: 97, seconds: 194, stats: tallies([2, 14, 19], [4, 12, 11]) }),
  longest: res(battle('Difficult', 6000, { player: 30, computer: 30 }, SIM_FULL), { winner: 'draw', stalemate: 'moves', blocks: 65535, seconds: 65535, stats: tallies([17, 255, 255], [17, 255, 255]) }),
  forfeit: res(battle('Easy', 2000, { player: 0, computer: 0 }, ONE), { winner: 'computer', forfeit: true, blocks: 1, seconds: 4, stats: tallies([0, 0, 0], [0, 0, 0]) }),
  stalemate: res(battle('Hard', 6000, { player: 9, computer: 12 }, FEW), { winner: 'draw', stalemate: 'quiet', blocks: 412, seconds: 2175, stats: tallies([3, 40, 52], [3, 38, 47]) }),
};

export const home = { typical: {} };
