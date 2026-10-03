create or replace function public.get_group_sense(target_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_member boolean;
  v_next_event jsonb := null;
  v_open_tasks integer := 0;
  v_unanswered integer := 0;
  v_open_polls integer := 0;
  v_planning_trips integer := 0;
  v_invites integer := 0;
  v_member_count integer := 0;
  v_score integer := 0;
  v_action text;
  v_reason text;
  v_href text;
  v_attendance_health integer := 100;
  v_tasks_health integer := 100;
  v_decisions_health integer := 100;
  v_planning_health integer := 100;
  v_health integer := 100;
  v_health_text text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select exists(select 1 from public.group_members gm where gm.group_id = target_group_id and gm.user_id = v_user) into v_member;
  if not v_member then raise exception 'not a member of this group'; end if;

  select count(*)::integer into v_member_count from public.group_members where group_id = target_group_id;

  select jsonb_build_object('id',e.id,'title',e.title,'date',e.date,'time',e.time,'location',e.location)
  into v_next_event
  from public.events e
  where e.group_id=target_group_id
    and coalesce(e.status,'published') not in ('finished','cancelled')
    and (e.date + coalesce(e.time,'00:00'::time)) >= now()
  order by e.date,e.time nulls first limit 1;

  if v_next_event is not null then
    select count(*)::integer into v_open_tasks from public.tasks t
    where t.event_id=(v_next_event->>'id')::uuid and coalesce(t.completed,false)=false;

    select greatest(v_member_count-(select count(*) from public.event_participants ep where ep.event_id=(v_next_event->>'id')::uuid and ep.status is not null)::integer,0)
    into v_unanswered;

    if v_member_count>0 then
      v_attendance_health := greatest(0,round(100-(v_unanswered::numeric/v_member_count::numeric)*70));
    end if;
    v_tasks_health := greatest(0,100-least(v_open_tasks,7)*12);
    if coalesce(v_next_event->>'location','')='' then v_tasks_health:=greatest(0,v_tasks_health-8); end if;
  end if;

  select count(*)::integer into v_open_polls from public.polls p
  where p.group_id=target_group_id and coalesce(p.is_closed,false)=false;
  v_decisions_health:=greatest(0,100-least(v_open_polls,5)*18);

  select count(*)::integer into v_planning_trips from public.trips t
  where t.group_id=target_group_id and t.status in ('planning','confirmed');
  if v_planning_trips>0 then v_planning_health:=greatest(55,100-least(v_planning_trips,4)*8); end if;

  select count(*)::integer into v_invites from public.group_invitations gi
  where gi.group_id=target_group_id and gi.invited_user_id=v_user and gi.status='pending';

  v_health:=round((v_attendance_health+v_tasks_health+v_decisions_health+v_planning_health)/4.0);
  v_health_text:=case
    when v_health>=90 then 'El grupo está listo para moverse.'
    when v_health>=70 then 'El grupo avanza; quedan pocos puntos por cerrar.'
    when v_health>=45 then 'Hay varias cosas abiertas que conviene ordenar.'
    else 'Hay fricción operativa suficiente para actuar ahora.'
  end;

  if v_invites>0 then v_score:=100;v_action:='invitation';v_reason:='Tienes una invitación pendiente dentro de este grupo.';v_href:='miembros.html#invitaciones';
  elsif v_unanswered>0 then v_score:=95+least(v_unanswered,5);v_action:='attendance';v_reason:='El próximo evento todavía no tiene respuesta de todo el grupo.';v_href:='evento.html?id='||(v_next_event->>'id');
  elsif v_open_tasks>0 then v_score:=88+least(v_open_tasks,7);v_action:='tasks';v_reason:='El próximo evento tiene trabajo pendiente.';v_href:='evento.html?id='||(v_next_event->>'id');
  elsif v_next_event is not null and coalesce(v_next_event->>'location','')='' then v_score:=80;v_action:='location';v_reason:='El próximo evento tiene fecha, pero no lugar definido.';v_href:='evento.html?id='||(v_next_event->>'id');
  elsif v_open_polls>0 then v_score:=75;v_action:='decision';v_reason:='Hay decisiones abiertas esperando al grupo.';v_href:='decisiones.html';
  elsif v_planning_trips>0 then v_score:=65;v_action:='trip';v_reason:='Hay viajes en planificación que pueden avanzar.';v_href:='viajes.html';
  else v_score:=20;v_action:='create';v_reason:='No hay bloqueos claros. Es un buen momento para crear el próximo plan.';v_href:='crear-evento.html';
  end if;

  return jsonb_build_object(
    'score',v_score,'action',v_action,'reason',v_reason,'href',v_href,'next_event',v_next_event,
    'open_tasks',v_open_tasks,'unanswered',v_unanswered,'open_polls',v_open_polls,
    'planning_trips',v_planning_trips,'pending_invitations',v_invites,
    'health',jsonb_build_object('score',v_health,'attendance',v_attendance_health,'tasks',v_tasks_health,'decisions',v_decisions_health,'planning',v_planning_health,'text',v_health_text)
  );
end;
$function$;

revoke execute on function public.get_group_sense(uuid) from public, anon;
grant execute on function public.get_group_sense(uuid) to authenticated;