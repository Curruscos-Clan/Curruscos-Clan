/* FairPlay MVP: opt-in attendance commitment, organizer check-in and team balance. No money is collected. */
(function () {
  'use strict';
  const css = `
    .fairplay-panel{margin:18px 0;padding:22px;border:1px solid var(--event-line,var(--border));border-radius:22px;background:var(--event-card,var(--surface))}
    .fairplay-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .fairplay-kicker{font-size:9px;font-weight:900;letter-spacing:.14em;color:var(--event-accent,#ff4d2e)}
    .fairplay-panel h2{margin:5px 0;font-size:clamp(21px,4vw,28px);letter-spacing:-.05em}
    .fairplay-copy{font-size:12px;line-height:1.6;color:var(--event-muted,var(--muted))}
    .fairplay-status{font-size:10px;padding:6px 9px;border-radius:999px;background:var(--background);white-space:nowrap}
    .fairplay-commit{margin:10px 0;padding:10px 14px;border:0;border-radius:999px;background:var(--event-accent,#ff4d2e);color:white;font-weight:800;cursor:pointer}
    .fairplay-roster{display:grid;gap:7px;margin-top:12px}
    .fairplay-roster-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:var(--background)}
    .fairplay-roster-row span{font-size:12px;font-weight:750}
    .fairplay-roster-row small{display:block;margin-top:3px;color:var(--event-muted,var(--muted));font-size:10px}
    .fairplay-roster-row button{border:1px solid var(--event-line,var(--border));border-radius:999px;background:var(--surface);padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}
    .fairplay-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}
    .fairplay-team{padding:12px;border-radius:14px;background:var(--background);min-width:0}
    .fairplay-team>strong{font-size:11px}
    .fairplay-player{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:11px}
    .fairplay-player span{overflow-wrap:anywhere}.fairplay-player small{color:var(--event-muted,var(--muted))}
    .fairplay-quality{margin:10px 0 0;font-size:10px;color:var(--event-muted,var(--muted))}
    .fairplay-note{font-size:11px;color:var(--event-muted,var(--muted));margin:8px 0 0}
    @media(max-width:520px){.fairplay-panel{padding:16px;border-radius:18px}.fairplay-head{flex-direction:column}.fairplay-teams{gap:6px}.fairplay-team{padding:9px}}
  `;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function sportFor(event) {
    const value = String(event.event_type || event.category || '').toLowerCase();
    if (/p[aá]del/.test(value)) return 'padel';
    if (/f[uú]tbol|football|soccer/.test(value)) return 'futbol';
    if (/basket|baloncesto/.test(value)) return 'basket';
    if (/mesa|ajedrez|board/.test(value)) return 'boardgames';
    return 'padel';
  }
  function getElo(rating, sport) {
    const value = Number(rating?.sport_elos?.[sport]);
    return Number.isFinite(value) && value >= 500 && value <= 3000 ? value : 1200;
  }
  async function mount(event, user) {
    const root = document.getElementById('publicEventRoot');
    const shell = root?.querySelector('.public-event-shell');
    if (!shell || !event?.id || !user || !window.supabaseClient) return;
    root.querySelector('#fairplayPanel')?.remove();
    const supabase = window.supabaseClient;
    const panel = el('section', 'fairplay-panel');
    panel.id = 'fairplayPanel';
    panel.setAttribute('aria-labelledby', 'fairplayHeading');
    const style = document.createElement('style');
    style.textContent = css;
    panel.appendChild(style);
    const head = el('div', 'fairplay-head');
    const titleWrap = document.createElement('div');
    titleWrap.append(el('span', 'fairplay-kicker', 'CURRUSCOS FAIRPLAY'), el('h2', '', 'Asistencia y equipos equilibrados'));
    titleWrap.lastChild.id = 'fairplayHeading';
    titleWrap.appendChild(el('p', 'fairplay-copy', 'Confirma que cuentas con venir. El organizador puede registrar la asistencia y, si hay suficientes jugadores, nivelar los equipos.'));
    head.appendChild(titleWrap);
    head.appendChild(el('span', 'fairplay-status', 'Sin pagos automáticos'));
    panel.appendChild(head);
    const notice = el('p', 'fairplay-note', 'Cargando participantes…');
    notice.setAttribute('role', 'status');
    panel.appendChild(notice);
    shell.insertAdjacentElement('afterend', panel);

    const { data: participants, error: participantsError } = await supabase
      .from('event_participants').select('user_id,status').eq('event_id', event.id).eq('status', 'yes');
    if (participantsError) {
      notice.textContent = 'No se ha podido cargar la lista de participantes en esta sesión.';
      return;
    }
    const participantIds = [...new Set((participants || []).map(p => p.user_id).filter(Boolean))];
    if (!participantIds.length) {
      notice.textContent = 'Todavía no hay participantes confirmados. Apúntate al evento para activar FairPlay.';
      return;
    }
    const [profilesResult, ratingsResult, pledgesResult] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name').in('id', participantIds),
      supabase.from('fairplay_ratings').select('user_id,sport_elos,reliability_score,attended_count,no_show_count').in('user_id', participantIds),
      supabase.from('event_pledges').select('id,user_id,status,pledge_amount').eq('event_id', event.id)
    ]);
    const profileMap = new Map((profilesResult.data || []).map(p => [p.id, p]));
    const ratingMap = new Map((ratingsResult.data || []).map(p => [p.user_id, p]));
    let pledges = pledgesResult.data || [];
    const isOrganizer = event.created_by === user.id;
    const sport = sportFor(event);
    const players = participantIds.map(id => {
      const p = profileMap.get(id) || {};
      const rating = ratingMap.get(id);
      return { id, name: p.display_name || p.username || 'Participante', elo: getElo(rating, sport), rating };
    });
    notice.textContent = participants.length + ' participante(s) confirmado(s). ELO inicial de 1200 cuando no hay historial.';
    const actions = el('div', '');
    const myPledge = pledges.find(p => p.user_id === user.id);
    if (participants.some(p => p.user_id === user.id) && !myPledge) {
      const commit = el('button', 'fairplay-commit', 'Confirmo que cuento con venir');
      commit.type = 'button';
      commit.addEventListener('click', async () => {
        commit.disabled = true;
        const { error } = await supabase.from('event_pledges').insert({ event_id: event.id, user_id: user.id, pledge_amount: 0, status: 'pledged' });
        if (error) {
          notice.textContent = error.code === '23505' ? 'Ya habías confirmado tu compromiso.' : 'No se ha podido guardar el compromiso. Comprueba que sigues apuntado al evento.';
          commit.disabled = false;
          return;
        }
        pledges.push({ user_id: user.id, status: 'pledged', pledge_amount: 0 });
        notice.textContent = 'Compromiso guardado. No se ha realizado ningún cobro.';
        commit.remove();
        renderRoster();
      });
      actions.appendChild(commit);
    } else if (myPledge) {
      actions.appendChild(el('p', 'fairplay-note', 'Tu compromiso: ' + ({ pledged: 'confirmado', attended: 'asistencia registrada', no_show: 'ausencia registrada', cancelled: 'cancelado' }[myPledge.status] || myPledge.status) + '. No hay dinero retenido.'));
    }
    panel.appendChild(actions);
    const roster = el('div', 'fairplay-roster');
    panel.appendChild(roster);
    function renderRoster() {
      roster.replaceChildren();
      players.forEach(player => {
        const pledge = pledges.find(p => p.user_id === player.id);
        const row = el('div', 'fairplay-roster-row');
        const label = document.createElement('div');
        label.appendChild(el('span', '', player.name));
        label.appendChild(el('small', '', (pledge ? ({ pledged: 'Compromiso confirmado', attended: 'Asistencia registrada', no_show: 'Ausencia registrada', cancelled: 'Compromiso cancelado' }[pledge.status] || pledge.status) : 'Sin compromiso') + ' · ELO ' + player.elo));
        row.appendChild(label);
        if (isOrganizer && pledge && ['pledged','attended'].includes(pledge.status)) {
          const button = el('button', '', pledge.status === 'attended' ? 'Deshacer check-in' : 'Registrar asistencia');
          button.type = 'button';
          button.addEventListener('click', async () => {
            button.disabled = true;
            const nextStatus = pledge.status === 'attended' ? 'pledged' : 'attended';
            const { error } = await supabase.from('event_pledges').update({ status: nextStatus, checked_in_at: nextStatus === 'attended' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('event_id', event.id).eq('user_id', player.id);
            if (error) {
              notice.textContent = 'No se pudo guardar el check-in; revisa los permisos de organizador.';
              button.disabled = false;
              return;
            }
            pledge.status = nextStatus;
            renderRoster();
          });
          row.appendChild(button);
        }
        roster.appendChild(row);
      });
    }
    renderRoster();
    const balanceButton = el('button', 'fairplay-commit', 'Equilibrar equipos');
    balanceButton.type = 'button';
    const balanceRoot = el('div', '');
    balanceButton.addEventListener('click', () => {
      if (!window.FairPlayBalancer) { notice.textContent = 'El balanceador no está disponible.'; return; }
      window.FairPlayBalancer.renderBalanceWidget(balanceRoot, players);
      balanceRoot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    panel.append(balanceButton, balanceRoot);
    if (profilesResult.error) notice.textContent = 'No se han podido cargar todos los perfiles; se usarán nombres genéricos donde falten.';
    if (ratingsResult.error) notice.textContent += ' Las puntuaciones históricas no están disponibles, se usará ELO 1200.';
    if (pledgesResult.error) notice.textContent += ' No se ha podido cargar el registro de compromisos.';
  }
  window.FairPlayEngine = { mount };
})();
