let trips = [];
let activeTripId = null;
let activeTrip = null;

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
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
    $("addItineraryButton")?.addEventListener("click", openItineraryModal);
    $("closeItineraryModal")?.addEventListener("click", closeItineraryModal);
    $("cancelItineraryButton")?.addEventListener("click", closeItineraryModal);
    $("itineraryForm")?.addEventListener("submit", createItineraryItem);
    $("itineraryModal")?.addEventListener("click", e => { if (e.target === $("itineraryModal")) closeItineraryModal(); });
    $("tripForm").addEventListener("submit", createTripFromForm);
    $("optionForm").addEventListener("submit", createOptionFromForm);
    $("optionCategory").addEventListener("change", renderOptionDetailsForm);
    $("optionFilter")?.addEventListener("change", renderOptions);
    $("optionSort")?.addEventListener("change", renderOptions);
    $("smartSearchForm")?.addEventListener("submit", runSmartTravelSearch);

    $("tripModal").addEventListener("click", e => { if (e.target === $("tripModal")) closeTripModal(); });
    $("optionModal").addEventListener("click", e => { if (e.target === $("optionModal")) closeOptionModal(); });
}

function openTripModal() { $("tripModal").hidden = false; setTimeout(() => $("tripTitle").focus(), 30); }
function closeTripModal() { $("tripModal").hidden = true; $("tripForm").reset(); }
function openOptionModal() { if (!activeTrip) return; $("optionModal").hidden = false; renderOptionDetailsForm(); setTimeout(() => $("optionTitle").focus(), 30); }
function closeOptionModal() { $("optionModal").hidden = true; $("optionForm").reset(); }
function openItineraryModal() { if (!activeTrip) return; $("itineraryModal").hidden = false; if ($("itineraryDate")) $("itineraryDate").value = activeTrip.start_date || ""; setTimeout(() => $("itineraryTitle").focus(), 30); }
function closeItineraryModal() { if (!$("itineraryModal")) return; $("itineraryModal").hidden = true; $("itineraryForm").reset(); }

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
    const [{ data: options, error: optionsError }, { data: itinerary, error: itineraryError }] = await Promise.all([
        supabaseClient.from("trip_options").select("*").eq("trip_id", id).order("created_at", { ascending: true }),
        supabaseClient.from("trip_itinerary_items").select("*").eq("trip_id", id).order("itinerary_date", { ascending: true, nullsFirst: false }).order("start_time", { ascending: true, nullsFirst: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true })
    ]);
    if (optionsError) { console.error(optionsError); return; }
    if (itineraryError) { console.error("Error obteniendo itinerario:", itineraryError); return; }
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
    activeTrip.itinerary = itinerary || [];
    renderActiveTrip();
}

async function loadTripParticipants() {
    if (!activeTrip) return;

    const container = $("tripParticipants");
    if (!container) return;

    const members = await getGroupMembers(activeTrip.group_id);
    if (!members.length) {
        container.innerHTML = '<div class="trip-participants-empty">Todavía no hay miembros en este grupo.</div>';
        return;
    }

    const { data: rows, error } = await supabaseClient
        .from("trip_participants")
        .select("user_id,status")
        .eq("trip_id", activeTrip.id);

    if (error) {
        console.error("Error obteniendo participantes del viaje:", error);
        container.innerHTML = '<div class="trip-participants-empty">No se han podido cargar los participantes.</div>';
        return;
    }

    const participation = new Map(
        (rows || []).map(row => [String(row.user_id), row.status])
    );
    const currentUserId = window.curruscosCurrentUserId;

    container.innerHTML = members.map(member => {
        const userId = String(member.user_id);
        const confirmed = participation.get(userId) === "confirmed";
        const isCurrentUser = userId === String(currentUserId || "");
        const name = member.display_name || member.username || "Miembro";
        const initial = escapeHtml(name.charAt(0).toUpperCase());

        return '<article class="trip-participant">' +
            '<div class="trip-participant-main">' +
                '<span class="trip-participant-avatar">' + initial + '</span>' +
                '<div><span class="trip-participant-name">' + escapeHtml(name) + '</span>' +
                '<span class="trip-participant-status">' + (confirmed ? "Va" : "No va") + '</span></div>' +
            '</div>' +
            '<button type="button" class="trip-participant-button ' + (confirmed ? "active" : "") + '" data-participant-id="' + escapeHtml(userId) + '">' +
                (isCurrentUser ? (confirmed ? "✓ Voy" : "Apuntarme") : (confirmed ? "Confirmado" : "No participa")) +
            '</button>' +
        '</article>';
    }).join("");

    container.querySelectorAll(".trip-participant-button").forEach(button => {
        const userId = button.dataset.participantId;
        const isCurrentUser = userId === String(currentUserId || "");
        if (!isCurrentUser) {
            button.disabled = true;
            return;
        }

        button.addEventListener("click", async () => {
            button.disabled = true;
            const confirmed = participation.get(userId) === "confirmed";

            if (confirmed) {
                const { error: updateError } = await supabaseClient
                    .from("trip_participants")
                    .update({ status: "declined", updated_at: new Date().toISOString() })
                    .eq("trip_id", activeTrip.id)
                    .eq("user_id", userId);

                if (updateError) {
                    console.error(updateError);
                    button.disabled = false;
                    alert("No se ha podido actualizar tu participación.");
                    return;
                }
            } else {
                const { error: insertError } = await supabaseClient
                    .from("trip_participants")
                    .upsert(
                        { trip_id: activeTrip.id, user_id: userId, status: "confirmed", updated_at: new Date().toISOString() },
                        { onConflict: "trip_id,user_id" }
                    );

                if (insertError) {
                    console.error(insertError);
                    button.disabled = false;
                    alert("No se ha podido apuntarte al viaje.");
                    return;
                }
            }

            await loadTripParticipants();
            await loadTripFinances();
        });
    });
}

async function loadTripFinances() {
    if (!activeTrip) return;

    const eventResult = await supabaseClient
        .from("events")
        .select("id,title,trip_id")
        .eq("trip_id", activeTrip.id);

    // Fetch event expenses separately so the module remains compatible with the existing schema.
    if (eventResult.error) {
        console.error("Error obteniendo eventos del viaje:", eventResult.error);
        return;
    }

    const events = eventResult.data || [];
    renderLinkedEvents(events);
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
    const { data: participantRows, error: participantError } = await supabaseClient
        .from("trip_participants")
        .select("user_id")
        .eq("trip_id", activeTrip.id)
        .eq("status", "confirmed");
    if (participantError) console.error("Error obteniendo participantes para finanzas:", participantError);
    const participantIds = new Set((participantRows || []).map(row => String(row.user_id)));
    const memberRows = await getGroupMembers(activeTrip.group_id);
    const participatingMembers = memberRows.filter(member => participantIds.has(String(member.user_id)));
    const memberCount = participatingMembers.length;
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
    participatingMembers.forEach(member => balances.set(String(member.user_id), 0));

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
            transfers.map(t=>'<div class="trip-finance-transfer"><span>'+escapeHtml(participatingMembers.find(m=>String(m.user_id)===t.from)?.display_name || "Miembro")+' → '+escapeHtml(participatingMembers.find(m=>String(m.user_id)===t.to)?.display_name || "Miembro")+'</span><strong>'+money(t.amount)+'</strong></div>').join("");
    }
}

function updateTripSearchLinks() {
    const destination = String(activeTrip?.destination || "").trim();
    const encoded = encodeURIComponent(destination);
    const flight = $("flightSearchLink");
    const hotel = $("hotelSearchLink");
    const map = $("mapSearchLink");
    if (flight) flight.href = destination ? "https://www.google.com/travel/flights?q=" + encoded : "https://www.google.com/travel/flights";
    if (hotel) hotel.href = destination ? "https://www.google.com/travel/hotels?q=" + encoded : "https://www.google.com/travel/hotels";
    if (map) map.href = destination ? "https://www.google.com/maps/search/" + encoded : "https://www.google.com/maps";
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
    updateTripSearchLinks();
    renderSmartSearchForm();
    renderOptions();
    renderItinerary();
    renderDecisionSummary();
    loadTripParticipants();
    loadTripFinances();
}

function itineraryTypeLabel(type) {
    return {travel:"Desplazamiento",stay:"Alojamiento",meal:"Comida",activity:"Actividad",place:"Lugar de interés",free:"Tiempo libre",other:"Otro"}[type] || "Plan";
}

function formatItineraryTime(item) {
    if (item.start_time && item.end_time) return item.start_time.slice(0,5) + "–" + item.end_time.slice(0,5);
    if (item.start_time) return item.start_time.slice(0,5);
    return "Hora";
}

function formatItineraryDate(date) {
    return date ? new Date(date + "T12:00:00").toLocaleDateString("es-ES", {weekday:"long",day:"numeric",month:"long"}) : "Sin fecha";
}

function renderItinerary() {
    const root = $("tripItinerary");
    if (!root) return;
    const items = activeTrip?.itinerary || [];
    $("itineraryEmpty").hidden = items.length > 0;
    const days = new Map();
    items.forEach(item => {
        const key = item.itinerary_date || "undated";
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(item);
    });
    root.innerHTML = [...days.entries()].map(([date, rows]) => {
        const total = rows.reduce((sum, item) => sum + Number(item.estimated_cost || 0), 0);
        return '<section class="itinerary-day"><div class="itinerary-day-head"><span>' + escapeHtml(date === "undated" ? "Fecha por decidir" : formatItineraryDate(date)) + '</span><strong>' + money(total) + ' previsto</strong></div><div class="itinerary-items">' +
            rows.map(item => '<article class="itinerary-item"><div class="itinerary-time">' + escapeHtml(formatItineraryTime(item)) + '</div><div class="itinerary-copy"><span class="itinerary-type">' + escapeHtml(itineraryTypeLabel(item.item_type)) + '</span><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml((item.location || "") + (item.location && item.notes ? " · " : "") + (item.notes || "")) + '</p></div><div class="itinerary-actions">' + (item.estimated_cost != null ? '<span class="itinerary-cost">' + escapeHtml(money(item.estimated_cost)) + '</span>' : '') + (safeOptionUrl(item.url) ? '<a class="itinerary-link" target="_blank" rel="noopener" href="' + escapeHtml(safeOptionUrl(item.url)) + '">Abrir</a>' : '') + '<button class="itinerary-remove" type="button" data-itinerary-remove="' + escapeHtml(item.id) + '">Eliminar</button></div></article>').join("") +
            '</div></section>';
    }).join("");
    root.querySelectorAll("[data-itinerary-remove]").forEach(btn => btn.addEventListener("click", () => deleteItineraryItem(btn.dataset.itineraryRemove)));
    const projected = items.reduce((sum, item) => sum + Number(item.estimated_cost || 0), 0);
    if ($("tripPlannedTotal")) $("tripPlannedTotal").textContent = projected ? money(projected) : "—";
    if ($("tripPlannedDetail")) $("tripPlannedDetail").textContent = items.length ? items.length + (items.length === 1 ? " elemento previsto" : " elementos previstos") : "Sin partidas previstas";
}

async function createItineraryItem(e) {
    e.preventDefault();
    const user = await getCurrentUser();
    if (!user || !activeTrip) return;
    const rawUrl = $("itineraryUrl").value.trim();
    const url = safeOptionUrl(rawUrl) || null;
    if (rawUrl && !url) { alert("El enlace debe empezar por http:// o https://"); return; }
    const payload = {
        trip_id: activeTrip.id,
        created_by: user.id,
        itinerary_date: $("itineraryDate").value || null,
        start_time: $("itineraryStart").value || null,
        end_time: $("itineraryEnd").value || null,
        item_type: $("itineraryType").value,
        title: $("itineraryTitle").value.trim(),
        location: $("itineraryLocation").value.trim() || null,
        notes: $("itineraryNotes").value.trim() || null,
        estimated_cost: $("itineraryCost").value ? Number($("itineraryCost").value) : null,
        url,
        sort_order: 0
    };
    if (!payload.title) return;
    if (payload.start_time && payload.end_time && payload.end_time < payload.start_time) { alert("La hora de fin no puede ser anterior a la de inicio."); return; }
    const { error } = await supabaseClient.from("trip_itinerary_items").insert(payload);
    if (error) { console.error(error); alert("No se ha podido añadir al itinerario."); return; }
    closeItineraryModal();
    await selectTrip(activeTrip.id);
}

async function deleteItineraryItem(itemId) {
    if (!activeTrip || !confirm("¿Eliminar este elemento del itinerario?")) return;
    const { error } = await supabaseClient.from("trip_itinerary_items").delete().eq("id", itemId);
    if (error) { console.error(error); alert("No se ha podido eliminar."); return; }
    await selectTrip(activeTrip.id);
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


function safeOptionUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}

function renderLinkedEvents(events) {
    const root = $("tripLinkedEvents");
    if (!root) return;
    root.innerHTML = "";
    if (!events.length) return;
    const heading = document.createElement("div");
    heading.className = "trip-panel-title";
    heading.style.marginTop = "14px";
    heading.innerHTML = "<span>PLAN DEL VIAJE</span><strong>" + events.length + (events.length === 1 ? " evento" : " eventos") + "</strong>";
    root.appendChild(heading);
    events.forEach(event => {
        const link = document.createElement("a");
        link.className = "trip-linked-event";
        link.href = "evento.html?id=" + encodeURIComponent(event.id);
        const left = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = event.title || "Evento";
        const meta = document.createElement("small");
        meta.textContent = (event.location || "Sin lugar") + " · " + (event.status || "");
        left.append(title, meta);
        const right = document.createElement("small");
        right.className = "trip-linked-event-date";
        right.textContent = event.date ? new Date(event.date + "T" + (event.time || "00:00")).toLocaleDateString("es-ES", {day:"numeric",month:"short",year:"numeric"}) : "Fecha por definir";
        link.append(left, right);
        root.appendChild(link);
    });
}
function optionDetailConfig(category) {
    const common = {
        destination: [
            ["country","País","Ej. Italia","text"],
            ["travel_time","Tiempo de viaje","Ej. 2 h 15 min","text"],
            ["best_for","Ideal para","Ej. Cultura y comida","text"],
            ["season","Mejor época","Ej. Abril–junio","text"]
        ],
        flight: [
            ["origin","Salida","Ej. Madrid (MAD)","text"],
            ["arrival","Llegada","Ej. Roma (FCO)","text"],
            ["departure","Salida","Ej. 08:30","text"],
            ["arrival_time","Llegada","Ej. 11:05","text"],
            ["duration","Duración","Ej. 2 h 35 min","text"],
            ["stops","Escalas","Ej. Directo / 1","text"],
            ["baggage","Equipaje","Ej. 1 maleta + mochila","text"]
        ],
        hotel: [
            ["area","Zona","Ej. Centro / Trastevere","text"],
            ["nights","Noches","Ej. 4","number"],
            ["rooms","Habitaciones","Ej. 2","number"],
            ["rating","Valoración","Ej. 8,7/10","text"],
            ["breakfast","Desayuno","Ej. Incluido","text"],
            ["distance","Distancia","Ej. 1,2 km del centro","text"]
        ],
        place: [["place_type","Tipo","Ej. museo, mirador o estadio","text"],["area","Zona","Ej. centro histórico","text"],["duration","Duración","Ej. 2 h","text"],["opening_hours","Horario","Ej. 09:00–20:00","text"],["booking","Reserva","Ej. gratuita / reservar","text"]],
        activity: [
            ["area","Zona","Ej. Centro","text"],
            ["duration","Duración","Ej. 3 h","text"],
            ["booking","Reserva","Ej. Antelación recomendada","text"],
            ["age","Edad / acceso","Ej. Todo público","text"]
        ],
        transport: [
            ["mode","Medio","Ej. Tren AVE","text"],
            ["duration","Duración","Ej. 2 h 30 min","text"],
            ["origin","Salida","Ej. Madrid","text"],
            ["arrival","Llegada","Ej. Barcelona","text"]
        ],
        other: [
            ["detail_1","Dato clave","Ej. Condición importante","text"],
            ["detail_2","Otro dato","Ej. Qué incluye","text"]
        ]
    };
    return common[category] || common.other;
}

function renderOptionDetailsForm() {
    const root = $("optionDetails");
    const category = $("optionCategory")?.value || "other";
    if (!root) return;
    root.innerHTML = optionDetailConfig(category).map(item =>
        '<label>' + escapeHtml(item[1]) +
        '<input data-option-detail="' + escapeHtml(item[0]) + '" type="' + item[3] +
        '" min="' + (item[3] === "number" ? "0" : "") +
        '" placeholder="' + escapeHtml(item[2]) + '">' +
        '</label>'
    ).join("");
}

function readOptionDetails() {
    const details = {};
    document.querySelectorAll("#optionDetails [data-option-detail]").forEach(input => {
        if (input.value.trim()) details[input.dataset.optionDetail] = input.value.trim();
    });
    return details;
}

function optionDetailPairs(option) {
    const category = option.category || "other";
    const details = option.metadata?.travel_details || {};
    return optionDetailConfig(category)
        .filter(item => details[item[0]])
        .map(item => ({label:item[1],value:details[item[0]]}));
}

function renderCompareSummary(options) {
    const root = $("tripCompareSummary");
    if (!root) return;
    const filter = $("optionFilter")?.value || "all";
    const visible = options.filter(option => filter === "all" || option.category === filter);
    const grouped = new Map();
    visible.forEach(option => {
        if (!grouped.has(option.category)) grouped.set(option.category, []);
        grouped.get(option.category).push(option);
    });
    if (filter === "all") {
        const groups = [...grouped.entries()].filter(([,rows]) => rows.length > 1);
        if (!groups.length) { root.hidden = true; root.innerHTML = ""; return; }
        root.hidden = false;
        root.innerHTML = groups.map(([category,rows]) => {
            const detailKeys = optionDetailConfig(category).map(x=>x[0]).filter(key=>rows.some(o=>o.metadata?.travel_details?.[key]));
            const header = rows.map(o=>'<th>'+escapeHtml(o.title)+'</th>').join("");
            const price = rows.map(o=>'<td>'+(
                o.price_per_person != null ? escapeHtml(money(o.price_per_person))+" / persona" :
                o.price != null ? escapeHtml(money(o.price)) : "—"
            )+'</td>').join("");
            const details = detailKeys.map(key => {
                const label=optionDetailConfig(category).find(x=>x[0]===key)?.[1] || key;
                return '<tr><th>'+escapeHtml(label)+'</th>'+rows.map(o=>'<td>'+escapeHtml(o.metadata?.travel_details?.[key] || "—")+'</td>').join("")+'</tr>';
            }).join("");
            return '<div style="margin-bottom:18px"><strong>'+escapeHtml(categoryLabel(category))+'</strong><table class="trip-compare-table"><thead><tr><th>Característica</th>'+header+'</tr></thead><tbody><tr><th>Precio</th>'+price+'</tr>'+details+'</tbody></table></div>';
        }).join("");
        return;
    }
    if (visible.length < 2) { root.hidden = true; root.innerHTML = ""; return; }
    root.hidden = false;
    const detailKeys = optionDetailConfig(filter).map(x=>x[0]).filter(key=>visible.some(o=>o.metadata?.travel_details?.[key]));
    const header = visible.map(o=>'<th>'+escapeHtml(o.title)+'</th>').join("");
    const price = visible.map(o=>'<td>'+(
        o.price_per_person != null ? escapeHtml(money(o.price_per_person))+" / persona" :
        o.price != null ? escapeHtml(money(o.price)) : "—"
    )+'</td>').join("");
    const details = detailKeys.map(key => {
        const label=optionDetailConfig(filter).find(x=>x[0]===key)?.[1] || key;
        return '<tr><th>'+escapeHtml(label)+'</th>'+visible.map(o=>'<td>'+escapeHtml(o.metadata?.travel_details?.[key] || "—")+'</td>').join("")+'</tr>';
    }).join("");
    root.innerHTML='<table class="trip-compare-table"><thead><tr><th>Característica</th>'+header+'</tr></thead><tbody><tr><th>Precio</th>'+price+'</tr>'+details+'</tbody></table>';
}
function categoryLabel(category) {
    return {destination:"Destino",flight:"Vuelo",hotel:"Hotel",activity:"Actividad",place:"Lugar de interés",transport:"Transporte",other:"Otro"}[category] || "Opción";
}

function renderOptions() {
    const container = $("tripOptions");
    const filter = $("optionFilter")?.value || "all";
    const allOptions = activeTrip.options || [];
    let options = allOptions.filter(option => filter === "all" || option.category === filter);
    const sort = $("optionSort")?.value || "votes";
    options = [...options].sort((a,b) => { if(sort === "price") return Number(a.price_per_person ?? a.price ?? Infinity) - Number(b.price_per_person ?? b.price ?? Infinity); if(sort === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0); return activeTrip.votes.filter(v=>v.option_id===b.id).length - activeTrip.votes.filter(v=>v.option_id===a.id).length; });
    $("optionsEmpty").hidden = options.length > 0;
    container.innerHTML = options.map(option => {
        const count = activeTrip.votes.filter(v => v.option_id === option.id).length;
        const voted = activeTrip.votes.some(v => v.option_id === option.id && v.user_id === window.curruscosCurrentUserId);
        const details = optionDetailPairs(option);
        const canRemove = option.created_by === window.curruscosCurrentUserId;
        return '<article class="trip-option-card">' +
            '<div class="trip-option-main">' +
                '<div class="trip-option-top"><span class="trip-option-category">'+escapeHtml(categoryLabel(option.category))+'</span>' +
                (option.provider ? '<span class="trip-option-provider">'+escapeHtml(option.provider)+'</span>' : '')+'</div>' +
                '<h4>'+escapeHtml(option.title)+'</h4>' +
                '<p>'+escapeHtml(option.notes || "Sin notas todavía.")+'</p>' +
                (details.length ? '<div class="trip-option-detail-grid">'+details.map(d=>'<div class="trip-option-detail"><small>'+escapeHtml(d.label)+'</small><strong>'+escapeHtml(d.value)+'</strong></div>').join("")+'</div>' : '') +
                '<div class="trip-option-meta">'+(option.price_per_person != null ? "<strong>"+money(option.price_per_person)+" / persona</strong>" : "")+(option.price != null ? "<span>"+money(option.price)+" total</span>" : "")+'</div>' +
            '</div>' +
            '<div class="trip-option-actions">' +
                '<div class="trip-vote-count"><strong>'+count+'</strong><span>'+ (count === 1 ? "voto" : "votos")+'</span></div>' +
                '<button class="button '+(voted ? "secondary" : "primary")+' trip-vote-button" data-option-id="'+escapeHtml(option.id)+'">'+(voted ? "✓ Votado" : "Votar")+'</button>' +
                (safeOptionUrl(option.url) ? '<a class="button secondary" target="_blank" rel="noopener" href="'+escapeHtml(safeOptionUrl(option.url))+'">Abrir</a>' : '') +
                (canRemove ? '<button type="button" class="trip-option-remove" data-option-remove="'+escapeHtml(option.id)+'">Eliminar</button>' : '') +
            '</div></article>';
    }).join("");
    renderCompareSummary(allOptions);
    container.querySelectorAll(".trip-vote-button").forEach(btn => btn.addEventListener("click", () => toggleVote(btn.dataset.optionId)));
    container.querySelectorAll("[data-option-remove]").forEach(btn => btn.addEventListener("click", () => deleteOption(btn.dataset.optionRemove)));
}

async function deleteOption(optionId) {
    if (!activeTrip || !confirm("¿Eliminar esta opción y sus votos?")) return;
    const {error} = await supabaseClient.from("trip_options").delete().eq("id", optionId);
    if (error) { console.error(error); alert("No se ha podido eliminar la opción."); return; }
    await selectTrip(activeTrip.id);
}

function renderDecisionSummary() {
    const container = $("tripDecisionSummary");
    const options = activeTrip.options || [];
    if (!options.length) { container.innerHTML = "<div class='trip-empty'>Cuando guardéis opciones aparecerá aquí el pulso de la decisión.</div>"; return; }
    const ranked = [...options].map(o => ({...o,count:activeTrip.votes.filter(v=>v.option_id===o.id).length})).sort((a,b)=>b.count-a.count);
    container.innerHTML = ranked.map((o,i)=>`<div class="decision-row"><span class="decision-rank">${i+1}</span><div class="decision-main"><strong>${escapeHtml(o.title)}</strong><div class="decision-bar"><span style="width:${Math.min(100,o.count*20)}%"></span></div></div><strong>${o.count}</strong></div>`).join("");
}

function readSmartSearchPreferences() {
    const interests = [...document.querySelectorAll("#smartSearchInterests input:checked")].map(input => input.value);
    return {
        origin: $("smartOrigin")?.value.trim() || "",
        destination: $("smartDestination")?.value.trim() || "",
        start_date: $("smartStartDate")?.value || "",
        end_date: $("smartEndDate")?.value || "",
        budget_per_person: $("smartBudget")?.value ? Number($("smartBudget").value) : null,
        travellers: $("smartTravellers")?.value ? Number($("smartTravellers").value) : null,
        stay: $("smartStay")?.value || "any",
        transport: $("smartTransport")?.value || "any",
        interests,
        notes: $("smartNotes")?.value.trim() || ""
    };
}

function renderSmartSearchForm() {
    if (!activeTrip) return;
    const p = activeTrip.search_preferences || {};
    if ($("smartOrigin")) $("smartOrigin").value = p.origin || "";
    if ($("smartDestination")) $("smartDestination").value = p.destination || activeTrip.destination || "";
    if ($("smartStartDate")) $("smartStartDate").value = p.start_date || activeTrip.start_date || "";
    if ($("smartEndDate")) $("smartEndDate").value = p.end_date || activeTrip.end_date || "";
    if ($("smartBudget")) $("smartBudget").value = p.budget_per_person ?? activeTrip.budget_per_person ?? "";
    if ($("smartTravellers")) $("smartTravellers").value = p.travellers || "";
    if ($("smartStay")) $("smartStay").value = p.stay || "any";
    if ($("smartTransport")) $("smartTransport").value = p.transport || "any";
    if ($("smartNotes")) $("smartNotes").value = p.notes || "";
    document.querySelectorAll("#smartSearchInterests input").forEach(input => {
        input.checked = (p.interests || []).includes(input.value);
    });
    renderSmartRecommendations(activeTrip.recommendations || []);
}

function smartDestinationIdeas(p) {
    if (p.destination) return [{name:p.destination, reason:"Destino indicado por el grupo"}];
    const interests = new Set(p.interests || []);
    const ideas = [];
    const add = (name, reason) => { if (!ideas.some(x => x.name.toLowerCase() === name.toLowerCase())) ideas.push({name, reason}); };
    if (interests.has("beach")) { add("Valencia","Playa, ciudad y buena conexión"); add("Málaga","Costa, gastronomía y ambiente"); add("Alicante","Playa y escapada urbana"); }
    if (interests.has("culture")) { add("Roma","Historia, patrimonio y gastronomía"); add("Lisboa","Ciudad, cultura y escapada cómoda"); add("Praga","Arquitectura y patrimonio"); }
    if (interests.has("nature")) { add("Asturias","Naturaleza, costa y montaña"); add("Madeira","Naturaleza y rutas"); add("Alpes","Montaña y actividades al aire libre"); }
    if (interests.has("food")) { add("San Sebastián","Gastronomía y ciudad"); add("Bolonia","Gastronomía y cultura"); }
    if (interests.has("nightlife")) { add("Madrid","Vida urbana y ocio"); add("Lisboa","Ambiente y vida nocturna"); add("Budapest","Ciudad y ocio"); }
    if (interests.has("relax")) { add("Mallorca","Costa y descanso"); add("Algarve","Playas y ritmo tranquilo"); }
    if (interests.has("adventure")) { add("Madeira","Naturaleza y actividades"); add("Andorra","Montaña y deporte"); }
    if (!ideas.length) ["Lisboa","Valencia","Roma"].forEach(x => add(x,"Punto de partida para comparar"));
    return ideas.slice(0,5);
}

function buildTravelSearchLinks(p, destination) {
    const dest = encodeURIComponent(destination);
    const origin = encodeURIComponent(p.origin || "");
    const datePart = p.start_date && p.end_date ? encodeURIComponent(p.start_date + "_" + p.end_date) : "";
    return {
        flights: p.origin && p.start_date ? "https://www.google.com/travel/flights?q=" + origin + "%20to%20" + dest + (datePart ? "%20" + datePart : "") : "https://www.google.com/travel/flights?q=" + dest,
        hotels: "https://www.google.com/travel/hotels?q=" + dest,
        places: "https://www.google.com/maps/search/" + dest
    };
}

function scoreTravelIdea(idea, p) {
    let score = 60;
    const text = (idea.reason + " " + idea.name).toLowerCase();
    const interests = p.interests || [];
    if (interests.some(i => text.includes(i))) score += 8;
    if (p.budget_per_person) score += 4;
    if (p.start_date && p.end_date) score += 4;
    if (p.travellers) score += 4;
    return Math.min(96, score);
}

function renderSmartRecommendations(recommendations) {
    const root = $("smartRecommendations");
    if (!root) return;
    if (!recommendations.length) { root.hidden = true; root.innerHTML = ""; return; }
    root.hidden = false;
    const p = activeTrip?.search_preferences || {};
    root.innerHTML = '<div class="trip-smart-results-head"><strong>Propuestas para vuestro grupo</strong><span>' +
        escapeHtml((p.travellers ? p.travellers + " viajeros" : "Grupo sin tamaño definido") + (p.budget_per_person ? " · " + money(p.budget_per_person) + " / persona" : "")) +
        '</span></div>' +
        recommendations.map(item => {
            const links = item.links || buildTravelSearchLinks(p, item.destination || item.name);
            const tags = (item.tags || []).map(tag => '<span>' + escapeHtml(tag) + '</span>').join("");
            return '<article class="trip-smart-card"><div class="trip-smart-card-main">' +
                '<span class="trip-smart-card-kicker">' + escapeHtml(item.type || "DESTINO") + (item.match ? " · " + item.match + "% DE AJUSTE" : "") + '</span>' +
                '<h4>' + escapeHtml(item.destination || item.name) + '</h4>' +
                '<p>' + escapeHtml(item.reason || "Opción generada a partir de las necesidades del grupo.") + '</p>' +
                '<div class="trip-smart-tags">' + tags + '</div>' +
                '<div class="trip-smart-disclaimer">' + escapeHtml(item.detail || "Los precios y disponibilidad se consultan en el momento de abrir el comparador.") + '</div>' +
                '</div><div class="trip-smart-links">' +
                '<a class="button secondary" target="_blank" rel="noopener" href="' + escapeHtml(links.flights) + '">✈ Vuelos</a>' +
                '<a class="button secondary" target="_blank" rel="noopener" href="' + escapeHtml(links.hotels) + '">⌂ Hoteles</a>' +
                '<a class="button secondary" target="_blank" rel="noopener" href="' + escapeHtml(links.places) + '">⌖ Lugares</a>' +
                '</div></article>';
        }).join("");
}

async function runSmartTravelSearch(e) {
    e?.preventDefault();
    if (!activeTrip) return;
    const preferences = readSmartSearchPreferences();
    if (preferences.start_date && preferences.end_date && preferences.end_date < preferences.start_date) {
        alert("La fecha de vuelta no puede ser anterior a la de ida.");
        return;
    }
    const button = $("smartSearchForm")?.querySelector("button[type=submit]");
    if (button) { button.disabled = true; button.textContent = "Buscando…"; }
    if ($("smartSearchStatus")) $("smartSearchStatus").textContent = "Analizando las preferencias del grupo…";
    const ideas = smartDestinationIdeas(preferences);
    const recommendations = ideas.map((idea, index) => ({
        type: "DESTINO",
        destination: idea.name,
        reason: idea.reason,
        match: scoreTravelIdea(idea, preferences) - index * 2,
        tags: (preferences.interests || []).slice(0,4).map(i => ({
            beach:"Playa",culture:"Cultura",nature:"Naturaleza",food:"Gastronomía",nightlife:"Ambiente",adventure:"Aventura",relax:"Relax"
        }[i] || i)),
        links: buildTravelSearchLinks(preferences, idea.name),
        detail: "Búsqueda preparada con " + (preferences.origin || "vuestro origen") + (preferences.budget_per_person ? ", presupuesto de " + money(preferences.budget_per_person) + " por persona" : "") + "."
    }));
    const { data, error } = await supabaseClient.from("trips").update({
        search_preferences: preferences,
        recommendations,
        recommendations_updated_at: new Date().toISOString()
    }).eq("id", activeTrip.id).select().single();
    if (error) {
        console.error(error);
        if ($("smartSearchStatus")) $("smartSearchStatus").textContent = "No se han podido guardar las preferencias.";
    } else {
        activeTrip = data;
        trips = trips.map(t => t.id === data.id ? data : t);
        renderSmartSearchForm();
        if ($("smartSearchStatus")) $("smartSearchStatus").textContent = "Listo: hemos preparado búsquedas adaptadas a vuestro grupo.";
    }
    if (button) { button.disabled = false; button.textContent = "✦ Encontrar opciones"; }
}

async function createTripFromForm(e) {
    e.preventDefault();
    const user = await getCurrentUser(), group = await getCurrentGroup();
    if (!user || !group) return;
    const payload = {group_id:group.id,created_by:user.id,title:$("tripTitle").value.trim(),destination:$("tripDestination").value.trim()||null,start_date:$("tripStartDate").value||null,end_date:$("tripEndDate").value||null,budget_per_person:$("tripBudget").value?Number($("tripBudget").value):null,description:$("tripDescription").value.trim()||null,search_preferences:{}};
    if (!payload.title) return;
    const {data,error}=await supabaseClient.from("trips").insert(payload).select().single();
    if(error){alert("No se ha podido crear el viaje.");console.error(error);return;}
    closeTripModal(); await loadTrips(data.id);
}

async function createOptionFromForm(e) {
    e.preventDefault();
    const user = await getCurrentUser();
    if (!user || !activeTrip) return;
    const details=readOptionDetails();
    const payload={trip_id:activeTrip.id,created_by:user.id,category:$("optionCategory").value,title:$("optionTitle").value.trim(),price:$("optionPrice").value?Number($("optionPrice").value):null,price_per_person:$("optionPricePerson").value?Number($("optionPricePerson").value):null,provider:$("optionProvider").value.trim()||null,url:$("optionUrl").value.trim()||null,notes:$("optionNotes").value.trim()||null,metadata:{travel_details:details}};
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
