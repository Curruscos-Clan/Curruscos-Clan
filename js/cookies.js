(() => {
  "use strict";

  const STORAGE_KEY = "curruscos_cookie_consent_v1";

  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveConsent(analytics) {
    const consent = {
      necessary: true,
      analytics: Boolean(analytics),
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    return consent;
  }

  function injectStyles() {
    if (document.getElementById("curruscos-cookie-styles")) return;
    const style = document.createElement("style");
    style.id = "curruscos-cookie-styles";
    style.textContent = `
      .cc-banner{position:fixed;z-index:99999;left:18px;right:18px;bottom:18px;max-width:980px;margin:auto;padding:20px;border:1px solid rgba(17,19,24,.12);border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 24px 80px rgba(0,0,0,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-family:inherit;color:var(--text,#111)}
      .cc-banner[hidden],.cc-modal[hidden]{display:none}
      .cc-inner{display:flex;gap:22px;align-items:center;justify-content:space-between}
      .cc-copy{min-width:0}.cc-kicker{display:block;margin-bottom:6px;color:var(--accent,#ff4d2e);font-size:9px;font-weight:900;letter-spacing:.14em}.cc-title{margin:0 0 7px;font-size:17px;font-weight:900;letter-spacing:-.03em}.cc-text{margin:0;color:var(--muted,#6b7078);font-size:12px;line-height:1.55}.cc-text a{color:inherit;font-weight:800}
      .cc-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;flex:none}.cc-btn{min-height:40px;padding:0 14px;border:1px solid var(--border-strong,#d9dadd);border-radius:999px;background:#fff;color:var(--text,#111);font:inherit;font-size:11px;font-weight:900;cursor:pointer}.cc-btn.primary{background:#111;color:#fff;border-color:#111}.cc-btn:hover{transform:translateY(-1px)}
      .cc-settings{margin-top:16px;padding-top:15px;border-top:1px solid var(--border,#e6e7e9)}.cc-setting{display:flex;justify-content:space-between;gap:15px;padding:12px 0;border-bottom:1px solid var(--border,#e6e7e9)}.cc-setting:last-child{border-bottom:0}.cc-setting strong{display:block;font-size:12px}.cc-setting span{display:block;margin-top:3px;color:var(--muted,#6b7078);font-size:10px;line-height:1.45}.cc-toggle{min-width:74px;height:34px;border:1px solid #d9dadd;border-radius:999px;background:#f2f3f4;color:#777;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.cc-toggle.on{background:#111;color:#fff;border-color:#111}
      .cc-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(12,14,18,.45);backdrop-filter:blur(8px)}.cc-modal-card{width:min(620px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:25px;border:1px solid rgba(255,255,255,.65);border-radius:25px;background:#fff;box-shadow:0 30px 100px rgba(0,0,0,.25)}.cc-modal-card h2{margin:0 0 8px;font-size:27px;letter-spacing:-.05em}.cc-modal-card>p{color:#6b7078;font-size:12px;line-height:1.55}.cc-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      .cc-manage-link{position:fixed;z-index:9998;left:14px;bottom:14px;border:1px solid var(--border,#e5e5e5);border-radius:999px;padding:8px 11px;background:rgba(255,255,255,.9);color:var(--muted,#666);font:inherit;font-size:9px;font-weight:900;cursor:pointer;box-shadow:0 5px 20px rgba(0,0,0,.07)}.cc-manage-link:hover{color:var(--text,#111)}
      @media(max-width:700px){.cc-banner{left:10px;right:10px;bottom:10px;padding:17px;border-radius:19px}.cc-inner{display:block}.cc-actions{margin-top:14px;justify-content:stretch}.cc-btn{flex:1}.cc-setting{align-items:center}.cc-manage-link{bottom:8px;left:8px}}
    `;
    document.head.appendChild(style);
  }

  function createBanner() {
    if (document.getElementById("curruscosCookieBanner")) return;
    const banner = document.createElement("aside");
    banner.id = "curruscosCookieBanner";
    banner.className = "cc-banner";
    banner.setAttribute("aria-label", "Configuración de cookies");
    banner.innerHTML = `
      <div class="cc-inner">
        <div class="cc-copy">
          <span class="cc-kicker">PRIVACIDAD</span>
          <h2 class="cc-title">Tú decides qué usamos.</h2>
          <p class="cc-text">Usamos tecnologías necesarias para que Curruscos funcione. Las analíticas y publicidad no se activan sin tu consentimiento. Puedes <a href="cookies.html">leer la política de cookies</a>.</p>
        </div>
        <div class="cc-actions">
          <button type="button" class="cc-btn" data-cc="reject">Rechazar</button>
          <button type="button" class="cc-btn" data-cc="settings">Configurar</button>
          <button type="button" class="cc-btn primary" data-cc="accept">Aceptar</button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('[data-cc="reject"]').onclick = () => {
      saveConsent(false);
      banner.remove();
      showManageLink();
    };
    banner.querySelector('[data-cc="accept"]').onclick = () => {
      saveConsent(true);
      banner.remove();
      showManageLink();
    };
    banner.querySelector('[data-cc="settings"]').onclick = () => showSettings(true);
  }

  function showManageLink() {
    if (document.getElementById("curruscosCookieManage")) return;
    const link = document.createElement("button");
    link.type = "button";
    link.id = "curruscosCookieManage";
    link.className = "cc-manage-link";
    link.textContent = "Cookies";
    link.onclick = () => showSettings(false);
    document.body.appendChild(link);
  }

  function showSettings(fromBanner) {
    if (!document.getElementById("curruscosCookieSettings")) {
      const modal = document.createElement("div");
      modal.id = "curruscosCookieSettings";
      modal.className = "cc-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="cc-modal-card" role="dialog" aria-modal="true" aria-labelledby="ccSettingsTitle">
          <h2 id="ccSettingsTitle">Configurar cookies</h2>
          <p>Las categorías necesarias están siempre activas porque permiten prestar funciones solicitadas. Las analíticas solo se activarían si las aceptas.</p>
          <div class="cc-settings">
            <div class="cc-setting"><div><strong>Necesarias</strong><span>Sesión, seguridad, preferencias técnicas y funcionamiento básico.</span></div><button class="cc-toggle on" disabled>Siempre activas</button></div>
            <div class="cc-setting"><div><strong>Analíticas</strong><span>Medición agregada del uso para mejorar el producto. Actualmente no se instala ninguna herramienta analítica adicional.</span></div><button id="ccAnalyticsToggle" class="cc-toggle">Desactivadas</button></div>
            <div class="cc-setting"><div><strong>Publicidad y seguimiento</strong><span>No las utilizamos actualmente.</span></div><button class="cc-toggle" disabled>No usadas</button></div>
          </div>
          <div class="cc-modal-actions"><button type="button" class="cc-btn" data-cc-close>Cancelar</button><button type="button" class="cc-btn primary" data-cc-save>Guardar preferencias</button></div>
        </div>`;
      document.body.appendChild(modal);
      let analytics = Boolean(getConsent()?.analytics);
      const toggle = modal.querySelector("#ccAnalyticsToggle");
      const render = () => { toggle.classList.toggle("on", analytics); toggle.textContent = analytics ? "Activadas" : "Desactivadas"; };
      toggle.onclick = () => { analytics = !analytics; render(); };
      modal.querySelector("[data-cc-close]").onclick = () => { modal.hidden = true; if (fromBanner && !getConsent()) createBanner(); };
      modal.querySelector("[data-cc-save]").onclick = () => { saveConsent(analytics); modal.hidden = true; document.getElementById("curruscosCookieBanner")?.remove(); showManageLink(); };
      render();
    }
    document.getElementById("curruscosCookieSettings").hidden = false;
  }

  function init() {
    injectStyles();
    const consent = getConsent();
    if (consent) {
      showManageLink();
      return;
    }
    createBanner();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  window.CurruscosCookies = {
    getConsent,
    openSettings: () => showSettings(false),
    reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };
})();