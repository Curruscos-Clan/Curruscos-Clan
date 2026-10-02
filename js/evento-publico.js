function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

const PUBLIC_CATEGORY_LABELS={tournament:"Torneo",sport:"Deporte",gaming:"Gaming",social:"Social",activity:"Actividad",other:"Otro"};
const PUBLIC_FORMAT_LABELS={standard:"Evento libre",knockout:"Eliminación directa",round_robin:"Liga / todos contra todos",swiss:"Sistema suizo",race:"Carrera / clasificación",custom:"Formato personalizado"};

function publicDate(event){const d=new Date(event.date+"T"+(event.time||"00:00"));return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"});}
function publicTeamName(team){return escapeHtml(team?.name||"Por definir");}

function renderTournamentPanel(event,teams,matches,isOrganizer){
    const area=document.getElementById("publicTournamentArea");
    if(!area)return;
    if(event.format==="standard"&&!teams.length&&!matches.length&&!isOrganizer){area.innerHTML="";return;}

    const teamMap=new Map(teams.map(team=>[team.id,team]));
    const rounds=[...new Set(matches.map(match=>match.round_number))].sort((a,b)=>a-b);

    const matchHtml=rounds.map(round=>{
        const roundMatches=matches.filter(match=>match.round_number===round);
        return '<div class="public-round"><h4>Ronda '+round+'</h4>'+roundMatches.map(match=>{
            const home=teamMap.get(match.home_team_id),away=teamMap.get(match.away_team_id);
            const finished=match.status==="finished";
            const bye=finished&&!match.home_team_id||finished&&!match.away_team_id;
            let action="";
            if(isOrganizer&&event.format==="knockout"&&!finished&&home&&away){
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
    const organizerTools=isOrganizer&&event.format==="knockout"&&!hasBracket
        ?'<div class="tournament-admin-box"><strong>Generar cuadro</strong><p>Curruscos usará los participantes confirmados y creará automáticamente las rondas.</p><button id="generateBracketButton" class="button button-primary" type="button">Generar cuadro</button><p id="tournamentAdminMessage"></p></div>'
        :"";
    const winner=hasBracket?(() => {const final=matches.filter(m=>m.round_number===Math.max(...rounds))[0];if(!final||final.status!=="finished"||!final.home_team_id||!final.away_team_id)return null;return final.home_score>final.away_score?teamMap.get(final.home_team_id):teamMap.get(final.away_team_id);})():null;

    area.innerHTML='<div class="public-tournament-panel"><span class="public-tournament-label">FORMATO</span><strong>'+escapeHtml(PUBLIC_FORMAT_LABELS[event.format]||"Formato")+'</strong>'+((event.rules)?'<p>'+escapeHtml(event.rules)+'</p>':"")+teamHtml+(hasBracket?'<h3>Cuadro</h3><div class="public-rounds">'+matchHtml+'</div>':"")+(winner?'<div class="tournament-winner"><span>CAMPEÓN</span><strong>'+publicTeamName(winner)+'</strong></div>':"")+organizerTools+'</div>';

    const generate=document.getElementById("generateBracketButton");
    if(generate){
        generate.addEventListener("click",async()=>{
            generate.disabled=true;generate.textContent="Generando...";
            try{await generateKnockoutBracket(event.id);await renderPublicEvent();}
            catch(error){const message=document.getElementById("tournamentAdminMessage");if(message)message.textContent=error.message;generate.disabled=false;generate.textContent="Generar cuadro";}
        });
    }

    document.querySelectorAll(".match-result-form").forEach(form=>{
        form.addEventListener("submit",async e=>{
            e.preventDefault();
            const button=form.querySelector("button");const home=form.elements.home.value;const away=form.elements.away.value;
            if(Number(home)===Number(away)){alert("En eliminación directa tiene que haber un ganador.");return;}
            button.disabled=true;button.textContent="Guardando...";
            try{await recordEventMatchResult(form.dataset.matchId,home,away);await renderPublicEvent();}
            catch(error){alert(error.message);button.disabled=false;button.textContent="Guardar";}
        });
    });
}

async function renderPublicEvent(){
    const root=document.getElementById("publicEventRoot");
    const id=new URLSearchParams(location.search).get("id");
    if(!id){root.innerHTML='<div class="empty-state">Evento no encontrado.</div>';return;}
    const event=await getPublicEvent(id);
    if(!event){root.innerHTML='<div class="empty-state">Este evento no existe o ya no está publicado.</div>';return;}

    const user=await getCurrentUser();
    const participants=user?await getPublicEventParticipants(id):[];
    const teams=await getPublicEventTeams(id);
    const matches=await getPublicEventMatches(id);
    const mine=user?participants.find(p=>p.user_id===user.id):null;
    const yes=participants.filter(p=>p.status==="yes").length;
    const full=event.capacity!==null&&yes>=event.capacity;
    const deadlinePassed=event.registration_deadline&&new Date(event.registration_deadline).getTime()<Date.now();
    const closed=event.status!=="published"||deadlinePassed;
    const fee=Number(event.entry_fee||0);
    const isOrganizer=!!user&&event.created_by===user.id;

    root.innerHTML='<span class="eyebrow">'+escapeHtml(PUBLIC_CATEGORY_LABELS[event.category]||"EVENTO")+'</span><div class="public-event-shell"><article class="public-event-main"><h1>'+escapeHtml(event.title)+'</h1><p><strong>'+escapeHtml(publicDate(event))+'</strong>'+(event.time?" · "+escapeHtml(event.time):"")+(event.location?" · 📍 "+escapeHtml(event.location):"")+'</p>'+((event.organizer_name)?'<p><strong>Organiza:</strong> '+escapeHtml(event.organizer_name)+'</p>':"")+'<div class="public-event-description">'+escapeHtml(event.description||"El organizador todavía no ha añadido una descripción.")+'</div></article><aside class="public-event-side"><div class="public-event-stat"><span>Participantes</span><strong>'+yes+(event.capacity?"/"+event.capacity:"")+'</strong></div><div class="public-event-stat"><span>Precio</span><strong>'+(fee>0?fee.toFixed(2).replace(".",",")+" €":"Gratis")+'</strong></div><div class="public-event-stat"><span>Inscripción</span><strong>'+((event.registration_deadline)?new Date(event.registration_deadline).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"}):"Hasta completar plazas")+'</strong></div><button id="eventJoinButton" class="button button-primary" type="button">'+(mine?.status==="yes"?"Ya estás apuntado":(closed?(event.status==="finished"?"Evento finalizado":"Inscripciones cerradas"):(full?"Plazas completas":"Apuntarme al evento")))+'</button><p id="eventJoinNote" class="public-login-note">'+(user?"":'Necesitas una cuenta para apuntarte. <a href="login.html">Entrar o crear cuenta</a>.')+'</p></aside></div><div id="publicTournamentArea"></div>';

    renderTournamentPanel(event,teams,matches,isOrganizer);

    const btn=document.getElementById("eventJoinButton");
    if(!user){btn.addEventListener("click",()=>location.href="login.html");return;}
    if(mine?.status==="yes"){btn.addEventListener("click",async()=>{btn.disabled=true;await leavePublicEvent(id);await renderPublicEvent();});return;}
    if(full||closed){btn.disabled=true;return;}
    btn.addEventListener("click",async()=>{btn.disabled=true;btn.textContent="Apuntando...";const joined=await joinPublicEvent(id);if(!joined){btn.disabled=false;btn.textContent="Apuntarme al evento";document.getElementById("eventJoinNote").textContent="No se ha podido completar la inscripción.";return;}await renderPublicEvent();});
}

document.addEventListener("DOMContentLoaded",renderPublicEvent);