import worker from "../../../backend/worker.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function headers() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function dbRequest(path: string, init: RequestInit = {}) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");
  const response = await fetch(`${supabaseUrl}/rest/v1/mg_kv${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Supabase storage request failed (${response.status}).`);
  return response;
}

const storage = {
  async get(key: string, type?: "json") {
    const query = `?key=eq.${encodeURIComponent(key)}&select=value,expires_at&limit=1`;
    const response = await dbRequest(query);
    const rows = await response.json();
    const row = rows[0];
    if (!row || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) return null;
    if (type === "json") {
      try { return JSON.parse(row.value); } catch { return null; }
    }
    return row.value;
  },
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    const expiresAt = options?.expirationTtl
      ? new Date(Date.now() + options.expirationTtl * 1000).toISOString()
      : null;
    await dbRequest("?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, value, expires_at: expiresAt, updated_at: new Date().toISOString() }),
    });
  },
  async list(options: { prefix?: string; limit?: number } = {}) {
    const prefix = (options.prefix ?? "").replace(/[,*()]/g, "");
    const limit = Math.max(1, Math.min(options.limit ?? 1000, 1000));
    const query = `?key=like.${encodeURIComponent(prefix)}%25&select=key&limit=${limit}`;
    const response = await dbRequest(query);
    const rows = await response.json();
    return { keys: rows.map((row: { key: string }) => ({ name: row.key })) };
  },
  async delete(key: string) {
    await dbRequest(`?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  },
};

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const prefix = "/functions/v1/marketing-genius";
  const pathname = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length) || "/"
    : url.pathname;

  // Recreate the path expected by the existing Cloudflare Worker router.
  const rewritten = new URL(request.url);
  rewritten.pathname = pathname;
  const forwarded = new Request(rewritten, { method: request.method, headers: request.headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body, redirect: request.redirect });
  const env = {
    // Do not report storage as configured when the server-side Supabase credentials are absent.
    MG_DATA: supabaseUrl && serviceRoleKey ? storage : null,
    APP_ORIGIN: Deno.env.get("APP_ORIGIN") ?? "https://lucasmaxxinfo-sketch.github.io",
    APP_LOGIN_PASSWORD: Deno.env.get("APP_LOGIN_PASSWORD") ?? "",
    SESSION_SECRET: Deno.env.get("SESSION_SECRET") ?? "",
    OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "",
    OPENAI_MODEL: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
    META_PAGE_ID: Deno.env.get("META_PAGE_ID") ?? "",
    META_PAGE_ACCESS_TOKEN: Deno.env.get("META_PAGE_ACCESS_TOKEN") ?? "",
    META_INSTAGRAM_ACCOUNT_ID: Deno.env.get("META_INSTAGRAM_ACCOUNT_ID") ?? "",
  };

  try {
    return await worker.fetch(forwarded, env);
  } catch {
    const requestOrigin = request.headers.get("Origin");
    const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "https://lucasmaxxinfo-sketch.github.io";
    const corsHeaders: Record<string, string> = requestOrigin === allowedOrigin
      ? {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
          "Vary": "Origin",
        }
      : {};
    return new Response(JSON.stringify({ error: "The live workspace request could not be completed." }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders,
      },
    });
  }
});
