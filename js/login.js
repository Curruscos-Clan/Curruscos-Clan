/* =========================================================
   CURRUSCOS — LOGIN / REGISTRO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {\n    await window.curruscosI18n?.ready;
    const form =
        document.getElementById("loginForm");

    const registerButton =
        document.getElementById(
            "registerButton"
        );

    const message =
        document.getElementById(
            "loginMessage"
        );

    if (!form || !registerButton || !message) {
        return;
    }

    const existingUser =
        await getCurrentUser();

    if (existingUser) {
        const groups =
            await getUserGroups();

        window.location.replace(
            groups.length
                ? "dashboard.html"
                : "onboarding.html"
        );

        return;
    }

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const email =
                document.getElementById(
                    "email"
                )
                .value
                .trim();

            const password =
                document.getElementById(
                    "password"
                )
                .value;

            if (!email || !password) {
                message.textContent =
                    t("auth.completeLogin");
                return;
            }

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            button.disabled = true;
            registerButton.disabled = true;
            message.textContent =
                t("auth.loggingIn");

            try {
                const {
                    error
                } =
                    await supabaseClient.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) {
                    throw new Error(
                        error.message
                    );
                }

                const groups =
                    await getUserGroups(
                        true
                    );

                window.location.replace(
                    groups.length
                        ? "dashboard.html"
                        : "onboarding.html"
                );
            } catch (error) {
                message.textContent =
                    getSupabaseErrorMessage(
                        error,
                        t("auth.loginError")
                    );
            } finally {
                button.disabled = false;
                registerButton.disabled = false;
            }
        }
    );

    registerButton.addEventListener(
        "click",
        async () => {
            const email =
                document.getElementById(
                    "email"
                )
                .value
                .trim();

            const password =
                document.getElementById(
                    "password"
                )
                .value;

            if (!email || !password) {
                message.textContent =
                    t("auth.enterCredentials");
                return;
            }

            if (password.length < 6) {
                message.textContent =
                    t("auth.passwordMin");
                return;
            }

            registerButton.disabled = true;
            form.querySelector(
                'button[type="submit"]'
            ).disabled = true;

            message.textContent =
                t("auth.creatingAccount");

            try {
                const {
                    data,
                    error
                } =
                    await supabaseClient.auth.signUp({
                        email,
                        password
                    });

                if (error) {
                    throw new Error(
                        error.message
                    );
                }

                if (data?.session) {
                    message.textContent =
                        t("auth.accountCreated");

                    const groups =
                        await getUserGroups(
                            true
                        );

                    window.location.replace(
                        groups.length
                            ? "dashboard.html"
                            : "onboarding.html"
                    );

                    return;
                }

                message.textContent =
                    t("auth.confirmEmail");
            } catch (error) {
                message.textContent =
                    getSupabaseErrorMessage(
                        error,
                        t("auth.registerError")
                    );
            } finally {
                registerButton.disabled = false;
                form.querySelector(
                    'button[type="submit"]'
                ).disabled = false;
            }
        }
    );
});
