/* =========================================================
   CURRUSCOS — DASHBOARD
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    const group = access.currentGroup;
    const user = access.user;

    const membersEl =
        document.getElementById("dashboardMembers");
    const eventsEl =
        document.getElementById("dashboardEvents");
    const memoriesEl =
        document.getElementById("dashboardMemories");
    const tasksEl =
        document.getElementById("dashboardTasks");
    const nextEl =
        document.getElementById("nextEventContent");
    const upcomingEl =
        document.getElementById("upcomingEvents");
    const activityEl =
        document.getElementById("activityList");
    const invitationsEl =
        document.getElementById("invitationsContainer");
    const statusEl =
        document.getElementById("organizationStatus");
    const descriptionEl =
        document.getElementById("organizationDescription");
    const progressEl =
        document.getElementById("organizationProgress");
    const percentEl =
        document.getElementById("organizationPercent");

    const [
        members,
        events,
        memories,
        notifications,
        invitations
    ] = await Promise.all([
        getGroupMembers(group.id),
        getGroupEvents(),
        getGroupMemories(),
        getUserNotifications(),
        getMyInvitations()
    ]);

    const { data: trips, error: tripsError } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date")
        .eq("group_id", group.id)
        .in("status", ["planning", "confirmed"])
        .order("created_at", { ascending: false });

    if (tripsError) {
        console.error("No se han podido cargar los viajes:", tripsError);
    }

    const pulseEventEl = document.getElementById("pulseEvent");
    const pulseMembersEl = document.getElementById("pulseMembers");
    const pulseTripsEl = document.getElementById("pulseTrips");
    const pulseMemoriesEl = document.getElementById("pulseMemories");
    const pulseMessageEl = document.getElementById("pulseMessage");

    if (pulseEventEl) {
        pulseEventEl.textContent = "Cargando…";
    }
    if (pulseMembersEl) {
        pulseMembersEl.textContent = members.length;
    }
    if (pulseTripsEl) {
        pulseTripsEl.textContent = (trips || []).length;
    }
    if (pulseMemoriesEl) {
        pulseMemoriesEl.textContent = memories.length;
    }

    const eventIds =
        events.map(event => event.id);

    const tasks =
        await getTasksForEvents(eventIds);

    membersEl.textContent =
        String(members.length);

    eventsEl.textContent =
        String(events.length);

    memoriesEl.textContent =
        String(memories.length);

    tasksEl.textContent =
        String(tasks.length);

    const now =
        new Date();

    const upcoming =
        events
            .map(event => ({
                event,
                date: getEventDate(event)
            }))
            .filter(item =>
                item.date &&
                item.date >= now
            )
            .sort((a, b) =>
                a.date - b.date
            );

    const next =
        upcoming[0] || null;

    if (pulseEventEl) {
        pulseEventEl.textContent = next
            ? (next.event.title || "Próximo evento")
            : "Sin planes";
    }

    if (pulseMessageEl) {
        if (next) {
            const days = Math.max(0, Math.ceil((next.date.getTime() - now.getTime()) / 86400000));
            const tripText = (trips || []).length
                ? " Además, tenéis " + (trips || []).length + " viaje" + ((trips || []).length === 1 ? "" : "s") + " en planificación."
                : " Podéis empezar a planificar vuestro próximo viaje desde Viajes.";
            pulseMessageEl.textContent = days === 0
                ? "Hoy pasa algo en el grupo." + tripText
                : "Faltan " + days + " días para " + (next.event.title || "el próximo plan") + "." + tripText;
        } else {
            pulseMessageEl.textContent = (trips || []).length
                ? "No hay eventos próximos, pero ya hay " + (trips || []).length + " viaje" + ((trips || []).length === 1 ? "" : "s") + " en movimiento."
                : "Todavía no hay ningún plan próximo. Este es un buen momento para crear uno.";
        }
    }

    if (next) {
        const event = next.event;

        nextEl.innerHTML =
            '<div class="next-event-date">📅 ' +
            escapeHtml(
                formatEventDate(
                    event,
                    { weekday: true }
                )
            ) +
            '</div>' +
            '<h2 class="next-event-title">' +
            escapeHtml(
                event.title || "Evento"
            ) +
            '</h2>' +
            (
                event.location
                    ? '<div class="next-event-location">📍 ' +
                        escapeHtml(event.location) +
                      '</div>'
                    : ""
            ) +
            '<a href="evento.html?id=' +
            encodeURIComponent(event.id) +
            '" class="next-event-button">Ver evento →</a>';

        upcomingEl.innerHTML = "";

        upcoming
            .slice(0, 5)
            .forEach(item => {
                const eventCard =
                    document.createElement("a");

                eventCard.className =
                    "upcoming-event";

                eventCard.href =
                    "evento.html?id=" +
                    encodeURIComponent(item.event.id);

                const day =
                    item.date.toLocaleDateString(
                        "es-ES",
                        {
                            day: "numeric",
                            month: "short"
                        }
                    );

                eventCard.innerHTML =
                    '<span class="upcoming-event-date">' +
                    escapeHtml(day) +
                    '</span>' +
                    '<span class="upcoming-event-main">' +
                        '<strong>' +
                        escapeHtml(
                            item.event.title ||
                            "Evento"
                        ) +
                        '</strong>' +
                        '<small>' +
                        escapeHtml(
                            item.event.location ||
                            "Lugar sin definir"
                        ) +
                        '</small>' +
                    '</span>' +
                    '<span class="upcoming-event-arrow">→</span>';

                upcomingEl.appendChild(
                    eventCard
                );
            });
    } else {
        nextEl.innerHTML =
            '<div class="no-event">' +
                'Todavía no hay ningún evento próximo.' +
                '<br><br>' +
                '<a href="eventos.html">Crear un evento →</a>' +
            '</div>';

        upcomingEl.innerHTML =
            '<div class="empty-dashboard">' +
                'No hay eventos próximos.' +
            '</div>';
    }

    /* =====================================================
       ORGANIZACIÓN DEL PRÓXIMO EVENTO
       ===================================================== */

    if (next) {
        const [participants, nextTasks] =
            await Promise.all([
                getEventParticipants(
                    next.event.id
                ),
                Promise.resolve(
                    tasks.filter(
                        task =>
                            task.event_id ===
                            next.event.id
                    )
                )
            ]);

        const participantMap =
            new Map(
                participants.map(
                    item => [
                        String(item.user_id),
                        item.status
                    ]
                )
            );

        const answered =
            members.filter(member =>
                participantMap.has(
                    String(member.user_id)
                )
            ).length;

        const going =
            members.filter(member =>
                participantMap.get(
                    String(member.user_id)
                ) === "yes"
            ).length;

        const attendanceProgress =
            members.length
                ? going / members.length
                : 0;

        const taskProgress =
            nextTasks.length
                ? nextTasks.filter(
                    task => task.completed
                  ).length /
                  nextTasks.length
                : null;

        const components = [
            attendanceProgress
        ];

        if (taskProgress !== null) {
            components.push(taskProgress);
        }

        const organization =
            Math.round(
                (
                    components.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) /
                    components.length
                ) * 100
            );

        progressEl.style.width =
            organization + "%";

        percentEl.textContent =
            organization + "%";

        if (organization >= 90) {
            statusEl.textContent =
                "🟢 Todo listo";

            descriptionEl.textContent =
                "El próximo plan está prácticamente preparado.";
        } else if (organization >= 60) {
            statusEl.textContent =
                "🟠 Bien encaminado";

            descriptionEl.textContent =
                answered +
                " de " +
                members.length +
                " miembros ya han respondido.";
        } else {
            statusEl.textContent =
                "🟡 En organización";

            descriptionEl.textContent =
                "Todavía quedan cosas por cerrar antes del próximo plan.";
        }
    } else {
        progressEl.style.width =
            "0%";

        percentEl.textContent =
            "0%";

        statusEl.textContent =
            "Todo tranquilo";

        descriptionEl.textContent =
            "Cuando haya un próximo evento, aquí verás su estado de organización.";
    }


    /* =====================================================
       CURRUSCOS SENSE — MOTOR DE SIGUIENTE MOVIMIENTO
       Convierte señales dispersas del grupo en una sola
       acción prioritaria. No predice personas: detecta
       fricción operativa y la convierte en un paso.
    ===================================================== */

    async function getServerSense() {
        try {
            const { data, error } = await supabaseClient.rpc("get_group_sense", {
                target_group_id: group.id
            });
            if (error) {
                console.debug("Curruscos Sense server fallback:", error);
                return null;
            }
            return data || null;
        } catch (error) {
            console.debug("Curruscos Sense unavailable:", error);
            return null;
        }
    }

    async function runCurruscosSense() {
        const titleEl = document.getElementById("autopilotTitle");
        const reasonEl = document.getElementById("autopilotReason");
        const labelEl = document.getElementById("autopilotLabel");
        const actionEl = document.getElementById("autopilotAction");
        const orbEl = document.getElementById("autopilotOrb");
        const signalsEl = document.getElementById("autopilotSignals");
        if (!titleEl || !reasonEl || !actionEl) return;

        const signal = (name, value) => '<span class="autopilot-signal"><strong>' +
            escapeHtml(String(value)) + '</strong>' + escapeHtml(name) + '</span>';

        const serverSense = await getServerSense();
        const ranked = [];

        if (serverSense) {
            ranked.push({
                score: Number(serverSense.score || 0),
                label: "CURRUSCOS SENSE",
                title: serverSense.action === "attendance"
                    ? "Cerrar la asistencia"
                    : serverSense.action === "tasks"
                        ? "Resolver lo pendiente"
                        : serverSense.action === "location"
                            ? "Definir el lugar"
                            : serverSense.action === "decision"
                                ? "Resolver una decisión"
                                : serverSense.action === "trip"
                                    ? "Avanzar un viaje"
                                    : serverSense.action === "invitation"
                                        ? "Responder una invitación"
                                        : "Crear el próximo plan",
                reason: serverSense.reason || "",
                href: serverSense.href || "dashboard.html",
                icon: serverSense.action === "attendance" ? "?" :
                    serverSense.action === "tasks" ? "✓" :
                    serverSense.action === "location" ? "⌖" :
                    serverSense.action === "decision" ? "?" :
                    serverSense.action === "trip" ? "↗" :
                    serverSense.action === "invitation" ? "✉" : "+"
            });
        }
        const nextEvent = upcoming[0]?.event || null;

        if (!nextEvent) {
            ranked.push({
                score: 100,
                label: "MODO DESCUBRIMIENTO",
                title: "Crear el próximo plan",
                reason: "El grupo no tiene ningún evento futuro. El sistema detecta un hueco de actividad.",
                href: "crear-evento.html",
                icon: "+"
            });
        }

        if (nextEvent) {
            const nextEventTasks = tasks.filter(task => task.event_id === nextEvent.id);
            const incompleteTasks = nextEventTasks.filter(task => !task.completed);
            const participants = await getEventParticipants(nextEvent.id);
            const answeredCount = members.filter(member =>
                participants.some(item => String(item.user_id) === String(member.user_id))
            ).length;
            const unanswered = Math.max(0, members.length - answeredCount);

            if (unanswered > 0) {
                ranked.push({
                    score: 95 + Math.min(unanswered, 10),
                    label: "FRICCIÓN DETECTADA",
                    title: "Cerrar la asistencia de " + unanswered + (unanswered === 1 ? " persona" : " personas"),
                    reason: nextEvent.title + " todavía no tiene una respuesta de todo el grupo.",
                    href: "evento.html?id=" + encodeURIComponent(nextEvent.id),
                    icon: "?"
                });
            }

            if (incompleteTasks.length) {
                ranked.push({
                    score: 82 + Math.min(incompleteTasks.length, 10),
                    label: "FRICCIÓN DETECTADA",
                    title: "Resolver " + incompleteTasks.length + (incompleteTasks.length === 1 ? " tarea pendiente" : " tareas pendientes"),
                    reason: "El próximo plan tiene trabajo abierto antes de poder considerarse cerrado.",
                    href: "evento.html?id=" + encodeURIComponent(nextEvent.id),
                    icon: "✓"
                });
            }

            if (!nextEvent.location) {
                ranked.push({
                    score: 78,
                    label: "DETALLE ABIERTO",
                    title: "Decidir dónde será " + nextEvent.title,
                    reason: "El evento tiene fecha pero todavía no tiene lugar definido.",
                    href: "evento.html?id=" + encodeURIComponent(nextEvent.id),
                    icon: "⌖"
                });
            }
        }

        if ((trips || []).length) {
            const activeTrips = trips.filter(trip => trip.status === "planning");
            if (activeTrips.length) {
                ranked.push({
                    score: nextEvent ? 63 : 88,
                    label: "PLAN EN MARCHA",
                    title: "Avanzar " + (activeTrips.length === 1 ? "el viaje" : "los viajes"),
                    reason: activeTrips.length + (activeTrips.length === 1 ? " viaje sigue en planificación." : " viajes siguen en planificación."),
                    href: "viajes.html",
                    icon: "↗"
                });
            }
        }

        try {
            if (typeof getGroupPolls === "function") {
                const polls = await getGroupPolls();
                const openPolls = (polls || []).filter(poll => !poll.is_closed);
                if (openPolls.length) {
                    ranked.push({
                        score: nextEvent ? 68 : 91,
                        label: "DECISIÓN ABIERTA",
                        title: "Resolver " + (openPolls.length === 1 ? "una decisión" : openPolls.length + " decisiones"),
                        reason: "Hay votaciones abiertas que están esperando una respuesta del grupo.",
                        href: "decisiones.html",
                        icon: "?"
                    });
                }
            }
        } catch (error) {
            console.debug("Curruscos Sense: decisiones no disponibles", error);
        }

        if (invitations.length) {
            ranked.push({
                score: 92,
                label: "ENTRADA PENDIENTE",
                title: "Responder a " + (invitations.length === 1 ? "una invitación" : invitations.length + " invitaciones"),
                reason: "Hay grupos esperando una respuesta tuya.",
                href: "#dashboardInvitationsSection",
                icon: "✉"
            });
        }

        if (!ranked.length) {
            ranked.push({
                score: 20,
                label: "TODO FLUYE",
                title: "El grupo está al día",
                reason: "No hemos detectado ningún bloqueo claro. Es un buen momento para disfrutar o guardar el momento.",
                href: "recuerdos.html",
                icon: "✦"
            });
        }

        ranked.sort((a, b) => b.score - a.score);
        const top = ranked[0];

        labelEl.textContent = top.label;
        titleEl.textContent = top.title;
        reasonEl.textContent = top.reason;
        actionEl.href = top.href;
        actionEl.textContent = top.href.startsWith("#") ? "Ver →" : "Hacerlo →";
        orbEl.textContent = top.icon;

        const compactSignals = [
            signal("personas", members.length),
            signal("eventos", events.length),
            signal("tareas abiertas", tasks.filter(task => !task.completed).length),
            signal("viajes", (trips || []).length)
        ];

        const secondary = ranked
            .filter(item => item !== top)
            .slice(0, 2)
            .map(item => '<a class="autopilot-signal autopilot-suggestion" href="' +
                escapeHtml(item.href) + '">' +
                escapeHtml(item.title) + ' →</a>');

        signalsEl.innerHTML = compactSignals.join("") + secondary.join("");

        if (top.score >= 90) {
            orbEl.style.transform = "scale(1.03)";
        }
    }

    await runCurruscosSense();

    /* =====================================================
       ACTIVIDAD
       ===================================================== */

    const activity =
        notifications
            .filter(
                notification =>
                    notification.group_id ===
                    group.id
            )
            .slice(0, 8);

    activityEl.innerHTML = "";

    if (!activity.length) {
        activityEl.innerHTML =
            '<div class="empty-dashboard">' +
                'Todavía no hay actividad reciente.' +
            '</div>';
    } else {
        activity.forEach(
            notification => {
                const item =
                    document.createElement("a");

                item.className =
                    "activity-item";

                const target =
                    notificationTarget(
                        notification
                    );

                if (target) {
                    item.href = target;
                }

                item.innerHTML =
                    '<span class="activity-icon">' +
                        notificationIcon(
                            notification.type
                        ) +
                    '</span>' +
                    '<span class="activity-main">' +
                        '<strong>' +
                            escapeHtml(
                                notification.title ||
                                "Actividad"
                            ) +
                        '</strong>' +
                        '<small>' +
                            escapeHtml(
                                notification.message ||
                                ""
                            ) +
                        '</small>' +
                    '</span>' +
                    '<span class="activity-date">' +
                        escapeHtml(
                            notificationDate(
                                notification.created_at
                            )
                        ) +
                    '</span>';

                activityEl.appendChild(
                    item
                );
            }
        );
    }

    /* =====================================================
       INVITACIONES
       ===================================================== */

    if (invitationsEl) {
        invitationsEl.innerHTML = "";

        if (invitations.length) {
            const section =
                document.createElement("section");

            section.className =
                "dashboard-invitations";

            section.id =
                "dashboardInvitationsSection";

            const heading =
                document.createElement("div");

            heading.className =
                "dashboard-invitations-heading";

            heading.innerHTML =
                '<span>INVITACIONES</span>' +
                '<h2>Tienes grupos esperando.</h2>';

            section.appendChild(
                heading
            );

            invitations.forEach(
                invitation => {
                    const card =
                        document.createElement("article");

                    card.className =
                        "invitation-card";

                    const info =
                        document.createElement("div");

                    info.className =
                        "invitation-info";

                    const title =
                        document.createElement("strong");

                    title.textContent =
                        invitation.group_name ||
                        "Nuevo grupo";

                    const message =
                        document.createElement("p");

                    message.textContent =
                        (
                            invitation.inviter_name ||
                            "Alguien"
                        ) +
                        " te ha invitado a unirte.";

                    info.append(
                        title,
                        message
                    );

                    const actions =
                        document.createElement("div");

                    actions.className =
                        "invitation-actions";

                    const accept =
                        document.createElement("button");

                    accept.type =
                        "button";

                    accept.className =
                        "button button-primary";

                    accept.textContent =
                        "Aceptar";

                    accept.addEventListener(
                        "click",
                        async () => {
                            accept.disabled = true;

                            try {
                                await acceptGroupInvitation(
                                    invitation.id
                                );

                                setCurrentGroup(
                                    invitation.group_id
                                );

                                window.location.reload();
                            } catch (error) {
                                accept.disabled = false;

                                alert(
                                    getSupabaseErrorMessage(
                                        error,
                                        "No se ha podido aceptar la invitación."
                                    )
                                );
                            }
                        }
                    );

                    const reject =
                        document.createElement("button");

                    reject.type =
                        "button";

                    reject.className =
                        "button button-ghost";

                    reject.textContent =
                        "Rechazar";

                    reject.addEventListener(
                        "click",
                        async () => {
                            reject.disabled = true;

                            try {
                                await rejectGroupInvitation(
                                    invitation.id
                                );

                                card.remove();

                                if (
                                    !section.querySelector(
                                        ".invitation-card"
                                    )
                                ) {
                                    section.remove();
                                }
                            } catch (error) {
                                reject.disabled = false;

                                alert(
                                    getSupabaseErrorMessage(
                                        error,
                                        "No se ha podido rechazar la invitación."
                                    )
                                );
                            }
                        }
                    );

                    actions.append(
                        accept,
                        reject
                    );

                    card.append(
                        info,
                        actions
                    );

                    section.appendChild(
                        card
                    );
                }
            );

            invitationsEl.appendChild(
                section
            );
        }
    }

    const profile =
        await getCurrentProfile();

    const welcome =
        document.querySelector(
            ".dashboard-welcome p"
        );

    if (welcome) {
        const name =
            profile?.display_name ||
            profile?.username;

        welcome.textContent =
            name
                ? "Hola, " +
                  name +
                  ". Todo lo que pasa en " +
                  group.name +
                  ", en un mismo sitio."
                : "Todo lo que hacemos juntos, en un mismo sitio.";
    }
});
