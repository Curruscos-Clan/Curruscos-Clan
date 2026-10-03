function esc(v){return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
const ACTIVITY_LABELS={padel:"Pádel",futbol:"Fútbol",baloncesto:"Baloncesto",tenis:"Tenis",ajedrez:"Ajedrez",gaming:"Gaming",running:"Running",otro:"Otro"};
const STATUS_LABELS={published:"Inscripciones abiertas",preparing:"Preparando",live:"En directo",finished:"Finalizado"};
const FORMAT_LABELS={standard:"Evento libre",knockout:"Eliminación directa",round_robin:"Liga",swiss:"Sistema suizo",race:"Carrera",custom:"Formato personalizado"};

function eventDate(row){
 const d=new Date(row.event_date+"T"+(row.event_time||"00:00"));
 return d.toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"});
}
function activityLabel(row){return ACTIVITY_LABELS[row.event_type]||"Evento";}
function eventLink(row){
 return `<a class="pub-activity-item" href="evento-publico.html?id=${encodeURIComponent(row.event_id)}">
   <div class="pub-activity-main"><strong>${esc(row.title)}</strong><span>${esc(activityLabel(row))} · ${esc(FORMAT_LABELS[row.format]||"Evento")}</span></div>
   <div class="pub-activity-meta"><span>${esc(eventDate(row))}</span><small>${row.role==="organizer"?"Organizador":STATUS_LABELS[row.status]||"Participante"}</small></div>
 </a>`;
}

document.addEventListener("DOMContentLoaded",async()=>{
 const root=document.getElementById("profileRoot");
 const id=new URLSearchParams(location.search).get("id");
 if(!id){root.innerHTML='<div class="pub-empty">Perfil no encontrado.</div>';return;}
 const [p,activity,teams,currentUser]=await Promise.all([getPublicProfile(id),getPublicProfileActivity(id),getPublicProfileTeams(id),getCurrentUser()]);
 if(!p){root.innerHTML='<div class="pub-empty">Este perfil no está disponible.</div>';return;}
 const name=p.display_name||p.username||"Jugador";
 const matches=Number(p.wins||0)+Number(p.draws||0)+Number(p.losses||0); const followStatus=currentUser&&currentUser.id!==id?await getFollowStatus(id):null; const myOrganizedEvents=currentUser&&currentUser.id!==id?(await supabaseClient.from("events").select("id,title,date,status").eq("created_by",currentUser.id).in("status",["published","preparing"]).order("date",{ascending:true}).limit(12)).data||[]:[];
 const organized=Number(p.organized_events||0);
 const joined=activity.filter(x=>x.role==="participant");
 const organizedRows=activity.filter(x=>x.role==="organizer"); const canChat=!!currentUser&&currentUser.id!==id;
 root.className="";
 root.innerHTML=`<section class="pub-card"><div class="pub-head"><div class="pub-avatar">${esc(name.charAt(0).toUpperCase())}</div><div><span class="eyebrow">PARTICIPANTE</span><h1>${esc(name)}</h1><p>${p.username?"@"+esc(p.username):"Perfil público de Curruscos"}</p>${organized?'<span class="pub-badge">Organizador · '+organized+' evento'+(organized===1?'':'s')+'</span>':""}</div></div><div style="margin-top:14px">${canChat?`<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="button button-primary" href="chat.html?user=${encodeURIComponent(id)}">💬 Enviar mensaje</a><button id="followButton" class="button" type="button">${followStatus?.is_following?"Dejar de seguir":"Seguir"}</button></div>`:""}</div>${myOrganizedEvents.length?'<div class="profile-invite-box"><span class="eyebrow">INVITAR</span><div class="profile-invite-row"><select id="profileInviteEvent"><option value="">Elige un evento que organizas…</option>'+myOrganizedEvents.map(e=>'<option value="'+e.id+'">'+esc(e.title)+'</option>').join("")+'</select><button id="profileInviteButton" class="button" type="button">Invitar</button></div><small>La invitación aparecerá en sus avisos.</small></div>':""}<div class="pub-stats"><div class="pub-stat"><span>Eventos</span><strong>${Number(p.events_played||0)}</strong></div><div class="pub-stat"><span>Partidos</span><strong>${matches}</strong></div><div class="pub-stat"><span>Victorias</span><strong>${Number(p.wins||0)}</strong></div><div class="pub-stat"><span>Puntos</span><strong>${Number(p.points||0)}</strong></div><div class="pub-stat"><span>Equipos</span><strong>${Number(p.teams_count||0)}</strong></div></div><div class="pub-record"><div class="pub-record-item"><span>Victorias</span><strong>${Number(p.wins||0)}</strong></div><div class="pub-record-item"><span>Empates</span><strong>${Number(p.draws||0)}</strong></div><div class="pub-record-item"><span>Derrotas</span><strong>${Number(p.losses||0)}</strong></div></div><p class="pub-note">Las estadísticas y la actividad solo utilizan eventos públicos visibles en Curruscos. Los datos de grupos privados no se muestran.</p></section>
 <section class="pub-activity-section"><div class="pub-section-head"><div><span class="eyebrow">ACTIVIDAD</span><h2>Eventos</h2></div><span>${activity.length} públicos</span></div>
 ${activity.length?`<div class="pub-activity-list">${activity.map(eventLink).join("")}</div>`:'<div class="pub-empty pub-activity-empty">Todavía no hay actividad pública.</div>'}</section>
 <section class="pub-activity-section"><div class="pub-section-head"><div><span class="eyebrow">COMPETICIÓN</span><h2>Equipos</h2></div><span>${teams.length} públicos</span></div>
 ${teams.length?'<div class="pub-team-list">'+teams.map(t=>`<a class="pub-team-item" href="equipo-publico.html?id=${encodeURIComponent(t.team_id)}"><div><strong>${esc(t.team_name)}</strong><span>${esc(t.event_title)}</span></div><small>${esc(activityLabel({event_type:t.event_type}))} · ${esc(t.event_status==="finished"?"Finalizado":t.event_status==="live"?"En directo":"Próximo")}</small></a>`).join("")+'</div>':'<div class="pub-empty pub-activity-empty">Todavía no forma parte de equipos públicos.</div>'}
 </section>`;
 document.getElementById("profileInviteButton")?.addEventListener("click",async()=>{const select=document.getElementById("profileInviteEvent"),button=document.getElementById("profileInviteButton");if(!select?.value)return;button.disabled=true;const ok=await sendInvitation(id,"event",select.value);button.disabled=false;button.textContent=ok?"Enviada":"No disponible";if(ok)select.value="";});
});