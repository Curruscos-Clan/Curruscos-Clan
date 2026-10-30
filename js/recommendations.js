/* Recomendación heurística inicial. No usa decisiones automatizadas sensibles. */
function eventStartDate(event){
  const dateValue=event?.date||event?.event_date;
  const timeValue=event?.time||event?.event_time;
  const raw=event?.start_time || (dateValue ? String(dateValue)+(timeValue ? "T"+String(timeValue).slice(0,8) : "T00:00:00") : "");
  const date=raw?new Date(raw):new Date(NaN);
  return Number.isNaN(date.getTime())?null:date;
}
function calculateEventScore(event,userContext={}){
  const now=new Date();
  const eventDate=eventStartDate(event);
  const status=String(event.status||"").toLowerCase();
  if(["cancelled","finished","draft"].includes(status) || (status!=="live" && (!eventDate || eventDate<=now))){
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
