import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import worker from "../worker.js";

const MAX_BODY = 100_000;
const DAY_MS = 86_400_000;

export class SQLiteKV {
  constructor(filename = ":memory:") {
    if (filename !== ":memory:") mkdirSync(dirname(resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS kv_expiry ON kv(expires_at);
    `);
    this.getStmt = this.db.prepare("SELECT value, expires_at FROM kv WHERE key = ?");
    this.putStmt = this.db.prepare("INSERT INTO kv(key,value,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at");
    this.deleteStmt = this.db.prepare("DELETE FROM kv WHERE key = ?");
  }
  async get(key, type) {
    const row = this.getStmt.get(String(key));
    if (!row) return null;
    if (row.expires_at && row.expires_at <= Date.now()) {
      this.deleteStmt.run(String(key));
      return null;
    }
    return type === "json" ? JSON.parse(row.value) : row.value;
  }
  async put(key, value, options = {}) {
    const expires = Number(options.expirationTtl) > 0 ? Date.now() + Number(options.expirationTtl) * 1000 : null;
    this.putStmt.run(String(key), String(value), expires);
  }
  async delete(key) { this.deleteStmt.run(String(key)); }
  async list({ prefix = "", limit = 1000, cursor } = {}) {
    const offset = cursor ? Number(Buffer.from(cursor, "base64url").toString("utf8")) : 0;
    const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 1000));
    const rows = this.db.prepare("SELECT key FROM kv WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY key LIMIT ? OFFSET ?")
      .all(String(prefix).replace(/[\\%_]/g, "\\$&") + "%", Date.now(), safeLimit + 1, safeOffset);
    const more = rows.length > safeLimit;
    const keys = rows.slice(0, safeLimit).map(row => ({ name: row.key }));
    return { keys, list_complete: !more, ...(more ? { cursor: Buffer.from(String(safeOffset + safeLimit)).toString("base64url") } : {}) };
  }
  close() { this.db.close(); }
}

function makeEnv(kv, source = process.env) {
  const env = {
    MG_DATA: kv,
    APP_ORIGIN: source.APP_ORIGIN || "http://localhost:4173",
    APP_LOGIN_PASSWORD: source.APP_LOGIN_PASSWORD || "",
    SESSION_SECRET: source.SESSION_SECRET || "",
    OPENAI_API_KEY: source.OPENAI_API_KEY || "",
    OPENAI_MODEL: source.OPENAI_MODEL || "gpt-4.1-mini",
    OPENAI_RESEARCH_MODEL: source.OPENAI_RESEARCH_MODEL || "gpt-6-astra",
    META_PAGE_ID: source.META_PAGE_ID || "",
    META_PAGE_ACCESS_TOKEN: source.META_PAGE_ACCESS_TOKEN || "",
    META_INSTAGRAM_ACCOUNT_ID: source.META_INSTAGRAM_ACCOUNT_ID || ""
  };
  return env;
}

export function createLocalService({ database = process.env.MG_DATABASE_PATH || "./data/marketing-genius.sqlite", env: source = process.env, logger = console } = {}) {
  const kv = new SQLiteKV(database);
  const env = makeEnv(kv, source);
  let closed = false;
  let lastCronDay = "";
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > MAX_BODY) {
          outgoing.writeHead(413, { "Content-Type": "application/json" });
          outgoing.end(JSON.stringify({ error: "Request too large." }));
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
        else if (value !== undefined) headers.set(key, value);
      }
      if (!headers.has("origin") && env.APP_ORIGIN.startsWith("http://localhost")) headers.set("origin", env.APP_ORIGIN);
      const method = incoming.method || "GET";
      const body = chunks.length && method !== "GET" && method !== "HEAD" ? Buffer.concat(chunks) : undefined;
      const request = new Request(new URL(incoming.url || "/", "http://localhost"), { method, headers, ...(body ? { body } : {}) });
      const response = await worker.fetch(request, env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      logger.error?.("Local API request failed:", error);
      if (!outgoing.headersSent) outgoing.writeHead(500, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ error: "The local API could not complete this request." }));
    }
  });

  const cronTime = /^([01]\\d|2[0-3]):([0-5]\\d)$/.test(source.RESEARCH_CRON_UTC || "14:00") ? (source.RESEARCH_CRON_UTC || "14:00") : "14:00";
  const tick = async () => {
    if (closed) return;
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const clock = now.toISOString().slice(11, 16);
    if (clock !== cronTime || lastCronDay === day) return;
    lastCronDay = day;
    const marker = "local-cron-fired:" + day;
    if (await kv.get(marker)) return;
    await kv.put(marker, now.toISOString());
    const pending = [];
    try {
      await worker.scheduled({ scheduledTime: now.getTime(), cron: "local-daily-research" }, env, { waitUntil(promise) { pending.push(Promise.resolve(promise)); } });
      await Promise.all(pending);
      logger.info?.("Kira scheduled research trigger completed for", day);
    } catch (error) {
      logger.error?.("Kira scheduled research trigger failed:", error);
    }
  };
  const timer = setInterval(() => { void tick(); }, 15_000);
  timer.unref?.();

  return {
    server, kv, env,
    listen(port = Number(source.PORT || 8787), host = source.HOST || "127.0.0.1") {
      return new Promise((resolveListen, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolveListen(server.address());
        });
      });
    },
    async close() {
      closed = true;
      clearInterval(timer);
      if (server.listening) await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
      kv.close();
    }
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const service = createLocalService();
  const address = await service.listen();
  console.log(`Marketing Genius local API listening on http://${address.address}:${address.port}`);
  console.log("SQLite database:", resolve(process.env.MG_DATABASE_PATH || "./data/marketing-genius.sqlite"));
  console.log("Daily research schedule (UTC):", process.env.RESEARCH_CRON_UTC || "14:00");
  const stop = async () => { await service.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
