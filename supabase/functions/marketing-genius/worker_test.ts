import worker from "../../../backend/worker.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeKV() {
  const values = new Map<string, { value: string; expiresAt?: number }>();
  return {
    async get(key: string, type?: "json") {
      const entry = values.get(key);
      if (!entry || (entry.expiresAt && entry.expiresAt <= Date.now())) return null;
      if (type === "json") {
        try { return JSON.parse(entry.value); } catch { return null; }
      }
      return entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      values.set(key, { value, expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined });
    },
    async list(options: { prefix?: string; limit?: number } = {}) {
      return { keys: [...values.keys()].filter((key) => key.startsWith(options.prefix ?? "")).slice(0, options.limit ?? 1000).map((name) => ({ name })) };
    },
    async delete(key: string) { values.delete(key); },
  };
}

function makeEnv() {
  return {
    MG_DATA: fakeKV(),
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    APP_LOGIN_PASSWORD: "test-owner-password",
    SESSION_SECRET: "test-session-secret-that-is-long-enough",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "gpt-4.1-mini",
    META_PAGE_ID: "",
    META_PAGE_ACCESS_TOKEN: "",
    META_INSTAGRAM_ACCOUNT_ID: "",
  };
}

Deno.test("health endpoint reports configured storage", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), makeEnv());
  assert(response.status === 200, "health endpoint should return 200");
  const body = await response.json();
  assert(body.ok === true && body.capabilities.storage === true, "storage should be reported as configured");
});

Deno.test("unapproved origins are rejected", async () => {
  const response = await worker.fetch(new Request("https://api.example/health", {
    headers: { Origin: "https://invalid.example" },
  }), makeEnv());
  assert(response.status === 403, "unapproved origin should receive 403");
});

Deno.test("owner login and campaign draft lifecycle work", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.22" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  assert(login.status === 200, "owner login should succeed");
  const loginBody = await login.json();
  assert(typeof loginBody.token === "string", "login should return a session token");

  const headers = { Origin: env.APP_ORIGIN, Authorization: `Bearer ${loginBody.token}`, "Content-Type": "application/json" };
  const create = await worker.fetch(new Request("https://api.example/api/campaigns", {
    method: "POST", headers, body: JSON.stringify({ name: "Test draft", offer: "Test offer" }),
  }), env);
  assert(create.status === 201, "campaign draft should be created");
  const createdBody = await create.json();
  const id = createdBody.campaign?.id;
  assert(typeof id === "string", "created campaign should have an id");

  const list = await worker.fetch(new Request("https://api.example/api/campaigns", { headers }), env);
  const listBody = await list.json();
  assert(listBody.campaigns.length === 1 && listBody.campaigns[0].id === id, "campaign should be stored and listed");

  const preapproved = await worker.fetch(new Request("https://api.example/api/campaigns", {
    method: "POST", headers, body: JSON.stringify({ name: "Invalid", offer: "Test", approvedAt: "2026-10-16T00:00:00Z" }),
  }), env);
  assert(preapproved.status === 400, "new campaign must not be created pre-approved");

  const get = await worker.fetch(new Request(`https://api.example/api/campaigns/${id}`, { headers }), env);
  assert(get.status === 200, "saved campaign should be retrievable");

  const remove = await worker.fetch(new Request(`https://api.example/api/campaigns/${id}`, { method: "DELETE", headers }), env);
  assert(remove.status === 200, "campaign should be deletable");
});


Deno.test("campaign API rejects missing or invalid owner sessions", async () => {
  const env = makeEnv();
  const missing = await worker.fetch(new Request("https://api.example/api/campaigns"), env);
  assert(missing.status === 401, "campaign access without a session should return 401");

  const invalid = await worker.fetch(new Request("https://api.example/api/campaigns", {
    headers: { Authorization: "Bearer not-a-valid-session" },
  }), env);
  assert(invalid.status === 401, "campaign access with an invalid session should return 401");
});

Deno.test("owner login rejects an incorrect password", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "incorrect-password" }),
  }), env);
  assert(response.status === 401, "incorrect owner password should return 401");
});
