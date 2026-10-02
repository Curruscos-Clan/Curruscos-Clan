/* =========================================================
   CURRUSCOS — PERFIL
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const access =
        await window.curruscosReady;

    if (!access) {
        return;
    }

    const profile =
        await getCurrentProfile();

    if (!profile) {
        return;
    }

    const displayName =
        document.getElementById(
            "displayName"
        );

    const username =
        document.getElementById(
            "username"
        );

    const email =
        document.getElementById(
            "profileEmail"
        );

    const avatar =
        document.getElementById(
            "profileAvatar"
        );

    const activity=await getMyEventActivity();const stats=document.getElementById("profileActivityStats");const teamsRoot=document.getElementById("profileTeams");const resultsRoot=document.getElementById("profileResults");const finished=activity.matches||[];const teamIds=new Set(activity.teams.map(t=>t.id));let wins=0,draws=0,losses=0;finished.forEach(m=>{const mineHome=teamIds.has(m.home_team_id),mineAway=teamIds.has(m.away_team_id);if(!mineHome&&!mineAway)return;const hs=Number(m.home_score),as=Number(m.away_score);if(hs===as)draws++;else if((mineHome&&hs>as)||(mineAway&&as>hs))wins++;else losses++;});const upcoming=activity.participating.filter(e=>new Date(e.date+"T"+(e.time||"23:59"))>=new Date()).length;const typeLabels={padel:"Pádel",futbol:"Fútbol",baloncesto:"Baloncesto",tenis:"Tenis",ajedrez:"Ajedrez",gaming:"Gaming",running:"Running",otro:"Otros"};stats.innerHTML=`<div class="profile-activity-card"><span>Eventos</span><strong>${activity.participating.length}</strong></div><div class="profile-activity-card"><span>Próximos</span><strong>${upcoming}</strong></div><div class="profile-activity-card"><span>Partidos</span><strong>${finished.length}</strong></div><div class="profile-activity-card"><span>Victorias</span><strong>${wins}</strong></div><div class="profile-activity-card"><span>Empates</span><strong>${draws}</strong></div><div class="profile-activity-card"><span>Derrotas</span><strong>${losses}</strong></div>`;teamsRoot.innerHTML=activity.teams.length?`<strong>Equipos</strong>${activity.teams.map(t=>`<div>${String(t.name).replace(/</g,"&lt;")}<small>Equipo de evento</small></div>`).join("")}`:"";const types=activity.activityTypes||[];resultsRoot.innerHTML=`<strong>Actividad</strong><div>${types.length?types.map(t=>typeLabels[t]||t).join(" · "):"Todavía no has participado en actividades."}<small>${activity.organizing.length} evento${activity.organizing.length===1?"":"s"} organizado${activity.organizing.length===1?"":"s"}</small></div>`+(finished.length?finished.slice(0,5).map(m=>`<div>Ronda ${m.round_number}<small>${m.home_score} : ${m.away_score}</small></div>`).join(""):"");

    const form =
        document.getElementById(
            "profileForm"
        );

    const button =
        document.getElementById(
            "saveProfileButton"
        );

    const message =
        document.getElementById(
            "profileMessage"
        );

    displayName.value =
        profile.display_name ||
        "";

    username.value =
        profile.username ||
        "";

    email.textContent =
        access.user.email || "";

    avatar.textContent =
        (
            profile.display_name ||
            profile.username ||
            "C"
        )
        .charAt(0)
        .toUpperCase();

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            button.disabled =
                true;

            button.textContent =
                "Guardando...";

            message.textContent =
                "";

            try {
                const updated =
                    await updateProfile(
                        displayName.value,
                        username.value
                    );

                avatar.textContent =
                    (
                        updated.display_name ||
                        updated.username ||
                        "C"
                    )
                    .charAt(0)
                    .toUpperCase();

                message.textContent =
                    "Perfil guardado correctamente.";

                setTimeout(
                    () => {
                        message.textContent = "";
                    },
                    2500
                );
            } catch (error) {
                message.textContent =
                    getSupabaseErrorMessage(
                        error,
                        "No se ha podido actualizar el perfil."
                    );
            } finally {
                button.disabled =
                    false;

                button.textContent =
                    "Guardar perfil";
            }
        }
    );
});
