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
