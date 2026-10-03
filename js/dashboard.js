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

    const usage = await getGroupUsage(group.id);
    if (usage) {
        const plan = usage.plan || {};
        const current = usage.usage || {};
        const planNameEl = document.getElementById("workspacePlanName");
        if (planNameEl) planNameEl.textContent = plan.name || "Free";

        const setUsage = (labelId, fillId, value, limit) => {
            const label = document.getElementById(labelId);
            const fill = document.getElementById(fillId);
            const currentValue = Number(value || 0);
            const maxValue = Number(limit || 0);
            if (label) label.textContent = maxValue > 0
                ? currentValue + " / " + maxValue
                : String(currentValue);
            if (fill) fill.style.width = (maxValue > 0
                ? Math.min(100, currentValue / maxValue * 100)
                : 0) + "%";
        };

        setUsage("usageMembersLabel","usageMembersFill",current.members,plan.max_members);
        setUsage("usageEventsLabel","usageEventsFill",current.events_this_month,plan.max_events_per_month);
        setUsage("usageTripsLabel","usageTripsFill",current.trips,plan.max_trips);
    }
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

    /* =====================================================
       WORKSPACE START — activación contextual del espacio
       ===================================================== */
    const startList = document.getElementById("workspaceStartList");
    const startProgress = document.getElementById("workspaceStartProgress");
    const startFill = document.getElementById("workspaceStartFill");
    if (startList) {
        const hasMembers = members?.length > 1;
        const hasEvent = events?.length > 0;
        const hasProfile = Boolean(group.onboarding_profile?.completed_at || group.description || group.workspace_type);
        const type = group.workspace_type || "community";
        const type = group.workspace_type || "community";
        const hasTrip = false;
        const contextStep = type === "sports"
            ? { done: hasEvent, title: "Activar competición", text: hasEvent ? "Ya tienes actividad deportiva sobre la que trabajar." : "Crea el primer evento o competición del espacio.", href: "crear.html" }
            : type === "travel"
                ? { done: hasTrip, title: "Planificar el viaje", text: hasTrip ? "Ya hay un viaje en planificación." : "Convierte el destino en un itinerario.", href: "viajes.html" }
                : type === "study"
                    ? { done: hasEvent, title: "Crear sesión de estudio", text: hasEvent ? "Ya tienes una actividad creada." : "Convierte el objetivo en una sesión concreta.", href: "crear-evento.html" }
                    : { done: hasEvent, title: "Crear el primer plan", text: hasEvent ? "Ya existe actividad en el workspace." : "Crea una actividad para empezar.", href: "crear-evento.html" };
        const steps = [
            {done: hasMembers, title: "Invitar al equipo", text: hasMembers ? "Ya hay más de una persona en el workspace." : "Añade a las primeras personas.", href: "miembros.html"},
            contextStep,
            {done: hasProfile, title: "Definir el espacio", text: hasProfile ? "La identidad del workspace está configurada." : "Completa su contexto.", href: "miembros.html"}
        ];
        const done = steps.filter(step => step.done).length;
        startProgress.textContent = done + " / " + steps.length;
        startFill.style.width = Math.round(done / steps.length * 100) + "%";
        startList.innerHTML = steps.map(step => '<a class="workspace-start-item '+(step.done ? 'done' : '')+'" href="'+step.href+'"><span class="workspace-start-check">'+(step.done ? '✓' : '→')+'</span><span class="workspace-start-copy"><strong>'+escapeHtml(step.title)+'</strong><small>'+escapeHtml(step.text)+'</small></span></a>').join("");
    }

    const { data: trips, error: tripsError } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date")
        .eq("group_id", group.id)
        .in("status", ["planning", "confirmed"])
        .order("created_at", { ascending: false });

    if (tripsError) {
        console.error(t("dashboard.tripsLoadError"), tripsError);
    }



    const pulseEventEl = document.getElementById("pulseEvent");
    const pulseMembersEl = document.getElementById("pulseMembers");
    const pulseTripsEl = document.getElementById("pulseTrips");
    const pulseMemoriesEl = document.getElementById("pulseMemories");
    const pulseMessageEl = document.getElementById("pulseMessage");

    if (pulseEventEl) {
        pulseEventEl.textContent = t("dashboard.loading");
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

    /* =====================================================
       ADAPTIVE ACTION HUB — acciones según estado + tipo + plan
       ===================================================== */
    const workspaceState = {
        type: group.workspace_type || "community",
        members: members.length,
        events: events.length,
        openTasks: tasks.filter(task => !task.completed).length,
        planningTrips: (trips || []).filter(trip => trip.status === "planning").length,
        memories: memories.length,
        hasProfile: Boolean(group.onboarding_profile?.completed_at || (group.description && group.description.trim())),
        features: usage?.plan?.features || {}
    };
    const milestoneChecks = workspaceState.type === "sports"
        ? [
            ["personas", workspaceState.members > 1, 25],
            ["actividad", workspaceState.events > 0, 30],
            ["contexto", workspaceState.hasProfile, 15],
            ["organización", tasks.length > 0 && workspaceState.openTasks === 0, 15],
            ["historial", workspaceState.memories > 0, 15]
        ]
        : workspaceState.type === "travel"
            ? [
                ["personas", workspaceState.members > 1, 20],
                ["contexto", workspaceState.hasProfile, 15],
                ["viaje", workspaceState.planningTrips > 0, 35],
                ["actividad", workspaceState.events > 0, 15],
                ["organización", workspaceState.openTasks === 0, 15]
            ]
            : workspaceState.type === "study"
                ? [
                    ["personas", workspaceState.members > 1, 25],
                    ["contexto", workspaceState.hasProfile, 20],
                    ["actividad", workspaceState.events > 0, 30],
                    ["organización", tasks.length > 0 && workspaceState.openTasks === 0, 25]
                ]
                : [
                    ["personas", workspaceState.members > 1, 25],
                    ["actividad", workspaceState.events > 0, 30],
                    ["contexto", workspaceState.hasProfile, 20],
                    ["organización", tasks.length > 0 && workspaceState.openTasks === 0, 15],
                    ["historial", workspaceState.memories > 0, 10]
                ];
    const workspaceActivationScore = milestoneChecks.reduce(
        (score, [, done, weight]) => score + (done ? weight : 0),
        0
    );
    const workspaceDecision = (() => {
        const type = workspaceState.type;
        const featureMap = workspaceState.features || {};
        if (workspaceState.openTasks > 0) return { key:"tasks", href:"eventos.html", icon:"✓", kicker:"ORGANIZACIÓN", title:"Resolver tareas pendientes", reason: workspaceState.openTasks + " tarea" + (workspaceState.openTasks === 1 ? "" : "s") + " todavía requiere" + (workspaceState.openTasks === 1 ? "" : "n") + " atención." };
        if (workspaceState.members <= 1) return { key:"members", href:"miembros.html", icon:"◎", kicker:"EQUIPO", title:"Traer a la primera persona", reason:"Un workspace empieza a cobrar vida cuando deja de depender de una sola persona." };
        if (type === "travel" && featureMap.travel && workspaceState.planningTrips === 0) return { key:"travel", href:"viajes.html", icon:"↗", kicker:"VIAJE", title:"Planificar el próximo viaje", reason:"Destino, opciones e itinerario desde un solo espacio." };
        if (type === "sports" && featureMap.competitions && workspaceState.events === 0) return { key:"sports", href:"crear.html", icon:"◆", kicker:"DEPORTE", title:"Activar la competición", reason:"Crea la actividad deportiva y entra después en su organización." };
        if (type === "study" && workspaceState.events === 0) return { key:"study", href:"crear-evento.html", icon:"→", kicker:"ESTUDIO", title:"Crear la primera sesión", reason:"Convierte el objetivo del workspace en una actividad concreta." };
        if (workspaceState.events === 0) return { key:"event", href:"crear-evento.html", icon:"+", kicker:"ACTIVACIÓN", title:"Crear el primer plan", reason:"Un evento convierte la estructura del workspace en actividad real." };
        return { key:"next", href:"eventos.html", icon:"→", kicker:"PRÓXIMO PASO", title:"Entrar en la organización", reason:"Revisa próximos planes, participantes y tareas." };
    })();
    document.documentElement.dataset.workspaceHealth = workspaceActivationScore >= 80 ? "active" : workspaceActivationScore >= 40 ? "building" : "starting";
    const healthScoreEl = document.getElementById("workspaceHealthScore");
    const healthFillEl = document.getElementById("workspaceHealthFill");
    const healthTitleEl = document.getElementById("workspaceHealthTitle");
    const healthTextEl = document.getElementById("workspaceHealthText");
    const healthMetricsEl = document.getElementById("workspaceHealthMetrics");
    const healthCopy = workspaceActivationScore >= 80
        ? ["Workspace activo.", "La base ya está montada. Ahora toca sacarle rendimiento."]
        : workspaceActivationScore >= 40
            ? ["Workspace en construcción.", "Ya hay actividad; completa los puntos que faltan para convertirlo en un centro operativo."]
            : ["Workspace en activación.", "Empieza por personas, actividad y contexto para que Sense pueda ayudarte mejor."];
    if (healthScoreEl) healthScoreEl.textContent = workspaceActivationScore + "%";
    if (healthFillEl) healthFillEl.style.width = workspaceActivationScore + "%";
    if (healthTitleEl) healthTitleEl.textContent = healthCopy[0];
    if (healthTextEl) healthTextEl.textContent = healthCopy[1];
    if (healthMetricsEl) {
        healthMetricsEl.innerHTML = [
            ["Personas", workspaceState.members],
            ["Actividad", workspaceState.events],
            ["Pendientes", workspaceState.openTasks],
            ["Viajes", workspaceState.planningTrips]
        ].map(([label,value]) => '<div class="workspace-health-metric"><strong>' + escapeHtml(String(value)) + '</strong><span>' + escapeHtml(label) + '</span></div>').join("");
    }


    const workspaceGoal = document.getElementById("workspaceGoal");
    const workspaceGoalTitle = document.getElementById("workspaceGoalTitle");
    const workspaceGoalText = document.getElementById("workspaceGoalText");
    const workspaceGoalAction = document.getElementById("workspaceGoalAction");
    if (workspaceGoal && workspaceGoalTitle && workspaceGoalText && workspaceGoalAction) {
        const goal = workspaceDecision.key === "tasks" || workspaceDecision.key === "members" || workspaceDecision.key === "travel" || workspaceDecision.key === "sports" || workspaceDecision.key === "study" || workspaceDecision.key === "event"
            ? { title: workspaceDecision.title, text: workspaceDecision.reason, href: workspaceDecision.href }
            : workspaceState.memories === 0
                ? { title: "Crear la primera memoria", text: "Cuando el grupo empieza a guardar momentos, el workspace deja de ser solo operativo.", href: "recuerdos.html" }
                : null;
        if (goal) {
            workspaceGoal.hidden = false;
            workspaceGoalTitle.textContent = goal.title;
            workspaceGoalText.textContent = goal.text;
            workspaceGoalAction.href = goal.href;
        } else {
            workspaceGoal.hidden = true;
        }
    }

    const actionGrid = document.getElementById("adaptiveActionGrid");
    const actionHubEyebrow = document.getElementById("actionHubEyebrow");
    const actionHubTitle = document.getElementById("actionHubTitle");
    const actionHubMeta = document.getElementById("actionHubMeta");
    if (actionGrid) {
        const type = group.workspace_type || "community";
        const featureMap = usage?.plan?.features || {};
        const openTasks = tasks?.filter(task => !task.completed).length || 0;
        const planningTrips = (trips || []).filter(trip => trip.status === "planning").length;
        const actionState = (done, active) => done ? "COMPLETADO" : active ? "EN CURSO" : "SIGUIENTE";
        const eventState = events.length > 0;
        const peopleState = members.length > 1;
        const tripState = planningTrips > 0;
        const primary = {
            href: workspaceDecision.href,
            icon: workspaceDecision.icon,
            kicker: workspaceDecision.kicker,
            title: workspaceDecision.title,
            text: workspaceDecision.reason
        };

        if (openTasks > 0) {
            primary.urgent = true;
            primary.baseScore = Math.max(primary.baseScore || 0, 88);
        }
        if (events.length === 0) primary.contextMatch = true;

        const actionPriority = (action) => {
            let score = action.baseScore || 40;
            if (action.urgent) score += 30;
            if (action.contextMatch) score += 20;
            if (action.done) score -= 35;
            return score;
        };

        const actions = [
            { ...primary, baseScore: 95, contextMatch: true },
            {href:"miembros.html", icon:"◎", kicker:actionState(peopleState, false), title:"Gestionar miembros", text:members.length + " integrante" + (members.length === 1 ? "" : "s") + " en el workspace.", baseScore:55, done:peopleState},
            type === "travel" && featureMap.travel
                ? {href:"viajes.html", icon:"✈", kicker:actionState(tripState, tripState), title:"Abrir viajes", text:planningTrips ? planningTrips + " viaje" + (planningTrips === 1 ? "" : "s") + " en planificación." : "Compara opciones y construye itinerarios."}
                : type === "sports" && featureMap.competitions
                    ? {href:"crear.html", icon:"◈", kicker:"COMPETICIÓN", title:"Abrir competición", text:"Crea una actividad deportiva y organiza el flujo desde su evento."}
                    : {href:"decisiones.html", icon:"?", kicker:"DECISIONES", title:"Cerrar una decisión", text:"Convierte las dudas del grupo en decisiones claras."},
            {href:"eventos.html", icon:"□", kicker:actionState(eventState, false), title:"Ver próximos eventos", text:events.length ? events.length + " evento" + (events.length === 1 ? "" : "s") + " registrado" + (events.length === 1 ? "" : "s") + "." : "Todavía no hay eventos.", baseScore:62, done:eventState},
            {href:"recuerdos.html", icon:"◇", kicker:"MEMORIA", title:"Construir historia", text:memories.length ? memories.length + " recuerdo" + (memories.length === 1 ? "" : "s") + " guardado" + (memories.length === 1 ? "" : "s") + "." : "Empieza a guardar momentos del grupo.", baseScore:35},
            {href:"perfil.html", icon:"○", kicker:"IDENTIDAD", title:"Completar tu perfil", text:"Haz que las personas del workspace sepan quién eres.", baseScore:30}
        ];
        const seen = new Set();
        const visible = actions
            .filter(action => {
                const key = action.href + "|" + action.title;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => actionPriority(b) - actionPriority(a))
            .slice(0, 6);
        actionGrid.innerHTML = visible.map((action,index) =>
            '<a class="quick-card ' + (index === 0 ? 'featured' : '') + '" href="' + escapeHtml(action.href) + '">' +
                '<span class="action-hub-kicker">' + escapeHtml(action.kicker) + '</span>' +
                '<div class="quick-icon">' + escapeHtml(action.icon) + '</div>' +
                '<strong>' + escapeHtml(action.title) + '</strong>' +
                '<span>' + escapeHtml(action.text) + '</span>' +
            '</a>'
        ).join("");
        if (actionHubEyebrow) actionHubEyebrow.textContent = type === "sports" ? "CENTRO DEL EQUIPO" : type === "travel" ? "CENTRO DEL VIAJE" : "TU WORKSPACE";
        if (actionHubTitle) actionHubTitle.textContent = "Qué hacer ahora";
        if (actionHubMeta) actionHubMeta.textContent = "Seleccionado según el estado actual del grupo";
    }
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
            ? (next.event.title || t("dashboard.nextEvent"))
            : t("dashboard.noPlans");
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
                ? t("dashboard.tripsInMotion",{count:(trips||[]).length})
                : t("dashboard.noPlanPrompt");
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
                            t("dashboard.locationTbd")
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
                t("dashboard.noUpcoming") +
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
                t("dashboard.ready");

            descriptionEl.textContent =
                t("dashboard.readyText");
        } else if (organization >= 60) {
            statusEl.textContent =
                t("dashboard.onTrack");

            descriptionEl.textContent =
                answered +
                " de " +
                members.length +
                " miembros ya han respondido.";
        } else {
            statusEl.textContent =
                t("dashboard.organizing");

            descriptionEl.textContent =
                t("dashboard.stillOpen");
        }
    } else {
        progressEl.style.width =
            "0%";

        percentEl.textContent =
            "0%";

        statusEl.textContent =
            t("dashboard.allQuiet");

        descriptionEl.textContent =
            t("dashboard.waitingForEvent");
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

        const healthEl = document.getElementById("senseHealthValue");
        const healthFillEl = document.getElementById("senseHealthFill");
        const healthTextEl = document.getElementById("senseHealthText");

        if (serverSense?.health) {
            const health = Math.max(0, Math.min(100, Number(serverSense.health.score || 0)));
            if (healthEl) healthEl.textContent = health + "%";
            if (healthFillEl) healthFillEl.style.width = health + "%";
            if (healthTextEl) healthTextEl.textContent =
                serverSense.health.text ||
                t("dashboard.healthMeasuring");
        }

        if (serverSense) {
            ranked.push({
                score: Number(serverSense.score || 0),
                label: t("dashboard.senseLabel"),
                title: serverSense.action === "attendance"
                    ? t("dashboard.closeAttendance")
                    : serverSense.action === "tasks"
                        ? t("dashboard.resolveTasks")
                        : serverSense.action === "location"
                            ? t("dashboard.defineLocation")
                            : serverSense.action === "decision"
                                ? t("dashboard.resolveDecision")
                                : serverSense.action === "trip"
                                    ? t("dashboard.advanceTrip")
                                    : serverSense.action === "invitation"
                                        ? t("dashboard.answerInvitation")
                                        : t("dashboard.createNextPlan"),
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
        const workspaceType = workspaceState.type;
        const profile = {
            feature: workspaceType === "sports" ? "competitions" : workspaceType === "travel" ? "travel" : "events",
            href: workspaceDecision.href,
            score: workspaceDecision.key === "next" ? 55 : 84,
            label: workspaceDecision.kicker,
            title: workspaceDecision.title,
            reason: workspaceDecision.reason
        };
        const planFeatureEnabled = planFeatures[profile.feature] !== false;
        const contextNeedsAction = workspaceDecision.key !== "next";
        const hasActiveTrip = (trips || []).some(trip => trip.status === "planning");
        const contextNeedsAction = workspaceType === "sports"
            ? !nextEvent
            : workspaceType === "travel"
                ? !hasActiveTrip
                : !nextEvent;
        if (planFeatureEnabled && contextNeedsAction) {
            ranked.push({
                score: profile.score,
                label: profile.label,
                title: profile.title,
                reason: profile.reason,
                href: profile.href,
                icon: workspaceType === "sports" ? "◆" : workspaceType === "travel" ? "↗" : "→"
            });
        }

        const nextEvent = upcoming[0]?.event || null;

        if (!nextEvent) {
            ranked.push({
                score: 100,
                label: t("dashboard.discoveryMode"),
                title: t("dashboard.createNextPlan"),
                reason: t("dashboard.noFutureReason"),
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
                    label: t("dashboard.frictionDetected"),
                    title: t("dashboard.closeAttendanceCount",{count:unanswered}),
                    reason: t("dashboard.attendanceReason",{event:nextEvent.title}),
                    href: "evento.html?id=" + encodeURIComponent(nextEvent.id),
                    icon: "?"
                });
            }

            if (incompleteTasks.length) {
                ranked.push({
                    score: 82 + Math.min(incompleteTasks.length, 10),
                    label: t("dashboard.frictionDetected"),
                    title: t("dashboard.resolveTasksCount",{count:incompleteTasks.length}),
                    reason: t("dashboard.tasksReason"),
                    href: "evento.html?id=" + encodeURIComponent(nextEvent.id),
                    icon: "✓"
                });
            }

            if (!nextEvent.location) {
                ranked.push({
                    score: 78,
                    label: t("dashboard.detailOpen"),
                    title: t("dashboard.decideLocation",{event:nextEvent.title}),
                    reason: t("dashboard.locationReason"),
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
                    label: t("dashboard.planInProgress"),
                    title: t("dashboard.advanceTripsCount",{count:activeTrips.length}),
                    reason: t("dashboard.tripsPlanningReason",{count:activeTrips.length}),
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
                        label: t("dashboard.openDecision"),
                        title: t("dashboard.resolveDecisionsCount",{count:openPolls.length}),
                        reason: t("dashboard.pollReason"),
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
                label: t("dashboard.pendingEntry"),
                title: t("dashboard.answerInvitationsCount",{count:invitations.length}),
                reason: t("dashboard.invitationReason"),
                href: "#dashboardInvitationsSection",
                icon: "✉"
            });
        }

        try {
            if (typeof getSocialActivity === "function") {
                const community = await getSocialActivity();
                if (Array.isArray(community) && community.length) {
                    const latest = community[0];
                    const eventTitle = latest.event_title || t("event.event");
                    ranked.push({
                        score: nextEvent ? 38 : 72,
                        label: t("dashboard.communitySignal"),
                        title: t("dashboard.communityTitle"),
                        reason: t("dashboard.communityReason",{event:eventTitle}),
                        href: latest.event_id ? "evento-publico.html?id=" + encodeURIComponent(latest.event_id) : "explorar.html#socialFeedSection",
                        icon: "↗"
                    });
                }
            }
        } catch (error) {
            console.debug("Curruscos Sense: community signal unavailable", error);
        }

        if (!ranked.length) {
            ranked.push({
                score: 20,
                label: t("dashboard.allFlows"),
                title: t("dashboard.groupUpToDate"),
                reason: t("dashboard.noBlocker"),
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
            signal(t("dashboard.people"), members.length),
            signal(t("dashboard.events"), events.length),
            signal(t("dashboard.openTasks"), tasks.filter(task => !task.completed).length),
            signal(t("dashboard.trips"), (trips || []).length)
        ];

        const secondary = ranked
            .filter(item => item !== top)
            .slice(0, 2)
            .map(item => '<a class="autopilot-signal autopilot-suggestion" href="' +
                escapeHtml(item.href) + '">' +
                escapeHtml(item.title) + ' →</a>');

        const uniqueSignals = [];
        const seenSignalKeys = new Set();
        [...compactSignals.map((html, index) => ({ html, key: "metric-" + index })), ...secondary.map((html, index) => ({ html, key: "suggestion-" + index }))]
            .forEach(item => {
                if (!seenSignalKeys.has(item.key)) {
                    seenSignalKeys.add(item.key);
                    uniqueSignals.push(item.html);
                }
            });
        signalsEl.innerHTML = uniqueSignals.join("");

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
                        t("dashboard.newGroup");

                    const message =
                        document.createElement("p");

                    message.textContent =
                        (
                            invitation.inviter_name ||
                            t("dashboard.someone")
                        ) +
                        t("dashboard.invitedYou");

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
                        t("dashboard.accept");

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
                                        t("dashboard.acceptError")
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
                        t("dashboard.decline");

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
                                        t("dashboard.declineError")
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

    /* =====================================================
       WORKSPACE CONTEXT — personaliza el dashboard según el tipo
       ===================================================== */
    /* Workspace intelligence: el onboarding modifica prioridades visibles */
    const onboarding = group.onboarding_profile || {};
    const objective = String(onboarding.objective || "").trim();
    const groupSize = onboarding.size || "";
    const contextSignals = document.getElementById("autopilotSignals");
    if (contextSignals && (objective || groupSize)) {
        const contextPill = '<span class="autopilot-signal"><strong>Contexto</strong>' + escapeHtml(objective || groupSize) + '</span>';
        contextSignals.insertAdjacentHTML("afterbegin", contextPill);
    }

    const planFeatures = (await getGroupPlanAccess(group.id))?.plan?.features || {};
    const featureHints = document.getElementById("autopilotSignals");
    if (featureHints) {
        const enabled = Object.entries(planFeatures).filter(([,v]) => v === true).map(([k]) => k.replaceAll("_"," "));
        if (enabled.length) {
            const planPill = '<span class="autopilot-signal"><strong>Herramientas</strong>' + escapeHtml(enabled.slice(0,3).join(" · ")) + '</span>';
            featureHints.insertAdjacentHTML("beforeend", planPill);
        }
    }

    const workspaceType = group.workspace_type || "community";
    const workspaceTitle = document.querySelector(".dashboard-welcome h1");
    const workspaceEyebrow = document.querySelector(".dashboard-welcome .dashboard-eyebrow");
    const senseCard = document.querySelector(".autopilot-card");
    const contextMap = {
        sports: {eyebrow:"CURRUSCOS · EQUIPO", title:"El equipo, en movimiento.", pulse:"El siguiente partido, entrenamiento o plan.", quick:"Organizar competición"},
        travel: {eyebrow:"CURRUSCOS · VIAJES", title:"El próximo destino empieza aquí.", pulse:"Todo el viaje, en un mismo espacio.", quick:"Planificar viaje"},
        study: {eyebrow:"CURRUSCOS · ESTUDIO", title:"Organizad. Avanzad. Repetid.", pulse:"Lo que toca preparar a continuación.", quick:"Crear sesión"},
        organization: {eyebrow:"CURRUSCOS · ORGANIZACIÓN", title:"La organización, en movimiento.", pulse:"Las próximas acciones del equipo.", quick:"Crear evento"},
        community: {eyebrow:"CURRUSCOS · COMUNIDAD", title:"Lo que hacemos juntos.", pulse:"Lo que está pasando en el grupo.", quick:"Crear plan"},
        other: {eyebrow:"CURRUSCOS · WORKSPACE", title:"El espacio, en movimiento.", pulse:"Lo que está pasando ahora.", quick:"Crear evento"}
    };
    const context = contextMap[workspaceType] || contextMap.community;
    if (workspaceEyebrow) workspaceEyebrow.textContent = context.eyebrow;
    if (workspaceTitle) workspaceTitle.innerHTML = escapeHtml(context.title).replace(" ", " ");
    const pulseTitle = document.querySelector(".pulse-heading h2");
    if (pulseTitle) pulseTitle.textContent = context.pulse;
    if (senseCard) senseCard.dataset.workspaceType = workspaceType;

    const quickLink = document.querySelector(".pulse-link");
    if (quickLink) {
        if (workspaceType === "travel") {
            quickLink.href = "viajes.html";
            quickLink.textContent = context.quick + " →";
        } else if (workspaceType === "sports") {
            quickLink.href = "crear.html";
            quickLink.textContent = context.quick + " →";
        } else {
            quickLink.href = "crear-evento.html";
            quickLink.textContent = context.quick + " →";
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
                : t("dashboard.defaultWelcome");
    }
});
