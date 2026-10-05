let chatChannel=null,currentChatUser=null,currentRoomId=null,currentRoom=null,currentMessages=[],profileNames={};
const qs=s=>document.querySelector(s);function chatEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function chatDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});}
async function editMessage(id){const m=currentMessages.find(x=>x.id===id);if(!m)return;const body=prompt("Editar mensaje",m.body);if(body===null||!body.trim())return;const updated=await updateChatMessage(id,body);if(updated){const i=currentMessages.findIndex(x=>x.id===id);if(i>=0)currentMessages[i]=updated;await renderMessages();}}
async function removeMessage(id){if(!confirm("¿Eliminar este mensaje?"))return;if(await deleteChatMessage(id)){currentMessages=currentMessages.filter(x=>x.id!==id);await renderMessages();showToast("Mensaje eliminado");}}
function roomLabel(r){if(r.room_type==="direct")return r.other_user_name||"Conversación";if(r.room_type==="event")return r.room_name||"Chat del evento";if(r.room_type==="team")return r.room_name||"Chat del equipo";return r.room_name||"Chat del grupo";}
function roomMeta(r){if(r.room_type==="direct")return"Conversación privada";if(r.room_type==="event")return"Evento";if(r.room_type==="team")return"Equipo";return"Grupo";}
function roomInitial(r){return (roomLabel(r).charAt(0)||"C").toUpperCase();}
function showToast(t){const el=qs("#chatToast");if(!el)return;el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
async function loadChat(){currentChatUser=await getCurrentUser();if(!currentChatUser){qs("#chatList").innerHTML='<div class="chat-login">Inicia sesión para utilizar el chat.</div>';return;}await loadRooms();const params=new URLSearchParams(location.search);const room=params.get("room");const event=params.get("event");const team=params.get("team");if(room){await openRoom(room);}else if(event){const id=await getOrCreateEventChat(event);if(id)await openRoom(id);}else if(team){const id=await getOrCreateTeamChat(team);if(id)await openRoom(id);}else if(params.get("user")){const id=await getOrCreateDirectChat(params.get("user"));if(id)await openRoom(id);}else{const group=await getCurrentGroup();if(group){const id=await getOrCreateGroupChat(group.id);if(id)await openRoom(id);}}}
async function loadRooms(){const rooms=await getMyChatRooms();const root=qs("#chatList");if(!rooms.length){root.innerHTML='<div class="chat-empty"><strong>No tienes conversaciones.</strong>Abre una nueva o entra en un evento, equipo o grupo.</div>';return;}root.innerHTML=rooms.map(r=>'<button class="chat-room '+(r.room_id===currentRoomId?"active":"")+'" data-room="'+r.room_id+'"><span class="chat-room-avatar">'+chatEsc(roomInitial(r))+'</span><span class="chat-room-main"><strong>'+chatEsc(roomLabel(r))+'</strong><p>'+chatEsc(r.last_message||roomMeta(r))+'</p></span><span>'+((Number(r.unread_count)>0)?'<b class="chat-unread">'+Math.min(99,Number(r.unread_count))+'</b>':('<small class="chat-room-time">'+chatEsc(chatDate(r.last_message_at))+'</small>'))+'</span></button>').join("");root.querySelectorAll(".chat-room").forEach(b=>b.addEventListener("click",()=>openRoom(b.dataset.room))); }
async function openRoom(roomId){if(chatChannel){await unsubscribeFromChat(chatChannel);chatChannel=null;}currentRoomId=roomId;const rooms=await getMyChatRooms();currentRoom=rooms.find(r=>r.room_id===roomId)||null;if(!currentRoom)return;qs("#chatLayout").classList.add("conversation");qs("#chatHead").innerHTML='<button id="chatBack" class="button chat-mobile-back" type="button">←</button><div class="chat-head-title"><strong>'+chatEsc(roomLabel(currentRoom))+'</strong><small>'+chatEsc(roomMeta(currentRoom))+'</small></div><span id="chatStatus" class="chat-status">Conectando…</span>';qs("#chatForm textarea").disabled=false;qs("#chatForm button").disabled=false;await markChatRead(roomId);await refreshMessages();chatChannel=subscribeToChat(roomId,async message=>{if(!currentMessages.some(m=>m.id===message.id)){currentMessages.push(message);await renderMessages();await markChatRead(roomId);window.dispatchEvent(new Event("curruscos:chat-updated"));}});setTimeout(()=>{const s=qs("#chatStatus");if(s){s.textContent="En directo";s.classList.add("online");}},300);qs("#chatBack")?.addEventListener("click",()=>qs("#chatLayout").classList.remove("conversation"));await loadRooms();}
async function refreshMessages(){
    currentMessages=await getChatMessages(currentRoomId);
    const ctx=await getChatRoomSecurityContext(currentRoomId);
    if(ctx?.groupId){
        const key=await ensureGroupE2EE(ctx.groupId);
        if(key){
            for(const message of currentMessages){
                if(message.encrypted_body){
                    try{ message.body=await decryptE2EEText(key,message.encrypted_body); }catch(e){ message.body="Mensaje cifrado no disponible en este dispositivo."; }
                }
            }
        }
    }
    await loadNames(currentMessages);await renderMessages();
}
async function loadNames(messages){const ids=[...new Set(messages.map(m=>m.user_id))];if(!ids.length)return;const {data}=await supabaseClient.from("profiles").select("id,display_name,username").in("id",ids);(data||[]).forEach(p=>profileNames[p.id]=p.display_name||p.username||"Participante");}
async function renderMessages(){const root=qs("#chatMessages");if(!root)return;if(!currentMessages.length){root.innerHTML='<div class="chat-empty"><strong>Empieza la conversación.</strong>Todavía no hay mensajes.</div>';return;}root.innerHTML=currentMessages.map(m=>'<article class="chat-message '+(m.user_id===currentChatUser.id?"mine":"")+'"><div class="chat-author">'+chatEsc(m.user_id===currentChatUser.id?"Tú":profileNames[m.user_id]||"Participante")+'</div><div class="chat-body">'+chatEsc(m.body)+'</div><div class="chat-time">'+chatDate(m.created_at)+(m.edited_at?" · editado":"")+'</div>'+(m.user_id===currentChatUser.id?'<div style="margin-top:6px;display:flex;gap:6px"><button type="button" class="chat-mini-action" data-edit="'+m.id+'">Editar</button><button type="button" class="chat-mini-action" data-delete="'+m.id+'">Eliminar</button></div>':"")+'</article>').join("");root.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editMessage(b.dataset.edit)));root.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>removeMessage(b.dataset.delete)));root.scrollTop=root.scrollHeight;}
async function sendMessage(e){
    e.preventDefault();
    const input=qs("#chatInput"),button=qs("#chatForm button"),body=input.value.trim();
    if(!body||!currentRoomId)return;
    input.disabled=true;button.disabled=true;
    const ctx=await getChatRoomSecurityContext(currentRoomId);
    let sent=null;
    if(ctx?.groupId){
        const key=await ensureGroupE2EE(ctx.groupId);
        if(!key){showToast("Este grupo todavía no tiene el cifrado disponible en tu dispositivo.");}
        else{
            const encrypted=await encryptE2EEText(key,body);
            sent=await sendEncryptedChatMessage(currentRoomId,encrypted);
            if(sent) sent.body=body;
        }
    }else{
        sent=await sendChatMessage(currentRoomId,body);
    }
    input.disabled=false;button.disabled=false;
    if(sent){input.value="";if(!currentMessages.some(m=>m.id===sent.id)){currentMessages.push(sent);await renderMessages();}window.dispatchEvent(new Event("curruscos:chat-updated"));input.focus();}
}
async function showPeople(search=""){const people=await getChatPeople(search);const root=qs("#chatPeople");root.classList.add("open");root.innerHTML=people.length?people.map(p=>'<div class="chat-person"><span><strong>'+chatEsc(p.display_name||p.username||"Usuario")+'</strong><small>@'+chatEsc(p.username||"usuario")+'</small></span><button type="button" data-user="'+p.user_id+'">Abrir</button></div>').join(""):'<div class="chat-empty">No hay personas que coincidan.</div>';root.querySelectorAll("button[data-user]").forEach(b=>b.addEventListener("click",async()=>{const id=await getOrCreateDirectChat(b.dataset.user);if(id){root.classList.remove("open");await openRoom(id);}}));}
document.addEventListener("DOMContentLoaded",async()=>{await window.curruscosI18n?.ready;qs("#newChatButton")?.addEventListener("click",()=>showPeople(qs("#chatSearch").value));qs("#chatSearch")?.addEventListener("input",e=>showPeople(e.target.value));qs("#chatForm")?.addEventListener("submit",sendMessage);qs("#chatInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();qs("#chatForm").requestSubmit();}});await loadChat();});
window.addEventListener("beforeunload",()=>{if(chatChannel)unsubscribeFromChat(chatChannel);});