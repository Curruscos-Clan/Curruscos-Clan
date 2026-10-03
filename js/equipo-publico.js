function escTeam(v){return String(v==null?"":v).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m];});}
const TEAM_ACTIVITY={padel:"Pádel",futbol:"Fútbol",baloncesto:"Baloncesto",tenis:"Tenis",ajedrez:"Ajedrez",gaming:"Gaming",running:"Running",otro:"Otro"};
function teamDate(d,t){if(!d)return "";return new Date(d+"T"+(t||"00:00")).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});}
function teamStatus(s){return s==="live"?"En directo":s==="finished"?"Finalizado":s==="preparing"?"En preparación": "Próximo";}

document.addEventListener("DOMContentLoaded",async function(){
  var root=document.getElementById("teamRoot");
  var id=new URLSearchParams(location.search).get("id");
  if(!id){root.innerHTML="Equipo no encontrado.";return;}

  var team=await getPublicTeam(id);
  var persistent=false;
  var events=[];

  if(!team){
    var result=await supabaseClient.rpc("get_public_persistent_team",{target_team_id:id});
    if(!result.error&&result.data&&result.data.length){
      team=result.data[0];
      persistent=true;
      events=await getPublicPersistentTeamEvents(id);
    }
  }

  if(!team){root.innerHTML="Este equipo no está disponible públicamente.";return;}

  var members=[];
  if(persistent){
    members=await getPersistentTeamMembers(id);
  }else{
    var publicMembers=await getPublicEventTeamMembers(team.event_id);
    members=(publicMembers||[]).filter(function(member){return member.team_id===id;}).map(function(member){return {user_id:member.user_id,display_name:member.display_name,username:member.username,role:"member"};});
  }

  var memberHtml=(members||[]).map(function(member){
    var name=member.display_name||member.username||"Participante";
    return '<a class="team-member" href="perfil-publico.html?id='+encodeURIComponent(member.user_id)+'"><span class="team-avatar">'+
      escTeam(name.charAt(0).toUpperCase())+'</span><span><strong>'+escTeam(name)+'</strong><small>'+
      (member.role==="owner"?"Propietario · ":"")+(member.username?"@"+escTeam(member.username):"Ver perfil")+
      '</small></span></a>';
  }).join("");
  if(!memberHtml)memberHtml='<div class="team-empty">No hay miembros visibles.</div>';

  var eventRows=(events||[]).map(function(event){
    return '<a class="team-event" href="evento-publico.html?id='+encodeURIComponent(event.event_id)+'"><span><strong>'+
      escTeam(event.title)+'</strong><small>'+escTeam(TEAM_ACTIVITY[event.event_type]||"Actividad")+
      (event.location?" · "+escTeam(event.location):"")+'</small></span><small>'+
      escTeam(teamDate(event.event_date,event.event_time))+'</small></a>';
  }).join("");
  if(!eventRows)eventRows='<div class="team-empty">Aún no hay participaciones públicas del equipo.</div>';

  var eventContext="";
  if(!persistent){
    eventContext='<section class="team-section"><span class="eyebrow">CONTEXTO</span><h2>Evento</h2><a class="team-event" href="evento-publico.html?id='+
      encodeURIComponent(team.event_id)+'"><span><strong>'+escTeam(team.event_title||"Evento")+
      '</strong><small>'+escTeam(TEAM_ACTIVITY[team.event_type]||"Actividad")+
      '</small></span><small>'+escTeam(teamDate(team.event_date,null))+'</small></a></section>';
  }

  var title=persistent?team.name:team.team_name;
  var activity=persistent?"Equipo persistente":(TEAM_ACTIVITY[team.event_type]||"Actividad")+" · Equipo";
  var stats=persistent?[
    ["Miembros",team.member_count],
    ["Eventos",team.event_count],
    ["Partidos",team.matches_played],
    ["Victorias",team.wins],
    ["Puntos",team.points]
  ]:[
    ["Miembros",team.member_count],
    ["Partidos",team.matches_played],
    ["Victorias",team.wins],
    ["Derrotas",team.losses],
    ["Puntos",team.points]
  ];
  var statsHtml=stats.map(function(item){return '<div class="team-stat"><span>'+escTeam(item[0])+'</span><strong>'+Number(item[1]||0)+'</strong></div>';}).join("");

  root.innerHTML='<section class="team-card"><div class="team-head"><div><span class="team-kicker">'+escTeam(activity)+'</span><h1>'+
    escTeam(title)+'</h1><p>'+(persistent?"Un equipo que conserva su identidad, miembros e historial entre eventos.":'<a class="team-back" href="evento-publico.html?id='+encodeURIComponent(team.event_id)+'">'+escTeam(team.event_title||"Ver evento")+'</a>')+
    '</p></div><div><span class="team-kicker">'+escTeam(teamStatus(team.event_status||team.status))+
    '</span></div></div><div class="team-record">'+statsHtml+'</div></section>'+
    '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="button button-primary" href="chat.html?team='+encodeURIComponent(id)+'">Chat del equipo</a></div>'+
    '<section class="team-section"><span class="eyebrow">PLANTILLA</span><h2>Miembros</h2><div class="team-members">'+memberHtml+'</div></section>'+
    '<section class="team-section"><span class="eyebrow">HISTORIAL</span><h2>Eventos</h2><div>'+eventRows+'</div></section>'+
    eventContext;
});
