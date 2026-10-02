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

    const activity=await getMyEventActivity();const stats=document.getElementById("profileActivityStats");const teamsRoot=document.getElementById("profileTeams");const resultsRoot=document.getElementById("profileResults");const finished=activity.matches||[];stats.innerHTML=`<div class="profile-activity-card"><span>Inscritos</span><strong>${activity.participating.length}</strong></div><div class="profile-activity-card"><span>Organizados</span><strong>${activity.organizing.length}</strong></div><div class="profile-activity-card"><span>Partidos</span><strong>${finished.length}</strong></div>`;teamsRoot.innerHTML=activity.teams.length?`<strong>Equipos</strong>${activity.teams.map(t=>`<div>${String(t.name).replace(/</g,"&lt;")}<small>Equipo de evento</small></div>`).join("")}`:"";resultsRoot.innerHTML=finished.length?`<strong>Últimos resultados</strong>${finished.slice(0,5).map(m=>`<div>Partido de ${m.round_number}ª ronda<small>${m.home_score} : ${m.away_score}</small></div>`).join("")}`:"";\n\n    const form =
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
