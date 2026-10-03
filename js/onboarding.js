/* =========================================================
   CURRUSCOS — ONBOARDING
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;

    const user = await getCurrentUser();
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    const existingGroups = await getUserGroups(true);
    if (existingGroups.length) {
        setCurrentGroup(existingGroups[0].id);
        window.location.replace("dashboard.html");
        return;
    }

    const form = document.getElementById("createGroupForm");
    const button = document.getElementById("createGroupButton");
    const message = document.getElementById("onboardingMessage");
    const type = document.getElementById("groupType");
    const size = document.getElementById("groupSize");
    const objective = document.getElementById("groupObjective");

    if (!form || !button || !message) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const name = document.getElementById("groupName")?.value.trim() || "";
        const description = document.getElementById("groupDescription")?.value.trim() || "";

        if (!name) {
            message.textContent = t("group.nameRequired");
            document.getElementById("groupName")?.focus();
            return;
        }

        button.disabled = true;
        message.textContent = t("group.creating");

        try {
            const group = await createGroup(
                name,
                description,
                type?.value || "community",
                size?.value || "small",
                objective?.value?.trim() || ""
            );

            if (!group) throw new Error(t("group.createError"));

            setCurrentGroup(group.id);
            message.textContent = t("group.created");

            window.setTimeout(() => {
                window.location.replace("dashboard.html");
            }, 180);
        } catch (error) {
            const code = String(error?.message || "").toUpperCase();
            const known = {
                GROUP_NAME_REQUIRED: "group.nameRequired",
                GROUP_NAME_TOO_LONG: "group.nameTooLong",
                GROUP_DESCRIPTION_TOO_LONG: "group.descriptionTooLong",
                NOT_AUTHENTICATED: "auth.loginError"
            };
            message.textContent = t(known[code] || "group.createError");
            button.disabled = false;
        }
    });
});
