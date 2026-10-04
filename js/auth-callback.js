/* =========================================================
   CURRUSCOS — CALLBACK DE CONFIRMACIÓN Y RECUPERACIÓN
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
    const icon = document.getElementById("icon");
    const title = document.getElementById("title");
    const message = document.getElementById("message");
    const action = document.getElementById("action");

    const set = (i, t, m, href = "login.html") => {
        icon.textContent = i;
        title.textContent = t;
        message.textContent = m;
        action.href = href;
        action.style.display = "inline-block";
    };

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const isReset = params.get("reset") === "1";

    try {
        /*
         * PKCE callbacks return ?code=. Supabase's browser client also handles
         * the session returned in the URL hash for the implicit email-confirmation
         * flow, so getSession() is the common verification point below.
         */
        if (code) {
            const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
            if (error) throw error;
        }

        /* Surface Auth errors instead of leaving the user on a blank callback page. */
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const authError = hashParams.get("error_description") || hashParams.get("error");
        const authErrorCode = hashParams.get("error_code");

        if (authError) {
            console.error("Error devuelto por Supabase Auth:", authErrorCode || authError);
            set(
                "⚠️",
                isReset ? "Enlace de recuperación no válido" : "No hemos podido confirmar el correo",
                "El enlace ha caducado, ya se ha utilizado o ha sido rechazado. Solicita un nuevo enlace desde la pantalla de acceso.",
                "login.html"
            );
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            set(
                "⚠️",
                isReset ? "Enlace de recuperación no válido" : "Enlace no válido",
                "No hemos podido validar tu sesión. Solicita un nuevo enlace desde la pantalla de acceso.",
                "login.html"
            );
            return;
        }

        if (isReset) {
            window.location.replace("login.html?reset=1");
            return;
        }

        set(
            "✓",
            "Cuenta confirmada",
            "Tu correo ya está verificado. Vamos a preparar tu espacio en Curruscos.",
            "onboarding.html"
        );

        setTimeout(() => window.location.replace("onboarding.html"), 900);
    } catch (error) {
        console.error("Error en el callback de autenticación:", error);
        set(
            "⚠️",
            "No hemos podido completar el acceso",
            "Prueba a solicitar un nuevo enlace desde la pantalla de acceso.",
            "login.html"
        );
    }
});