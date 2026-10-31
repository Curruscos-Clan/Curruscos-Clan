/* CURRUSCOS — PERFIL 2.0
   El perfil no puede quedarse bloqueado esperando una consulta secundaria.
*/
document.addEventListener("DOMContentLoaded", async () => {
    // Evita que una traducción pendiente deje el perfil en blanco.
    await Promise.race([
        Promise.resolve(window.curruscosI18n?.ready).catch(error => console.warn("i18n no disponible en perfil:", error)),
        new Promise(resolve => setTimeout(resolve, 1200))
    ]);

    const page = document.querySelector(".profile-page");
    const authView = document.getElementById("profileAuthView");
    const authenticatedView = document.getElementById("profileAuthenticatedView");
    const authForm = document.getElementById("profileAuthForm");
    const authEmail = document.getElementById("profileAuthEmail");
    const authPassword = document.getElementById("profileAuthPassword");
    const authSubmit = document.getElementById("profileAuthSubmit");
    const authMessage = document.getElementById("profileAuthMessage");
    const logoutButton = document.getElementById("profileLogoutButton");

    const setStatus = (text, kind="") => {
        const el = document.getElementById("profileMessage");
        if (el) { el.textContent = text || ""; el.dataset.state = kind; }
    };
    const safe = async (promise, fallback, label) => {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve(promise),
                new Promise(resolve => {
                    timer = setTimeout(() => resolve(fallback), 8000);
                })
            ]);
        } catch (error) {
            console.error("Perfil:", label, error);
            return fallback;
        } finally {
            clearTimeout(timer);
        }
    };
    const showGuestView = () => {
        if (authView) authView.hidden = false;
        if (authenticatedView) authenticatedView.hidden = true;
        page?.classList.remove("is-loading", "is-ready");
    };

    authForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!authEmail?.value.trim() || !authPassword?.value) return;
        authSubmit.disabled = true;
        authSubmit.textContent = "Entrando…";
        if (authMessage) { authMessage.textContent = ""; authMessage.dataset.state = ""; }
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: authEmail.value.trim().toLowerCase(),
                password: authPassword.value
            });
            if (error) throw error;
            window.location.reload();
        } catch (error) {
            console.error("Error iniciando sesión desde el perfil:", error);
            if (authMessage) {
                authMessage.textContent = getSupabaseErrorMessage(error, "No se ha podido iniciar sesión. Comprueba tus datos.");
                authMessage.dataset.state = "error";
            }
            authSubmit.disabled = false;
            authSubmit.textContent = "Iniciar sesión";
        }
    });

    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Cerrando sesión…";
        try {
            const ok = await signOut();
            if (!ok) throw new Error("No se ha podido cerrar la sesión.");
            window.location.reload();
        } catch (error) {
            console.error("Error cerrando sesión:", error);
            logoutButton.disabled = false;
            logoutButton.textContent = "Cerrar sesión";
            setStatus(getSupabaseErrorMessage(error, "No se ha podido cerrar la sesión."), "error");
        }
    });

    // La página de perfil también es accesible como invitado. La autenticación
    // se comprueba aquí, sin depender del shell privado ni de un grupo activo.
    page?.classList.add("is-loading");
    const authCheckFailed = { authCheckFailed: true };
    const user = await safe(getCurrentUser(true, { throwOnError: true }), authCheckFailed, "auth");
    if (user === authCheckFailed) {
        showGuestView();
        if (authMessage) {
            authMessage.textContent = "No se ha podido comprobar tu sesión. Comprueba tu conexión e inténtalo de nuevo.";
            authMessage.dataset.state = "error";
        }
        return;
    }
    if (!user) {
        showGuestView();
        return;
    }
    if (authView) authView.hidden = true;
    if (authenticatedView) authenticatedView.hidden = false;
    const access = { user };

    const profile = await safe(getCurrentProfile(true, { throwOnError: true }), null, "profile");
    if (!profile) {
        page?.classList.remove("is-loading");
        setStatus("No se ha podido cargar tu perfil. Comprueba tu conexión y recarga la página.", "error");
        return;
    }

    const displayName = document.getElementById("displayName");
    const username = document.getElementById("username");
    const email = document.getElementById("profileEmail");
    const avatar = document.getElementById("profileAvatar");
    const cityInput = document.getElementById("profileCity");
    const bioInput = document.getElementById("profileBio");
    const avatarUrlInput = document.getElementById("profileAvatarUrl");
    const avatarFileInput = document.getElementById("profileAvatarFile");
    const interestGrid = document.getElementById("interestGrid");
    const interestSave = document.getElementById("saveInterestsButton");
    const interestMessage = document.getElementById("interestMessage");

    displayName.value = profile.display_name || "";
    username.value = profile.username || "";
    cityInput.value = profile.city || "";
    bioInput.value = profile.bio || "";
    avatarUrlInput.value = profile.avatar_url || "";
    email.textContent = access.user.email || "";

    const paintAvatar = (url, displayLabel) => {
        const fallback = String(displayLabel || "C").trim().charAt(0).toUpperCase() || "C";
        avatar.replaceChildren();
        let safeUrl = "";
        try {
            const parsed = new URL(String(url || "").trim());
            if (parsed.protocol === "https:" && !parsed.username && !parsed.password) safeUrl = parsed.href;
        } catch (_) {}
        if (!safeUrl) {
            avatar.textContent = fallback;
            return;
        }
        const img = document.createElement("img");
        img.src = safeUrl;
        img.alt = "Foto de perfil";
        img.referrerPolicy = "no-referrer";
        img.loading = "lazy";
        img.addEventListener("error", () => { avatar.textContent = fallback; }, { once: true });
        avatar.appendChild(img);
    };
    paintAvatar(profile.avatar_url, profile.display_name || profile.username);

    page?.classList.remove("is-loading");
    page?.classList.add("is-ready");

    // Intereses: si fallan no bloquean el resto del perfil.
    // Los controles de intereses se activan inmediatamente; la consulta inicial
    // se ejecuta en segundo plano y no bloquea el guardado del perfil.
    let interestsTouched = false;
    const interestsPromise = safe(getMyInterests(), [], "interests");
    interestGrid?.querySelectorAll("[data-interest]").forEach(btn => {
        btn.addEventListener("click", () => {
            interestsTouched = true;
            const next = btn.getAttribute("aria-pressed") !== "true";
            btn.setAttribute("aria-pressed", String(next));
        });
    });

    interestSave?.addEventListener("click", async () => {
        interestSave.disabled = true;
        interestSave.textContent = t("profile.saving");
        if (interestMessage) { interestMessage.textContent = ""; interestMessage.dataset.state = ""; }
        try {
            await interestsPromise;
            const selected = [...(interestGrid?.querySelectorAll('[aria-pressed="true"]') || [])].map(x => x.dataset.interest);
            const saved = await setMyInterests(selected);
            if (!saved) throw new Error(t("profile.interestsError"));
            if (interestMessage) {
                interestMessage.textContent = selected.length
                    ? t("profile.interestsSaved", {count:selected.length})
                    : t("profile.interestsUpdated");
                interestMessage.dataset.state = "success";
            }
        } catch (error) {
            if (interestMessage) {
                interestMessage.textContent = getSupabaseErrorMessage(error, t("profile.interestsError"));
                interestMessage.dataset.state = "error";
            }
        } finally {
            interestSave.disabled = false;
            interestSave.textContent = t("profile.saveInterests");
        }
    });

    interestsPromise.then(interests => {
        if (interestsTouched) return;
        interestGrid?.querySelectorAll("[data-interest]").forEach(btn => {
            btn.setAttribute("aria-pressed", interests.includes(btn.dataset.interest) ? "true" : "false");
        });
    });
    const form=document.getElementById("profileForm");
    const button=document.getElementById("saveProfileButton");
    form?.addEventListener("submit", async event => {
        event.preventDefault();
        button.disabled=true;
        button.textContent=t("profile.saving");
        setStatus("", "");
        const originalAvatarUrl = avatarUrlInput.value;
        let uploadedAvatarUrl = "";
        try {
            let avatarUrl = avatarUrlInput.value.trim();
            const avatarFile = avatarFileInput?.files?.[0];
            if (avatarFile) {
                if (!window.AppStorage?.uploadUserAvatar) {
                    throw new Error("La subida de fotos no está disponible. Recarga la página e inténtalo de nuevo.");
                }
                setStatus("Optimizando y subiendo tu foto…", "");
                uploadedAvatarUrl = await window.AppStorage.uploadUserAvatar(avatarFile, access.user.id);
                avatarUrl = uploadedAvatarUrl;
                avatarUrlInput.value = avatarUrl;
            }
            const updated=await updateProfile(displayName.value, username.value, {
                city: cityInput.value,
                bio: bioInput.value,
                avatar_url: avatarUrl
            });
            if (uploadedAvatarUrl && originalAvatarUrl && originalAvatarUrl !== uploadedAvatarUrl && window.AppStorage?.removeUserAvatar) {
                try { await window.AppStorage.removeUserAvatar(originalAvatarUrl); }
                catch (cleanupError) { console.warn("No se pudo limpiar el avatar anterior; el perfil ya está guardado.", cleanupError); }
            }
            cityInput.value = updated.city || "";
            bioInput.value = updated.bio || "";
            avatarUrlInput.value = updated.avatar_url || "";
            if (avatarFileInput) avatarFileInput.value = "";
            paintAvatar(updated.avatar_url, updated.display_name || updated.username);
            setStatus(t("profile.saved"), "success");
            window.dispatchEvent(new CustomEvent("curruscos:profile-updated",{detail:updated}));
        } catch(error) {
            if (uploadedAvatarUrl && window.AppStorage?.removeUserAvatar) {
                try { await window.AppStorage.removeUserAvatar(uploadedAvatarUrl); } catch (cleanupError) { console.warn("No se pudo limpiar la subida de avatar fallida.", cleanupError); }
            }
            avatarUrlInput.value = originalAvatarUrl;
            setStatus(getSupabaseErrorMessage(error,t("profile.saveError")), "error");
        } finally {
            button.disabled=false;
            button.textContent=t("profile.save");
        }
    });

    // La actividad es secundaria: se carga después de activar el formulario.
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
        ["Organizados",activity.organizing.length],
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


});
