document.addEventListener("DOMContentLoaded", () => {
    loadStats();
    loadMemories();
    loadQuote();
    setupMobileMenu();
    loadEvents();
    setupEventForm();
});


function loadStats() {
    const members = document.getElementById("membersCount");
    const memories = document.getElementById("memoriesCount");
    const events = document.getElementById("eventsCount");
    const quotes = document.getElementById("quotesCount");

    if (members) {
        members.textContent = CURRUSCOS_DATA.members.length;
    }

    if (memories) {
        memories.textContent = CURRUSCOS_DATA.memories.length;
    }

    if (events) {
        events.textContent = CURRUSCOS_DATA.events.length;
    }

    if (quotes) {
        quotes.textContent = CURRUSCOS_DATA.quotes.length;
    }
}
function loadMembers() {
    const previewContainer = document.getElementById("membersPreview");
    const gridContainer = document.getElementById("membersGrid");

    // Página principal: mostrar solo 4
    if (previewContainer) {
        const members = CURRUSCOS_DATA.members.slice(0, 4);

        previewContainer.innerHTML = members.map(member => `
            <article class="member-card">

                <div class="member-image">
                    <img
                        src="${member.image}"
                        alt="${member.name}"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >
                </div>

                <div class="member-info">
                    <span>${member.role}</span>
                    <h3>${member.name}</h3>
                    <p>@${member.username}</p>
                </div>

            </article>
        `).join("");
    }

    // Página de miembros: mostrar todos
    if (gridContainer) {
        gridContainer.innerHTML = CURRUSCOS_DATA.members.map(member => `
            <article class="member-card">

                <div class="member-image">
                    <img
                        src="${member.image}"
                        alt="${member.name}"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >
                </div>

                <div class="member-info">
                    <span>${member.role}</span>
                    <h3>${member.name}</h3>
                    <p>@${member.username}</p>
                </div>

            </article>
        `).join("");
    }
}

function loadMemories() {
    const container = document.getElementById("latestMemories");

    if (!container) return;

    const memories = CURRUSCOS_DATA.memories.slice(0, 3);

    container.innerHTML = memories.map(memory => `
        <article class="memory-card">

            <div class="memory-image">
                <img
                    src="${memory.image}"
                    alt="${memory.title}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            </div>

            <div class="memory-content">
                <span>${formatDate(memory.date)}</span>
                <h3>${memory.title}</h3>
                <p>${memory.description}</p>
            </div>

        </article>
    `).join("");
}


function loadQuote() {
    const quote = document.getElementById("featuredQuote");
    const author = document.getElementById("featuredQuoteAuthor");

    if (!quote || !author) return;

    const randomQuote =
        CURRUSCOS_DATA.quotes[
            Math.floor(Math.random() * CURRUSCOS_DATA.quotes.length)
        ];

    quote.textContent = `"${randomQuote.text}"`;
    author.textContent = `— ${randomQuote.author}`;
}


function formatDate(dateString) {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}


function setupMobileMenu() {
    const button = document.getElementById("menuButton");
    const nav = document.getElementById("mainNav");

    if (!button || !nav) return;

    button.addEventListener("click", () => {
        nav.classList.toggle("mobile-open");
    });
}
async function loadEvents() {

    const container = document.getElementById("eventsList");

    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <h3>Cargando eventos...</h3>
        </div>
    `;

    const events = await getGroupEvents();

    if (events.length === 0) {

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

                <h3>${event.title}</h3>

                <p class="event-details">
                    🕐 ${event.time || "Hora por confirmar"}
                    &nbsp; · &nbsp;
                    📍 ${event.location || "Lugar por confirmar"}
                </p>

                <p>
                    ${event.description || ""}
                </p>

            </div>

            <div class="event-actions">

                <a
                    href="evento.html?id=${event.id}"
                    class="button button-primary"
                >
                    Ver detalles
                </a>

                <button
                    class="event-delete"
                    onclick="deleteEvent('${event.id}')"
                >
                    Eliminar
                </button>

            </div>

        </article>
    `).join("");
}


function setupEventForm() {

    const form = document.getElementById("eventForm");

    if (!form) return;

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        const newEvent = {

            title: document.getElementById("eventTitle").value.trim(),

            date: document.getElementById("eventDate").value,

            time: document.getElementById("eventTime").value,

            location: document.getElementById("eventLocation").value.trim(),

            description: document.getElementById("eventDescription").value.trim()

        };

        const createdEvent = await createGroupEvent(newEvent);

        if (!createdEvent) {

            alert("No se ha podido crear el evento.");

            return;
        }

        form.reset();

        await loadEvents();
    });
}


async function deleteEvent(id) {

    const confirmed = confirm(
        "¿Seguro que quieres eliminar este evento?"
    );

    if (!confirmed) return;

    const success = await deleteGroupEvent(id);

    if (!success) {

        alert("No se ha podido eliminar el evento.");

        return;
    }

    await loadEvents();
}
function formatEventDay(date) {
    console.log("FORMAT EVENT DAY CARGADO");
    const d = new Date(date);
    return d.getDate();
}

function formatEventMonth(date) {
    const d = new Date(date);

    return d.toLocaleDateString("es-ES", {
        month: "short"
    }).toUpperCase();
}
