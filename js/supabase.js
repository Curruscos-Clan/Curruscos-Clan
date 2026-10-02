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

async function getPublicEvents(filters = {}) {
    let query = supabaseClient
        .from("events")
        .select("id,title,date,time,location,description,category,capacity,entry_fee,registration_deadline,status,visibility,created_by")
        .eq("visibility", "public")
        .in("status", ["published", "finished"])
        .order("date", { ascending: true });

    if (filters.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
    }

    if (filters.search) {
        const term = String(filters.search).trim();
        if (term) {
            query = query.or(
                "title.ilike.%" + term + "%," +
                "location.ilike.%" + term + "%," +
                "description.ilike.%" + term + "%"
            );
        }
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error obteniendo eventos públicos:", error);
        return [];
    }

    return data || [];
}

async function getPublicEvent(eventId) {
    const { data, error } = await supabaseClient
        .from("events")
        .select("id,title,date,time,location,description,category,capacity,entry_fee,registration_deadline,status,visibility,created_by")
        .eq("id", eventId)
        .eq("visibility", "public")
        .in("status", ["published", "finished"])
        .single();

    if (error) {
        console.error("Error obteniendo evento público:", error);
        return null;
    }

    return data;
}

async function getPublicEventParticipants(eventId) {
    const user = await getCurrentUser();

    if (!user) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("event_participants")
        .select("id,event_id,user_id,status")
        .eq("event_id", eventId);

    if (error) {
        console.error("Error obteniendo participantes del evento público:", error);
        return [];
    }

    return data || [];
}

async function getMyEventParticipation(eventId) {
    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("event_participants")
        .select("id,event_id,user_id,status")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error obteniendo mi participación:", error);
        return null;
    }

    return data;
}

async function joinPublicEvent(eventId) {
    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("event_participants")
        .upsert(
            {
                event_id: eventId,
                user_id: user.id,
                status: "yes"
            },
            {
                onConflict: "event_id,user_id"
            }
        )
        .select()
        .single();

    if (error) {
        console.error("Error apuntándose al evento:", error);
        return null;
    }

    return data;
}

async function leavePublicEvent(eventId) {
    const user = await getCurrentUser();

    if (!user) {
        return false;
    }

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

async function createPublicEvent(eventData) {
    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const payload = {
        group_id: null,
        created_by: user.id,
        title: String(eventData.title || "").trim(),
        description: String(eventData.description || "").trim() || null,
        date: eventData.date,
        time: eventData.time || null,
        location: String(eventData.location || "").trim() || null,
        category: eventData.category || "other",
        capacity: eventData.capacity ? Number(eventData.capacity) : null,
        entry_fee: eventData.entry_fee ? Number(eventData.entry_fee) : 0,
        registration_deadline: eventData.registration_deadline || null,
        visibility: "public",
        status: "published"
    };

    if (!payload.title || !payload.date) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("events")
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error("Error creando evento público:", error);
        return null;
    }

    return data;
}
