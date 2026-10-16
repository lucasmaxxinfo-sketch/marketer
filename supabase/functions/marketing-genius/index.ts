import worker from "./worker.js";
import { createStorage } from "./storage.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const storage = createStorage(supabaseUrl, serviceRoleKey);

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
