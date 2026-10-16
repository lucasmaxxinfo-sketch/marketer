import worker from "../../../backend/worker.js";

Deno.test("health endpoint reports configured storage", async () => {
  const env = { MG_DATA: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }), delete: async () => {} } };
  const response = await worker.fetch(new Request("https://api.example/health"), env);
  if (response.status !== 200) throw new Error("Health endpoint should return 200");
  const body = await response.json();
  if (body.ok !== true || body.capabilities.storage !== true) throw new Error("Storage should be reported as configured");
});

Deno.test("unapproved origins are rejected", async () => {
  const env = { MG_DATA: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }), delete: async () => {} } };
  const response = await worker.fetch(new Request("https://api.example/health", {
    headers: { Origin: "https://invalid.example" },
  }), env);
  if (response.status !== 403) throw new Error("Unapproved origin should receive 403");
});
