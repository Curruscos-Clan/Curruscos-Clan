function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

const PUBLIC_ACTIVITY_LABELS={padel:"Pádel",futbol:"Fútbol",baloncesto:"Baloncesto",tenis:"Tenis",ajedrez:"Ajedrez",gaming:"Gaming",running:"Running",otro:"Otro"};
const PUBLIC_SCORING_LABELS={win_draw_loss:"Victoria · 3 pts / empate · 1",chess:"Ajedrez · 1 / ½ / 0",points:"Puntos por resultado",race:"Clasificación por tiempo"};
const PUBLIC_CATEGORY_LABELS={tournament:"Torneo",sport:"Deporte",gaming:"Gaming",social:"Social",activity:"Actividad",other:"Otro"};
const PUBLIC_FORMAT_LABELS={standard:"Evento libre",knockout:"Eliminación directa",round_robin:"Liga / todos contra todos",swiss:"Sistema suizo",race:"Carrera / clasificación",custom:"Formato personalizado"};

function publicDate(event){const d=new Date(event.date+"T"+(event.time||"00:00"));return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
function publicTeamName(team){return escapeHtml(team?.name||"Por definir");}
function renderParticipantDashboard(event,teams,teamMembers,matches,user,mine){
    if(!user||mine?.status!=="yes")return "";
    const teamMember=teamMembers.find(m=>m.user_id===user.id);
    const myTeam=teamMember?teams.find(t=>t.id===teamMember.team_id):null;
    const myMatches=myTeam?matches.filter(m=>m.home_team_id===myTeam.id||m.away_team_id===myTeam.id):[];
    const nextMatch=myMatches.find(m=>m.status==="live")||myMatches.find(m=>m.status==="scheduled");
    let wins=0,draws=0,losses=0,played=0,points=0;
    myMatches.filter(m=>m.status==="finished"&&m.home_team_id&&m.away_team_id).forEach(m=>{
        const mineHome=m.home_team_id===myTeam?.id;
        const mineScore=Number(mineHome?m.home_score:m.away_score);
        const oppScore=Number(mineHome?m.away_score:m.home_score);
        played++;
        if(mineScore>oppScore){wins++;points+=event.scoring_system==="chess"?1:event.scoring_system==="points"?mineScore:3;}
        else if(mineScore<oppScore){losses++;}
        else{draws++;points+=event.scoring_system==="chess"?0.5:event.scoring_system==="points"?mineScore:1;}
    });
    const status=event.status==="finished"?"Finalizado":nextMatch?.status==="live"?"En directo":myMatches.length?"En competición":"Inscripción confirmada";
    const nextHtml=nextMatch?(()=>{const home=teams.find(t=>t.id===nextMatch.home_team_id),away=teams.find(t=>t.id===nextMatch.away_team_id);return '<div class="participant-next-match"><span>'+escapeHtml(nextMatch.status==="live"?"EN DIRECTO":"PRÓXIMO PARTIDO")+'</span><strong>'+publicTeamName(home)+' <em>vs</em> '+publicTeamName(away)+'</strong>'+(nextMatch.scheduled_at?'<small>'+new Date(nextMatch.scheduled_at).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"})+'</small>':"")+'</div>';})():'<div class="participant-next-match participant-next-empty"><span>PRÓXIMO PASO</span><strong>'+escapeHtml(event.format==="standard"?"Ya estás dentro del evento":"El organizador todavía no ha publicado tu siguiente enfrentamiento")+'</strong></div>';
    return '<section class="participant-dashboard"><div class="participant-dashboard-head"><div><span class="public-tournament-label">TU COMPETICIÓN</span><h3>'+escapeHtml(status)+'</h3><p>'+escapeHtml(myTeam?"Equipo · "+myTeam.name:"Participación individual")+'</p></div><div class="participant-record"><strong>'+played+'</strong><span>partidos</span></div></div>'+nextHtml+'<div class="participant-mini-stats"><div><strong>'+wins+'</strong><span>Victorias</span></div><div><strong>'+draws+'</strong><span>Empates</span></div><div><strong>'+losses+'</strong><span>Derrotas</span></div><div><strong>'+points+'</strong><span>Puntos</span></div></div></section>';
}

function buildStandings(teams,matches,scoringSystem="win_draw_loss"){const table=new Map(teams.map(t=>[t.id,{team:t,played:0,wins:0,draws:0,losses:0,points:0,scored:0,conceded:0}]));const award=(result)=>scoringSystem==="chess"?(result==="win"?1:result==="draw"?0.5:0):scoringSystem==="points"?Number(result||0):(result==="win"?3:result==="draw"?1:0);matches.filter(m=>m.status==="finished"&&m.home_team_id).forEach(m=>{const h=table.get(m.home_team_id),a=m.away_team_id?table.get(m.away_team_id):null;if(!h)return;if(!a){h.played++;h.points+=scoringSystem==="chess"?1:1;return;}const hs=Number(m.home_score||0),as=Number(m.away_score||0);h.played++;a.played++;h.scored+=hs;h.conceded+=as;a.scored+=as;a.conceded+=hs;if(hs>as){h.wins++;h.points+=award("win");a.losses++;}else if(as>hs){a.wins++;a.points+=award("win");h.losses++;}else{h.draws++;a.draws++;h.points+=award("draw");a.points+=award("draw");}});return [...table.values()].sort((a,b)=>b.points-a.points||(b.scored-b.conceded)-(a.scored-a.conceded)||b.scored-a.scored);}

function renderSportResultForm(event,match){
    if(match.status==="finished") return '<strong>'+escapeHtml(match.home_score??"—")+' : '+escapeHtml(match.away_score??"—")+'</strong>';
    if(event.event_type==="tenis"||event.event_type==="padel") return '<form class="sport-result-form sets-result-form" data-match-id="'+match.id+'"><div class="set-inputs"><label>Set 1 <input name="s1h" type="number" min="0" max="99" required><input name="s1a" type="number" min="0" max="99" required></label><label>Set 2 <input name="s2h" type="number" min="0" max="99" required><input name="s2a" type="number" min="0" max="99" required></label><label>Set 3 <input name="s3h" type="number" min="0" max="99"><input name="s3a" type="number" min="0" max="99"></label></div><button class="button button-small" type="submit">Guardar sets</button></form>';
    if(event.event_type==="ajedrez") return '<form class="sport-result-form chess-result-form" data-match-id="'+match.id+'"><select name="result" required><option value="">Resultado…</option><option value="1-0">1 — 0</option><option value="0.5-0.5">½ — ½</option><option value="0-1">0 — 1</option></select><button class="button button-small" type="submit">Guardar</button></form>';
    return '<form class="match-result-form" data-match-id="'+match.id+'"><input type="number" min="0" step="1" name="home" placeholder="0" required><span>:</span><input type="number" min="0" step="1" name="away" placeholder="0" required><button class="button button-small" type="submit">Guardar</button></form>';
}

async function renderRacePanel(event,participants,isOrganizer){
    if(event.format!=="race")return;
    const area=document.getElementById("publicTournamentArea");if(!area)return;
    const results=await getPublicRaceResults(event.id);
    const rows=results.map((r,i)=>'<div class="race-row"><strong>'+(r.finish_position||i+1)+'</strong><span>'+escapeHtml(r.display_name||r.username||"Participante")+'</span><strong>'+formatRaceTime(r.time_ms)+'</strong><small>'+(r.points!=null?escapeHtml(r.points)+" pts":"")+'</small></div>').join("");
    const options=participants.filter(p=>p.status==="yes"&&!results.some(r=>r.participant_id===p.user_id)).map(p=>'<option value="'+p.user_id+'">'+escapeHtml(p.display_name||p.username||"Participante")+'</option>').join("");
    const admin=isOrganizer?'<form id="raceResultForm" class="race-admin-form"><select id="raceParticipant" required><option value="">Participante…</option>'+options+'</select><input id="raceTime" type="text" inputmode="numeric" placeholder="MM:SS.mmm" required><input id="racePosition" type="number" min="1" placeholder="Posición"><input id="racePoints" type="number" min="0" step="0.01" placeholder="Puntos"><button class="button button-primary" type="submit">Registrar resultado</button></form>':"";
    area.insertAdjacentHTML("beforeend",'<div class="public-tournament-panel race-panel"><span class="public-tournament-label">CLASIFICACIÓN</span><h3>Resultados de carrera</h3>'+admin+'<div class="race-table">'+(rows||'<small>Aún no hay resultados registrados.</small>')+'</div></div>');
    if(isOrganizer)document.getElementById("raceResultForm")?.addEventListener("submit",async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await recordRaceResult(event.id,document.getElementById("raceParticipant").value,parseRaceTime(document.getElementById("raceTime").value),Number(document.getElementById("racePosition").value)||null,document.getElementById("racePoints").value===""?null:Number(document.getElementById("racePoints").value));await renderPublicEvent();}catch(err){alert(err.message);b.disabled=false;}});
}
function parseRaceTime(value){const m=String(value).trim().match(/^(?:(\\d+):)?(\\d+)(?:\\.(\\d{1,3}))?$/);if(!m)throw new Error("Tiempo inválido. Usa MM:SS.mmm");const minutes=Number(m[1]||0),seconds=Number(m[2]);if(seconds>=60)throw new Error("Los segundos deben estar entre 0 y 59.");const ms=Number((m[3]||"").padEnd(3,"0")||0);return minutes*60000+seconds*1000+ms;}
function formatRaceTime(ms){if(ms==null)return "—";const n=Number(ms),minutes=Math.floor(n/60000),seconds=Math.floor((n%60000)/1000),millis=n%1000;return String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0")+"."+String(millis).padStart(3,"0");}

function renderTournamentPanel(event,teams,matches,isOrganizer){
    const area=document.getElementById("publicTournamentArea");
    if(!area)return;
    if(event.format==="standard"&&!teams.length&&!matches.length&&!isOrganizer){area.innerHTML="";return;}

    const teamMap=new Map(teams.map(team=>[team.id,team]));
    const standings=(event.format==="round_robin"||event.format==="swiss")&&matches.length?buildStandings(teams,matches,event.scoring_system):[];
    const rounds=[...new Set(matches.map(match=>match.round_number))].sort((a,b)=>a-b);

    const matchHtml=rounds.map(round=>{
        const roundMatches=matches.filter(match=>match.round_number===round);
        return '<div class="public-round"><h4>Ronda '+round+'</h4>'+roundMatches.map(match=>{
            const home=teamMap.get(match.home_team_id),away=teamMap.get(match.away_team_id);
            const finished=match.status==="finished";
            const bye=finished&&!match.home_team_id||finished&&!match.away_team_id;
            let action="";
            if(isOrganizer&&(event.format==="knockout"||event.format==="round_robin"||event.format==="swiss")&&!finished&&home&&away){
                action=renderSportResultForm(event,match);
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

    document.querySelectorAll(".sets-result-form").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const b=form.querySelector("button");const values=[1,2,3].map(i=>({home:form.elements["s"+i+"h"].value,away:form.elements["s"+i+"a"].value})).filter(s=>s.home!==""&&s.away!=="").map(s=>({home:Number(s.home),away:Number(s.away)}));if(values.length<2)return alert("Introduce al menos dos sets.");b.disabled=true;try{await recordTennisPadelResult(form.dataset.matchId,values);await renderPublicEvent();}catch(err){alert(err.message);b.disabled=false;}}));
    document.querySelectorAll(".chess-result-form").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const b=form.querySelector("button");const [h,a]=form.elements.result.value.split("-").map(Number);b.disabled=true;try{await recordChessResult(form.dataset.matchId,h,a);await renderPublicEvent();}catch(err){alert(err.message);b.disabled=false;}}));
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

const EVENT_STATUS_LABELS={draft:"Borrador",published:"Inscripciones abiertas",preparing:"Preparando",live:"En directo",finished:"Finalizado",cancelled:"Cancelado"};
function renderOrganizerCommandCenter(event,participants,teams,matches,isOrganizer){
 if(!isOrganizer)return "";
 const confirmed=participants.filter(p=>p.status==="yes").length;
 const finished=matches.filter(m=>m.status==="finished").length;
 const pending=matches.filter(m=>m.status==="scheduled"||m.status==="live").length;
 const hasMatches=matches.length>0;
 const competition=event.format!=="standard";
 const action=competition&&!hasMatches?'<button id="commandGenerate" class="button button-primary" type="button">Generar competición</button>':(hasMatches&&event.status==="preparing"?'<button id="commandLive" class="button button-primary" type="button">Empezar competición</button>':event.status==="live"&&pending===0?'<button id="commandFinish" class="button button-primary" type="button">Finalizar evento</button>':"");
 return '<section class="organizer-command-center"><div class="command-head"><div><span class="public-tournament-label">CENTRO DE MANDO</span><h3>Control del evento</h3><p>Todo lo importante del evento, en un solo sitio.</p></div>'+action+'</div><div class="command-stats"><div><strong>'+confirmed+'</strong><span>Inscritos</span></div><div><strong>'+teams.length+'</strong><span>Equipos</span></div><div><strong>'+matches.length+'</strong><span>Partidos</span></div><div><strong>'+finished+'</strong><span>Terminados</span></div></div><div class="command-progress"><div><span>Progreso de competición</span><strong>'+(matches.length?Math.round(finished/matches.length*100):0)+'%</strong></div><div class="command-progress-track"><i style="width:'+(matches.length?Math.round(finished/matches.length*100):0)+'%"></i></div></div></section>';
}

function renderOrganizerLifecycle(event,isOrganizer){
 if(!isOrganizer)return "";
 const current=EVENT_STATUS_LABELS[event.status]||event.status;
 const choices=["published","preparing","live","finished","cancelled"].filter(s=>s!==event.status);
 return '<div class="event-lifecycle"><div><span class="public-tournament-label">ESTADO DEL EVENTO</span><strong>'+escapeHtml(current)+'</strong><small>Controla cuándo se puede inscribir la gente y cuándo empieza la competición.</small></div><select id="eventStatusSelect"><option value="">Cambiar estado…</option>'+choices.map(s=>'<option value="'+s+'">'+EVENT_STATUS_LABELS[s]+'</option>').join("")+'</select></div>';
}

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
    const participantDashboard=renderParticipantDashboard(event,teams,teamMembers,matches,user,mine);
    const lifecycle=renderOrganizerLifecycle(event,isOrganizer);
    const commandCenter=renderOrganizerCommandCenter(event,participants,teams,matches,isOrganizer);

    root.innerHTML='<span class="eyebrow">'+escapeHtml(PUBLIC_ACTIVITY_LABELS[event.event_type]||PUBLIC_CATEGORY_LABELS[event.category]||"EVENTO")+'</span><div class="public-event-shell"><article class="public-event-main"><h1>'+escapeHtml(event.title)+'</h1><p><strong>'+escapeHtml(publicDate(event))+'</strong>'+(event.time?" · "+escapeHtml(event.time):"")+(event.location?" · "+escapeHtml(event.location):"")+'</p>'+((event.organizer_name)?'<p><strong>Organiza:</strong> '+escapeHtml(event.organizer_name)+'</p>':"")+'<div class="public-event-description">'+escapeHtml(event.description||"El organizador todavía no ha añadido una descripción.")+'</div></article><aside class="public-event-side"><div class="public-event-stat"><span>Participantes</span><strong>'+yes+(event.capacity?"/"+event.capacity:"")+'</strong></div><div class="public-event-stat"><span>Precio</span><strong>'+(fee>0?fee.toFixed(2).replace(".",",")+" €":"Gratis")+'</strong></div><div class="public-event-stat"><span>Inscripción</span><strong>'+((event.registration_deadline)?new Date(event.registration_deadline).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"}):"Hasta completar plazas")+'</strong></div><button id="eventJoinButton" class="button button-primary" type="button">'+(mine?.status==="yes"?"Ya estás apuntado":(closed?(event.status==="finished"?"Evento finalizado":"Inscripciones cerradas"):(full?"Plazas completas":"Apuntarme al evento")))+'</button><p id="eventJoinNote" class="public-login-note">'+(user?"":'Necesitas una cuenta para apuntarte. <a href="login.html">Entrar o crear cuenta</a>.')+'</p></aside></div><div id="publicTournamentArea"></div>';

    const manager=await renderTeamManager(event,teams,teamMembers,participants,isOrganizer);
    const participantTeam=await renderParticipantTeamArea(event,teams,teamMembers,participants,user,isOrganizer);
    renderTournamentPanel(event,teams,matches,isOrganizer);
    if(participantDashboard){document.getElementById("publicTournamentArea")?.insertAdjacentHTML("afterbegin",participantDashboard);}
    await renderRacePanel(event,participants,isOrganizer);
    if(lifecycle){const area=document.getElementById("publicTournamentArea");area.insertAdjacentHTML("afterbegin",lifecycle);document.getElementById("eventStatusSelect")?.addEventListener("change",async e=>{if(!e.target.value)return;e.target.disabled=true;try{await setPublicEventStatus(event.id,e.target.value);await renderPublicEvent();}catch(err){alert(err.message);e.target.disabled=false;e.target.value="";}});}
    if(commandCenter){const area=document.getElementById("publicTournamentArea");area.insertAdjacentHTML("afterbegin",commandCenter);document.getElementById("commandGenerate")?.addEventListener("click",async e=>{e.target.disabled=true;try{if(event.format==="knockout")await generateKnockoutBracket(event.id);else if(event.format==="round_robin")await generateRoundRobinSchedule(event.id);else if(event.format==="swiss")await generateSwissRound(event.id);await setPublicEventStatus(event.id,"preparing");await renderPublicEvent();}catch(err){alert(err.message);e.target.disabled=false;}});document.getElementById("commandLive")?.addEventListener("click",async e=>{e.target.disabled=true;try{await setPublicEventStatus(event.id,"live");await renderPublicEvent();}catch(err){alert(err.message);e.target.disabled=false;}});document.getElementById("commandFinish")?.addEventListener("click",async e=>{e.target.disabled=true;try{await setPublicEventStatus(event.id,"finished");await renderPublicEvent();}catch(err){alert(err.message);e.target.disabled=false;}});}
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