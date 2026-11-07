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



test("explicit additional app origins are allowed without opening CORS to arbitrary sites", async () => {
  const kv = memoryKV();
  const env = {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    APP_ADDITIONAL_ORIGINS: "https://localhost, capacitor://localhost",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  };
  const android = await worker.fetch(new Request("https://api.example/health", {
    headers: { Origin: "https://localhost" }
  }), env);
  assert.equal(android.status, 200);
  assert.equal(android.headers.get("Access-Control-Allow-Origin"), "https://localhost");

  const preflight = await worker.fetch(new Request("https://api.example/api/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "https://localhost",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  }), env);
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://localhost");

  const attacker = await worker.fetch(new Request("https://api.example/health", {
    headers: { Origin: "https://attacker.example" }
  }), env);
  assert.equal(attacker.status, 403);
});

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
  assert.deepEqual(await response.json(), { ok: true, businessId: "legacy-default", deleted: 1005 });
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
    assert.match(providerPayload.messages[0].content,/research report or source URLs/);
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

test("local workspace preflight permits browser private-network access only from the configured origin", async () => {
  const response = await worker.fetch(new Request("https://api.example/health", {
    method: "OPTIONS",
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true"
    }
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    MG_DATA: memoryKV()
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Private-Network"), "true");
  const blocked = await worker.fetch(new Request("https://api.example/health", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example", "Access-Control-Request-Private-Network": "true" }
  }), { APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io", MG_DATA: memoryKV() });
  assert.equal(blocked.status, 403);
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


test("owner can create and advance an operation with an auditable status history", async () => {
  const kv=memoryKV();
  const token=await ownerToken();
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const created=await worker.fetch(new Request("https://api.example/api/operations",{method:"POST",headers,body:JSON.stringify({type:"research",title:"Check seasonal campaign signals",summary:"Gather dated evidence before recommending a campaign.",priority:"high",source:{kind:"owner",label:"Owner request"}})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(created.status,201);
  const operation=(await created.json()).operation;
  assert.equal(operation.status,"queued");
  const forbidden=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"completed"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(forbidden.status,409);
  const started=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",note:"Research started"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(started.status,200);
  const updated=(await started.json()).operation;
  assert.equal(updated.history.length,2);
  assert.equal(updated.history[1].note,"Research started");
  const awaiting=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"awaiting_owner",note:"Report ready",result:"Two grounded opportunities.",evidence:[{label:"Research source",url:"https://example.com/source",observedAt:"2026-11-06T10:00:00.000Z",note:"Current evidence."},{label:"Unsafe source",url:"http://example.com/unsafe"}]})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(awaiting.status,200);
  const finalOperation=(await awaiting.json()).operation;
  assert.equal(finalOperation.status,"awaiting_owner");
  assert.equal(finalOperation.evidence.length,1);
  assert.equal(finalOperation.evidence[0].url,"https://example.com/source");
  const listed=await worker.fetch(new Request("https://api.example/api/operations",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal((await listed.json()).operations.length,1);
});


test("operation history attributes Kira and owner transitions accurately", async () => {
  const kv=memoryKV(),token=await ownerToken();
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const options={APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv};
  const created=await worker.fetch(new Request("https://api.example/api/operations",{method:"POST",headers,body:JSON.stringify({type:"campaign_preparation",title:"Prepare owner review draft",summary:"Create a draft and record its work history.",source:{kind:"kira",label:"Kira next move"}})}),options);
  assert.equal(created.status,201);
  const operation=(await created.json()).operation;
  assert.equal(operation.history[0].by,"kira");
  const started=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",by:"kira",note:"Kira started the draft."})}),options);
  assert.equal(started.status,200);
  const waiting=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"awaiting_owner",by:"owner",note:"Owner review requested."})}),options);
  assert.equal(waiting.status,200);
  const record=(await waiting.json()).operation;
  assert.deepEqual(record.history.map(event=>event.by),["kira","kira","owner"]);
  assert.deepEqual(record.history.map(event=>event.status),["queued","in_progress","awaiting_owner"]);
  const invalidActor=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",by:"system",note:"Owner resumed the item."})}),options);
  assert.equal(invalidActor.status,200);
  const normalized=(await invalidActor.json()).operation;
  assert.equal(normalized.history.at(-1).by,"owner");
});


test("blocked research can be resumed through a real state transition and clears its blocker", async () => {
  const kv=memoryKV(),token=await ownerToken();
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const options={APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv};
  const created=await worker.fetch(new Request("https://api.example/api/operations",{method:"POST",headers,body:JSON.stringify({type:"opportunity_assessment",title:"Research local opportunities",summary:"Find current customer and category signals.",source:{kind:"kira",label:"Live web research"}})}),options);
  const operation=(await created.json()).operation;
  const started=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",by:"kira",note:"Research started."})}),options);
  assert.equal(started.status,200);
  const blocked=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"blocked",by:"kira",note:"Research stopped.",blocker:"Provider timed out."})}),options);
  assert.equal(blocked.status,200);
  const queued=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"queued",by:"owner",note:"Owner requested a retry."})}),options);
  assert.equal(queued.status,200);
  assert.equal((await queued.json()).operation.blocker,"");
  const resumed=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",by:"kira",note:"Kira resumed research."})}),options);
  assert.equal(resumed.status,200);
  const record=(await resumed.json()).operation;
  assert.equal(record.status,"in_progress");
  assert.deepEqual(record.history.map(event=>event.status),["queued","in_progress","blocked","queued","in_progress"]);
  const duplicate=await worker.fetch(new Request("https://api.example/api/operations/"+operation.id,{method:"PATCH",headers,body:JSON.stringify({status:"in_progress",by:"kira",note:"Duplicate retry."})}),options);
  assert.equal(duplicate.status,409);
});

test("live opportunity research requires web search and returns cited source metadata", async () => {
  const token=await ownerToken(),kv=memoryKV(),originalFetch=globalThis.fetch;
  let providerRequest;
  globalThis.fetch=async(url,options)=>{providerRequest={url,body:JSON.parse(options.body)};return new Response(JSON.stringify({output:[
    {type:"web_search_call",status:"completed",action:{sources:[{title:"Current retail report",url:"https://example.com/retail-report"}]}},
    {type:"message",content:[{type:"output_text",text:"Research snapshot: current category signals suggest an opportunity.",annotations:[{type:"url_citation",url_citation:{title:"Current retail report",url:"https://example.com/retail-report"}}]}]}
  ]}),{status:200,headers:{"Content-Type":"application/json"}})};
  try{
    const response=await worker.fetch(new Request("https://api.example/api/research",{method:"POST",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({business:"Owner's current business",location:"Christchurch, New Zealand",audience:"Local customers"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:kv});
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.searchUsed,true);assert.match(result.report,/Research snapshot/);assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,"https://example.com/retail-report");assert.equal(providerRequest.url,"https://api.openai.com/v1/responses");assert.equal(providerRequest.body.tools[0].type,"web_search");assert.equal(providerRequest.body.tool_choice,"required");assert.match(providerRequest.body.input,/Christchurch, New Zealand/);
  }finally{globalThis.fetch=originalFetch;}
});

test("live opportunity research refuses empty provider output", async () => {
  const token=await ownerToken(),originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({output:[]}),{status:200});
  try{const response=await worker.fetch(new Request("https://api.example/api/research",{method:"POST",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({business:"Test business"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:memoryKV()});assert.equal(response.status,502);}finally{globalThis.fetch=originalFetch;}
});


test("bulk operation deletion removes every operation but preserves campaigns and login records", async () => {
  const seed={};
  for(let i=0;i<1005;i++)seed["operation:"+String(i).padStart(4,"0")]=JSON.stringify({id:i});
  seed["campaign:keep"]=JSON.stringify({id:"keep"});seed["login-attempt:127.0.0.1"]="2";
  const kv=memoryKV(seed);
  const response=await worker.fetch(new Request("https://api.example/api/operations",{method:"DELETE",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+await ownerToken()}}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,businessId:"legacy-default",deleted:1005});
  assert.equal([...kv.values.keys()].some(k=>k.startsWith("operation:")),false);
  assert.equal(kv.values.has("campaign:keep"),true);assert.equal(kv.values.get("login-attempt:127.0.0.1"),"2");
});


test("owner cloud profile stores bounded business context and monitoring preference", async () => {
  const kv = memoryKV();
  const token = await ownerToken();
  const response = await worker.fetch(new Request("https://api.example/api/profile", {
    method: "PUT",
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      business: "Test Studio",
      businessDescription: "D".repeat(3000),
      location: "Christchurch",
      audience: "Local customers",
      platforms: ["Facebook", "Instagram"],
      brandVoice: "Warm",
      researchMonitoringEnabled: true,
      inventorySummary: { fileName: "stock.csv", products: Array.from({ length: 40 }, (_, i) => ({ name: "Product " + i })) }
    })
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profile.business, "Test Studio");
  assert.equal(body.profile.businessDescription.length, 2000);
  assert.equal(body.profile.researchMonitoringEnabled, true);
  assert.equal(body.profile.inventorySummary.products.length, 30);
  assert.equal((await kv.get("owner:profile", "json")).location, "Christchurch");
});

test("business profiles migrate the legacy profile and support isolated create, update and delete", async () => {
  const kv=memoryKV({"owner:profile":JSON.stringify({business:"Retroscore",businessDescription:"Private internal context",location:"Christchurch",audience:"Collectors",platforms:["Trade Me"],brandVoice:"Knowledgeable"})});
  const token=await ownerToken();
  const send=async(path,method="GET",body)=>{
    const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token};
    if(body)headers["Content-Type"]="application/json";
    return worker.fetch(new Request("https://api.example"+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  };
  const migrated=await send("/api/businesses");
  assert.equal(migrated.status,200);
  const first=(await migrated.json()).businesses;
  assert.equal(first.length,1);
  assert.equal(first[0].id,"legacy-default");
  assert.equal(first[0].business,"Retroscore");
  assert.equal((await kv.get("business-profile:legacy-default","json")).businessDescription,"Private internal context");

  const created=await send("/api/businesses","POST",{business:"Second Studio",businessDescription:"Separate context",location:"Wellington",platforms:["Instagram"]});
  assert.equal(created.status,201);
  const second=(await created.json()).business;
  assert.notEqual(second.id,first[0].id);
  const listed=(await (await send("/api/businesses")).json()).businesses;
  assert.deepEqual(listed.map(x=>x.business).sort(),["Retroscore","Second Studio"]);

  const updated=await send("/api/businesses/"+second.id,"PATCH",{business:"Second Brand",audience:"Different customers"});
  assert.equal(updated.status,200);
  assert.equal((await updated.json()).business.business,"Second Brand");
  assert.equal((await kv.get("business-profile:"+second.id,"json")).audience,"Different customers");

  await kv.put("campaign:owned",JSON.stringify({id:"owned",businessId:second.id,name:"Saved work",offer:"Offer"}));
  const blockedByCampaign=await send("/api/businesses/"+second.id,"DELETE");
  assert.equal(blockedByCampaign.status,409);
  await kv.delete("campaign:owned");
  await kv.put("operation:owned",JSON.stringify({id:"owned",businessId:second.id,type:"research",title:"Research",summary:"Summary"}));
  const blockedByOperation=await send("/api/businesses/"+second.id,"DELETE");
  assert.equal(blockedByOperation.status,409);
  await kv.delete("operation:owned");
  const removed=await send("/api/businesses/"+second.id,"DELETE");
  assert.equal(removed.status,200);
  assert.deepEqual((await (await send("/api/businesses")).json()).businesses.map(x=>x.business),["Retroscore"]);
  const lastDelete=await send("/api/businesses/legacy-default","DELETE");
  assert.equal(lastDelete.status,409);
});

test("business profile management requires an owner session", async () => {
  const response=await worker.fetch(new Request("https://api.example/api/businesses",{headers:{Origin:"https://lucasmaxxinfo-sketch.github.io"}}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:memoryKV()});
  assert.equal(response.status,401);
});

test("scheduled Kira research creates one owner-review operation when monitoring is enabled", async () => {
  const kv = memoryKV({
    "owner:profile": JSON.stringify({
      business: "Test Studio",
      businessDescription: "A local creative studio",
      location: "Christchurch",
      audience: "Local customers",
      platforms: ["Facebook"],
      researchMonitoringEnabled: true
    })
  });
  const originalFetch = globalThis.fetch;
  let scheduledPromise;
  let providerCalls = 0;
  globalThis.fetch = async (url, options) => {
    providerCalls++;
    if(!String(url).includes("/v1/responses"))return new Response(JSON.stringify({choices:[{message:{content:"{}"}}]}),{status:200,headers:{"Content-Type":"application/json"}});
    const payload = JSON.parse(options.body);
    assert.equal(payload.tools[0].type, "web_search");
    return new Response(JSON.stringify({
      output: [
        { type: "web_search_call", action: { sources: [{ title: "Current source", url: "https://example.com/research" }] } },
        { type: "message", content: [{ type: "output_text", text: "A source-backed opportunity report." }] }
      ]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    worker.scheduled({}, { MG_DATA: kv, OPENAI_API_KEY: "test-openai-key" }, {
      waitUntil(promise) { scheduledPromise = promise; }
    });
    await scheduledPromise;
    const operations = [...kv.values.entries()].filter(([key]) => key.startsWith("operation:")).map(([, value]) => JSON.parse(value));
    assert.equal(providerCalls, 2);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].status, "awaiting_owner");
    assert.equal(operations[0].evidence[0].url, "https://example.com/research");
    assert.equal(operations[0].history.at(-1).by, "kira");
    const day = new Date().toISOString().slice(0, 10);
    assert.equal((await kv.get("autonomous-scan:" + day, "json")).status, "completed");
    let duplicatePromise;
    worker.scheduled({}, { MG_DATA: kv, OPENAI_API_KEY: "test-openai-key" }, {
      waitUntil(promise) { duplicatePromise = promise; }
    });
    await duplicatePromise;
    assert.equal(providerCalls, 2);
    assert.equal([...kv.values.keys()].filter(key => key.startsWith("operation:")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled Kira research does nothing unless the owner enables monitoring", async () => {
  const kv = memoryKV({
    "owner:profile": JSON.stringify({ business: "Test Studio", researchMonitoringEnabled: false })
  });
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("Should not call provider"); };
  try {
    let scheduledPromise;
    worker.scheduled({}, { MG_DATA: kv, OPENAI_API_KEY: "test-openai-key" }, {
      waitUntil(promise) { scheduledPromise = promise; }
    });
    await scheduledPromise;
    assert.equal(providerCalls, 0);
    assert.equal([...kv.values.keys()].some(key => key.startsWith("operation:")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});



test("Kira chat can run through local Ollama without an OpenAI API key", async () => {
  const originalTimeout = AbortSignal.timeout;
  let timeoutMs = 0;
  AbortSignal.timeout = milliseconds => { timeoutMs = milliseconds; return originalTimeout(milliseconds); };
  const token = await ownerToken();
  const originalFetch = globalThis.fetch;
  let providerUrl, providerHeaders, providerPayload;
  globalThis.fetch = async (url, options) => {
    providerUrl = String(url);
    providerHeaders = new Headers(options.headers);
    providerPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Kira is running locally." } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/chat", {
      method: "POST",
      headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Give me the next marketing priority." })
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1/chat/completions",
      LOCAL_AI_MODEL: "qwen3:4b",
      MG_DATA: memoryKV()
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, "Kira is running locally.");
    assert.equal(providerUrl, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(providerHeaders.has("Authorization"), false);
    assert.equal(providerPayload.model, "qwen3:4b");
    assert.equal(timeoutMs, 120000);
    const health = await worker.fetch(new Request("https://api.example/health"), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1/chat/completions",
      LOCAL_AI_MODEL: "qwen3:4b",
      MG_DATA: memoryKV()
    });
    const capabilities = (await health.json()).capabilities;
    assert.equal(capabilities.aiCampaigns, true);
    assert.equal(capabilities.liveResearch, false);
  } finally { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; }
});

test("core health remains available when optional hosted AI credentials are absent", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    APP_LOGIN_PASSWORD: "test-owner-password",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: memoryKV()
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.capabilities.storage, true);
  assert.equal(body.capabilities.ownerLogin, true);
  assert.equal(body.capabilities.aiCampaigns, false);
  assert.equal(body.capabilities.liveResearch, false);
  assert.equal(body.capabilities.scheduledResearch, false);
});

test("campaign generation can use the local Ollama provider without hosted AI credentials", async () => {
  const token = await ownerToken();
  const originalFetch = globalThis.fetch;
  let payload, headers;
  globalThis.fetch = async (_url, options) => {
    headers = new Headers(options.headers);
    payload = JSON.parse(options.body);
    const campaign = {
      strategy: "A focused local campaign",
      audienceInsight: "A relevant local audience",
      channelPlan: [],
      successMetrics: ["Qualified enquiries"],
      posts: [1, 2, 3].map(i => ({ title: "Post " + i, copy: "Grounded campaign copy " + i, platform: "Facebook" }))
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(campaign) } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/generate", {
      method: "POST",
      headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Local test", offer: "A real product", platforms: ["Facebook"] })
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1/chat/completions",
      LOCAL_AI_MODEL: "qwen3:4b",
      MG_DATA: memoryKV()
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).campaign.posts.length, 3);
    assert.equal(headers.has("Authorization"), false);
    assert.equal(payload.model, "qwen3:4b");
  } finally { globalThis.fetch = originalFetch; }
});


test("local SearXNG research uses local Ollama and saves only source-backed HTTPS results", async () => {
  const token = await ownerToken();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), headers: new Headers(options.headers), body: options.body ? JSON.parse(options.body) : null });
    if (String(url).includes("/search?")) {
      return new Response(JSON.stringify({ results: [
        { title: "Local business trend report", url: "https://example.com/trends", content: "The report describes a current category trend.", publishedDate: "2026-11-05", engine: "test" },
        { title: "Unsafe source", url: "http://example.com/unsafe", content: "Not HTTPS." }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Research snapshot: one supported signal [S1].\n\nRecommended next move: validate the audience fit." } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/api/research", {
      method: "POST",
      headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ business: "Test Studio", location: "Christchurch", audience: "Local customers" })
    }), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      SESSION_SECRET: "test-session-secret",
      AI_PROVIDER: "ollama",
      LOCAL_AI_MODEL: "qwen3:4b",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1/chat/completions",
      RESEARCH_PROVIDER: "searxng",
      SEARXNG_BASE_URL: "http://127.0.0.1:8080",
      MG_DATA: memoryKV()
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.searchProvider, "searxng");
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].url, "https://example.com/trends");
    assert.match(result.report, /\[S1\]/);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /format=json/);
    assert.equal(calls[1].body.model, "qwen3:4b");
    assert.equal(calls[1].headers.has("Authorization"), false);
  } finally { globalThis.fetch = originalFetch; }
});


test("researched opportunity hands off to an evidence-linked draft that still requires owner approval", async () => {
  const token = await ownerToken();
  const kv = memoryKV();
  const originalFetch = globalThis.fetch;
  const headers = {
    Origin: "https://lucasmaxxinfo-sketch.github.io",
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
  const env = {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    AI_PROVIDER: "ollama",
    LOCAL_AI_MODEL: "qwen3:4b",
    OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1/chat/completions",
    MG_DATA: kv
  };
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "qwen3:4b");
    assert.match(payload.messages[1].content, /Research snapshot: a relevant maintenance education opportunity/);
    assert.match(payload.messages[1].content, /https:\/\/research\.example\.org\/maintenance/);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            strategy: "Use a useful maintenance education angle grounded in the supplied research.",
            audienceInsight: "Customers need clear, practical guidance.",
            channelPlan: [{ platform: "Facebook", role: "Education", voice: "Helpful", reason: "Local community relevance", priority: 1 }],
            successMetrics: ["Meaningful enquiries"],
            posts: [
              { title: "Maintenance basics", platform: "Facebook", objective: "Educate", copy: "A practical maintenance tip.", visualBrief: "One clear workshop image.", cta: "Ask us a question", recommendedDay: "Monday" },
              { title: "Common questions", platform: "Facebook", objective: "Build trust", copy: "Answers to common maintenance questions.", visualBrief: "A simple question-led graphic.", cta: "Send your question", recommendedDay: "Wednesday" },
              { title: "Talk to the workshop", platform: "Facebook", objective: "Invite enquiries", copy: "Need help understanding your vehicle's maintenance?", visualBrief: "A real workshop detail.", cta: "Contact the workshop", recommendedDay: "Friday" }
            ]
          })
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const createResearch = await worker.fetch(new Request("https://api.example/api/operations", {
      method: "POST", headers,
      body: JSON.stringify({
        type: "opportunity_assessment",
        title: "Kira daily opportunity scan",
        summary: "Review current maintenance education signals.",
        source: { kind: "kira", label: "Scheduled daily research" }
      })
    }), env);
    assert.equal(createResearch.status, 201);
    let research = (await createResearch.json()).operation;
    const evidence = [{
      label: "Maintenance research",
      url: "https://research.example.org/maintenance",
      observedAt: "2026-11-07T00:00:00.000Z",
      note: "Public source returned by SearXNG."
    }];
    for (const update of [
      { status: "in_progress", by: "kira", note: "Kira searched current sources." },
      { status: "awaiting_owner", by: "kira", note: "Evidence is ready for review.", result: "Research snapshot: a relevant maintenance education opportunity. The source supports education, not a discount or demand statistic. [S1]", evidence }
    ]) {
      const response = await worker.fetch(new Request("https://api.example/api/operations/" + research.id, {
        method: "PATCH", headers, body: JSON.stringify(update)
      }), env);
      assert.equal(response.status, 200);
      research = (await response.json()).operation;
    }
    assert.equal(research.status, "awaiting_owner");

    const generated = await worker.fetch(new Request("https://api.example/api/generate", {
      method: "POST", headers,
      body: JSON.stringify({
        name: "Example Workshop researched opportunity",
        offer: "Evidence-backed research brief:\n" + research.result + "\n\nSource references:\nMaintenance research: https://research.example.org/maintenance",
        audience: "Local vehicle owners",
        goal: "Engagement",
        business: "Example Workshop",
        platforms: ["Facebook"]
      })
    }), env);
    assert.equal(generated.status, 200);
    const campaignResult = (await generated.json()).campaign;
    assert.equal(campaignResult.posts.length, 3);

    const campaignId = crypto.randomUUID();
    const campaign = {
      id: campaignId,
      name: "Example Workshop researched opportunity",
      offer: "Evidence-backed research brief.",
      status: "pending",
      posts: campaignResult.posts.map((post, index) => ({ ...post, id: "post-" + index, status: "pending" })),
      strategy: campaignResult.strategy,
      audienceInsight: campaignResult.audienceInsight,
      channelPlan: campaignResult.channelPlan,
      successMetrics: campaignResult.successMetrics,
      sourceOperationId: research.id,
      researchEvidence: research.evidence
    };
    const saved = await worker.fetch(new Request("https://api.example/api/campaigns", {
      method: "POST", headers, body: JSON.stringify(campaign)
    }), env);
    assert.equal(saved.status, 201);
    const savedCampaign = (await saved.json()).campaign;
    assert.equal(savedCampaign.sourceOperationId, research.id);
    assert.equal(savedCampaign.researchEvidence[0].url, evidence[0].url);
    assert.equal(savedCampaign.approvedAt, undefined);

    const blockedPublish = await worker.fetch(new Request("https://api.example/api/publish", {
      method: "POST", headers,
      body: JSON.stringify({ campaignId, postId: "post-0", platform: "Facebook" })
    }), env);
    assert.equal(blockedPublish.status, 403);

    const completedResearch = await worker.fetch(new Request("https://api.example/api/operations/" + research.id, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "completed", by: "kira", note: "Selected opportunity converted into a draft." })
    }), env);
    assert.equal(completedResearch.status, 409);
    const selectedResearch = await worker.fetch(new Request("https://api.example/api/operations/" + research.id, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "in_progress", by: "owner", note: "Owner selected this opportunity." })
    }), env);
    assert.equal(selectedResearch.status, 200);
    const closedResearch = await worker.fetch(new Request("https://api.example/api/operations/" + research.id, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "completed", by: "kira", note: "Campaign draft saved for owner review." })
    }), env);
    assert.equal(closedResearch.status, 200);
    assert.equal((await closedResearch.json()).operation.status, "completed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("campaigns are isolated by business profile and legacy drafts stay with legacy-default", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"}),
    "campaign:one":JSON.stringify({id:"one",name:"One",offer:"Offer",businessId:"biz-one"}),
    "campaign:two":JSON.stringify({id:"two",name:"Two",offer:"Offer",businessId:"biz-two"}),
    "campaign:legacy":JSON.stringify({id:"legacy",name:"Legacy",offer:"Offer"})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const ambiguous=await worker.fetch(new Request("https://api.example/api/campaigns",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(ambiguous.status,400);
  const one=await worker.fetch(new Request("https://api.example/api/campaigns?businessId=biz-one",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(one.status,200);
  assert.deepEqual((await one.json()).campaigns.map(c=>c.id),["one"]);
  const two=await worker.fetch(new Request("https://api.example/api/campaigns?businessId=biz-two",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.deepEqual((await two.json()).campaigns.map(c=>c.id),["two"]);
  const legacy=await worker.fetch(new Request("https://api.example/api/campaigns?businessId=legacy-default",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(legacy.status,404);
});

test("learning playbook endpoint returns only the active business memory", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"}),
    "business-learning:biz-one":JSON.stringify({businessId:"biz-one",updatedAt:"2026-11-07T10:00:00Z",entries:[
      {campaignId:"campaign-one",campaignName:"One's lesson",source:"Facebook Graph API",confidence:"high",metrics:{clicks:12},whatWorked:["Specific offer."],nextAction:"Repeat the test."}
    ]}),
    "business-learning:biz-two":JSON.stringify({businessId:"biz-two",entries:[
      {campaignId:"campaign-two",campaignName:"Private other lesson",source:"Facebook Graph API",confidence:"high",metrics:{clicks:99}}
    ]})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token};
  const response=await worker.fetch(new Request("https://api.example/api/learning?businessId=biz-one",{headers}),{
    APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv
  });
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.businessId,"biz-one");
  assert.equal(body.entries.length,1);
  assert.equal(body.entries[0].campaignName,"One's lesson");
  assert.equal(JSON.stringify(body).includes("Private other lesson"),false);
});

test("campaign creation requires an explicit valid business when profiles are multiple", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const body={name:"Scoped campaign",offer:"Verified offer"};
  const missing=await worker.fetch(new Request("https://api.example/api/campaigns",{method:"POST",headers,body:JSON.stringify(body)}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(missing.status,400);
  const created=await worker.fetch(new Request("https://api.example/api/campaigns",{method:"POST",headers,body:JSON.stringify({...body,businessId:"biz-two"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(created.status,201);
  assert.equal((await created.json()).campaign.businessId,"biz-two");
});

test("operation lists and updates cannot cross business boundaries", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"}),
    "operation:11111111-1111-4111-8111-111111111111":JSON.stringify({id:"11111111-1111-4111-8111-111111111111",businessId:"biz-one",type:"research",title:"One",summary:"One",status:"queued",history:[]}),
    "operation:22222222-2222-4222-8222-222222222222":JSON.stringify({id:"22222222-2222-4222-8222-222222222222",businessId:"biz-two",type:"research",title:"Two",summary:"Two",status:"queued",history:[]})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const listed=await worker.fetch(new Request("https://api.example/api/operations?businessId=biz-one",{headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.deepEqual((await listed.json()).operations.map(op=>op.id),["11111111-1111-4111-8111-111111111111"]);
  const cross=await worker.fetch(new Request("https://api.example/api/operations/22222222-2222-4222-8222-222222222222?businessId=biz-one",{method:"PATCH",headers,body:JSON.stringify({status:"in_progress"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(cross.status,404);
});


test("scheduled research runs separately for each enabled business profile", async () => {
  const day=new Date().toISOString().slice(0,10);
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["business-alpha","business-beta"]),
    "business-profile:business-alpha":JSON.stringify({id:"business-alpha",business:"Alpha Studio",researchMonitoringEnabled:true}),
    "business-profile:business-beta":JSON.stringify({id:"business-beta",business:"Beta Store",researchMonitoringEnabled:true})
  });
  const originalFetch=globalThis.fetch;
  let calls=0,scheduledPromise;
  globalThis.fetch=async (_url,options)=>{
    calls++;
    const payload=JSON.parse(options.body);
    assert.match(payload.input,/business context/i);
    return new Response(JSON.stringify({output:[
      {type:"web_search_call",action:{sources:[{title:"Source "+calls,url:"https://example.com/"+calls}]}},
      {type:"message",content:[{type:"output_text",text:"Evidence-backed report "+calls}]}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    worker.scheduled({}, {MG_DATA:kv,OPENAI_API_KEY:"test-openai-key"}, {waitUntil(promise){scheduledPromise=promise}});
    await scheduledPromise;
    const operations=[...kv.values.entries()].filter(([key])=>key.startsWith("operation:")).map(([,value])=>JSON.parse(value));
    assert.equal(calls,2);
    assert.equal(operations.length,2);
    assert.deepEqual(new Set(operations.map(op=>op.businessId)),new Set(["business-alpha","business-beta"]));
    assert.equal((await kv.get("autonomous-scan:business-alpha:"+day,"json")).status,"completed");
    assert.equal((await kv.get("autonomous-scan:business-beta:"+day,"json")).status,"completed");
    worker.scheduled({}, {MG_DATA:kv,OPENAI_API_KEY:"test-openai-key"}, {waitUntil(promise){scheduledPromise=promise}});
    await scheduledPromise;
    assert.equal(calls,2);
    assert.equal([...kv.values.keys()].filter(key=>key.startsWith("operation:")).length,2);
  }finally{globalThis.fetch=originalFetch}
});


test("scheduled research prepares an unpublished campaign draft when evidence supports one", async () => {
  const day=new Date().toISOString().slice(0,10);
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["business-alpha"]),
    "business-profile:business-alpha":JSON.stringify({id:"business-alpha",business:"Alpha Studio",businessDescription:"Independent local retailer",audience:"Local collectors",platforms:["Facebook"],brandVoice:"Friendly and knowledgeable",researchMonitoringEnabled:true})
  });
  const originalFetch=globalThis.fetch;
  let calls=0,scheduledPromise;
  globalThis.fetch=async(url,options)=>{
    calls++;
    if(String(url).includes("/v1/responses"))return new Response(JSON.stringify({output:[
      {type:"web_search_call",action:{sources:[{title:"Current collector trend",url:"https://example.com/collector-trend"}]}},
      {type:"message",content:[{type:"output_text",text:"A current, cited collector trend creates a timely conversation opportunity."}]}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
    const payload=JSON.parse(options.body),user=payload.messages.at(-1).content;
    const result=user.includes('"researchReport"')
      ? {proceed:true,reason:"Recent evidence supports a relevant collector conversation.",name:"Collector conversation",offer:"A focused conversation about the newly reported collector trend.",audience:"Local collectors",goal:"Engagement",angle:"community",platforms:["Facebook"]}
      : {strategy:"A focused, evidence-led conversation campaign.",audienceInsight:"Local collectors follow current category developments.",channelPlan:[{platform:"Facebook",role:"Conversation",voice:"Friendly",reason:"Reach the local audience",priority:1}],successMetrics:["Meaningful comments"],posts:[1,2,3].map(i=>({title:"Post "+i,platform:"Facebook",objective:"Start a useful conversation",copy:"A grounded post "+i,visualBrief:"One clear product or topic image",cta:"Join the conversation",recommendedDay:i*2}))};
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    worker.scheduled({}, {MG_DATA:kv,OPENAI_API_KEY:"test-openai-key"}, {waitUntil(promise){scheduledPromise=promise}});
    await scheduledPromise;
    const campaigns=[...kv.values.entries()].filter(([key])=>key.startsWith("campaign:")).map(([,value])=>JSON.parse(value));
    const operations=[...kv.values.entries()].filter(([key])=>key.startsWith("operation:")).map(([,value])=>JSON.parse(value));
    assert.equal(calls,3);
    assert.equal(campaigns.length,1);
    assert.equal(campaigns[0].businessId,"business-alpha");
    assert.equal(campaigns[0].status,"pending");
    assert.equal(campaigns[0].approvedAt,undefined);
    assert.equal(campaigns[0].posts.length,3);
    assert.ok(campaigns[0].posts.every(post=>post.status==="pending"));
    assert.equal(campaigns[0].sourceOperationId,operations[0].id);
    assert.equal(operations[0].status,"completed");
    assert.equal(operations[0].campaignId,campaigns[0].id);
    assert.equal((await kv.get("autonomous-scan:business-alpha:"+day,"json")).campaignId,campaigns[0].id);
    let duplicatePromise;
    worker.scheduled({}, {MG_DATA:kv,OPENAI_API_KEY:"test-openai-key"}, {waitUntil(promise){duplicatePromise=promise}});
    await duplicatePromise;
    assert.equal(calls,3);
    assert.equal([...kv.values.keys()].filter(key=>key.startsWith("campaign:")).length,1);
  }finally{globalThis.fetch=originalFetch}
});


test("scheduled research does not create an automatic campaign without usable source evidence", async () => {
  const day=new Date().toISOString().slice(0,10);
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["business-alpha"]),
    "business-profile:business-alpha":JSON.stringify({id:"business-alpha",business:"Alpha Studio",audience:"Local collectors",platforms:["Facebook"],researchMonitoringEnabled:true})
  });
  const originalFetch=globalThis.fetch;
  let calls=0,scheduledPromise;
  globalThis.fetch=async()=>{
    calls++;
    return new Response(JSON.stringify({output:[
      {type:"web_search_call",action:{sources:[]}},
      {type:"message",content:[{type:"output_text",text:"A possible trend was discussed, but no verifiable source was returned."}]}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    worker.scheduled({}, {MG_DATA:kv,OPENAI_API_KEY:"test-openai-key"}, {waitUntil(promise){scheduledPromise=promise}});
    await scheduledPromise;
    const campaigns=[...kv.values.entries()].filter(([key])=>key.startsWith("campaign:")).map(([,value])=>JSON.parse(value));
    const operations=[...kv.values.entries()].filter(([key])=>key.startsWith("operation:")).map(([,value])=>JSON.parse(value));
    assert.equal(calls,1);
    assert.equal(campaigns.length,0);
    assert.equal(operations.length,1);
    assert.equal(operations[0].status,"awaiting_owner");
    assert.match(operations[0].result,/no usable HTTPS source evidence/i);
    assert.equal((await kv.get("autonomous-scan:business-alpha:"+day,"json")).status,"completed");
  }finally{globalThis.fetch=originalFetch}
});


test("campaign item update, deletion and publishing reject another business profile", async () => {
  const token=await ownerToken(),id="33333333-3333-4333-8333-333333333333";
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"}),
    ["campaign:"+id]:JSON.stringify({id,businessId:"biz-one",name:"Private campaign",offer:"Offer",status:"pending",posts:[{id:"post-one",copy:"Draft",status:"pending"}]})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const patch=await worker.fetch(new Request("https://api.example/api/campaigns/"+id+"?businessId=biz-two",{method:"PATCH",headers,body:JSON.stringify({name:"Hijacked"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(patch.status,404);
  const deletion=await worker.fetch(new Request("https://api.example/api/campaigns/"+id+"?businessId=biz-two",{method:"DELETE",headers}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(deletion.status,404);
  const publish=await worker.fetch(new Request("https://api.example/api/publish",{method:"POST",headers,body:JSON.stringify({campaignId:id,postId:"post-one",platform:"Facebook",businessId:"biz-two"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(publish.status,404);
  assert.equal((await kv.get("campaign:"+id,"json")).name,"Private campaign");
});


test("Kira chat requires an active business when multiple profiles exist", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Alpha"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Beta"})
  });
  const response=await worker.fetch(new Request("https://api.example/api/chat",{method:"POST",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({message:"What should we do?",business:"Forged business"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:kv});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/Select a business/);
});

test("Kira chat uses stored active-business context instead of browser-supplied profile data", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Alpha Studio",businessDescription:"Alpha description",audience:"Alpha customers",brandVoice:"Alpha voice",platforms:["Instagram"],inventorySummary:{fileName:"alpha.csv",rowCount:1,products:[{name:"Alpha product"}]}}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Beta Store"})
  });
  const originalFetch=globalThis.fetch;let sent;
  globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:"Alpha-only reply"}}]}),{status:200,headers:{"Content-Type":"application/json"}})};
  try{
    const response=await worker.fetch(new Request("https://api.example/api/chat",{method:"POST",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({message:"Help me",businessId:"biz-one",business:"Forged Beta",businessDescription:"Wrong description",inventorySummary:{products:[{name:"Beta confidential"}]}})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:kv});
    assert.equal(response.status,200);
    const system=sent.messages[0].content;
    assert.match(system,/Alpha Studio/);
    assert.match(system,/Alpha description/);
    assert.match(system,/alpha.csv/);
    assert.doesNotMatch(system,/Forged Beta|Beta confidential|Wrong description/);
  }finally{globalThis.fetch=originalFetch}
});


test("all Kira AI endpoints require an active business when profiles are multiple", async () => {
  const token=await ownerToken(),kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Alpha"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Beta"})
  });
  for(const endpoint of ["/api/chat","/api/research","/api/strategy","/api/generate"]){
    const response=await worker.fetch(new Request("https://api.example"+endpoint,{method:"POST",headers:{Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({message:"Prepare something",business:"Unscoped"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:kv});
    assert.equal(response.status,400,endpoint+" should fail closed");
    assert.match((await response.json()).error,/Select a business/,endpoint);
  }
});


test("campaign creation ignores client-supplied IDs and cannot overwrite another business campaign", async () => {
  const token=await ownerToken(),attemptedId="44444444-4444-4444-8444-444444444444";
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({id:"biz-one",business:"Business One"}),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Business Two"}),
    ["campaign:"+attemptedId]:JSON.stringify({id:attemptedId,businessId:"biz-one",name:"Protected campaign",offer:"Original offer"})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const response=await worker.fetch(new Request("https://api.example/api/campaigns",{method:"POST",headers,body:JSON.stringify({id:attemptedId,businessId:"biz-two",name:"New campaign",offer:"New offer"})}),{APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",MG_DATA:kv});
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,"That campaign ID is already in use. Refresh and try again.");
  assert.equal((await kv.get("campaign:"+attemptedId,"json")).name,"Protected campaign");
  assert.equal((await kv.get("campaign:"+attemptedId,"json")).businessId,"biz-one");
  assert.equal([...kv.values.keys()].filter(key=>key.startsWith("campaign:")).length,1);
});


test("research, strategy and campaign generation all use the stored business profile", async () => {
  const token=await ownerToken(),id="55555555-5555-4555-8555-555555555555";
  const kv=memoryKV({
    "owner:business-profiles":JSON.stringify(["biz-one","biz-two"]),
    "business-profile:biz-one":JSON.stringify({
      id:"biz-one",business:"Alpha Studio",businessDescription:"Alpha description",location:"Alpha location",
      audience:"Alpha audience",brandVoice:"Alpha voice",platforms:["Instagram"],
      inventorySummary:{fileName:"alpha-stock.csv",rowCount:1,products:[{name:"Alpha product",price:"$19",stock:"4",category:"Prints"}]}
    }),
    "business-profile:biz-two":JSON.stringify({id:"biz-two",business:"Beta Store"})
  });
  const headers={Origin:"https://lucasmaxxinfo-sketch.github.io",Authorization:"Bearer "+token,"Content-Type":"application/json"};
  const options={APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",SESSION_SECRET:"test-session-secret",OPENAI_API_KEY:"test-openai-key",MG_DATA:kv};
  const originalFetch=globalThis.fetch,captured=[];
  globalThis.fetch=async (url,init)=>{
    const payload=JSON.parse(init.body);
    captured.push({url:String(url),payload});
    if(String(url).includes("/v1/responses")){
      return new Response(JSON.stringify({output:[
        {type:"message",content:[{type:"output_text",text:"A supported research report."}]},
        {type:"web_search_call",action:{sources:[{title:"Evidence",url:"https://example.com/evidence"}]}}
      ]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    const user=payload.messages?.at(-1)?.content||"";
    const result=user.includes('"channels"')
      ? {strategySummary:"A focused strategy",recommendedChannels:["instagram"],channelPlan:[{id:"instagram",role:"Discovery",voice:"Alpha voice",reason:"Audience fit",priority:1}]}
      : {strategy:"A grounded campaign",audienceInsight:"Alpha audience",channelPlan:[],successMetrics:["Enquiries"],posts:[1,2,3].map(i=>({title:"Post "+i,copy:"Copy "+i,platform:"Instagram"}))};
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  const forged={businessId:"biz-one",business:"Forged Beta",businessDescription:"Forged description",location:"Forged location",audience:"Forged audience",brandVoice:"Forged voice",platforms:["Facebook"],inventorySummary:{fileName:"forged.csv",products:[{name:"Forged product"}]}};
  try{
    const research=await worker.fetch(new Request("https://api.example/api/research",{method:"POST",headers,body:JSON.stringify(forged)}),options);
    assert.equal(research.status,200);
    const researchInput=captured.find(call=>call.url.includes("/v1/responses")).payload.input;
    for(const value of ["Alpha Studio","Alpha description","Alpha location","Alpha audience","Alpha product"])assert.match(researchInput,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
    assert.doesNotMatch(researchInput,/Forged Beta|Forged description|Forged location|Forged audience|Forged product|forged\.csv/);

    const strategy=await worker.fetch(new Request("https://api.example/api/strategy",{method:"POST",headers,body:JSON.stringify({...forged,channels:[{id:"instagram",name:"Instagram"}]})}),options);
    assert.equal(strategy.status,200);
    const strategyBrief=JSON.parse(captured.find(call=>call.payload.messages?.at(-1)?.content?.includes('"channels"')).payload.messages.at(-1).content);
    assert.equal(strategyBrief.business,"Alpha Studio");
    assert.equal(strategyBrief.description,"Alpha description");
    assert.equal(strategyBrief.audience,"Alpha audience");
    assert.equal(strategyBrief.brandVoice,"Alpha voice");

    const generate=await worker.fetch(new Request("https://api.example/api/generate",{method:"POST",headers,body:JSON.stringify({...forged,name:"Alpha launch",offer:"Verified offer"})}),options);
    assert.equal(generate.status,200);
    const generatedBrief=JSON.parse(captured.find(call=>call.payload.messages?.at(-1)?.content?.includes('"name":"Alpha launch"')).payload.messages.at(-1).content);
    assert.equal(generatedBrief.business,"Alpha Studio");
    assert.equal(generatedBrief.businessDescription,"Alpha description");
    assert.equal(generatedBrief.brandVoice,"Alpha voice");
    assert.deepEqual(generatedBrief.platforms,["Instagram"]);
    assert.equal(generatedBrief.inventorySummary.fileName,"alpha-stock.csv");
    assert.equal(generatedBrief.inventorySummary.products[0].name,"Alpha product");
    assert.doesNotMatch(JSON.stringify(generatedBrief),/Forged Beta|Forged description|Forged product|forged\.csv/);
  }finally{globalThis.fetch=originalFetch;}
});


test("business inventory uploads are chunked, verified and atomically activated", async () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const version = "22222222-2222-4222-8222-222222222222";
  const nextVersion = "33333333-3333-4333-8333-333333333333";
  const kv = memoryKV({
    ["business-profile:" + businessId]: JSON.stringify({ id: businessId, business: "Inventory Test" })
  });
  const env = {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  };
  const token = await ownerToken();
  const send = (path, method, body) => worker.fetch(new Request("https://api.example" + path, {
    method,
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  }), env);

  const first = await send(`/api/businesses/${businessId}/inventory/${version}/0`, "PUT", {
    chunkCount: 2,
    products: [{ name: "First", price: "$10", stock: "2", category: "Tools" }]
  });
  assert.equal(first.status, 200);
  const second = await send(`/api/businesses/${businessId}/inventory/${version}/1`, "PUT", {
    chunkCount: 2,
    products: [{ name: "Second", price: "$20", stock: "4", category: "Parts" }]
  });
  assert.equal(second.status, 200);

  const incomplete = await send(`/api/businesses/${businessId}/inventory`, "PUT", {
    version: nextVersion, chunkCount: 2, productCount: 2, fileName: "replacement.csv"
  });
  assert.equal(incomplete.status, 409);

  const activate = await send(`/api/businesses/${businessId}/inventory`, "PUT", {
    version, chunkCount: 2, productCount: 2, fileName: "stock.csv", rowCount: 2, uploadedAt: "2026-11-07T00:00:00.000Z"
  });
  assert.equal(activate.status, 200);

  const read = await send(`/api/businesses/${businessId}/inventory`, "GET");
  assert.equal(read.status, 200);
  const body = await read.json();
  assert.equal(body.inventory.products.length, 2);
  assert.deepEqual(body.inventory.products.map(product => product.name), ["First", "Second"]);
  assert.equal(body.inventory.fileName, "stock.csv");
});

test("business inventory chunk endpoints require owner authentication and a real profile", async () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const kv = memoryKV();
  const env = { APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io", SESSION_SECRET: "test-session-secret", MG_DATA: kv };
  const unauthenticated = await worker.fetch(new Request(`https://api.example/api/businesses/${businessId}/inventory`, {
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io" }
  }), env);
  assert.equal(unauthenticated.status, 401);
  const token = await ownerToken();
  const missingProfile = await worker.fetch(new Request(`https://api.example/api/businesses/${businessId}/inventory`, {
    headers: { Origin: "https://lucasmaxxinfo-sketch.github.io", Authorization: "Bearer " + token }
  }), env);
  assert.equal(missingProfile.status, 404);
});


test("deleting a business profile also removes its active and staged inventory chunks", async () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const version = "22222222-2222-4222-8222-222222222222";
  const otherBusinessId = "44444444-4444-4444-8444-444444444444";
  const prefix = "business-inventory:" + businessId + ":";
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify([businessId, otherBusinessId]),
    ["business-profile:" + businessId]: JSON.stringify({ id: businessId, business: "Delete Inventory Test" }),
    ["business-profile:" + otherBusinessId]: JSON.stringify({ id: otherBusinessId, business: "Keep This Business" }),
    [prefix + "meta"]: JSON.stringify({ version, chunkCount: 1, productCount: 1 }),
    [prefix + version + ":0"]: JSON.stringify([{ name: "Stored item" }]),
    [prefix + "staged-version:0"]: JSON.stringify([{ name: "Unfinished item" }])
  });
  const response = await worker.fetch(new Request("https://api.example/api/businesses/" + businessId, {
    method: "DELETE",
    headers: {
      Origin: "https://lucasmaxxinfo-sketch.github.io",
      Authorization: "Bearer " + await ownerToken()
    }
  }), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  });
  assert.equal(response.status, 200);
  assert.equal([...kv.values.keys()].some(key => key.startsWith(prefix)), false);
  assert.equal(kv.values.has("business-profile:" + businessId), false);
});


test("health reports missed and partial daily scans after the scheduled grace period", async () => {
  const OriginalDate=globalThis.Date;
  const fixedTime="2026-11-07T15:00:00.000Z";
  const FixedDate=class extends OriginalDate {
    constructor(...args){super(...(args.length?args:[fixedTime]));}
    static now(){return new OriginalDate(fixedTime).getTime();}
  };
  globalThis.Date=FixedDate;
  try {
    const day="2026-11-07";
    const missedKv=memoryKV({
      "owner:business-profiles":JSON.stringify(["business-one"]),
      "business-profile:business-one":JSON.stringify({id:"business-one",business:"Business One",researchMonitoringEnabled:true})
    });
    const missed=await worker.fetch(new Request("https://api.example/health"),{
      APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",
      RESEARCH_CRON_UTC:"14:00",
      OPENAI_API_KEY:"test-openai-key",
      MG_DATA:missedKv
    });
    assert.equal((await missed.json()).dailyResearch.todayStatus,"missed");

    const partialKv=memoryKV({
      "owner:business-profiles":JSON.stringify(["business-one","business-two"]),
      "business-profile:business-one":JSON.stringify({id:"business-one",business:"Business One",researchMonitoringEnabled:true}),
      "business-profile:business-two":JSON.stringify({id:"business-two",business:"Business Two",researchMonitoringEnabled:true}),
      ["autonomous-scan:business-one:"+day]:JSON.stringify({status:"completed",attempts:1})
    });
    const partial=await worker.fetch(new Request("https://api.example/health"),{
      APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",
      RESEARCH_CRON_UTC:"14:00",
      OPENAI_API_KEY:"test-openai-key",
      MG_DATA:partialKv
    });
    assert.equal((await partial.json()).dailyResearch.todayStatus,"partial");

    const stalledKv=memoryKV({
      "owner:business-profiles":JSON.stringify(["business-one"]),
      "business-profile:business-one":JSON.stringify({id:"business-one",business:"Business One",researchMonitoringEnabled:true}),
      ["autonomous-scan:business-one:"+day]:JSON.stringify({status:"running",startedAt:"2026-11-07T14:29:00.000Z",attempts:1})
    });
    const stalled=await worker.fetch(new Request("https://api.example/health"),{
      APP_ORIGIN:"https://lucasmaxxinfo-sketch.github.io",
      RESEARCH_CRON_UTC:"14:00",
      OPENAI_API_KEY:"test-openai-key",
      MG_DATA:stalledKv
    });
    assert.equal((await stalled.json()).dailyResearch.todayStatus,"stalled");
  } finally {
    globalThis.Date=OriginalDate;
  }
});

test("health reports hosted daily monitoring state without exposing business profile details", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify(["private-business-id"]),
    "business-profile:private-business-id": JSON.stringify({
      id: "private-business-id",
      business: "Private Business Name",
      researchMonitoringEnabled: true
    }),
    ["autonomous-scan:private-business-id:" + day]: JSON.stringify({
      status: "completed",
      attempts: 2,
      completedAt: new Date().toISOString()
    })
  });
  const response = await worker.fetch(new Request("https://api.example/health"), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    RESEARCH_CRON_UTC: "03:45",
    OPENAI_API_KEY: "test-openai-key",
    SESSION_SECRET: "test-session-secret",
    MG_DATA: kv
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.dailyResearch, {
    scheduleUtc: "03:45",
    monitoringEnabled: true,
    todayStatus: "completed",
    attempts: 2,
    businessesMonitored: 1,
    businessesCompleted: 1,
    businessesFailed: 0
  });
  assert.equal(JSON.stringify(body).includes("Private Business Name"), false);
});

test("health distinguishes disabled monitoring from unavailable research services", async () => {
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify(["business-one"]),
    "business-profile:business-one": JSON.stringify({
      id: "business-one",
      business: "Private Business",
      researchMonitoringEnabled: false
    })
  });
  const disabled = await worker.fetch(new Request("https://api.example/health"), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    MG_DATA: kv
  });
  const disabledBody = await disabled.json();
  assert.equal(disabledBody.dailyResearch.monitoringEnabled, false);
  assert.equal(disabledBody.dailyResearch.todayStatus, "disabled");
  assert.equal(disabledBody.dailyResearch.attempts, 0);

  await kv.put("business-profile:business-one", JSON.stringify({
    id: "business-one",
    business: "Private Business",
    researchMonitoringEnabled: true
  }));
  const unavailable = await worker.fetch(new Request("https://api.example/health"), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    MG_DATA: kv
  });
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.dailyResearch.monitoringEnabled, true);
  assert.equal(unavailableBody.dailyResearch.todayStatus, "unavailable");
});


test("health reports aggregate daily campaign-learning state without exposing business details", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify(["private-business-id"]),
    "business-profile:private-business-id": JSON.stringify({ id: "private-business-id", business: "Private Business Name" }),
    ["autonomous-learning:" + day]: JSON.stringify({
      status: "completed",
      campaignsChecked: 3,
      campaignsReviewed: 2,
      campaignsSkipped: 1,
      completedAt: new Date().toISOString()
    })
  });
  const response = await worker.fetch(new Request("https://api.example/health"), {
    APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
    RESEARCH_CRON_UTC: "14:00",
    OPENAI_API_KEY: "test-openai-key",
    META_PAGE_ACCESS_TOKEN: "test-meta-token",
    MG_DATA: kv
  });
  const body = await response.json();
  assert.deepEqual(body.dailyLearning, {
    scheduleUtc: "14:00",
    monitoringEnabled: true,
    todayStatus: "completed",
    campaignsChecked: 3,
    campaignsReviewed: 2,
    campaignsSkipped: 1
  });
  assert.equal(JSON.stringify(body).includes("Private Business Name"), false);
});

test("health detects a campaign-learning run stuck in running state for over 30 minutes", async () => {
  const OriginalDate = globalThis.Date;
  const fixedTime = "2026-11-07T15:00:00.000Z";
  const FixedDate = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [fixedTime])); }
    static now() { return new OriginalDate(fixedTime).getTime(); }
  };
  globalThis.Date = FixedDate;
  try {
    const day = "2026-11-07";
    const kv = memoryKV({
      "owner:business-profiles": JSON.stringify(["business-one"]),
      "business-profile:business-one": JSON.stringify({ id: "business-one", business: "Business One" }),
      ["autonomous-learning:" + day]: JSON.stringify({
        status: "running",
        startedAt: "2026-11-07T14:29:00.000Z",
        campaignsChecked: 2,
        campaignsReviewed: 1,
        campaignsSkipped: 0
      })
    });
    const response = await worker.fetch(new Request("https://api.example/health"), {
      APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io",
      RESEARCH_CRON_UTC: "14:00",
      OPENAI_API_KEY: "test-openai-key",
      META_PAGE_ACCESS_TOKEN: "test-meta-token",
      MG_DATA: kv
    });
    const body = await response.json();
    assert.equal(body.dailyLearning.todayStatus, "stalled");
    assert.equal(body.dailyLearning.campaignsChecked, 2);
    assert.equal(body.dailyLearning.campaignsReviewed, 1);
  } finally {
    globalThis.Date = OriginalDate;
  }
});

test("scheduled Kira learning records its daily operating result", async () => {
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify(["business-one"]),
    "business-profile:business-one": JSON.stringify({
      id: "business-one",
      business: "Business One",
      researchMonitoringEnabled: false
    })
  });
  const env = {
    MG_DATA: kv,
    OPENAI_API_KEY: "test-openai-key",
    META_PAGE_ACCESS_TOKEN: "test-meta-token"
  };
  let scheduledWork;
  worker.scheduled({}, env, { waitUntil(promise) { scheduledWork = promise; } });
  await scheduledWork;
  const day = new Date().toISOString().slice(0, 10);
  const marker = await kv.get("autonomous-learning:" + day, "json");
  assert.equal(marker.status, "completed");
  assert.equal(marker.campaignsChecked, 0);
  assert.equal(marker.campaignsReviewed, 0);
  assert.equal(marker.campaignsSkipped, 0);
});

test("scheduled Kira learning analyses verified Facebook results and creates one owner review", async () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const campaignId = "22222222-2222-4222-8222-222222222222";
  const profile = {
    id: businessId, business: "Test business", businessDescription: "Local retailer",
    location: "Christchurch", audience: "Local collectors", platforms: ["Facebook"],
    brandVoice: "Clear", researchMonitoringEnabled: false
  };
  const campaign = {
    id: campaignId, businessId, name: "Collector weekend", goal: "Generate enquiries",
    audience: "Local collectors", strategy: "Showcase verified stock", status: "active",
    expected: { reach: "500" }, posts: [
      { id: "post-1", title: "New arrivals", platform: "Facebook", status: "published", platformPostId: "page_post_1" },
      { id: "post-2", title: "Behind the scenes", platform: "Facebook", status: "approved" }
    ]
  };
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify([businessId]),
    ["business-profile:" + businessId]: JSON.stringify(profile),
    ["campaign:" + campaignId]: JSON.stringify(campaign)
  });
  const originalFetch = globalThis.fetch;
  let insightsCalls = 0, aiCalls = 0, pending;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("graph.facebook.com")) {
      insightsCalls++;
      return new Response(JSON.stringify({ data: [
        { name: "post_impressions", total_value: { value: 420 } },
        { name: "post_engaged_users", total_value: { value: 38 } },
        { name: "post_clicks", total_value: { value: 12 } }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    aiCalls++;
    const payload = JSON.parse(options.body);
    assert.match(payload.messages[0].content, /Do not invent causes/);
    const analysis = {
      summary: "The published post generated 38 engaged users and 12 clicks.",
      whatWorked: ["The post generated 12 measured clicks."],
      whatNeedsAttention: ["Observed impressions were below the supplied target."],
      nextAction: "Test a clearer enquiry call to action.",
      confidence: "medium",
      ownerDecisionRequired: true
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const env = {
      MG_DATA: kv, META_PAGE_ACCESS_TOKEN: "test-meta-token",
      OPENAI_API_KEY: "test-openai-key", APP_ORIGIN: "https://lucasmaxxinfo-sketch.github.io"
    };
    worker.scheduled({}, env, { waitUntil(promise) { pending = promise; } });
    await pending;
    const saved = await kv.get("campaign:" + campaignId, "json");
    assert.equal(saved.learning.impressions, 420);
    assert.equal(saved.learning.engagedUsers, 38);
    assert.equal(saved.learning.clicks, 12);
    assert.equal(saved.learning.source, "Facebook Graph API");
    assert.equal(saved.learning.analysis.confidence, "medium");
    const memory = await kv.get("business-learning:" + businessId, "json");
    assert.equal(memory.businessId, businessId);
    assert.equal(memory.entries.length, 1);
    assert.equal(memory.entries[0].campaignId, campaignId);
    assert.equal(memory.entries[0].metrics.clicks, 12);
    assert.equal(memory.entries[0].whatWorked[0], "The post generated 12 measured clicks.");
    assert.equal(saved.posts[1].status, "approved");
    const operations = [...kv.values.entries()].filter(([key]) => key.startsWith("operation:")).map(([, value]) => JSON.parse(value));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].type, "quality_review");
    assert.equal(operations[0].status, "awaiting_owner");
    assert.equal(operations[0].campaignId, campaignId);
    assert.equal(insightsCalls, 1);
    assert.equal(aiCalls, 1);

    worker.scheduled({}, env, { waitUntil(promise) { pending = promise; } });
    await pending;
    const repeated = [...kv.values.keys()].filter(key => key.startsWith("operation:"));
    assert.equal(repeated.length, 1);
    assert.equal(insightsCalls, 1);
    assert.equal(aiCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled Kira learning does not cross business workspaces", async () => {
  const businessA = "33333333-3333-4333-8333-333333333333";
  const businessB = "44444444-4444-4444-8444-444444444444";
  const profile = id => ({ id, business: "Business " + id, platforms: ["Facebook"] });
  const campaign = {
    id: "55555555-5555-4555-8555-555555555555", businessId: businessB,
    name: "Other workspace", posts: [{ id: "p", platform: "Facebook", status: "published", platformPostId: "post" }]
  };
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify([businessA]),
    ["business-profile:" + businessA]: JSON.stringify(profile(businessA)),
    ["business-profile:" + businessB]: JSON.stringify(profile(businessB)),
    ["campaign:" + campaign.id]: JSON.stringify(campaign)
  });
  const originalFetch = globalThis.fetch;
  let calls = 0, pending;
  globalThis.fetch = async () => { calls++; throw new Error("Should not request another business's insights"); };
  try {
    worker.scheduled({}, {
      MG_DATA: kv, META_PAGE_ACCESS_TOKEN: "test-meta-token", OPENAI_API_KEY: "test-openai-key"
    }, { waitUntil(promise) { pending = promise; } });
    await pending;
    assert.equal(calls, 0);
    assert.equal((await kv.get("campaign:" + campaign.id, "json")).learning, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("autonomous campaign creation uses only confident learning from the same business", async () => {
  const businessA = "66666666-6666-4666-8666-666666666666";
  const businessB = "77777777-7777-4777-8777-777777777777";
  const campaignA = {
    id: "88888888-8888-4888-8888-888888888888", businessId: businessA,
    name: "Collectors story", goal: "Generate enquiries",
    learning: { source: "Facebook Graph API", partial: false, reviewedAt: "2026-11-06T10:00:00Z",
      postsRetrieved: 3, impressions: 900, engagedUsers: 84, clicks: 21,
      analysis: { confidence: "high", whatWorked: ["Specific collector story earned 21 clicks."],
        whatNeedsAttention: ["Opening line was too long."], nextAction: "Lead with the customer benefit." } },
    posts: []
  };
  const ownerReportedCampaign = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", businessId: businessA,
    name: "Customer questions report", goal: "Generate enquiries", reportUpdatedAt: "2026-11-06T11:00:00Z",
    actual: { reach: "310", engagements: "27", clicks: "9", conversions: "3", spend: "" },
    notes: "Customers responded to the stock comparison.", lesson: "Show price and condition together."
  };
  const campaignB = {
    id: "99999999-9999-4999-8999-999999999999", businessId: businessB,
    name: "Other business lesson",
    learning: { source: "Facebook Graph API", partial: false, reviewedAt: "2026-11-06T10:00:00Z",
      postsRetrieved: 2, impressions: 500, engagedUsers: 12, clicks: 2,
      analysis: { confidence: "high", whatWorked: ["Other business only."],
        whatNeedsAttention: [], nextAction: "Other business action." } },
    posts: []
  };
  const profileA = { id: businessA, business: "Studio A", businessDescription: "Collectibles shop",
    location: "Christchurch", audience: "Collectors", platforms: ["Facebook"],
    brandVoice: "Knowledgeable", researchMonitoringEnabled: true };
  const profileB = { id: businessB, business: "Studio B", platforms: ["Facebook"], researchMonitoringEnabled: false };
  const kv = memoryKV({
    "owner:business-profiles": JSON.stringify([businessA, businessB]),
    ["business-profile:" + businessA]: JSON.stringify(profileA),
    ["business-profile:" + businessB]: JSON.stringify(profileB),
    ["campaign:" + campaignA.id]: JSON.stringify(campaignA),
    ["campaign:" + ownerReportedCampaign.id]: JSON.stringify(ownerReportedCampaign),
    ["campaign:" + campaignB.id]: JSON.stringify(campaignB)
  });
  const originalFetch = globalThis.fetch;
  let pending, researchCalls = 0, aiCalls = 0, decisionContext, generationContext;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/v1/responses")) {
      researchCalls++;
      return new Response(JSON.stringify({ output: [
        { type: "message", content: [{ type: "output_text", text: "A current, sourced opportunity for collectors." }] },
        { type: "web_search_call", action: { sources: [{ title: "Relevant research", url: "https://example.com/collector-trend" }] } }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    aiCalls++;
    const payload = JSON.parse(options.body);
    const userContent = JSON.parse(payload.messages[1].content);
    if (aiCalls === 1) {
      decisionContext = userContent;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        proceed: true, reason: "Current research supports a relevant campaign.",
        name: "Collector stories", offer: "Share a verified collector story",
        audience: "Collectors", goal: "Generate enquiries", angle: "story", platforms: ["Facebook"]
      }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    generationContext = userContent;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      strategy: "Lead with the customer benefit.", audienceInsight: "Collectors value relevant stories.",
      channelPlan: [], successMetrics: ["Clicks"], posts: [1, 2, 3].map(i => ({
        title: "Post " + i, copy: "A focused collector story.", platform: "Facebook"
      }))
    }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    worker.scheduled({}, { MG_DATA: kv, OPENAI_API_KEY: "test-openai-key" }, {
      waitUntil(promise) { pending = promise; }
    });
    await pending;
    assert.equal(researchCalls, 1);
    assert.equal(aiCalls, 2);
    assert.equal(decisionContext.priorCampaignLearning.length, 2);
    assert.equal(decisionContext.priorCampaignLearning.some(lesson => lesson.campaignName === "Collectors story" && lesson.metrics.clicks === 21), true);
    const ownerLesson = decisionContext.priorCampaignLearning.find(lesson => lesson.campaignName === "Customer questions report");
    assert.equal(ownerLesson.source, "Owner-entered campaign report (not independently verified)");
    assert.equal(ownerLesson.metrics.conversions, "3");
    assert.equal(generationContext.campaignLearningLessons.length, 2);
    assert.equal(generationContext.campaignLearningLessons.some(lesson => lesson.suggestedNextAction === "Lead with the customer benefit."), true);
    assert.equal(generationContext.campaignLearningLessons.some(lesson => lesson.suggestedNextAction === "Show price and condition together."), true);
    assert.equal(JSON.stringify(generationContext).includes("Other business only."), false);
    const created = [...kv.values.entries()].map(([key, value]) => key.startsWith("campaign:") ? JSON.parse(value) : null)
      .filter(Boolean).find(campaign => campaign.sourceOperationId);
    assert.ok(created);
    assert.equal(created.businessId, businessA);
    assert.equal(created.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
