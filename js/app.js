document.addEventListener("DOMContentLoaded", async () => {

    loadStats();
    loadMembers();
    loadMemories();
    loadQuote();
    setupMobileMenu();

    await loadEvents();
    setupEventForm();

});


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


/* =========================================================
   ESTADÍSTICAS
   ========================================================= */

function loadStats() {

    const members =
        document.getElementById("membersCount");

    const memories =
        document.getElementById("memoriesCount");

    const events =
        document.getElementById("eventsCount");

    const quotes =
        document.getElementById("quotesCount");


    if (members) {

        members.textContent =
            CURRUSCOS_DATA.members.length;

    }


    if (memories) {

        memories.textContent =
            CURRUSCOS_DATA.memories.length;

    }


    if (events) {

        events.textContent =
            CURRUSCOS_DATA.events.length;

    }


    if (quotes) {

        quotes.textContent =
            CURRUSCOS_DATA.quotes.length;

    }

}


/* =========================================================
   MIEMBROS — CONTENIDO ANTIGUO / PÚBLICO
   ========================================================= */

function loadMembers() {

    const previewContainer =
        document.getElementById("membersPreview");

    const gridContainer =
        document.getElementById("membersGrid");


    /* Página principal */

    if (previewContainer) {

        const members =
            CURRUSCOS_DATA.members.slice(0, 4);


        previewContainer.innerHTML =
            members.map(member => `

                <article class="member-card">

                    <div class="member-image">

                        <img
                            src="${escapeHtml(member.image)}"
                            alt="${escapeHtml(member.name)}"
                            loading="lazy"
                            onerror="this.style.display='none'"
                        >

                    </div>

                    <div class="member-info">

                        <span>
                            ${escapeHtml(member.role)}
                        </span>

                        <h3>
                            ${escapeHtml(member.name)}
                        </h3>

                        <p>
                            @${escapeHtml(member.username)}
                        </p>

                    </div>

                </article>

            `).join("");

    }


    /* Página de miembros */

    if (gridContainer) {

        gridContainer.innerHTML =
            CURRUSCOS_DATA.members.map(member => `

                <article class="member-card">

                    <div class="member-image">

                        <img
                            src="${escapeHtml(member.image)}"
                            alt="${escapeHtml(member.name)}"
                            loading="lazy"
                            onerror="this.style.display='none'"
                        >

                    </div>

                    <div class="member-info">

                        <span>
                            ${escapeHtml(member.role)}
                        </span>

                        <h3>
                            ${escapeHtml(member.name)}
                        </h3>

                        <p>
                            @${escapeHtml(member.username)}
                        </p>

                    </div>

                </article>

            `).join("");

    }

}


/* =========================================================
   RECUERDOS — CONTENIDO ANTIGUO / PÚBLICO
   ========================================================= */

function loadMemories() {

    const container =
        document.getElementById("latestMemories");


    if (!container) {
        return;
    }


    const memories =
        CURRUSCOS_DATA.memories.slice(0, 3);


    container.innerHTML =
        memories.map(memory => `

            <article class="memory-card">

                <div class="memory-image">

                    <img
                        src="${escapeHtml(memory.image)}"
                        alt="${escapeHtml(memory.title)}"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >

                </div>

                <div class="memory-content">

                    <span>
                        ${formatDate(memory.date)}
                    </span>

                    <h3>
                        ${escapeHtml(memory.title)}
                    </h3>

                    <p>
                        ${escapeHtml(memory.description)}
                    </p>

                </div>

            </article>

        `).join("");

}


/* =========================================================
   FRASE
   ========================================================= */

function loadQuote() {

    const quote =
        document.getElementById("featuredQuote");

    const author =
        document.getElementById("featuredQuoteAuthor");


    if (!quote || !author) {
        return;
    }


    if (
        !CURRUSCOS_DATA.quotes ||
        !CURRUSCOS_DATA.quotes.length
    ) {

        return;

    }


    const randomQuote =
        CURRUSCOS_DATA.quotes[
            Math.floor(
                Math.random() *
                CURRUSCOS_DATA.quotes.length
            )
        ];


    quote.textContent =
        `"${randomQuote.text}"`;

    author.textContent =
        `— ${randomQuote.author}`;

}


/* =========================================================
   FECHAS
   ========================================================= */

function formatDate(dateString) {

    const date =
        new Date(dateString);


    return date.toLocaleDateString(
        "es-ES",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


function formatEventDay(date) {

    const d =
        new Date(`${date}T00:00:00`);


    return d.getDate();

}


function formatEventMonth(date) {

    const d =
        new Date(`${date}T00:00:00`);


    return d
        .toLocaleDateString(
            "es-ES",
            {
                month: "short"
            }
        )
        .replace(".", "")
        .toUpperCase();

}


/* =========================================================
   MENÚ MÓVIL
   ========================================================= */

function setupMobileMenu() {

    const button =
        document.getElementById("menuButton");

    const nav =
        document.getElementById("mainNav");


    if (!button || !nav) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            nav.classList.toggle(
                "mobile-open"
            );

        }
    );

}


/* =========================================================
   EVENTOS — SUPABASE
   ========================================================= */

async function loadEvents() {

    const container =
        document.getElementById("eventsList");


    /*
     * Esta función también se ejecuta
     * en páginas que no tienen lista de eventos.
     */

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="empty-state">

            <h3>
                Cargando eventos...
            </h3>

        </div>

    `;


    try {

        const events =
            await getGroupEvents();


        if (!events) {

            throw new Error(
                "No se pudieron obtener los eventos."
            );

        }


        if (!events.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <h3>
                        No hay eventos todavía
                    </h3>

                    <p>
                        Creemos el primero.
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML =
            events.map(event => `

                <article class="event-card">

                    <div class="event-date">

                        <span>
                            ${formatEventDay(event.date)}
                        </span>

                        <strong>
                            ${formatEventMonth(event.date)}
                        </strong>

                    </div>


                    <div class="event-info">

                        <h3>
                            ${escapeHtml(
                                event.title
                            )}
                        </h3>


                        <p class="event-details">

                            🕐
                            ${escapeHtml(
                                event.time ||
                                "Hora por confirmar"
                            )}

                            &nbsp; · &nbsp;

                            📍
                            ${escapeHtml(
                                event.location ||
                                "Lugar por confirmar"
                            )}

                        </p>


                        ${
                            event.description
                                ? `
                                    <p>
                                        ${escapeHtml(
                                            event.description
                                        )}
                                    </p>
                                  `
                                : ""
                        }

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


        /*
         * Asignamos los eventos de click
         * después de crear las tarjetas.
         */

        container
            .querySelectorAll(".event-delete")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const eventId =
                            button.dataset.eventId;


                        await deleteEvent(
                            eventId,
                            button
                        );

                    }
                );

            });


    } catch (error) {

        console.error(
            "Error cargando eventos:",
            error
        );


        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    No se han podido cargar los eventos
                </h3>

                <p>
                    ${escapeHtml(
                        error.message ||
                        "Ha ocurrido un error."
                    )}
                </p>

            </div>

        `;

    }

}


/* =========================================================
   CREAR EVENTO
   ========================================================= */

function setupEventForm() {

    const form =
        document.getElementById("eventForm");


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            const newEvent = {

                title:
                    document
                        .getElementById("eventTitle")
                        .value
                        .trim(),

                date:
                    document
                        .getElementById("eventDate")
                        .value,

                time:
                    document
                        .getElementById("eventTime")
                        .value,

                location:
                    document
                        .getElementById("eventLocation")
                        .value
                        .trim(),

                description:
                    document
                        .getElementById("eventDescription")
                        .value
                        .trim()

            };


            if (
                !newEvent.title ||
                !newEvent.date ||
                !newEvent.time ||
                !newEvent.location
            ) {

                alert(
                    "Completa todos los campos obligatorios."
                );

                return;

            }


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Creando...";

            }


            try {

                const createdEvent =
                    await createGroupEvent(
                        newEvent
                    );


                if (!createdEvent) {

                    throw new Error(
                        "No se ha podido crear el evento."
                    );

                }


                form.reset();


                await loadEvents();


                /*
                 * Dejamos la página en la lista
                 * para comprobar inmediatamente
                 * que el evento existe.
                 */

                document
                    .getElementById("eventsList")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });


            } catch (error) {

                console.error(
                    "Error creando evento:",
                    error
                );


                alert(
                    error.message ||
                    "No se ha podido crear el evento."
                );


            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "Crear evento";

                }

            }

        }
    );

}


/* =========================================================
   ELIMINAR EVENTO
   ========================================================= */

async function deleteEvent(
    id,
    button = null
) {

    const confirmed =
        confirm(
            "¿Seguro que quieres eliminar este evento?"
        );


    if (!confirmed) {
        return;
    }


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Eliminando...";

    }


    try {

        const success =
            await deleteGroupEvent(id);


        if (!success) {

            throw new Error(
                "No se ha podido eliminar el evento."
            );

        }


        await loadEvents();


    } catch (error) {

        console.error(
            "Error eliminando evento:",
            error
        );


        alert(
            error.message ||
            "No se ha podido eliminar el evento."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Eliminar";

        }

    }

}
