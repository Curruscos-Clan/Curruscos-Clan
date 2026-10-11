/* Recomendación heurística inicial. No usa decisiones automatizadas sensibles. */
function eventStartDate(event){
  const raw=event?.start_time || (event?.date ? String(event.date)+(event?.time ? "T"+String(event.time).slice(0,8) : "T00:00:00") : "");
  const date=raw?new Date(raw):new Date(NaN);
  return Number.isNaN(date.getTime())?null:date;
}
function calculateEventScore(event,userContext={}){
  const now=new Date();
  const eventDate=eventStartDate(event);
  if(!eventDate || eventDate<=now || ["cancelled","finished","draft"].includes(String(event.status||"").toLowerCase())){
    return {score:-999,primaryReason:"No disponible"};
  }
  if(userContext.joinedEventIds?.has(event.id)){
    return {score:1,primaryReason:"Ya estás inscrito"};
  }
  let score=0;
  const reasons=[];
  const hoursUntil=(eventDate-now)/3600000;
  if(hoursUntil<=48){score+=20;reasons.push("Plan próximo");}
  else if(hoursUntil<=120){score+=10;reasons.push("Esta semana");}
  const category=String(event.category||event.event_type||"").trim().toLowerCase();
  const interests=(userContext.interests||[]).map(value=>String(value).trim().toLowerCase());
  if(category && interests.includes(category)){score+=15;reasons.unshift("Según tus intereses");}
  if(event.group_id && userContext.groupIds?.has(event.group_id)){score+=12;reasons.unshift("De tu grupo");}
  if(event.status==="live"){score+=5;reasons.push("En marcha");}
  return {score,primaryReason:reasons[0]||"Descubre este plan"};
}
function rankEvents(events,userContext={}){
  return (events||[]).map(event=>{
    const evaluation=calculateEventScore(event,userContext);
    return {...event,_score:evaluation.score,_recommendationReason:evaluation.primaryReason};
  }).filter(event=>event._score>-500)
    .sort((a,b)=>b._score-a._score || (eventStartDate(a)?.getTime()||0)-(eventStartDate(b)?.getTime()||0));
}
