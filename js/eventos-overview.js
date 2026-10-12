/* CURRUSCOS — Resumen real del grupo en la página Mi grupo.
   Reutiliza el workspace activo, el RPC de miembros y los eventos privados cifrados existentes. */
(function () {
    const ROLE_LABELS = { owner: "Propietario", admin: "Admin", member: "Miembro" };

    function safeImageUrl(value) {
        try {
            const url = new URL(String(value || "").trim());
            return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
        } catch (_) {
            return "";
        }
    }

    function formatCount(value) {
        return new Intl.NumberFormat("es-ES").format(Number(value) || 0);
    }

    function eventTimestamp(event) {
        if (!event?.date) return null;
        const d = new Date(String(event.date) + "T" + String(event.time || "00:00"));
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }

    function createMemberChip(member) {
        const name = String(member.display_name || member.username || "Miembro").trim() || "Miembro";
        const chip = document.createElement("div");
        chip.className = "group-member-chip";
        chip.title = member.username ? name + " · @" + member.username : name;

        const avatar = document.createElement("span");
        avatar.className = "group-member-avatar";
        const imageUrl = safeImageUrl(member.avatar_url);
        if (imageUrl) {
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = "";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            img.addEventListener("error", () => { avatar.textContent = name.charAt(0).toUpperCase(); }, { once: true });
            avatar.appendChild(img);
        } else {
            avatar.textContent = name.charAt(0).toUpperCase();
        }

        const label = document.createElement("strong");
        label.textContent = name;
        chip.append(avatar, label);
        return chip;
    }

    async function renderGroupOverview() {
        const panel = document.getElementById("groupOverviewPanel");
        if (!panel) return;

        try {
            const access = await window.curruscosReady;
            const group = access?.currentGroup;
            if (!access?.user || !group?.id) return;

            const [members, events] = await Promise.all([
                getGroupMembers(group.id),
                getGroupEvents()
            ]);

            const setText = (id, value) => {
                const node = document.getElementById(id);
                if (node) node.textContent = value;
            };
            const groupName = String(group.name || "Tu grupo").trim() || "Tu grupo";
            setText("groupOverviewAvatar", groupName.charAt(0).toUpperCase());
            setText("groupOverviewName", groupName);
            setText("groupOverviewDescription", group.description || "Un espacio compartido para organizar planes y mantener al grupo coordinado.");
            setText("groupOverviewMemberCount", formatCount(members.length));
            setText("groupOverviewRole", ROLE_LABELS[group.role] || "Miembro");

            const now = Date.now();
            const upcoming = (events || []).filter(event => {
                if (["finished", "cancelled"].includes(String(event.status || "").toLowerCase())) return false;
                const timestamp = eventTimestamp(event);
                return timestamp !== null && timestamp >= now;
            });
            setText("groupOverviewPlanCount", formatCount(upcoming.length));

            const memberRoot = document.getElementById("groupOverviewMembers");
            if (memberRoot) {
                memberRoot.replaceChildren();
                const visible = (members || []).slice(0, 5);
                visible.forEach(member => memberRoot.appendChild(createMemberChip(member)));
                if (members.length > visible.length) {
                    const more = document.createElement("span");
                    more.className = "group-member-more";
                    more.textContent = "+" + formatCount(members.length - visible.length) + " más";
                    memberRoot.appendChild(more);
                }
                if (!members.length) {
                    const empty = document.createElement("span");
                    empty.className = "group-member-more";
                    empty.textContent = "Todavía no hay miembros para mostrar.";
                    memberRoot.appendChild(empty);
                }
            }
        } catch (error) {
            console.error("No se pudo cargar el resumen del grupo:", error);
            const description = document.getElementById("groupOverviewDescription");
            if (description) description.textContent = "No se ha podido cargar el resumen del grupo. El resto de la página sigue disponible.";
            const memberRoot = document.getElementById("groupOverviewMembers");
            if (memberRoot) memberRoot.textContent = "Resumen no disponible";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderGroupOverview, { once: true });
    } else {
        renderGroupOverview();
    }
})();
