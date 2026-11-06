import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "./worker.js";

const encode = value => new TextEncoder().encode(value);
const b64url = bytes => Buffer.from(bytes).toString("base64url");
async function ownerToken(secret = "test-session-secret", expiryDelta = 3600) {
  const payload = b64url(encode(JSON.stringify({ sub: "owner", exp: Math.floor(Date.now() / 1000) + expiryDelta })));
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

test("campaign generation sends a bounded inventory brief and no assumed business identities", async () => {
  const token = await ownerToken();
  const kv = memoryKV();
  const products = Array.from({ length: 45 }, (_, i) => ({
    name: "N".repeat(150) + i,
    price: "P".repeat(90),
    stock: "S".repeat(70),
    category: "C".repeat(100)
  }));
  const brief = {
    name: "Test campaign",
    offer: "A verified offer",
    audience: "Local customers",
    goal: "Engagement",
    platforms: ["Facebook"],
    business: "Owner's current business",
    inventorySummary: { fileName: "F".repeat(200), rowCount: 45, products }
  };
  const originalFetch = globalThis.fetch;
  let providerPayload;
  globalThis.fetch = async (_url, options) => {
    providerPayload = JSON.parse(options.body);
    const campaign = {
      strategy: "Focused campaign",
      audienceInsight: "Relevant audience",
      channelPlan: [],
      successMetrics: [],
      posts: [1, 2, 3].map(i => ({ title: "Post " + i, copy: "Copy " + i, platform: "Facebook" }))
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(campaign) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/generate", {
      method: "POST",
      headers: {
        Origin: "https://lucasmaxxinfo-sketch.github.io",
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(brief)
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      OPENAI_API_KEY: "test-openai-key",
      MG_DATA: kv
    });
    assert.equal(response.status, 200);
    const submitted = JSON.parse(providerPayload.messages[1].content);
    assert.equal(submitted.inventorySummary.products.length, 30);
    assert.equal(submitted.inventorySummary.fileName.length, 160);
    assert.equal(submitted.inventorySummary.products[0].name.length, 120);
    assert.equal(submitted.inventorySummary.products[0].price.length, 60);
    assert.equal(submitted.inventorySummary.products[0].stock.length, 40);
    assert.equal(submitted.inventorySummary.products[0].category.length, 80);
    assert.equal(submitted.business, "Owner's current business");
    assert.equal(providerPayload.messages[0].content.includes("Retroscore Collectibles"), false);
    assert.equal(providerPayload.messages[0].content.includes("GO!VCR"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("expired owner sessions are rejected", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/auth/session", {
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      Authorization: "Bearer " + await ownerToken("test-session-secret", -60)
    }
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: memoryKV()
  });
  assert.equal(response.status, 401);
});

test("requests from an unapproved browser origin are rejected", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/auth/session", {
    headers: {
      Origin: "https://attacker.example",
      Authorization: "Bearer " + await ownerToken()
    }
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: memoryKV()
  });
  assert.equal(response.status, 403);
});

test("publishing is blocked until the campaign and post have explicit owner approval", async () => {
  const campaign = {
    id: "approval-check",
    status: "draft",
    posts: [{ id: "post-1", copy: "A test post", platform: "Facebook", status: "draft" }]
  };
  const kv = memoryKV({ ["campaign:" + campaign.id]: JSON.stringify(campaign) });
  const response = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      Authorization: "Bearer " + await ownerToken(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" })
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  });
  assert.equal(response.status, 403);
  const stored = JSON.parse(kv.values.get("campaign:" + campaign.id));
  assert.equal(stored.posts[0].status, "draft");
  assert.equal(stored.posts[0].platformPostId, undefined);
});

test("approved publishing without provider credentials stays unpublished", async () => {
  const campaign = {
    id: "provider-check",
    status: "approved",
    approvedAt: new Date().toISOString(),
    posts: [{ id: "post-1", copy: "A test post", platform: "Facebook", status: "approved" }]
  };
  const kv = memoryKV({ ["campaign:" + campaign.id]: JSON.stringify(campaign) });
  const response = await worker.fetch(new Request("https://api.example/api/publish", {
    method: "POST",
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      Authorization: "Bearer " + await ownerToken(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" })
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  });
  assert.equal(response.status, 503);
  const stored = JSON.parse(kv.values.get("campaign:" + campaign.id));
  assert.equal(stored.posts[0].status, "approved");
  assert.equal(stored.posts[0].platformPostId, undefined);
});


test("Kira chat reports provider outages as gateway errors", async () => {
  const originalFetch = globalThis.fetch;
  let sawTimeout = false;
  globalThis.fetch = async (_url, options) => {
    sawTimeout = options.signal instanceof AbortSignal;
    throw new Error("provider unavailable");
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/chat", {
      method: "POST",
      headers: {
        Origin: "https://lucasmaxxinfo-sketch.github.io",
        Authorization: "Bearer " + await ownerToken(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "Prepare a campaign update." })
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      OPENAI_API_KEY: "test-openai-key",
      MG_DATA: memoryKV()
    });
    assert.equal(sawTimeout, true);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /unavailable or timed out/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook provider outage never marks an approved post as published", async () => {
  const campaign = {
    id: "provider-outage",
    status: "approved",
    approvedAt: new Date().toISOString(),
    posts: [{ id: "post-1", copy: "A test post", platform: "Facebook", status: "approved" }]
  };
  const kv = memoryKV({ ["campaign:" + campaign.id]: JSON.stringify(campaign) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Meta unavailable"); };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/publish", {
      method: "POST",
      headers: {
        Origin: "https://lucasmaxxinfo-sketch.github.io",
        Authorization: "Bearer " + await ownerToken(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ campaignId: campaign.id, postId: "post-1", platform: "Facebook" })
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      META_PAGE_ID: "test-page",
      META_PAGE_ACCESS_TOKEN: "test-meta-token",
      MG_DATA: kv
    });
    assert.equal(response.status, 502);
    const stored = JSON.parse(kv.values.get("campaign:" + campaign.id));
    assert.equal(stored.posts[0].status, "approved");
    assert.equal(stored.posts[0].platformPostId, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
