import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteKV, createLocalService } from "./server.mjs";

test("SQLite KV preserves string and JSON values, TTL and paginated prefix listing", async () => {
  const kv = new SQLiteKV();
  try {
    await kv.put("campaign:a", JSON.stringify({ id: "a" }));
    await kv.put("campaign:b", JSON.stringify({ id: "b" }));
    await kv.put("other", "keep");
    await kv.put("temporary", "gone", { expirationTtl: 1 });
    assert.deepEqual(await kv.get("campaign:a", "json"), { id: "a" });
    assert.equal(await kv.get("other"), "keep");
    const first = await kv.list({ prefix: "campaign:", limit: 1 });
    assert.equal(first.keys.length, 1);
    assert.equal(first.list_complete, false);
    const second = await kv.list({ prefix: "campaign:", limit: 1, cursor: first.cursor });
    assert.equal(second.keys.length, 1);
    assert.equal(second.list_complete, true);
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
