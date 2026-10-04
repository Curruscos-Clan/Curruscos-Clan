document.addEventListener("DOMContentLoaded",async()=>{
    const icon=document.getElementById("icon"),title=document.getElementById("title"),message=document.getElementById("message"),action=document.getElementById("action");
    const set=(i,t,m,href="login.html")=>{icon.textContent=i;title.textContent=t;message.textContent=m;action.href=href;action.style.display="inline-block";};
    try{
        const params=new URLSearchParams(window.location.search),code=params.get("code"),isReset=params.get("reset")==="1";
        if(code){const{error}=await supabaseClient.auth.exchangeCodeForSession(code);if(error)throw error;}
        const{data:{session}}=await supabaseClient.auth.getSession();
        if(!session){set("⚠️","Enlace no válido","El enlace ha caducado, ya se ha utilizado o no podemos validarlo. Solicita otro correo desde la pantalla de acceso.","login.html");return;}
        if(isReset){window.location.replace("login.html?reset=1");return;}
        set("✓","Cuenta confirmada","Tu correo ya está verificado. Vamos a preparar tu espacio en Curruscos.","onboarding.html");
        setTimeout(()=>window.location.replace("onboarding.html"),900);
    }catch(error){console.error("Error confirmando cuenta:",error);set("⚠️","No hemos podido confirmar el correo","Prueba a solicitar un nuevo enlace desde la pantalla de acceso.","login.html");}
});