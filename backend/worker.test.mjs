import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "./worker.js";

const encode = value => new TextEncoder().encode(value);
const b64url = bytes => Buffer.from(bytes).toString("base64url");
async function ownerToken(secret = "test-session-secret") {
  const payload = b64url(encode(JSON.stringify({ sub: "owner", exp: Math.floor(Date.now() / 1000) + 3600 })));
  const key = await webcrypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await webcrypto.subtle.sign("HMAC", key, encode(payload));
  return payload + "." + b64url(signature);
}
function memoryKV(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const names = [...values.keys()].filter(name => name.startsWith(prefix)).sort();
      const offset = Number(cursor || 0);
      const page = names.slice(offset, offset + limit);
      const next = offset + page.length;
      return {
        keys: page.map(name => ({ name })),
        list_complete: next >= names.length,
        cursor: next >= names.length ? undefined : String(next)
      };
    }
  };
}
async function request(path, { token, method = "GET", origin = "https://lucasmaxxinfo-sketch.github.io" } = {}) {
  const headers = { Origin: origin };
  if (token) headers.Authorization = "Bearer " + token;
  return worker.fetch(new Request("https://api.example" + path, { method, headers }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: memoryKV()
  });
}

test("campaign deletion requires a valid owner session", async () => {
  const kv = memoryKV({ "campaign:keep": JSON.stringify({ id: "keep" }) });
  const response = await worker.fetch(new Request("https://api.example/api/campaigns", {
    method: "DELETE",
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io" }
  }), { APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io", SESSION_SECRET: "test-session-secret", MG_DATA: kv });
  assert.equal(response.status, 401);
  assert.equal(kv.values.has("campaign:keep"), true);
});

test("campaign export lists every page of cloud records", async () => {
  const seed = {};
  for (let i = 0; i < 1005; i++) seed["campaign:" + String(i).padStart(4, "0")] = JSON.stringify({ id: i });
  seed["login-attempt:127.0.0.1"] = "2";
  const kv = memoryKV(seed);
  const response = await worker.fetch(new Request("https://api.example/api/campaigns", {
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + await ownerToken() }
  }), { APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io", SESSION_SECRET: "test-session-secret", MG_DATA: kv });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.campaigns.length, 1005);
});

test("bulk deletion removes all campaign pages but preserves non-campaign KV records", async () => {
  const seed = {};
  for (let i = 0; i < 1005; i++) seed["campaign:" + String(i).padStart(4, "0")] = JSON.stringify({ id: i });
  seed["login-attempt:127.0.0.1"] = "2";
  const kv = memoryKV(seed);
  const response = await worker.fetch(new Request("https://api.example/api/campaigns", {
    method: "DELETE",
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + await ownerToken() }
  }), { APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io", SESSION_SECRET: "test-session-secret", MG_DATA: kv });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 1005 });
  assert.equal([...kv.values.keys()].some(key => key.startsWith("campaign:")), false);
  assert.equal(kv.values.get("login-attempt:127.0.0.1"), "2");
});
