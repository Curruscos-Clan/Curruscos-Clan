/* =========================================================
   CURRUSCOS — MIEMBROS Y AJUSTES DEL GRUPO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const access = await window.curruscosReady;

    if (!access) {
        return;
    }

    const user = access.user;
    const group = access.currentGroup;

    const membersGrid =
        document.getElementById("membersGrid");
    const subtitle =
        document.getElementById("membersSubtitle");
    const inviteButton =
        document.getElementById("inviteMemberButton");
    const nameInput =
        document.getElementById("groupSettingsName");
    const descriptionInput =
        document.getElementById(
            "groupSettingsDescription"
        );
    const saveButton =
        document.getElementById(
            "saveGroupSettingsButton"
        );
    const leaveButton =
        document.getElementById(
            "leaveGroupButton"
        );
    const deleteButton =
        document.getElementById(
            "deleteGroupButton"
        );
    const invitationContainer =
        document.getElementById(
            "memberInvitations"
        );

    if (nameInput) {
        nameInput.value =
            group.name || "";
    }

    if (descriptionInput) {
        descriptionInput.value =
            group.description || "";
    }

    /* =====================================================
       INVITACIONES RECIBIDAS
       ===================================================== */

    async function renderInvitations() {
        if (!invitationContainer) {
            return;
        }

        const invitations =
            await getMyInvitations();

        invitationContainer.innerHTML = "";

        if (!invitations.length) {
            invitationContainer.hidden =
                true;
            return;
        }

        invitationContainer.hidden =
            false;

        invitations.forEach(
            invitation => {
                const card =
                    document.createElement("article");

                card.className =
                    "member-invitation-card";

                const info =
                    document.createElement("div");

                info.className =
                    "member-invitation-info";

                const title =
                    document.createElement("strong");

                title.textContent =
                    invitation.group_name ||
                    "Nuevo grupo";

                const meta =
                    document.createElement("p");

                meta.textContent =
                    (
                        invitation.inviter_name ||
                        "Alguien"
                    ) +
                    " te ha invitado a unirte.";

                info.append(
                    title,
                    meta
                );

                const actions =
                    document.createElement("div");

                actions.className =
                    "member-invitation-actions";

                const accept =
                    document.createElement("button");

                accept.type = "button";
                accept.className =
                    "button button-primary";
                accept.textContent =
                    "Aceptar";

                accept.addEventListener(
                    "click",
                    async () => {
                        accept.disabled =
                            true;

                        try {
                            await acceptGroupInvitation(
                                invitation.id
                            );

                            setCurrentGroup(
                                invitation.group_id
                            );

                            window.location.reload();
                        } catch (error) {
                            accept.disabled =
                                false;

                            alert(
                                getSupabaseErrorMessage(
                                    error,
                                    "No se ha podido aceptar la invitación."
                                )
                            );
                        }
                    }
                );

                const reject =
                    document.createElement("button");

                reject.type = "button";
                reject.className =
                    "button button-ghost";
                reject.textContent =
                    "Rechazar";

                reject.addEventListener(
                    "click",
                    async () => {
                        reject.disabled =
                            true;

                        try {
                            await rejectGroupInvitation(
                                invitation.id
                            );

                            card.remove();

                            if (
                                !invitationContainer
                                    .querySelector(
                                        ".member-invitation-card"
                                    )
                            ) {
                                invitationContainer.hidden =
                                    true;
                            }
                        } catch (error) {
                            reject.disabled =
                                false;

                            alert(
                                getSupabaseErrorMessage(
                                    error,
                                    "No se ha podido rechazar la invitación."
                                )
                            );
                        }
                    }
                );

                actions.append(
                    accept,
                    reject
                );

                card.append(
                    info,
                    actions
                );

                invitationContainer.appendChild(
                    card
                );
            }
        );

        if (
            window.location.hash ===
            "#invitaciones"
        ) {
            invitationContainer.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    await renderInvitations();

    /* =====================================================
       AJUSTES
       ===================================================== */

    const usage = await getGroupUsage(group.id);
    if (usage) {
        const plan = usage.plan || {};
        const current = usage.usage || {};
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText("settingsPlanName", plan.name || "Free");
        setText("settingsPlanDescription", "Tu espacio incluye las herramientas disponibles en este plan.");
        setText("settingsPlanStatus", "ACTIVO");
        setText("settingsPlanMembers", current.members || 0);
        setText("settingsUsageMembers", String(current.members || 0) + " / " + String(plan.max_members || "∞"));
        setText("settingsUsageEvents", String(current.events_this_month || 0) + " / " + String(plan.max_events_per_month || "∞"));
        setText("settingsUsageTrips", String(current.trips || 0) + " / " + String(plan.max_trips || "∞"));
        const featureList = document.getElementById("workspaceFeatureList");
        if (featureList) {
            featureList.innerHTML = Object.entries(plan.features || {})
                .filter(([, enabled]) => enabled)
                .map(([feature]) => '<span class="workspace-feature">' + feature.replaceAll("_"," ") + "</span>")
                .join("");
        }
    }

    const isOwner =
        group.role === "owner";

    const canManage =
        group.role === "owner" ||
        group.role === "admin";

    if (!isOwner) {
        if (saveButton) {
            saveButton.hidden = true;
        }

        if (deleteButton) {
            deleteButton.hidden = true;
        }

        if (nameInput) {
            nameInput.disabled = true;
        }

        if (descriptionInput) {
            descriptionInput.disabled = true;
        }
    }

    if (group.role === "owner" && leaveButton) {
        leaveButton.hidden =
            true;
    }

    if (saveButton) {
        saveButton.addEventListener(
            "click",
            async () => {
                const name =
                    nameInput.value.trim();

                const description =
                    descriptionInput.value.trim();

                if (!name) {
                    alert(
                        "El nombre del grupo es obligatorio."
                    );
                    return;
                }

                saveButton.disabled =
                    true;

                saveButton.textContent =
                    "Guardando...";

                try {
                    await updateGroup(
                        group.id,
                        name,
                        description
                    );

                    window.location.reload();
                } catch (error) {
                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se han podido guardar los cambios."
                        )
                    );
                } finally {
                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Guardar cambios";
                }
            }
        );
    }

    if (leaveButton) {
        leaveButton.addEventListener(
            "click",
            async () => {
                if (isOwner) {
                    return;
                }

                const ok =
                    confirm(
                        '¿Seguro que quieres abandonar "' +
                        group.name +
                        '"?'
                    );

                if (!ok) {
                    return;
                }

                leaveButton.disabled =
                    true;

                try {
                    await leaveGroup(
                        group.id
                    );

                    const groups =
                        access.groups.filter(
                            item =>
                                item.id !== group.id
                        );

                    localStorage.removeItem(
                        "curruscos_current_group"
                    );

                    if (groups.length) {
                        setCurrentGroup(
                            groups[0].id
                        );
                    }

                    window.location.replace(
                        "dashboard.html"
                    );
                } catch (error) {
                    leaveButton.disabled =
                        false;

                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se ha podido abandonar el grupo."
                        )
                    );
                }
            }
        );
    }

    if (deleteButton) {
        deleteButton.addEventListener(
            "click",
            async () => {
                if (!isOwner) {
                    return;
                }

                if (
                    !confirm(
                        '¿Seguro que quieres eliminar "' +
                        group.name +
                        '"?'
                    )
                ) {
                    return;
                }

                if (
                    !confirm(
                        "Se eliminarán también sus eventos, tareas, gastos y contenido. Esta acción no se puede deshacer."
                    )
                ) {
                    return;
                }

                deleteButton.disabled =
                    true;

                deleteButton.textContent =
                    "Eliminando...";

                try {
                    await deleteGroup(
                        group.id
                    );

                    localStorage.removeItem(
                        "curruscos_current_group"
                    );

                    window.location.replace(
                        "onboarding.html"
                    );
                } catch (error) {
                    deleteButton.disabled =
                        false;

                    deleteButton.textContent =
                        "Eliminar grupo";

                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se ha podido eliminar el grupo."
                        )
                    );
                }
            }
        );
    }

    /* =====================================================
       INVITAR
       ===================================================== */

    if (!canManage) {
        inviteButton.hidden =
            true;
    } else if (inviteButton) {
        inviteButton.addEventListener(
            "click",
            async () => {
                const username =
                    prompt(
                        "Introduce el nombre de usuario que quieres invitar:"
                    );

                if (
                    !username ||
                    !username.trim()
                ) {
                    return;
                }

                inviteButton.disabled =
                    true;

                inviteButton.textContent =
                    "Enviando...";

                try {
                    await inviteUserByUsername(
                        group.id,
                        username.trim()
                    );

                    alert(
                        "Invitación enviada correctamente."
                    );
                } catch (error) {
                    alert(
                        getSupabaseErrorMessage(
                            error,
                            "No se ha podido enviar la invitación."
                        )
                    );
                } finally {
                    inviteButton.disabled =
                        false;

                    inviteButton.textContent =
                        "+ Invitar miembro";
                }
            }
        );
    }

    /* =====================================================
       MIEMBROS
       ===================================================== */

    const members =
        await getGroupMembers(group.id);

    subtitle.textContent =
        members.length === 1
            ? "1 persona forma parte de este grupo."
            : members.length +
              " personas forman parte de este grupo.";

    membersGrid.innerHTML = "";

    const initial =
        name =>
            (name || "U")
                .trim()
                .charAt(0)
                .toUpperCase();

    members.forEach(member => {
        const card =
            document.createElement("article");

        card.className =
            "member-card";

        const displayName =
            member.display_name ||
            member.username ||
            "Usuario";

        const role =
            member.role || "member";

        const info =
            document.createElement("div");

        info.className =
            "member-info";

        const avatar =
            document.createElement("div");

        avatar.className =
            "member-avatar";

        avatar.textContent =
            initial(displayName);

        const content =
            document.createElement("div");

        content.className =
            "member-copy";

        const title =
            document.createElement("h3");

        title.textContent =
            displayName +
            (
                member.user_id === user.id
                    ? " · Tú"
                    : ""
            );

        const username =
            document.createElement("p");

        username.textContent =
            member.username
                ? "@" + member.username
                : "Sin nombre de usuario";

        const badge =
            document.createElement("span");

        badge.className =
            "member-role-badge";

        badge.textContent =
            roleLabel(role);

        content.append(
            title,
            username,
            badge
        );

        info.append(
            avatar,
            content
        );

        card.appendChild(
            info
        );

        const targetIsOwner =
            role === "owner";

        const canManageTarget =
            group.role === "owner"
                ? !targetIsOwner &&
                  member.user_id !== user.id
                : group.role === "admin" &&
                  role === "member" &&
                  member.user_id !== user.id;

        if (canManageTarget) {
            const actions =
                document.createElement("div");

            actions.className =
                "member-card-actions";

            if (
                group.role === "owner" &&
                !targetIsOwner
            ) {
                const roleSelect =
                    document.createElement("select");

                roleSelect.className =
                    "member-role-select";

                roleSelect.innerHTML =
                    '<option value="member">Miembro</option>' +
                    '<option value="admin">Administrador</option>';

                roleSelect.value =
                    role === "admin"
                        ? "admin"
                        : "member";

                roleSelect.addEventListener(
                    "change",
                    async () => {
                        const newRole =
                            roleSelect.value;

                        try {
                            await changeGroupMemberRole(
                                group.id,
                                member.user_id,
                                newRole
                            );

                            badge.textContent =
                                roleLabel(newRole);
                        } catch (error) {
                            roleSelect.value =
                                role === "admin"
                                    ? "admin"
                                    : "member";

                            alert(
                                getSupabaseErrorMessage(
                                    error,
                                    "No se ha podido cambiar el rol."
                                )
                            );
                        }
                    }
                );

                actions.appendChild(
                    roleSelect
                );
            }

            const remove =
                document.createElement("button");

            remove.type = "button";
            remove.className =
                "member-remove-button";
            remove.textContent =
                "Expulsar";

            remove.addEventListener(
                "click",
                async () => {
                    if (
                        !confirm(
                            "¿Seguro que quieres expulsar a " +
                            displayName +
                            "?"
                        )
                    ) {
                        return;
                    }

                    remove.disabled =
                        true;

                    try {
                        await removeGroupMember(
                            group.id,
                            member.user_id
                        );

                        card.remove();
                    } catch (error) {
                        remove.disabled =
                            false;

                        alert(
                            getSupabaseErrorMessage(
                                error,
                                "No se ha podido expulsar al miembro."
                            )
                        );
                    }
                }
            );

            actions.appendChild(
                remove
            );

            card.appendChild(
                actions
            );
        }

        membersGrid.appendChild(
            card
        );
    });
});
