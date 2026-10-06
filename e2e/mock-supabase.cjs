// E2E 用の Supabase 互換テストサーバー（本番では使わない）
// GoTrue（認証）と PostgREST のサブセットを実 Postgres 上に実装。
// クエリは role=authenticated・request.jwt.claim.sub を設定して実行するため、本物の RLS とトリガーが効く。
// Storage は未実装（空レスポンス）。
const http = require("node:http");
const crypto = require("node:crypto");
const { Pool, types } = require("pg");
// PostgREST と同じく date は "YYYY-MM-DD"、numeric は数値で返す
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => Number(v));

const PORT = Number(process.env.PORT || 54321);
const SECRET = "test-secret-for-local-e2e-only-000000";
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
const users = new Map(); // email -> { id, password }
const refreshTokens = new Map();
const storageLog = [];

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function sign(payload) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(payload);
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
function verify(token) {
  if (!token) return null;
  const [h, p, s] = token.split(".");
  if (!s) return null;
  const exp = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (exp !== s) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.exp * 1000 < Date.now()) return null;
  return claims;
}
const userObj = (id, email) => ({
  id, aud: "authenticated", role: "authenticated", email, email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString(),
});
function session(id, email) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: id, email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  const refresh_token = crypto.randomBytes(16).toString("hex");
  refreshTokens.set(refresh_token, { id, email });
  return { access_token, refresh_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: userObj(id, email) };
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { status: 400 });
  return `"${s}"`;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : null;
}

async function withUser(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${claims ? "authenticated" : "anon"}`);
    if (claims) await client.query("select set_config('request.jwt.claim.sub', $1, true)", [claims.sub]);
    const r = await fn(client);
    await client.query("commit");
    return r;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function parseFilters(params, values) {
  const where = [];
  for (const [k, v] of params) {
    if (["select", "order", "offset", "limit", "on_conflict", "columns"].includes(k)) continue;
    const m = v.match(/^(eq|neq|gt|gte|lt|lte|is)\.(.*)$/);
    if (!m) throw Object.assign(new Error(`unsupported filter ${k}=${v}`), { status: 400 });
    const op = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[m[1]];
    if (m[1] === "is") where.push(`${ident(k)} is ${m[2] === "null" ? "null" : "not null"}`);
    else {
      values.push(m[2]);
      where.push(`${ident(k)}::text ${op} $${values.length}`);
    }
  }
  return where.length ? ` where ${where.join(" and ")}` : "";
}
const selectList = (s) => (!s || s === "*" ? "*" : s.split(",").map((c) => ident(c.trim())).join(", "));

async function rest(req, res, url, claims) {
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const params = url.searchParams;
  const accept = req.headers.accept || "";
  const prefer = req.headers.prefer || "";
  const single = accept.includes("vnd.pgrst.object");
  const body = ["POST", "PATCH"].includes(req.method) ? await readBody(req) : null;

  const rows = await withUser(claims, async (c) => {
    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      const r = await c.query(`select * from public.${ident(fn)}()`);
      return r.rows.length === 1 && Object.keys(r.rows[0]).length === 1 ? Object.values(r.rows[0])[0] : r.rows;
    }
    const table = `public.${ident(path)}`;
    const values = [];
    if (req.method === "GET") {
      let sql = `select ${selectList(params.get("select"))} from ${table}${parseFilters(params, values)}`;
      const order = params.get("order");
      if (order) {
        sql += " order by " + order.split(",").map((o) => {
          const [col, dir, nulls] = o.split(".");
          return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}${nulls ? ` ${nulls === "nullsfirst" ? "nulls first" : "nulls last"}` : ""}`;
        }).join(", ");
      }
      if (params.get("limit")) sql += ` limit ${Number(params.get("limit"))}`;
      if (params.get("offset")) sql += ` offset ${Number(params.get("offset"))}`;
      return (await c.query(sql, values)).rows;
    }
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const out = [];
      for (const item of items) {
        const cols = Object.keys(item);
        const vals = cols.map((k) => (Array.isArray(item[k]) ? item[k] : item[k]));
        let sql = `insert into ${table} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
        if (prefer.includes("resolution=merge-duplicates")) {
          const conflict = (params.get("on_conflict") || "id").split(",").map(ident);
          const updates = cols.filter((k) => !conflict.includes(`"${k}"`)).map((k) => `${ident(k)} = excluded.${ident(k)}`);
          sql += ` on conflict (${conflict.join(", ")}) do update set ${updates.join(", ")}`;
        }
        sql += ` returning ${selectList(params.get("select"))}`;
        out.push(...(await c.query(sql, vals)).rows);
      }
      return out;
    }
    if (req.method === "PATCH") {
      const cols = Object.keys(body);
      cols.forEach((k) => values.push(body[k]));
      const set = cols.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
      return (await c.query(`update ${table} set ${set}${parseFilters(params, values)} returning ${selectList(params.get("select"))}`, values)).rows;
    }
    if (req.method === "DELETE") {
      return (await c.query(`delete from ${table}${parseFilters(params, values)} returning *`, values)).rows;
    }
    throw Object.assign(new Error("method"), { status: 405 });
  });

  if (single) {
    if (!Array.isArray(rows)) return send(res, 200, rows);
    if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${rows.length} rows`, hint: null });
    return send(res, 200, rows[0]);
  }
  if (req.method !== "GET" && !prefer.includes("return=representation") && !path.startsWith("rpc/")) return send(res, 204);
  send(res, 200, rows, { "content-range": `0-${Math.max(0, (rows?.length ?? 1) - 1)}/*` });
}

async function auth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (path === "/signup" && req.method === "POST") {
    const { email, password } = await readBody(req);
    if (users.has(email)) return send(res, 422, { code: "user_already_exists", error_code: "user_already_exists", msg: "User already registered", message: "User already registered" });
    if (!password || password.length < 6) return send(res, 422, { code: "weak_password", error_code: "weak_password", msg: "Password should be at least 6 characters.", message: "Password should be at least 6 characters." });
    const id = crypto.randomUUID();
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    users.set(email, { id, password });
    return send(res, 200, session(id, email));
  }
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    const b = await readBody(req);
    if (grant === "password") {
      const u = users.get(b.email);
      if (!u || u.password !== b.password) return send(res, 400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials", message: "Invalid login credentials" });
      return send(res, 200, session(u.id, b.email));
    }
    if (grant === "refresh_token") {
      const r = refreshTokens.get(b.refresh_token);
      if (!r) return send(res, 400, { code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Invalid Refresh Token", message: "Invalid Refresh Token" });
      return send(res, 200, session(r.id, r.email));
    }
  }
  if (path === "/user" && req.method === "GET") {
    const claims = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    if (!claims) return send(res, 401, { code: "bad_jwt", error_code: "bad_jwt", msg: "invalid JWT", message: "invalid JWT" });
    return send(res, 200, userObj(claims.sub, claims.email));
  }
  if (path === "/logout") return send(res, 204);
  send(res, 404, { message: `auth ${path} not mocked` });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" });
      return res.end();
    }
    try {
      if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url);
      if (url.pathname.startsWith("/rest/v1")) {
        const claims = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
        return await rest(req, res, url, claims);
      }
      if (url.pathname.startsWith("/storage/v1")) {
        // Storage は記録のみ（画像の後片付けの検証用）
        console.log("storage", req.method, url.pathname);
        storageLog.push(`${req.method} ${url.pathname}`);
        if (url.pathname.endsWith("/object/sign/product-images")) {
          // 一括署名: { paths } → [{ path, signedURL }]
          const { paths = [] } = (await readBody(req)) || {};
          return send(res, 200, paths.map((p) => ({ path: p, signedURL: `/object/sign/product-images/${p}?token=test`, error: null })));
        }
        return send(res, 200, url.pathname.includes("/object/sign/") ? { signedURL: null } : []);
      }
      if (url.pathname === "/__test/storage-log") return send(res, 200, storageLog);
      send(res, 404, { message: "not found" });
    } catch (e) {
      const status = e.status || (e.code === "23505" ? 409 : e.code === "42501" ? 403 : 400);
      console.error(req.method, req.url, e.code, e.message);
      send(res, status, { code: e.code || "PGRST000", message: e.message, details: e.detail || null, hint: null });
    }
  })
  .listen(PORT, () => console.log(`mock supabase on :${PORT}`));
