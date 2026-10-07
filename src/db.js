/* Reads from structs-pg — the indexer database every guild runs.
 *
 * Read-only by construction: every statement here is a SELECT, the pool sets
 * `default_transaction_read_only`, and a statement timeout keeps a slow query
 * from holding a crawler's request (Discord gives up on an unfurl after a few
 * seconds). Give the app a role that can only SELECT anyway.
 *
 * Units: `*_p` columns are precise base units (ualpha, grams, mW). The
 * non-`_p` twins are display values — see the desktop repo's amount_vs_amount_p
 * notes; never mix them.
 */
import pg from 'pg';

const { Pool } = pg;

/* structs-pg serves TLS with a self-signed certificate, so `sslmode=require`
 * means what libpq means by it — encrypted, not verified. node-pg would
 * otherwise treat it as verify-full and refuse the container's cert, so the
 * mode is taken out of the URL and applied here. `sslmode=verify-full` keeps
 * verification for a database with a real certificate. */
const url = new URL(process.env.DATABASE_URL || 'postgresql://structs@127.0.0.1:5432/structs?sslmode=require');
const sslmode = url.searchParams.get('sslmode') || 'disable';
url.searchParams.delete('sslmode');

// numeric → string by default; we convert deliberately where we need numbers.
const pool = new Pool({
  connectionString: url.toString(),
  max: Number(process.env.DB_POOL || 8),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 4000),
  options: '-c default_transaction_read_only=on',
  ssl: sslmode === 'disable' ? false : { rejectUnauthorized: sslmode === 'verify-full' },
});

pool.on('error', (e) => console.error('pg pool:', e.message));

async function one(sql, params) {
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}
async function all(sql, params) {
  return (await pool.query(sql, params)).rows;
}

export async function health() {
  return one('select height, status, lag_blocks from structs.current_block limit 1');
}

export async function height() {
  const r = await one('select height from structs.current_block limit 1');
  return r ? Number(r.height) : null;
}

/* ── identity ─────────────────────────────────────────────────────────────── */

export async function player(id) {
  return one(`
    select p.id, p.username as name, p.guild_id, p.planet_id, p.fleet_id, p.substation_id,
           p.pfp_client_render_attributes as pfp, p.primary_address,
           gm.name as guild_name, gm.tag as guild_tag,
           lb.alpha_balance,
           (select val from structs.grid where object_id = p.id and attribute_type = 'ore') as ore,
           (select val from structs.grid where object_id = p.id and attribute_type = 'lastAction') as last_action,
           (select count(*) from structs.struct s where s.owner = p.id and not s.is_destroyed) as structs
      from structs.player p
      left join structs.guild_meta gm on gm.id = p.guild_id
      left join structs.api_leaderboard_player lb on lb.player_id = p.id
     where p.id = $1`, [id]);
}

export async function guild(id) {
  return one(`
    select g.id, coalesce(nullif(gm.name, ''), g.name) as name, gm.tag, gm.logo, gm.website, gm.description,
           g.primary_reactor_id, g.owner,
           (select count(*) from structs.player p where p.guild_id = g.id) as members
      from structs.guild g left join structs.guild_meta gm on gm.id = g.id
     where g.id = $1`, [id]);
}

/** Small identity rows for a set of players — names on maps, owners on providers. */
export async function people(ids) {
  if (!ids.length) return [];
  return all(`
    select p.id, p.username as name, p.pfp_client_render_attributes as pfp, gm.tag as guild_tag
      from structs.player p left join structs.guild_meta gm on gm.id = p.guild_id
     where p.id = any($1)`, [ids]);
}

/* ── the map ──────────────────────────────────────────────────────────────── */

export async function planet(id) {
  return one(`
    select pl.id, pl.name, pl.owner, pl.map, pl.status, pl.max_ore,
           (select val from structs.grid where object_id = pl.id and attribute_type = 'ore') as ore,
           (select val from structs.planet_attribute where object_id = pl.id and attribute_type = 'planetaryShield') as shield,
           (select val from structs.planet_attribute where object_id = pl.id and attribute_type = 'blockStartRaid') as raid_started
      from structs.planet pl where pl.id = $1`, [id]);
}

export async function fleet(id) {
  return one(`
    select f.id, f.owner, f.map, f.status, f.location_type, f.location_id, f.command_struct
      from structs.fleet f where f.id = $1`, [id]);
}

/** Every fleet whose current location is this planet — the home fleet on station and any raider. */
export async function fleetsAt(planetId) {
  return all(`
    select f.id, f.owner, f.map, f.status, f.command_struct
      from structs.fleet f where f.location_type = 'planet' and f.location_id = $1`, [planetId]);
}

/** Struct rows (type + art name + health + state) for the ids on a map. */
export async function structsByIds(ids) {
  if (!ids.length) return [];
  return all(`
    select s.id, s.type, t.type as type_name, t.is_command, s.operating_ambit as ambit, s.slot,
           s.location_type, s.is_destroyed, t.max_health,
           (select val from structs.struct_attribute a where a.object_id = s.id and a.attribute_type = 'health') as health,
           (select val from structs.struct_attribute a where a.object_id = s.id and a.attribute_type = 'status') as status
      from structs.struct s join structs.struct_type t on t.id = s.type
     where s.id = any($1)`, [ids]);
}

/* ── record + tally ───────────────────────────────────────────────────────── */

/* The same folds as the desktop's mcp/achievements.rs, as SQL over the
 * indexer's per-player side table. Only what is observed is returned; the
 * card draws an absent counter as "—", never as 0. */

const ATTACK_ROWS = `
  rows as (
    select distinct pa.time, pa.planet_id, pa.seq, pa.detail as d
      from structs.planet_activity_player p
      join structs.planet_activity pa using (time, planet_id, seq)
     where p.player_id = $1 and p.category = 'struct_attack'),
  shots as (
    select d->>'attackerPlayerId' as ap, d->>'attackerStructType' as aty,
           d->>'attackerStructOperatingAmbit' as aamb, d->>'weaponControl' as ctl, s
      from rows, jsonb_array_elements(coalesce(d->'eventAttackShotDetail', '[]'::jsonb)) s)`;

export async function record(id) {
  const [combat, raids, ledger, planets, built] = await Promise.all([
    one(`with ${ATTACK_ROWS}
      select
        count(*) filter (where ap = $1) as shots_fired,
        coalesce(sum(greatest(coalesce((s->>'damageDealt')::numeric, 0) - coalesce((s->>'damageReduction')::numeric, 0), 0)) filter (where ap = $1), 0) as damage_dealt,
        count(*) filter (where ap = $1 and (s->>'targetDestroyed')::boolean) as kills,
        count(*) filter (where ap = $1 and (s->>'targetDestroyed')::boolean and s->>'targetStructType' = 'Command Ship') as cmd_kills,
        count(*) filter (where ap = $1 and (s->>'targetDestroyed')::boolean and lower(s->>'targetStructLocationType') = 'fleet') as fleet_kills,
        count(*) filter (where ap = $1 and (s->>'targetDestroyed')::boolean and lower(coalesce(s->>'targetStructLocationType', '')) <> 'fleet') as ground_kills,
        count(*) filter (where s->>'targetPlayerId' = $1 and (s->>'targetDestroyed')::boolean) as structs_lost,
        count(*) filter (where s->>'targetPlayerId' = $1 and (s->>'targetCounterDestroyedAttacker')::boolean) as counter_kills,
        coalesce(sum(greatest(coalesce((s->>'damageDealt')::numeric, 0) - coalesce((s->>'damageReduction')::numeric, 0), 0)) filter (where s->>'targetPlayerId' = $1), 0) as damage_taken
      from shots`, [id]),
    one(`select
        count(*) filter (where p.role = 'fleet_owner' and pa.detail->>'status' = 'initiated') as raids_launched,
        count(*) filter (where p.role = 'fleet_owner' and pa.detail->>'status' = 'raidSuccessful') as raids_won,
        count(*) filter (where p.role = 'planet_owner' and pa.detail->>'status' in ('attackerDefeated', 'attackerRetreated')) as raids_repelled
      from structs.planet_activity_player p
      join structs.planet_activity pa using (time, planet_id, seq)
     where p.player_id = $1 and p.category = 'raid_status'`, [id]),
    one(`select
        sum(l.amount_p) filter (where l.action = 'mined' and l.denom = 'ore') as ore_mined,
        sum(l.amount_p) filter (where l.action = 'seized' and l.denom = 'ore') as ore_seized,
        sum(l.amount_p) filter (where l.action = 'forfeited' and l.denom = 'ore') as ore_forfeited,
        sum(l.amount_p) filter (where l.action = 'refined' and l.denom = 'ualpha') as alpha_refined,
        sum(l.amount_p) filter (where l.action = 'infused' and l.denom = 'ualpha') as alpha_infused
      from structs.ledger l
     where l.address in (select address from structs.player_address where player_id = $1)`, [id]),
    one(`select count(*) as planets_drained from structs.planet where owner = $1 and status = 'complete'`, [id]),
    one(`select count(*) as structs_built
      from structs.struct s join structs.struct_attribute a on a.object_id = s.id and a.attribute_type = 'status'
     where s.owner = $1 and (a.val & 2) > 0`, [id]),
  ]);
  const counters = {};
  for (const src of [combat, raids, ledger, planets, built]) {
    for (const [k, v] of Object.entries(src || {})) if (v != null) counters[k] = Number(v);
  }
  return { player_id: id, counters, coverage: { combat: 'full' } };
}

export async function tally(id) {
  const rows = await all(`with ${ATTACK_ROWS}
    select 'kills' as k, aty as hull, count(*) as n from shots where ap = $1 and (s->>'targetDestroyed')::boolean and aty is not null group by 2
    union all
    select 'damage', aty, sum(greatest(coalesce((s->>'damageDealt')::numeric, 0) - coalesce((s->>'damageReduction')::numeric, 0), 0)) from shots where ap = $1 and aty is not null group by 2
    union all
    select 'destroyed', s->>'targetStructType', count(*) from shots where ap = $1 and (s->>'targetDestroyed')::boolean and s->>'targetStructType' is not null group by 2
    union all
    select 'lost', s->>'targetStructType', count(*) from shots where s->>'targetPlayerId' = $1 and (s->>'targetDestroyed')::boolean and s->>'targetStructType' is not null group by 2
    union all
    select 'built', t.type, count(*) from structs.struct st
      join structs.struct_type t on t.id = st.type
      join structs.struct_attribute a on a.object_id = st.id and a.attribute_type = 'status'
     where st.owner = $1 and (a.val & 2) > 0 group by 2`, [id]);
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.hull)) by.set(r.hull, { type: r.hull, built: null, kills: null, damage: null, destroyed: null, lost: null });
    by.get(r.hull)[r.k] = Number(r.n);
  }
  // Busiest hull first, as the desktop's matrix orders it.
  const score = (h) => ['kills', 'destroyed', 'damage', 'built', 'lost'].reduce((a, k) => a + (h[k] || 0), 0);
  return { player_id: id, hulls: [...by.values()].sort((a, b) => score(b) - score(a)) };
}

/* ── energy ───────────────────────────────────────────────────────────────── */

export async function provider(id) {
  return one(`
    select pr.id, pr.substation_id, pr.rate_amount, pr.rate_denom, pr.access_policy,
           pr.capacity_minimum, pr.capacity_maximum, pr.duration_minimum, pr.duration_maximum,
           pr.owner, coalesce(lb.agreement_count, 0) as agreements
      from structs.provider pr left join structs.api_leaderboard_provider lb on lb.provider_id = pr.id
     where pr.id = $1`, [id]);
}

export async function reactor(id) {
  return one(`
    select r.id, r.validator, r.guild_id, r.default_commission, r.owner,
           gm.name as guild_name, gm.tag as guild_tag, gm.logo as guild_logo,
           (select val from structs.grid where object_id = r.id and attribute_type = 'fuel') as fuel,
           (select val from structs.grid where object_id = r.id and attribute_type = 'capacity') as capacity,
           (select val from structs.grid where object_id = r.id and attribute_type = 'power') as power,
           (select count(*) from structs.infusion i where i.destination_id = r.id and i.fuel_p > 0) as infusers
      from structs.reactor r left join structs.guild_meta gm on gm.id = r.guild_id
     where r.id = $1`, [id]);
}

export async function structsTypes() {
  return all('select id, type from structs.struct_type order by id');
}

/* ── the sitemap ──────────────────────────────────────────────────────────── */

export async function topPlayers(limit) {
  return all(`select player_id as id from structs.api_leaderboard_player order by alpha_value desc nulls last limit $1`, [limit]);
}
