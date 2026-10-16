import { createStorage } from "./storage.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("storage get reads a live string value and decodes JSON on request", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const storage = createStorage("https://project.example", "service-secret", async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json([{ value: JSON.stringify({ id: "c1" }), expires_at: null }]);
  });

  const value = await storage.get("campaign:c1", "json") as { id: string };
  assert(value.id === "c1", "JSON values should be parsed");
  assert(calls[0].url.includes("key=eq.campaign%3Ac1"), "key filter should be encoded");
  assert(new Headers(calls[0].init?.headers).get("Authorization") === "Bearer service-secret", "service role must be sent server-side");
});

Deno.test("storage get treats expired and missing records as absent and removes expired rows", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const storage = createStorage("https://project.example", "service-secret", async (input, init) => {
    calls.push({ url: String(input), init });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json([{ value: "old", expires_at: "2000-01-01T00:00:00.000Z" }]);
  });
  assert(await storage.get("old") === null, "expired records should be absent");
  assert(calls.length === 2 && calls[1].init?.method === "DELETE", "expired rows should be deleted when encountered");

  const missing = createStorage("https://project.example", "service-secret", async () => Response.json([]));
  assert(await missing.get("missing") === null, "missing records should be absent");
});

Deno.test("storage put upserts values and records expiry", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const storage = createStorage("https://project.example", "service-secret", async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(null, { status: 204 });
  });
  await storage.put("campaign:c1", '{"id":"c1"}', { expirationTtl: 60 });
  assert(capturedUrl.endsWith("?on_conflict=key"), "put should use key conflict handling");
  assert(capturedInit?.method === "POST", "put should POST an upsert");
  assert(new Headers(capturedInit?.headers).get("Prefer")?.includes("resolution=merge-duplicates"), "put should request upsert semantics");
  const body = JSON.parse(String(capturedInit?.body));
  assert(body.key === "campaign:c1" && body.value === '{"id":"c1"}', "upsert should preserve key and serialized value");
  assert(Date.parse(body.expires_at) > Date.now(), "TTL should produce a future expiry");
});

Deno.test("storage list caps limits and returns KV-style key objects", async () => {
  let capturedUrl = "";
  const storage = createStorage("https://project.example", "service-secret", async (input) => {
    capturedUrl = String(input);
    return Response.json([{ key: "campaign:c1" }, { key: "campaign:c2" }]);
  });
  const result = await storage.list({ prefix: "campaign:", limit: 5000 });
  assert(capturedUrl.includes("limit=1000"), "list should cap results at 1000");
  assert(result.keys.length === 2 && result.keys[0].name === "campaign:c1", "list should return KV-style keys");
});

Deno.test("storage delete sends a filtered DELETE request", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const storage = createStorage("https://project.example", "service-secret", async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(null, { status: 204 });
  });
  await storage.delete("campaign:c1");
  assert(capturedInit?.method === "DELETE", "delete should use DELETE");
  assert(capturedUrl.includes("key=eq.campaign%3Ac1"), "delete should filter by the exact key");
});

Deno.test("storage rejects missing server credentials before making a request", async () => {
  let called = false;
  const storage = createStorage("", "", async () => {
    called = true;
    return Response.json([]);
  });
  let rejected = false;
  try { await storage.get("key"); } catch { rejected = true; }
  assert(rejected && !called, "missing credentials should fail closed without a network request");
});

Deno.test("storage converts database errors into a failed operation", async () => {
  const storage = createStorage("https://project.example", "service-secret", async () =>
    new Response("denied", { status: 403 }));
  let rejected = false;
  try { await storage.get("key"); } catch { rejected = true; }
  assert(rejected, "non-success database responses must not be treated as empty data");
});
