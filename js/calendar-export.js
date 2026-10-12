/**
 * Curruscos Clan · Exportación iCalendar / Google Calendar sin dependencias.
 * Los eventos del producto usan date + time; también acepta start_date/end_date.
 */
(function () {
  "use strict";

  function escapeICS(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function toDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (value == null || value === "") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getStartDate(event) {
    if (event && event.start_date) return toDate(event.start_date);
    if (!event || !event.date) return null;
    const time = String(event.time || "12:00").slice(0, 5);
    return toDate(String(event.date).slice(0, 10) + "T" + (/^\d{2}:\d{2}$/.test(time) ? time : "12:00"));
  }

  function getEndDate(event, start) {
    const explicit = toDate(event && event.end_date);
    return explicit || new Date(start.getTime() + 2 * 60 * 60 * 1000);
  }

  function utcStamp(date) {
    const pad = value => String(value).padStart(2, "0");
    return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) +
      "T" + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + "Z";
  }

  function filename(value) {
    const clean = String(value || "plan").normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return (clean || "plan").slice(0, 80) + ".ics";
  }

  function calendarDetails(event) {
    const rows = [];
    if (event.description) rows.push(String(event.description));
    rows.push("Organizado por: " + (event.organizer_name || "Curruscos Clan"));
    rows.push("Enlace: " + window.location.href);
    return rows.join("\n\n");
  }

  const CalendarExport = {
    getGoogleCalendarUrl(event) {
      const start = getStartDate(event);
      if (!start) throw new Error("El evento no tiene una fecha válida.");
      const end = getEndDate(event, start);
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title || "Plan en Curruscos Clan",
        dates: utcStamp(start) + "/" + utcStamp(end),
        details: calendarDetails(event),
        location: event.location || "",
      });
      return "https://calendar.google.com/calendar/render?" + params.toString();
    },

    buildICS(event) {
      const start = getStartDate(event);
      if (!start) throw new Error("El evento no tiene una fecha válida.");
      const end = getEndDate(event, start);
      if (end.getTime() <= start.getTime()) {
        throw new Error("La fecha de finalización debe ser posterior al inicio.");
      }

      const id = String(event.id || ("local-" + Date.now())).replace(/[^a-z0-9._-]/gi, "-");
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Curruscos Clan//Eventos//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:" + id + "@curruscos-clan.github.io",
        "DTSTAMP:" + utcStamp(new Date()),
        "DTSTART:" + utcStamp(start),
        "DTEND:" + utcStamp(end),
        "SUMMARY:" + escapeICS(event.title || "Plan en Curruscos Clan"),
        "DESCRIPTION:" + escapeICS(calendarDetails(event)),
        "LOCATION:" + escapeICS(event.location || ""),
        "URL:" + escapeICS(window.location.href),
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
      ];
      return lines.join("\r\n") + "\r\n";
    },

    downloadICS(event) {
      const content = this.buildICS(event);
      const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename(event.title);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    renderActionButtons(containerEl, event) {
      if (!containerEl) return;
      containerEl.replaceChildren();
      const row = document.createElement("div");
      row.className = "calendar-export-actions";

      const google = document.createElement("a");
      google.className = "button button-secondary";
      google.href = this.getGoogleCalendarUrl(event);
      google.target = "_blank";
      google.rel = "noopener noreferrer";
      google.textContent = "Añadir a Google Calendar";

      const download = document.createElement("button");
      download.className = "button button-secondary";
      download.type = "button";
      download.textContent = "Descargar .ics";
      download.addEventListener("click", () => this.downloadICS(event));

      row.append(google, download);
      containerEl.appendChild(row);
    },
  };

  window.CalendarExport = CalendarExport;
})();
