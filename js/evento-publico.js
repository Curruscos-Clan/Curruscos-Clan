function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

const PUBLIC_CATEGORY_LABELS={tournament:"Torneo",sport:"Deporte",gaming:"Gaming",social:"Social",activity:"Actividad",other:"Otro"};
const PUBLIC_FORMAT_LABELS={standard:"Evento libre",knockout:"Eliminación directa",round_robin:"Liga / todos contra todos",swiss:"Sistema suizo",race:"Carrera / clasificación",custom:"Formato personalizado"};

function publicDate(event){const d=new Date(event.date+"T"+(event.time||"00:00"));return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
function publicTeamName(team){return escapeHtml(team?.name||"Por definir");}

function buildStandings(teams,matches){const table=new Map(teams.map(t=>[t.id,{team:t,played:0,wins:0,draws:0,losses:0,points:0,scored:0,conceded:0}]));matches.filter(m=>m.status==="finished"&&m.home_team_id).forEach(m=>{const h=table.get(m.home_team_id),a=m.away_team_id?table.get(m.away_team_id):null;if(!h)return;if(!a){h.played++;h.points+=1;return;}const hs=Number(m.home_score||0),as=Number(m.away_score||0);h.played++;a.played++;h.scored+=hs;h.conceded+=as;a.scored+=as;a.conceded+=hs;if(hs>as){h.wins++;h.points+=3;a.losses++;}else if(as>hs){a.wins++;a.points+=3;h.losses++;}else{h.draws++;a.draws++;h.points++;a.points++;}});return [...table.values()].sort((a,b)=>b.points-a.points||(b.scored-b.conceded)-(a.scored-a.conceded)||b.scored-a.scored);}

function renderTournamentPanel(event,teams,matches,isOrganizer){
    const area=document.getElementById("publicTournamentArea");
    if(!area)return;
    if(event.format==="standard"&&!teams.length&&!matches.length&&!isOrganizer){area.innerHTML="";return;}

    const teamMap=new Map(teams.map(team=>[team.id,team]));
    const standings=(event.format==="round_robin"||event.format==="swiss")&&matches.length?buildStandings(teams,matches):[];
    const rounds=[...new Set(matches.map(match=>match.round_number))].sort((a,b)=>a-b);

    const matchHtml=rounds.map(round=>{
        const roundMatches=matches.filter(match=>match.round_number===round);
        return '<div class="public-round"><h4>Ronda '+round+'</h4>'+roundMatches.map(match=>{
            const home=teamMap.get(match.home_team_id),away=teamMap.get(match.away_team_id);
            const finished=match.status==="finished";
            const bye=finished&&!match.home_team_id||finished&&!match.away_team_id;
            let action="";
            if(isOrganizer&&(event.format==="knockout"||event.format==="round_robin"||event.format==="swiss")&&!finished&&home&&away){
                action='<form class="match-result-form" data-match-id="'+match.id+'"><input type="number" min="0" step="0.01" name="home" placeholder="0" required><span>:</span><input type="number" min="0" step="0.01" name="away" placeholder="0" required><button class="button button-small" type="submit">Guardar</button></form>';
            }else if(finished&&home&&away){
                action='<strong>'+escapeHtml(match.home_score??"—")+' : '+escapeHtml(match.away_score??"—")+'</strong>';
            }else if(bye){
                action='<small>BYE · pasa de ronda</small>';
            }else{
                action='<small>Por definir</small>';
            }
            return '<div class="public-match-row"><div><span>Partido '+match.match_number+'</span><strong>'+publicTeamName(home)+' <em>vs</em> '+publicTeamName(away)+'</strong></div>'+action+'</div>';
        }).join("")+'</div>';
    }).join("");

    const teamHtml=teams.length?'<h3>Participantes / equipos</h3><div class="public-team-list">'+teams.map(team=>'<div class="public-team-row"><span>'+publicTeamName(team)+'</span><small>'+(team.seed?'Seed '+team.seed:'')+'</small></div>').join("")+'</div>':"";
    const hasBracket=matches.length>0;
    const swissReady=event.format==="swiss"&&!matches.some(m=>m.status==="scheduled"||m.status==="live");
    const organizerCanGenerate=(isOrganizer&&["knockout","round_robin"].includes(event.format)&&!hasBracket)||(isOrganizer&&event.format==="swiss"&&swissReady);
    const organizerTools=organizerCanGenerate
        ?'<div class="tournament-admin-box"><strong>'+(event.format==="swiss"&&hasBracket?"Generar siguiente ronda":"Generar cuadro / calendario")+'</strong><p>Curruscos calculará automáticamente los enfrentamientos a partir de los participantes y resultados.</p><button id="generateBracketButton" class="button button-primary" type="button">'+(event.format==="swiss"&&hasBracket?"Generar ronda":"Generar")+'</button><p id="tournamentAdminMessage"></p></div>'
        :"";
    const winner=hasBracket?(() => {const final=matches.filter(m=>m.round_number===Math.max(...rounds))[0];if(!final||final.status!=="finished"||!final.home_team_id||!final.away_team_id)return null;return final.home_score>final.away_score?teamMap.get(final.home_team_id):teamMap.get(final.away_team_id);})():null;

    area.innerHTML='<div class="public-tournament-panel"><span class="public-tournament-label">FORMATO</span><strong>'+escapeHtml(PUBLIC_FORMAT_LABELS[event.format]||"Formato")+'</strong>'+((event.rules)?'<p>'+escapeHtml(event.rules)+'</p>':"")+teamHtml+(hasBracket?'<h3>'+(event.format==="round_robin"?"Calendario":"Cuadro")+'</h3><div class="public-rounds">'+matchHtml+'</div>':"")+(standings.length?'<h3>Clasificación</h3><div class="public-standings">'+standings.map((row,i)=>'<div class="public-standing-row"><span>'+(i+1)+'. '+publicTeamName(row.team)+'</span><strong>'+row.points+' pts</strong><small>'+row.wins+'V · '+row.draws+'E · '+row.losses+'D</small></div>').join("")+'</div>':"")+(winner?'<div class="tournament-winner"><span>CAMPEÓN</span><strong>'+publicTeamName(winner)+'</strong></div>':"")+organizerTools+'</div>';

    const generate=document.getElementById("generateBracketButton");
    if(generate){
        generate.addEventListener("click",async()=>{
            generate.disabled=true;generate.textContent="Generando...";
            try{if(event.format==="knockout"){await generateKnockoutBracket(event.id);}else if(event.format==="round_robin"){await generateRoundRobinSchedule(event.id);}else{await generateSwissRound(event.id);}await renderPublicEvent();}
            catch(error){const message=document.getElementById("tournamentAdminMessage");if(message)message.textContent=error.message;generate.disabled=false;generate.textContent="Generar cuadro";}
        });
    }

    document.querySelectorAll(".match-result-form").forEach(form=>{
        form.addEventListener("submit",async e=>{
            e.preventDefault();
            const button=form.querySelector("button");const home=form.elements.home.value;const away=form.elements.away.value;
            if(event.format==="knockout"&&Number(home)===Number(away)){alert("En eliminación directa tiene que haber un ganador.");return;}
            button.disabled=true;button.textContent="Guardando...";
            try{await recordEventMatchResult(form.dataset.matchId,home,away);await renderPublicEvent();}
            catch(error){alert(error.message);button.disabled=false;button.textContent="Guardar";}
        });
    });
}

async function renderParticipantTeamArea(event,teams,teamMembers,participants,user,isOrganizer){
 if(isOrganizer||event.participant_mode!=="team"||!user)return "";
 const mine=teamMembers.find(m=>m.user_id===user.id);
 const team=mine?teams.find(t=>t.id===mine.team_id):null;
 const available=teams.filter(t=>(event.team_size==null||teamMembers.filter(m=>m.team_id===t.id).length<event.team_size));
 if(team){
   const count=teamMembers.filter(m=>m.team_id===team.id).length;
   return '<div class="participant-team-box"><span class="public-tournament-label">TU EQUIPO</span><h3>'+escapeHtml(team.name)+'</h3><p>'+count+(event.team_size?'/'+event.team_size:'')+' jugadores · '+(event.team_size&&count>=event.team_size?'Equipo completo':'Puedes seguir incorporando jugadores')+'</p><button id="leaveMyTeam" class="button button-small" type="button">Salir del equipo</button></div>';
 }
 return '<div class="participant-team-box"><span class="public-tournament-label">EQUIPOS</span><h3>Forma tu equipo</h3><p>Ya estás inscrito. Crea un equipo o únete a uno existente.</p><div class="join-team-list">'+(available.length?available.map(t=>'<button type="button" class="button button-small join-team" data-team="'+t.id+'">'+escapeHtml(t.name)+' · '+teamMembers.filter(m=>m.team_id===t.id).length+(event.team_size?'/'+event.team_size:'')+'</button>').join(""):'<small>No hay equipos con plazas disponibles.</small>')+'</div><form id="selfCreateTeamForm" class="self-create-team"><input id="selfTeamName" maxlength="80" placeholder="Nombre de tu equipo" required><button class="button button-primary" type="submit">Crear equipo</button></form></div>';
}
async function renderTeamManager(event,teams,teamMembers,participants,isOrganizer){if(!isOrganizer||!["knockout","round_robin"].includes(event.format))return "";const membersByTeam=new Map(teams.map(t=>[t.id,teamMembers.filter(m=>m.team_id===t.id)]));const names=new Map(participants.map(p=>[p.user_id,p.display_name||p.username||p.user_id.slice(0,8)]));return `<div class="team-manager"><div class="team-manager-head"><div><span class="public-tournament-label">ORGANIZACIÓN</span><h3>Equipos</h3><p>Crea equipos y asigna a los participantes inscritos. Después podrás generar el cuadro o calendario.</p></div><form id="createTeamForm"><input id="newTeamName" maxlength="80" placeholder="Nombre del equipo" required><button class="button button-primary" type="submit">Crear equipo</button></form></div><div class="team-manager-grid">${teams.map(team=>{const ms=membersByTeam.get(team.id)||[];const options=participants.filter(p=>!teamMembers.some(m=>m.user_id===p.user_id)).map(p=>`<option value="${p.user_id}">${names.get(p.user_id)}</option>`).join("");return `<div class="managed-team"><strong>${escapeHtml(team.name)}</strong><div class="managed-members">${ms.length?ms.map(m=>`<span>${escapeHtml(m.display_name||m.username||names.get(m.user_id))}<button type="button" class="remove-team-member" data-team="${team.id}" data-user="${m.user_id}" aria-label="Quitar">×</button></span>`).join(""):"<small>Sin jugadores</small>"}</div><form class="add-team-member" data-team="${team.id}"><select required><option value="">Añadir participante…</option>${options}</select><button class="button button-small" type="submit">Añadir</button></form></div>`;}).join("")}</div></div>`;}

async function renderPublicEvent(){
    const root=document.getElementById("publicEventRoot");
    const id=new URLSearchParams(location.search).get("id");
    if(!id){root.innerHTML='<div class="empty-state">Evento no encontrado.</div>';return;}
    const event=await getPublicEvent(id);
    if(!event){root.innerHTML='<div class="empty-state">Este evento no existe o ya no está publicado.</div>';return;}

    const user=await getCurrentUser();
    const participants=await getPublicEventParticipants(id);
    const teams=await getPublicEventTeams(id);
    const teamMembers=await getPublicEventTeamMembers(id);
    const matches=await getPublicEventMatches(id);
    const mine=user?participants.find(p=>p.user_id===user.id):null;
    const yes=participants.filter(p=>p.status==="yes").length;
    const full=event.capacity!==null&&yes>=event.capacity;
    const deadlinePassed=event.registration_deadline&&new Date(event.registration_deadline).getTime()<Date.now();
    const closed=event.status!=="published"||deadlinePassed;
    const fee=Number(event.entry_fee||0);
    const isOrganizer=!!user&&event.created_by===user.id;

    root.innerHTML='<span class="eyebrow">'+escapeHtml(PUBLIC_CATEGORY_LABELS[event.category]||"EVENTO")+'</span><div class="public-event-shell"><article class="public-event-main"><h1>'+escapeHtml(event.title)+'</h1><p><strong>'+escapeHtml(publicDate(event))+'</strong>'+(event.time?" · "+escapeHtml(event.time):"")+(event.location?" · 📍 "+escapeHtml(event.location):"")+'</p>'+((event.organizer_name)?'<p><strong>Organiza:</strong> '+escapeHtml(event.organizer_name)+'</p>':"")+'<div class="public-event-description">'+escapeHtml(event.description||"El organizador todavía no ha añadido una descripción.")+'</div></article><aside class="public-event-side"><div class="public-event-stat"><span>Participantes</span><strong>'+yes+(event.capacity?"/"+event.capacity:"")+'</strong></div><div class="public-event-stat"><span>Precio</span><strong>'+(fee>0?fee.toFixed(2).replace(".",",")+" €":"Gratis")+'</strong></div><div class="public-event-stat"><span>Inscripción</span><strong>'+((event.registration_deadline)?new Date(event.registration_deadline).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"}):"Hasta completar plazas")+'</strong></div><button id="eventJoinButton" class="button button-primary" type="button">'+(mine?.status==="yes"?"Ya estás apuntado":(closed?(event.status==="finished"?"Evento finalizado":"Inscripciones cerradas"):(full?"Plazas completas":"Apuntarme al evento")))+'</button><p id="eventJoinNote" class="public-login-note">'+(user?"":'Necesitas una cuenta para apuntarte. <a href="login.html">Entrar o crear cuenta</a>.')+'</p></aside></div><div id="publicTournamentArea"></div>';

    const manager=await renderTeamManager(event,teams,teamMembers,participants,isOrganizer);
    const participantTeam=await renderParticipantTeamArea(event,teams,teamMembers,participants,user,isOrganizer);
    renderTournamentPanel(event,teams,matches,isOrganizer);
    const participantArea=document.getElementById("publicTournamentArea");
    if(participantArea && participants.length){
        const participantList=participants.filter(p=>p.status==="yes").map(p=>`<a class="public-participant-row" href="perfil-publico.html?id=${encodeURIComponent(p.user_id)}"><span>${escapeHtml(p.display_name||p.username||"Participante")}</span><small>${p.user_id===user?.id?"Tú":"Ver perfil"}</small></a>`).join("");
        participantArea.insertAdjacentHTML("beforeend",`<div class="public-tournament-panel participant-list-panel"><span class="public-tournament-label">COMUNIDAD</span><h3>Participantes</h3><div class="public-participant-list">${participantList}</div></div>`);
    }
    if(participantTeam){const area=document.getElementById("publicTournamentArea");area.insertAdjacentHTML("afterbegin",participantTeam);document.querySelectorAll(".join-team").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await joinEventTeam(button.dataset.team);await renderPublicEvent();}catch(err){alert(err.message);button.disabled=false;}}));document.getElementById("selfCreateTeamForm")?.addEventListener("submit",async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await createEventTeamForSelf(event.id,document.getElementById("selfTeamName").value);await renderPublicEvent();}catch(err){alert(err.message);button.disabled=false;}});document.getElementById("leaveMyTeam")?.addEventListener("click",async e=>{e.target.disabled=true;try{const mine=teamMembers.find(m=>m.user_id===user.id);await leaveEventTeam(mine.team_id);await renderPublicEvent();}catch(err){alert(err.message);e.target.disabled=false;}});}
    if(manager){const area=document.getElementById("publicTournamentArea");area.insertAdjacentHTML("afterbegin",manager);document.getElementById("createTeamForm")?.addEventListener("submit",async e=>{e.preventDefault();const input=document.getElementById("newTeamName");const button=e.submitter;button.disabled=true;try{await createEventTeam(event.id,input.value);await renderPublicEvent();}catch(err){alert(err.message);button.disabled=false;}});document.querySelectorAll(".add-team-member").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const select=form.querySelector("select");try{await addEventTeamMember(form.dataset.team,select.value);await renderPublicEvent();}catch(err){alert(err.message);}}));document.querySelectorAll(".remove-team-member").forEach(button=>button.addEventListener("click",async()=>{try{await removeEventTeamMember(button.dataset.team,button.dataset.user);await renderPublicEvent();}catch(err){alert(err.message);}}));}

    const btn=document.getElementById("eventJoinButton");
    if(!user){btn.addEventListener("click",()=>location.href="login.html");return;}
    if(mine?.status==="yes"){btn.addEventListener("click",async()=>{btn.disabled=true;await leavePublicEvent(id);await renderPublicEvent();});return;}
    if(full||closed){btn.disabled=true;return;}
    btn.addEventListener("click",async()=>{btn.disabled=true;btn.textContent="Apuntando...";const joined=await joinPublicEvent(id);if(!joined){btn.disabled=false;btn.textContent="Apuntarme al evento";document.getElementById("eventJoinNote").textContent="No se ha podido completar la inscripción.";return;}await renderPublicEvent();});
}

document.addEventListener("DOMContentLoaded",renderPublicEvent);