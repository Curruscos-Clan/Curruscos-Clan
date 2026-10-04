/* =========================================================
   CURRUSCOS — ACCESO Y REGISTRO
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
    await window.curruscosI18n?.ready;
    const card=document.getElementById("authCard"), form=document.getElementById("loginForm");
    const registerButton=document.getElementById("registerButton"), modeButton=document.getElementById("modeButton");
    const submitButton=document.getElementById("submitButton"), message=document.getElementById("loginMessage");
    const title=document.getElementById("authTitle"), subtitle=document.getElementById("authSubtitle");
    const password=document.getElementById("password"), passwordConfirm=document.getElementById("passwordConfirm");
    const displayName=document.getElementById("displayName"), username=document.getElementById("username");
    const terms=document.getElementById("termsAccepted"), meter=document.getElementById("passwordMeter"), hint=document.getElementById("passwordHint");
    const forgotPassword=document.getElementById("forgotPassword"), authSuccess=document.getElementById("authSuccess");
    const confirmationEmail=document.getElementById("confirmationEmail"), resendButton=document.getElementById("resendButton"), backToLogin=document.getElementById("backToLogin");
    if(!card||!form)return;
    let registerMode=false,lastSignupEmail="",resendLocked=false;
    const setMessage=t=>{message.textContent=t||"";};
    const redirectAfterAuth=async()=>{const groups=await getUserGroups(true);window.location.replace(groups.length?"dashboard.html":"onboarding.html");};
    const normalizeUsername=v=>String(v||"").trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_.-]/g,"").slice(0,24);
    const passwordScore=v=>{let s=0;if(v.length>=8)s++;if(v.length>=12)s++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;return Math.min(s,5);};
    const updatePasswordMeter=()=>{const v=password.value,s=passwordScore(v);meter.style.width=(s*20)+"%";hint.textContent=!v?"Usa al menos 8 caracteres, incluyendo letras y números.":s<=2?"Contraseña débil. Añade longitud, números y símbolos.":s<=3?"Contraseña aceptable. Puedes hacerla más resistente.":"Contraseña fuerte.";};
    const setRegisterMode=active=>{registerMode=active;card.classList.toggle("register-mode",active);title.textContent=active?"Crea tu cuenta.":"Bienvenido al Clan.";subtitle.textContent=active?"Solo necesitamos unos datos para que tu perfil empiece bien configurado.":"Entra a tus espacios o crea una cuenta para empezar.";submitButton.textContent=active?"Crear mi cuenta":"Entrar";forgotPassword.style.display=active?"none":"block";setMessage("");if(active){displayName.focus();password.autocomplete="new-password";}else password.autocomplete="current-password";};
    const showConfirmation=email=>{lastSignupEmail=email;confirmationEmail.textContent=email;form.style.display="none";document.querySelector(".login-divider")?.style.setProperty("display","none");registerButton.style.display="none";modeButton.style.display="none";document.querySelector(".auth-trust")?.style.setProperty("display","none");authSuccess.classList.add("active");setMessage("");};
    const restoreLogin=()=>{authSuccess.classList.remove("active");form.style.display="";document.querySelector(".login-divider")?.style.removeProperty("display");registerButton.style.display="";modeButton.style.display="";document.querySelector(".auth-trust")?.style.removeProperty("display");setRegisterMode(false);form.reset();updatePasswordMeter();};
    const friendlyError=error=>{const raw=String(error?.message||error||"").toLowerCase();if(raw.includes("user already registered")||raw.includes("already registered"))return"Ese correo ya tiene una cuenta. Prueba a iniciar sesión o recuperar la contraseña.";if(raw.includes("invalid login credentials"))return"El correo o la contraseña no son correctos.";if(raw.includes("email not confirmed"))return"Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.";if(raw.includes("password"))return"La contraseña no cumple los requisitos de seguridad.";if(raw.includes("rate limit")||raw.includes("too many"))return"Has hecho demasiados intentos. Espera un poco antes de volver a intentarlo.";if(raw.includes("network")||raw.includes("fetch"))return"No hemos podido conectar con el servicio. Comprueba tu conexión y vuelve a intentarlo.";return getSupabaseErrorMessage(error,"No se ha podido completar la operación.");};
    const existingUser=await getCurrentUser();if(existingUser){await redirectAfterAuth();return;}
    password.addEventListener("input",updatePasswordMeter);
    passwordConfirm?.addEventListener("input",()=>passwordConfirm.setCustomValidity(!passwordConfirm.value||passwordConfirm.value===password.value?"":"Las contraseñas no coinciden."));
    username?.addEventListener("blur",()=>{username.value=normalizeUsername(username.value);});
    registerButton.addEventListener("click",()=>setRegisterMode(true));modeButton.addEventListener("click",()=>setRegisterMode(true));backToLogin.addEventListener("click",restoreLogin);
    form.addEventListener("submit",async event=>{
        event.preventDefault();
        const email=document.getElementById("email").value.trim().toLowerCase(),pass=password.value;
        if(!email||!pass){setMessage("Completa el correo y la contraseña.");return;}
        if(!registerMode){
            submitButton.disabled=true;registerButton.disabled=true;setMessage("Entrando...");
            try{const{error}=await supabaseClient.auth.signInWithPassword({email,password:pass});if(error)throw error;await redirectAfterAuth();}
            catch(error){setMessage(friendlyError(error));}finally{submitButton.disabled=false;registerButton.disabled=false;}return;
        }
        const name=displayName.value.trim(),handle=normalizeUsername(username.value);
        if(name.length<2){setMessage("Dinos cómo quieres que aparezca tu nombre.");displayName.focus();return;}
        if(!/^[a-z0-9_.-]{3,24}$/.test(handle)){setMessage("El nombre de usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, números, punto, guion o guion bajo.");username.focus();return;}
        if(pass.length<8){setMessage("La contraseña debe tener al menos 8 caracteres.");password.focus();return;}
        if(pass!==passwordConfirm.value){setMessage("Las contraseñas no coinciden.");passwordConfirm.focus();return;}
        if(!terms.checked){setMessage("Necesitamos que aceptes las condiciones para crear la cuenta.");terms.focus();return;}
        submitButton.disabled=true;registerButton.disabled=true;modeButton.disabled=true;setMessage("Creando tu cuenta...");
        try{
            const redirectUrl=new URL("auth-callback.html",window.location.href).href;
            const{data,error}=await supabaseClient.auth.signUp({email,password:pass,options:{emailRedirectTo:redirectUrl,data:{display_name:name,username:handle}}});
            if(error)throw error;
            if(data?.session){await redirectAfterAuth();return;}
            showConfirmation(email);
        }catch(error){setMessage(friendlyError(error));}finally{submitButton.disabled=false;registerButton.disabled=false;modeButton.disabled=false;}
    });
    forgotPassword.addEventListener("click",async event=>{
        event.preventDefault();const email=document.getElementById("email").value.trim().toLowerCase();
        if(!email){setMessage("Escribe primero tu correo para enviarte el enlace de recuperación.");document.getElementById("email").focus();return;}
        forgotPassword.disabled=true;setMessage("Enviando enlace de recuperación...");
        try{const redirectUrl=new URL("auth-callback.html?reset=1",window.location.href).href;const{error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl});if(error)throw error;setMessage("Si existe una cuenta con ese correo, recibirás un enlace para recuperar la contraseña.");}
        catch(error){setMessage(friendlyError(error));}finally{setTimeout(()=>{forgotPassword.disabled=false;},1500);}
    });
    resendButton.addEventListener("click",async()=>{
        if(!lastSignupEmail||resendLocked)return;resendLocked=true;resendButton.disabled=true;resendButton.textContent="Enviando...";
        try{const redirectUrl=new URL("auth-callback.html",window.location.href).href;const{error}=await supabaseClient.auth.resend({type:"signup",email:lastSignupEmail,options:{emailRedirectTo:redirectUrl}});if(error)throw error;setMessage("Te hemos enviado otro correo de confirmación.");}
        catch(error){setMessage(friendlyError(error));}finally{setTimeout(()=>{resendLocked=false;resendButton.disabled=false;resendButton.textContent="Reenviar correo";},5000);}
    });
    updatePasswordMeter();
});