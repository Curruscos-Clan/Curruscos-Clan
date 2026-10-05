/* CURRUSCOS — PERFIL 2.0
   El perfil no puede quedarse bloqueado esperando una consulta secundaria.
*/
document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;

    const page = document.querySelector(".profile-page");
    const setStatus = (text, kind="") => {
        const el = document.getElementById("profileMessage");
        if (el) { el.textContent = text || ""; el.dataset.state = kind; }
    };
    const safe = async (promise, fallback, label) => {
        try {
            return await Promise.race([
                Promise.resolve(promise),
                new Promise(resolve => setTimeout(() => resolve(fallback), 8000))
            ]);
        } catch (error) {
            console.error("Perfil:", label, error);
            return fallback;
        }
    };

    // Pintamos la estructura primero. Las consultas lentas son secundarias.
    page?.classList.add("is-loading");
    const access = await safe(window.curruscosReady, null, "auth");
    if (!access) {
        page?.classList.remove("is-loading");
        return;
    }

    const profile = await safe(getCurrentProfile(), null, "profile");
    if (!profile) {
        page?.classList.remove("is-loading");
        setStatus("No se ha podido cargar tu perfil. Recarga la página.", "error");
        return;
    }

    const displayName = document.getElementById("displayName");
    const username = document.getElementById("username");
    const email = document.getElementById("profileEmail");
    const avatar = document.getElementById("profileAvatar");
    const interestGrid = document.getElementById("interestGrid");
    const interestSave = document.getElementById("saveInterestsButton");
    const interestMessage = document.getElementById("interestMessage");

    displayName.value = profile.display_name || "";
    username.value = profile.username || "";
    email.textContent = access.user.email || "";
    avatar.textContent = (profile.display_name || profile.username || "C").charAt(0).toUpperCase();

    page?.classList.remove("is-loading");
    page?.classList.add("is-ready");

    // Intereses: si fallan no bloquean el resto del perfil.
    const interests = await safe(getMyInterests(), [], "interests");
    interestGrid?.querySelectorAll("[data-interest]").forEach(btn => {
        btn.setAttribute("aria-pressed", interests.includes(btn.dataset.interest) ? "true" : "false");
        btn.addEventListener("click", () => {
            const next = btn.getAttribute("aria-pressed") !== "true";
            btn.setAttribute("aria-pressed", String(next));
        });
    });

    interestSave?.addEventListener("click", async () => {
        interestSave.disabled = true;
        interestSave.textContent = t("profile.saving");
        interestMessage.textContent = "";
        try {
            const selected = [...interestGrid.querySelectorAll('[aria-pressed="true"]')].map(x => x.dataset.interest);
            await setMyInterests(selected);
            interestMessage.textContent = selected.length
                ? t("profile.interestsSaved", {count:selected.length})
                : t("profile.interestsUpdated");
        } catch (error) {
            interestMessage.textContent = getSupabaseErrorMessage(error, t("profile.interestsError"));
        } finally {
            interestSave.disabled = false;
            interestSave.textContent = t("profile.saveInterests");
        }
    });

    // Actividad: una consulta lenta no debe bloquear el editor.
    const activity = await safe(getMyEventActivity(), {participating:[], organizing:[], teams:[], matches:[], activityTypes:[]}, "activity");
    const stats = document.getElementById("profileActivityStats");
    const teamsRoot = document.getElementById("profileTeams");
    const resultsRoot = document.getElementById("profileResults");
    const finished = activity.matches || [];
    const teamIds = new Set((activity.teams || []).map(t => t.id));
    let wins=0, draws=0, losses=0;
    finished.forEach(m => {
        const home = teamIds.has(m.home_team_id), away = teamIds.has(m.away_team_id);
        if (!home && !away) return;
        const hs=Number(m.home_score), as=Number(m.away_score);
        if (hs===as) draws++;
        else if ((home&&hs>as)||(away&&as>hs)) wins++;
        else losses++;
    });
    const upcoming=(activity.participating||[]).filter(e=>new Date(e.date+"T"+(e.time||"23:59"))>=new Date()).length;
    const cards=[
        [t("profile.events"),activity.participating.length],
        [t("profile.upcoming"),upcoming],
        [t("profile.matches"),finished.length],
        [t("profile.wins"),wins],
        [t("profile.draws"),draws],
        [t("profile.losses"),losses]
    ];
    stats.innerHTML=cards.map(([label,value])=>'<div class="profile-activity-card"><span>'+label+'</span><strong>'+value+'</strong></div>').join("");
    teamsRoot.innerHTML=activity.teams?.length
        ? '<strong>'+t("profile.teams")+'</strong>'+activity.teams.map(team=>'<div>'+escapeHtml(team.name)+'<small>'+t("profile.eventTeam")+'</small></div>').join("")
        : '<strong>'+t("profile.teams")+'</strong><div class="profile-muted-row">Todavía no formas parte de ningún equipo.</div>';
    const typeLabels={padel:t("activity.padel"),futbol:t("activity.futbol"),baloncesto:t("activity.baloncesto"),tenis:t("activity.tenis"),ajedrez:t("activity.ajedrez"),gaming:t("activity.gaming"),running:t("activity.running"),otro:t("activity.otherPlural")};
    resultsRoot.innerHTML='<strong>'+t("profile.activity")+'</strong><div>'+
        ((activity.activityTypes||[]).map(type=>typeLabels[type]||type).join(" · ")||t("profile.noActivity"))+
        '<small>'+activity.organizing.length+' evento'+(activity.organizing.length===1?"":"s")+' organizado'+(activity.organizing.length===1?"":"s")+'</small></div>';

    const form=document.getElementById("profileForm");
    const button=document.getElementById("saveProfileButton");
    form?.addEventListener("submit", async event => {
        event.preventDefault();
        button.disabled=true;
        button.textContent=t("profile.saving");
        setStatus("", "");
        try {
            const updated=await updateProfile(displayName.value,username.value);
            avatar.textContent=(updated.display_name||updated.username||"C").charAt(0).toUpperCase();
            setStatus(t("profile.saved"), "success");
            window.dispatchEvent(new CustomEvent("curruscos:profile-updated",{detail:updated}));
        } catch(error) {
            setStatus(getSupabaseErrorMessage(error,t("profile.saveError")), "error");
        } finally {
            button.disabled=false;
            button.textContent=t("profile.save");
        }
    });
});
