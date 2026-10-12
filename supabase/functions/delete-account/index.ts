import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://curruscos-clan.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://curruscos-clan.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Debes iniciar sesión para eliminar la cuenta." }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== "BORRAR") return json({ error: "La confirmación no es válida." }, 400);

    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anonKey || !serviceKey) throw new Error("La función de eliminación no está configurada correctamente.");

    const token = authorization.slice(7).trim();
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id) return json({ error: "La sesión ha caducado. Inicia sesión de nuevo." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // The database routine removes restricted trip contributions and transfers ownership
    // before Auth deletion triggers the expected FK cascades.
    const { error: preparationError } = await admin.rpc("prepare_account_deletion", { target_user_id: user.id });
    if (preparationError) {
      console.error("Account erasure preparation failed:", preparationError.message);
      throw new Error("No se han podido preparar los datos de la cuenta. No se ha eliminado el usuario.");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Auth deletion failed:", deleteError.message);
      throw new Error("No se ha podido borrar el usuario de acceso.");
    }
    return json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se ha podido eliminar la cuenta.";
    return json({ error: msg }, 500);
  }
});
