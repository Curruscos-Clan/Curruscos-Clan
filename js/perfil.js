/* =========================================================
   CURRUSCOS — PERFIL
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
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
    const interestGrid=document.getElementById("interestGrid");
    const interestSave=document.getElementById("saveInterestsButton");
    const interestMessage=document.getElementById("interestMessage");
    const interests=await getMyInterests();
    interestGrid.querySelectorAll("[data-interest]").forEach(btn=>{
        btn.setAttribute("aria-pressed",interests.includes(btn.dataset.interest)?"true":"false");
        btn.addEventListener("click",()=>btn.setAttribute("aria-pressed",btn.getAttribute("aria-pressed")==="true"?"false":"true"));
    });
    interestSave.addEventListener("click",async()=>{
        interestSave.disabled=true; interestSave.textContent=t("profile.saving"); interestMessage.textContent="";
        try{
            const selected=[...interestGrid.querySelectorAll('[aria-pressed="true"]')].map(x=>x.dataset.interest);
            await setMyInterests(selected);
            interestMessage.textContent=selected.length ? t("profile.interestsSaved",{count:selected.length}) : t("profile.interestsUpdated");
        }catch(error){interestMessage.textContent=getSupabaseErrorMessage(error,t("profile.interestsError"));}
        finally{interestSave.disabled=false;interestSave.textContent=t("profile.saveInterests");}
    });


    const activity=await getMyEventActivity();const stats=document.getElementById("profileActivityStats");const teamsRoot=document.getElementById("profileTeams");const resultsRoot=document.getElementById("profileResults");const finished=activity.matches||[];const teamIds=new Set(activity.teams.map(t=>t.id));let wins=0,draws=0,losses=0;finished.forEach(m=>{const mineHome=teamIds.has(m.home_team_id),mineAway=teamIds.has(m.away_team_id);if(!mineHome&&!mineAway)return;const hs=Number(m.home_score),as=Number(m.away_score);if(hs===as)draws++;else if((mineHome&&hs>as)||(mineAway&&as>hs))wins++;else losses++;});const upcoming=activity.participating.filter(e=>new Date(e.date+"T"+(e.time||"23:59"))>=new Date()).length;const typeLabels={padel:t("activity.padel"),futbol:t("activity.futbol"),baloncesto:t("activity.baloncesto"),tenis:t("activity.tenis"),ajedrez:t("activity.ajedrez"),gaming:t("activity.gaming"),running:t("activity.running"),otro:t("activity.otherPlural")};stats.innerHTML=`<div class="profile-activity-card"><span>${t("profile.events")}</span><strong>${activity.participating.length}</strong></div><div class="profile-activity-card"><span>${t("profile.upcoming")}</span><strong>${upcoming}</strong></div><div class="profile-activity-card"><span>${t("profile.matches")}</span><strong>${finished.length}</strong></div><div class="profile-activity-card"><span>${t("profile.wins")}</span><strong>${wins}</strong></div><div class="profile-activity-card"><span>${t("profile.draws")}</span><strong>${draws}</strong></div><div class="profile-activity-card"><span>${t("profile.losses")}</span><strong>${losses}</strong></div>`;teamsRoot.innerHTML=activity.teams.length?`<strong>${t("profile.teams")}</strong>${activity.teams.map(t=>`<div>${String(t.name).replace(/</g,"&lt;")}<small>${t("profile.eventTeam")}</small></div>`).join("")}`:"";const types=activity.activityTypes||[];resultsRoot.innerHTML=`<strong>${t("profile.activity")}</strong><div>${types.length?types.map(t=>typeLabels[t]||t).join(" · "):t("profile.noActivity")}<small>${activity.organizing.length} evento${activity.organizing.length===1?"":"s"} organizado${activity.organizing.length===1?"":"s"}</small></div>`+(finished.length?finished.slice(0,5).map(m=>`<div>Ronda ${m.round_number}<small>${m.home_score} : ${m.away_score}</small></div>`).join(""):"");

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
                        t("profile.saveError")
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
