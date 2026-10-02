function esc(v){return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
document.addEventListener("DOMContentLoaded",async()=>{
 const root=document.getElementById("profileRoot");
 const id=new URLSearchParams(location.search).get("id");
 if(!id){root.innerHTML='<div class="pub-empty">Perfil no encontrado.</div>';return;}
 const p=await getPublicProfile(id);
 if(!p){root.innerHTML='<div class="pub-empty">Este perfil no está disponible.</div>';return;}
 const name=p.display_name||p.username||"Jugador";
 const matches=Number(p.wins||0)+Number(p.draws||0)+Number(p.losses||0);
 const organized=Number(p.organized_events||0);
 root.className="";
 root.innerHTML=`<section class="pub-card"><div class="pub-head"><div class="pub-avatar">${esc(name.charAt(0).toUpperCase())}</div><div><span class="eyebrow">PARTICIPANTE</span><h1>${esc(name)}</h1><p>${p.username?"@"+esc(p.username):"Perfil público de Curruscos"}</p>${organized?'<span class="pub-badge">Organizador · '+organized+' evento'+(organized===1?'':'s')+'</span>':''}</div></div><div class="pub-stats"><div class="pub-stat"><span>Eventos</span><strong>${Number(p.events_played||0)}</strong></div><div class="pub-stat"><span>Partidos</span><strong>${matches}</strong></div><div class="pub-stat"><span>Victorias</span><strong>${Number(p.wins||0)}</strong></div><div class="pub-stat"><span>Puntos</span><strong>${Number(p.points||0)}</strong></div><div class="pub-stat"><span>Equipos</span><strong>${Number(p.teams_count||0)}</strong></div></div><div class="pub-record"><div class="pub-record-item"><span>Victorias</span><strong>${Number(p.wins||0)}</strong></div><div class="pub-record-item"><span>Empates</span><strong>${Number(p.draws||0)}</strong></div><div class="pub-record-item"><span>Derrotas</span><strong>${Number(p.losses||0)}</strong></div></div><p class="pub-note">Las estadísticas solo utilizan actividad de eventos públicos visibles en Curruscos. No se muestran datos de grupos privados.</p></section>`;
});