export type KVStorage = {
  get(key: string, type?: "json"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
};

export function createStorage(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetcher: typeof fetch = fetch,
): KVStorage {
  function authHeaders() {
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };
  }

  async function dbRequest(path: string, init: RequestInit = {}) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing.");
    }
    const response = await fetcher(`${supabaseUrl}/rest/v1/mg_kv${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`Supabase storage request failed (${response.status}).`);
    return response;
  }

  return {
    async get(key, type) {
      const query = `?key=eq.${encodeURIComponent(key)}&select=value,expires_at&limit=1`;
      const response = await dbRequest(query);
      const rows = await response.json();
      const row = rows[0];
      if (!row) return null;
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
        await dbRequest(`?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        return null;
      }
      if (type === "json") {
        try { return JSON.parse(row.value); } catch { return null; }
      }
      return row.value;
    },
    async put(key, value, options) {
      const expiresAt = options?.expirationTtl
        ? new Date(Date.now() + options.expirationTtl * 1000).toISOString()
        : null;
      await dbRequest("?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key, value, expires_at: expiresAt, updated_at: new Date().toISOString() }),
      });
    },
    async list(options = {}) {
      const prefix = (options.prefix ?? "").replace(/[,*()]/g, "");
      const limit = Math.max(1, Math.min(options.limit ?? 1000, 1000));
      const query = `?key=like.${encodeURIComponent(prefix)}%25&select=key&limit=${limit}`;
      const response = await dbRequest(query);
      const rows = await response.json();
      return { keys: rows.map((row: { key: string }) => ({ name: row.key })) };
    },
    async delete(key) {
      await dbRequest(`?key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    },
    async increment(key, ttlSeconds) {
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase server configuration is missing.");
      }
      if (!key.startsWith("login-attempt:") || !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) {
        throw new Error("Invalid login rate-limit counter request.");
      }
      const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/mg_increment_login_failures`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ p_key: key, p_ttl_seconds: ttlSeconds }),
      });
      if (!response.ok) throw new Error(`Supabase rate-limit request failed (${response.status}).`);
      const count: unknown = await response.json();
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
        throw new Error("Supabase rate-limit counter returned an invalid result.");
      }
      return count;
    },
  };
}
