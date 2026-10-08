/* A parsed link → everything a page and its preview image need.
 *
 * One loader per view. Each returns a plain object (or null when the subject
 * does not exist) with:
 *
 *   title, description   for <title>, og:*, twitter:* — and the unfurl text
 *   model                what the page's card components draw (client side)
 *   og                   what the preview image draws (server side)
 *
 * Formatting goes through the game's own unit ladders (units.js), the same
 * file the desktop app draws with.
 */
import * as db from './db.js';
import { decode as decodeSim, decodeResult, verdict, clock, COMMAND_TYPE } from './simcode.js';
import '../public/shared/units.js';

const U = globalThis.StructsUnits;

const POLICY = {
  openMarket: { text: 'OPEN', mod: 'default' },
  guildMarket: { text: 'GUILD', mod: 'warning' },
  closedMarket: { text: 'CLOSED', mod: 'destructive' },
};
const SECONDS_PER_BLOCK = 5.28;   // the desktop's blocks_span()

const num = (v) => (v == null ? null : Number(v));
const guildLabel = (tag, name) => [tag ? `[${tag}]` : '', name || ''].filter(Boolean).join(' ');

/* Charge, as the game's ChargeCalculator counts it. */
function chargeOf(height, lastAction) {
  if (height == null || lastAction == null) return null;
  return Math.max(0, height - (Number(lastAction) + 1));
}

async function identity(id, height) {
  const p = await db.player(id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name || p.id,
    pfp: p.pfp,
    guild: p.guild_id ? { id: p.guild_id, name: p.guild_name, tag: p.guild_tag } : null,
    guildLabel: guildLabel(p.guild_tag, p.guild_name),
    planetId: p.planet_id,
    fleetId: p.fleet_id,
    charge: chargeOf(height, p.last_action),
    alpha: num(p.alpha_balance),
    ore: num(p.ore),
    structs: num(p.structs),
  };
}

/* ── player ───────────────────────────────────────────────────────────────── */

async function player(link) {
  const height = await db.height();
  const [me, rec] = await Promise.all([identity(link.id, height), db.record(link.id)]);
  if (!me) return null;
  const c = rec.counters;
  const bits = [me.guildLabel, `${U.fmtAlpha(me.alpha)} Alpha`, `${c.kills ?? 0} kills`, `${c.raids_won ?? 0} raids won`];
  return {
    title: `${me.name} · Structs`,
    description: `${me.name} (${me.id})${me.guildLabel ? ' of ' + me.guildLabel : ''}. ${bits.slice(1).join(' · ')}.`,
    model: { player: me, record: rec },
    og: { player: me, counters: c },
  };
}

/* ── record + tally ───────────────────────────────────────────────────────── */

async function record(link) {
  const height = await db.height();
  const [me, rec] = await Promise.all([identity(link.id, height), db.record(link.id)]);
  if (!me) return null;
  const c = rec.counters;
  return {
    title: `${me.name}'s record · Structs`,
    description: `${c.kills ?? 0} structs destroyed, ${c.cmd_kills ?? 0} Command Ships, ${c.raids_won ?? 0} raids won, ${U.fmtOre(c.ore_seized ?? 0)} ore seized.`,
    model: { player: me, record: rec },
    og: { player: me, counters: c },
  };
}

async function tally(link) {
  const height = await db.height();
  const [me, t] = await Promise.all([identity(link.id, height), db.tally(link.id)]);
  if (!me) return null;
  const top = t.hulls.filter((h) => h.kills).sort((a, b) => b.kills - a.kills).slice(0, 3)
    .map((h) => `${h.type} ${h.kills}`);
  return {
    title: `${me.name}'s hull tally · Structs`,
    description: top.length ? `Kills by hull — ${top.join(' · ')}.` : `${me.name} has no recorded kills yet.`,
    model: { player: me, tally: t },
    og: { player: me, hulls: t.hulls },
  };
}

/* ── map ──────────────────────────────────────────────────────────────────── */

/* The map of a planet as the game draws it: the owner's planetary structs and
 * home fleet on the left, a raiding fleet (if any) on the right. A fleet link
 * shows wherever that fleet is; a player link shows their home planet. */
async function map(link) {
  let planetId = null, focusFleet = null;
  if (link.kind === 'planet') planetId = link.id;
  if (link.kind === 'player') {
    const p = await db.player(link.id);
    if (!p) return null;
    planetId = p.planet_id;
  }
  if (link.kind === 'fleet') {
    focusFleet = await db.fleet(link.id);
    if (!focusFleet) return null;
    if (focusFleet.location_type === 'planet') planetId = focusFleet.location_id;
  }

  const planet = planetId ? await db.planet(planetId) : null;
  if (!planet && !focusFleet) return null;

  const here = planet ? await db.fleetsAt(planet.id) : [focusFleet];
  const home = planet ? here.find((f) => f.owner === planet.owner) : focusFleet;
  const raider = planet ? here.find((f) => f.owner !== planet.owner) : null;

  const sides = [
    { side: 'planet', owner: planet?.owner, map: planet?.map },
    { side: 'defender', owner: home?.owner, map: home?.map, cmd: home?.command_struct },
    { side: 'attacker', owner: raider?.owner, map: raider?.map, cmd: raider?.command_struct },
  ];
  const ids = [];
  for (const s of sides) {
    for (const a of Object.values(s.map || {})) for (const id of a || []) if (id) ids.push(id);
    if (s.cmd) ids.push(s.cmd);
  }
  const [rows, owners, height] = await Promise.all([
    db.structsByIds(ids),
    db.people([planet?.owner, home?.owner, raider?.owner].filter(Boolean)),
    db.height(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const who = new Map(owners.map((o) => [o.id, { id: o.id, name: o.name || o.id, pfp: o.pfp, tag: o.guild_tag }]));

  const units = [];
  for (const s of sides) {
    for (const [ambit, slots] of Object.entries(s.map || {})) {
      (slots || []).forEach((id, slot) => {
        const r = id && byId.get(id);
        if (r && !r.is_destroyed) units.push(unit(s.side, r, ambit, slot, false));
      });
    }
    const c = s.cmd && byId.get(s.cmd);
    if (c && !c.is_destroyed) units.push(unit(s.side, c, c.ambit, 0, true));
  }

  const owner = who.get(planet?.owner || home?.owner) || null;
  const attacker = raider ? who.get(raider.owner) || { id: raider.owner, name: raider.owner } : null;
  const name = planet?.name || planet?.id || focusFleet.id;
  const subject = link.kind === 'fleet' ? `Fleet ${link.id}` : link.kind === 'player' ? `${owner?.name || link.id}'s planet` : `Planet ${name}`;
  // The holder's side, as the card counts it; a fleet linked while raiding is the raider, not the raided.
  const deployed = units.filter((u) => u.side !== 'attacker').length;
  const raiding = focusFleet && raider && focusFleet.owner === raider.owner;
  const raidLine = !attacker ? '' : raiding ? ` Raiding ${owner?.name || 'its holder'}.` : ` Under raid by ${attacker.name}.`;
  return {
    title: `${subject} · Structs map`,
    description: `${subject}${planet && !subject.includes(name) ? ` at ${name}` : ''}${planet && !subject.includes(planet.id) && name !== planet.id ? ` (${planet.id})` : ''}, ${deployed} ${deployed === 1 ? 'struct' : 'structs'} deployed.`
      + (planet ? ` Shield ${planet.shield ?? 0}, ${U.fmtOre(num(planet.ore) || 0)} ore.` : '') + raidLine,
    model: {
      planet: planet && { id: planet.id, name, shield: num(planet.shield), ore: num(planet.ore), status: planet.status },
      owner, attacker, units, focus: link.id, height,
    },
    og: { planet: planet && { id: planet.id, name, shield: num(planet.shield), ore: num(planet.ore), status: planet.status }, owner, attacker, units, subject, kind: link.kind, id: link.id },
  };
}

function unit(side, r, ambit, slot, command) {
  return {
    side, ambit, slot, command,
    type: r.type_name,
    health: num(r.health), maxHealth: num(r.max_health),
    // structs-webapp StructConstants: BUILT 2, ONLINE 4, HIDDEN 16.
    built: (num(r.status) & 2) > 0, online: (num(r.status) & 4) > 0, hidden: (num(r.status) & 16) > 0,
  };
}

/* ── provider + reactor ───────────────────────────────────────────────────── */

async function provider(link) {
  const pr = await db.provider(link.id);
  if (!pr) return null;
  const [owner] = await db.people([pr.owner]);
  const denom = String(pr.rate_denom || '');
  const guildDenom = /^uguild\.(\d+-\d+)$/.exec(denom);
  const tokenGuild = guildDenom ? await db.guild(guildDenom[1]) : null;
  const rate = denom === 'ualpha'
    ? { value: U.fmtAlpha(num(pr.rate_amount)), denomLabel: 'alpha', denomIcon: 'sui-icon-alpha-matter' }
    : { value: pr.rate_amount == null ? null : String(pr.rate_amount), denomLabel: tokenGuild?.tag || denom, denomIcon: null };
  const span = (b) => U.fmtDuration(Number(b) * SECONDS_PER_BLOCK);
  const p = {
    id: pr.id,
    substation: pr.substation_id,
    policy: pr.access_policy,
    rate,
    capacity: { min: U.fmtWatts(num(pr.capacity_minimum)), max: U.fmtWatts(num(pr.capacity_maximum)) },
    duration: { min: span(pr.duration_minimum), max: span(pr.duration_maximum), blocks: `${pr.duration_minimum} – ${pr.duration_maximum} blocks` },
    owner: owner ? { id: owner.id, name: owner.name || owner.id, tag: owner.guild_tag, pfp: owner.pfp } : { id: pr.owner, name: pr.owner },
    agreements: num(pr.agreements),
  };
  const policy = POLICY[pr.access_policy] || POLICY.closedMarket;
  return {
    title: `Energy provider ${p.id} · Structs`,
    description: `${policy.text} energy offer by ${p.owner.name}: ${rate.value} ${rate.denomLabel} per mW per block, ${p.capacity.min}–${p.capacity.max} for ${p.duration.min}–${p.duration.max}.`,
    model: { provider: p },
    og: { provider: p, policy },
  };
}

async function reactor(link) {
  const r = await db.reactor(link.id);
  if (!r) return null;
  const commissionPct = Math.round(Number(r.default_commission || 0) * 1000) / 10;
  const m = {
    id: r.id,
    guild: r.guild_id ? { id: r.guild_id, name: r.guild_name, tag: r.guild_tag, logo: r.guild_logo } : null,
    guildLabel: guildLabel(r.guild_tag, r.guild_name),
    fuel: U.fmtAlpha(num(r.fuel)),
    capacity: U.fmtWatts(num(r.capacity)),
    commissionPct,
    infusers: num(r.infusers),
    validator: r.validator,
  };
  return {
    title: `Reactor ${r.id}${m.guildLabel ? ' · ' + m.guildLabel : ''} · Structs`,
    description: `${m.guildLabel || 'Reactor'} ${r.id}: ${m.fuel} Alpha infused, ${m.capacity} capacity, ${commissionPct}% commission, ${m.infusers} infusers.`,
    model: { reactor: m },
    og: { reactor: m },
  };
}

/* ── simulator ────────────────────────────────────────────────────────────── */

const LEVEL_NAME = { easy: 'Easy', difficult: 'Difficult', hard: 'Hard' };

async function sim(link) {
  const layout = decodeSim(link.code);
  if (!layout) return null;
  const types = await typeNames();
  const units = layout.units.map((u) => ({
    side: u.side === 'player' ? 'defender' : 'attacker',
    ambit: u.ambit, slot: u.slot, command: u.type === COMMAND_TYPE, type: types.get(u.type) || '',
    built: true, online: true,
  }));
  const count = (s) => units.filter((u) => u.side === s).length;
  const level = LEVEL_NAME[layout.difficulty];
  // A result that does not decode, or claims more losses than a side fielded,
  // is dropped: the link still shows its battle.
  let result = link.result ? decodeResult(link.result) : null;
  if (result && (result.stats.player.lost > count('defender') || result.stats.computer.lost > count('attacker'))) result = null;
  if (result) {
    const { verdict: v } = verdict(result);
    const blocks = `${result.blocks} ${result.blocks === 1 ? 'block' : 'blocks'}`;
    return {
      title: `${v} vs ${level} in ${clock(result.seconds)} · Structs`,
      description: `Lost ${result.stats.player.lost} of ${count('defender')} structs, ${blocks}. Can you beat it?`,
      model: { layout, result },
      og: { layout, units, level, result },
    };
  }
  return {
    title: `Simulator challenge · ${level} · Structs`,
    description: `A ${level.toLowerCase()} fleet battle: your ${count('defender')} structs against ${count('attacker')}. Open it in Structs and try to win.`,
    model: { layout },
    og: { layout, units, level },
  };
}

let TYPES = null;
async function typeNames() {
  if (!TYPES) {
    const rows = await db.structsTypes();
    TYPES = new Map(rows.map((r) => [Number(r.id), r.type]));
  }
  return TYPES;
}

/* ── dispatch ─────────────────────────────────────────────────────────────── */

const LOADERS = { player, record, tally, map, provider, reactor, sim };

export async function load(link) {
  const fn = LOADERS[link.view];
  return fn ? fn(link) : null;
}
