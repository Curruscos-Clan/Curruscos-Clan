/* CURRUSCOS — Gestión real de mis planes públicos. Sin datos de demostración. */
(function(){
  "use strict";

  let activity = { participating: [], organizing: [] };
  let currentTab = "participating";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function timestamp(event) {
    if (!event || !event.date) return null;
    const time = String(event.time || "00:00").slice(0,8);
    const value = new Date(String(event.date) + "T" + time).getTime();
    return Number.isFinite(value) ? value : null;
  }

  function formatDate(event) {
    const value = timestamp(event);
    if (value === null) return "Fecha por confirmar";
    const date = new Date(value);
    const options = { weekday:"short", day:"numeric", month:"short", year:"numeric" };
    const label = date.toLocaleDateString("es-ES", options);
    return label + (event.time ? " · " + String(event.time).slice(0,5) : "");
  }

  function isHistorical(event) {
    const time = timestamp(event);
    return event.status === "finished" || event.status === "cancelled" || (time !== null && time < Date.now());
  }

  function statusText(status) {
    const labels = {
      published:"Publicado", preparing:"Preparándose", live:"En curso",
      finished:"Finalizado", cancelled:"Cancelado", draft:"Borrador"
    };
    return labels[status] || "Actividad";
  }

  function renderSummary(participating, organizing, finished) {
    const node = document.getElementById("activitySummary");
    if (!node) return;
    const totalUpcoming = new Map();
    participating.concat(organizing).forEach(function(event) {
      if (!isHistorical(event)) totalUpcoming.set(event.id, event);
    });
    const attendingNow = participating.filter(function(event){ return !isHistorical(event); });
    const organizingNow = organizing.filter(function(event){ return !isHistorical(event); });
    const items = [
      ["Próximos", totalUpcoming.size],
      ["Con plaza", attendingNow.length],
      ["Organizados", organizingNow.length],
      ["Historial", finished.length]
    ];
    node.innerHTML = items.map(function(item) {
      return '<div class="activity-stat"><span>'+esc(item[0])+'</span><strong>'+item[1]+'</strong></div>';
    }).join("");
  }

  function attendeeState(value) {
    return ({ yes:"Confirmado", pending:"Pendiente", no:"No asiste" })[value] || "Estado no disponible";
  }

  async function loadAttendees(event, panel, button) {
    if (panel.dataset.loaded === "true") {
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      button.textContent = panel.hidden ? "Ver asistentes" : "Ocultar asistentes";
      return;
    }
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.disabled = true;
    button.textContent = "Cargando asistentes…";
    panel.innerHTML = '<p class="my-event-note">Recuperando la lista real de participantes.</p>';
    try {
      const people = await getPublicEventParticipants(event.id);
      panel.innerHTML = "";
      if (!people.length) {
        panel.innerHTML = '<p class="my-event-note">No hay asistentes visibles o no se ha podido recuperar la lista.</p>';
      } else {
        const rows = document.createElement("div");
        rows.className = "my-attendee-list";
        people.forEach(function(person) {
          const row = document.createElement("div");
          row.className = "my-attendee-row";
          const name = document.createElement("span");
          name.className = "my-attendee-name";
          name.textContent = person.display_name || (person.username ? "@" + person.username : "Participante");
          const state = document.createElement("span");
          state.className = "my-attendee-state";
          state.textContent = attendeeState(person.status);
          row.append(name,state);
          rows.appendChild(row);
        });
        panel.appendChild(rows);
      }
      panel.dataset.loaded = "true";
    } catch (error) {
      console.error("Error cargando asistentes del plan:", error);
      panel.innerHTML = '<p class="my-event-note">No se ha podido cargar la lista. Prueba de nuevo.</p>';
      button.disabled = false;
      button.textContent = "Reintentar asistentes";
      return;
    }
    button.disabled = false;
    button.textContent = "Ocultar asistentes";
  }

  function eventCard(event, mode) {
    const organizing = mode === "organizing";
    const past = isHistorical(event);
    const capacity = Number(event.capacity) > 0 ? Number(event.capacity) : null;
    const count = event.participant_count == null ? null : (Number(event.participant_count) || 0);
    const remaining = capacity === null ? null : Math.max(0, capacity - count);
    const article = document.createElement("article");
    article.className = "my-event-card";
    article.dataset.eventId = event.id;

    const category = document.createElement("small");
    category.textContent = String(event.category || event.event_type || "Plan").replace(/_/g," ");
    const title = document.createElement("h3");
    title.textContent = event.title || "Plan sin título";
    const detail = document.createElement("p");
    detail.textContent = formatDate(event) + (event.location ? " · " + event.location : "");
    const bottom = document.createElement("div");
    bottom.className = "card-bottom";
    const status = document.createElement("span");
    status.className = "event-status";
    status.textContent = statusText(event.status);
    const link = document.createElement("a");
    link.className = "card-action";
    link.href = "evento-publico.html?id=" + encodeURIComponent(event.id);
    link.textContent = "Ver ficha →";
    bottom.append(status,link);
    article.append(category,title,detail,bottom);

    if (organizing) {
      const capacityBox = document.createElement("div");
      capacityBox.className = "event-capacity";
      if (count === null) {
        capacityBox.textContent = "No se ha podido consultar el número de plazas confirmadas.";
      } else if (capacity === null) {
        capacityBox.innerHTML = "<strong>"+count+"</strong> personas confirmadas · sin límite de plazas configurado";
      } else {
        capacityBox.innerHTML = "<strong>"+count+" / "+capacity+"</strong> plazas ocupadas · "+(remaining === 0 ? "aforo completo" : remaining+" libres");
      }
      article.appendChild(capacityBox);
    }

    const actions = document.createElement("div");
    actions.className = "my-event-actions";
    if (organizing) {
      const peopleButton = document.createElement("button");
      peopleButton.type = "button";
      peopleButton.className = "my-event-action";
      peopleButton.textContent = "Ver asistentes";
      peopleButton.setAttribute("aria-expanded","false");
      const panel = document.createElement("div");
      panel.className = "my-attendee-panel";
      panel.hidden = true;
      peopleButton.addEventListener("click",function(){ loadAttendees(event,panel,peopleButton); });
      actions.appendChild(peopleButton);
      if (!past && event.status !== "cancelled") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "my-event-action danger";
        cancel.textContent = "Cancelar plan";
        cancel.addEventListener("click",function(){ cancelOrganizedEvent(event,cancel); });
        actions.appendChild(cancel);
      }
      article.append(actions,panel);
    } else {
      if (!past && event.status !== "cancelled") {
        const leave = document.createElement("button");
        leave.type = "button";
        leave.className = "my-event-action danger";
        leave.textContent = "Darme de baja";
        leave.addEventListener("click",function(){ leaveEvent(event,leave); });
        actions.appendChild(leave);
      }
      if (actions.children.length) article.appendChild(actions);
    }
    return article;
  }

  function renderEvents(root, events, mode, emptyMessage, actionHref, actionText) {
    if (!root) return;
    root.innerHTML = "";
    if (!events.length) {
      const empty = document.createElement("div");
      empty.className = "my-empty";
      empty.innerHTML = esc(emptyMessage) + '<p><a href="'+esc(actionHref)+'">'+esc(actionText)+' →</a></p>';
      root.appendChild(empty);
      return;
    }
    events.forEach(function(event){ root.appendChild(eventCard(event,mode)); });
  }

  function refreshViews() {
    const participating = activity.participating || [];
    const organizing = activity.organizing || [];
    const allById = new Map();
    participating.concat(organizing).forEach(function(event){ allById.set(event.id,event); });
    const all = Array.from(allById.values());
    const upcoming = all.filter(function(event){return !isHistorical(event);});
    const finished = all.filter(isHistorical).sort(function(a,b){return (timestamp(b)||0)-(timestamp(a)||0);});
    const shown = currentTab === "participating" ? participating.filter(function(event){return !isHistorical(event);}) : organizing.filter(function(event){return !isHistorical(event);});
    const heading = document.getElementById("managementHeading");
    const description = document.getElementById("managementDescription");
    if (heading) heading.textContent = currentTab === "participating" ? "Planes confirmados" : "Creados por mí";
    if (description) description.textContent = currentTab === "participating"
      ? "Actividades públicas en las que tienes plaza confirmada."
      : "Controla el aforo, consulta a los asistentes y cancela los planes que ya no vayan a celebrarse.";
    const a = document.getElementById("tabParticipating");
    const b = document.getElementById("tabOrganizing");
    if (a) {a.classList.toggle("active",currentTab==="participating");a.setAttribute("aria-selected",String(currentTab==="participating"));}
    if (b) {b.classList.toggle("active",currentTab==="organizing");b.setAttribute("aria-selected",String(currentTab==="organizing"));}
    renderSummary(participating,organizing,finished);
    renderEvents(document.getElementById("upcomingEvents"),shown,currentTab,
      currentTab === "participating" ? "No tienes planes públicos próximos confirmados." : "Todavía no has creado ningún plan público.",
      currentTab === "participating" ? "explorar.html" : "crear-evento.html",
      currentTab === "participating" ? "Explorar planes" : "Crear plan");
    renderEvents(document.getElementById("finishedEvents"),finished,"history","Aún no hay actividad en tu historial.","explorar.html","Explorar");
    const _ = upcoming;
  }

  async function leaveEvent(event, button) {
    if (!confirm("¿Quieres cancelar tu plaza en «"+(event.title||"este plan")+"»?")) return;
    button.disabled = true;
    button.textContent = "Cancelando…";
    try {
      const ok = await leavePublicEvent(event.id);
      if (!ok) throw new Error("No se ha podido confirmar la baja.");
      await refreshActivity();
    } catch (error) {
      console.error("Error al cancelar la asistencia:",error);
      alert("No se ha podido cancelar tu plaza. Puede que ya no estés inscrito.");
      button.disabled = false;
      button.textContent = "Darme de baja";
    }
  }

  async function cancelOrganizedEvent(event, button) {
    if (!confirm("¿Cancelar «"+(event.title||"este plan")+"»? La actividad dejará de aceptar inscripciones.")) return;
    button.disabled = true;
    button.textContent = "Cancelando…";
    try {
      await setPublicEventStatus(event.id,"cancelled");
      await refreshActivity();
    } catch (error) {
      console.error("Error cancelando el plan:",error);
      alert("No se ha podido cancelar el plan. Comprueba que siga publicado y que seas su organizador.");
      button.disabled = false;
      button.textContent = "Cancelar plan";
    }
  }

  async function refreshActivity() {
    const root = document.getElementById("upcomingEvents");
    if (root) root.innerHTML = '<div class="my-events-loading">Actualizando planes…</div>';
    activity = await getMyPublicEvents();
    refreshViews();
  }

  document.addEventListener("DOMContentLoaded",async function(){
    await window.curruscosI18n?.ready;
    if (window.curruscosReady) await window.curruscosReady;
    const user = await getCurrentUser();
    if (!user) { window.location.replace("login.html"); return; }
    document.getElementById("tabParticipating")?.addEventListener("click",function(){currentTab="participating";refreshViews();});
    document.getElementById("tabOrganizing")?.addEventListener("click",function(){currentTab="organizing";refreshViews();});
    try {
      activity = await getMyPublicEvents();
      refreshViews();
    } catch (error) {
      console.error("No se han podido cargar tus planes:",error);
      const root = document.getElementById("upcomingEvents");
      if(root) root.innerHTML = '<div class="my-empty">No se han podido cargar tus planes. Recarga la página o vuelve a iniciar sesión.</div>';
    }
  });
})();