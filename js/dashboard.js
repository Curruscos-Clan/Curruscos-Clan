/* =========================================================
   CURRUSCOS — DASHBOARD
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
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
