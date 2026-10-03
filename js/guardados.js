let savedEvents=[];
let savedSearch="";

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    await window.curruscosReady;

    document.getElementById("menuButton")?.addEventListener("click", () =>
        document.getElementById("mainNav")?.classList.toggle("mobile-open")
    );

    document.getElementById("savedSearch")?.addEventListener("input", event => {
        savedSearch = event.target.value.trim().toLowerCase();
        renderSavedEvents();
    });

    await loadSavedEvents();
});

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function eventLabels() {
    return {
        padel: t("activity.padel"),
        futbol: t("activity.futbol"),
        baloncesto: t("activity.baloncesto"),
        tenis: t("activity.tenis"),
        ajedrez: t("activity.ajedrez"),
        gaming: t("activity.gaming"),
        running: t("activity.running"),
        otro: t("activity.other")
    };
}

async function loadSavedEvents() {
    const root = document.getElementById("savedGrid");
    const { data: userResult } = await supabaseClient.auth.getUser();
    const user = userResult?.user;

    if (!user) {
        renderLoginState();
        return;
    }

    const { data, error } = await supabaseClient
        .from("saved_events")
        .select("id,event_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        root.innerHTML = `<div class="saved-empty"><strong>${t("saved.loadError")}</strong><p>${t("saved.retry")}</p></div>`;
        return;
    }

    const rows = data || [];

    if (!rows.length) {
        savedEvents = [];
        renderSavedEvents();
        return;
    }

    const ids = rows.map(row => row.event_id);
    const { data: events, error: eventError } = await supabaseClient
        .from("events")
        .select("id,title,date,time,location,event_type,category,status,capacity,visibility")
        .in("id", ids);

    if (eventError) {
        console.error(eventError);
        root.innerHTML = `<div class="saved-empty"><strong>${t("saved.eventsError")}</strong></div>`;
        return;
    }

    const byId = new Map((events || []).map(event => [String(event.id), event]));
    savedEvents = rows
        .map(row => ({ savedId: row.id, event: byId.get(String(row.event_id)) }))
        .filter(item => item.event);

    renderSavedEvents();
}

function renderLoginState() {
    document.getElementById("savedGrid").innerHTML = `
        <div class="saved-empty">
            <strong>${t("saved.loginTitle")}</strong>
            <p>${t("saved.loginText")}</p>
            <a class="button primary" href="login.html">${t("auth.login")}</a>
        </div>
    `;
}

function renderSavedEvents() {
    const labels = eventLabels();

    const visible = savedEvents.filter(item => {
        const event = item.event;
        const text = [
            event.title,
            event.location,
            labels[event.event_type],
            event.category
        ].join(" ").toLowerCase();

        return !savedSearch || text.includes(savedSearch);
    });

    document.getElementById("savedCount").textContent = savedEvents.length;

    const root = document.getElementById("savedGrid");

    if (!visible.length) {
        root.innerHTML = `
            <div class="saved-empty">
                <strong>${savedEvents.length ? t("saved.noMatch") : t("saved.empty")}</strong>
                <p>${savedEvents.length ? t("saved.tryOther") : t("saved.exploreHint")}</p>
                <a class="button primary" href="explorar.html">${t("explore.title")}</a>
            </div>
        `;
        return;
    }

    root.innerHTML = visible.map(item => {
        const event = item.event;
        const date = event.date
            ? new Date(event.date + "T" + (event.time || "00:00")).toLocaleDateString(
                getLanguage(),
                { weekday: "short", day: "numeric", month: "short", year: "numeric" }
            )
            : t("date.undefined");

        const type = labels[event.event_type] || event.category || t("event.generic");
        const status = event.status === "finished"
            ? t("status.finished")
            : event.capacity
                ? `${event.capacity} ${t("event.spots")}`
                : t("event.open");

        return `
            <article class="saved-card">
                <span class="saved-tag">${esc(type)}</span>
                <h2>${esc(event.title)}</h2>
                <div class="saved-meta">${esc(date)}${event.location ? " · " + esc(event.location) : ""}</div>
                <div class="saved-bottom">
                    <div><small>${esc(status)}</small></div>
                    <div class="event-action-buttons">
                        <a class="saved-open" href="evento-publico.html?id=${encodeURIComponent(event.id)}">${t("common.viewEvent")} ↗</a>
                        <button class="saved-remove" data-saved-id="${esc(item.savedId)}" type="button">${t("common.remove")}</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    root.querySelectorAll("[data-saved-id]").forEach(button => {
        button.addEventListener("click", async event => {
            event.preventDefault();
            button.disabled = true;

            const { error } = await supabaseClient
                .from("saved_events")
                .delete()
                .eq("id", button.dataset.savedId);

            if (error) {
                console.error(error);
                button.disabled = false;
                alert(t("saved.removeError"));
                return;
            }

            savedEvents = savedEvents.filter(item => item.savedId !== button.dataset.savedId);
            renderSavedEvents();
        });
    });
}
