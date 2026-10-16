import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("campaign generation explicitly consumes historical learnings", () => {
  assert.match(worker, /pastCampaignLearnings/);
  assert.match(worker, /prioritise repeated, relevant signals over one-off results/);
  assert.match(worker, /distinguish measured results from subjective notes/);
  assert.match(worker, /reuse a successful angle only when the current audience, offer and goal make it relevant/);
});

test("missing or sparse historical data cannot be treated as proof", () => {
  assert.match(worker, /treat missing metrics as unknown rather than zero/);
  assert.match(worker, /Do not infer causation from one campaign/);
  assert.match(worker, /If learnings conflict or are too sparse, say so briefly in strategy/);
});

test("historical notes cannot override current owner and business constraints", () => {
  assert.match(worker, /historical notes override current business facts, inventory, brand voice, owner instructions or platform constraints/);
});

test("frontend includes completed campaign learnings in the generation request", () => {
  assert.match(app, /pastCampaignLearnings/);
  assert.match(app, /\/api\/generate/);
});
