/* =========================================================
   CURRUSCOS CLAN — SHARED FRONTEND
   ========================================================= */

const PRIVATE_PAGES = new Set([
    "dashboard.html",
    "miembros.html",
    "historia.html",
    "recuerdos.html",
    "eventos.html",
    "evento.html"
]);

document.addEventListener("DOMContentLoaded", async () => {
    setupMobileMenu();

    const page = getCurrentPage();

    if (PRIVATE_PAGES.has(page)) {
        const access = await requirePrivatePage();

        if (!access) {
            return;
        }
    }

    if (page === "eventos.html") {
        await loadEvents();
        setupEventForm();
    }
});

/* =========================================================
   AUTH / TENANCY
   ========================================================= */

function getCurrentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
}

async function requirePrivatePage() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.replace("login.html");
        return null;
    }

    const groups = await getUserGroups();

    if (!groups.length) {
        localStorage.removeItem("curruscos_current_group");
        window.location.replace("onboarding.html");
        return null;
    }

    return {
        user,
        groups,
        currentGroup: await getCurrentGroup()
    };
}

/* =========================================================
   UTILIDADES
   ========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return "";

    return new Date(dateString).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatEventDay(date) {
    return new Date(`${date}T00:00:00`).getDate();
}

function formatEventMonth(date) {
    return new Date(`${date}T00:00:00`)
        .toLocaleDateString("es-ES", { month: "short" })
        .replace(".", "")
        .toUpperCase();
}

/* =========================================================
   MENÚ MÓVIL
   ========================================================= */

function setupMobileMenu() {
    const button = document.getElementById("menuButton");
    const nav = document.getElementById("mainNav");

    if (!button || !nav || button.dataset.menuReady === "true") {
        return;
    }

    button.dataset.menuReady = "true";

    button.addEventListener("click", () => {
        const open = nav.classList.toggle("mobile-open");
        button.setAttribute("aria-expanded", String(open));
    });
}

/* =========================================================
   EVENTOS
   ========================================================= */

async function loadEvents() {
    const container = document.getElementById("eventsList");

    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <h3>Cargando eventos...</h3>
        </div>
    `;

    try {
        const events = await getGroupEvents();

        if (!events) {
            throw new Error("No se pudieron obtener los eventos.");
        }

        if (!events.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No hay eventos todavía</h3>
                    <p>Creemos el primero.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(event => `
            <article class="event-card">
                <div class="event-date">
                    <span>${formatEventDay(event.date)}</span>
                    <strong>${formatEventMonth(event.date)}</strong>
                </div>

                <div class="event-info">
                    <h3>${escapeHtml(event.title)}</h3>

                    <p class="event-details">
                        🕐 ${escapeHtml(event.time || "Hora por confirmar")}
                        &nbsp; · &nbsp;
                        📍 ${escapeHtml(event.location || "Lugar por confirmar")}
                    </p>

                    ${event.description
                        ? `<p>${escapeHtml(event.description)}</p>`
                        : ""}
                </div>

                <div class="event-actions">
                    <a
                        href="evento.html?id=${encodeURIComponent(event.id)}"
                        class="button button-primary"
                    >
                        Ver detalles
                    </a>

                    <button
                        type="button"
                        class="event-delete"
                        data-event-id="${escapeHtml(event.id)}"
                    >
                        Eliminar
                    </button>
                </div>
            </article>
        `).join("");

        container.querySelectorAll(".event-delete").forEach(button => {
            button.addEventListener("click", async () => {
                await deleteEvent(button.dataset.eventId, button);
            });
        });
    } catch (error) {
        console.error("Error cargando eventos:", error);

        container.innerHTML = `
            <div class="empty-state">
                <h3>No se han podido cargar los eventos</h3>
                <p>${escapeHtml(error.message || "Ha ocurrido un error.")}</p>
            </div>
        `;
    }
}

function setupEventForm() {
    const form = document.getElementById("eventForm");

    if (!form || form.dataset.ready === "true") return;

    form.dataset.ready = "true";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');

        const newEvent = {
            title: document.getElementById("eventTitle")?.value.trim(),
            date: document.getElementById("eventDate")?.value,
            time: document.getElementById("eventTime")?.value,
            location: document.getElementById("eventLocation")?.value.trim(),
            description: document.getElementById("eventDescription")?.value.trim()
        };

        if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) {
            alert("Completa todos los campos obligatorios.");
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Creando...";
        }

        try {
            const createdEvent = await createGroupEvent(newEvent);

            if (!createdEvent) {
                throw new Error("No se ha podido crear el evento.");
            }

            form.reset();
            await loadEvents();

            document.getElementById("eventsList")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        } catch (error) {
            console.error("Error creando evento:", error);
            alert(error.message || "No se ha podido crear el evento.");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Crear evento";
            }
        }
    });
}

async function deleteEvent(id, button = null) {
    if (!confirm("¿Seguro que quieres eliminar este evento?")) return;

    if (button) {
        button.disabled = true;
        button.textContent = "Eliminando...";
    }

    try {
        const success = await deleteGroupEvent(id);

        if (!success) {
            throw new Error("No se ha podido eliminar el evento.");
        }

        await loadEvents();
    } catch (error) {
        console.error("Error eliminando evento:", error);
        alert(error.message || "No se ha podido eliminar el evento.");

        if (button) {
            button.disabled = false;
            button.textContent = "Eliminar";
        }
    }
}
