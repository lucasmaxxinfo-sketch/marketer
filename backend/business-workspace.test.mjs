import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const syncSource = app.split("\n").find(line => line.startsWith("async function syncCloud(){"));
if (!syncSource) throw new Error("Could not locate syncCloud in app.js");

function harness(data, remote = []) {
  const calls = [];
  const syncCloud = new Function("data", "hasCloudSession", "apiRequest", "save", `return ${syncSource};`)(
    data,
    () => true,
    async (path, options = {}) => {
      calls.push({ path, options });
      if (path === "/api/campaigns" && !options.method) return { campaigns: remote };
      if (options.method === "POST") return { campaign: JSON.parse(options.body) };
      return { campaign: JSON.parse(options.body || "{}") };
    },
    () => true
  );
  return { syncCloud, calls };
}

test("cloud sync never reassigns another business local drafts to the active business", async () => {
  const data = {
    settings: { activeBusinessId: "biz-two" },
    campaigns: [
      { id: "from-one", businessId: "biz-one", name: "One", offer: "Offer one" },
      { id: "legacy", name: "Legacy", offer: "Legacy offer" },
      { id: "from-two", businessId: "biz-two", name: "Two", offer: "Offer two" }
    ],
    operations: []
  };
  const remote = [{ id: "remote-two", businessId: "biz-two", name: "Remote", offer: "Remote offer" }];
  const { syncCloud, calls } = harness(data, remote);
  await syncCloud();

  const posted = calls.filter(call => call.options.method === "POST").map(call => JSON.parse(call.options.body));
  assert.deepEqual(posted.map(campaign => campaign.id), ["from-two"]);
  assert.equal(posted[0].businessId, "biz-two");
  assert.deepEqual(data.campaigns.map(campaign => campaign.id).sort(), ["from-two", "remote-two"]);
  assert.equal(data.localCampaignsByBusiness["biz-one"][0].id, "from-one");
  assert.equal(data.localCampaignsByBusiness["legacy-default"][0].id, "legacy");
});

test("unscoped legacy drafts remain in legacy-default until that workspace is active", async () => {
  const data = {
    settings: { activeBusinessId: "biz-two" },
    campaigns: [{ id: "old-draft", name: "Old draft", offer: "Old offer" }],
    operations: []
  };
  const { syncCloud, calls } = harness(data);
  await syncCloud();

  assert.equal(calls.some(call => call.options.method === "POST"), false);
  assert.deepEqual(data.campaigns, []);
  assert.equal(data.localCampaignsByBusiness["legacy-default"][0].businessId, "legacy-default");
});

const switchSource = app.split("async function activateBusinessProfile(id){")[1]?.split("\nasync function addBusinessProfile")[0];
if (!switchSource) throw new Error("Could not locate business switch in app.js");
const switchFunctionSource = "async function activateBusinessProfile(id){" + switchSource;

test("failed business switch restores the previous business and its visible work", async () => {
  const data = {
    settings: {
      activeBusinessId: "biz-one",
      business: "Business One",
      inventorySummary: { fileName: "one.csv", rowCount: 4, products: [{ name: "One product" }] },
      businessProfiles: [{ id: "biz-one" }, { id: "biz-two" }]
    },
    campaigns: [{ id: "campaign-one", businessId: "biz-one" }],
    operations: [{ id: "operation-one", businessId: "biz-one" }]
  };
  let syncCount = 0;
  const activate = new Function(
    "data", "hasCloudSession", "syncCloud", "saveCloudProfile", "save",
    "syncCloudProfile", "refreshOperations", "render", "notify",
    `return ${switchFunctionSource};`
  )(
    data,
    () => true,
    async () => { if (++syncCount === 2) throw new Error("Target workspace sync failed"); },
    async () => {},
    () => {},
    async () => {
      data.settings.business = "Business Two";
      data.settings.inventorySummary = { fileName: "two.csv", rowCount: 8, products: [{ name: "Two product" }] };
    },
    async () => { data.operations = [{ id: "operation-two", businessId: "biz-two" }]; },
    () => {},
    () => {}
  );

  await assert.rejects(activate("biz-two"), /Target workspace sync failed/);
  assert.equal(data.settings.activeBusinessId, "biz-one");
  assert.equal(data.settings.business, "Business One");
  assert.equal(data.settings.inventorySummary.fileName, "one.csv");
  assert.deepEqual(data.campaigns.map(item => item.id), ["campaign-one"]);
  assert.deepEqual(data.operations.map(item => item.id), ["operation-one"]);
});


test("successful business switch loads only the selected business inventory and work", async () => {
  const data = {
    settings: {
      activeBusinessId: "biz-one",
      business: "Business One",
      inventorySummary: { fileName: "one.csv", rowCount: 4, products: [{ name: "One product" }] },
      businessProfiles: [{ id: "biz-one" }, { id: "biz-two" }]
    },
    campaigns: [{ id: "campaign-one", businessId: "biz-one" }],
    operations: [{ id: "operation-one", businessId: "biz-one" }]
  };
  let syncCount = 0;
  const activate = new Function(
    "data", "hasCloudSession", "syncCloud", "saveCloudProfile", "save",
    "syncCloudProfile", "refreshOperations", "render", "notify",
    `return ${switchFunctionSource};`
  )(
    data,
    () => true,
    async () => { syncCount++; },
    async () => {},
    () => {},
    async () => {
      data.settings.business = "Business Two";
      data.settings.inventorySummary = { fileName: "two.csv", rowCount: 8, products: [{ name: "Two product" }] };
      data.campaigns = [{ id: "campaign-two", businessId: "biz-two" }];
    },
    async () => { data.operations = [{ id: "operation-two", businessId: "biz-two" }]; },
    () => {},
    () => {}
  );

  let targetSyncSawEmptyInventory = false;
  const guardedActivate = new Function(
    "data", "hasCloudSession", "syncCloud", "saveCloudProfile", "save",
    "syncCloudProfile", "refreshOperations", "render", "notify",
    `return ${switchFunctionSource};`
  )(data, () => true, async () => { syncCount++; }, async () => {}, () => {}, async () => {
    targetSyncSawEmptyInventory = data.settings.inventorySummary === null;
    data.settings.business = "Business Two";
    data.settings.inventorySummary = { fileName: "two.csv", rowCount: 8, products: [{ name: "Two product" }] };
    data.campaigns = [{ id: "campaign-two", businessId: "biz-two" }];
  }, async () => { data.operations = [{ id: "operation-two", businessId: "biz-two" }]; }, () => {}, () => {});
  await guardedActivate("biz-two");
  assert.equal(targetSyncSawEmptyInventory, true);
  assert.equal(syncCount, 2);
  assert.equal(data.settings.activeBusinessId, "biz-two");
  assert.equal(data.settings.business, "Business Two");
  assert.equal(data.settings.inventorySummary.fileName, "two.csv");
  assert.deepEqual(data.settings.inventorySummary.products.map(item => item.name), ["Two product"]);
  assert.deepEqual(data.campaigns.map(item => item.id), ["campaign-two"]);
  assert.deepEqual(data.operations.map(item => item.id), ["operation-two"]);
});


const inventoryHelperStart = app.indexOf("function buildInventorySummary(");
const inventoryHelperEnd = app.indexOf("function aiInventoryContext(", inventoryHelperStart);
const inventoryHelperSource = inventoryHelperStart >= 0 && inventoryHelperEnd > inventoryHelperStart ? app.slice(inventoryHelperStart, inventoryHelperEnd) : "";
if (!inventoryHelperSource) throw new Error("Could not locate inventory import normalizer");

test("inventory imports preserve every supported product instead of silently truncating", () => {
  const build = new Function(`${inventoryHelperSource}; return buildInventorySummary;`)();
  const rows = Array.from({ length: 750 }, (_, i) => ({ Product: `Product ${i + 1}`, Price: String(i + 1), Stock: "2" }));
  const summary = build(rows, "complete-stock.csv");
  assert.equal(summary.rowCount, 750);
  assert.equal(summary.products.length, 750);
  assert.equal(summary.products[0].name, "Product 1");
  assert.equal(summary.products.at(-1).name, "Product 750");
  assert.equal(summary.fileName, "complete-stock.csv");
});

test("inventory imports reject oversized sheets instead of saving partial stock", () => {
  const build = new Function(`${inventoryHelperSource}; return buildInventorySummary;`)();
  const tooManyRows = Array.from({ length: 5001 }, () => ({ Product: "Item" }));
  assert.throws(() => build(tooManyRows, "large.csv"), /up to 5,000 rows/);
  const tooManyProducts = Array.from({ length: 3001 }, (_, i) => ({ Product: `Item ${i}` }));
  assert.throws(() => build(tooManyProducts, "large.csv"), /up to 3,000 products/);
});

test("inventory imports reject sheets without a usable product column", () => {
  const build = new Function(`${inventoryHelperSource}; return buildInventorySummary;`)();
  assert.throws(() => build([{ "Unit Cost": "10", "Supplier Ref": "A1" }], "bad.csv"), /product\/name column/);
});


const inventorySyncStart = app.indexOf("async function saveCloudInventory()");
const inventorySyncEnd = app.indexOf("async function saveCloudProfile()", inventorySyncStart);
const inventorySyncSource = inventorySyncStart >= 0 && inventorySyncEnd > inventorySyncStart ? app.slice(inventorySyncStart, inventorySyncEnd) : "";
if (!inventorySyncSource) throw new Error("Could not locate cloud inventory uploader");

test("cloud inventory uploader sends every product in bounded chunks before activation", async () => {
  const inventory = {
    fileName: "full-stock.xlsx",
    rowCount: 450,
    uploadedAt: "2026-11-07T00:00:00.000Z",
    products: Array.from({ length: 450 }, (_, i) => ({ name: "Product " + i }))
  };
  const data = { settings: { activeBusinessId: "biz-one", inventorySummary: inventory } };
  const calls = [];
  const upload = new Function("data", "hasCloudSession", "apiRequest", "save", `${inventorySyncSource}; return saveCloudInventory;`)(
    data,
    () => true,
    async (path, options) => { calls.push({ path, options }); return { ok: true }; },
    () => true
  );
  assert.equal(await upload(), true);
  const chunks = calls.filter(call => call.options.method === "PUT" && call.path.includes("/inventory/") && !call.path.endsWith("/inventory"));
  assert.deepEqual(chunks.map(call => JSON.parse(call.options.body).products.length), [200, 200, 50]);
  const manifest = calls.find(call => call.path.endsWith("/inventory") && call.options.method === "PUT");
  assert.equal(JSON.parse(manifest.options.body).productCount, 450);
  assert.equal(data.settings.inventoryCloudSyncedAt, inventory.uploadedAt);
  assert.equal(data.settings.inventoryCloudStorageAvailable, true);
});

test("cloud inventory uploader keeps local stock when the server lacks the inventory endpoint", async () => {
  const data = { settings: { activeBusinessId: "biz-one", inventorySummary: { uploadedAt: "local", products: [{ name: "Local item" }] } } };
  const upload = new Function("data", "hasCloudSession", "apiRequest", "save", `${inventorySyncSource}; return saveCloudInventory;`)(
    data,
    () => true,
    async () => { throw new Error("Not found (404)"); },
    () => true
  );
  assert.equal(await upload(), false);
  assert.equal(data.settings.inventoryCloudStorageAvailable, false);
  assert.equal(data.settings.inventoryCloudSyncedAt, undefined);
});


const addBusinessSource = app.split("async function addBusinessProfile(){")[1]?.split("\nfunction businessProfilesPanel")[0]?.replace(/\\s*\\}\\s*$/, "");
if (!addBusinessSource) throw new Error("Could not locate business creation workflow");

test("failed business creation restores the complete previous workspace and removes the incomplete cloud profile", async () => {
  const data = {
    settings: {
      activeBusinessId: "biz-one",
      business: "Business One",
      inventorySummary: { fileName: "one.csv", rowCount: 1, products: [{ name: "One product" }] },
      businessProfiles: [{ id: "biz-one", business: "Business One" }]
    },
    campaigns: [{ id: "campaign-one", businessId: "biz-one" }],
    operations: [{ id: "operation-one", businessId: "biz-one" }],
    localCampaignsByBusiness: { "biz-archive": [{ id: "archived-campaign" }] }
  };
  const original = structuredClone(data);
  const calls = [];
  const add = new Function(
    "data", "hasCloudSession", "prompt", "syncCloud", "saveCloudProfile", "apiRequest",
    "syncCloudProfile", "refreshOperations", "save", "render", "notify",
    `return async function addBusinessProfile(){${addBusinessSource}}`
  )(
    data, () => true, () => "Business Two", async () => {}, async () => {},
    async (path, options = {}) => {
      calls.push({ path, options });
      if (options.method === "POST") return { business: { id: "biz-two", business: "Business Two" } };
      if (path === "/api/businesses/biz-two") throw new Error("Profile read failed");
      return { ok: true };
    },
    async () => {}, async () => {}, () => {}, () => {}, () => {}
  );
  await add();
  assert.deepEqual(data.settings, original.settings);
  assert.deepEqual(data.campaigns, original.campaigns);
  assert.deepEqual(data.operations, original.operations);
  assert.deepEqual(data.localCampaignsByBusiness, original.localCampaignsByBusiness);
  assert.equal(calls.some(call => call.path === "/api/businesses/biz-two" && call.options.method === "DELETE"), true);
});

test("new business creation starts with no inventory or inherited campaigns and operations", async () => {
  const data = {
    settings: {
      activeBusinessId: "biz-one",
      business: "Business One",
      inventorySummary: { fileName: "one.csv", rowCount: 1, products: [{ name: "One product" }] },
      businessProfiles: [{ id: "biz-one", business: "Business One" }]
    },
    campaigns: [{ id: "campaign-one", businessId: "biz-one" }],
    operations: [{ id: "operation-one", businessId: "biz-one" }]
  };
  const add = new Function(
    "data", "hasCloudSession", "prompt", "syncCloud", "saveCloudProfile", "apiRequest",
    "syncCloudProfile", "refreshOperations", "save", "render", "notify",
    `return async function(){${addBusinessSource}; return addBusinessProfile();}`
  )(
    data, () => true, () => "Business Two", async () => {}, async () => {},
    async (path, options = {}) => options.method === "POST"
      ? { business: { id: "biz-two", business: "Business Two" } }
      : { ok: true },
    async () => { data.settings.business = "Business Two"; data.settings.inventorySummary = null; },
    async () => { data.operations = []; },
    () => {}, () => {}, () => {}
  );
  await add();
  assert.equal(data.settings.activeBusinessId, "biz-two");
  assert.equal(data.settings.inventorySummary, null);
  assert.deepEqual(data.campaigns, []);
  assert.deepEqual(data.operations, []);
});
