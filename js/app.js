/* =========================================================
   CURRUSCOS — APP SHELL
   Navegación, seguridad de páginas privadas, grupos,
   notificaciones y comportamiento compartido.
   ========================================================= */

const PRIVATE_PAGES = new Set([
    "dashboard.html",
    "miembros.html",
    "historia.html",
    "recuerdos.html",
    "eventos.html",
    "evento.html",
    "viajes.html",
    "decisiones.html",
    "perfil.html"
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

function roleLabel(role) {
    switch (role) {
        case "owner":
            return "Propietario";
        case "admin":
            return "Administrador";
        default:
            return "Miembro";
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

    return date.toLocaleDateString("es-ES", {
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
        return "Fecha sin definir";
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
    return event?.time ? event.time : "Hora sin definir";
}

/* =========================================================
   SEGURIDAD DE PÁGINAS PRIVADAS
   ========================================================= */

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
            nav.classList.remove("open");
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
            '<span id="currentGroupName">Grupo</span>' +
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
        access.currentGroup.name || "Grupo";

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
            group.name || "Grupo";

        const span =
            document.createElement("span");

        span.textContent =
            roleLabel(group.role);

        option.appendChild(strong);
        option.appendChild(span);

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
                prompt("Nombre del nuevo grupo:");

            if (!name || !name.trim()) {
                return;
            }

            const description =
                prompt(
                    "Descripción del grupo (opcional):"
                );

            create.disabled = true;
            const previous =
                create.textContent;

            create.textContent =
                "Creando...";

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

    if (!nav || nav.querySelector('a[href="decisiones.html"]')) {
        return;
    }

    const link = document.createElement("a");
    link.href = "decisiones.html";
    link.textContent = "Decisiones";

    if (getCurrentPage() === "decisiones.html") {
        link.classList.add("active");
    }

    nav.appendChild(link);
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
    const container =
        document.getElementById("eventsList");

    if (!container) {
        return;
    }

    const user =
        await getCurrentUser();

    const group =
        await getCurrentGroup();

    const events =
        await getGroupEvents();

    const sorted =
        [...events].sort((a, b) => {
            const da = getEventDate(a)?.getTime() || 0;
            const db = getEventDate(b)?.getTime() || 0;
            return da - db;
        });

    container.innerHTML = "";

    if (!sorted.length) {
        container.innerHTML =
            '<div class="empty-state"><h3>No hay eventos todavía.</h3><p>Cread el primer plan del grupo.</p></div>';
        return;
    }

    sorted.forEach(event => {
        const card =
            document.createElement("article");

        card.className =
            "event-card";

        const date =
            getEventDate(event);

        const isPast =
            date &&
            date < new Date();

        if (isPast) {
            card.classList.add("past");
        }

        const body =
            document.createElement("div");

        body.className =
            "event-card-body";

        const eyebrow =
            document.createElement("span");

        eyebrow.className =
            "event-card-date";

        eyebrow.textContent =
            formatEventDate(event, {
                weekday: true
            });

        const title =
            document.createElement("h3");

        title.textContent =
            event.title || "Sin título";

        const meta =
            document.createElement("p");

        const location =
            event.location
                ? "📍 " + event.location
                : "";

        const time =
            event.time
                ? " · " + event.time
                : "";

        meta.textContent =
            location + time;

        body.append(
            eyebrow,
            title,
            meta
        );

        const actions =
            document.createElement("div");

        actions.className =
            "event-card-actions";

        const view =
            document.createElement("a");

        view.href =
            "evento.html?id=" +
            encodeURIComponent(event.id);

        view.className =
            "button button-secondary";

        view.textContent =
            "Ver evento →";

        actions.appendChild(view);

        const canDelete =
            group &&
            user &&
            (
                group.role === "owner" ||
                group.role === "admin" ||
                event.created_by === user.id
            );

        if (canDelete) {
            const remove =
                document.createElement("button");

            remove.type = "button";
            remove.className =
                "button button-ghost event-delete-button";
            remove.textContent =
                "Eliminar";

            remove.addEventListener(
                "click",
                async () => {
                    const ok =
                        confirm(
                            '¿Eliminar el evento "' +
                            (event.title || "Sin título") +
                            '"?'
                        );

                    if (!ok) {
                        return;
                    }

                    remove.disabled = true;

                    try {
                        await deleteGroupEvent(
                            event.id
                        );

                        card.remove();
                    } catch (error) {
                        remove.disabled = false;
                        alert(
                            getSupabaseErrorMessage(
                                error,
                                "No se ha podido eliminar el evento."
                            )
                        );
                    }
                }
            );

            actions.appendChild(remove);
        }

        card.append(
            body,
            actions
        );

        container.appendChild(card);
    });
}

function setupEventForm() {
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

        if (!PRIVATE_PAGES.has(page)) {
            resolveCurruscosReady(null);
            return;
        }

        const access =
            await requirePrivatePage();

        if (!access) {
            resolveCurruscosReady(null);
            return;
        }

        window.curruscosCurrentAccess = access;

        await initPrivateShell(access);

        if (page === "eventos.html") {
            await loadEvents();
            setupEventForm();
        }

        window.CURRUSCOS_SHELL_READY =
            true;

        resolveCurruscosReady(access);
    }
);
