(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const energyLabels={competitiva:'Competitiva',chill:'Tranquila',activa:'Activa',gastronomica:'Gastronómica'};
const categoryLabels={sport:'Deporte',social:'Social',activity:'Actividad',gaming:'Videojuegos',other:'Otro'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const client=()=>window.supabaseClient;
const status=$('#fusion-status'), stage=$('#fusion-stage'), radar=$('#fusion-radar'), proposalMount=$('#fusion-proposal');\nlet activeSparkId=null;
function say(message,isError=false){status.textContent=message;status.classList.toggle('is-error',isError);}
function dateLocal(date){const offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,16);}
function drawRadar(count=1,required=4){radar.replaceChildren();const wrap=el('div','fusion-radar');wrap.setAttribute('role','img');wrap.setAttribute('aria-label',count+' de '+required+' personas han aceptado');wrap.append(el('span','fusion-wave fusion-wave-one'),el('span','fusion-wave fusion-wave-two'));const core=el('div','fusion-core');core.append(el('strong','',count+'/'+required),el('small','','SINTONÍA'));wrap.append(core);radar.append(wrap,el('p','fusion-muted','La propuesta solo se convierte en evento cuando suficientes personas aceptan.'));stage.hidden=false;}
function drawProposal(p,acceptedCount=1){
 proposalMount.replaceChildren();const card=el('article','fusion-proposal-card');
 card.append(el('span','fusion-live','⚡ PROPUESTA ESPONTÁNEA'),el('h2','',p.suggested_title));
 const start=new Date(p.proposed_start);const dateText=start.toLocaleString('es-ES',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 card.append(el('p','fusion-muted',dateText+' · Zona '+p.geo_zone),el('p','',p.proposed_location));
 card.append(el('p','fusion-muted',acceptedCount+' de '+p.quorum_required+' confirmaciones. No se crea el plan hasta alcanzar el mínimo.'));
 const actions=el('div','fusion-actions');const accept=el('button','fusion-primary','Me apunto');accept.type='button';
 const pass=el('button','fusion-secondary','Paso');pass.type='button';actions.append(accept,pass);card.append(actions);proposalMount.append(card);
 accept.addEventListener('click',async()=>{accept.disabled=true;pass.disabled=true;say('Registrando tu respuesta…');try{const {data,error}=await client().rpc('respond_fusion_proposal',{target_proposal_id:p.id,accept:true});if(error)throw error;if(data.confirmed){say('¡Plan creado! Abriendo el evento…');location.href='evento-publico.html?id='+encodeURIComponent(data.event_id);}else{drawRadar(data.accepted_count,data.required);say('Has aceptado. Esperando a que más personas confirmen.');accept.textContent='Ya estás dentro';accept.disabled=true;}}catch(e){say(e.message||'No se ha podido aceptar la propuesta.',true);accept.disabled=false;pass.disabled=false;}});
 pass.addEventListener('click',async()=>{pass.disabled=true;accept.disabled=true;try{const {error}=await client().rpc('respond_fusion_proposal',{target_proposal_id:p.id,accept:false});if(error)throw error;proposalMount.replaceChildren();say('Has pasado de esta propuesta. Sigue disponible para las demás personas.');}catch(e){say(e.message||'No se ha podido descartar.',true);pass.disabled=false;accept.disabled=false;}});
}
async function loadProposal(id){const {data,error}=await client().from('fusion_proposals').select('id,suggested_title,proposed_start,proposed_end,proposed_location,geo_zone,quorum_required,accepted_user_ids,status,expires_at').eq('id',id).maybeSingle();if(error)throw error;if(data&&data.status==='pending'){drawProposal(data,(data.accepted_user_ids||[]).length);drawRadar((data.accepted_user_ids||[]).length,data.quorum_required);} }
document.addEventListener('DOMContentLoaded',()=>{
 const now=new Date(Date.now()+5*60*1000),end=new Date(now.getTime()+2*60*60*1000);
 $('#fusion-start').value=dateLocal(now);$('#fusion-end').value=dateLocal(end);
 let selectedEnergy='competitiva';document.querySelectorAll('[data-energy]').forEach(button=>button.addEventListener('click',()=>{selectedEnergy=button.dataset.energy;document.querySelectorAll('[data-energy]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}));
 const form=$('#fusion-form');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#fusion-submit');button.disabled=true;button.textContent='Buscando sintonía…';
  try{
   if(!client())throw new Error('No se ha podido inicializar la conexión. Recarga la página.');
   const {data:auth,error:authError}=await client().auth.getUser();if(authError)throw authError;if(!auth?.user)throw new Error('Inicia sesión para lanzar una chispa.');
   const start=new Date($('#fusion-start').value),endDate=new Date($('#fusion-end').value),nowDate=new Date();
   if(!Number.isFinite(start.getTime())||!Number.isFinite(endDate.getTime())||start<nowDate||endDate<=start||endDate-start>24*60*60*1000)throw new Error('Elige una franja futura de hasta 24 horas.');
   const resources={coche:$('#resource-car').checked,material:$('#resource-kit').checked,pista:$('#resource-court').checked};
   const {data:spark,error:insertError}=await client().from('sparks').insert({user_id:auth.user.id,energy_type:selectedEnergy,category:$('#fusion-category').value,time_window_start:start.toISOString(),time_window_end:endDate.toISOString(),geo_zone:$('#fusion-zone').value,resources_offered:resources,expires_at:endDate.toISOString()}).select('id').single();
   if(insertError)throw insertError;
   const {data:result,error:evalError}=await client().rpc('evaluate_spark_resonance',{new_spark_id:spark.id});if(evalError)throw evalError;
   form.hidden=true;stage.hidden=false;
   if(result?.proposal_id){const {data:p,error:pError}=await client().from('fusion_proposals').select('id,suggested_title,proposed_start,proposed_end,proposed_location,geo_zone,quorum_required,accepted_user_ids,status,expires_at').eq('id',result.proposal_id).maybeSingle();if(pError)throw pError;if(p)drawProposal(p,(p.accepted_user_ids||[]).length);drawRadar(result.accepted_count||1,4);say('¡Hay sintonía! Revisa la propuesta y confirma si te encaja.');}
   else{drawRadar(result.active_in_zone||1,4);say('Chispa encendida. Aún no hay suficientes personas compatibles; la coincidencia no está garantizada.');}
  }catch(err){say(err.message||'No se ha podido lanzar la chispa.',true);}
  finally{button.disabled=false;button.textContent='Encender mi chispa ⚡';}
 });
 const cancel=$('#fusion-cancel');cancel.addEventListener('click',async()=>{cancel.disabled=true;try{if(activeSparkId&&client()){const {error}=await client().from('sparks').update({status:'expirada'}).eq('id',activeSparkId);if(error)throw error;}activeSparkId=null;form.reset();form.hidden=false;stage.hidden=true;proposalMount.replaceChildren();say('Chispa cerrada. Ya puedes lanzar otra intención.');}catch(e){say(e.message||'No se ha podido cerrar la chispa.',true);}finally{cancel.disabled=false;}});
});
})();