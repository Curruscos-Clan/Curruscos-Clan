/* Curruscos Fantasy: datos reales visibles para el usuario; plantilla local al dispositivo. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const state = {user:null,players:[],roster:[],budget:15,captainId:null,ratings:{},participants:[],channel:null};
  const KEY = 'curruscos_fantasy_v1:';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => Number(v).toFixed(2).replace('.', ',') + ' M';
  const avatar = p => p.avatar_url || ('https://ui-avatars.com/api/?name='+encodeURIComponent(p.name||'CC')+'&background=17191f&color=fff&size=160');
  const rating = id => state.ratings[id] || {};
  function points(p) {
    const r=rating(p.id), played=state.participants.filter(x=>x.user_id===p.id && ['attended','completed','played','confirmed'].includes(String(x.status||'').toLowerCase())).length;
    const reliability=Number(r.reliability_score), elo=Number(r.sport_elos);
    return Math.round(played*3+(Number.isFinite(reliability)?reliability*.08:0)+(Number.isFinite(elo)?elo/100:0));
  }
  function value(p) {
    const r=rating(p.id), attendance=Number(r.attended_count), reliability=Number(r.reliability_score);
    return Math.round((2+Math.min(6,Math.max(0,Number.isFinite(attendance)?attendance:0)*.22)+(Number.isFinite(reliability)?Math.max(0,Math.min(100,reliability))*.025:0))*100)/100;
  }
  function save() {
    try { localStorage.setItem(KEY+state.user.id,JSON.stringify({ids:state.roster.map(p=>p.id),captainId:state.captainId})); } catch (_) {}
  }
  function restore() {
    try {
      const s=JSON.parse(localStorage.getItem(KEY+state.user.id)||'null');
      if(!s) return;
      state.roster=(s.ids||[]).slice(0,3).map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
      state.budget=Math.max(0,Math.round((15-state.roster.reduce((n,p)=>n+p.value,0))*100)/100);
      state.captainId=state.roster.some(p=>p.id===s.captainId)?s.captainId:(state.roster[0]&&state.roster[0].id);
    } catch (_) {}
  }
  function renderRoster() {
    const root=$('#roster-mount-point'); if(!root) return;
    const total=state.roster.reduce((n,p)=>n+points(p)*(p.id===state.captainId?2:1),0);
    let html='<div class="fantasy-budget-row"><div><span class="muted-label">PRESUPUESTO DISPONIBLE</span><strong>'+money(state.budget)+'</strong></div><div class="fantasy-score"><span class="muted-label">PUNTOS ESTIMADOS</span><strong>'+total+' <small>PTS</small></strong></div></div><div class="fantasy-slots">';
    for(let i=0;i<3;i++){
      const p=state.roster[i];
      if(!p){html+='<div class="fantasy-slot fantasy-slot-empty"><span class="slot-number">0'+(i+1)+'</span><span><strong>Plaza libre</strong><small>Elige a alguien del mercado</small></span></div>';continue;}
      html+='<article class="fantasy-slot"><img src="'+esc(avatar(p))+'" alt="" loading="lazy"><div class="fantasy-player-main"><strong>'+esc(p.name)+'</strong><small>'+points(p)+' pts base · '+money(p.value)+'</small></div><div class="fantasy-player-actions">'+(p.id===state.captainId?'<span class="captain-pill">C ×2</span>':'<button class="mini-action" data-captain="'+esc(p.id)+'" aria-label="Elegir capitán">C</button>')+'<button class="mini-action remove" data-remove="'+esc(p.id)+'" aria-label="Vender jugador">×</button></div></article>';
    }
    root.innerHTML=html+'</div><p class="fantasy-note">El capitán duplica sus puntos estimados. La plantilla se guarda en este dispositivo.</p>';
    root.querySelectorAll('[data-captain]').forEach(b=>b.addEventListener('click',()=>{state.captainId=b.dataset.captain;save();render();}));
    root.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>sell(b.dataset.remove)));
  }
  function renderMarket() {
    const root=$('#market-mount-point');if(!root)return;
    const q=($('#market-search')?.value||'').trim().toLocaleLowerCase('es'),ids=new Set(state.roster.map(p=>p.id));
    const list=state.players.filter(p=>!ids.has(p.id)&&p.name.toLocaleLowerCase('es').includes(q));
    if(!list.length){root.innerHTML='<div class="fantasy-empty"><span>◎</span><strong>'+(state.players.length?'No hay jugadores disponibles':'No hay miembros visibles')+'</strong><p>'+(state.players.length?'Prueba otra búsqueda o libera una plaza.':'Únete a un grupo para ver miembros disponibles.')+'</p></div>';return;}
    let html='<div class="market-list">';
    list.forEach(p=>{
      const r=rating(p.id),att=Number(r.attended_count),rel=Number(r.reliability_score),afford=p.value<=state.budget;
      html+='<article class="market-player"><img src="'+esc(avatar(p))+'" alt="" loading="lazy"><div class="market-player-main"><strong>'+esc(p.name)+'</strong><span>'+points(p)+' puntos estimados</span><small>'+(Number.isFinite(att)?att:0)+' asistencias registradas · '+(Number.isFinite(rel)?'fiabilidad '+Math.round(rel):'fiabilidad s/d')+'</small></div><div class="market-price"><strong>'+money(p.value)+'</strong><span class="trend '+(Number(att)>0?'trend-up':'trend-flat')+'">'+(Number(att)>0?'↗ actividad':'— estable')+'</span><button class="sign-button" data-sign="'+esc(p.id)+'" '+(state.roster.length>=3||!afford?'disabled':'')+'>'+(state.roster.length>=3?'Plantilla completa':!afford?'Sin presupuesto':'Fichar +')+'</button></div></article>';
    });
    root.innerHTML=html+'</div><p class="fantasy-note">Valores orientativos calculados con estadísticas disponibles; no son cotizaciones en tiempo real.</p>';
    root.querySelectorAll('[data-sign]').forEach(b=>b.addEventListener('click',()=>sign(b.dataset.sign)));
  }
  function renderLeaderboard() {
    const root=$('#leaderboard-mount');if(!root)return;
    const total=state.roster.reduce((n,p)=>n+points(p)*(p.id===state.captainId?2:1),0);
    root.innerHTML='<div class="leaderboard-self"><span class="leader-rank">01</span><div><strong>Mi equipo</strong><small>'+state.roster.length+'/3 jugadores · '+(state.captainId?'capitán elegido':'elige capitán')+'</small></div><strong class="leader-points">'+total+' pts</strong></div><p class="fantasy-note">La clasificación entre mánagers necesita una liga compartida en servidor; no se muestran rivales ficticios.</p>';
  }
  function render(){renderRoster();renderMarket();renderLeaderboard();}
  function sign(id){const p=state.players.find(x=>x.id===id);if(!p||state.roster.length>=3||p.value>state.budget)return;state.roster.push(p);state.budget=Math.round((state.budget-p.value)*100)/100;if(!state.captainId)state.captainId=p.id;save();render();}
  function sell(id){const p=state.roster.find(x=>x.id===id);if(!p)return;state.budget=Math.round((state.budget+p.value)*100)/100;state.roster=state.roster.filter(x=>x.id!==id);if(state.captainId===id)state.captainId=state.roster[0]?.id||null;save();render();}
  async function load() {
    const client=window.supabaseClient;if(!client)throw new Error('No se ha inicializado Supabase.');
    const {data:auth,error:authError}=await client.auth.getUser();if(authError)throw authError;
    if(!auth.user){$('#fantasy-status').innerHTML='<div class="status-card"><strong>Inicia sesión para jugar</strong><p>Necesitas una cuenta de Curruscos para cargar los miembros de tus grupos.</p><a class="fantasy-cta" href="perfil.html">Ir a mi perfil</a></div>';return;}
    state.user=auth.user;
    const {data:mine,error:mineError}=await client.from('group_members').select('group_id').eq('user_id',state.user.id);if(mineError)throw mineError;
    const groups=[...new Set((mine||[]).map(x=>x.group_id))];
    if(!groups.length){$('#fantasy-status').innerHTML='<div class="status-card"><strong>Primero necesitas un grupo</strong><p>Cuando formes parte de uno, podrás fichar a sus miembros.</p><a class="fantasy-cta" href="eventos.html">Ir a Mi grupo</a></div>';return;}
    const {data:members,error:memberError}=await client.from('group_members').select('user_id').in('group_id',groups);if(memberError)throw memberError;
    const ids=[...new Set((members||[]).map(x=>x.user_id))];
    const [pr,rr,ev]=await Promise.all([
      client.from('profiles').select('id,username,display_name,avatar_url').in('id',ids),
      client.from('fairplay_ratings').select('user_id,sport_elos,reliability_score,attended_count,no_show_count,updated_at').in('user_id',ids),
      client.from('events').select('id,group_id,date,status').in('group_id',groups).limit(500)
    ]);
    if(pr.error)throw pr.error;if(rr.error)console.warn('Estadísticas limitadas:',rr.error.message);if(ev.error)console.warn('Eventos no disponibles:',ev.error.message);
    state.ratings=Object.fromEntries((rr.data||[]).map(x=>[x.user_id,x]));const events=ev.data||[];
    if(events.length){const parts=await client.from('event_participants').select('event_id,user_id,status').in('event_id',events.map(x=>x.id)).limit(3000);if(!parts.error)state.participants=parts.data||[];}
    state.players=(pr.data||[]).filter(p=>p.id!==state.user.id).map(p=>({...p,name:p.display_name||p.username||'Miembro',value:0})).map(p=>({...p,value:value(p)})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'es'));
    restore();$('#fantasy-status').hidden=true;$('#fantasy-app').hidden=false;render();
    try{state.channel=client.channel('fantasy-market-updates').on('postgres_changes',{event:'*',schema:'public',table:'fairplay_ratings'},()=>refresh(client)).on('postgres_changes',{event:'*',schema:'public',table:'event_participants'},()=>refresh(client)).subscribe();}catch(_){}
  }
  async function refresh(client){try{const ids=state.players.map(p=>p.id);if(!ids.length)return;const r=await client.from('fairplay_ratings').select('user_id,sport_elos,reliability_score,attended_count,no_show_count,updated_at').in('user_id',ids);if(r.data)state.ratings=Object.fromEntries(r.data.map(x=>[x.user_id,x]));state.players=state.players.map(p=>({...p,value:value(p)}));render();}catch(e){console.warn('No se pudo actualizar Fantasy:',e);}}
  document.addEventListener('DOMContentLoaded',async()=>{$('#market-search')?.addEventListener('input',renderMarket);try{await load();}catch(e){console.error(e);$('#fantasy-status').innerHTML='<div class="status-card status-error"><strong>No se pudo cargar Fantasy</strong><p>'+esc(e.message||'Error de conexión')+'</p><button class="fantasy-cta" id="fantasy-retry">Reintentar</button></div>';$('#fantasy-retry')?.addEventListener('click',()=>location.reload());}});
})();