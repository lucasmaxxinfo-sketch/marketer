import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteKV, createLocalService, isDailyResearchDue, shouldAttemptDailyResearch } from "./server.mjs";
import { backupDatabase } from "./backup.mjs";

test("SQLite KV preserves string and JSON values, TTL and paginated prefix listing", async () => {
  const kv = new SQLiteKV();
  try {
    await kv.put("campaign:a", JSON.stringify({ id: "a" }));
    await kv.put("campaign:b", JSON.stringify({ id: "b" }));
    await kv.put("other", "keep");
    await kv.put("special:100%", "literal-percent");
    await kv.put("special:100x", "wildcard-neighbour");
    await kv.put("special:_x", "literal-underscore");
    await kv.put("special:ax", "underscore-neighbour");
    await kv.put("temporary", "gone", { expirationTtl: 1 });
    assert.deepEqual(await kv.get("campaign:a", "json"), { id: "a" });
    assert.equal(await kv.get("other"), "keep");
    const first = await kv.list({ prefix: "campaign:", limit: 1 });
    assert.equal(first.keys.length, 1);
    assert.equal(first.list_complete, false);
    const second = await kv.list({ prefix: "campaign:", limit: 1, cursor: first.cursor });
    assert.equal(second.keys.length, 1);
    assert.equal(second.list_complete, true);
    const percent = await kv.list({ prefix: "special:100%" });
    assert.deepEqual(percent.keys.map(item => item.name), ["special:100%"]);
    const underscore = await kv.list({ prefix: "special:_x" });
    assert.deepEqual(underscore.keys.map(item => item.name), ["special:_x"]);
    await kv.delete("campaign:a");
    assert.equal(await kv.get("campaign:a"), null);
  } finally { kv.close(); }
});

test("local HTTP service reuses the existing owner login and health API", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-local-"));
  const service = createLocalService({
    database: join(dir, "test.sqlite"),
    env: {
      APP_ORIGIN: "http://localhost:4173",
      APP_LOGIN_PASSWORD: "test-owner-password",
      SESSION_SECRET: "test-session-secret-with-adequate-length",
      PORT: "0"
    },
    logger: { info() {}, error() {} }
  });
  try {
    const address = await service.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test-owner-password" })
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.ok(token);
    const authHeaders = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    const profile = await fetch(base + "/api/profile", { headers: authHeaders });
    assert.equal(profile.status, 200);
    const saved = await fetch(base + "/api/profile", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        business: "Test Workshop",
        location: "Christchurch",
        audience: "Local customers",
        platforms: ["Facebook"],
        researchMonitoringEnabled: true
      })
    });
    assert.equal(saved.status, 200);
    const stored = await fetch(base + "/api/profile", { headers: authHeaders });
    assert.equal((await stored.json()).profile.researchMonitoringEnabled, true);
    const operationalHealth = await fetch(base + "/health");
    const runtime = (await operationalHealth.json()).localRuntime;
    assert.equal(runtime.researchMonitoringEnabled, true);
    assert.equal(runtime.researchScheduleUtc, "14:00");
    assert.equal(JSON.stringify(runtime).includes("Test Workshop"), false);
  } finally {
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("SQLite backup produces a readable, integrity-checked copy", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-backup-"));
  const source = join(dir, "source.sqlite");
  const destination = join(dir, "backup", "copy.sqlite");
  const kv = new SQLiteKV(source);
  try { await kv.put("campaign:backup-check", JSON.stringify({ id: "backup-check" })); }
  finally { kv.close(); }
  try {
    assert.equal(backupDatabase(source, destination), destination);
    const restored = new SQLiteKV(destination);
    try { assert.deepEqual(await restored.get("campaign:backup-check", "json"), { id: "backup-check" }); }
    finally { restored.close(); }
    assert.throws(() => backupDatabase(source, destination), /already exists/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("daily research scheduler catches up after its configured UTC minute and runs once per day", () => {
  const before = new Date("2026-11-07T13:59:59.000Z");
  const at = new Date("2026-11-07T14:00:00.000Z");
  const after = new Date("2026-11-07T18:42:00.000Z");
  assert.equal(isDailyResearchDue(before, "14:00", ""), false);
  assert.equal(isDailyResearchDue(at, "14:00", ""), true);
  assert.equal(isDailyResearchDue(after, "14:00", ""), true);
  assert.equal(isDailyResearchDue(after, "14:00", "2026-11-07"), false);
  assert.equal(isDailyResearchDue(new Date("2026-11-08T00:01:00.000Z"), "14:00", "2026-11-07"), false);
});


test("local HTTP adapter forwards secure cross-origin and private-network preflight headers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-local-cors-"));
  const appOrigin = "https://lucasmaxxinfo-sketch.github.io";
  const service = createLocalService({
    database: join(dir, "test.sqlite"),
    env: {
      APP_ORIGIN: appOrigin,
      APP_ADDITIONAL_ORIGINS: "https://localhost",
      APP_LOGIN_PASSWORD: "test-owner-password",
      SESSION_SECRET: "test-session-secret-with-adequate-length",
      PORT: "0"
    },
    logger: { info() {}, error() {} }
  });
  try {
    const address = await service.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${address.port}`;
    const preflight = await fetch(base + "/api/auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: appOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Private-Network": "true"
      }
    });
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), appOrigin);
    assert.equal(preflight.headers.get("Access-Control-Allow-Private-Network"), "true");

    const health = await fetch(base + "/health", { headers: { Origin: appOrigin } });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("Access-Control-Allow-Origin"), appOrigin);

    const androidHealth = await fetch(base + "/health", { headers: { Origin: "https://localhost" } });
    assert.equal(androidHealth.status, 200);
    assert.equal(androidHealth.headers.get("Access-Control-Allow-Origin"), "https://localhost");

    const androidPreflight = await fetch(base + "/api/auth/login", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }
    });
    assert.equal(androidPreflight.status, 200);
    assert.equal(androidPreflight.headers.get("Access-Control-Allow-Origin"), "https://localhost");

    const blocked = await fetch(base + "/health", {
      headers: { Origin: "https://attacker.example" }
    });
    assert.equal(blocked.status, 403);
  } finally {
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("daily research scheduler retries transient failures with a bounded backoff", () => {
  const now = new Date("2026-11-07T18:00:00.000Z");
  assert.equal(shouldAttemptDailyResearch(now, null), true);
  assert.equal(shouldAttemptDailyResearch(now, { status: "completed", attempts: 1 }), false);
  assert.equal(shouldAttemptDailyResearch(now, { status: "skipped", attempts: 1 }), false);
  assert.equal(shouldAttemptDailyResearch(now, { status: "running", attempts: 1, attemptedAt: "2026-11-07T17:45:00.000Z" }), false);
  assert.equal(shouldAttemptDailyResearch(now, { status: "running", attempts: 1, attemptedAt: "2026-11-07T17:00:00.000Z" }), true);
  assert.equal(shouldAttemptDailyResearch(now, { status: "failed", attempts: 1, attemptedAt: "2026-11-07T17:00:00.000Z" }), false);
  assert.equal(shouldAttemptDailyResearch(now, { status: "failed", attempts: 1, attemptedAt: "2026-11-07T15:59:59.000Z" }), true);
  assert.equal(shouldAttemptDailyResearch(now, { status: "failed", attempts: 3, attemptedAt: "2026-11-07T12:00:00.000Z" }), false);
});


test("local health reports daily research configuration and today's run state without business data", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-local-runtime-health-"));
  const service = createLocalService({
    database: join(dir, "health.sqlite"),
    env: {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      APP_LOGIN_PASSWORD: "test-owner-password",
      SESSION_SECRET: "test-session-secret-with-adequate-length",
      RESEARCH_CRON_UTC: "03:30",
      PORT: "0"
    },
    logger: { info() {}, error() {} }
  });
  try {
    await service.kv.put("owner:profile", JSON.stringify({
      business: "Private Business Name",
      researchMonitoringEnabled: true
    }));
    const address = await service.listen(0, "127.0.0.1");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { Origin: "https://lucasmaxxinfo-sketch.github.io" }
    });
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.deepEqual(health.localRuntime, {
      type: "self-hosted",
      researchScheduleUtc: "03:30",
      researchMonitoringEnabled: true,
      todayResearchStatus: "waiting",
      todayResearchAttempts: 0
    });
    assert.equal(JSON.stringify(health).includes("Private Business Name"), false);
  } finally {
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("scheduled Kira research creates one evidence-backed owner-review operation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-local-scheduled-research-"));
  const originalFetch = globalThis.fetch;
  const service = createLocalService({
    database: join(dir, "scheduled.sqlite"),
    env: {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      APP_LOGIN_PASSWORD: "test-owner-password",
      SESSION_SECRET: "test-session-secret-with-adequate-length",
      RESEARCH_CRON_UTC: "00:00",
      AI_PROVIDER: "ollama",
      RESEARCH_PROVIDER: "searxng",
      SEARXNG_BASE_URL: "http://search.test",
      OLLAMA_BASE_URL: "http://ollama.test/v1/chat/completions",
      LOCAL_AI_MODEL: "qwen3:4b"
    },
    logger: { info() {}, error() {} }
  });
  try {
    await service.kv.put("owner:profile", JSON.stringify({
      business: "Example Workshop",
      businessDescription: "A local repair and restoration workshop",
      location: "Christchurch",
      audience: "Local vehicle owners",
      platforms: ["Facebook", "Instagram"],
      researchMonitoringEnabled: true
    }));
    const requests = [];
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(String(input));
      requests.push(url.origin + url.pathname);
      if (url.origin === "http://search.test") {
        return new Response(JSON.stringify({
          results: [{
            title: "Automotive maintenance trend",
            url: "https://research.example.org/maintenance",
            content: "A current public source describing maintenance demand.",
            publishedDate: "2026-11-06",
            engine: "test"
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.origin === "http://ollama.test") {
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Research snapshot: one relevant signal. The source supports a possible maintenance education campaign, not a specific demand increase. [S1] Recommended next move: validate customer questions before creating an offer." } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error("Unexpected outbound request: " + url.origin);
    };

    await service.runScheduledResearch();

    const day = new Date().toISOString().slice(0, 10);
    const marker = await service.kv.get("local-cron-fired:" + day, "json");
    assert.equal(marker.status, "completed");
    assert.equal(marker.attempts, 1);
    assert.ok(marker.operationId);

    const scan = await service.kv.get("autonomous-scan:" + day, "json");
    assert.equal(scan.status, "completed");
    assert.equal(scan.operationId, marker.operationId);

    const operation = await service.kv.get("operation:" + marker.operationId, "json");
    assert.equal(operation.type, "opportunity_assessment");
    assert.equal(operation.status, "awaiting_owner");
    assert.equal(operation.source.kind, "kira");
    assert.match(operation.result, /Research snapshot/);
    assert.deepEqual(operation.evidence.map(item => item.url), ["https://research.example.org/maintenance"]);
    assert.deepEqual(requests, ["http://search.test/search", "http://ollama.test/v1/chat/completions"]);

    await service.runScheduledResearch();
    const operations = await service.kv.list({ prefix: "operation:" });
    assert.equal(operations.keys.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scheduled Kira research records blocked work and a failed scheduler marker when search is unavailable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-local-scheduled-failure-"));
  const originalFetch = globalThis.fetch;
  const service = createLocalService({
    database: join(dir, "scheduled-failure.sqlite"),
    env: {
      RESEARCH_CRON_UTC: "00:00",
      AI_PROVIDER: "ollama",
      RESEARCH_PROVIDER: "searxng",
      SEARXNG_BASE_URL: "http://search.test",
      OLLAMA_BASE_URL: "http://ollama.test/v1/chat/completions",
      LOCAL_AI_MODEL: "qwen3:4b"
    },
    logger: { info() {}, error() {} }
  });
  try {
    await service.kv.put("owner:profile", JSON.stringify({
      business: "Example Workshop",
      researchMonitoringEnabled: true
    }));
    globalThis.fetch = async () => new Response("search unavailable", { status: 503 });
    await service.runScheduledResearch();

    const day = new Date().toISOString().slice(0, 10);
    const marker = await service.kv.get("local-cron-fired:" + day, "json");
    assert.equal(marker.status, "failed");
    assert.equal(marker.attempts, 1);
    assert.ok(marker.operationId);
    const operation = await service.kv.get("operation:" + marker.operationId, "json");
    assert.equal(operation.type, "opportunity_assessment");
    assert.equal(operation.status, "blocked");
    assert.match(operation.blocker, /search service returned an error/i);
  } finally {
    globalThis.fetch = originalFetch;
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
