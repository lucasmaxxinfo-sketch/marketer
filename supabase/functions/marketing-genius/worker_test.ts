import worker from "./worker.js";

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
    async increment(key: string, ttlSeconds: number) {
      const entry = values.get(key);
      const live = entry && (!entry.expiresAt || entry.expiresAt > Date.now());
      const next = (live ? Number(entry.value) || 0 : 0) + 1;
      values.set(key, { value: String(next), expiresAt: Date.now() + ttlSeconds * 1000 });
      return next;
    },
  };
}

function makeEnv() {
  let signedInEmail = "owner@example.com";
  const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("/auth/v1/token?grant_type=password")) {
      const body = JSON.parse(String(init?.body || "{}"));
      if (body.password !== "test-owner-password") return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      signedInEmail = String(body.email || "").toLowerCase();
      return new Response(JSON.stringify({ access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer" }), { status: 200 });
    }
    if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
      const body = JSON.parse(String(init?.body || "{}"));
      if (body.refresh_token !== "test-refresh-token") return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      return new Response(JSON.stringify({ access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer" }), { status: 200 });
    }
    if (url.endsWith("/auth/v1/user")) {
      if (new Headers(init?.headers).get("Authorization") !== "Bearer test-access-token") return new Response(JSON.stringify({ message: "invalid token" }), { status: 401 });
      return new Response(JSON.stringify({ id: "test-owner-id", email: signedInEmail }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  };
  return {
    MG_DATA: fakeKV(),
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SUPABASE_URL: "https://auth.example.test",
    SUPABASE_ANON_KEY: "test-public-key",
    OWNER_EMAIL: "owner@example.com",
    AUTH_FETCH: authFetch,
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
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": "198.51.100.22" },
    body: JSON.stringify({ email: env.OWNER_EMAIL, password: "test-owner-password" }),
  }), env);
  assert(login.status === 200, "owner login should succeed");
  const loginBody = await login.json();
  assert(typeof loginBody.session?.accessToken === "string", "login should return a Supabase access token");
  assert(typeof loginBody.session?.refreshToken === "string", "login should return a refresh token");

  const headers = { Origin: env.APP_ORIGIN, Authorization: `Bearer ${loginBody.session.accessToken}`, "Content-Type": "application/json" };
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

Deno.test("non-owner Supabase accounts are denied access", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "someone-else@example.com", password: "test-owner-password" }),
  }), env);
  assert(response.status === 403, "a valid Supabase user must still match the configured owner email");
});

Deno.test("refresh tokens renew the owner session", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://api.example/api/auth/refresh", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: "test-refresh-token" }),
  }), env);
  assert(response.status === 200, "valid refresh token should renew the session");
  const body = await response.json();
  assert(body.session?.accessToken === "test-access-token", "refresh should return the new access token");
});

Deno.test("owner login rejects an incorrect password", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ email: env.OWNER_EMAIL, password: "incorrect-password" }),
  }), env);
  assert(response.status === 401, "incorrect owner password should return 401");
});

Deno.test("Supabase Auth throttling is passed through to the client", async () => {
  const env = makeEnv();
  env.AUTH_FETCH = async (input: RequestInfo | URL) => String(input).includes("/auth/v1/token?grant_type=password")
    ? new Response(JSON.stringify({ message: "rate limit exceeded" }), { status: 429 })
    : new Response("{}", { status: 401 });
  const response = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.OWNER_EMAIL, password: "wrong-password" }),
  }), env);
  assert(response.status === 429, "Supabase Auth rate limiting must be preserved");
});






Deno.test("health endpoint reports storage unavailable when storage is not configured", async () => {
  const env = { ...makeEnv(), MG_DATA: null };
  const response = await worker.fetch(new Request("https://api.example/health"), env);
  const body = await response.json();
  assert(response.status === 200, "health endpoint should remain available for diagnostics");
  assert(body.capabilities.storage === false, "health must not claim storage is configured");
});

Deno.test("publishing is blocked until both campaign and post are explicitly approved", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const loginBody = await login.json();
  const token = loginBody.session.accessToken;
  const headers = {
    Origin: env.APP_ORIGIN,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const campaign = {
    id: "approval-guard-test",
    name: "Approval guard test",
    offer: "Test only",
    status: "pending",
    posts: [{ id: "post-1", copy: "Test post", platform: "Facebook", status: "approved" }],
  };
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));

  const campaignUnapproved = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" }),
  }), env);
  assert(campaignUnapproved.status === 403, "a post must not publish when the campaign lacks owner approval");

  campaign.status = "approved";
  (campaign as typeof campaign & { approvedAt: string }).approvedAt = new Date().toISOString();
  campaign.posts[0].status = "pending";
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));

  const postUnapproved = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" }),
  }), env);
  assert(postUnapproved.status === 403, "a pending post must not publish even when its campaign is approved");
});


Deno.test("storage failures return a server error rather than a client error", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const { token } = await login.json();
  env.MG_DATA.list = async () => { throw new Error("database unavailable"); };
  const response = await worker.fetch(new Request("https://api.example/api/campaigns", {
    headers: { Origin: env.APP_ORIGIN, Authorization: `Bearer ${token}` },
  }), env);
  assert(response.status === 500, "database failures should return HTTP 500");
  const body = await response.json();
  assert(body.error === "The request could not be completed. Check the details and try again.", "internal details should not leak to the client");
});

Deno.test("malformed JSON requests return a client error", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: "{not-json",
  }), env);
  assert(login.status === 400, "malformed JSON should return HTTP 400");
});


Deno.test("publishing cannot override a post's explicitly assigned platform", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const { token } = await login.json();
  const headers = {
    Origin: env.APP_ORIGIN,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const campaign = {
    id: "platform-guard-test",
    name: "Platform guard test",
    status: "approved",
    approvedAt: new Date().toISOString(),
    posts: [{ id: "post-1", copy: "Test post", platform: "Facebook", status: "approved" }],
  };
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));
  const response = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Instagram" }),
  }), env);
  assert(response.status === 400, "a post assigned to Facebook must not be redirected to Instagram");
  const body = await response.json();
  assert(body.error === "The selected platform does not match this post.", "platform mismatch should be explicit");

  campaign.posts[0].platform = "Facebook / Instagram";
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));
  const flexiblePost = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Instagram" }),
  }), env);
  assert(flexiblePost.status === 503, "a post assigned to both platforms may use the selected platform; 503 here means only that test credentials are absent");
});


Deno.test("health endpoint identifies rules fallback when AI is not configured", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), makeEnv());
  const body = await response.json();
  assert(body.capabilities.aiCampaigns === false, "AI capability should be false without an API key");
  assert(body.capabilities.campaignGeneration === true, "campaign generation should remain available");
  assert(body.capabilities.campaignEngine === "rules-based-free-v1", "health should identify the rules-based fallback");
});

Deno.test("rules fallback produces campaign output without an AI key", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  assert(login.status === 200, "owner login should work for the test");
  const { token } = await login.json();
  const response = await worker.fetch(new Request("https://api.example/api/generate", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test campaign", offer: "A seasonal offer", business: "Local shop", audience: "Nearby customers", goal: "Increase enquiries", platforms: ["Facebook"] }),
  }), env);
  assert(response.status === 200, "campaign generation should fall back when AI is not configured");
  const body = await response.json();
  assert(body.campaign && body.model === "rules-based-free-v1", "response should clearly identify rules-based generation");
  assert(Array.isArray(body.campaign.posts) && body.campaign.posts.length === 3, "fallback should return three posts");
});



Deno.test("health endpoint reports storage unavailable when storage is not configured", async () => {
  const env = { ...makeEnv(), MG_DATA: null };
  const response = await worker.fetch(new Request("https://api.example/health"), env);
  const body = await response.json();
  assert(response.status === 200, "health endpoint should remain available for diagnostics");
  assert(body.capabilities.storage === false, "health must not claim storage is configured");
});

Deno.test("publishing is blocked until both campaign and post are explicitly approved", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const { token } = await login.json();
  const headers = {
    Origin: env.APP_ORIGIN,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const campaign = {
    id: "approval-guard-test",
    name: "Approval guard test",
    offer: "Test only",
    status: "pending",
    posts: [{ id: "post-1", copy: "Test post", platform: "Facebook", status: "approved" }],
  };
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));

  const campaignUnapproved = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" }),
  }), env);
  assert(campaignUnapproved.status === 403, "a post must not publish when the campaign lacks owner approval");

  campaign.status = "approved";
  (campaign as typeof campaign & { approvedAt: string }).approvedAt = new Date().toISOString();
  campaign.posts[0].status = "pending";
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));

  const postUnapproved = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" }),
  }), env);
  assert(postUnapproved.status === 403, "a pending post must not publish even when its campaign is approved");
});


Deno.test("storage failures return a server error rather than a client error", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const { token } = await login.json();
  env.MG_DATA.list = async () => { throw new Error("database unavailable"); };
  const response = await worker.fetch(new Request("https://api.example/api/campaigns", {
    headers: { Origin: env.APP_ORIGIN, Authorization: `Bearer ${token}` },
  }), env);
  assert(response.status === 500, "database failures should return HTTP 500");
  const body = await response.json();
  assert(body.error === "The request could not be completed. Check the details and try again.", "internal details should not leak to the client");
});

Deno.test("malformed JSON requests return a client error", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: "{not-json",
  }), env);
  assert(login.status === 400, "malformed JSON should return HTTP 400");
});


Deno.test("publishing cannot override a post's explicitly assigned platform", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  const { token } = await login.json();
  const headers = {
    Origin: env.APP_ORIGIN,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const campaign = {
    id: "platform-guard-test",
    name: "Platform guard test",
    status: "approved",
    approvedAt: new Date().toISOString(),
    posts: [{ id: "post-1", copy: "Test post", platform: "Facebook", status: "approved" }],
  };
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));
  const response = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Instagram" }),
  }), env);
  assert(response.status === 400, "a post assigned to Facebook must not be redirected to Instagram");
  const body = await response.json();
  assert(body.error === "The selected platform does not match this post.", "platform mismatch should be explicit");

  campaign.posts[0].platform = "Facebook / Instagram";
  await env.MG_DATA.put("campaign:" + campaign.id, JSON.stringify(campaign));
  const flexiblePost = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Instagram" }),
  }), env);
  assert(flexiblePost.status === 503, "a post assigned to both platforms may use the selected platform; 503 here means only that test credentials are absent");
});


Deno.test("health endpoint identifies rules fallback when AI is not configured", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), makeEnv());
  const body = await response.json();
  assert(body.capabilities.aiCampaigns === false, "AI capability should be false without an API key");
  assert(body.capabilities.campaignGeneration === true, "campaign generation should remain available");
  assert(body.capabilities.campaignEngine === "rules-based-free-v1", "health should identify the rules-based fallback");
});

Deno.test("rules fallback produces campaign output without an AI key", async () => {
  const env = makeEnv();
  const login = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
    body: JSON.stringify({ password: env.APP_LOGIN_PASSWORD }),
  }), env);
  assert(login.status === 200, "owner login should work for the test");
  const { token } = await login.json();
  const response = await worker.fetch(new Request("https://api.example/api/generate", {
    method: "POST",
    headers: { Origin: env.APP_ORIGIN, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test campaign", offer: "A seasonal offer", business: "Local shop", audience: "Nearby customers", goal: "Increase enquiries", platforms: ["Facebook"] }),
  }), env);
  assert(response.status === 200, "campaign generation should fall back when AI is not configured");
  const body = await response.json();
  assert(body.campaign && body.model === "rules-based-free-v1", "response should clearly identify rules-based generation");
  assert(Array.isArray(body.campaign.posts) && body.campaign.posts.length === 3, "fallback should return three posts");
});
