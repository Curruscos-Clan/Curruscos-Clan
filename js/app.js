/* =========================================================
   CURRUSCOS — APP SHELL
   Navegación, seguridad de páginas privadas, grupos,
   notificaciones y comportamiento compartido.
   ========================================================= */

const AUTH_ONLY_PAGES = new Set([
    "mis-eventos.html",
    "guardados.html",
    "notificaciones.html",
    "chat.html",
    "mis-equipos.html"
]);

const PRIVATE_PAGES = new Set([
    "dashboard.html",
    "miembros.html",
    "historia.html",
    "recuerdos.html",
    "eventos.html",
    "evento.html",
    "viajes.html",
    "decisiones.html",
    "perfil.html",
    "planes.html",
    "gestion-planes.html"
]);

let resolveCurruscosReady;
window.curruscosReady = new Promise(resolve => {
    resolveCurruscosReady = resolve;
});
window.CURRUSCOS_SHELL_READY = false;

/* =========================================================
   UTILIDADES
   ========================================================= */

function getCurrentPage() {
    const file = window.location.pathname
        .split("/")
        .pop();

    return file || "index.html";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   CONTEXTO DEL WORKSPACE — fuente única para toda la app
   ========================================================= */

function buildWorkspaceCapabilities(group, usage = null) {
    const type = group?.workspace_type || "community";
    const planFeatures = usage?.plan?.features || group?.features || {};

    return {
        collaboration: true,
        events: Object.prototype.hasOwnProperty.call(planFeatures, "events") ? Boolean(planFeatures.events) : true,
        memories: Object.prototype.hasOwnProperty.call(planFeatures, "memories") ? Boolean(planFeatures.memories) : true,
        decisions: Object.prototype.hasOwnProperty.call(planFeatures, "decisions") ? Boolean(planFeatures.decisions) : true,
        travel: Boolean(planFeatures.travel || type === "travel"),
        competitions: Boolean(planFeatures.competitions || type === "sports"),
        tasks: Object.prototype.hasOwnProperty.call(planFeatures, "tasks") ? Boolean(planFeatures.tasks) : true,
        history: Object.prototype.hasOwnProperty.call(planFeatures, "history") ? Boolean(planFeatures.history) : true,
        study: Boolean(planFeatures.study || type === "study"),
        workspaceType: type
    };
}

function workspaceHasCapability(name) {
    return Boolean(
        window.curruscosWorkspace?.capabilities?.[name]
    );
}

function workspaceIsType(type) {
    return (
        window.curruscosWorkspace?.type === type
    );
}

function workspaceCanManage() {
    return Boolean(window.curruscosWorkspace?.canManage);
}

function roleLabel(role) {
    switch (role) {
        case "owner":
            return t("roles.owner");
        case "admin":
            return t("roles.admin");
        default:
            return t("roles.member");
    }
}

function formatDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(getLanguage(), {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function getEventDate(event) {
    if (!event?.date) {
        return null;
    }

    const time = event.time || "00:00";

    const date = new Date(
        event.date + "T" + time
    );

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function formatEventDate(event, options = {}) {
    const date = getEventDate(event);

    if (!date) {
        return t("date.undefined");
    }

    return date.toLocaleDateString(
        "es-ES",
        {
            weekday: options.weekday ? "long" : undefined,
            day: "numeric",
            month: options.month || "long",
            year: options.year ? "numeric" : undefined
        }
    );
}

function formatEventTime(event) {
    return event?.time ? event.time : t("time.undefined");
}

/* =========================================================
   SEGURIDAD DE PÁGINAS PRIVADAS
   ========================================================= */

async function requireAuthPage() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.replace("login.html");
        return null;
    }
    return { user };
}

async function requirePrivatePage() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.replace("login.html");
        return null;
    }

    const groups = await getUserGroups();

    if (!groups.length) {
        window.location.replace("onboarding.html");
        return null;
    }

    const currentGroup = await getCurrentGroup();

    if (!currentGroup) {
        window.location.replace("onboarding.html");
        return null;
    }

    return {
        user,
        groups,
        currentGroup
    };
}

/* =========================================================
   MENÚ MÓVIL
   ========================================================= */

function setupMobileMenu() {
    const menuButton =
        document.getElementById("menuButton");

    const nav =
        document.getElementById("mainNav");

    if (!menuButton || !nav) {
        return;
    }

    if (menuButton.dataset.ready === "true") {
        return;
    }

    menuButton.dataset.ready = "true";
    menuButton.setAttribute("aria-expanded", "false");

    menuButton.addEventListener("click", event => {
        event.stopPropagation();

        const open =
            nav.classList.toggle("mobile-open");

        menuButton.setAttribute(
            "aria-expanded",
            String(open)
        );
    });

    document.addEventListener("click", event => {
        if (
            !nav.contains(event.target) &&
            event.target !== menuButton
        ) {
            nav.classList.remove("mobile-open");
            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
}

/* =========================================================
   SELECTOR DE GRUPO
   ========================================================= */

function createGroupSelectorMarkup() {
    const wrapper =
        document.createElement("div");

    wrapper.className = "group-selector";

    wrapper.innerHTML =
        '<button type="button" class="current-group-button" id="currentGroupButton">' +
            '<span class="group-current-copy"><span id="currentGroupName">Grupo</span><small id="currentGroupType">WORKSPACE</small></span>' +
            '<span class="group-selector-arrow">▾</span>' +
        '</button>' +
        '<div id="groupMenu" class="group-menu" hidden>' +
            '<div id="groupList" class="group-list"></div>' +
            '<div class="group-menu-divider"></div>' +
            '<button type="button" id="createGroupButton" class="create-group-button">＋ Crear un grupo</button>' +
        '</div>';

    return wrapper;
}

function ensureGroupSelector() {
    const navbar =
        document.querySelector(".navbar");

    if (!navbar) {
        return null;
    }

    let button =
        document.getElementById("currentGroupButton");

    if (button) {
        return {
            button,
            name: document.getElementById("currentGroupName"),
            type: document.getElementById("currentGroupType"),
            menu: document.getElementById("groupMenu"),
            list: document.getElementById("groupList"),
            create: document.getElementById("createGroupButton")
        };
    }

    let brandGroup =
        navbar.querySelector(".brand-group");

    const logo =
        navbar.querySelector(".logo");

    if (!brandGroup) {
        brandGroup =
            document.createElement("div");

        brandGroup.className =
            "brand-group";

        navbar.insertBefore(
            brandGroup,
            navbar.querySelector("#mainNav")
        );

        if (logo) {
            brandGroup.appendChild(logo);
        }
    }

    const selector =
        createGroupSelectorMarkup();

    brandGroup.appendChild(selector);

    return {
        button:
            selector.querySelector("#currentGroupButton"),
        name:
            selector.querySelector("#currentGroupName"),
        type:
            selector.querySelector("#currentGroupType"),
        menu:
            selector.querySelector("#groupMenu"),
        list:
            selector.querySelector("#groupList"),
        create:
            selector.querySelector("#createGroupButton")
    };
}

async function initGroupSelector(access) {
    const selector =
        ensureGroupSelector();

    if (!selector) {
        return;
    }

    const {
        button,
        name,
        menu,
        list,
        create
    } = selector;

    name.textContent =
        access.currentGroup.name || t("group.group");

    const workspaceTypeLabels = {
        community: "COMUNIDAD",
        sports: "DEPORTE",
        travel: "VIAJE",
        study: "ESTUDIO",
        organization: "ORGANIZACIÓN",
        other: "WORKSPACE"
    };
    if (selector.type) {
        selector.type.textContent = workspaceTypeLabels[access.currentGroup.workspace_type || "community"] || "WORKSPACE";
    }

    const planBadge =
        selector.button.querySelector(".group-plan-badge") ||
        document.createElement("span");
    planBadge.className = "group-plan-badge";
    planBadge.textContent =
        access.currentGroup.plan_name || t("group.planFree");
    if (!planBadge.parentElement) {
        selector.button.appendChild(planBadge);
    }

    list.innerHTML = "";

    access.groups.forEach(group => {
        const option =
            document.createElement("button");

        option.type = "button";
        option.className = "group-option";

        if (group.id === access.currentGroup.id) {
            option.classList.add("active");
        }

        const strong =
            document.createElement("strong");

        strong.textContent =
            group.name || t("group.group");

        const span =
            document.createElement("span");

        span.textContent =
            roleLabel(group.role);

        option.appendChild(strong);
        option.appendChild(span);

        const type = document.createElement("small");
        type.className = "group-option-type";
        type.textContent = workspaceTypeLabels[group.workspace_type || "community"] || "WORKSPACE";
        option.appendChild(type);

        const plan =
            document.createElement("em");
        plan.className = "group-option-plan";
        plan.textContent =
            group.plan_name || t("group.planFree");
        option.appendChild(plan);

        option.addEventListener(
            "click",
            () => {
                if (group.id === access.currentGroup.id) {
                    menu.hidden = true;
                    return;
                }

                setCurrentGroup(group.id);
                window.location.reload();
            }
        );

        list.appendChild(option);
    });

    button.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            menu.hidden = !menu.hidden;
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                !menu.contains(event.target) &&
                event.target !== button
            ) {
                menu.hidden = true;
            }
        }
    );

    create.addEventListener(
        "click",
        async event => {
            event.stopPropagation();

            const name =
                prompt(t("group.namePrompt"));

            if (!name || !name.trim()) {
                return;
            }

            const description =
                prompt(
                    t("group.descriptionPrompt")
                );

            create.disabled = true;
            const previous =
                create.textContent;

            create.textContent =
                t("common.creating");

            const newGroup =
                await createGroup(
                    name.trim(),
                    description?.trim() || null
                );

            create.disabled = false;
            create.textContent = previous;

            if (!newGroup) {
                alert(
                    "No se ha podido crear el grupo."
                );
                return;
            }

            setCurrentGroup(newGroup.id);
            window.location.reload();
        }
    );
}

/* =========================================================
   NOTIFICACIONES
   ========================================================= */

async function updateSavedNavigation(userId){
    const links=[...document.querySelectorAll('a[href="guardados.html"]')];
    if(!links.length||!userId)return;
    const {count,error}=await supabaseClient.from("saved_events").select("*",{count:"exact",head:true}).eq("user_id",userId);
    if(error)return;
    links.forEach(link=>{
        let badge=link.querySelector(".nav-badge");
        if(!badge){badge=document.createElement("span");badge.className="nav-badge";link.appendChild(badge);}
        badge.textContent=count>99?"99+":String(count);
        badge.hidden=!count;
    });
}

function notificationIcon(type) {
    switch (type) {
        case "event":
            return "📅";
        case "task":
            return "✅";
        case "expense":
            return "💰";
        case "participant":
            return "👥";
        case "memory":
            return "📸";
        case "history":
            return "📖";
        case "invitation":
            return "✉️";
        case "member":
            return "👤";
        case "social":
            return "↗";
        default:
            return "🔔";
    }
}

function notificationDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date =
        new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(
        "es-ES",
        {
            day: "numeric",
            month: "short"
        }
    );
}

function notificationTarget(notification) {
    if (
        notification.type === "invitation"
    ) {
        return "miembros.html#invitaciones";
    }

    if (
        [
            "event",
            "task",
            "expense",
            "participant"
        ].includes(notification.type)
        && notification.reference_id
    ) {
        return "evento.html?id=" +
            encodeURIComponent(
                notification.reference_id
            );
    }

    if (notification.type === "memory") {
        return "recuerdos.html";
    }

    if (notification.type === "history") {
        return "historia.html";
    }

    if (notification.type === "member") {
        return "miembros.html";
    }

    if (notification.type === "social" && notification.reference_id) {
        return "perfil-publico.html?id=" + encodeURIComponent(notification.reference_id);
    }

    return null;
}

function createNotificationMarkup() {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "notification-wrapper";

    wrapper.innerHTML =
        '<button id="notificationButton" class="notification-button" type="button" aria-label="Notificaciones">' +
            '🔔' +
            '<span id="notificationBadge" class="notification-badge" hidden>0</span>' +
        '</button>' +
        '<div id="notificationPanel" class="notification-panel" hidden>' +
            '<div class="notification-header">' +
                '<strong>Notificaciones</strong>' +
                '<button id="markAllNotificationsButton" class="mark-all-notifications" type="button">Marcar como leídas</button>' +
            '</div>' +
            '<div id="notificationList" class="notification-list"></div>' +
        '</div>';

    return wrapper;
}

function ensureNotificationCenter() {
    const navbar =
        document.querySelector(".navbar");

    if (!navbar) {
        return null;
    }

    let wrapper =
        navbar.querySelector(".notification-wrapper");

    if (wrapper) {
        return {
            wrapper,
            button:
                document.getElementById("notificationButton"),
            badge:
                document.getElementById("notificationBadge"),
            panel:
                document.getElementById("notificationPanel"),
            list:
                document.getElementById("notificationList"),
            markAll:
                document.getElementById("markAllNotificationsButton")
        };
    }

    wrapper =
        createNotificationMarkup();

    const nav =
        navbar.querySelector("#mainNav");

    navbar.insertBefore(wrapper, nav);

    return {
        wrapper,
        button:
            wrapper.querySelector("#notificationButton"),
        badge:
            wrapper.querySelector("#notificationBadge"),
        panel:
            wrapper.querySelector("#notificationPanel"),
        list:
            wrapper.querySelector("#notificationList"),
        markAll:
            wrapper.querySelector("#markAllNotificationsButton")
    };
}

async function renderGlobalNotifications(
    refs
) {
    const notifications =
        await getUserNotifications();

    const unread =
        notifications.filter(
            notification =>
                !notification.is_read
        ).length;

    refs.badge.hidden =
        unread === 0;

    refs.badge.textContent =
        unread > 99
            ? "99+"
            : String(unread);

    refs.list.innerHTML = "";

    if (!notifications.length) {
        refs.list.innerHTML =
            '<div class="empty-notifications">No tienes notificaciones todavía.</div>';
        return;
    }

    notifications.forEach(
        notification => {
            const item =
                document.createElement("button");

            item.type = "button";
            item.className =
                "notification-item" +
                (
                    notification.is_read
                        ? ""
                        : " unread"
                );

            const icon =
                document.createElement("div");

            icon.className =
                "notification-item-icon";

            icon.textContent =
                notificationIcon(
                    notification.type
                );

            const content =
                document.createElement("div");

            content.className =
                "notification-item-content";

            const title =
                document.createElement("strong");

            title.textContent =
                notification.title || "Notificación";

            const message =
                document.createElement("p");

            message.textContent =
                notification.message || "";

            const date =
                document.createElement("span");

            date.textContent =
                notificationDate(
                    notification.created_at
                );

            content.append(
                title,
                message,
                date
            );

            item.append(
                icon,
                content
            );

            item.addEventListener(
                "click",
                async () => {
                    if (!notification.is_read) {
                        await markNotificationAsRead(
                            notification.id
                        );
                    }

                    const target =
                        notificationTarget(
                            notification
                        );

                    if (target) {
                        window.location.assign(
                            target
                        );
                    } else {
                        await renderGlobalNotifications(
                            refs
                        );
                    }
                }
            );

            refs.list.appendChild(item);
        }
    );
}

async function initNotificationCenter() {
    const refs =
        ensureNotificationCenter();

    if (!refs || refs.button.dataset.ready) {
        return;
    }

    refs.button.dataset.ready =
        "true";

    refs.button.addEventListener(
        "click",
        async event => {
            event.stopPropagation();

            refs.panel.hidden =
                !refs.panel.hidden;

            if (!refs.panel.hidden) {
                await renderGlobalNotifications(
                    refs
                );
            }
        }
    );

    refs.panel.addEventListener(
        "click",
        event => {
            event.stopPropagation();
        }
    );

    document.addEventListener(
        "click",
        () => {
            refs.panel.hidden = true;
        }
    );

    refs.markAll.addEventListener(
        "click",
        async event => {
            event.stopPropagation();

            await markAllNotificationsAsRead();

            await renderGlobalNotifications(
                refs
            );
        }
    );

    window.addEventListener(
        "curruscos:new-notification",
        async () => {
            await renderGlobalNotifications(
                refs
            );
        }
    );

    await startNotificationRealtime();
    await renderGlobalNotifications(refs);
}

/* =========================================================
   CUENTA
   ========================================================= */

function createAccountMenu() {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "account-wrapper";

    wrapper.innerHTML =
        '<button id="accountButton" class="account-button" type="button" aria-label="Cuenta">' +
            '<span id="accountInitial" class="account-initial">C</span>' +
            '<span id="accountName" class="account-name">Cuenta</span>' +
        '</button>' +
        '<div id="accountPanel" class="account-panel" hidden>' +
            '<div class="account-summary">' +
                '<strong id="accountDisplayName">Cuenta</strong>' +
                '<span id="accountUsername"></span>' +
            '</div>' +
            '<a href="perfil.html" class="account-link">Mi perfil</a>' +
            '<button id="signOutButton" class="account-logout" type="button">Cerrar sesión</button>' +
        '</div>';

    return wrapper;
}

async function initAccountMenu() {
    const navbar =
        document.querySelector(".navbar");

    if (!navbar) {
        return;
    }

    let wrapper =
        navbar.querySelector(".account-wrapper");

    if (!wrapper) {
        wrapper = createAccountMenu();

        const menuButton =
            navbar.querySelector("#menuButton");

        navbar.insertBefore(
            wrapper,
            menuButton || null
        );
    }

    const button =
        wrapper.querySelector("#accountButton");

    const panel =
        wrapper.querySelector("#accountPanel");

    if (!button || button.dataset.ready) {
        return;
    }

    button.dataset.ready = "true";

    const profile =
        await getCurrentProfile();

    const name =
        profile?.display_name ||
        profile?.username ||
        "Cuenta";

    const username =
        profile?.username
            ? "@" + profile.username
            : "";

    wrapper.querySelector(
        "#accountName"
    ).textContent = name;

    wrapper.querySelector(
        "#accountDisplayName"
    ).textContent = name;

    wrapper.querySelector(
        "#accountUsername"
    ).textContent = username;

    wrapper.querySelector(
        "#accountInitial"
    ).textContent =
        name.charAt(0).toUpperCase();

    button.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            panel.hidden = !panel.hidden;
        }
    );

    panel.addEventListener(
        "click",
        event => event.stopPropagation()
    );

    document.addEventListener(
        "click",
        () => {
            panel.hidden = true;
        }
    );

    const logout =
        wrapper.querySelector("#signOutButton");

    logout.addEventListener(
        "click",
        async () => {
            logout.disabled = true;
            logout.textContent = "Cerrando...";

            const success =
                await signOut();

            if (success) {
                window.location.replace(
                    "login.html"
                );
            } else {
                logout.disabled = false;
                logout.textContent =
                    "Cerrar sesión";
                alert(
                    "No se ha podido cerrar la sesión."
                );
            }
        }
    );
}

/* =========================================================
   SHELL PRIVADO
   ========================================================= */

function ensureProductNavigation() {
    const nav = document.getElementById("mainNav");

    if (!nav) {
        return;
    }

    const links = [
        { href: "explorar.html", text: "Explorar" },
        { href: "crear.html", text: "Crear" },
        { href: "mis-eventos.html", text: "Mis eventos" },
        { href: "decisiones.html", text: "Decisiones" }
    ];

    links.forEach(item => {
        if (nav.querySelector('a[href="' + item.href + '"]')) {
            return;
        }

        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.text;

        if (getCurrentPage() === item.href) {
            link.classList.add("active");
        }

        nav.appendChild(link);
    });
}

async function initPrivateShell(access) {
    await initGroupSelector(access);
    await initNotificationCenter();
    await initAccountMenu();
    ensureProductNavigation();
}

/* =========================================================
   EVENTOS
   ========================================================= */

async function loadEvents() {
    const container = document.getElementById("eventsList");
    if (!container) return;

    const user = await getCurrentUser();
    const group = await getCurrentGroup();
    const events = await getGroupEvents();

    let filter = "upcoming";
    let query = "";

    const search = document.getElementById("eventsSearch");
    const meta = document.getElementById("eventsResultsMeta");
    const filters = document.querySelectorAll("[data-event-filter]");

    const dateOf = event => getEventDate(event)?.getTime() || 0;
    const now = Date.now();

    const render = () => {
        const normalized = query.trim().toLowerCase();

        const visible = events
            .filter(event => {
                const timestamp = dateOf(event);
                const isPast = timestamp > 0 && timestamp < now;

                if (filter === "upcoming" && isPast) return false;
                if (filter === "past" && !isPast) return false;

                if (normalized) {
                    const haystack = [
                        event.title,
                        event.location,
                        event.description
                    ].filter(Boolean).join(" ").toLowerCase();

                    if (!haystack.includes(normalized)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const da = dateOf(a);
                const db = dateOf(b);
                return filter === "past" ? db - da : da - db;
            });

        filters.forEach(button => {
            const active = button.dataset.eventFilter === filter;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        if (meta) {
            meta.textContent = visible.length
                ? visible.length + (visible.length === 1 ? " evento" : " eventos")
                : "Ningún evento coincide con la búsqueda.";
        }

        container.innerHTML = "";

        if (!visible.length) {
            container.innerHTML =
                '<div class="empty-state"><h3>' +
                (normalized || filter !== "upcoming"
                    ? "No encontramos eventos con estos filtros."
                    : "No hay próximos eventos todavía.") +
                '</h3><p>' +
                (normalized
                    ? "Prueba con otro nombre o lugar."
                    : filter === "past"
                        ? "Los eventos anteriores aparecerán aquí."
                        : "Cread el primer plan del grupo.") +
                '</p></div>';
            return;
        }

        visible.forEach(event => {
            const card = document.createElement("article");
            card.className = "event-card";

            const date = getEventDate(event);
            const isPast = date && date.getTime() < now;
            if (isPast) card.classList.add("past");

            const body = document.createElement("div");
            body.className = "event-card-body";

            const eyebrow = document.createElement("span");
            eyebrow.className = "event-card-date";
            eyebrow.textContent = formatEventDate(event, { weekday: true });

            const title = document.createElement("h3");
            title.textContent = event.title || "Sin título";

            const metaEl = document.createElement("p");
            metaEl.textContent =
                (event.location ? "📍 " + event.location : "") +
                (event.time ? " · " + event.time : "");

            body.append(eyebrow, title, metaEl);

            const actions = document.createElement("div");
            actions.className = "event-card-actions";

            const view = document.createElement("a");
            view.href = "evento.html?id=" + encodeURIComponent(event.id);
            view.className = "button button-secondary";
            view.textContent = "Ver evento →";
            actions.appendChild(view);

            const canDelete = group && user && (
                group.role === "owner" ||
                group.role === "admin" ||
                event.created_by === user.id
            );

            if (canDelete) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "button button-ghost event-delete-button";
                remove.textContent = "Eliminar";

                remove.addEventListener("click", async () => {
                    if (!confirm('¿Eliminar el evento "' + (event.title || "Sin título") + '"?')) {
                        return;
                    }

                    remove.disabled = true;

                    const deleted = await deleteGroupEvent(event.id);

                    if (!deleted) {
                        remove.disabled = false;
                        alert("No se ha podido eliminar el evento.");
                        return;
                    }

                    const index = events.findIndex(item => String(item.id) === String(event.id));
                    if (index >= 0) events.splice(index, 1);
                    render();
                });

                actions.appendChild(remove);
            }

            card.append(body, actions);
            container.appendChild(card);
        });
    };

    filters.forEach(button => {
        button.addEventListener("click", () => {
            filter = button.dataset.eventFilter || "upcoming";
            render();
        });
    });

    if (search) {
        search.addEventListener("input", () => {
            query = search.value;
            render();
        });
    }

    render();
}

async function setupEventForm() {
    const form =
        document.getElementById("eventForm");

    if (!form || form.dataset.ready) {
        return;
    }

    form.dataset.ready = "true";

    const tripSelect =
        document.getElementById("eventTrip");

    if (tripSelect) {
        const trips = await getGroupTripsForEvent();

        trips.forEach(trip => {
            const option = document.createElement("option");
            option.value = trip.id;
            option.textContent =
                trip.destination
                    ? trip.title + " · " + trip.destination
                    : trip.title;
            tripSelect.appendChild(option);
        });
    }

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            const data = {
                title:
                    document.getElementById(
                        "eventTitle"
                    ).value.trim(),

                date:
                    document.getElementById(
                        "eventDate"
                    ).value,

                time:
                    document.getElementById(
                        "eventTime"
                    ).value,

                location:
                    document.getElementById(
                        "eventLocation"
                    ).value.trim(),

                description:
                    document.getElementById(
                        "eventDescription"
                    ).value.trim(),

                trip_id:
                    document.getElementById(
                        "eventTrip"
                    )?.value || null
            };

            if (
                !data.title ||
                !data.date ||
                !data.time ||
                !data.location
            ) {
                return;
            }

            button.disabled = true;
            button.textContent =
                "Creando...";

            try {
                const created =
                    await createGroupEvent(
                        data
                    );

                if (!created) {
                    throw new Error(
                        "No se ha podido crear el evento."
                    );
                }

                form.reset();

                window.location.assign(
                    "evento.html?id=" +
                    encodeURIComponent(
                        created.id
                    )
                );
            } catch (error) {
                button.disabled = false;
                button.textContent =
                    "Crear evento";

                alert(
                    getSupabaseErrorMessage(
                        error,
                        "No se ha podido crear el evento."
                    )
                );
            }
        }
    );
}

/* =========================================================
   ARRANQUE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        setupMobileMenu();

        const page =
            getCurrentPage();

        const protectedPage = PRIVATE_PAGES.has(page) || AUTH_ONLY_PAGES.has(page);

        if (!protectedPage) {
            resolveCurruscosReady(null);
            return;
        }

        const access = AUTH_ONLY_PAGES.has(page)
            ? await requireAuthPage()
            : await requirePrivatePage();

        if (!access) {
            resolveCurruscosReady(null);
            return;
        }

        window.curruscosCurrentAccess = access;

        const workspaceUsage = await getGroupUsage(access.currentGroup.id);

        window.curruscosWorkspace = {
            id: access.currentGroup.id,
            type: access.currentGroup.workspace_type || "community",
            role: access.currentGroup.role || "member",
            plan: workspaceUsage?.plan?.name || access.currentGroup.plan_name || "Free",
            features: workspaceUsage?.plan?.features || access.currentGroup.features || {},
            capabilities: buildWorkspaceCapabilities(access.currentGroup, workspaceUsage),
            canManage: access.currentGroup.role === "owner" || access.currentGroup.role === "admin"
        };

        document.body.dataset.workspaceType = window.curruscosWorkspace.type;
        document.body.dataset.workspaceRole = window.curruscosWorkspace.role;
        document.body.dataset.workspacePlan = window.curruscosWorkspace.plan;

        if (!AUTH_ONLY_PAGES.has(page)) {
            await initPrivateShell(access);
        }
        await updateSavedNavigation(access.user.id);

        if (page === "eventos.html") {
            if (!workspaceHasCapability("events")) {
                const form = document.getElementById("eventForm");
                if (form) {
                    form.hidden = true;
                }
                const message = document.createElement("div");
                message.className = "workspace-capability-message";
                message.innerHTML =
                    "<strong>Organización de eventos no disponible</strong>" +
                    "<p>Esta función no está activa en el workspace actual.</p>";
                const target = document.querySelector("main") || document.body;
                target.prepend(message);
            } else {
                await loadEvents();
                setupEventForm();
            }
        }

        window.CURRUSCOS_SHELL_READY =
            true;

        resolveCurruscosReady(access);
    }
);
