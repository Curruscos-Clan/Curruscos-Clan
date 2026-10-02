/* =========================================================
   CURRUSCOS — LOGIN / REGISTRO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
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
                    "Completa el correo y la contraseña.";
                return;
            }

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            button.disabled = true;
            registerButton.disabled = true;
            message.textContent =
                "Entrando...";

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
                        "No se ha podido iniciar sesión."
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
                    "Escribe un correo y una contraseña.";
                return;
            }

            if (password.length < 6) {
                message.textContent =
                    "La contraseña debe tener al menos 6 caracteres.";
                return;
            }

            registerButton.disabled = true;
            form.querySelector(
                'button[type="submit"]'
            ).disabled = true;

            message.textContent =
                "Creando cuenta...";

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
                        "Cuenta creada. Entrando...";

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
                    "Cuenta creada. Revisa tu correo para confirmar la cuenta.";
            } catch (error) {
                message.textContent =
                    getSupabaseErrorMessage(
                        error,
                        "No se ha podido crear la cuenta."
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
