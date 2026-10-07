/* structs.app in the browser: draw the subject with the shared card
 * components, and hand the link to the desktop app.
 *
 * The page is complete without this file (title, preview image, buttons);
 * this adds the same cards the desktop app draws, from the model the server
 * embedded in #site-model.
 */
(function () {
  'use strict';

  var U = window.StructsUnits;

  function model() {
    var node = document.getElementById('site-model');
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (e) { return null; }
  }

  function playerCard(p) {
    return window.StructsPlayerCard.card({
      id: p.id,
      name: p.name,
      pfp: p.pfp,
      guild: p.guildLabel || null,
      charge: p.charge,
      readings: [
        p.alpha != null ? { value: U.fmtAlpha(p.alpha), icon: 'sui-icon-alpha-matter', title: 'Alpha' } : null,
        p.ore != null ? { value: U.fmtOre(p.ore), icon: 'sui-icon-alpha-ore', title: 'Ore' } : null,
        p.structs != null ? { value: String(p.structs), icon: 'sui-icon-deployed-structs', title: 'Structs' } : null,
      ],
    });
  }

  var DRAW = {
    player: function (m) { return [playerCard(m.player), window.StructsAchievements.rack(m.record)]; },
    record: function (m) { return [playerCard(m.player), window.StructsAchievements.rack(m.record)]; },
    tally: function (m) { return [playerCard(m.player), window.StructsAchievements.matrix(m.tally)]; },
    map: function (m) {
      var out = [];
      if (m.planet) {
        out.push(window.StructsCards.planet.card({
          id: m.planet.id,
          name: m.planet.name,
          shield: m.planet.shield,
          ore: U.fmtOre(m.planet.ore || 0),
          structs: String(m.units.filter(function (u) { return u.side !== 'attacker'; }).length),
          raided: !!m.attacker,
          owner: m.owner,
        }));
      }
      if (m.attacker) out.push(window.StructsPlayerCard.card({ id: m.attacker.id, name: m.attacker.name, pfp: m.attacker.pfp, badge: { text: 'RAIDER', mod: 'destructive' }, err: true }));
      return out;
    },
    provider: function (m) { return [window.StructsProviderCard.card(m.provider)]; },
    reactor: function (m) {
      var r = m.reactor;
      return [window.StructsCards.reactor.card({ id: r.id, guild: r.guildLabel || null, fuel: r.fuel, capacity: r.capacity, commissionPct: r.commissionPct })];
    },
  };

  function drawDetail() {
    var data = model();
    var host = document.getElementById('site-detail');
    if (!data || !host || !DRAW[data.view]) return;
    try {
      DRAW[data.view](data.model).forEach(function (node) { if (node) host.appendChild(node); });
    } catch (e) {
      // The image and the buttons already say everything; a card that cannot
      // draw is left out rather than drawn half-way.
      host.textContent = '';
      if (window.console) console.error(e);
    }
  }

  /* `structs://` opens the app if it is installed and does nothing at all if
   * it is not — the browser gives no error to catch. So: when the page is
   * still in front a moment after the click, the app did not take it, and
   * the download is brought forward. */
  function wireOpen() {
    var open = document.getElementById('open-app');
    var get = document.getElementById('get-app');
    if (!open || !get) return;
    open.addEventListener('click', function () {
      var left = false;
      var gone = function () { left = true; };
      window.addEventListener('blur', gone, { once: true });
      document.addEventListener('visibilitychange', gone, { once: true });
      setTimeout(function () {
        window.removeEventListener('blur', gone);
        document.removeEventListener('visibilitychange', gone);
        if (left) return;
        get.classList.add('site-nudge');
        get.focus();
      }, 1600);
    });
  }

  function start() { drawDetail(); wireOpen(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
