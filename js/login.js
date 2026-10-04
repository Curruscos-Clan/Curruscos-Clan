/* =========================================================
   CURRUSCOS — ACCESO, REGISTRO Y RECUPERACIÓN
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;

    const $ = id => document.getElementById(id);
    const card = $("authCard"), form = $("loginForm");
    if (!card || !form) return;

    const registerButton = $("registerButton");
    const modeButton = $("modeButton");
    const submitButton = $("submitButton");
    const message = $("loginMessage");
    const title = $("authTitle");
    const subtitle = $("authSubtitle");
    const emailInput = $("email");
    const password = $("password");
    const passwordConfirm = $("passwordConfirm");
    const displayName = $("displayName");
    const username = $("username");
    const terms = $("termsAccepted");
    const meter = $("passwordMeter");
    const hint = $("passwordHint");
    const forgotPassword = $("forgotPassword");
    const authSuccess = $("authSuccess");
    const resetPanel = $("resetPanel");
    const resetPassword = $("resetPassword");
    const resetPasswordConfirm = $("resetPasswordConfirm");
    const resetPasswordButton = $("resetPasswordButton");
    const resetCancelButton = $("resetCancelButton");
    const resetMeter = $("resetPasswordMeter");
    const resetHint = $("resetPasswordHint");
    const confirmationEmail = $("confirmationEmail");
    const resendButton = $("resendButton");
    const backToLogin = $("backToLogin");
    const divider = document.querySelector(".login-divider");
    const trust = document.querySelector(".auth-trust");

    let registerMode = false;
    let lastSignupEmail = "";
    let resendLocked = false;

    const setMessage = text => {
        message.textContent = text || "";
    };

    const redirectAfterAuth = async () => {
        const groups = await getUserGroups(true);
        window.location.replace(groups.length ? "dashboard.html" : "onboarding.html");
    };

    const normalizeEmail = value => String(value || "").trim().toLowerCase();

    const normalizeUsername = value => String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_.-]/g, "")
        .slice(0, 24);

    const passwordScore = value => {
        let score = 0;
        if (value.length >= 8) score++;
        if (value.length >= 12) score++;
        if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
        if (/\d/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;
        return Math.min(score, 5);
    };

    const passwordIsWeak = (value, identity = "") => {
        const normalized = value.trim().toLowerCase();
        const identityParts = identity.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const common = new Set([
            "password", "password1", "password123", "12345678", "123456789",
            "1234567890", "qwerty", "qwerty123", "abcdefgh", "abcdefghi",
            "curruscos", "curruscos1", "contraseña", "contrasena"
        ]);
        return value.length < 8 ||
            common.has(normalized) ||
            identityParts.some(part => part.length >= 4 && normalized === part);
    };

    const updateMeter = (input, bar, text) => {
        const value = input?.value || "";
        const score = passwordScore(value);
        if (bar) bar.style.width = (score * 20) + "%";
        if (text) {
            text.textContent = !value
                ? "Usa al menos 8 caracteres, incluyendo letras y números."
                : score <= 2
                    ? "Contraseña débil. Añade longitud, mayúsculas, números y símbolos."
                    : score <= 3
                        ? "Contraseña aceptable. Puedes hacerla más resistente."
                        : "Contraseña fuerte.";
        }
    };

    const setRegisterMode = active => {
        registerMode = active;
        card.classList.toggle("register-mode", active);
        title.textContent = active ? "Crea tu cuenta." : "Bienvenido al Clan.";
        subtitle.textContent = active
            ? "Configura tu perfil ahora y tendrás una cuenta preparada para todos tus grupos."
            : "Entra a tus espacios o crea una cuenta para empezar.";
        submitButton.textContent = active ? "Crear mi cuenta" : "Entrar";
        forgotPassword.style.display = active ? "none" : "block";
        setMessage("");
        if (active) {
            password.autocomplete = "new-password";
            displayName.focus();
        } else {
            password.autocomplete = "current-password";
            emailInput.focus();
        }
    };

    const showConfirmation = email => {
        lastSignupEmail = email;
        confirmationEmail.textContent = email;
        form.style.display = "none";
        divider?.style.setProperty("display", "none");
        registerButton.style.display = "none";
        modeButton.style.display = "none";
        trust?.style.setProperty("display", "none");
        authSuccess.classList.add("active");
        setMessage("");
    };

    const restoreLogin = () => {
        authSuccess.classList.remove("active");
        form.style.display = "";
        divider?.style.removeProperty("display");
        registerButton.style.display = "";
        modeButton.style.display = "";
        trust?.style.removeProperty("display");
        setRegisterMode(false);
        form.reset();
        passwordConfirm?.setCustomValidity("");
        updateMeter(password, meter, hint);
    };

    const friendlyError = error => {
        const raw = String(error?.message || error || "").toLowerCase();

        if (raw.includes("user already registered") || raw.includes("already registered")) {
            return "Ese correo ya tiene una cuenta. Si es tuya, inicia sesión o recupera la contraseña.";
        }
        if (raw.includes("invalid login credentials")) {
            return "El correo o la contraseña no son correctos.";
        }
        if (raw.includes("email not confirmed")) {
            return "Tu correo todavía no está confirmado. Revisa tu bandeja de entrada o solicita otro correo.";
        }
        if (raw.includes("email") && (raw.includes("invalid") || raw.includes("valid"))) {
            return "Escribe una dirección de correo válida.";
        }
        if (raw.includes("password") || raw.includes("weak")) {
            return "La contraseña no cumple los requisitos de seguridad.";
        }
        if (raw.includes("rate limit") || raw.includes("too many")) {
            return "Has hecho demasiados intentos. Espera un poco antes de volver a intentarlo.";
        }
        if (raw.includes("network") || raw.includes("fetch")) {
            return "No hemos podido conectar con Curruscos. Comprueba tu conexión y vuelve a intentarlo.";
        }
        if (raw.includes("redirect")) {
            return "No hemos podido completar el enlace de acceso. Comprueba la configuración de autenticación.";
        }

        return getSupabaseErrorMessage(error, "No se ha podido completar la operación.");
    };

    const isResetRequested = new URLSearchParams(window.location.search).get("reset") === "1";

    /*
     * Recovery links create an authenticated session before the password is changed.
     * We check that session before redirecting normal signed-in users, so a recovery
     * link can never get sent straight to the dashboard.
     */
    if (isResetRequested) {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            form.style.display = "none";
            authSuccess.classList.remove("active");
            divider?.style.setProperty("display", "none");
            registerButton.style.display = "none";
            modeButton.style.display = "none";
            trust?.style.setProperty("display", "none");
            resetPanel?.classList.add("active");
            title.textContent = "Recupera tu cuenta.";
            subtitle.textContent = "Establece una nueva contraseña para volver a acceder.";
            resetPassword?.focus();
        } else {
            setMessage("El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo desde el acceso.");
        }
    } else {
        const existingUser = await getCurrentUser();
        if (existingUser) {
            await redirectAfterAuth();
            return;
        }
    }

    password?.addEventListener("input", () => updateMeter(password, meter, hint));
    resetPassword?.addEventListener("input", () => updateMeter(resetPassword, resetMeter, resetHint));

    const syncPasswordValidity = (source, target) => {
        target?.setCustomValidity(
            !target.value || target.value === source.value ? "" : "Las contraseñas no coinciden."
        );
    };

    passwordConfirm?.addEventListener("input", () => syncPasswordValidity(password, passwordConfirm));
    password?.addEventListener("input", () => syncPasswordValidity(password, passwordConfirm));
    resetPasswordConfirm?.addEventListener("input", () => syncPasswordValidity(resetPassword, resetPasswordConfirm));
    resetPassword?.addEventListener("input", () => syncPasswordValidity(resetPassword, resetPasswordConfirm));

    emailInput?.addEventListener("blur", () => {
        emailInput.value = normalizeEmail(emailInput.value);
    });

    username?.addEventListener("input", () => {
        const raw = username.value;
        const normalized = normalizeUsername(raw);
        if (raw !== normalized) username.value = normalized;
    });

    username?.addEventListener("blur", () => {
        username.value = normalizeUsername(username.value);
    });

    registerButton?.addEventListener("click", () => setRegisterMode(true));
    modeButton?.addEventListener("click", () => setRegisterMode(true));
    backToLogin?.addEventListener("click", restoreLogin);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = normalizeEmail(emailInput.value);
        const pass = password.value;

        if (!email || !pass) {
            setMessage("Completa el correo y la contraseña.");
            return;
        }

        if (!registerMode) {
            submitButton.disabled = true;
            registerButton.disabled = true;
            setMessage("Entrando…");

            try {
                const { error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password: pass
                });
                if (error) throw error;
                await redirectAfterAuth();
            } catch (error) {
                setMessage(friendlyError(error));
            } finally {
                submitButton.disabled = false;
                registerButton.disabled = false;
            }
            return;
        }

        const name = displayName.value.trim();
        const handle = normalizeUsername(username.value);

        if (name.length < 2) {
            setMessage("Dinos cómo quieres que aparezca tu nombre.");
            displayName.focus();
            return;
        }

        if (name.length > 60) {
            setMessage("El nombre no puede superar los 60 caracteres.");
            displayName.focus();
            return;
        }

        if (!/^[a-z0-9_.-]{3,24}$/.test(handle)) {
            setMessage("El nombre de usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, números, punto, guion o guion bajo.");
            username.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            setMessage("Escribe una dirección de correo válida.");
            emailInput.focus();
            return;
        }

        if (passwordIsWeak(pass, email + " " + name + " " + handle)) {
            setMessage("Elige una contraseña más resistente: evita palabras obvias, datos de tu perfil y contraseñas comunes.");
            password.focus();
            return;
        }

        if (pass.length > 72) {
            setMessage("La contraseña no puede superar los 72 caracteres.");
            password.focus();
            return;
        }

        if (pass !== passwordConfirm.value) {
            setMessage("Las contraseñas no coinciden.");
            passwordConfirm.focus();
            return;
        }

        if (!terms.checked) {
            setMessage("Necesitamos que aceptes las condiciones para crear la cuenta.");
            terms.focus();
            return;
        }

        submitButton.disabled = true;
        registerButton.disabled = true;
        modeButton.disabled = true;
        setMessage("Creando tu cuenta…");

        try {
            const redirectUrl = new URL("auth-callback.html", window.location.href).href;
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password: pass,
                options: {
                    emailRedirectTo: redirectUrl,
                    data: {
                        display_name: name,
                        username: handle
                    }
                }
            });

            if (error) throw error;

            /*
             * When email confirmation is enabled, Supabase normally returns no session.
             * If confirmation is disabled, a session may be returned and we can continue.
             */
            if (data?.session) {
                await redirectAfterAuth();
                return;
            }

            showConfirmation(email);
        } catch (error) {
            setMessage(friendlyError(error));
        } finally {
            submitButton.disabled = false;
            registerButton.disabled = false;
            modeButton.disabled = false;
        }
    });

    forgotPassword?.addEventListener("click", async event => {
        event.preventDefault();

        const email = normalizeEmail(emailInput.value);

        if (!email) {
            setMessage("Escribe primero tu correo para enviarte el enlace de recuperación.");
            emailInput.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            setMessage("Escribe una dirección de correo válida.");
            emailInput.focus();
            return;
        }

        forgotPassword.disabled = true;
        setMessage("Enviando enlace de recuperación…");

        try {
            const redirectUrl = new URL("auth-callback.html?reset=1", window.location.href).href;
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            if (error) throw error;

            /*
             * Deliberately do not reveal whether the address exists.
             * This prevents account enumeration.
             */
            setMessage("Si existe una cuenta con ese correo, recibirás un enlace para recuperar la contraseña.");
        } catch (error) {
            setMessage(friendlyError(error));
        } finally {
            setTimeout(() => {
                forgotPassword.disabled = false;
            }, 2000);
        }
    });

    resetPasswordButton?.addEventListener("click", async () => {
        const next = resetPassword.value;

        if (passwordIsWeak(next, "")) {
            setMessage("Elige una contraseña más resistente antes de continuar.");
            resetPassword.focus();
            return;
        }

        if (next.length > 72) {
            setMessage("La contraseña no puede superar los 72 caracteres.");
            resetPassword.focus();
            return;
        }

        if (next !== resetPasswordConfirm.value) {
            setMessage("Las contraseñas no coinciden.");
            resetPasswordConfirm.focus();
            return;
        }

        resetPasswordButton.disabled = true;
        setMessage("Guardando nueva contraseña…");

        try {
            const { error } = await supabaseClient.auth.updateUser({ password: next });
            if (error) throw error;

            await supabaseClient.auth.refreshSession();
            setMessage("Contraseña actualizada. Preparando tu cuenta…");
            setTimeout(() => redirectAfterAuth(), 400);
        } catch (error) {
            setMessage(friendlyError(error));
        } finally {
            resetPasswordButton.disabled = false;
        }
    });

    resetCancelButton?.addEventListener("click", () => {
        window.location.replace("login.html");
    });

    resendButton?.addEventListener("click", async () => {
        if (!lastSignupEmail || resendLocked) return;

        resendLocked = true;
        resendButton.disabled = true;
        resendButton.textContent = "Enviando…";

        try {
            const redirectUrl = new URL("auth-callback.html", window.location.href).href;
            const { error } = await supabaseClient.auth.resend({
                type: "signup",
                email: lastSignupEmail,
                options: { emailRedirectTo: redirectUrl }
            });
            if (error) throw error;
            setMessage("Te hemos enviado otro correo de confirmación.");
        } catch (error) {
            setMessage(friendlyError(error));
        } finally {
            setTimeout(() => {
                resendLocked = false;
                resendButton.disabled = false;
                resendButton.textContent = "Reenviar correo";
            }, 6000);
        }
    });

    updateMeter(password, meter, hint);
    updateMeter(resetPassword, resetMeter, resetHint);
});