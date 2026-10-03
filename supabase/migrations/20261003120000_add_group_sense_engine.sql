create or replace function public.get_group_sense(target_group_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_member boolean; v_next_event jsonb:=null; v_open_tasks int:=0; v_unanswered int:=0; v_open_polls int:=0; v_planning_trips int:=0; v_invites int:=0; v_score int:=0; v_action text; v_reason text; v_href text;
begin
 if v_user is null then raise exception 'not authenticated'; end if;
 select exists(select 1 from public.group_members where group_id=target_group_id and user_id=v_user) into v_member;
 if not v_member then raise exception 'not a member of this group'; end if;
 select jsonb_build_object('id',e.id,'title',e.title,'date',e.date,'time',e.time,'location',e.location) into v_next_event
 from public.events e where e.group_id=target_group_id and coalesce(e.status,'published') not in ('finished','cancelled')
 and (e.date+coalesce(e.time,'00:00'::time))>=now() order by e.date,e.time nulls first limit 1;
 if v_next_event is not null then
   select count(*)::int into v_open_tasks from public.tasks where event_id=(v_next_event->>'id')::uuid and coalesce(completed,false)=false;
   select greatest((select count(*) from public.group_members where group_id=target_group_id)::int-(select count(*) from public.event_participants where event_id=(v_next_event->>'id')::uuid and status is not null)::int,0) into v_unanswered;
 end if;
 select count(*)::int into v_open_polls from public.polls where group_id=target_group_id and coalesce(is_closed,false)=false;
 select count(*)::int into v_planning_trips from public.trips where group_id=target_group_id and status in ('planning','confirmed');
 select count(*)::int into v_invites from public.group_invitations where invited_user_id=v_user and status='pending';
 if v_invites>0 then v_score:=100;v_action:='invitation';v_reason:='Tienes una invitación pendiente.';v_href:='miembros.html#invitaciones';
 elsif v_unanswered>0 then v_score:=95+least(v_unanswered,5);v_action:='attendance';v_reason:='El próximo evento todavía no tiene respuesta de todo el grupo.';v_href:='evento.html?id='||(v_next_event->>'id');
 elsif v_open_tasks>0 then v_score:=88+least(v_open_tasks,7);v_action:='tasks';v_reason:='El próximo evento tiene trabajo pendiente.';v_href:='evento.html?id='||(v_next_event->>'id');
 elsif v_next_event is not null and coalesce(v_next_event->>'location','')='' then v_score:=80;v_action:='location';v_reason:='El próximo evento tiene fecha, pero no lugar definido.';v_href:='evento.html?id='||(v_next_event->>'id');
 elsif v_open_polls>0 then v_score:=75;v_action:='decision';v_reason:='Hay decisiones abiertas esperando al grupo.';v_href:='decisiones.html';
 elsif v_planning_trips>0 then v_score:=65;v_action:='trip';v_reason:='Hay viajes en planificación que pueden avanzar.';v_href:='viajes.html';
 else v_score:=20;v_action:='create';v_reason:='No hay bloqueos claros. Es un buen momento para crear el próximo plan.';v_href:='crear-evento.html'; end if;
 return jsonb_build_object('score',v_score,'action',v_action,'reason',v_reason,'href',v_href,'next_event',v_next_event,'open_tasks',v_open_tasks,'unanswered',v_unanswered,'open_polls',v_open_polls,'planning_trips',v_planning_trips,'pending_invitations',v_invites);
end $$;
revoke execute on function public.get_group_sense(uuid) from public,anon;
grant execute on function public.get_group_sense(uuid) to authenticated;