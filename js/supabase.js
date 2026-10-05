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

/* =========================================================
   CURRUSCOS E2EE — Web Crypto client foundation
   Private keys stay in IndexedDB and are never sent to Supabase.
   Group content keys are AES-GCM; member envelopes use ECDH-P256 + AES-KW.
   ========================================================= */

const CURRUSCOS_E2EE_DB = "curruscos-e2ee";
const CURRUSCOS_E2EE_STORE = "keys";

function e2eeBytesToBase64(bytes) {
    let binary = "";
    bytes = new Uint8Array(bytes);
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function e2eeBase64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function e2eeOpenDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CURRUSCOS_E2EE_DB, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(CURRUSCOS_E2EE_STORE)) {
                request.result.createObjectStore(CURRUSCOS_E2EE_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function e2eeDbGet(key) {
    const db = await e2eeOpenDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CURRUSCOS_E2EE_STORE, "readonly");
        const request = tx.objectStore(CURRUSCOS_E2EE_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function e2eeDbPut(key, value) {
    const db = await e2eeOpenDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CURRUSCOS_E2EE_STORE, "readwrite");
        tx.objectStore(CURRUSCOS_E2EE_STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function ensureUserE2EEKey() {
    const user = await getCurrentUser();
    if (!user || !window.crypto?.subtle) return null;

    const stored = await e2eeDbGet("device-key:" + user.id);
    if (stored?.privateKey && stored?.publicKeyJwk) return stored;

    const pair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

    await e2eeDbPut("device-key:" + user.id, {
        privateKey: pair.privateKey,
        publicKeyJwk,
        createdAt: new Date().toISOString()
    });

    const { error } = await supabaseClient
        .from("user_e2ee_keys")
        .upsert({
            user_id: user.id,
            public_key_jwk: publicKeyJwk,
            algorithm: "ECDH-P256",
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

    if (error) throw new Error(getSupabaseErrorMessage(error, "No se ha podido registrar la clave de este dispositivo."));
    return { privateKey: pair.privateKey, publicKeyJwk };
}

async function e2eeImportPublicKey(jwk) {
    return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    );
}

async function e2eeDeriveWrappingKey(privateKey, publicKey) {
    return crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-KW", length: 256 },
        false,
        ["wrapKey", "unwrapKey"]
    );
}

async function generateGroupE2EEKey() {
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptE2EEText(groupKey, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(String(plaintext));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        groupKey,
        encoded
    );
    return JSON.stringify({
        v: 1,
        alg: "AES-GCM-256",
        iv: e2eeBytesToBase64(iv),
        ciphertext: e2eeBytesToBase64(ciphertext)
    });
}

async function decryptE2EEText(groupKey, payload) {
    const value = typeof payload === "string" ? JSON.parse(payload) : payload;
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: e2eeBase64ToBytes(value.iv) },
        groupKey,
        e2eeBase64ToBytes(value.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
}

async function wrapGroupE2EEKeyForUser(groupKey, recipientUserId) {
    const local = await ensureUserE2EEKey();
    if (!local) throw new Error("No se ha podido inicializar el cifrado del dispositivo.");

    const { data, error } = await supabaseClient
        .from("user_e2ee_keys")
        .select("public_key_jwk")
        .eq("user_id", recipientUserId)
        .single();

    if (error || !data?.public_key_jwk) {
        throw new Error("El miembro todavía no ha activado el cifrado en su dispositivo.");
    }

    const recipientPublicKey = await e2eeImportPublicKey(data.public_key_jwk);
    const ephemeralPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
    const wrappingKey = await e2eeDeriveWrappingKey(ephemeralPair.privateKey, recipientPublicKey);
    const wrapped = await crypto.subtle.wrapKey("raw", groupKey, wrappingKey, "AES-KW");
    const ephemeralPublicKeyJwk = await crypto.subtle.exportKey("jwk", ephemeralPair.publicKey);

    return JSON.stringify({
        v: 1,
        alg: "ECDH-P256+AES-KW",
        ephemeralPublicKey: ephemeralPublicKeyJwk,
        wrappedKey: e2eeBytesToBase64(wrapped)
    });
}

async function unwrapGroupE2EEKey(envelope) {
    const local = await ensureUserE2EEKey();
    if (!local) return null;

    const value = typeof envelope === "string" ? JSON.parse(envelope) : envelope;
    const ephemeralPublicKey = await e2eeImportPublicKey(value.ephemeralPublicKey);
    const wrappingKey = await e2eeDeriveWrappingKey(local.privateKey, ephemeralPublicKey);

    return crypto.subtle.unwrapKey(
        "raw",
        e2eeBase64ToBytes(value.wrappedKey),
        wrappingKey,
        "AES-KW",
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function getChatRoomSecurityContext(roomId) {
    if (!roomId) return null;
    const { data, error } = await supabaseClient
        .from("chat_rooms")
        .select("id,type,group_id,event_id,team_id,persistent_team_id")
        .eq("id", roomId)
        .single();
    if (error || !data) return null;
    if (data.group_id) return { groupId: data.group_id, scope: "group" };
    if (data.event_id) {
        const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", data.event_id).maybeSingle();
        if (event?.group_id) return { groupId: event.group_id, scope: "event" };
    }
    if (data.team_id) {
        const { data: team } = await supabaseClient.from("event_teams").select("event_id").eq("id", data.team_id).maybeSingle();
        if (team?.event_id) {
            const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", team.event_id).maybeSingle();
            if (event?.group_id) return { groupId: event.group_id, scope: "team" };
        }
    }
    return null;
}

async function provisionGroupE2EEEnvelope(groupId, targetUserId, encryptedGroupKey, keyVersion = 1) {
    const { data, error } = await supabaseClient.rpc("upsert_group_key_envelope", {
        target_group_id: groupId,
        target_user_id: targetUserId,
        target_key_version: keyVersion,
        target_encrypted_group_key: encryptedGroupKey
    });
    if (error) throw new Error(getSupabaseErrorMessage(error, "No se ha podido distribuir la clave del grupo."));
    return data;
}

async function provisionMissingGroupE2EEEnvelopes(groupId, groupKey, keyVersion = 1) {
    const user = await getCurrentUser();
    if (!user || !groupId || !groupKey) return 0;

    const { data: members, error: memberError } = await supabaseClient
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
    if (memberError) throw new Error(getSupabaseErrorMessage(memberError, "No se han podido cargar los miembros del grupo."));

    const { data: envelopes, error: envelopeError } = await supabaseClient
        .from("group_key_envelopes")
        .select("user_id,key_version")
        .eq("group_id", groupId)
        .eq("key_version", keyVersion);
    if (envelopeError) throw new Error(getSupabaseErrorMessage(envelopeError, "No se han podido comprobar las claves del grupo."));

    const existing = new Set((envelopes || []).map(row => row.user_id));
    let provisioned = 0;
    for (const member of (members || [])) {
        if (existing.has(member.user_id)) continue;
        try {
            const encrypted = await wrapGroupE2EEKeyForUser(groupKey, member.user_id);
            await provisionGroupE2EEEnvelope(groupId, member.user_id, encrypted, keyVersion);
            provisioned++;
        } catch (error) {
            console.warn("No se pudo provisionar E2EE para", member.user_id, error);
        }
    }
    return provisioned;
}

async function ensureGroupE2EE(groupId) {
    if (!groupId) return null;
    const existing = await getGroupE2EEKey(groupId);
    if (existing) {
        await provisionMissingGroupE2EEEnvelopes(groupId, existing, 1);
        return existing;
    }

    const user = await getCurrentUser();
    if (!user) return null;
    const group = await getCurrentGroup();
    if (!group || group.id !== groupId || !["owner","admin"].includes(group.role)) return null;

    await initializeGroupE2EE(groupId);
    const key = await getGroupE2EEKey(groupId);
    if (key) await provisionMissingGroupE2EEEnvelopes(groupId, key, 1);
    return key;
}

async function getGroupE2EEContext(groupId, keyVersion = null) {
    if (!groupId) return null;
    await ensureUserE2EEKey();
    const user = await getCurrentUser();
    if (!user) return null;

    let query = supabaseClient
        .from("group_key_envelopes")
        .select("encrypted_group_key,key_version")
        .eq("group_id", groupId)
        .eq("user_id", user.id);

    query = keyVersion ? query.eq("key_version", Number(keyVersion)) : query.order("key_version", { ascending: false }).limit(1);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(getSupabaseErrorMessage(error, "No se ha podido recuperar la clave del grupo."));
    if (!data) return null;

    return {
        key: await unwrapGroupE2EEKey(data.encrypted_group_key),
        version: Number(data.key_version)
    };
}

async function getGroupE2EEKey(groupId, keyVersion = null) {
    const context = await getGroupE2EEContext(groupId, keyVersion);
    return context?.key || null;
}

async function initializeGroupE2EE(groupId) {
    const user = await getCurrentUser();
    if (!user || !groupId) return false;

    await ensureUserE2EEKey();
    const existing = await getGroupE2EEKey(groupId);
    if (existing) return true;

    const groupKey = await generateGroupE2EEKey();
    const envelope = await wrapGroupE2EEKeyForUser(groupKey, user.id);

    await provisionGroupE2EEEnvelope(groupId, user.id, envelope, 1);
    return true;
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
                description,
                workspace_type,
                onboarding_profile,
                slug,
                created_by,
                timezone,
                default_locale,
                visibility,
                avatar_url
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

    const groupIds = (data || [])
        .filter(item => item.groups)
        .map(item => item.groups.id);

    let subscriptions = [];

    if (groupIds.length) {
        const { data: subscriptionRows } = await supabaseClient
            .from("group_subscriptions")
            .select("group_id,plan_code,status,workspace_plans(code,name,description,max_members,max_events_per_month,max_trips,max_storage_mb,features)")
            .in("group_id", groupIds);

        subscriptions = subscriptionRows || [];
    }

    const subscriptionByGroup = new Map(
        subscriptions.map(subscription => {
            const plan = Array.isArray(subscription.workspace_plans)
                ? subscription.workspace_plans[0]
                : subscription.workspace_plans;

            return [
                subscription.group_id,
                {
                    plan_code: subscription.plan_code,
                    plan_name: plan?.name || subscription.plan_code || "Free",
                    plan_description: plan?.description || "",
                    plan_status: subscription.status || "active",
                    plan_limits: plan || null
                }
            ];
        })
    );

    userGroupsCache = (data || [])
        .filter(item => item.groups)
        .map(item => ({
            id: item.groups.id,
            name: item.groups.name,
            description: item.groups.description,
            workspace_type: item.groups.workspace_type || "community",
            onboarding_profile: item.groups.onboarding_profile || {},
            slug: item.groups.slug || null,
            created_by: item.groups.created_by || null,
            timezone: item.groups.timezone || "Europe/Madrid",
            default_locale: item.groups.default_locale || "es",
            visibility: item.groups.visibility || "private",
            avatar_url: item.groups.avatar_url || null,
            role: item.role,
            joined_at: item.joined_at,
            ...(subscriptionByGroup.get(item.groups.id) || {
                plan_code: "free",
                plan_name: "Free",
                plan_status: "active",
                plan_limits: null
            })
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


async function createGroup(name, description, type = "community", size = "small", objective = "") {

    const { data, error } =
        await supabaseClient.rpc(
            "create_group",
            {
                group_name: name,
                group_description: description || null,
                group_type: type || "community",
                group_size: size || "small",
                group_objective: objective || null
            }
        );

    if (error) {

        console.error(
            "Error creando grupo:",
            error
        );

        return null;
    }

    // El usuario puede crear su primer grupo mientras las cachés
    // todavía contienen []: invalídalas antes de navegar al dashboard.
    userGroupsCache = null;
    currentGroupCache = null;

    return data;

}
async function getGroupPlanAccess(groupId, forceRefresh = false) {
    if (!groupId) return null;
    const usage = await getGroupUsage(groupId);
    if (!usage) return null;
    return {
        plan: usage.plan || {},
        usage: usage.usage || {},
        period_start: usage.period_start || null
    };
}

async function getGroupFeatureAccess(groupId, feature) {
    if (!groupId || !feature) return false;
    const access = await getGroupPlanAccess(groupId);
    const features = access?.plan?.features || {};
    return features[feature] === true;
}

async function checkGroupPlanCapacity(groupId, resource) {
    const access = await getGroupPlanAccess(groupId);
    if (!access) return { allowed: true };

    const limits = access.plan || {};
    const usage = access.usage || {};
    const map = {
        events: ["events_this_month", "max_events_per_month"],
        trips: ["trips", "max_trips"]
    };
    const pair = map[resource];
    if (!pair) return { allowed: true };

    const value = Number(usage[pair[0]] || 0);
    const limit = Number(limits[pair[1]] || 0);
    if (limit > 0 && value >= limit) {
        return {
            allowed: false,
            reason: "PLAN_LIMIT_" + resource.toUpperCase(),
            plan: limits.name || "Free",
            limit
        };
    }
    return { allowed: true, access };
}

async function createGroupTrip(tripData) {
    const group = await getCurrentGroup();
    if (!group) return null;
    const keyContext = await getGroupE2EEContext(group.id);
    if (!keyContext) throw new Error("No se ha podido preparar el cifrado del grupo.");
    const encryptedPayload = await encryptE2EEText(keyContext.key, JSON.stringify({
        title: tripData.title || "",
        destination: tripData.destination || null,
        description: tripData.description || null,
        search_preferences: tripData.search_preferences || {}
    }));
    const { data, error } = await supabaseClient.rpc("create_encrypted_trip", {
        target_group_id: group.id,
        trip_start_date: tripData.start_date || null,
        trip_end_date: tripData.end_date || null,
        trip_budget: tripData.budget_per_person ?? null,
        encrypted_payload: encryptedPayload,
        encryption_version: keyContext.version
    });
    if (error) {
        console.error("Error creando viaje:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido crear el viaje."));
    }
    return data || null;
}
async function requestWorkspacePlan(groupId, planCode) {
    if (!groupId || !planCode) return null;
    const { data, error } = await supabaseClient.rpc("request_workspace_plan", {
        target_group_id: groupId,
        target_plan: planCode
    });
    if (error) {
        console.error("Error solicitando cambio de plan:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido enviar la solicitud."));
    }
    return data || null;
}

async function reviewWorkspacePlanRequest(requestId, decision) {
    if (!requestId || !decision) return null;
    const { data, error } = await supabaseClient.rpc("review_workspace_plan_request", {
        target_request_id: requestId,
        decision
    });
    if (error) {
        console.error("Error gestionando solicitud de plan:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido gestionar la solicitud."));
    }
    return data || null;
}

async function getWorkspacePlanRequests(groupId) {
    if (!groupId) return [];
    const { data, error } = await supabaseClient
        .from("plan_requests")
        .select("id,requested_plan,status,created_at,updated_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
    if (error) {
        console.error("Error obteniendo solicitudes de plan:", error);
        return [];
    }
    return data || [];
}

// ========================================
// EVENTOS
// ========================================

async function createTripForEvent(eventId){
    const {data,error}=await supabaseClient.rpc("create_trip_for_event",{target_event_id:eventId});
    if(error){console.error("Error creando viaje para evento:",error);return null;}
    const tripId = data || null;
    if (!tripId) return null;

    try {
        const { data: event, error: eventError } = await supabaseClient
            .from("events")
            .select("id,group_id,title,location,date")
            .eq("id", eventId)
            .maybeSingle();
        if (eventError || !event) throw eventError || new Error("EVENT_NOT_FOUND");

        const keyContext = await getGroupE2EEContext(event.group_id);
        if (!keyContext) throw new Error("E2EE_GROUP_KEY_UNAVAILABLE");

        const encryptedPayload = await encryptE2EEText(keyContext.key, JSON.stringify({
            title: [event.title || "Evento", "· Viaje"].join(" "),
            destination: event.location || null,
            description: `Viaje asociado al evento "${event.title || "Evento"}".`
        }));

        const { error: updateError } = await supabaseClient
            .from("trips")
            .update({
                encrypted_payload: encryptedPayload,
                encryption_version: keyContext.version,
                title: null,
                destination: null,
                description: null
            })
            .eq("id", tripId)
            .eq("group_id", event.group_id);

        if (updateError) throw updateError;
    } catch (encryptionError) {
        console.error("Error cifrando el viaje recién creado:", encryptionError);
        return null;
    }

    return tripId;
}

async function getGroupEvents() {

    const group = await getCurrentGroup();

    if (!group) return [];

    const { data, error } = await supabaseClient
        .from("events")
        .select("*")
        .eq("group_id", group.id)
        .order("date", { ascending: true });

    if (error) {
        console.error("Error obteniendo eventos:", error);
        return [];
    }

    const events = data || [];
    const latestContext = await getGroupE2EEContext(group.id);
    if (!latestContext) return events;

    return Promise.all(events.map(async event => {
        if (!event.encrypted_payload) return event;
        try {
            const context = await getGroupE2EEContext(group.id, event.encryption_version || latestContext.version);
            if (!context) throw new Error("Clave no disponible");
            return { ...event, ...JSON.parse(await decryptE2EEText(context.key, event.encrypted_payload)) };
        } catch {
            return { ...event, title: "Contenido cifrado no disponible en este dispositivo.", description: "", location: "" };
        }
    }));
}


async function createGroupEvent(eventData) {
    const user = await getCurrentUser();
    const group = await getCurrentGroup();

    if (!user || !group) {
        console.error("No hay usuario o grupo.");
        return null;
    }

    const keyContext = await getGroupE2EEContext(group.id);
    if (!keyContext) {
        throw new Error("No se ha podido preparar el cifrado del grupo.");
    }

    const encryptedPayload = await encryptE2EEText(
        keyContext.key,
        JSON.stringify({
            title: String(eventData.title || "").trim(),
            description: String(eventData.description || "").trim(),
            location: String(eventData.location || "").trim()
        })
    );

    const { data, error } = await supabaseClient.rpc(
        "create_encrypted_group_event",
        {
            target_group_id: group.id,
            event_date: eventData.date || null,
            event_time: eventData.time || null,
            event_trip_id: eventData.trip_id || null,
            encrypted_payload: encryptedPayload,
            encryption_version: keyContext.version
        }
    );

    if (error) {
        console.error("Error creando evento cifrado:", error);
        throw new Error(getSupabaseErrorMessage(error, "No se ha podido crear el evento."));
    }

    return data || null;
}


async function deleteGroupEvent(eventId) {

    const group = await getCurrentGroup();

    if (!group) {
        return false;
    }

    const { error } = await supabaseClient
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("group_id", group.id);

    if (error) {
        console.error("Error eliminando evento:", error);
        return false;
    }

    return true;
}


async function getGroupTripsForEvent() {
    const group = await getCurrentGroup();
    if (!group) return [];

    const { data, error } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date, encrypted_payload, encryption_version")
        .eq("group_id", group.id)
        .in("status", ["planning", "confirmed"])
        .order("start_date", { ascending: true });

    if (error) {
        console.error("Error obteniendo viajes para eventos:", error);
        return [];
    }

    const trips = data || [];
    const latestContext = await getGroupE2EEContext(group.id);
    if (!latestContext) return trips;

    return Promise.all(trips.map(async trip => {
        if (!trip.encrypted_payload) return trip;
        try {
            const context = await getGroupE2EEContext(
                group.id,
                trip.encryption_version || latestContext.version
            );
            if (!context) throw new Error("Clave no disponible");
            return { ...trip, ...JSON.parse(await decryptE2EEText(context.key, trip.encrypted_payload)) };
        } catch {
            return { ...trip, title: "Contenido cifrado no disponible en este dispositivo.", destination: "" };
        }
    }));
}

async function getTripForEvent(tripId) {
    if (!tripId) return null;
    const group = await getCurrentGroup();
    if (!group) return null;

    const { data, error } = await supabaseClient
        .from("trips")
        .select("id, title, destination, status, start_date, end_date, encrypted_payload, encryption_version")
        .eq("id", tripId)
        .eq("group_id", group.id)
        .single();

    if (error) {
        console.error("Error obteniendo viaje del evento:", error);
        return null;
    }

    if (data?.encrypted_payload) {
        try {
            const context = await getGroupE2EEContext(
                group.id,
                data.encryption_version || null
            );
            if (!context) throw new Error("Clave no disponible");
            return { ...data, ...JSON.parse(await decryptE2EEText(context.key, data.encrypted_payload)) };
        } catch {
            return { ...data, title: "Contenido cifrado no disponible en este dispositivo.", destination: "" };
        }
    }
    return data;
}

async function getGroupEvent(eventId) {

    const group = await getCurrentGroup();

    if (!group) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("group_id", group.id)
        .single();

    if (error) {
        console.error("Error obteniendo evento:", error);
        return null;
    }

    return data;
}

async function updateGroupEvent(eventId, eventData) {
    const group = await getCurrentGroup();
    if (!group) return null;

    const { data: existing, error: readError } = await supabaseClient
        .from("events")
        .select("id,visibility,encrypted_payload,encryption_version")
        .eq("id", eventId)
        .eq("group_id", group.id)
        .single();

    if (readError || !existing) return null;

    const targetVisibility = eventData.visibility || existing.visibility || "private";
    const changes = {
        date: eventData.date,
        time: eventData.time,
        trip_id: eventData.trip_id || null,
        visibility: targetVisibility
    };

    const keyContext = await getGroupE2EEContext(group.id);

    if (targetVisibility === "public") {
        let payload = {
            title: eventData.title || "",
            description: eventData.description || "",
            location: eventData.location || ""
        };

        if (existing.encrypted_payload && existing.encryption_version) {
            const oldContext = await getGroupE2EEContext(group.id, existing.encryption_version);
            if (!oldContext) throw new Error("No se puede publicar el evento: falta la clave histórica.");
            try {
                payload = {
                    ...payload,
                    ...JSON.parse(await decryptE2EEText(oldContext.key, existing.encrypted_payload))
                };
            } catch {
                throw new Error("No se puede publicar el evento: no se ha podido descifrar su contenido.");
            }
        }

        Object.assign(changes, {
            title: payload.title,
            description: payload.description,
            location: payload.location,
            encrypted_payload: null,
            encryption_version: null
        });
    } else {
        if (!keyContext) throw new Error("No se puede guardar el evento privado: falta la clave E2EE.");

        let payload = {
            title: eventData.title || "",
            description: eventData.description || "",
            location: eventData.location || ""
        };

        if (existing.encrypted_payload && existing.encryption_version) {
            const oldContext = await getGroupE2EEContext(group.id, existing.encryption_version);
            if (!oldContext) throw new Error("No se puede actualizar el evento: falta la clave histórica.");
            try {
                payload = {
                    ...JSON.parse(await decryptE2EEText(oldContext.key, existing.encrypted_payload)),
                    ...payload
                };
            } catch {
                throw new Error("No se puede actualizar el evento: no se ha podido descifrar su contenido.");
            }
        }

        Object.assign(changes, {
            title: null,
            description: null,
            location: null,
            encrypted_payload: await encryptE2EEText(keyContext.key, JSON.stringify(payload)),
            encryption_version: keyContext.version
        });
    }

    const { data, error } = await supabaseClient
        .from("events")
        .update(changes)
        .eq("id", eventId)
        .eq("group_id", group.id)
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

    const tasks = data || [];
    const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", eventId).maybeSingle();
    if (!event?.group_id) return tasks;

    const latestContext = await getGroupE2EEContext(event.group_id);
    if (!latestContext) return tasks;

    return Promise.all(tasks.map(async task => {
        if (!task.encrypted_payload) return task;
        try {
            const context = await getGroupE2EEContext(event.group_id, task.encryption_version || latestContext.version);
            if (!context) throw new Error("Clave no disponible");
            const payload = JSON.parse(await decryptE2EEText(context.key, task.encrypted_payload));
            return { ...task, ...payload, encrypted_payload: task.encrypted_payload };
        } catch {
            return { ...task, title: "Contenido cifrado no disponible en este dispositivo." };
        }
    }));
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

    const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", eventId).maybeSingle();
    const groupKeyContext = event?.group_id ? await getGroupE2EEContext(event.group_id) : null;
    if (!groupKeyContext) return null;
    const encryptedPayload = await encryptE2EEText(groupKeyContext.key, JSON.stringify({ title: String(title || "").trim() }));

    const { data, error } = await supabaseClient
        .from("tasks")
        .insert({
            event_id: eventId,
            title: null,
            encrypted_payload: encryptedPayload,
            encryption_version: groupKeyContext.version,
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


async function updateEventTask(taskId, completed, taskData = {}) {
    const changes = {
        completed: completed
    };

    if (Object.prototype.hasOwnProperty.call(taskData, "assigned_to")) {
        changes.assigned_to = taskData.assigned_to || null;
    }

    if (typeof taskData.title === "string") {
        const { data: task } = await supabaseClient
            .from("tasks")
            .select("event_id")
            .eq("id", taskId)
            .maybeSingle();

        const { data: event } = task?.event_id
            ? await supabaseClient
                .from("events")
                .select("group_id")
                .eq("id", task.event_id)
                .maybeSingle()
            : { data: null };

        const keyContext = event?.group_id
            ? await getGroupE2EEContext(event.group_id)
            : null;

        if (keyContext) {
            changes.title = null;
            changes.encrypted_payload = await encryptE2EEText(
                keyContext.key,
                JSON.stringify({ title: taskData.title.trim() })
            );
            changes.encryption_version = keyContext.version;
        } else {
            return null;
        }
    }

    const { data, error } = await supabaseClient
        .from("tasks")
        .update(changes)
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

    const expenses = data || [];
    const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", eventId).maybeSingle();
    const groupId = event?.group_id || null;
    if (!groupId) return expenses;

    const latestContext = await getGroupE2EEContext(groupId);
    if (!latestContext) return expenses;

    return Promise.all(expenses.map(async expense => {
        if (!expense.encrypted_payload) return expense;
        try {
            const context = await getGroupE2EEContext(
                groupId,
                expense.encryption_version || latestContext.version
            );
            if (!context) throw new Error("Clave de cifrado no disponible");
            return {
                ...expense,
                ...JSON.parse(await decryptE2EEText(context.key, expense.encrypted_payload))
            };
        } catch {
            return {
                ...expense,
                title: "Contenido cifrado no disponible en este dispositivo."
            };
        }
    }));
}


async function createEventExpense(
    eventId,
    title,
    amount,
    paidBy
) {

    const user = await getCurrentUser();
    if (!user) return null;

    const { data: event } = await supabaseClient.from("events").select("group_id").eq("id", eventId).maybeSingle();
    const keyContext = event?.group_id ? await getGroupE2EEContext(event.group_id) : null;
    if (!keyContext) return null;
    const encryptedPayload = await encryptE2EEText(keyContext.key, JSON.stringify({ title: String(title || "").trim() }));

    const { data, error } = await supabaseClient
        .from("expenses")
        .insert({
            event_id: eventId,
            title: null,
            encrypted_payload: encryptedPayload,
            encryption_version: keyContext.version,
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
    if (!group) return [];

    const { data, error } = await supabaseClient
        .from("memories")
        .select(`
            id, group_id, created_by, title, description, image_url, created_at, event_id,
            encrypted_payload,
            encryption_version,
            profiles (display_name, username)
        `)
        .eq("group_id", group.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error obteniendo recuerdos:", error);
        return [];
    }

    const memories = data || [];
    const latestContext = await getGroupE2EEContext(group.id);
    if (!latestContext) return memories;

    return Promise.all(memories.map(async memory => {
        if (!memory.encrypted_payload) return memory;
        try {
            const context = await getGroupE2EEContext(group.id, memory.encryption_version || latestContext.version);
            if (!context) throw new Error("Clave no disponible");
            const payload = JSON.parse(await decryptE2EEText(context.key, memory.encrypted_payload));
            return { ...memory, ...payload };
        } catch {
            return { ...memory, title: "Contenido cifrado no disponible en este dispositivo.", description: "" };
        }
    }));
}


async function createGroupMemory(memoryData) {
    const group = await getCurrentGroup();
    const user = await getCurrentUser();

    if (!group || !user) {
        return null;
    }

    const keyContext = await getGroupE2EEContext(group.id);
    if (!keyContext) return null;
    const encryptedPayload = await encryptE2EEText(keyContext.key, JSON.stringify({
            title: memoryData.title || "",
            description: memoryData.description || ""
        }))
        : null;

    const { data, error } = await supabaseClient
        .from("memories")
        .insert({
            group_id: group.id,
            created_by: user.id,
            title: encryptedPayload ? null : memoryData.title,
            description: encryptedPayload ? null : (memoryData.description || null),
            encrypted_payload: encryptedPayload,
            encryption_version: keyContext.version,
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

async function followUser(userId){const {data,error}=await supabaseClient.rpc("follow_user",{target_user_id:userId});if(error){console.error(error);return false;}return !!data;}
async function unfollowUser(userId){const {data,error}=await supabaseClient.rpc("unfollow_user",{target_user_id:userId});if(error){console.error(error);return false;}return !!data;}
async function getFollowStatus(userId){const {data,error}=await supabaseClient.rpc("get_follow_status",{target_user_id:userId});if(error){console.error(error);return null;}return data?.[0]||null;}
async function getSocialActivity(){const {data,error}=await supabaseClient.rpc("get_social_activity");if(error){console.error(error);return [];}return data||[];}
async function getRecommendedPublicEvents(search="",eventType="all"){const {data,error}=await supabaseClient.rpc("get_recommended_public_events",{search_text:search,target_event_type:eventType});if(error){console.error(error);return [];}return data||[];}
async function getMyInterests(){const {data,error}=await supabaseClient.rpc("get_my_interests");if(error){console.error("Interests:",error);return [];}return (data||[]).map(x=>x.interest);}
async function setMyInterests(interests){const {data,error}=await supabaseClient.rpc("set_my_interests",{target_interests:interests});if(error)throw error;return !!data;}
async function logActivitySignal(signal,eventId=null,eventType=null,searchText=null,metadata={}){const {data,error}=await supabaseClient.rpc("log_activity_signal",{target_signal:signal,target_event_id:eventId,target_event_type:eventType,target_search:searchText,target_metadata:metadata});if(error){console.error("Activity signal:",error);return false;}return !!data;}

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

    const savedGroupId = localStorage.getItem("curruscos_current_group");
    if (savedGroupId === groupId) {
        localStorage.removeItem("curruscos_current_group");
    }
    userGroupsCache = null;
    currentGroupCache = null;

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

    const savedGroupId = localStorage.getItem("curruscos_current_group");
    if (savedGroupId === groupId) {
        localStorage.removeItem("curruscos_current_group");
    }
    userGroupsCache = null;
    currentGroupCache = null;

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

    // Si el cambio afecta al usuario actual, la caché de permisos puede
    // quedar obsoleta hasta la siguiente recarga. Invalidarla aquí evita
    // trabajar con un rol antiguo en el mismo workspace.
    const currentUser = await getCurrentUser();
    if (currentUser && userId === currentUser.id) {
        userGroupsCache = null;
        currentGroupCache = null;
    }

    return data;
}

async function rotateGroupE2EEBeforeMemberRemoval(groupId, userId) {
    const currentKey = await getGroupE2EEKey(groupId);
    if (!currentKey) return false;

    const { data: latest } = await supabaseClient
        .from("group_key_envelopes")
        .select("key_version")
        .eq("group_id", groupId)
        .order("key_version", { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextVersion = Number(latest?.key_version || 1) + 1;
    const nextKey = await generateGroupE2EEKey();

    const { data: members, error } = await supabaseClient
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", userId);
    if (error) throw new Error(getSupabaseErrorMessage(error, "No se han podido preparar las claves del grupo."));

    for (const member of (members || [])) {
        const envelope = await wrapGroupE2EEKeyForUser(nextKey, member.user_id);
        await provisionGroupE2EEEnvelope(groupId, member.user_id, envelope, nextVersion);
    }

    return true;
}

async function removeGroupMember(groupId, userId) {
    // Rotamos primero: el expulsado queda sin acceso a la nueva versión.
    await rotateGroupE2EEBeforeMemberRemoval(groupId, userId);

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

    const currentUser = await getCurrentUser();

    if (currentUser && userId === currentUser.id) {
        const savedGroupId = localStorage.getItem("curruscos_current_group");
        if (savedGroupId === groupId) {
            localStorage.removeItem("curruscos_current_group");
            currentGroupCache = null;
        }
        userGroupsCache = null;
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

    userGroupsCache = null;
    currentGroupCache = null;

    return data;
}

async function rejectGroupInvitation(invitationId) {
    const { data, error } = await supabaseClient.rpc(
        "reject_group_invitation",
        {
            target_invitation_id: invitationId
        }
    );

    if (error) {
        throw new Error(getSupabaseErrorMessage(
            error,
            "No se ha podido rechazar la invitación."
        ));
    }

    userGroupsCache = null;
    currentGroupCache = null;

    return data;
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

async function sendPersistentTeamInvitation(userId,teamId){const {data,error}=await supabaseClient.rpc("send_persistent_team_invitation",{target_user_id:userId,target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido enviar la invitación."));return data;}
async function getPersistentTeamMembers(teamId){const {data,error}=await supabaseClient.rpc("get_persistent_team_members",{target_team_id:teamId});if(error){console.error("Error obteniendo miembros:",error);return [];}return data||[];}
async function addPersistentTeamMember(teamId,userId){const {data,error}=await supabaseClient.rpc("add_persistent_team_member",{target_team_id:teamId,target_user_id:userId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido añadir al miembro."));return data;}
async function updatePersistentTeam(teamId,name,description){const {data,error}=await supabaseClient.rpc('update_persistent_team',{target_team_id:teamId,target_name:name,target_description:description||null});if(error)throw new Error(getSupabaseErrorMessage(error,'No se ha podido actualizar el equipo.'));return !!data;}
async function leavePersistentTeam(teamId){const {data,error}=await supabaseClient.rpc("leave_persistent_team",{target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido salir del equipo."));return !!data;}
async function removePersistentTeamMember(teamId,userId){const {data,error}=await supabaseClient.rpc("remove_persistent_team_member",{target_team_id:teamId,target_user_id:userId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido quitar al miembro."));return data;}
async function getMyTeamRole(teamId){const {data,error}=await supabaseClient.rpc("get_my_team_role",{target_team_id:teamId});if(error)return null;return data;}
async function createPersistentTeam(name,description=""){const {data,error}=await supabaseClient.rpc("create_persistent_team",{target_name:name,target_description:description||null});if(error){console.error("Error creando equipo persistente:",error);throw new Error(getSupabaseErrorMessage(error,"No se ha podido crear el equipo."));}return data;}
async function getMyTeams(){const {data,error}=await supabaseClient.rpc("get_my_teams");if(error){console.error("Error obteniendo equipos:",error);return [];}return data||[];}
async function getPersistentTeamPendingInvitations(teamId){const {data,error}=await supabaseClient.rpc("get_persistent_team_pending_invitations",{target_team_id:teamId});if(error){console.error("Error cargando invitaciones del equipo:",error);return [];}return data||[];}
async function cancelPersistentTeamInvitation(invitationId){const {data,error}=await supabaseClient.rpc("cancel_persistent_team_invitation",{target_invitation_id:invitationId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido cancelar la invitación."));return !!data;}
async function getPublicPersistentTeamEvents(teamId){const {data,error}=await supabaseClient.rpc("get_public_persistent_team_events",{target_team_id:teamId});if(error){console.error("Error cargando eventos del equipo:",error);return [];}return data||[];}
async function getPersistentTeamEventReadiness(eventId,teamId){const {data,error}=await supabaseClient.rpc("get_persistent_team_event_readiness",{target_event_id:eventId,target_team_id:teamId});if(error){console.error("Error comprobando equipo para evento:",error);return null;}return data?.[0]||null;}
async function invitePersistentTeamToEvent(eventId,teamId){const {data,error}=await supabaseClient.rpc("invite_persistent_team_to_event",{target_event_id:eventId,target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se han podido enviar las invitaciones."));return Number(data||0);}
async function getMyTeamsForEvent(eventId){const {data,error}=await supabaseClient.rpc("get_my_teams_for_event",{target_event_id:eventId});if(error){console.error("Error obteniendo equipos para evento:",error);return [];}return data||[];}
async function registerPersistentTeamForEvent(eventId,teamId){const {data,error}=await supabaseClient.rpc("register_persistent_team_for_event",{target_event_id:eventId,target_team_id:teamId});if(error)throw new Error(getSupabaseErrorMessage(error,"No se ha podido registrar el equipo."));return data;}

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
async function sendEncryptedChatMessage(roomId, encryptedBody, encryptionVersion = 1){
    const user=await getCurrentUser();
    if(!user||!roomId||!encryptedBody)return null;
    const {data,error}=await supabaseClient.from("chat_messages").insert({
        room_id:roomId,user_id:user.id,body:null,encrypted_body:encryptedBody,encryption_version:Number(encryptionVersion)||1
    }).select("id,room_id,user_id,body,encrypted_body,encryption_version,created_at,edited_at,deleted_at").single();
    if(error){console.error("Error enviando mensaje cifrado:",error);return null;}
    return data;
}

async function getChatMessages(roomId){const {data,error}=await supabaseClient.from("chat_messages").select("id,room_id,user_id,body,encrypted_body,encryption_version,created_at,edited_at,deleted_at").eq("room_id",roomId).is("deleted_at",null).order("created_at",{ascending:true}).limit(200);if(error){console.error("Error obteniendo mensajes:",error);return [];}return data||[];}
async function updateChatMessage(messageId,body){
    const user=await getCurrentUser();
    if(!user)return null;
    const ctx=await getChatRoomSecurityContext(currentRoomId);
    const e2eeContext=ctx?.groupId ? await getGroupE2EEContext(ctx.groupId) : null;
    const changes=ctx?.groupId
        ? {body:null,encrypted_body:await encryptE2EEText(e2eeContext.key,String(body||"").trim().slice(0,2000)),encryption_version:e2eeContext.version,edited_at:new Date().toISOString()}
        : {body:String(body||"").trim().slice(0,2000),edited_at:new Date().toISOString()};
    const {data,error}=await supabaseClient.from("chat_messages").update(changes).eq("id",messageId).eq("user_id",user.id).select("id,room_id,user_id,body,encrypted_body,encryption_version,created_at,edited_at,deleted_at").single();
    if(error){console.error("Error editando mensaje:",error);return null;}
    if(ctx?.groupId){data.body=String(body||"").trim().slice(0,2000);}
    return data;
}

async function deleteChatMessage(messageId){const {error}=await supabaseClient.from("chat_messages").update({deleted_at:new Date().toISOString()}).eq("id",messageId).eq("user_id",(await getCurrentUser())?.id);if(error){console.error("Error borrando mensaje:",error);return false;}return true;}
async function sendChatMessage(roomId,body){const user=await getCurrentUser();if(!user||!String(body||"").trim())return null;const {data,error}=await supabaseClient.from("chat_messages").insert({room_id:roomId,user_id:user.id,body:String(body).trim().slice(0,2000)}).select().single();if(error){console.error("Error enviando mensaje:",error);return null;}return data;}
function subscribeToChat(roomId,callback){return supabaseClient.channel("chat-"+roomId).on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:"room_id=eq."+roomId},payload=>callback?.(payload.new)).subscribe();}
function unsubscribeFromChat(channel){if(channel)return supabaseClient.removeChannel(channel);}

async function getTeamFollowStatus(teamId){const {data,error}=await supabaseClient.rpc("get_team_follow_status",{target_team_id:teamId});if(error){console.error("Error obteniendo seguimiento del equipo:",error);return null;}return data?.[0]||null;}
async function followTeam(teamId){const {data,error}=await supabaseClient.rpc("follow_team",{target_team_id:teamId});if(error){console.error("Error siguiendo equipo:",error);return false;}return data===true;}
async function unfollowTeam(teamId){const {data,error}=await supabaseClient.rpc("unfollow_team",{target_team_id:teamId});if(error){console.error("Error dejando de seguir equipo:",error);return false;}return data===true;}

async function getPublicActiveTeams(search="",eventType="all"){const {data,error}=await supabaseClient.rpc("get_public_active_teams",{search_text:String(search||"").trim()||null,target_event_type:eventType||"all"});if(error){console.error("Error obteniendo equipos públicos:",error);return [];}return data||[];}

async function getPublicTeam(teamId){const {data,error}=await supabaseClient.rpc("get_public_team",{target_team_id:teamId});if(error){console.error("Error obteniendo equipo público:",error);return null;}return data?.[0]||null;}

async function getPublicProfile(userId){const {data,error}=await supabaseClient.rpc("get_public_profile",{target_user_id:userId});if(error){console.error("Error obteniendo perfil público:",error);return null;}return data?.[0]||null;}


async function getPublicProfileActivity(userId){
    const {data,error}=await supabaseClient.rpc("get_public_profile_activity",{target_user_id:userId});
    if(error){console.error("Error obteniendo actividad pública:",error);return [];}return data||[];
}


async function getPublicRelatedEvents(eventId){const {data,error}=await supabaseClient.rpc("get_public_related_events",{target_event_id:eventId});if(error){console.error("Error obteniendo eventos relacionados:",error);return [];}return data||[];}

async function getPublicActivePeople(search="",eventType="all"){const {data,error}=await supabaseClient.rpc("get_public_active_people",{search_text:String(search||"").trim()||null,target_event_type:eventType||"all"});if(error){console.error("Error obteniendo personas públicas:",error);return [];}return data||[];}


// ========================================
// 🔔 BADGES GLOBALES DE ACTIVIDAD
// ========================================
async function updateGlobalActivityBadges(){
    const user=await getCurrentUser();
    if(!user)return;
    const [notifications,invitations,chats]=await Promise.all([getUserNotifications(),getMySocialInvitations(),getMyChatRooms()]);
    const unreadNotifications=(notifications||[]).filter(n=>!n.is_read).length;
    const pendingInvitations=(invitations||[]).filter(i=>i.status==="pending").length;
    const unreadChats=(chats||[]).reduce((sum,r)=>sum+Number(r.unread_count||0),0);
    const nav=document.getElementById("mainNav");
    if(!nav)return;
    const apply=(href,count,label)=>{
        const link=[...nav.querySelectorAll("a")].find(a=>a.getAttribute("href")===href);
        if(!link)return;
        link.querySelector(".nav-badge")?.remove();
        if(count<=0)return;
        const badge=document.createElement("span");badge.className="nav-badge";badge.textContent=count>99?"99+":String(count);badge.setAttribute("aria-label",count+" "+label);
        link.appendChild(badge);
    };
    apply("notificaciones.html",unreadNotifications+pendingInvitations,"avisos pendientes");
    apply("chat.html",unreadChats,"mensajes sin leer");
}
function startGlobalActivityBadges(){
    updateGlobalActivityBadges();
    window.addEventListener("curruscos:new-notification",updateGlobalActivityBadges);
    window.addEventListener("curruscos:chat-updated",updateGlobalActivityBadges);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startGlobalActivityBadges);else startGlobalActivityBadges();


async function getGroupPendingInvitations(groupId) {
    if (!groupId) return [];
    const { data, error } = await supabaseClient.rpc("get_group_pending_invitations", { target_group_id: groupId });
    if (error) { console.error("Error obteniendo invitaciones del workspace:", error); return []; }
    return data || [];
}

async function cancelGroupInvitation(invitationId) {
    const { data, error } = await supabaseClient.rpc("cancel_group_invitation", { target_invitation_id: invitationId });
    if (error) throw new Error(getSupabaseErrorMessage(error, "No se ha podido cancelar la invitación."));
    return !!data;
}

async function getGroupUsage(groupId) {
    if (!groupId) return null;
    const { data, error } = await supabaseClient.rpc(
        "get_group_usage",
        { target_group_id: groupId }
    );
    if (error) {
        console.error("Error obteniendo uso del workspace:", error);
        return null;
    }
    return data || null;
}
