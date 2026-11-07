import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { configuredModel, prepareEnvironment, ROOT } from "./install.mjs";

const template = [
  "APP_LOGIN_PASSWORD=change-this-owner-password",
  "SESSION_SECRET=replace-with-a-long-random-secret",
  "APP_ORIGIN=https://lucasmaxxinfo-sketch.github.io",
  "SEARXNG_SECRET=replace-with-a-long-random-searxng-secret",
  "LOCAL_AI_MODEL=qwen3:4b"
].join("\n");

test("installer replaces all placeholder secrets with independent strong values", () => {
  const result = prepareEnvironment(template);
  assert.equal(Object.keys(result.generated).length, 3);
  for (const key of ["APP_LOGIN_PASSWORD", "SESSION_SECRET", "SEARXNG_SECRET"]) {
    const value = result.generated[key];
    assert.ok(value.length >= 32);
    assert.notEqual(value, key);
    assert.ok(result.content.includes(key + "=" + value));
  }
  assert.equal(result.content.includes("change-this-owner-password"), false);
  assert.equal(result.content.includes("replace-with-a-long-random-secret"), false);
});

test("installer preserves existing owner settings and fills only missing secrets", () => {
  const existing = [
    "APP_LOGIN_PASSWORD=my-existing-owner-password",
    "SESSION_SECRET=my-existing-session-secret",
    "APP_ORIGIN=https://lucasmaxxinfo-sketch.github.io",
    "LOCAL_AI_MODEL=qwen3:4b"
  ].join("\n");
  const result = prepareEnvironment(template, existing);
  assert.equal(result.generated.APP_LOGIN_PASSWORD, undefined);
  assert.equal(result.generated.SESSION_SECRET, undefined);
  assert.ok(result.generated.SEARXNG_SECRET);
  assert.ok(result.content.includes("APP_LOGIN_PASSWORD=my-existing-owner-password"));
  assert.ok(result.content.includes("SESSION_SECRET=my-existing-session-secret"));
  assert.ok(result.content.includes("SEARXNG_SECRET=" + result.generated.SEARXNG_SECRET));
  assert.ok(result.content.includes("LOCAL_AI_MODEL=qwen3:4b"));
});

test("installer repairs placeholder secrets in an existing configuration", () => {
  const existing = template.replace("APP_LOGIN_PASSWORD=change-this-owner-password", "APP_LOGIN_PASSWORD=");
  const result = prepareEnvironment(template, existing);
  assert.ok(result.generated.APP_LOGIN_PASSWORD);
  assert.ok(result.content.includes("APP_LOGIN_PASSWORD=" + result.generated.APP_LOGIN_PASSWORD));
});

test("installer resolves the repository root from its own location", () => {
  assert.ok(existsSync(join(ROOT, "backend/local/.env.example")));
  assert.ok(existsSync(join(ROOT, "compose.yaml")));
});


test("installer uses the configured Ollama model and validates the model reference", () => {
  assert.equal(configuredModel(template), "qwen3:4b");
  assert.equal(configuredModel(template.replace("qwen3:4b", "qwen3:8b")), "qwen3:8b");
  assert.equal(configuredModel("LOCAL_AI_MODEL=community/model:latest"), "community/model:latest");
  assert.throws(() => configuredModel("LOCAL_AI_MODEL=qwen3:4b; echo unsafe"), /valid Ollama model name/);
});
