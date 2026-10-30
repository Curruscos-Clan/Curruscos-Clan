(() => {
  "use strict";

  const STORAGE_KEY = "curruscos_accent_tone";
  const tones = {
    orange: { main: "#f2553b", hover: "#db4632", soft: "rgba(242,85,59,.12)" },
    violet: { main: "#7652c8", hover: "#6342ad", soft: "rgba(118,82,200,.12)" },
    green: { main: "#187b61", hover: "#126750", soft: "rgba(24,123,97,.12)" }
  };
  const properties = [
    "--color-primary", "--color-primary-hover", "--color-primary-subtle",
    "--border-focus", "--accent", "--home-accent", "--profile-accent",
    "--create-accent", "--explore-orange", "--dashboard-accent", "--settings-accent"
  ];

  function applyAccent(tone) {
    const selected = tones[tone] ? tone : "orange";
    const palette = tones[selected];
    const values = [palette.main, palette.hover, palette.soft, palette.main, palette.main,
      palette.main, palette.main, palette.main, palette.main, palette.main, palette.main];
    document.documentElement.dataset.accentTone = selected;
    [document.documentElement, document.body].filter(Boolean).forEach(element => {
      properties.forEach((property, index) => element.style.setProperty(property, values[index]));
    });
    return selected;
  }

  function init() {
    let savedTone = "orange";
    try { savedTone = localStorage.getItem(STORAGE_KEY) || "orange"; } catch (_) {}
    const selected = applyAccent(savedTone);
    const selector = document.getElementById("accentToneSetting");
    if (selector) {
      selector.value = selected;
      selector.addEventListener("change", () => {
        const tone = applyAccent(selector.value);
        try { localStorage.setItem(STORAGE_KEY, tone); } catch (_) {}
      });
    }

    document.getElementById("openCookieSettings")?.addEventListener("click", () => {
      if (window.CurruscosCookies?.openSettings) window.CurruscosCookies.openSettings();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
