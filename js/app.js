/* =========================================================
   SHELL PRIVADO
   ========================================================= */

function ensureProductNavigation() {
    const nav = document.getElementById("mainNav");
    if (!nav) return;
    const links = [
        { href: "index.html", text: "Inicio" },
        { href: "explorar.html", text: "Explorar" },
        { href: "guardados.html", text: "Guardados" },