/* Mis planes: usa las funciones y políticas existentes de Supabase. */
(() => {
  const content = document.getElementById("plans-content");
  const tabs = [...document.querySelectorAll(".plans-tab")];
  const toastContainer = document.getElementById("toast-container");
  let currentUser = null;
  let activeTab = "attending";
  let requestVersion = 0;

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function showToast(message, kind = "") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    if (kind) toast.dataset.state = kind;
    toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function setBusy(message = "Cargando tus planes…") {
    content.setAttribute("aria-busy", "true");
    content.innerHTML = "";
    const state = document.createElement("div");
    state.className = "plans-state";
    const p = document.createElement("p");
    p.textContent = message;
    state.appendChild(p);
    content.appendChild(state);
  }

  function renderState(title, message, actionLabel, href, isError = false) {
    content.setAttribute("aria-busy", "false");
    content.innerHTML = "";
    const box = document.createElement("div");
    box.className = "plans-state";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    if (isError) description.classList.add("plans-error");
    box.append(heading, description);
    if (actionLabel && href) {
      const link = document.createElement("a");
      link.className = "btn btn-primary";
      link.href = href;
      link.textContent = actionLabel;
      box.appendChild(link);
    }
    content.appendChild(box);
  }

  function formatDate(event) {
    const raw = event.start_time || (event.date ? event.date + "T" + (event.time || "00:00") : "");
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return "Fecha por confirmar";
    return date.toLocaleString("es-ES", {
      weekday: "short", day: "numeric", month: "short",
      hour: event.time || event.start_time ? "2-digit" : undefined,
      minute: event.time || event.start_time ? "2-digit" : undefined
    });
  }

  function eventIsPast(event) {
    if (event.status === "finished" || event.status === "cancelled") return true;
    const raw = event.start_time || (event.date ? event.date + "T" + (event.time || "23:59") : "");
    const timestamp = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(timestamp) && timestamp < Date.now();
  }

  function renderCards(events, mode) {
    content.innerHTML = "";
    content.setAttribute("aria-busy", "false");
    if (!events.length) {
      renderState(
        mode === "attending" ? "Todavía no te has apuntado" : "Aún no organizas planes",
        mode === "attending"
          ? "Cuando confirmes tu asistencia a un evento público, aparecerá aquí."
          : "Los eventos públicos que crees aparecerán aquí para que puedas gestionarlos.",
        mode === "attending" ? "Explorar actividades" : "Crear un evento",
        mode === "attending" ? "explorar.html" : "crear-evento.html"
      );
      return;
    }

    for (const event of events) {
      const card = document.createElement("article");
      card.className = "plan-card";
      const header = document.createElement("div");
      header.className = "plan-card-header";
      const title = document.createElement("h2");
      title.className = "plan-card-title";
      title.textContent = event.title || "Actividad sin título";
      const status = document.createElement("span");
      status.className = "plan-status";
      status.textContent = mode === "attending" ? "Confirmado" : "Organizas";
      header.append(title, status);

      const meta = document.createElement("div");
      meta.className = "plan-card-meta";
      const date = document.createElement("span");
      date.textContent = "📅 " + formatDate(event);
      const location = document.createElement("span");
      location.textContent = "📍 " + (event.location || "Ubicación por confirmar");
      meta.append(date, location);
      if (event.category) {
        const category = document.createElement("span");
        category.textContent = "🏷️ " + event.category;
        meta.appendChild(category);
      }

      const footer = document.createElement("div");
      footer.className = "plan-card-footer";
      const hint = document.createElement("span");
      hint.className = "feed-footer-note";
      hint.textContent = eventIsPast(event) ? "Actividad pasada" : "Evento público";
      footer.appendChild(hint);

      const details = document.createElement("a");
      details.className = "plan-action";
      details.href = "evento-publico.html?id=" + encodeURIComponent(event.id);
      details.textContent = "Ver evento";
      footer.appendChild(details);

      if (mode === "attending" && !eventIsPast(event)) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "plan-action danger";
        cancel.textContent = "Cancelar asistencia";
        cancel.addEventListener("click", () => cancelAttendance(event, cancel));
        footer.appendChild(cancel);
      }
      card.append(header, meta, footer);
      content.appendChild(card);
    }
  }

  async function loadPlans() {
    if (!currentUser) return;
    const version = ++requestVersion;
    setBusy(activeTab === "attending" ? "Consultando tus inscripciones…" : "Consultando los eventos que organizas…");
    try {
      // getMyPublicEvents recupera IDs de event_participants y luego consulta
      // events por separado: no depende de una relación/foreign key embebida.
      const result = await getMyPublicEvents();
      if (version !== requestVersion) return;
      const events = activeTab === "attending" ? result.participating : result.organizing;
      const ordered = [...(events || [])].sort((a, b) => {
        const dateOf = e => new Date(e.start_time || (e.date ? e.date + "T" + (e.time || "00:00") : "")).getTime();
        return (Number.isFinite(dateOf(a)) ? dateOf(a) : Infinity) - (Number.isFinite(dateOf(b)) ? dateOf(b) : Infinity);
      });
      renderCards(ordered, activeTab);
    } catch (error) {
      console.error("No se han podido cargar los planes:", error);
      if (version === requestVersion) {
        renderState("No se han podido cargar tus planes", "Comprueba la conexión e inténtalo de nuevo.", "Reintentar", "#", true);
        const retry = content.querySelector("a");
        retry?.addEventListener("click", event => { event.preventDefault(); loadPlans(); });
      }
    }
  }

  async function cancelAttendance(event, button) {
    if (!currentUser || !event?.id) return;
    if (!window.confirm("¿Quieres cancelar tu asistencia a este evento?")) return;
    button.disabled = true;
    button.textContent = "Cancelando…";
    try {
      // Utiliza la función compartida para respetar la convención de la tabla
      // event_participants y comprobar que realmente se eliminó la inscripción.
      const removed = await leavePublicEvent(event.id);
      if (!removed) throw new Error("No se ha podido confirmar la cancelación. Puede que ya no estuvieras inscrito.");
      showToast("Has cancelado tu asistencia.");
      await loadPlans();
    } catch (error) {
      console.error("Error cancelando asistencia:", error);
      showToast(error?.message || "No se ha podido cancelar la asistencia.", "error");
      button.disabled = false;
      button.textContent = "Cancelar asistencia";
    }
  }

  function setupTabs() {
    tabs.forEach(tab => tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab === "organizing" ? "organizing" : "attending";
      tabs.forEach(item => {
        const selected = item === tab;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      content.setAttribute("aria-labelledby", tab.id);
      if (currentUser) loadPlans();
    }));
  }

  async function init() {
    setupTabs();
    if (!content) return;
    try {
      currentUser = await getCurrentUser(true);
      if (!currentUser) {
        renderState(
          "Inicia sesión para ver tu agenda",
          "Aquí encontrarás los eventos en los que participas y las actividades públicas que organizas.",
          "Iniciar sesión",
          "login.html"
        );
        return;
      }
      await loadPlans();
    } catch (error) {
      console.error("Error comprobando la sesión:", error);
      renderState("No se ha podido comprobar tu sesión", "Vuelve a intentarlo o inicia sesión de nuevo.", "Iniciar sesión", "login.html", true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
