/* Split-Bote: calculation and payment-message helpers; never moves money. */
(function () {
  'use strict';
  function calculateSettlements(expenses, participants) {
    if (!Array.isArray(participants) || !participants.length) return [];
    const people = participants.filter(p => p && p.id);
    if (!people.length) return [];
    const ids = new Set(people.map(p => String(p.id)));
    const balances = new Map(people.map(p => [String(p.id), 0]));
    (Array.isArray(expenses) ? expenses : []).forEach(exp => {
      const payer = String(exp?.payer_id ?? exp?.paid_by ?? '');
      const amount = Number(exp?.amount);
      if (!ids.has(payer) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) return;
      const cents = Math.round(amount * 100);
      const each = Math.floor(cents / people.length);
      const remainder = cents - each * people.length;
      balances.set(payer, balances.get(payer) + cents);
      people.forEach((p, i) => balances.set(String(p.id), balances.get(String(p.id)) - each - (i < remainder ? 1 : 0)));
    });
    const debtors = [], creditors = [];
    people.forEach(p => {
      const cents = balances.get(String(p.id));
      if (cents < 0) debtors.push({ id: String(p.id), name: p.name || 'Participante', cents: -cents });
      else if (cents > 0) creditors.push({ id: String(p.id), name: p.name || 'Participante', phone: p.phone || '', cents });
    });
    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const cents = Math.min(debtors[i].cents, creditors[j].cents);
      transfers.push({ from: debtors[i].name, to: creditors[j].name, toPhone: creditors[j].phone, amount: cents / 100 });
      debtors[i].cents -= cents; creditors[j].cents -= cents;
      if (debtors[i].cents === 0) i++;
      if (creditors[j].cents === 0) j++;
    }
    return transfers;
  }
  function getPaymentMessageLink(transfer, eventTitle) {
    const message = 'Hola ' + String(transfer?.to || ''); 
    const body = message + ', te debo ' + Number(transfer?.amount || 0).toFixed(2) +
      ' € por el plan "' + String(eventTitle || 'Curruscos') + '". ¿Me pasas tu Bizum?';
    return 'https://wa.me/?text=' + encodeURIComponent(body);
  }
  window.SplitPot = { calculateSettlements, getPaymentMessageLink };
})();
