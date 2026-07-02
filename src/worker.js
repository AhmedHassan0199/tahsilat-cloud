const SESSION_COOKIE = "tahsilat_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 20000;
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
  const publicRoutes = new Set(["/api/login", "/api/login-page", "/api/health"]);
  const user = publicRoutes.has(url.pathname) ? null : await requireUser(request, env);

  if (url.pathname === "/api/health" && method === "GET") return health(env);
  if (url.pathname === "/api/login" && method === "POST") return login(request, env);
  if (url.pathname === "/api/login-page" && method === "POST") return loginPage(request, env);
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
  if (url.pathname === "/api/expense-accounts" && method === "GET") return expenseAccounts(env);
  if (url.pathname === "/api/reports/expenses" && method === "GET") return expenseReport(env, url);
  if (url.pathname === "/api/reports/expenses.xls" && method === "GET") return expenseReportExcel(env, url);
  if (url.pathname === "/api/reports/responsible-monthly" && method === "GET") return responsibleMonthlyReport(env);
  if (url.pathname === "/api/transfers" && method === "GET") return listTransfers(env);
  if (url.pathname === "/api/transfers" && method === "POST") return createTransfer(request, env, user);
  if (url.pathname.startsWith("/api/transfers/")) {
    const id = idFromPath(url.pathname);
    if (method === "PUT") return updateTransfer(request, env, user, id);
    if (method === "DELETE") return deleteRecord(env, user, "transfers", "transfer", id);
  }
  if (url.pathname === "/api/backup" && method === "GET") return backup(env, user);
  if (url.pathname === "/api/audit" && method === "GET") return auditLog(env, user);
  if (url.pathname === "/api/users" && method === "GET") return users(env, user);
  if (url.pathname === "/api/users" && method === "POST") return createUser(request, env, user);
  return json({ error: "Not found" }, 404);
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 303,
    headers: { location, ...headers },
  });
}

async function health(env) {
  const checks = {};
  checks.users = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  checks.sessions = await env.DB.prepare("SELECT COUNT(*) AS count FROM sessions").first();
  checks.collections = await env.DB.prepare("SELECT COUNT(*) AS count FROM collections").first();
  checks.transfers = await env.DB.prepare("SELECT COUNT(*) AS count FROM transfers").first().catch(() => ({ count: "migration_needed" }));
  checks.expense_accounts = await env.DB.prepare("SELECT COUNT(*) AS count FROM expense_accounts").first().catch(() => ({ count: "migration_needed" }));
  checks.payment_methods = await env.DB.prepare("SELECT COUNT(*) AS count FROM payment_methods").first();
  checks.admin = await env.DB.prepare("SELECT id, username, role, active FROM users WHERE username = 'admin'").first();
  return json({ ok: true, checks });
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
  try {
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
  } catch (error) {
    console.error("login_failed", error?.stack || error?.message || error);
    throw error;
  }
}

async function loginPage(request, env) {
  try {
    const form = await request.formData();
    const username = String(form.get("username") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const result = await authenticate(request, env, username, password);
    if (!result.ok) return redirect("/?login_error=1");
    return redirect(`/?login=${Date.now()}`, {
      "set-cookie": cookieHeader(SESSION_COOKIE, result.token, { maxAge: SESSION_DAYS * 24 * 60 * 60 }),
    });
  } catch (error) {
    console.error("login_page_failed", error?.stack || error?.message || error);
    return redirect("/?login_error=1");
  }
}

async function authenticate(request, env, username, password) {
  if (!username || !password) return { ok: false };
  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND active = 1").bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) return { ok: false };
  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)")
    .bind(token, user.id, expires, nowIso())
    .run();
  await insertAudit(env, request, user, "LOGIN", "sessions", null, null, { username });
  return { ok: true, user, token };
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
  const expenseAccounts = await env.DB.prepare("SELECT id, category, code, name FROM expense_accounts WHERE active = 1 ORDER BY category DESC, CAST(code AS INTEGER)").all().catch(() => ({ results: [] }));
  const users = await env.DB.prepare("SELECT id, username, display_name, role, active, created_at FROM users ORDER BY username").all();
  return json({
    payment_methods: paymentMethods.results,
    expense_accounts: expenseAccounts.results,
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
      UNION SELECT source_method FROM transfers
      UNION SELECT target_method FROM transfers
    )
    SELECT name AS payment_method,
      COALESCE((SELECT SUM(amount) FROM collections c WHERE c.payment_method=name),0) AS collections,
      COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.payment_method=name AND e.deducted_from_treasury=1),0) AS expenses,
      COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.target_method=name),0) AS transfers_in,
      COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.source_method=name),0) AS transfers_out,
      COALESCE((SELECT SUM(amount) FROM collections c WHERE c.payment_method=name),0)
      - COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.payment_method=name AND e.deducted_from_treasury=1),0)
      + COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.target_method=name),0)
      - COALESCE((SELECT SUM(amount) FROM transfers t WHERE t.source_method=name),0) AS balance
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

async function methodBalance(env, method) {
  const row = await env.DB.prepare(
    `SELECT
      COALESCE((SELECT SUM(amount) FROM collections WHERE payment_method = ?),0)
      - COALESCE((SELECT SUM(amount) FROM expenses WHERE payment_method = ? AND deducted_from_treasury = 1),0)
      + COALESCE((SELECT SUM(amount) FROM transfers WHERE target_method = ?),0)
      - COALESCE((SELECT SUM(amount) FROM transfers WHERE source_method = ?),0) AS balance`
  ).bind(method, method, method, method).first();
  return Number(row?.balance || 0);
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
    expense_account_id: Number(payload.expense_account_id || 0) || null,
    expense_code: null,
    expense_name: null,
    expense_category: null,
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
  if (!data.expense_account_id && !data.description) throw new HttpError("وجه الصرف مطلوب", 400);
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new HttpError("قيمة المصروف يجب أن تكون أكبر من صفر", 400);
}

async function applyExpenseAccount(env, data) {
  if (!data.expense_account_id) return data;
  const account = await env.DB.prepare("SELECT * FROM expense_accounts WHERE id = ? AND active = 1").bind(data.expense_account_id).first();
  if (!account) throw new HttpError("كود وجه الصرف غير صحيح", 400);
  data.expense_code = account.code;
  data.expense_name = account.name;
  data.expense_category = account.category;
  data.description = `${account.code} - ${account.name}`;
  return data;
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
  const data = await applyExpenseAccount(env, expenseData(await readJson(request)));
  validateExpense(data);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO expenses(entry_date, month, expense_type, expense_account_id, expense_code, expense_name, expense_category, description, amount, payment_method, deducted_from_treasury, note, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.entry_date, data.month, data.expense_type, data.expense_account_id, data.expense_code, data.expense_name, data.expense_category, data.description, data.amount, data.payment_method, data.deducted_from_treasury, data.note, now, now).run();
  await insertAudit(env, request, user, "INSERT", "expenses", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function updateExpense(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = await applyExpenseAccount(env, expenseData(await readJson(request)));
  validateExpense(data);
  await env.DB.prepare(
    `UPDATE expenses
     SET entry_date=?, month=?, expense_type=?, expense_account_id=?, expense_code=?, expense_name=?, expense_category=?, description=?, amount=?, payment_method=?, deducted_from_treasury=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(data.entry_date, data.month, data.expense_type, data.expense_account_id, data.expense_code, data.expense_name, data.expense_category, data.description, data.amount, data.payment_method, data.deducted_from_treasury, data.note, nowIso(), id).run();
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

async function expenseAccounts(env) {
  const result = await env.DB.prepare("SELECT id, category, code, name FROM expense_accounts WHERE active = 1 ORDER BY category DESC, CAST(code AS INTEGER)").all();
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

function reportDates(url) {
  return {
    dateFrom: parseDateValue(url.searchParams.get("date_from")) || "0000-01-01",
    dateTo: parseDateValue(url.searchParams.get("date_to")) || "9999-12-31",
  };
}

async function expenseReportData(env, url) {
  const { dateFrom, dateTo } = reportDates(url);
  const category = String(url.searchParams.get("expense_type") || "").trim();
  const codes = url.searchParams.getAll("code").map((code) => String(code || "").trim()).filter(Boolean);
  const filters = ["COALESCE(entry_date, '') >= ?", "COALESCE(entry_date, '') <= ?"];
  const binds = [dateFrom, dateTo];
  if (category) {
    filters.push("expense_category = ?");
    binds.push(category);
  }
  if (codes.length) {
    filters.push(`expense_code IN (${codes.map(() => "?").join(",")})`);
    binds.push(...codes);
  }
  const whereSql = filters.join(" AND ");
  const items = await env.DB.prepare(
    `SELECT id, entry_date, month, expense_type, expense_category, expense_code, expense_name, description, amount, payment_method, deducted_from_treasury, note
     FROM expenses
     WHERE ${whereSql}
     ORDER BY entry_date, id`
  ).bind(...binds).all();
  const totals = await env.DB.prepare(
    `SELECT COALESCE(expense_category, 'غير محدد') AS expense_category,
            COALESCE(expense_code, '') AS expense_code,
            COALESCE(expense_name, description, 'غير محدد') AS expense_name,
            SUM(amount) AS total,
            COUNT(*) AS count
     FROM expenses
     WHERE ${whereSql}
     GROUP BY expense_category, expense_code, expense_name
     ORDER BY expense_category, CAST(expense_code AS INTEGER), expense_name`
  ).bind(...binds).all();
  const totalAmount = items.results.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { date_from: dateFrom, date_to: dateTo, expense_type: category, codes, total: totalAmount, items: items.results, totals: totals.results };
}

async function expenseReport(env, url) {
  return json(await expenseReportData(env, url));
}

async function expenseReportExcel(env, url) {
  const data = await expenseReportData(env, url);
  const xml = expenseExcelXml(data);
  return new Response(xml, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="expenses-${data.date_from}-to-${data.date_to}.xls"`,
    },
  });
}

async function responsibleMonthlyReport(env) {
  const result = await env.DB.prepare(
    `WITH months(m) AS (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12))
     SELECT m AS month,
       COALESCE((SELECT SUM(amount) FROM collections WHERE month=m AND responsible='نورا'),0) AS noura,
       COALESCE((SELECT SUM(amount) FROM collections WHERE month=m AND responsible='محمد حسن'),0) AS mohamed_hassan,
       COALESCE((SELECT SUM(amount) FROM collections WHERE month=m AND responsible='المصريه'),0) AS egyptian,
       COALESCE((SELECT SUM(amount) FROM collections WHERE month=m),0) AS total
     FROM months
     ORDER BY m`
  ).all();
  return json({ items: result.results });
}

function expenseExcelXml(data) {
  const groups = new Map();
  data.totals.forEach((item) => {
    const category = item.expense_category || "غير محدد";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const period = `${data.date_from === "0000-01-01" ? "البداية" : data.date_from} - ${data.date_to === "9999-12-31" ? "النهاية" : data.date_to}`;
  const typeLabel = data.expense_type || "كل الأنواع";
  const selectedCodes = data.codes.length ? data.codes.join("، ") : "كل الأكواد";
  const rows = [
    excelRow(["تقرير المصروفات", "", "", ""], "Title", 4),
    excelRow(["الفترة", period, "النوع", typeLabel], "Meta"),
    excelRow(["الأكواد", selectedCodes, "الإجمالي", data.total], "Meta"),
    excelRow(["", "", "", ""], "Normal"),
  ];

  groups.forEach((items, category) => {
    const categoryTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    rows.push(excelRow([category, "", "", ""], "Section", 4));
    rows.push(excelRow(["رقم المصروف", "اسم المصروف", "عدد العمليات", "القيمة"], "Header"));
    items.forEach((item) => {
      rows.push(excelRow([
        item.expense_code || "",
        item.expense_name || "",
        item.count || 0,
        item.total || 0,
      ], "Normal"));
    });
    rows.push(excelRow(["", "إجمالي", "", categoryTotal], "Total"));
    rows.push(excelRow(["", "", "", ""], "Normal"));
  });

  if (!groups.size) {
    rows.push(excelRow(["لا توجد مصروفات مطابقة للفلاتر", "", "", ""], "Normal", 4));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>تقرير المصروفات</Title>
  <Author>تحصيلات</Author>
  <Created>${xmlEscape(nowIso())}</Created>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Title"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Size="16"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/><Borders>${excelBorders()}</Borders></Style>
  <Style ss:ID="Section"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Size="13"/><Interior ss:Color="#E2F0D9" ss:Pattern="Solid"/><Borders>${excelBorders()}</Borders></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><Borders>${excelBorders()}</Borders></Style>
  <Style ss:ID="Meta"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1"/><Borders>${excelBorders()}</Borders></Style>
  <Style ss:ID="Total"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/><Borders>${excelBorders()}</Borders></Style>
  <Style ss:ID="Normal"><Alignment ss:Horizontal="Center"/><Borders>${excelBorders()}</Borders></Style>
 </Styles>
 <Worksheet ss:Name="تقرير المصروفات">
  <Table>
   <Column ss:Width="95"/>
   <Column ss:Width="260"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
${rows.join("\n")}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayRightToLeft/>
   <Print>
    <ValidPrinterInfo/>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

function excelRow(cells, style = "Normal", mergeAcross = 0) {
  if (mergeAcross > 1) {
    return `   <Row><Cell ss:StyleID="${style}" ss:MergeAcross="${mergeAcross - 1}"><Data ss:Type="${typeof cells[0] === "number" ? "Number" : "String"}">${xmlEscape(cells[0])}</Data></Cell></Row>`;
  }
  return `   <Row>${cells.map((cell, index) => {
    return `<Cell ss:StyleID="${style}"><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`;
  }).join("")}</Row>`;
}

function excelBorders() {
  return `<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6A6A6"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6A6A6"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6A6A6"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A6A6A6"/>`;
}

function excelXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report">
  <Table>
${rows.map((row) => `   <Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`).join("\n")}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayRightToLeft/>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[char]);
}

function transferData(payload) {
  return {
    entry_date: parseDateValue(payload.entry_date) || new Date().toISOString().slice(0, 10),
    source_method: String(payload.source_method || "").trim(),
    target_method: String(payload.target_method || "").trim(),
    amount: Number(payload.amount || 0),
    note: String(payload.note || "").trim() || null,
  };
}

function validateTransfer(data) {
  if (!data.source_method) throw new HttpError("طريقة الدفع المصدر مطلوبة", 400);
  if (!data.target_method) throw new HttpError("طريقة الدفع الهدف مطلوبة", 400);
  if (data.source_method === data.target_method) throw new HttpError("لا يمكن التوسيط لنفس طريقة الدفع", 400);
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new HttpError("قيمة التوسيط يجب أن تكون أكبر من صفر", 400);
}

async function listTransfers(env) {
  const result = await env.DB.prepare(
    `SELECT transfers.*, users.display_name AS created_by_name
     FROM transfers
     LEFT JOIN users ON users.id = transfers.created_by
     ORDER BY COALESCE(entry_date, '') DESC, id DESC
     LIMIT 500`
  ).all();
  return json({ items: result.results });
}

async function createTransfer(request, env, user) {
  assertCanWrite(user);
  const data = transferData(await readJson(request));
  validateTransfer(data);
  const available = await methodBalance(env, data.source_method);
  if (data.amount > available) {
    throw new HttpError(`الرصيد المتاح في المصدر ${available} ولا يكفي للتوسيط`, 400);
  }
  const result = await env.DB.prepare(
    `INSERT INTO transfers(entry_date, source_method, target_method, amount, note, created_by, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.entry_date, data.source_method, data.target_method, data.amount, data.note, user.id, nowIso()).run();
  await insertAudit(env, request, user, "INSERT", "transfers", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function updateTransfer(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM transfers WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = transferData(await readJson(request));
  validateTransfer(data);
  const currentSourceBalance = await methodBalance(env, data.source_method);
  const available = currentSourceBalance
    + (before.source_method === data.source_method ? Number(before.amount || 0) : 0)
    - (before.target_method === data.source_method ? Number(before.amount || 0) : 0);
  if (data.amount > available) {
    throw new HttpError(`الرصيد المتاح في المصدر ${available} ولا يكفي للتوسيط`, 400);
  }
  await env.DB.prepare(
    `UPDATE transfers
     SET entry_date=?, source_method=?, target_method=?, amount=?, note=?
     WHERE id=?`
  ).bind(data.entry_date, data.source_method, data.target_method, data.amount, data.note, id).run();
  await insertAudit(env, request, user, "UPDATE", "transfers", id, before, data);
  return json({ ok: true });
}

async function auditLog(env, user) {
  if (user.role !== "admin") throw new HttpError("Admins only", 403);
  const result = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300").all();
  return json({ items: result.results });
}

async function backup(env, user) {
  if (user.role !== "admin") throw new HttpError("Admins only", 403);
  const tables = {};
  for (const table of ["users", "payment_methods", "expense_accounts", "collections", "expenses", "transfers", "audit_logs"]) {
    const result = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    tables[table] = result.results.map((row) => {
      if (table !== "users") return row;
      const copy = { ...row };
      delete copy.password_hash;
      return copy;
    });
  }
  return json({
    exported_at: nowIso(),
    format: "tahsilat-d1-json-v1",
    note: "Password hashes and sessions are intentionally excluded from browser backups.",
    tables,
  });
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
  return `pbkdf2$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
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

async function pbkdf2(password, salt, iterations = PASSWORD_ITERATIONS) {
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
