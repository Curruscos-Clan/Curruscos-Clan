console.log("SUPABASE.JS SE HA CARGADO");

const SUPABASE_URL = "https://prltjzwguleuaexpcbvi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VRAhrIDUBjoHwqejdo4clA_2KHiGZDf";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

function getSupabaseErrorMessage(error, fallback = "Ha ocurrido un error.") {
    return error?.message || error?.details || error?.hint || fallback;
}


// ========================================
// USUARIO ACTUAL
// ========================================

async function getCurrentUser(forceRefresh = false) {

    if (currentUserLoaded && !forceRefresh) {
        return currentUserCache;
    }

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(
            "Error obteniendo usuario:",
            error
        );

        currentUserCache = null;
    } else {
        currentUserCache = user || null;
    }

    currentUserLoaded = true;

    return currentUserCache;
}


// ========================================
// PERFIL ACTUAL
// ========================================

async function getCurrentProfile(forceRefresh = false) {

    if (currentProfileCache && !forceRefresh) {
        return currentProfileCache;
    }

    const user = await getCurrentUser();

    if (!user) {
        currentProfileCache = null;
        return null;
    }

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error(
            "Error obteniendo perfil:",
            error
        );

        currentProfileCache = null;
        return null;
    }

    currentProfileCache = data;

    return currentProfileCache;
}


// ========================================
// GRUPO ACTUAL
// ========================================

async function getUserGroups(forceRefresh = false) {

    if (userGroupsCache && !forceRefresh) {
        return userGroupsCache;
    }

    const user = await getCurrentUser();

    if (!user) {
        userGroupsCache = [];
        return userGroupsCache;
    }

    const { data, error } = await supabaseClient
        .from("group_members")
        .select(`
            role,
            joined_at,
            groups (
                id,
                name,
                description
            )
        `)
        .eq("user_id", user.id)
        .order("joined_at", {
            ascending: true
        });

    if (error) {
        console.error(
            "Error obteniendo grupos:",
            error
        );

        userGroupsCache = [];
        return userGroupsCache;
    }

    userGroupsCache = (data || [])
        .filter(item => item.groups)
        .map(item => ({
            id: item.groups.id,
            name: item.groups.name,
            description: item.groups.description,
            role: item.role,
            joined_at: item.joined_at
        }));

    return userGroupsCache;
}


async function getCurrentGroup(forceRefresh = false) {

    if (currentGroupCache && !forceRefresh) {
        return currentGroupCache;
    }

    const groups =
        await getUserGroups(forceRefresh);

    if (!groups.length) {
        currentGroupCache = null;
        return null;
    }

    const savedGroupId =
        localStorage.getItem(
            "curruscos_current_group"
        );

    currentGroupCache =
        groups.find(
            group =>
                group.id === savedGroupId
        ) || groups[0];

    if (
        currentGroupCache.id !==
        savedGroupId
    ) {
        localStorage.setItem(
            "curruscos_current_group",
            currentGroupCache.id
        );
    }

    return currentGroupCache;
}


function setCurrentGroup(groupId) {

    currentGroupCache = null;

    if (!groupId) {
        localStorage.removeItem(
            "curruscos_current_group"
        );
        return;
    }

    localStorage.setItem(
        "curruscos_current_group",
        String(groupId)
    );
}


async function createGroup(name, description) {

    const { data, error } =
        await supabaseClient.rpc(
            "create_group",
            {
                group_name: name,
                group_description: description || null
            }
        );

    if (error) {

        console.error(
            "Error creando grupo:",
            error
        );

        return null;
    }

    return data;

}
// ========================================
// EVENTOS
// ========================================

async function getGroupEvents() {

    const group = await getCurrentGroup();

    if (!group) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("events")
        .select("*")
        .eq("group_id", group.id)
        .order("date", { ascending: true });

    if (error) {
        console.error("Error obteniendo eventos:", error);
        return [];
    }

    return data || [];
}


async function createGroupEvent(eventData) {

    const user = await getCurrentUser();
    const group = await getCurrentGroup();

    if (!user || !group) {
        console.error("No hay usuario o grupo.");
        return null;
    }

    const { data, error } = await supabaseClient
        .from("events")
        .insert({
            group_id: group.id,
            created_by: user.id,
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            trip_id: eventData.trip_id || null
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando evento:", error);
        return null;
    }

    return data;
}


async function deleteGroupEvent(eventId) {

    const { error } = await supabaseClient
        .from("events")
        .delete()
        .eq("id", eventId);

    if (error) {
        console.error("Error eliminando evento:", error);
        return false;
    }

    return true;
}


async function getGroupTripsForEvent() {
    const group = await getCurrentGroup();

    if (!group) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date")
        .eq("group_id", group.id)
        .in("status", ["planning", "confirmed"])
        .order("start_date", { ascending: true });

    if (error) {
        console.error("Error obteniendo viajes para eventos:", error);
        return [];
    }

    return data || [];
}

async function getTripForEvent(tripId) {
    if (!tripId) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date")
        .eq("id", tripId)
        .single();

    if (error) {
        console.error("Error obteniendo viaje del evento:", error);
        return null;
    }

    return data;
}

async function getGroupEvent(eventId) {

    const { data, error } = await supabaseClient
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

    if (error) {
        console.error("Error obteniendo evento:", error);
        return null;
    }

    return data;
}

async function updateGroupEvent(eventId, eventData) {

    const { data, error } = await supabaseClient
        .from("events")
        .update({
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            trip_id: eventData.trip_id || null
        })
        .eq("id", eventId)
        .select()
        .single();

    if (error) {
        console.error("Error actualizando evento:", error);
        return null;
    }

    return data;
}

// ========================================
// PARTICIPANTES
// ========================================

async function getEventParticipants(eventId) {

    const { data, error } = await supabaseClient
        .from("event_participants")
        .select("*")
        .eq("event_id", eventId);

    if (error) {
        console.error("Error obteniendo participantes:", error);
        return [];
    }

    return data || [];
}


async function setEventParticipant(eventId, userId, status) {

    const { data, error } = await supabaseClient
        .from("event_participants")
        .upsert(
            {
                event_id: eventId,
                user_id: userId,
                status: status
            },
            {
                onConflict: "event_id,user_id"
            }
        )
        .select()
        .single();

    if (error) {
        console.error("Error actualizando participante:", error);
        return null;
    }

    return data;
}


// ========================================
// TAREAS
// ========================================

async function getEventTasks(eventId) {

    const { data, error } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error obteniendo tareas:", error);
        return [];
    }

    return data || [];
}


async function createEventTask(
    eventId,
    title,
    assignedTo
) {

    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("tasks")
        .insert({
            event_id: eventId,
            title: title,
            assigned_to: assignedTo || null,
            created_by: user.id,
            completed: false
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando tarea:", error);
        return null;
    }

    return data;
}


async function updateEventTask(taskId, completed) {

    const { data, error } = await supabaseClient
        .from("tasks")
        .update({
            completed: completed
        })
        .eq("id", taskId)
        .select()
        .single();

    if (error) {
        console.error("Error actualizando tarea:", error);
        return null;
    }

    return data;
}


async function deleteEventTask(taskId) {

    const { error } = await supabaseClient
        .from("tasks")
        .delete()
        .eq("id", taskId);

    if (error) {
        console.error("Error eliminando tarea:", error);
        return false;
    }

    return true;
}


// ========================================
// GASTOS
// ========================================

async function getEventExpenses(eventId) {

    const { data, error } = await supabaseClient
        .from("expenses")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error obteniendo gastos:", error);
        return [];
    }

    return data || [];
}


async function createEventExpense(
    eventId,
    title,
    amount,
    paidBy
) {

    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("expenses")
        .insert({
            event_id: eventId,
            title: title,
            amount: amount,
            paid_by: paidBy,
            created_by: user.id
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando gasto:", error);
        return null;
    }

    return data;
}


async function getExpenseSplits(expenseId) {
    const { data, error } = await supabaseClient
        .from("expense_splits")
        .select("id, expense_id, user_id, amount")
        .eq("expense_id", expenseId);

    if (error) {
        console.error("Error obteniendo reparto:", error);
        return [];
    }

    return data || [];
}

async function replaceExpenseSplits(expenseId, splits) {
    const { error: deleteError } = await supabaseClient
        .from("expense_splits")
        .delete()
        .eq("expense_id", expenseId);

    if (deleteError) {
        console.error("Error limpiando reparto:", deleteError);
        return false;
    }

    if (!splits.length) {
        return true;
    }

    const { error } = await supabaseClient
        .from("expense_splits")
        .insert(
            splits.map(split => ({
                expense_id: expenseId,
                user_id: split.user_id,
                amount: Number(split.amount.toFixed(2))
            }))
        );

    if (error) {
        console.error("Error guardando reparto:", error);
        return false;
    }

    return true;
}

async function deleteEventExpense(expenseId) {

    const { error } = await supabaseClient
        .from("expenses")
        .delete()
        .eq("id", expenseId);

    if (error) {
        console.error("Error eliminando gasto:", error);
        return false;
    }

    return true;
}

// ========================================
// PRUEBA DE CONEXIÓN
// ========================================

async function testSupabaseConnection() {

    const user = await getCurrentUser();

    console.log(
        "Supabase conectado correctamente.",
        user ? "Usuario autenticado." : "Sin usuario autenticado."
    );
}

testSupabaseConnection();

async function getGroupMemories() {
    const group = await getCurrentGroup();

    if (!group) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("memories")
        .select(`
            id,
            group_id,
            created_by,
            title,
            description,
            image_url,
            created_at,
            event_id,
            profiles (
                display_name,
                username
            )
        `)
        .eq("group_id", group.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Error obteniendo recuerdos:", error);
        return [];
    }

    return data || [];
}


async function createGroupMemory(memoryData) {
    const group = await getCurrentGroup();
    const user = await getCurrentUser();

    if (!group || !user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("memories")
        .insert({
            group_id: group.id,
            created_by: user.id,
            title: memoryData.title,
            description: memoryData.description || null,
            image_url: memoryData.image_url || null
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando recuerdo:", error);
        return null;
    }

    return data;
}


async function deleteGroupMemory(memoryId) {
    const { error } = await supabaseClient
        .from("memories")
        .delete()
        .eq("id", memoryId);

    if (error) {
        console.error("Error eliminando recuerdo:", error);
        return false;
    }

    return true;
}

async function getGroupHistory() {
    const group = await getCurrentGroup();

    if (!group) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("history_entries")
        .select(`
            id,
            group_id,
            created_by,
            title,
            description,
            event_date,
            created_at,
            event_id,
            profiles (
                display_name,
                username
            )
        `)
        .eq("group_id", group.id)
        .order("event_date", {
            ascending: false
        });

    if (error) {
        console.error("Error obteniendo historia:", error);
        return [];
    }

    return data || [];
}


async function createHistoryEntry(historyData) {
    const group = await getCurrentGroup();
    const user = await getCurrentUser();

    if (!group || !user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("history_entries")
        .insert({
            group_id: group.id,
            created_by: user.id,
            title: historyData.title,
            description: historyData.description || null,
            event_date: historyData.event_date
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando entrada de historia:", error);
        return null;
    }

    return data;
}


async function getHistoryEntryForEvent(eventId) {
    const { data, error } = await supabaseClient
        .from("history_entries")
        .select("id,event_id,title,description,event_date")
        .eq("event_id", eventId)
        .maybeSingle();

    if (error) {
        console.error("Error comprobando historia del evento:", error);
        return null;
    }

    return data;
}

async function createHistoryEntryForEvent(eventData) {
    const group = await getCurrentGroup();
    const user = await getCurrentUser();

    if (!group || !user || !eventData?.id) return null;

    const existing = await getHistoryEntryForEvent(eventData.id);
    if (existing) return existing;

    const { data, error } = await supabaseClient
        .from("history_entries")
        .insert({
            group_id: group.id,
            created_by: user.id,
            event_id: eventData.id,
            title: eventData.title || "Evento",
            description: eventData.description || null,
            event_date: eventData.date
        })
        .select()
        .single();

    if (error) {
        console.error("Error guardando evento en historia:", error);
        return null;
    }

    return data;
}

async function deleteHistoryEntry(historyId) {
    const { error } = await supabaseClient
        .from("history_entries")
        .delete()
        .eq("id", historyId);

    if (error) {
        console.error("Error eliminando entrada de historia:", error);
        return false;
    }

    return true;
}

async function getUserNotifications() {

    const user = await getCurrentUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("notifications")
        .select(`
            id,
            group_id,
            type,
            title,
            message,
            reference_id,
            is_read,
            created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: false
        })
        .limit(30);

    if (error) {
        console.error(
            "Error obteniendo notificaciones:",
            error
        );

        return [];
    }

    return data || [];
}


async function markNotificationAsRead(
    notificationId
) {

    const { error } = await supabaseClient
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("id", notificationId);

    if (error) {

        console.error(
            "Error marcando notificación como leída:",
            error
        );

        return false;
    }

    return true;
}


async function markAllNotificationsAsRead() {

    const user = await getCurrentUser();

    if (!user) {
        return false;
    }

    const { error } = await supabaseClient
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {

        console.error(
            "Error marcando notificaciones:",
            error
        );

        return false;
    }

    return true;
}

// ==========================================
// 🔔 SUPABASE REALTIME - NOTIFICACIONES
// ==========================================

let notificationRealtimeChannel = null;
let currentUserCache = null;
let currentUserLoaded = false;
let currentProfileCache = null;
let userGroupsCache = null;
let currentGroupCache = null;

async function startNotificationRealtime() {

    const user = await getCurrentUser();

    if (!user) {
        return;
    }

    // Evitar crear varios canales iguales
    if (notificationRealtimeChannel) {
        await supabaseClient.removeChannel(
            notificationRealtimeChannel
        );
    }

    notificationRealtimeChannel =
        supabaseClient
            .channel("user-notifications-" + user.id)

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`
                },
                payload => {

                    console.log(
                        "🔔 Nueva notificación en tiempo real:",
                        payload.new
                    );

                    // Avisar a la interfaz
                    window.dispatchEvent(
                        new CustomEvent(
                            "curruscos:new-notification",
                            {
                                detail: payload.new
                            }
                        )
                    );

                }
            )

            .subscribe(status => {

                console.log(
                    "🔔 Estado Realtime:",
                    status
                );

            });
}

async function getMySocialInvitations(){const {data,error}=await supabaseClient.rpc("get_my_social_invitations");if(error){console.error("Error obteniendo invitaciones:",error);return [];}return data||[];}
async function sendInvitation(userId,kind,targetId){const {data,error}=await supabaseClient.rpc("send_invitation",{target_user_id:userId,target_kind:kind,target_id:targetId});if(error){console.error("Error enviando invitación:",error);return null;}return data;}
async function respondToInvitation(invitationId,accept){const {data,error}=await supabaseClient.rpc("respond_to_invitation",{target_invitation_id:invitationId,accept});if(error){console.error("Error respondiendo invitación:",error);return false;}return !!data;}

// ==========================================
// 🗳️ VOTACIONES
// ==========================================

async function getGroupPolls() {

    const group = await getCurrentGroup();

    if (!group) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("polls")
        .select(`
            id,
            group_id,
            created_by,
            question,
            description,
            is_closed,
            created_at,
            poll_options (
                id,
                option_text,
                created_at
            )
        `)
        .eq("group_id", group.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(
            "Error obteniendo votaciones:",
            error
        );

        return [];
    }

    return data || [];
}


// ==========================================
// ➕ CREAR VOTACIÓN
// ==========================================

async function createGroupPoll(
    question,
    description,
    options
) {

    const group = await getCurrentGroup();
    const user = await getCurrentUser();

    if (!group || !user) {
        return null;
    }

    if (!question || !question.trim()) {
        console.error(
            "La pregunta de la votación es obligatoria."
        );

        return null;
    }

    if (!Array.isArray(options) || options.length < 2) {
        console.error(
            "Una votación necesita al menos dos opciones."
        );

        return null;
    }

    const cleanOptions = options
        .map(option => String(option).trim())
        .filter(option => option !== "");

    if (cleanOptions.length < 2) {
        console.error(
            "La votación necesita al menos dos opciones válidas."
        );

        return null;
    }

    // Crear la votación
    const { data: poll, error: pollError } =
        await supabaseClient
            .from("polls")
            .insert({
                group_id: group.id,
                created_by: user.id,
                question: question.trim(),
                description:
                    description && description.trim()
                        ? description.trim()
                        : null
            })
            .select()
            .single();

    if (pollError) {
        console.error(
            "Error creando votación:",
            pollError
        );

        return null;
    }

    // Crear las opciones
    const optionsToInsert = cleanOptions.map(
        option => ({
            poll_id: poll.id,
            option_text: option
        })
    );

    const {
        data: createdOptions,
        error: optionsError
    } = await supabaseClient
        .from("poll_options")
        .insert(optionsToInsert)
        .select();

    if (optionsError) {
        console.error(
            "Error creando opciones de votación:",
            optionsError
        );

        // Si fallan las opciones, eliminamos
        // la votación que acabamos de crear.
        await supabaseClient
            .from("polls")
            .delete()
            .eq("id", poll.id);

        return null;
    }

    return {
        ...poll,
        poll_options: createdOptions || []
    };
}


// ==========================================
// 👆 VOTAR
// ==========================================

async function voteInPoll(
    pollId,
    optionId
) {

    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    // Comprobar que la votación existe
    // y sigue abierta.
    const { data: poll, error: pollError } =
        await supabaseClient
            .from("polls")
            .select(`
                id,
                is_closed
            `)
            .eq("id", pollId)
            .single();

    if (pollError || !poll) {
        console.error(
            "Error obteniendo votación:",
            pollError
        );

        return null;
    }

    if (poll.is_closed) {
        console.error(
            "Esta votación ya está cerrada."
        );

        return null;
    }

    // Crear el voto
    const { data, error } =
        await supabaseClient
            .from("poll_votes")
            .insert({
                poll_id: pollId,
                option_id: optionId,
                user_id: user.id
            })
            .select()
            .single();

    if (error) {
        console.error(
            "Error registrando voto:",
            error
        );

        return null;
    }

    return data;
}


// ==========================================
// 📊 OBTENER VOTOS DEL USUARIO
// ==========================================

async function getMyPollVotes(
    pollIds
) {

    const user = await getCurrentUser();

    if (!user || !Array.isArray(pollIds) || pollIds.length === 0) {
        return [];
    }

    const { data, error } =
        await supabaseClient
            .from("poll_votes")
            .select(`
                id,
                poll_id,
                option_id,
                user_id,
                created_at
            `)
            .eq("user_id", user.id)
            .in("poll_id", pollIds);

    if (error) {
        console.error(
            "Error obteniendo mis votos:",
            error
        );

        return [];
    }

    return data || [];
}


// ==========================================
// 📊 OBTENER RESULTADOS
// ==========================================

async function getPollResults(
    pollId
) {

    const { data, error } =
        await supabaseClient
            .from("poll_votes")
            .select(`
                id,
                poll_id,
                option_id,
                user_id,
                created_at
            `)
            .eq("poll_id", pollId);

    if (error) {
        console.error(
            "Error obteniendo resultados:",
            error
        );

        return [];
    }

    return data || [];
}


// ==========================================
// 🔒 CERRAR VOTACIÓN
// ==========================================

async function closePoll(
    pollId
) {

    const { data, error } =
        await supabaseClient
            .from("polls")
            .update({
                is_closed: true
            })
            .eq("id", pollId)
            .select()
            .single();

    if (error) {
        console.error(
            "Error cerrando votación:",
            error
        );

        return null;
    }

    return data;
}


  
async function signOut() {
    const { error } =
        await supabaseClient.auth.signOut();

    if (error) {
        console.error(
            "Error cerrando sesión:",
            error
        );
        return false;
    }

    localStorage.removeItem(
        "curruscos_current_group"
    );

    currentUserCache = null;
    currentUserLoaded = true;
    currentProfileCache = null;
    userGroupsCache = null;
    currentGroupCache = null;

    if (
        typeof notificationRealtimeChannel !==
            "undefined" &&
        notificationRealtimeChannel
    ) {
        await supabaseClient.removeChannel(
            notificationRealtimeChannel
        );
        notificationRealtimeChannel = null;
    }

    return true;
}

async function getGroupMembers(groupId) {
    const currentGroupId =
        groupId || (await getCurrentGroup())?.id;

    if (!currentGroupId) {
        return [];
    }

    const { data, error } = await supabaseClient.rpc(
        "get_group_members",
        { target_group_id: currentGroupId }
    );

    if (error) {
        console.error("Error obteniendo miembros:", error);
        return [];
    }

    return data || [];
}

async function updateGroup(groupId, name, description) {
    const { data, error } = await supabaseClient.rpc(
        "update_group",
        {
            target_group_id: groupId,
            new_name: String(name || "").trim(),
            new_description: String(description || "").trim() || null
        }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se han podido guardar los cambios."
        ));
    }

    return data;
}

async function leaveGroup(groupId) {
    const { data, error } = await supabaseClient.rpc(
        "leave_group",
        { target_group_id: groupId }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido abandonar el grupo."
        ));
    }

    return data;
}

async function deleteGroup(groupId) {
    const { data, error } = await supabaseClient.rpc(
        "delete_group",
        { target_group_id: groupId }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido eliminar el grupo."
        ));
    }

    return data;
}

async function changeGroupMemberRole(groupId, userId, role) {
    const { data, error } = await supabaseClient.rpc(
        "change_group_member_role",
        {
            target_group_id: groupId,
            target_user_id: userId,
            new_role: role
        }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido cambiar el rol."
        ));
    }

    return data;
}

async function removeGroupMember(groupId, userId) {
    const { data, error } = await supabaseClient.rpc(
        "remove_group_member",
        {
            target_group_id: groupId,
            target_user_id: userId
        }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido expulsar al miembro."
        ));
    }

    return data;
}

async function inviteUserByUsername(groupId, username) {
    const { data, error } = await supabaseClient.rpc(
        "invite_user_by_username",
        {
            target_group_id: groupId,
            target_username: String(username || "").trim()
        }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido enviar la invitación."
        ));
    }

    return data;
}

async function getMyInvitations() {
    const { data, error } = await supabaseClient.rpc(
        "get_my_invitations"
    );

    if (error) {
        console.error("Error obteniendo invitaciones:", error);
        return [];
    }

    return data || [];
}

async function acceptGroupInvitation(invitationId) {
    const { data, error } = await supabaseClient.rpc(
        "accept_group_invitation",
        { invitation_id: invitationId }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido aceptar la invitación."
        ));
    }

    return data;
}

async function rejectGroupInvitation(invitationId) {
    const { error } = await supabaseClient
        .from("group_invitations")
        .update({ status: "rejected" })
        .eq("id", invitationId)
        .eq("status", "pending");

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido rechazar la invitación."
        ));
    }

    return true;
}

async function getTasksForEvents(eventIds) {
    if (!Array.isArray(eventIds) || !eventIds.length) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("tasks")
        .select(
            "id, event_id, title, assigned_to, completed, created_by, created_at"
        )
        .in("event_id", eventIds)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error obteniendo tareas del grupo:", error);
        return [];
    }

    return data || [];
}


async function updateProfile(displayName, username) {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("No hay una sesión activa.");
    }

    const cleanName =
        String(displayName || "").trim();

    const cleanUsername =
        String(username || "")
            .trim()
            .toLowerCase();

    if (!cleanName) {
        throw new Error("El nombre visible es obligatorio.");
    }

    if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 24 ||
        !/^[a-z0-9_]+$/.test(cleanUsername)
    ) {
        throw new Error(
            "El nombre de usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, números y _. "
        );
    }

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .update({
                display_name: cleanName,
                username: cleanUsername
            })
            .eq("id", user.id)
            .select()
            .single();

    if (error) {
        console.error(
            "Error actualizando perfil:",
            error
        );

        if (error.code === "23505") {
            throw new Error(
                "Ese nombre de usuario ya está en uso."
            );
        }

        throw new Error(
            getSupabaseErrorMessage(
                error,
                "No se ha podido actualizar el perfil."
            )
        );
    }

    return data;
}



// ========================================
// 🌍 EVENTOS PÚBLICOS
// ========================================

async function getPublicEvent(eventId) {
    const { data, error } = await supabaseClient
        .from("events")
        .select("id,title,date,time,location,description,category,capacity,entry_fee,registration_deadline,status,visibility,format,rules,organizer_name,created_by,participant_mode,team_size,event_type,scoring_system,created_at")
        .eq("id", eventId)
        .eq("visibility", "public")
        .in("status", ["published", "preparing", "live", "finished"])
        .maybeSingle();
    if (error) {
        console.error("Error obteniendo evento público:", error);
        return null;
    }
    return data || null;
}

async function getPublicEvents(filters = {}) {
    let query = supabaseClient
        .from("events")
        .select("id,title,date,time,location,description,category,capacity,entry_fee,registration_deadline,status,visibility,format,organizer_name,participant_mode,team_size,event_type,created_at,event_participants(count)")
        .eq("visibility", "public")
        .in("status", ["published", "preparing", "live"])
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(48);

    const search = String(filters.search || "").trim();
    const category = filters.category || "all";

    const eventType = filters.event_type || "all";

    if (category !== "all") {
        query = query.eq("category", category);
    }

    if (eventType !== "all") query = query.eq("event_type", eventType);

    if (search) {
        query = query.or("title.ilike.%" + search + "%,location.ilike.%" + search + "%,description.ilike.%" + search + "%,organizer_name.ilike.%" + search + "%");
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error obteniendo eventos públicos:", error);
        return [];
    }
    return data || [];
}

async function setPublicEventStatus(eventId,status){const {data,error}=await supabaseClient.rpc("set_public_event_status",{target_event_id:eventId,new_status:status});if(error)throw error;return data;}

async function createPublicEvent(eventData) {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from("events")
        .insert({
            group_id: null,
            created_by: user.id,
            title: eventData.title,
            description: eventData.description || null,
            date: eventData.date,
            time: eventData.time || null,
            location: eventData.location || null,
            visibility: "public",
            category: eventData.category || "other",
            capacity: eventData.capacity ? Number(eventData.capacity) : null,
            entry_fee: eventData.entry_fee ? Number(eventData.entry_fee) : 0,
            registration_deadline: eventData.registration_deadline || null,
            status: "published",
            format: eventData.format || "standard",
            rules: eventData.rules || null,
            organizer_name: eventData.organizer_name || null,
            participant_mode: eventData.participant_mode || "individual",
            team_size: eventData.team_size || null,
            event_type: eventData.event_type || "otro",
            scoring_system: eventData.scoring_system || "win_draw_loss"
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando evento público:", error);
        return null;
    }
    return data;
}

async function getPublicEventParticipants(eventId) {
    const { data, error } = await supabaseClient.rpc("get_public_event_participants", { target_event_id: eventId });
    if (error) {
        console.error("Error obteniendo participantes públicos:", error);
        return [];
    }
    return data || [];
}

async function joinPublicEvent(eventId) {
    const user = await getCurrentUser();
    if (!user) return null;
    return setEventParticipant(eventId, user.id, "yes");
}

async function leavePublicEvent(eventId) {
    const user = await getCurrentUser();
    if (!user) return false;

    const { error } = await supabaseClient
        .from("event_participants")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

    if (error) {
        console.error("Error saliendo del evento:", error);
        return false;
    }
    return true;
}

async function getPublicEventTeams(eventId) {
    const { data, error } = await supabaseClient
        .from("event_teams")
        .select("id,event_id,name,seed")
        .eq("event_id", eventId)
        .order("seed", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

    if (error) {
        console.error("Error obteniendo equipos:", error);
        return [];
    }
    return data || [];
}

async function recordTennisPadelResult(matchId,setScores){const {data,error}=await supabaseClient.rpc("record_tennis_padel_result",{target_match_id:matchId,set_scores:setScores});if(error)throw error;return data;}
async function recordChessResult(matchId,homeScore,awayScore){const {data,error}=await supabaseClient.rpc("record_chess_result",{target_match_id:matchId,new_home_score:homeScore,new_away_score:awayScore});if(error)throw error;return data;}
async function getPublicRaceResults(eventId){const {data,error}=await supabaseClient.rpc("get_public_race_results",{target_event_id:eventId});if(error){console.error("Error obteniendo resultados de carrera:",error);return [];}return data||[];}
async function recordRaceResult(eventId,participantId,timeMs,position=null,points=null){const {data,error}=await supabaseClient.rpc("record_race_result",{target_event_id:eventId,target_participant_id:participantId,target_time_ms:timeMs,target_finish_position:position,target_points:points});if(error)throw error;return data;}

async function getPublicEventMatches(eventId) {
    const { data, error } = await supabaseClient
        .from("event_matches")
        .select("id,event_id,round_number,match_number,home_team_id,away_team_id,home_score,away_score,scheduled_at,status")
        .eq("event_id", eventId)
        .order("round_number", { ascending: true })
        .order("match_number", { ascending: true });

    if (error) {
        console.error("Error obteniendo partidos:", error);
        return [];
    }
    return data || [];
}

async function generateKnockoutBracket(eventId) {
    const { data, error } = await supabaseClient.rpc(
        "generate_knockout_bracket",
        { target_event_id: eventId }
    );
    if (error) {
        console.error("Error generando cuadro:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido generar el cuadro."));
    }
    return data;
}

async function recordEventMatchResult(matchId, homeScore, awayScore) {
    const { data, error } = await supabaseClient.rpc(
        "record_event_match_result",
        {
            target_match_id: matchId,
            new_home_score: Number(homeScore),
            new_away_score: Number(awayScore)
        }
    );
    if (error) {
        console.error("Error guardando resultado:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido guardar el resultado."));
    }
    return data;
}

async function generateRoundRobinSchedule(eventId) {
    const { data, error } = await supabaseClient.rpc(
        "generate_round_robin_schedule",
        { target_event_id: eventId }
    );
    if (error) {
        console.error("Error generando calendario:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido generar el calendario."));
    }
    return data;
}

async function getPublicEventTeamMembers(eventId){const {data,error}=await supabaseClient.rpc("get_public_event_team_members",{target_event_id:eventId});if(error){console.error("Error obteniendo miembros de equipos:",error);return [];}return data||[];}
async function createEventTeam(eventId,name){const {data,error}=await supabaseClient.rpc("create_event_team",{target_event_id:eventId,team_name:name});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido crear el equipo."));return data;}
async function addEventTeamMember(teamId,userId){const {data,error}=await supabaseClient.rpc("add_event_team_member",{target_team_id:teamId,target_user_id:userId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido añadir al jugador."));return data;}
async function removeEventTeamMember(teamId,userId){const {data,error}=await supabaseClient.rpc("remove_event_team_member",{target_team_id:teamId,target_user_id:userId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido quitar al jugador."));return data;}

async function joinEventTeam(teamId){const {data,error}=await supabaseClient.rpc("join_event_team",{target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido unir al equipo."));return data;}
async function createEventTeamForSelf(eventId,name){const {data,error}=await supabaseClient.rpc("create_event_team_for_self",{target_event_id:eventId,team_name:name});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido crear el equipo."));return data;}
async function leaveEventTeam(teamId){const {data,error}=await supabaseClient.rpc("leave_event_team",{target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido abandonar el equipo."));return data;}

async function generateSwissRound(eventId){const {data,error}=await supabaseClient.rpc("generate_swiss_round",{target_event_id:eventId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido generar la ronda suiza."));return data;}

async function getMyPublicEvents(){const user=await getCurrentUser();if(!user)return {participating:[],organizing:[]};const base="id,title,date,time,location,category,format,status,visibility,event_type,participant_mode";const {data:organizing,error:oe}=await supabaseClient.from("events").select(base).eq("created_by",user.id).eq("visibility","public").order("date",{ascending:true});if(oe)console.error("Error obteniendo eventos organizados:",oe);const {data:rows,error:pe}=await supabaseClient.from("event_participants").select("event_id,status").eq("user_id",user.id).eq("status","yes");if(pe)console.error("Error obteniendo participaciones:",pe);const ids=(rows||[]).map(r=>r.event_id);let participating=[];if(ids.length){const {data,error}=await supabaseClient.from("events").select(base).in("id",ids).eq("visibility","public").order("date",{ascending:true});if(error)console.error("Error obteniendo eventos participados:",error);participating=data||[];}return {participating,organizing:organizing||[]};}

async function getMyEventActivity(){const user=await getCurrentUser();if(!user)return {participating:[],organizing:[],teams:[],matches:[]};const {data:parts}=await supabaseClient.from("event_participants").select("event_id,status").eq("user_id",user.id).eq("status","yes");const ids=(parts||[]).map(x=>x.event_id);let participating=[];if(ids.length){const {data}=await supabaseClient.from("events").select("id,title,date,time,location,event_type,format,category,status,participant_mode").in("id",ids).eq("visibility","public");participating=data||[];}const {data:organizing}=await supabaseClient.from("events").select("id,title,date,time,location,event_type,format,category,status,participant_mode").eq("created_by",user.id).eq("visibility","public");const {data:members}=await supabaseClient.from("event_team_members").select("team_id").eq("user_id",user.id);let teams=[];if((members||[]).length){const teamIds=members.map(x=>x.team_id);const {data}=await supabaseClient.from("event_teams").select("id,event_id,name,seed").in("id",teamIds);teams=data||[];}let matches=[];if(ids.length){const {data:all}=await supabaseClient.from("event_matches").select("id,event_id,home_team_id,away_team_id,home_score,away_score,status,round_number,match_number").in("event_id",ids).eq("status","finished");const teamIds=new Set(teams.map(t=>t.id));matches=(all||[]).filter(m=>teamIds.has(m.home_team_id)||teamIds.has(m.away_team_id));}const activityTypes=[...new Set(participating.map(e=>e.event_type).filter(Boolean))];return {participating,organizing:organizing||[],teams,matches,activityTypes};}

async function getPublicRankings(eventType="all"){const {data,error}=await supabaseClient.rpc("get_public_rankings",{target_event_type:eventType});if(error){console.error("Error obteniendo rankings:",error);return [];}return data||[];}

async function getOrCreateDirectChat(userId){const {data,error}=await supabaseClient.rpc("get_or_create_direct_chat",{target_user_id:userId});if(error){console.error("Error abriendo chat privado:",error);return null;}return data||null;}
async function getOrCreateTeamChat(teamId){const {data,error}=await supabaseClient.rpc("get_or_create_team_chat",{target_team_id:teamId});if(error){console.error("Error abriendo chat del equipo:",error);return null;}return data||null;}
async function getMyChatRooms(){const {data,error}=await supabaseClient.rpc("get_my_chat_rooms");if(error){console.error("Error obteniendo chats:",error);return [];}return data||[];}
async function markChatRead(roomId){const {data,error}=await supabaseClient.rpc("mark_chat_read",{target_room_id:roomId});if(error)console.error("Error marcando chat como leído:",error);return !!data;}
async function getChatPeople(search=""){const {data,error}=await supabaseClient.rpc("get_chat_people",{search_text:String(search||"").trim()||null});if(error){console.error("Error buscando personas para chat:",error);return [];}return data||[];}
async function getOrCreateGroupChat(groupId){const {data,error}=await supabaseClient.rpc("get_or_create_group_chat",{target_group_id:groupId});if(error){console.error("Error abriendo chat del grupo:",error);return null;}return data||null;}
async function getOrCreateEventChat(eventId){const {data,error}=await supabaseClient.rpc("get_or_create_event_chat",{target_event_id:eventId});if(error){console.error("Error abriendo chat del evento:",error);return null;}return data||null;}
async function getChatMessages(roomId){const {data,error}=await supabaseClient.from("chat_messages").select("id,room_id,user_id,body,created_at,edited_at,deleted_at").eq("room_id",roomId).is("deleted_at",null).order("created_at",{ascending:true}).limit(200);if(error){console.error("Error obteniendo mensajes:",error);return [];}return data||[];}
async function updateChatMessage(messageId,body){const {data,error}=await supabaseClient.from("chat_messages").update({body:String(body||"").trim().slice(0,2000),edited_at:new Date().toISOString()}).eq("id",messageId).eq("user_id",(await getCurrentUser())?.id).select().single();if(error){console.error("Error editando mensaje:",error);return null;}return data;}
async function deleteChatMessage(messageId){const {error}=await supabaseClient.from("chat_messages").update({deleted_at:new Date().toISOString()}).eq("id",messageId).eq("user_id",(await getCurrentUser())?.id);if(error){console.error("Error borrando mensaje:",error);return false;}return true;}
async function sendChatMessage(roomId,body){const user=await getCurrentUser();if(!user||!String(body||"").trim())return null;const {data,error}=await supabaseClient.from("chat_messages").insert({room_id:roomId,user_id:user.id,body:String(body).trim().slice(0,2000)}).select().single();if(error){console.error("Error enviando mensaje:",error);return null;}return data;}
function subscribeToChat(roomId,callback){return supabaseClient.channel("chat-"+roomId).on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:"room_id=eq."+roomId},payload=>callback?.(payload.new)).subscribe();}
function unsubscribeFromChat(channel){if(channel)return supabaseClient.removeChannel(channel);}

async function getPublicActiveTeams(search="",eventType="all"){const {data,error}=await supabaseClient.rpc("get_public_active_teams",{search_text:String(search||"").trim()||null,target_event_type:eventType||"all"});if(error){console.error("Error obteniendo equipos públicos:",error);return [];}return data||[];}\n\nasync function getPublicTeam(teamId){const {data,error}=await supabaseClient.rpc("get_public_team",{target_team_id:teamId});if(error){console.error("Error obteniendo equipo público:",error);return null;}return data?.[0]||null;}\n\nasync function getPublicProfile(userId){const {data,error}=await supabaseClient.rpc("get_public_profile",{target_user_id:userId});if(error){console.error("Error obteniendo perfil público:",error);return null;}return data?.[0]||null;}


async function getPublicProfileActivity(userId){
    const {data,error}=await supabaseClient.rpc("get_public_profile_activity",{target_user_id:userId});
    if(error){console.error("Error obteniendo actividad pública:",error);return [];}return data||[];
}


async function getPublicRelatedEvents(eventId){const {data,error}=await supabaseClient.rpc("get_public_related_events",{target_event_id:eventId});if(error){console.error("Error obteniendo eventos relacionados:",error);return [];}return data||[];}

async function getPublicActivePeople(search="",eventType="all"){const {data,error}=await supabaseClient.rpc("get_public_active_people",{search_text:String(search||"").trim()||null,target_event_type:eventType||"all"});if(error){console.error("Error obteniendo personas públicas:",error);return [];}return data||[];}
