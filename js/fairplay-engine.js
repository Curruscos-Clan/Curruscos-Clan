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
    // SplitPot: expense ledger and suggested transfers. This never performs a payment.
    const expensePanel = el('section', 'fairplay-panel');
    expensePanel.setAttribute('aria-labelledby', 'splitPotHeading');
    const expenseTitle = el('h2', '', 'Cuentas claras');
    expenseTitle.id = 'splitPotHeading';
    expensePanel.append(expenseTitle, el('p', 'fairplay-copy', 'Anota gastos compartidos y consulta una propuesta de reparto. Los pagos se realizan fuera de Curruscos; los enlaces solo preparan un mensaje.'));
    const expenseForm = document.createElement('form');
    expenseForm.style.cssText = 'display:grid;grid-template-columns:minmax(0,2fr) minmax(90px,1fr);gap:8px;margin-top:12px';
    const expenseDescription = document.createElement('input');
    expenseDescription.type = 'text'; expenseDescription.maxLength = 160; expenseDescription.required = true;
    expenseDescription.placeholder = 'Ej. Alquiler de pista'; expenseDescription.setAttribute('aria-label', 'Concepto del gasto');
    const expenseAmount = document.createElement('input');
    expenseAmount.type = 'number'; expenseAmount.min = '0.01'; expenseAmount.max = '100000'; expenseAmount.step = '0.01'; expenseAmount.required = true;
    expenseAmount.placeholder = 'Importe €'; expenseAmount.setAttribute('aria-label', 'Importe en euros');
    const payerSelect = document.createElement('select');
    payerSelect.setAttribute('aria-label', 'Quién pagó'); payerSelect.required = true;
    players.forEach(player => { const option = document.createElement('option'); option.value = player.id; option.textContent = player.name; payerSelect.appendChild(option); });
    payerSelect.style.cssText = 'min-width:0;padding:10px;border:1px solid var(--event-line,var(--border));border-radius:10px;background:var(--background);color:inherit';
    const expenseSubmit = el('button', 'fairplay-commit', 'Añadir gasto');
    expenseSubmit.type = 'submit'; expenseSubmit.style.gridColumn = '1 / -1';
    expenseForm.append(expenseDescription, expenseAmount, payerSelect, expenseSubmit);
    const expenseNotice = el('p', 'fairplay-note', 'Cargando gastos…');
    expenseNotice.setAttribute('role', 'status');
    const expenseList = el('div', 'fairplay-roster');
    const settlementList = el('div', 'fairplay-roster');
    expensePanel.append(expenseForm, expenseNotice, expenseList, el('h3', '', 'Propuesta de liquidación'), settlementList);
    panel.appendChild(expensePanel);

    let expenses = [];
    async function loadExpenses() {
      const result = await supabase.from('event_expenses')
        .select('id,description,amount,payer_id,created_by,created_at')
        .eq('event_id', event.id).order('created_at', { ascending: true });
      if (result.error) {
        expenseNotice.textContent = 'El registro de gastos aún no está disponible. Comprueba que la migración de Split-Bote está aplicada.';
        expenseForm.hidden = true;
        return;
      }
      expenses = result.data || [];
      renderExpenses();
    }
    function renderExpenses() {
      expenseList.replaceChildren(); settlementList.replaceChildren();
      if (!expenses.length) expenseList.appendChild(el('p', 'fairplay-note', 'Todavía no hay gastos registrados.'));
      expenses.forEach(expense => {
        const payer = players.find(p => p.id === expense.payer_id);
        const row = el('div', 'fairplay-roster-row');
        const label = document.createElement('div');
        label.append(el('span', '', expense.description), el('small', '', 'Pagó ' + (payer?.name || 'participante') + ' · ' + Number(expense.amount).toFixed(2) + ' €'));
        row.appendChild(label);
        if (expense.created_by === user.id || isOrganizer) {
          const remove = el('button', '', 'Eliminar');
          remove.type = 'button';
          remove.addEventListener('click', async () => {
            remove.disabled = true;
            const { error } = await supabase.from('event_expenses').delete().eq('id', expense.id);
            if (error) { expenseNotice.textContent = 'No se ha podido eliminar el gasto.'; remove.disabled = false; return; }
            expenses = expenses.filter(item => item.id !== expense.id); renderExpenses();
          });
          row.appendChild(remove);
        }
        expenseList.appendChild(row);
      });
      if (!window.SplitPot) { expenseNotice.textContent = 'Calculadora de gastos no disponible.'; return; }
      const settlements = window.SplitPot.calculateSettlements(expenses, players);
      expenseNotice.textContent = expenses.length + ' gasto(s) · Total ' + expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2) + ' €. Importes informativos, sin cobros dentro de la app.';
      if (!settlements.length) settlementList.appendChild(el('p', 'fairplay-note', 'Las cuentas están cuadradas o aún no hay gastos que repartir.'));
      settlements.forEach(transfer => {
        const row = el('div', 'fairplay-roster-row');
        const label = el('span', '', transfer.from + ' → ' + transfer.to + ': ' + transfer.amount.toFixed(2) + ' €');
        const link = el('a', 'fairplay-status', 'Preparar mensaje');
        link.href = window.SplitPot.getPaymentMessageLink(transfer, event.title || 'evento');
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        row.append(label, link); settlementList.appendChild(row);
      });
    }
    expenseForm.addEventListener('submit', async eventSubmit => {
      eventSubmit.preventDefault();
      const description = expenseDescription.value.trim();
      const amount = Number(expenseAmount.value);
      if (!description || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        expenseNotice.textContent = 'Introduce un concepto y un importe válido.'; return;
      }
      expenseSubmit.disabled = true;
      const { data, error } = await supabase.from('event_expenses').insert({
        event_id: event.id, payer_id: payerSelect.value, created_by: user.id,
        description, amount: Math.round(amount * 100) / 100
      }).select('id,description,amount,payer_id,created_by,created_at').single();
      if (error) {
        expenseNotice.textContent = 'No se ha podido guardar el gasto. Comprueba que sigues participando en el evento.';
      } else {
        expenses.push(data); expenseDescription.value = ''; expenseAmount.value = ''; renderExpenses();
      }
      expenseSubmit.disabled = false;
    });
    loadExpenses();

    const balanceButton = el('button', 'fairplay-commit', 'Equilibrar equipos');
    balanceButton.type = 'button';
    const balanceRoot = el('div', '');
    balanceButton.addEventListener('click', () => {
      if (!window.FairPlayBalancer) { notice.textContent = 'El balanceador no está disponible.'; return; }
      window.FairPlayBalancer.renderBalanceWidget(balanceRoot, players);
      balanceRoot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    panel.append(balanceButton, balanceRoot);

    // Expense management uses the existing group-scoped expenses table; no payments are executed.
    const expensesPanel = el('div', 'fairplay-expenses');
    expensesPanel.style.marginTop = '20px';
    expensesPanel.appendChild(el('h3', '', 'Cuentas claras'));
    expensesPanel.appendChild(el('p', 'fairplay-copy', 'Registra gastos compartidos y calcula las transferencias mínimas. Los pagos se realizan fuera de Curruscos.'));
    panel.appendChild(expensesPanel);

    if (!event.group_id) {
      expensesPanel.appendChild(el('p', 'fairplay-note', 'El registro compartido de gastos requiere que el evento esté vinculado a un grupo.'));
    } else {
      const expenseList = el('div', 'fairplay-roster');
      expensesPanel.appendChild(expenseList);
      async function refreshExpenses() {
        expenseList.replaceChildren();
        const { data: expenses, error } = await supabase.from('expenses')
          .select('id,title,amount,paid_by,created_by,created_at')
          .eq('event_id', event.id).order('created_at', { ascending: true });
        if (error) {
          expenseList.appendChild(el('p', 'fairplay-note', 'No se han podido leer los gastos de este grupo con tus permisos actuales.'));
          return;
        }
        (expenses || []).forEach(expense => {
          const payer = players.find(p => p.id === expense.paid_by);
          const row = el('div', 'fairplay-roster-row');
          row.appendChild(el('span', '', (expense.title || 'Gasto') + ' · ' + Number(expense.amount || 0).toFixed(2) + ' €'));
          row.appendChild(el('small', '', 'Pagó: ' + (payer?.name || 'Miembro del grupo')));
          expenseList.appendChild(row);
        });
        if (!expenses?.length) expenseList.appendChild(el('p', 'fairplay-note', 'Todavía no hay gastos registrados.'));
        const transfers = window.SplitPot?.calculateSettlements(
          (expenses || []).map(x => ({ payer_id: x.paid_by, amount: x.amount })),
          players.map(p => ({ id: p.id, name: p.name }))
        ) || [];
        expenseList.appendChild(el('h4', '', 'Liquidación sugerida'));
        if (!transfers.length) {
          expenseList.appendChild(el('p', 'fairplay-note', 'No hay deudas pendientes con los gastos registrados.'));
        } else {
          transfers.forEach(transfer => {
            const row = el('div', 'fairplay-roster-row');
            row.appendChild(el('span', '', transfer.from + ' → ' + transfer.to + ': ' + transfer.amount.toFixed(2) + ' €'));
            const link = document.createElement('a');
            link.href = window.SplitPot.getPaymentMessageLink(transfer, event.title);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Coordinar pago';
            link.className = 'fairplay-note';
            row.appendChild(link);
            expenseList.appendChild(row);
          });
        }
      }
      await refreshExpenses();
      if (isOrganizer) {
        const form = document.createElement('form');
        form.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(80px,110px) minmax(100px,150px) auto;gap:7px;margin-top:12px';
        const titleInput = document.createElement('input');
        titleInput.name = 'title'; titleInput.required = true; titleInput.maxLength = 100; titleInput.placeholder = 'Alquiler de pista';
        titleInput.setAttribute('aria-label', 'Concepto del gasto');
        const amountInput = document.createElement('input');
        amountInput.name = 'amount'; amountInput.type = 'number'; amountInput.min = '0.01'; amountInput.max = '100000'; amountInput.step = '0.01'; amountInput.required = true; amountInput.placeholder = '€';
        amountInput.setAttribute('aria-label', 'Importe del gasto');
        const payerSelect = document.createElement('select');
        payerSelect.name = 'payer_id'; payerSelect.required = true;
        payerSelect.setAttribute('aria-label', 'Quién pagó el gasto');
        players.forEach(player => {
          const option = document.createElement('option'); option.value = player.id; option.textContent = player.name;
          if (player.id === user.id) option.selected = true;
          payerSelect.appendChild(option);
        });
        const submit = el('button', 'fairplay-commit', 'Añadir gasto'); submit.type = 'submit';
        form.append(titleInput, amountInput, payerSelect, submit);
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const amount = Number(amountInput.value);
          if (!titleInput.value.trim() || !Number.isFinite(amount) || amount <= 0) return;
          submit.disabled = true;
          const { error } = await supabase.from('expenses').insert({
            event_id: event.id, title: titleInput.value.trim(), amount,
            paid_by: payerSelect.value, created_by: user.id
          });
          submit.disabled = false;
          if (error) {
            notice.textContent = 'No se pudo guardar el gasto. Comprueba que eres miembro autorizado del grupo.';
            return;
          }
          form.reset();
          await refreshExpenses();
        });
        expensesPanel.appendChild(form);
      }
    }

    if (profilesResult.error) notice.textContent = 'No se han podido cargar todos los perfiles; se usarán nombres genéricos donde falten.';
    if (ratingsResult.error) notice.textContent += ' Las puntuaciones históricas no están disponibles, se usará ELO 1200.';
    if (pledgesResult.error) notice.textContent += ' No se ha podido cargar el registro de compromisos.';
  }
  window.FairPlayEngine = { mount };
})();
