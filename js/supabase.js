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
