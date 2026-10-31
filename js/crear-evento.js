/* Curruscos · creación de eventos públicos
   Los controles se conectan antes de consultar Supabase: una sesión lenta
   nunca debe dejar el formulario sin respuesta.
*/
(() => {
  "use strict";

  const EVENT_TYPE_LABELS = {
    padel: "Pádel", futbol: "Fútbol", baloncesto: "Baloncesto",
    tenis: "Tenis", ajedrez: "Ajedrez", gaming: "Gaming",
    running: "Running / carrera", otro: "Otro"
  };
  const FORMAT_HELP = {
    standard: "Evento abierto: la gente se apunta y consulta toda la información.",
    knockout: "Eliminación directa: cruces y rondas hasta una final.",
    round_robin: "Liga: todos se enfrentan según un calendario.",
    swiss: "Sistema suizo: varias rondas sin eliminación directa.",
    race: "Carrera o clasificación por resultado/tiempo.",
    custom: "Formato personalizado: tú decides cómo funciona."
  };
  const FORMAT_BY_TYPE = {
    padel: ["knockout", "round_robin", "swiss"],
    futbol: ["round_robin", "knockout"],
    baloncesto: ["round_robin", "knockout"],
    tenis: ["knockout", "round_robin", "swiss"],
    ajedrez: ["swiss", "round_robin", "knockout"],
    gaming: ["knockout", "round_robin", "swiss"],
    running: ["race"],
    otro: ["standard", "knockout", "round_robin", "swiss", "race", "custom"]
  };

  const byId = id => document.getElementById(id);
  const translate = (key, fallback) => {
    try {
      const value = typeof window.t === "function" ? window.t(key) : key;
      return value && value !== key ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };

  function updateSmartForm() {
    const type = byId("publicEventType");
    const format = byId("publicEventFormat");
    const mode = byId("publicEventParticipantMode");
    const teamField = byId("teamSizeField");
    const help = byId("smartFormatHelp");
    const scoring = byId("publicEventScoring");
    if (!format) return;

    const allowed = FORMAT_BY_TYPE[type?.value] || FORMAT_BY_TYPE.otro;
    [...format.options].forEach(option => { option.hidden = !allowed.includes(option.value); });
    if (!allowed.includes(format.value)) format.value = allowed[0];

    const competitive = ["knockout", "round_robin", "swiss"].includes(format.value);
    if (scoring) {
      const automatic = type?.value === "ajedrez" ? "chess"
        : type?.value === "running" ? "race" : "win_draw_loss";
      if (scoring.value === "auto" || scoring.dataset.auto === "true") {
        scoring.value = automatic;
        scoring.dataset.auto = "true";
      }
      scoring.disabled = !competitive && format.value !== "race";
    }
    if (mode && teamField) {
      mode.disabled = !competitive;
      if (!competitive) {
        mode.value = "individual";
        teamField.style.display = "none";
      } else {
        teamField.style.display = mode.value === "team" ? "grid" : "none";
      }
    }
    if (help) {
      help.textContent = (FORMAT_HELP[format.value] || FORMAT_HELP.standard) +
        (type?.value && EVENT_TYPE_LABELS[type.value]
          ? " " + translate("createEvent.adapts", "Se adapta a") + " " + EVENT_TYPE_LABELS[type.value].toLowerCase()
          : "");
    }
  }

  function updatePreview() {
    const title = byId("publicEventTitle")?.value.trim() || translate("createEvent.previewTitle", "Tu nuevo evento");
    const date = byId("publicEventDate")?.value;
    const time = byId("publicEventTime")?.value;
    const location = byId("publicEventLocation")?.value.trim();
    const type = byId("publicEventType")?.selectedOptions[0]?.textContent || "Evento";
    const scoring = byId("publicEventScoring")?.selectedOptions[0]?.textContent;
    const meta = [
      date ? new Date(date + "T12:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "Fecha por confirmar",
      time || null, location || null, type,
      scoring && scoring !== translate("createEvent.autoScoring", "Automática") ? scoring : null
    ].filter(Boolean).join(" · ");
    if (byId("previewTitle")) byId("previewTitle").textContent = title;
    if (byId("previewMeta")) byId("previewMeta").textContent = meta;
  }

  function checkSession() {
    return Promise.race([
      Promise.resolve().then(() => getCurrentUser(true, { throwOnError: true })),
      new Promise((_, reject) => window.setTimeout(
        () => reject(new Error("La comprobación de sesión está tardando demasiado. Comprueba tu conexión y vuelve a intentarlo.")),
        10000
      ))
    ]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = byId("publicEventForm");
    const message = byId("publicEventMessage");
    const submitButton = form?.querySelector('button[type="submit"]');
    const authNote = byId("authNote");
    const authNoteText = byId("authNoteText");
    if (!form || !submitButton) return;

    let sessionPromise = checkSession();
    let coverPreviewUrl = "";

    const showMessage = (text, state = "error") => {
      if (!message) return;
      message.textContent = text;
      message.dataset.state = state;
    };

    // Enlazar el submit antes de cualquier espera de red o traducciones.
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submitButton.disabled) return;

      submitButton.disabled = true;
      submitButton.textContent = translate("createEvent.checking", "Comprobando…");
      showMessage("", "");

      let user;
      try {
        user = await sessionPromise;
      } catch (error) {
        sessionPromise = checkSession();
        showMessage(error?.message || "No se ha podido comprobar tu sesión.");
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }

      if (!user) {
        showMessage(translate("createEvent.loginRequired", "Inicia sesión para publicar un evento."));
        if (authNoteText) authNoteText.textContent = translate("createEvent.loginRequired", "Inicia sesión para publicar un evento.") + " ";
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }

      const title = byId("publicEventTitle").value.trim();
      const date = byId("publicEventDate").value;
      const time = byId("publicEventTime").value;
      const deadline = byId("publicEventDeadline")?.value || "";
      const capacity = byId("publicEventCapacity")?.value || "";
      const fee = byId("publicEventFee")?.value || "0";
      const mode = byId("publicEventParticipantMode");
      const format = byId("publicEventFormat");
      const type = byId("publicEventType");
      const teamMode = mode?.value === "team";
      const teamSize = byId("publicEventTeamSize")?.value || "";

      if (!title || !date) {
        showMessage(translate("createEvent.required", "El nombre y la fecha son obligatorios."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }

      const eventStart = new Date(date + "T" + (time || "23:59"));
      const deadlineDate = deadline ? new Date(deadline) : null;
      if (Number.isNaN(eventStart.getTime()) || eventStart < new Date()) {
        showMessage(translate("createEvent.futureDate", "Elige una fecha futura."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }
      if (deadlineDate && (Number.isNaN(deadlineDate.getTime()) || deadlineDate >= eventStart)) {
        showMessage(translate("createEvent.deadlineBefore", "El cierre de inscripciones debe ser anterior al evento."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }
      if (capacity && (Number(capacity) < 1 || !Number.isInteger(Number(capacity)))) {
        showMessage(translate("createEvent.capacityInvalid", "El número de plazas no es válido."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }
      if (!Number.isFinite(Number(fee)) || Number(fee) < 0) {
        showMessage(translate("createEvent.feeInvalid", "El precio no es válido."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }
      if (teamMode && (!teamSize || Number(teamSize) < 2 || !Number.isInteger(Number(teamSize)))) {
        showMessage(translate("createEvent.teamSizeInvalid", "Indica al menos dos personas por equipo."));
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
        return;
      }

      submitButton.textContent = translate("createEvent.publishing", "Publicando…");
      let uploadedCoverUrl = "";
      let createdEvent = false;
      try {
        const coverFile = byId("publicEventCover")?.files?.[0];
        if (coverFile) {
          if (!window.AppStorage?.uploadEventCover) throw new Error("La subida de portadas no está disponible. Recarga la página e inténtalo de nuevo.");
          showMessage("Optimizando y subiendo portada…", "info");
          uploadedCoverUrl = await window.AppStorage.uploadEventCover(coverFile);
        }

        const created = await createPublicEvent({
          title,
          date,
          time,
          location: byId("publicEventLocation").value,
          description: byId("publicEventDescription").value,
          category: byId("publicEventCategory").value,
          event_type: type?.value || "otro",
          format: format?.value || "standard",
          scoring_system: byId("publicEventScoring")?.value || "win_draw_loss",
          rules: byId("publicEventRules")?.value || "",
          organizer_name: byId("publicEventOrganizer")?.value || "",
          capacity,
          entry_fee: fee,
          registration_deadline: deadline || null,
          participant_mode: mode?.value || "individual",
          team_size: teamMode && teamSize ? Number(teamSize) : null,
          cover_url: uploadedCoverUrl || null
        });

        if (!created) throw new Error(translate("createEvent.publishError", "No se ha podido publicar el evento."));
        createdEvent = true;
        window.location.replace("evento-publico.html?id=" + encodeURIComponent(created.id));
      } catch (error) {
        if (uploadedCoverUrl && !createdEvent && window.AppStorage?.removeEventCover) {
          try { await window.AppStorage.removeEventCover(uploadedCoverUrl); }
          catch (cleanupError) { console.warn("No se pudo limpiar la portada tras el error.", cleanupError); }
        }
        console.error("Error publicando evento:", error);
        showMessage(error?.message || translate("createEvent.publishError", "No se ha podido publicar el evento."));
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = translate("createEvent.publish", "Publicar evento");
      }
    });

    const type = byId("publicEventType");
    const format = byId("publicEventFormat");
    const mode = byId("publicEventParticipantMode");
    const coverInput = byId("publicEventCover");
    const coverPreview = byId("eventCoverPreview");
    const coverPreviewImage = byId("eventCoverPreviewImage");

    coverInput?.addEventListener("change", () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      coverPreviewUrl = "";
      const file = coverInput.files?.[0];
      if (!file) { if (coverPreview) coverPreview.hidden = true; return; }
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 20 * 1024 * 1024) {
        coverInput.value = "";
        if (coverPreview) coverPreview.hidden = true;
        showMessage("Elige una imagen JPG, PNG, WebP o AVIF de hasta 20 MB.");
        return;
      }
      coverPreviewUrl = URL.createObjectURL(file);
      if (coverPreviewImage) coverPreviewImage.src = coverPreviewUrl;
      if (coverPreview) coverPreview.hidden = false;
    });

    ["publicEventTitle", "publicEventDate", "publicEventTime", "publicEventLocation", "publicEventType"].forEach(id => {
      byId(id)?.addEventListener("input", updatePreview);
    });
    type?.addEventListener("change", () => {
      const scoring = byId("publicEventScoring");
      if (scoring) scoring.dataset.auto = "true";
      updateSmartForm();
      updatePreview();
    });
    format?.addEventListener("change", () => { updateSmartForm(); updatePreview(); });
    byId("publicEventScoring")?.addEventListener("change", event => {
      event.target.dataset.auto = "false";
      updatePreview();
    });
    mode?.addEventListener("change", updateSmartForm);
    updateSmartForm();
    updatePreview();

    const dateInput = byId("publicEventDate");
    const deadlineInput = byId("publicEventDeadline");
    if (dateInput) {
      const today = new Date();
      dateInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      dateInput.addEventListener("change", () => {
        if (dateInput.value && deadlineInput) {
          deadlineInput.max = dateInput.value + "T23:59";
          if (deadlineInput.value && deadlineInput.value >= deadlineInput.max) deadlineInput.value = "";
        }
        refreshProgress();
      });
    }

    const progressSteps = [...document.querySelectorAll(".create-progress-step")];
    function refreshProgress() {
      const filled = [
        byId("publicEventTitle")?.value.trim(),
        byId("publicEventDate")?.value,
        byId("publicEventLocation")?.value.trim()
      ];
      const organization = !!byId("publicEventFormat")?.value;
      const publishing = !!byId("publicEventDescription")?.value.trim() || !!byId("publicEventRules")?.value.trim();
      const index = publishing ? 2 : filled.filter(Boolean).length >= 2 && organization ? 1 : 0;
      progressSteps.forEach((step, i) => step.classList.toggle("active", i === index));
    }
    ["publicEventTitle", "publicEventDate", "publicEventLocation", "publicEventDescription", "publicEventRules", "publicEventFormat"].forEach(id => {
      byId(id)?.addEventListener("input", refreshProgress);
    });
    refreshProgress();

    window.curruscosI18n?.ready?.then(() => {
      updateSmartForm();
      updatePreview();
    });

    // La consulta de sesión continúa en segundo plano; no bloquea los controles.
    sessionPromise.then(user => {
      if (user) {
        if (authNote) authNote.textContent = translate("createEvent.publicNote", "Tu evento será visible públicamente.");
      } else if (authNoteText) {
        authNoteText.textContent = translate("createEvent.loginRequired", "Inicia sesión para publicar un evento.") + " ";
      }
    }).catch(error => {
      console.warn("No se pudo comprobar la sesión al cargar el formulario:", error);
    });
  });
})();
