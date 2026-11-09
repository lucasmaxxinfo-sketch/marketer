import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = join(ROOT, "backend/local/.env");
const TEMPLATE_FILE = join(ROOT, "backend/local/.env.example");
const DEFAULT_MODEL = "qwen3:4b-instruct";

function currentValue(content, key) {
  const line = content.split(/\r?\n/).find(item => item.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, "$2") : "";
}

export function configuredModel(content) {
  const configured = currentValue(content, "LOCAL_AI_MODEL");
  const model = !configured || configured === "qwen3:4b" ? DEFAULT_MODEL : configured;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(model)) {
    throw new Error("LOCAL_AI_MODEL must be a valid Ollama model name using letters, numbers, dots, underscores, colons, slashes or hyphens.");
  }
  return model;
}

function setValue(content, key, value) {
  const line = key + "=" + value;
  const pattern = new RegExp("^" + key + "=.*$", "m");
  return pattern.test(content) ? content.replace(pattern, line) : content.replace(/\s*$/, "\n") + line + "\n";
}

export function prepareEnvironment(template, existing = "") {
  let content = existing.trim() ? existing : template;
  const existingModel = currentValue(content, "LOCAL_AI_MODEL");
  if (!existingModel || existingModel === "qwen3:4b") content = setValue(content, "LOCAL_AI_MODEL", DEFAULT_MODEL);
  const generated = {};
  const secrets = {
    APP_LOGIN_PASSWORD: "change-this-owner-password",
    SESSION_SECRET: "replace-with-a-long-random-secret",
    SEARXNG_SECRET: "replace-with-a-long-random-searxng-secret"
  };
  for (const [key, placeholder] of Object.entries(secrets)) {
    const current = currentValue(content, key);
    if (!current || current === placeholder) {
      const value = randomBytes(key === "APP_LOGIN_PASSWORD" ? 24 : 32).toString("base64url");
      content = setValue(content, key, value);
      generated[key] = value;
    }
  }
  if (!currentValue(content, "APP_ORIGIN")) {
    content = setValue(content, "APP_ORIGIN", "https://lucasmaxxinfo-sketch.github.io");
  }
  return { content: content.trimEnd() + "\n", generated };
}

function command(program, args, label, timeout = 30 * 60 * 1000) {
  console.log("\n▶ " + label);
  const result = spawnSync(program, args, {
    cwd: ROOT,
    stdio: "inherit",
    timeout,
    shell: process.platform === "win32"
  });
  if (result.error) throw new Error(label + ": " + result.error.message);
  if (result.signal) throw new Error(label + " was interrupted (" + result.signal + ").");
  if (result.status !== 0) throw new Error(label + " failed with exit code " + result.status + ".");
}

async function waitForApi(timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch("http://127.0.0.1:8787/health", { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        if (data.ok) return data;
      }
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 2500));
  }
  throw new Error("The local API did not become healthy within two minutes. Check it with: docker compose logs --tail=100 marketing-genius-api");
}

async function testKiraChat(ownerPassword) {
  const login = await fetch("http://127.0.0.1:8787/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ownerPassword }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!login.ok) throw new Error("The local owner login check failed (HTTP " + login.status + ").");
  const { token } = await login.json();
  if (!token) throw new Error("The local API did not issue an owner session.");
  const response = await fetch("http://127.0.0.1:8787/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ message: "Reply with a short installation confirmation." }),
    signal: AbortSignal.timeout(120_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("Kira's local API-to-AI test failed (HTTP " + response.status + "). " + String(result.error || "No reply was returned."));
  }
  return result.reply.trim();
}

export async function install() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 24) throw new Error("Node.js 24 or newer is required to run this installer. Install the current Node.js LTS release, then run it again.");
  if (!existsSync(TEMPLATE_FILE)) throw new Error("The environment template is missing: " + TEMPLATE_FILE);

  console.log("MARKETING GENIUS · LOCAL INSTALLER");
  console.log("This keeps the database and AI model on this computer. No paid AI key is required.");
  command("docker", ["info"], "Check that Docker Desktop or Docker Engine is running", 30_000);
  command("docker", ["compose", "version"], "Check Docker Compose", 30_000);

  const template = readFileSync(TEMPLATE_FILE, "utf8");
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const prepared = prepareEnvironment(template, existing);
  writeFileSync(ENV_FILE, prepared.content, { mode: 0o600 });
  try { chmodSync(ENV_FILE, 0o600); } catch {}
  console.log("\n✓ Private configuration saved to backend/local/.env");
  console.log("✓ Existing owner settings and custom model choices were preserved.");
  console.log("✓ The legacy Qwen3 default is upgraded to the non-thinking Instruct model.");
  const ownerPassword = currentValue(prepared.content, "APP_LOGIN_PASSWORD");
  const model = configuredModel(prepared.content);
  if (prepared.generated.APP_LOGIN_PASSWORD) {
    console.log("\nSAVE YOUR NEW OWNER LOGIN PASSWORD NOW:");
    console.log(ownerPassword);
    console.log("It is stored in backend/local/.env, but the installer will not display it again.");
  }

  command("docker", ["compose", "up", "-d", "--build"], "Build and start the local API, Ollama and private SearXNG services");
  console.log("\nWaiting for the local API health check...");
  await waitForApi();

  command("docker", ["compose", "exec", "-T", "ollama", "ollama", "pull", model], "Download the local AI model " + model);
  console.log("\nChecking Kira through the actual local API...");
  const kiraReply = await testKiraChat(ownerPassword);
  await waitForApi();

  console.log("\n✓ Local API is responding at http://localhost:8787");
  console.log("✓ Ollama model " + model + " is downloaded.");
  console.log("✓ Owner login and Kira's API-to-model conversation both passed.");
  console.log("✓ Kira replied: " + kiraReply.slice(0, 180));
  console.log("✓ SQLite data is stored in the persistent Docker volume.");
  if (!prepared.generated.APP_LOGIN_PASSWORD) {
    console.log("\nYour existing owner password was preserved in backend/local/.env.");
  }
  console.log("\nNEXT: Open https://lucasmaxxinfo-sketch.github.io/marketer/");
  console.log("In Settings, connect the workspace API address http://localhost:8787 and sign in.");
  console.log("Keep this computer on and Docker running for Kira's scheduled work.");
  console.log("\nTo stop the local services later: docker compose down");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  install().catch(error => {
    console.error("\nINSTALLATION NOT COMPLETE: " + error.message);
    console.error("Your saved data and configuration have not been deleted.");
    process.exitCode = 1;
  });
}
