/* FairPlay team balancer. Safe for small groups; bounded work for larger groups. */
(function () {
  'use strict';
  const DEFAULT_ELO = 1200;
  const MAX_EXACT_PARTICIPANTS = 18;
  const eloOf = p => {
    const value = Number(p?.elo);
    return Number.isFinite(value) && value >= 500 && value <= 3000 ? value : DEFAULT_ELO;
  };
  const total = list => list.reduce((sum, p) => sum + eloOf(p), 0);

  function balanceTeams(input) {
    const participants = Array.isArray(input) ? input.slice() : [];
    if (participants.length < 2) {
      return { teamA: participants, teamB: [], eloA: total(participants), eloB: 0, difference: 0, qualityPercentage: 100 };
    }
    const sorted = participants.slice().sort((a, b) => eloOf(b) - eloOf(a));
    const target = Math.floor(sorted.length / 2);
    let bestA = [], bestB = [], bestDiff = Infinity;

    // For ordinary casual games, exhaustive search is exact and bounded.
    if (sorted.length <= MAX_EXACT_PARTICIPANTS) {
      const chosen = [];
      function search(start, sum) {
        if (chosen.length === target) {
          const ids = new Set(chosen.map(p => p.id));
          const other = sorted.filter(p => !ids.has(p.id));
          const otherTotal = total(other);
          const diff = Math.abs(sum / Math.max(chosen.length, 1) - otherTotal / Math.max(other.length, 1));
          if (diff < bestDiff) { bestDiff = diff; bestA = chosen.slice(); bestB = other; }
          return;
        }
        for (let i = start; i <= sorted.length - (target - chosen.length); i++) {
          chosen.push(sorted[i]);
          search(i + 1, sum + eloOf(sorted[i]));
          chosen.pop();
        }
      }
      search(0, 0);
    } else {
      // O(n log n) snake draft prevents combinatorial blow-up for large events.
      sorted.forEach((p, i) => ((Math.floor(i / 2) % 2 === 0) ? (i % 2 === 0 ? bestA : bestB) : (i % 2 === 0 ? bestB : bestA)).push(p));
      bestDiff = Math.abs(total(bestA) / Math.max(bestA.length, 1) - total(bestB) / Math.max(bestB.length, 1));
    }
    const eloA = total(bestA), eloB = total(bestB);
    const scale = Math.max(eloA, eloB, 1);
    return {
      teamA: bestA, teamB: bestB, eloA, eloB, difference: Math.round(Math.abs(eloA / Math.max(bestA.length, 1) - eloB / Math.max(bestB.length, 1))),
      qualityPercentage: Math.max(0, Math.min(100, Math.round(100 * (1 - Math.abs(eloA / Math.max(bestA.length, 1) - eloB / Math.max(bestB.length, 1)) / 2500))))
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function renderBalanceWidget(container, participants) {
    if (!container) return;
    const result = balanceTeams(participants);
    const renderTeam = (name, list, elo) => '<section class="fairplay-team"><strong>' + name + ' · ELO ' + elo + '</strong>' +
      (list.length ? list.map(p => '<div class="fairplay-player"><span>' + escapeHtml(p.name || 'Jugador') + '</span><small>' + eloOf(p) + '</small></div>').join('') : '<p>Sin jugadores</p>') + '</section>';
    container.innerHTML = '<div class="fairplay-teams">' + renderTeam('Equipo A', result.teamA, result.eloA) +
      renderTeam('Equipo B', result.teamB, result.eloB) + '</div><p class="fairplay-quality">Diferencia: ' + result.difference +
      ' puntos · paridad estimada ' + result.qualityPercentage + '%</p>';
  }
  window.FairPlayBalancer = { balanceTeams, renderBalanceWidget };
})();
