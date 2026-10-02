let trips = [];
let activeTripId = null;
let activeTrip = null;

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosReady;
    bindTripUi();
    await loadTrips();
});

function $(id) { return document.getElementById(id); }

function bindTripUi() {
    $("newTripButton").addEventListener("click", openTripModal);
    $("emptyNewTripButton").addEventListener("click", openTripModal);
    $("closeTripModal").addEventListener("click", closeTripModal);
    $("cancelTripButton").addEventListener("click", closeTripModal);
    $("closeOptionModal").addEventListener("click", closeOptionModal);
    $("cancelOptionButton").addEventListener("click", closeOptionModal);
    $("addOptionButton").addEventListener("click", openOptionModal);
    $("tripForm").addEventListener("submit", createTripFromForm);
    $("optionForm").addEventListener("submit", createOptionFromForm);
    $("tripModal").addEventListener("click", e => { if (e.target === $("tripModal")) closeTripModal(); });
    $("optionModal").addEventListener("click", e => { if (e.target === $("optionModal")) closeOptionModal(); });
}

function openTripModal() { $("tripModal").hidden = false; setTimeout(() => $("tripTitle").focus(), 30); }
function closeTripModal() { $("tripModal").hidden = true; $("tripForm").reset(); }
function openOptionModal() { if (!activeTrip) return; $("optionModal").hidden = false; setTimeout(() => $("optionTitle").focus(), 30); }
function closeOptionModal() { $("optionModal").hidden = true; $("optionForm").reset(); }

async function loadTrips(selectId = null) {
    const group = await getCurrentGroup(true);
    if (!group) return;
    const { data, error } = await supabaseClient.from("trips").select("*").eq("group_id", group.id).order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    trips = data || [];
    const currentUser = await getCurrentUser();
    window.curruscosCurrentUserId = currentUser?.id || null;
    renderTripList();
    if (!trips.length) {
        activeTrip = null; activeTripId = null;
        $("tripWorkspaceContent").hidden = true; $("tripEmptyState").hidden = false;
        return;
    }
    const target = selectId || activeTripId || trips[0].id;
    await selectTrip(target);
}

function renderTripList() {
    $("tripCount").textContent = trips.length === 1 ? "1 viaje" : trips.length + " viajes";
    $("tripsList").innerHTML = trips.map(trip => `
        <button class="trip-list-item ${trip.id === activeTripId ? "active" : ""}" data-trip-id="${escapeHtml(trip.id)}">
            <span class="trip-list-icon">✈️</span>
            <span class="trip-list-copy"><strong>${escapeHtml(trip.title)}</strong><small>${escapeHtml(trip.destination || "Destino por decidir")}</small></span>
            <span class="trip-list-arrow">›</span>
        </button>`).join("");
    $("tripsEmpty").hidden = trips.length > 0;
    document.querySelectorAll("[data-trip-id]").forEach(btn => btn.addEventListener("click", () => selectTrip(btn.dataset.tripId)));
}

async function selectTrip(id) {
    activeTripId = id;
    activeTrip = trips.find(t => t.id === id) || null;
    renderTripList();
    if (!activeTrip) return;
    const { data: options, error } = await supabaseClient.from("trip_options").select("*").eq("trip_id", id).order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    let votes = [];
    if ((options || []).length) {
        const { data: voteRows, error: voteError } = await supabaseClient
            .from("trip_votes")
            .select("*")
            .in("option_id", options.map(o => o.id));
        if (voteError) console.error(voteError);
        votes = voteRows || [];
    }
    activeTrip.options = options || [];
    activeTrip.votes = votes || [];
    renderActiveTrip();
}

async function loadTripFinances() {
    if (!activeTrip) return;

    const eventResult = await supabaseClient
        .from("events")
        .select("id,title,amount:created_at,trip_id")
        .eq("trip_id", activeTrip.id);

    // Fetch event expenses separately so the module remains compatible with the existing schema.
    if (eventResult.error) {
        console.error("Error obteniendo eventos del viaje:", eventResult.error);
        return;
    }

    const events = eventResult.data || [];
    const eventIds = events.map(event => event.id);
    let expenses = [];
    let splits = [];

    if (eventIds.length) {
        const expenseResult = await supabaseClient
            .from("expenses")
            .select("id,event_id,title,amount,paid_by")
            .in("event_id", eventIds);

        if (expenseResult.error) {
            console.error("Error obteniendo gastos del viaje:", expenseResult.error);
            return;
        }

        expenses = expenseResult.data || [];
        const expenseIds = expenses.map(expense => expense.id);

        if (expenseIds.length) {
            const splitResult = await supabaseClient
                .from("expense_splits")
                .select("expense_id,user_id,amount")
                .in("expense_id", expenseIds);

            if (splitResult.error) {
                console.error("Error obteniendo repartos del viaje:", splitResult.error);
            } else {
                splits = splitResult.data || [];
            }
        }
    }

    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const budgetPerPerson = Number(activeTrip.budget_per_person || 0);
    const memberCount = (await getGroupMembers(activeTrip.group_id)).length;
    const budgetTotal = budgetPerPerson > 0 && memberCount ? budgetPerPerson * memberCount : null;

    $("tripSpentTotal").textContent = money(total);
    $("tripBudgetTotal").textContent = budgetTotal != null ? money(budgetTotal) : "Sin definir";
    $("tripSpentPerPerson").textContent = memberCount ? money(total / memberCount) : "—";
    $("tripSpentDetail").textContent = expenses.length
        ? expenses.length + (expenses.length === 1 ? " gasto vinculado" : " gastos vinculados")
        : "Sin gastos vinculados";
    $("tripFinancePeople").textContent = memberCount
        ? memberCount + (memberCount === 1 ? " miembro del grupo" : " miembros del grupo")
        : "Sin miembros";

    const progress = $("tripFinanceProgress");
    if (budgetTotal != null) {
        const percent = budgetTotal > 0 ? Math.round((total / budgetTotal) * 100) : 0;
        $("tripFinancePercent").textContent = percent + "%";
        $("tripFinanceBarFill").style.width = Math.min(100, percent) + "%";
        progress.hidden = false;
    } else {
        progress.hidden = true;
    }

    $("tripFinanceEvents").innerHTML = events.map(event => {
        const eventTotal = expenses
            .filter(expense => expense.event_id === event.id)
            .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        return eventTotal
            ? '<div class="trip-finance-event"><strong>' + escapeHtml(event.title) + '</strong><span>' + money(eventTotal) + '</span></div>'
            : "";
    }).filter(Boolean).join("") || '<div class="trip-empty">Cuando haya gastos en eventos vinculados, aparecerán aquí.</div>';

    const balances = new Map();
    const memberRows = await getGroupMembers(activeTrip.group_id);
    memberRows.forEach(member => balances.set(String(member.user_id), 0));

    expenses.forEach(expense => {
        const payer = String(expense.paid_by || "");
        if (balances.has(payer)) balances.set(payer, balances.get(payer) + Number(expense.amount || 0));
        const expenseSplits = splits.filter(split => String(split.expense_id) === String(expense.id));
        expenseSplits.forEach(split => {
            const userId = String(split.user_id);
            if (balances.has(userId)) balances.set(userId, balances.get(userId) - Number(split.amount || 0));
        });
    });

    const creditors = [], debtors = [];
    balances.forEach((balance, userId) => {
        if (balance > 0.01) creditors.push({userId, amount:balance});
        if (balance < -0.01) debtors.push({userId, amount:-balance});
    });
    creditors.sort((a,b)=>b.amount-a.amount);
    debtors.sort((a,b)=>b.amount-a.amount);
    const transfers = [];
    let i=0,j=0;
    while(i<debtors.length && j<creditors.length){
        const amount=Math.min(debtors[i].amount,creditors[j].amount);
        transfers.push({from:debtors[i].userId,to:creditors[j].userId,amount});
        debtors[i].amount-=amount; creditors[j].amount-=amount;
        if(debtors[i].amount<=0.01)i++;
        if(creditors[j].amount<=0.01)j++;
    }

    const settlement=$("tripFinanceSettlement");
    if (!expenses.length || !transfers.length) {
        settlement.hidden=true;
        settlement.innerHTML="";
    } else {
        settlement.hidden=false;
        settlement.innerHTML='<strong>Liquidación de los eventos del viaje</strong>' +
            transfers.map(t=>'<div class="trip-finance-transfer"><span>'+escapeHtml(memberRows.find(m=>String(m.user_id)===t.from)?.display_name || "Miembro")+' → '+escapeHtml(memberRows.find(m=>String(m.user_id)===t.to)?.display_name || "Miembro")+'</span><strong>'+money(t.amount)+'</strong></div>').join("");
    }
}

function renderActiveTrip() {
    $("tripEmptyState").hidden = true;
    $("tripWorkspaceContent").hidden = false;
    $("activeTripStatus").textContent = (activeTrip.status || "planning").toUpperCase();
    $("activeTripTitle").textContent = activeTrip.title;
    $("activeTripDescription").textContent = activeTrip.description || "Añadid una descripción para que todos sepan qué estáis buscando.";
    $("activeTripDestination").textContent = activeTrip.destination || "Por decidir";
    $("activeTripDates").textContent = formatTripDates(activeTrip);
    $("activeTripBudget").textContent = activeTrip.budget_per_person != null ? money(activeTrip.budget_per_person) : "Sin definir";
    $("activeTripOptionsCount").textContent = activeTrip.options.length;
    $("activeTripVotesCount").textContent = activeTrip.votes.length;
    renderOptions();
    renderDecisionSummary();
    loadTripFinances();
}

function formatTripDates(trip) {
    if (!trip.start_date && !trip.end_date) return "Por decidir";
    if (trip.start_date && trip.end_date) return new Date(trip.start_date + "T12:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"short"}) + " — " + new Date(trip.end_date + "T12:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"short",year:"numeric"});
    const d = trip.start_date || trip.end_date;
    return new Date(d + "T12:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"long",year:"numeric"});
}

function money(value) {
    return new Intl.NumberFormat("es-ES", {style:"currency",currency:"EUR"}).format(Number(value) || 0);
}

function categoryLabel(category) {
    return {destination:"Destino",flight:"Vuelo",hotel:"Hotel",activity:"Actividad",transport:"Transporte",other:"Otro"}[category] || "Opción";
}

function renderOptions() {
    const container = $("tripOptions");
    const options = activeTrip.options || [];
    $("optionsEmpty").hidden = options.length > 0;
    container.innerHTML = options.map(option => {
        const count = activeTrip.votes.filter(v => v.option_id === option.id).length;
        const voted = activeTrip.votes.some(v => v.option_id === option.id && v.user_id === window.curruscosCurrentUserId);
        return `
        <article class="trip-option-card">
            <div class="trip-option-main">
                <div class="trip-option-top"><span class="trip-option-category">${categoryLabel(option.category)}</span>${option.provider ? `<span class="trip-option-provider">${escapeHtml(option.provider)}</span>` : ""}</div>
                <h4>${escapeHtml(option.title)}</h4>
                <p>${escapeHtml(option.notes || "Sin notas todavía.")}</p>
                <div class="trip-option-meta">${option.price_per_person != null ? "<strong>" + money(option.price_per_person) + " / persona</strong>" : ""}${option.price != null ? "<span>" + money(option.price) + " total</span>" : ""}</div>
            </div>
            <div class="trip-option-actions">
                <div class="trip-vote-count"><strong>${count}</strong><span>${count === 1 ? "voto" : "votos"}</span></div>
                <button class="button ${voted ? "secondary" : "primary"} trip-vote-button" data-option-id="${option.id}">${voted ? "✓ Votado" : "Votar"}</button>
                ${option.url ? `<a class="button secondary" target="_blank" rel="noopener" href="${escapeHtml(option.url)}">Abrir</a>` : ""}
            </div>
        </article>`;
    }).join("");
    container.querySelectorAll(".trip-vote-button").forEach(btn => btn.addEventListener("click", () => toggleVote(btn.dataset.optionId)));
}

function renderDecisionSummary() {
    const container = $("tripDecisionSummary");
    const options = activeTrip.options || [];
    if (!options.length) { container.innerHTML = "<div class='trip-empty'>Cuando guardéis opciones aparecerá aquí el pulso de la decisión.</div>"; return; }
    const ranked = [...options].map(o => ({...o,count:activeTrip.votes.filter(v=>v.option_id===o.id).length})).sort((a,b)=>b.count-a.count);
    container.innerHTML = ranked.map((o,i)=>`<div class="decision-row"><span class="decision-rank">${i+1}</span><div class="decision-main"><strong>${escapeHtml(o.title)}</strong><div class="decision-bar"><span style="width:${Math.min(100,o.count*20)}%"></span></div></div><strong>${o.count}</strong></div>`).join("");
}

async function createTripFromForm(e) {
    e.preventDefault();
    const user = await getCurrentUser(), group = await getCurrentGroup();
    if (!user || !group) return;
    const payload = {group_id:group.id,created_by:user.id,title:$("tripTitle").value.trim(),destination:$("tripDestination").value.trim()||null,start_date:$("tripStartDate").value||null,end_date:$("tripEndDate").value||null,budget_per_person:$("tripBudget").value?Number($("tripBudget").value):null,description:$("tripDescription").value.trim()||null};
    if (!payload.title) return;
    const {data,error}=await supabaseClient.from("trips").insert(payload).select().single();
    if(error){alert("No se ha podido crear el viaje.");console.error(error);return;}
    closeTripModal(); await loadTrips(data.id);
}

async function createOptionFromForm(e) {
    e.preventDefault();
    const user = await getCurrentUser();
    if (!user || !activeTrip) return;
    const payload={trip_id:activeTrip.id,created_by:user.id,category:$("optionCategory").value,title:$("optionTitle").value.trim(),price:$("optionPrice").value?Number($("optionPrice").value):null,price_per_person:$("optionPricePerson").value?Number($("optionPricePerson").value):null,provider:$("optionProvider").value.trim()||null,url:$("optionUrl").value.trim()||null,notes:$("optionNotes").value.trim()||null};
    if(!payload.title)return;
    const {error}=await supabaseClient.from("trip_options").insert(payload);
    if(error){alert("No se ha podido guardar la opción.");console.error(error);return;}
    closeOptionModal(); await selectTrip(activeTrip.id);
}

async function toggleVote(optionId) {
    const user = await getCurrentUser();
    if (!user) return;
    const existing = activeTrip.votes.find(v=>v.option_id===optionId && v.user_id===user.id);
    if(existing) {
        const {error}=await supabaseClient.from("trip_votes").delete().eq("id",existing.id);
        if(error){console.error(error);return;}
    } else {
        const {error}=await supabaseClient.from("trip_votes").insert({option_id:optionId,user_id:user.id});
        if(error){console.error(error);return;}
    }
    await selectTrip(activeTrip.id);
}
