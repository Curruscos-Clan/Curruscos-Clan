/* =========================================================
   CURRUSCOS — ONBOARDING
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const user =
        await getCurrentUser();

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    const existingGroups =
        await getUserGroups(true);

    if (existingGroups.length) {
        setCurrentGroup(existingGroups[0].id);
        window.location.replace("dashboard.html");
        return;
    }

    const form =
        document.getElementById(
            "createGroupForm"
        );

    const button =
        document.getElementById(
            "createGroupButton"
        );

    const message =
        document.getElementById(
            "onboardingMessage"
        );

    if (!form || !button || !message) {
        return;
    }

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const name =
                document.getElementById(
                    "groupName"
                )
                .value
                .trim();

            const description =
                document.getElementById(
                    "groupDescription"
                )
                .value
                .trim();

            if (!name) {
                message.textContent =
                    "Escribe un nombre para el grupo.";
                return;
            }

            button.disabled = true;
            message.textContent =
                "Creando vuestro espacio...";

            try {
                const group =
                    await createGroup(
                        name,
                        description
                    );

                if (!group) {
                    throw new Error(
                        "No se ha podido crear el grupo."
                    );
                }

                setCurrentGroup(
                    group.id
                );

                message.textContent =
                    "Grupo creado. Entrando...";

                window.location.replace(
                    "dashboard.html"
                );
            } catch (error) {
                message.textContent =
                    getSupabaseErrorMessage(
                        error,
                        "No se ha podido crear el grupo."
                    );
                button.disabled = false;
            }
        }
    );
});
