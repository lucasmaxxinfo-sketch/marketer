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

  // Keep the public health route independent from the worker's owner-only API routes.
  if (request.method === "GET" && (pathname === "/health" || pathname === "/health/")) {
    const requestOrigin = request.headers.get("Origin");
    const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "https://lucasmaxxinfo-sketch.github.io";
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(requestOrigin === allowedOrigin ? {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,apikey",
        "Vary": "Origin",
      } : {}),
    };
    return new Response(JSON.stringify({
      ok: true,
      service: "Marketing Genius API",
      time: new Date().toISOString(),
      route: "health",
      capabilities: {
        storage: !!(supabaseUrl && serviceRoleKey),
        ownerLogin: !!(
          supabaseUrl &&
          (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")) &&
          Deno.env.get("OWNER_EMAIL")
        ),
        aiCampaigns: !!Deno.env.get("OPENAI_API_KEY"),
        campaignGeneration: true,
        campaignEngine: Deno.env.get("OPENAI_API_KEY")
          ? "openai-with-rules-fallback"
          : "rules-based-free-v1",
        facebookPublishing: !!(
          Deno.env.get("META_PAGE_ID") &&
          Deno.env.get("META_PAGE_ACCESS_TOKEN")
        ),
        instagramPublishing: !!(
          Deno.env.get("META_INSTAGRAM_ACCOUNT_ID") &&
          Deno.env.get("META_PAGE_ACCESS_TOKEN")
        ),
        supportedPublishing: ["Facebook", "Instagram"],
      },
    }), { status: 200, headers });
  }

  // Recreate the path expected by the existing Cloudflare Worker router.
  const rewritten = new URL(request.url);
  rewritten.pathname = pathname;
  const forwarded = new Request(rewritten, { method: request.method, headers: request.headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body, redirect: request.redirect });
  const env = {
    // Do not report storage as configured when the server-side Supabase credentials are absent.
    MG_DATA: supabaseUrl && serviceRoleKey ? storage : null,
    APP_ORIGIN: Deno.env.get("APP_ORIGIN") ?? "https://lucasmaxxinfo-sketch.github.io",
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    OWNER_EMAIL: Deno.env.get("OWNER_EMAIL") ?? "",
    AUTH_FETCH: fetch,
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
          "Access-Control-Allow-Headers": "Authorization,Content-Type,apikey",
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
