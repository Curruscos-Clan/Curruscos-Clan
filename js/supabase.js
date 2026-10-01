console.log("SUPABASE.JS SE HA CARGADO");

const SUPABASE_URL = "https://prltjzwguleuaexpcbvi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VRAhrIDUBjoHwqejdo4clA_2KHiGZDf";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ========================================
// USUARIO ACTUAL
// ========================================

async function getCurrentUser() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("Error obteniendo usuario:", error);
        return null;
    }

    return user;
}


// ========================================
// PERFIL ACTUAL
// ========================================

async function getCurrentProfile() {

    const user = await getCurrentUser();

    if (!user) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error obteniendo perfil:", error);
        return null;
    }

    return data;
}


// ========================================
// GRUPO ACTUAL
// ========================================

async function getUserGroups() {

    const user = await getCurrentUser();

    if (!user) return [];

    const { data, error } = await supabaseClient
        .from("group_members")
        .select(`
            role,
            groups (
                id,
                name,
                description
            )
        `)
        .eq("user_id", user.id);

    if (error) {
        console.error("Error obteniendo grupos:", error);
        return [];
    }

    return (data || [])
        .filter(item => item.groups)
        .map(item => ({
            id: item.groups.id,
            name: item.groups.name,
            description: item.groups.description,
            role: item.role
        }));
}


async function getCurrentGroup() {

    const groups = await getUserGroups();

    if (groups.length === 0) {
        return null;
    }

    const savedGroupId =
        localStorage.getItem("curruscos_current_group");

    if (savedGroupId) {

        const savedGroup =
            groups.find(group =>
                group.id === savedGroupId
            );

        if (savedGroup) {
            return savedGroup;
        }

    }

    return groups[0];
}


function setCurrentGroup(groupId) {

    localStorage.setItem(
        "curruscos_current_group",
        groupId
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
            location: eventData.location
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
            location: eventData.location
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


async function createEventTask(eventId, title, assignedTo) {

    const { data, error } = await supabaseClient
        .from("tasks")
        .insert({
            event_id: eventId,
            title: title,
            assigned_to: assignedTo || null,
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

    const { data, error } = await supabaseClient
        .from("expenses")
        .insert({
            event_id: eventId,
            title: title,
            amount: amount,
            paid_by: paidBy
        })
        .select()
        .single();

    if (error) {
        console.error("Error creando gasto:", error);
        return null;
    }

    return data;
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
