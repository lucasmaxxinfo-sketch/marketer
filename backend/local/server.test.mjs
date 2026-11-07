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
    const profile = await fetch(base + "/api/profile", { headers: { Authorization: "Bearer " + token } });
    assert.equal(profile.status, 200);
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
