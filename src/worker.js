const SESSION_COOKIE = "tahsilat_session";
const SESSION_DAYS = 7;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const RESPONSIBLES = ["نورا", "محمد حسن", "المصريه"];

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || "Unexpected error" }, error.status || 500);
    }
  },
};

async function handleApi(request, env, url) {
  const method = request.method.toUpperCase();
  const publicRoutes = new Set(["/api/login"]);
  const user = publicRoutes.has(url.pathname) ? null : await requireUser(request, env);

  if (url.pathname === "/api/login" && method === "POST") return login(request, env);
  if (url.pathname === "/api/logout" && method === "POST") return logout(request, env, user);
  if (url.pathname === "/api/me" && method === "GET") return json({ user });
  if (url.pathname === "/api/bootstrap" && method === "GET") return bootstrap(env, user);
  if (url.pathname === "/api/dashboard" && method === "GET") return dashboard(env);
  if (url.pathname === "/api/collections" && method === "GET") return listCollections(env, url);
  if (url.pathname === "/api/collections" && method === "POST") return createCollection(request, env, user);
  if (url.pathname.startsWith("/api/collections/")) {
    const id = idFromPath(url.pathname);
    if (method === "PUT") return updateCollection(request, env, user, id);
    if (method === "DELETE") return deleteRecord(env, user, "collections", "collection", id);
  }
  if (url.pathname === "/api/expenses" && method === "GET") return listExpenses(env, url);
  if (url.pathname === "/api/expenses" && method === "POST") return createExpense(request, env, user);
  if (url.pathname.startsWith("/api/expenses/")) {
    const id = idFromPath(url.pathname);
    if (method === "PUT") return updateExpense(request, env, user, id);
    if (method === "DELETE") return deleteRecord(env, user, "expenses", "expense", id);
  }
  if (url.pathname === "/api/payment-methods" && method === "GET") return paymentMethods(env);
  if (url.pathname === "/api/payment-methods" && method === "POST") return createPaymentMethod(request, env, user);
  if (url.pathname === "/api/audit" && method === "GET") return auditLog(env, user);
  if (url.pathname === "/api/users" && method === "GET") return users(env, user);
  if (url.pathname === "/api/users" && method === "POST") return createUser(request, env, user);
  return json({ error: "Not found" }, 404);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

async function readJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function idFromPath(pathname) {
  const id = Number(pathname.split("/").pop());
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid record id");
  return id;
}

function nowIso() {
  return new Date().toISOString();
}

function parseDateValue(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function monthFromDate(value) {
  if (!value || !/^\d{4}-\d{2}/.test(value)) return null;
  return Number(value.slice(5, 7));
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Secure"];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

async function requireUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw new HttpError("Unauthorized", 401);
  const row = await env.DB.prepare(
    `SELECT users.id, users.username, users.display_name, users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ? AND sessions.expires_at > ? AND users.active = 1`
  ).bind(token, nowIso()).first();
  if (!row) throw new HttpError("Unauthorized", 401);
  return row;
}

async function login(request, env) {
  const payload = await readJson(request);
  const username = String(payload.username || "").trim().toLowerCase();
  const password = String(payload.password || "");
  if (!username || !password) return json({ error: "اسم المستخدم وكلمة المرور مطلوبان" }, 400);
  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND active = 1").bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: "بيانات الدخول غير صحيحة" }, 401);
  }
  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)")
    .bind(token, user.id, expires, nowIso())
    .run();
  await insertAudit(env, request, user, "LOGIN", "sessions", null, null, { username });
  return json(
    { user: publicUser(user) },
    200,
    { "set-cookie": cookieHeader(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 24 * 60 * 60 }) }
  );
}

async function logout(request, env, user) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  await insertAudit(env, request, user, "LOGOUT", "sessions", null, null, null);
  return json({ ok: true }, 200, { "set-cookie": cookieHeader(SESSION_COOKIE, "", { maxAge: 0 }) });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
  };
}

async function bootstrap(env, user) {
  const paymentMethods = await env.DB.prepare("SELECT id, name, note FROM payment_methods WHERE active = 1 ORDER BY name").all();
  const users = await env.DB.prepare("SELECT id, username, display_name, role, active, created_at FROM users ORDER BY username").all();
  return json({
    payment_methods: paymentMethods.results,
    users: users.results,
    responsibles: RESPONSIBLES,
    user,
  });
}

async function dashboard(env) {
  const totals = await env.DB.prepare(
    `SELECT
      COALESCE((SELECT SUM(amount) FROM collections),0) AS collections,
      COALESCE((SELECT SUM(amount) FROM expenses),0) AS expenses,
      COALESCE((SELECT SUM(amount) FROM collections),0)
        - COALESCE((SELECT SUM(amount) FROM expenses WHERE deducted_from_treasury=1),0) AS treasury,
      (SELECT COUNT(*) FROM collections) AS collection_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count`
  ).first();
  const byMonth = await env.DB.prepare(
    `WITH months(m) AS (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12))
     SELECT m AS month,
       COALESCE((SELECT SUM(amount) FROM collections c WHERE c.month=m),0) AS collections,
       COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.month=m),0) AS expenses,
       COALESCE((SELECT SUM(amount) FROM collections c WHERE c.month=m),0)
       - COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.month=m AND e.deducted_from_treasury=1),0) AS net
     FROM months ORDER BY m`
  ).all();
  const byResponsible = await env.DB.prepare(
    `SELECT responsible, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
     FROM collections GROUP BY responsible ORDER BY total DESC`
  ).all();
  const treasuryByMethod = await env.DB.prepare(
    `WITH methods AS (
      SELECT name FROM payment_methods WHERE active=1
      UNION SELECT payment_method FROM collections
      UNION SELECT payment_method FROM expenses
    )
    SELECT name AS payment_method,
      COALESCE((SELECT SUM(amount) FROM collections c WHERE c.payment_method=name),0) AS collections,
      COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.payment_method=name AND e.deducted_from_treasury=1),0) AS expenses,
      COALESCE((SELECT SUM(amount) FROM collections c WHERE c.payment_method=name),0)
      - COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.payment_method=name AND e.deducted_from_treasury=1),0) AS balance
    FROM methods ORDER BY balance DESC, name`
  ).all();
  const topClients = await env.DB.prepare(
    `SELECT client_name, SUM(amount) AS total, COUNT(*) AS count
     FROM collections GROUP BY client_name ORDER BY total DESC LIMIT 10`
  ).all();
  const daily = await env.DB.prepare(
    `SELECT entry_date, SUM(amount) AS total, COUNT(*) AS count
     FROM collections
     WHERE entry_date IS NOT NULL AND entry_date <> ''
     GROUP BY entry_date ORDER BY entry_date DESC LIMIT 30`
  ).all();
  const bestDay = await env.DB.prepare(
    `SELECT entry_date, SUM(amount) AS total FROM collections
     WHERE entry_date IS NOT NULL AND entry_date <> ''
     GROUP BY entry_date ORDER BY total DESC LIMIT 1`
  ).first();
  const bestMonth = await env.DB.prepare(
    `SELECT month, SUM(amount) AS total FROM collections
     WHERE month IS NOT NULL GROUP BY month ORDER BY total DESC LIMIT 1`
  ).first();
  return json({
    totals,
    by_month: byMonth.results,
    by_responsible: byResponsible.results,
    treasury_by_method: treasuryByMethod.results,
    top_clients: topClients.results,
    daily: daily.results,
    insights: {
      best_day: bestDay,
      best_month: bestMonth,
      largest_client: topClients.results[0] || null,
      best_responsible: byResponsible.results[0] || null,
    },
  });
}

function collectionData(payload) {
  const entryDate = parseDateValue(payload.entry_date);
  const month = payload.month ? Number(payload.month) : monthFromDate(entryDate);
  return {
    entry_date: entryDate,
    month,
    responsible: String(payload.responsible || "").trim(),
    client_name: String(payload.client_name || "").trim(),
    amount: Number(payload.amount || 0),
    payment_method: String(payload.payment_method || "غير محدد").trim(),
    note: String(payload.note || "").trim() || null,
  };
}

function expenseData(payload) {
  const entryDate = parseDateValue(payload.entry_date);
  const month = payload.month ? Number(payload.month) : monthFromDate(entryDate);
  return {
    entry_date: entryDate,
    month,
    expense_type: String(payload.expense_type || "مصروف").trim(),
    description: String(payload.description || "").trim(),
    amount: Number(payload.amount || 0),
    payment_method: String(payload.payment_method || "غير محدد").trim(),
    deducted_from_treasury: truthy(payload.deducted_from_treasury) ? 1 : 0,
    note: String(payload.note || "").trim() || null,
  };
}

function validateCollection(data) {
  if (!data.responsible) throw new HttpError("المسؤول مطلوب", 400);
  if (!data.client_name) throw new HttpError("اسم العميل مطلوب", 400);
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new HttpError("قيمة التحصيل يجب أن تكون أكبر من صفر", 400);
}

function validateExpense(data) {
  if (!data.description) throw new HttpError("وجه الصرف مطلوب", 400);
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new HttpError("قيمة المصروف يجب أن تكون أكبر من صفر", 400);
}

function truthy(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "نعم";
}

function filters(url, kind) {
  const clauses = [];
  const binds = [];
  const month = url.searchParams.get("month");
  const method = url.searchParams.get("method");
  const q = url.searchParams.get("q");
  if (month) {
    clauses.push("month = ?");
    binds.push(Number(month));
  }
  if (method) {
    clauses.push("payment_method = ?");
    binds.push(method);
  }
  if (q && kind === "collections") {
    clauses.push("(client_name LIKE ? OR note LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`);
  }
  if (q && kind === "expenses") {
    clauses.push("(description LIKE ? OR note LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Number(url.searchParams.get("limit") || 300), 2000);
  binds.push(limit);
  return { where, binds };
}

async function listCollections(env, url) {
  const { where, binds } = filters(url, "collections");
  const result = await env.DB.prepare(`SELECT * FROM collections ${where} ORDER BY COALESCE(entry_date, '') DESC, id DESC LIMIT ?`)
    .bind(...binds)
    .all();
  return json({ items: result.results });
}

async function createCollection(request, env, user) {
  assertCanWrite(user);
  const data = collectionData(await readJson(request));
  validateCollection(data);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO collections(entry_date, month, responsible, client_name, amount, payment_method, note, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.entry_date, data.month, data.responsible, data.client_name, data.amount, data.payment_method, data.note, now, now).run();
  await insertAudit(env, request, user, "INSERT", "collections", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function updateCollection(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM collections WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = collectionData(await readJson(request));
  validateCollection(data);
  await env.DB.prepare(
    `UPDATE collections
     SET entry_date=?, month=?, responsible=?, client_name=?, amount=?, payment_method=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(data.entry_date, data.month, data.responsible, data.client_name, data.amount, data.payment_method, data.note, nowIso(), id).run();
  await insertAudit(env, request, user, "UPDATE", "collections", id, before, data);
  return json({ ok: true });
}

async function listExpenses(env, url) {
  const { where, binds } = filters(url, "expenses");
  const result = await env.DB.prepare(`SELECT * FROM expenses ${where} ORDER BY COALESCE(entry_date, '') DESC, id DESC LIMIT ?`)
    .bind(...binds)
    .all();
  return json({ items: result.results });
}

async function createExpense(request, env, user) {
  assertCanWrite(user);
  const data = expenseData(await readJson(request));
  validateExpense(data);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO expenses(entry_date, month, expense_type, description, amount, payment_method, deducted_from_treasury, note, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.entry_date, data.month, data.expense_type, data.description, data.amount, data.payment_method, data.deducted_from_treasury, data.note, now, now).run();
  await insertAudit(env, request, user, "INSERT", "expenses", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function updateExpense(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = expenseData(await readJson(request));
  validateExpense(data);
  await env.DB.prepare(
    `UPDATE expenses
     SET entry_date=?, month=?, expense_type=?, description=?, amount=?, payment_method=?, deducted_from_treasury=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(data.entry_date, data.month, data.expense_type, data.description, data.amount, data.payment_method, data.deducted_from_treasury, data.note, nowIso(), id).run();
  await insertAudit(env, request, user, "UPDATE", "expenses", id, before, data);
  return json({ ok: true });
}

async function deleteRecord(env, user, tableName, entity, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  await env.DB.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(id).run();
  await insertAudit(env, null, user, "DELETE", tableName, id, before, null);
  return json({ ok: true });
}

async function paymentMethods(env) {
  const result = await env.DB.prepare("SELECT * FROM payment_methods WHERE active = 1 ORDER BY name").all();
  return json({ items: result.results });
}

async function createPaymentMethod(request, env, user) {
  assertCanWrite(user);
  const payload = await readJson(request);
  const name = String(payload.name || "").trim();
  if (!name) throw new HttpError("اسم طريقة الدفع مطلوب", 400);
  const result = await env.DB.prepare("INSERT OR IGNORE INTO payment_methods(name, note, active, created_at) VALUES(?, ?, 1, ?)")
    .bind(name, payload.note || null, nowIso())
    .run();
  await insertAudit(env, request, user, "INSERT", "payment_methods", result.meta.last_row_id || null, null, { name, note: payload.note || null });
  return json({ ok: true });
}

async function auditLog(env, user) {
  if (user.role !== "admin") throw new HttpError("Admins only", 403);
  const result = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300").all();
  return json({ items: result.results });
}

async function users(env, user) {
  if (user.role !== "admin") throw new HttpError("Admins only", 403);
  const result = await env.DB.prepare("SELECT id, username, display_name, role, active, created_at FROM users ORDER BY username").all();
  return json({ items: result.results });
}

async function createUser(request, env, user) {
  if (user.role !== "admin") throw new HttpError("Admins only", 403);
  const payload = await readJson(request);
  const username = String(payload.username || "").trim().toLowerCase();
  const displayName = String(payload.display_name || username).trim();
  const role = ["admin", "user", "viewer"].includes(payload.role) ? payload.role : "user";
  const password = String(payload.password || "");
  if (!username || password.length < 8) throw new HttpError("اسم المستخدم مطلوب وكلمة المرور 8 أحرف على الأقل", 400);
  const hash = await hashPassword(password);
  const result = await env.DB.prepare(
    "INSERT INTO users(username, display_name, password_hash, role, active, created_at) VALUES(?, ?, ?, ?, 1, ?)"
  ).bind(username, displayName, hash, role, nowIso()).run();
  await insertAudit(env, request, user, "INSERT", "users", result.meta.last_row_id, null, { username, displayName, role });
  return json({ id: result.meta.last_row_id });
}

function assertCanWrite(user) {
  if (!user || !["admin", "user"].includes(user.role)) {
    throw new HttpError("ليس لديك صلاحية للتعديل", 403);
  }
}

async function insertAudit(env, request, user, action, tableName, recordId, beforeData, afterData) {
  await env.DB.prepare(
    `INSERT INTO audit_logs(user_id, username, action, table_name, record_id, before_data, after_data, ip_address, user_agent, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user?.id || null,
    user?.username || "system",
    action,
    tableName,
    recordId,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    request ? clientIp(request) : "",
    request ? request.headers.get("user-agent") || "" : "",
    nowIso()
  ).run();
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$120000$${toBase64(salt)}$${toBase64(hash)}`;
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

async function pbkdf2(password, salt, iterations = 120000) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class HttpError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}
