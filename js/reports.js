/* Curruscos: accessible reporting dialog. Reports are never simulated as saved. */
(function () {
  "use strict";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let modal;
  let target;
  let previousFocus;

  function node(tag, attrs, text) {
    const element = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") element.className = value;
      else element.setAttribute(key, value);
    });
    if (text != null) element.textContent = text;
    return element;
  }

  function createModal() {
    if (modal) return modal;
    modal = node("div", { id: "curruscos-report-modal", class: "report-dialog-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "report-dialog-title", "aria-describedby": "report-dialog-description", hidden: "" });
    const panel = node("section", { class: "report-dialog" });
    const heading = node("div", { class: "report-dialog-heading" });
    heading.append(node("h2", { id: "report-dialog-title" }, "Denunciar contenido"));
    const close = node("button", { type: "button", "aria-label": "Cerrar diálogo", class: "report-dialog-close" }, "×");
    heading.append(close);
    const description = node("p", { id: "report-dialog-description" }, "Indica el motivo. Las denuncias se revisan de forma confidencial.");
    const form = node("form", { id: "curruscos-report-form" });
    const reasonLabel = node("label", { for: "curruscos-report-reason" }, "Motivo");
    const reason = node("select", { id: "curruscos-report-reason", required: "" });
    [["spam","Spam o publicidad"],["inappropriate","Contenido inapropiado"],["harassment","Acoso o comportamiento irrespetuoso"],["fraud","Fraude o engaño"],["other","Otro motivo"]].forEach(([value,label]) => reason.append(node("option", { value }, label)));
    reasonLabel.append(reason);
    const detailsLabel = node("label", { for: "curruscos-report-details" }, "Detalles adicionales (opcional)");
    const details = node("textarea", { id: "curruscos-report-details", maxlength: "600", rows: "3", placeholder: "Describe brevemente el problema…" });
    detailsLabel.append(details);
    const status = node("p", { id: "curruscos-report-status", role: "status", "aria-live": "polite", class: "report-dialog-status" });
    const actions = node("div", { class: "report-dialog-actions" });
    const cancel = node("button", { type: "button", class: "report-dialog-cancel" }, "Cancelar");
    const submit = node("button", { type: "submit", class: "report-dialog-submit" }, "Enviar denuncia");
    actions.append(cancel, submit);
    form.append(reasonLabel, detailsLabel, status, actions);
    panel.append(heading, description, form);
    modal.append(panel);
    const style = node("style", {});
    style.textContent = ".report-dialog-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(15,18,25,.58)}.report-dialog-backdrop[hidden]{display:none}.report-dialog{box-sizing:border-box;width:min(100%,460px);max-height:min(90dvh,700px);overflow:auto;padding:22px;border:1px solid var(--border,#e4e5e7);border-radius:22px;background:var(--surface,#fff);color:var(--text,#17181b);box-shadow:0 24px 90px #0003}.report-dialog-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.report-dialog h2{margin:0;font-size:21px;letter-spacing:-.04em}.report-dialog-close{border:0;background:transparent;font-size:26px;cursor:pointer}.report-dialog p{font-size:12px;line-height:1.6;color:var(--muted,#6b7280)}#curruscos-report-form{display:grid;gap:13px}#curruscos-report-form label{display:grid;gap:7px;font-size:12px;font-weight:800}#curruscos-report-form select,#curruscos-report-form textarea{box-sizing:border-box;width:100%;padding:11px;border:1px solid var(--border,#ddd);border-radius:12px;background:var(--surface,#fff);color:inherit;font:inherit;font-weight:400}.report-dialog-actions{display:flex;justify-content:flex-end;gap:8px}.report-dialog-actions button{min-height:40px;padding:0 14px;border-radius:999px;font-size:12px;font-weight:850;cursor:pointer}.report-dialog-cancel{border:1px solid var(--border,#ddd);background:transparent;color:inherit}.report-dialog-submit{border:0;background:var(--accent,#ff4d2e);color:#fff}.report-dialog-status{min-height:18px;margin:0}.report-dialog-actions button:disabled{opacity:.55;cursor:wait}";
    document.head.append(style);
    document.body.append(modal);
    const closeDialog = () => { modal.hidden = true; if (previousFocus) previousFocus.focus(); };
    close.addEventListener("click", closeDialog);
    cancel.addEventListener("click", closeDialog);
    modal.addEventListener("click", event => { if (event.target === modal) closeDialog(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && modal && !modal.hidden) closeDialog(); });
    form.addEventListener("submit", submitReport);
    return modal;
  }

  async function submitReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = modal.querySelector("#curruscos-report-status");
    const submit = modal.querySelector('[type="submit"]');
    const reason = modal.querySelector("#curruscos-report-reason").value;
    const details = modal.querySelector("#curruscos-report-details").value.trim();
    if (!target || !UUID_RE.test(target.id)) { status.textContent = "No se ha podido identificar el contenido que quieres denunciar."; return; }
    if (!window.supabaseClient) { status.textContent = "No hay conexión con el servicio. No se ha enviado la denuncia."; return; }
    submit.disabled = true;
    status.textContent = "Enviando denuncia…";
    try {
      const auth = await window.supabaseClient.auth.getUser();
      const user = auth.data && auth.data.user;
      if (!user) throw new Error("Inicia sesión para enviar una denuncia.");
      const { error } = await window.supabaseClient.from("reports").insert({
        reporter_id: user.id,
        target_type: target.type,
        target_id: target.id,
        reason,
        details: details || null
      });
      if (error) {
        if (error.code === "23505") throw new Error("Ya has denunciado este contenido. El equipo podrá revisar tu denuncia pendiente.");
        throw error;
      }
      status.textContent = "Denuncia registrada. Gracias por ayudar a mantener segura la comunidad.";
      form.querySelector('[type="submit"]').textContent = "Enviada";
      window.setTimeout(() => { if (modal) modal.hidden = true; }, 1200);
    } catch (error) {
      status.textContent = error?.message || "No se ha podido enviar la denuncia. Inténtalo más tarde.";
    } finally {
      submit.disabled = false;
      if (submit.textContent !== "Enviada") submit.textContent = "Enviar denuncia";
    }
  }

  function openReportModal(options) {
    if (!options || !["event", "comment", "community_post", "profile"].includes(options.type) || !UUID_RE.test(String(options.id || ""))) return;
    target = { type: options.type, id: String(options.id) };
    const dialog = createModal();
    dialog.querySelector("#report-dialog-description").textContent = options.title
      ? "Vas a denunciar: " + String(options.title).slice(0, 120) + ". Las denuncias se revisan de forma confidencial."
      : "Indica el motivo. Las denuncias se revisan de forma confidencial.";
    dialog.querySelector("#curruscos-report-status").textContent = "";
    dialog.querySelector("#curruscos-report-form").reset();
    const submit = dialog.querySelector('[type="submit"]');
    submit.disabled = false; submit.textContent = "Enviar denuncia";
    previousFocus = document.activeElement;
    dialog.hidden = false;
    dialog.querySelector("#curruscos-report-reason").focus();
  }

  function attachReportButtons() {
    if (!document.body) return;
    const eventId = new URLSearchParams(window.location.search).get("id");
    const eventRoot = document.querySelector(".public-event-main");
    if (eventRoot && eventId && UUID_RE.test(eventId) && !eventRoot.querySelector("[data-event-report-attached]")) {
      const button = node("button", { type: "button", class: "content-report-button", "data-event-report-attached": "", "aria-label": "Denunciar evento" }, "Denunciar evento");
      button.addEventListener("click", () => openReportModal({ type: "event", id: eventId, title: eventRoot.querySelector("h1")?.textContent || "evento" }));
      eventRoot.append(button);
    }
    document.querySelectorAll(".event-comment[data-comment-id]").forEach(item => {
      if (item.querySelector("[data-report-attached]")) return;
      const id = item.dataset.commentId;
      if (!UUID_RE.test(id || "")) return;
      const button = node("button", { type: "button", class: "content-report-button", "data-report-attached": "", "aria-label": "Denunciar comentario" }, "Denunciar");
      button.addEventListener("click", () => openReportModal({ type: "comment", id, title: "comentario" }));
      const body = item.querySelector(".event-comment-body") || item;
      body.append(button);
    });
    document.querySelectorAll(".community-post[data-post-id]").forEach(item => {
      if (item.querySelector("[data-report-attached]")) return;
      const id = item.dataset.postId;
      if (!UUID_RE.test(id || "")) return;
      const button = node("button", { type: "button", class: "content-report-button", "data-report-attached": "", "aria-label": "Denunciar publicación" }, "Denunciar");
      button.addEventListener("click", () => openReportModal({ type: "community_post", id, title: "publicación" }));
      item.append(button);
    });
  }

  const styleButton = document.createElement("style");
  styleButton.textContent = ".content-report-button{justify-self:start;margin-top:8px;padding:6px 10px;border:1px solid var(--border,#ddd);border-radius:999px;background:transparent;color:var(--muted,#666);font:inherit;font-size:10px;font-weight:800;cursor:pointer}.content-report-button:hover{border-color:var(--accent,#ff4d2e);color:var(--accent,#ff4d2e)}";
  if (document.head) document.head.append(styleButton);
  const observer = typeof MutationObserver === "function" ? new MutationObserver(attachReportButtons) : null;
  if (observer && document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attachReportButtons, { once: true });
  else attachReportButtons();

  window.ReportsModule = { openReportModal };
})();
