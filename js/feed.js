/* Curruscos Clan — feed principal. Usa los helpers y RPC ya existentes del proyecto. */
(function(){
  "use strict";
  const feedList=document.getElementById("feed-list");
  const toastContainer=document.getElementById("toast-container");
  const filterChips=[...document.querySelectorAll(".filter-chip")];
  if(!feedList)return;
  let currentUser=null;
  let allEvents=[];
  let currentFilter="all";
  const userContext={joinedEventIds:new Set(),interests:[],groupIds:new Set()};

  function esc(value){
    return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function toast(message,duration=3200){
    if(!toastContainer)return;
    const item=document.createElement("div");item.className="toast";item.textContent=message;
    toastContainer.appendChild(item);window.setTimeout(()=>item.remove(),duration);
  }
  function startDate(event){
    const raw=event?.start_time||(event?.date?String(event.date)+(event?.time?"T"+String(event.time).slice(0,8):"T00:00:00"):"");
    const parsed=raw?new Date(raw):new Date(NaN);
    return Number.isNaN(parsed.getTime())?null:parsed;
  }
  function dateLabel(event){
    const date=startDate(event);
    if(!date)return "Fecha por confirmar";
    return date.toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  }
  function categorySymbol(event){
    const category=String(event.category||event.event_type||"").toLowerCase();
    if(/deport|futbol|balonc|padel|tenis|correr/.test(category))return "↗";
    if(/comida|cena|restaur|cocina/.test(category))return "✳";
    if(/cultur|muse|arte|conciert/.test(category))return "✦";
    if(/ocio|juego|fiesta|viaje/.test(category))return "✺";
    return "✧";
  }
  function categoryClass(event){
    const category=String(event.category||event.event_type||"").toLowerCase();
    if(/deport|futbol|balonc|padel|tenis/.test(category))return "deporte";
    if(/comida|cena|restaur|cocina/.test(category))return "comida";
    if(/cultur|muse|arte|conciert/.test(category))return "cultura";
    if(/ocio|juego|fiesta|viaje/.test(category))return "ocio";
    return "";
  }
  function updateHeader(user){
    const root=document.getElementById("auth-header-action");
    if(!root)return;
    const label=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"Mi perfil";
    root.innerHTML=user
      ? '<a class="btn btn-secondary" href="perfil.html" aria-label="Abrir perfil">'+esc(label)+'</a>'
      : '<a class="btn btn-secondary" href="perfil.html?action=login">Entrar</a>';
  }
  async function loadContext(){
    if(!currentUser)return;
    try{
      const [participants,profile,groups]=await Promise.all([
        supabaseClient.from("event_participants").select("event_id,status").eq("user_id",currentUser.id).eq("status","yes"),
        supabaseClient.from("profiles").select("interests").eq("id",currentUser.id).maybeSingle(),
        typeof getUserGroups==="function"?getUserGroups():Promise.resolve([])
      ]);
      if(!participants.error&&participants.data)userContext.joinedEventIds=new Set(participants.data.map(row=>row.event_id));
      if(!profile.error&&Array.isArray(profile.data?.interests))userContext.interests=profile.data.interests.map(value=>String(value).toLowerCase());
      (groups||[]).forEach(item=>{const group=item?.groups||item;if(group?.id)userContext.groupIds.add(group.id);});
    }catch(error){console.warn("No se ha podido cargar todo el contexto personalizado del feed.",error);}
  }
  function filteredEvents(){
    const now=new Date();
    return rankEvents(allEvents.filter(event=>{
      const date=startDate(event);if(!date||date<=now)return false;
      if(currentFilter==="today")return date.toDateString()===now.toDateString();
      if(currentFilter==="weekend"){const day=date.getDay();return day===5||day===6||day===0;}
      return true;
    }),userContext);
  }
  function renderState(title,copy,link){
    feedList.innerHTML='<div class="feed-state"><h2>'+esc(title)+'</h2><p>'+esc(copy)+'</p>'+(link?'<a class="btn btn-primary" href="'+esc(link.href)+'">'+esc(link.label)+'</a>':"")+'</div>';
  }
  function render(){
    const events=filteredEvents();
    feedList.innerHTML="";
    if(!events.length){
      renderState(allEvents.length?"No hay planes para este filtro":"Todavía no hay planes públicos","Prueba con otro filtro o explora la comunidad para descubrir actividades.",{href:"explorar.html",label:"Explorar eventos"});
      feedList.setAttribute("aria-busy","false");return;
    }
    events.forEach(event=>{
      const joined=userContext.joinedEventIds.has(event.id);
      const card=document.createElement("article");card.className="event-card";
      const title=esc(event.title||"Plan sin título");
      const category=esc(event.category||event.event_type||"Evento");
      const place=esc(event.location||"Lugar por confirmar");
      const reason=esc(event._recommendationReason||"Descubre este plan");
      const description=String(event.description||"").trim();
      const capacity=event.capacity?("Aforo: "+Number(event.capacity)):"Plazas por confirmar";
      card.innerHTML=
        '<div class="event-card-media" data-category="'+esc(categoryClass(event))+'" aria-hidden="true"><span class="event-card-symbol">'+categorySymbol(event)+'</span></div>'+
        '<div class="event-card-body"><div class="event-card-header"><span class="badge badge-subtle">'+reason+'</span>'+
        (joined?'<span class="badge badge-joined">✓ Inscrito</span>':"")+'</div>'+
        '<div class="event-date-row">'+esc(dateLabel(event))+'</div><h2 class="event-card-title">'+title+'</h2>'+
        (description?'<p class="event-description">'+esc(description)+'</p>':"")+
        '<div class="event-card-meta"><span>⌖ '+place+'</span><span>'+category+'</span></div>'+
        '<div class="event-card-footer"><span class="event-capacity">'+esc(capacity)+'</span>'+
        (joined?'<button class="btn btn-secondary rsvp-btn" disabled>Ya estás apuntado</button>':event.status==="published"?'<button class="btn btn-primary rsvp-btn" data-event-id="'+esc(event.id)+'">Apuntarme <span aria-hidden="true">↗</span></button>':'<button class="btn btn-secondary rsvp-btn" disabled>Inscripción no disponible</button>')+
        '</div></div>';
      const button=card.querySelector(".rsvp-btn");
      if(button&&!joined)button.addEventListener("click",()=>handleJoin(event.id,button));
      feedList.appendChild(card);
    });
    feedList.setAttribute("aria-busy","false");
  }
  async function handleJoin(eventId,button){
    if(!currentUser){
      toast("Inicia sesión para apuntarte a un evento.");
      window.setTimeout(()=>{window.location.href="perfil.html?action=login";},900);return;
    }
    button.disabled=true;button.textContent="Procesando…";
    try{
      if(typeof joinPublicEvent!=="function")throw new Error("La función de inscripción no está disponible.");
      const result=await joinPublicEvent(eventId);
      if(!result)throw new Error("No se ha podido confirmar la inscripción.");
      if(result.success){
        userContext.joinedEventIds.add(eventId);toast(result.code==="ALREADY_JOINED"?"Ya estabas inscrito.":"¡Inscripción confirmada!");
        render();
      }else{
        toast(result.message||"No se ha podido completar la inscripción.");
        button.disabled=false;button.innerHTML='Apuntarme <span aria-hidden="true">↗</span>';
      }
    }catch(error){
      console.error("Error al inscribirse en el evento:",error);
      toast(error.message||"Ha ocurrido un error al apuntarte.");
      button.disabled=false;button.innerHTML='Apuntarme <span aria-hidden="true">↗</span>';
    }
  }
  function setupFilters(){
    filterChips.forEach(chip=>chip.addEventListener("click",()=>{
      filterChips.forEach(item=>{item.classList.toggle("active",item===chip);item.setAttribute("aria-pressed",String(item===chip));});
      currentFilter=chip.dataset.filter||"all";render();
    }));
  }
  async function init(){
    setupFilters();feedList.setAttribute("aria-busy","true");
    try{
      currentUser=typeof getCurrentUser==="function"?await getCurrentUser():null;
      updateHeader(currentUser);
      await loadContext();
      if(typeof getPublicEvents!=="function")throw new Error("No se ha encontrado el cargador de eventos públicos del proyecto.");
      allEvents=await getPublicEvents();
      render();
    }catch(error){
      console.error("No se ha podido inicializar el feed:",error);
      renderState("No se han podido cargar los planes","Comprueba tu conexión e inténtalo de nuevo.");
      feedList.setAttribute("aria-busy","false");
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
