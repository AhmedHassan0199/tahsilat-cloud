const SESSION_COOKIE = "tahsilat_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 20000;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const RESPONSIBLES = ["نورا", "محمد حسن", "المصريه"];
const COLLECTION_TYPES = ["كرومو", "منتج تام علب", "منتج تام اكواب", "قص", "طباعة", "دشت", "أخرى"];
const CUSTODY_METHOD = "عهدة";
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

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
  if (url.pathname === "/api/customers" && method === "GET") return listCustomers(env);
  if (url.pathname === "/api/customers" && method === "POST") return createCustomer(request, env, user);
  if (url.pathname === "/api/supply-orders" && method === "GET") return listSupplyOrders(env);
  if (url.pathname === "/api/supply-orders" && method === "POST") return createSupplyOrder(request, env, user);
  if (url.pathname.startsWith("/api/supply-orders/")) {
    const id = idFromPath(url.pathname);
    if (method === "PUT") return updateSupplyOrder(request, env, user, id);
    if (method === "DELETE") return deleteRecord(env, user, "supply_orders", "supply_order", id);
  }
  if (url.pathname === "/api/delivery-notes" && method === "GET") return listDeliveryNotes(env);
  if (url.pathname === "/api/delivery-notes" && method === "POST") return createDeliveryNote(request, env, user);
  if (url.pathname.startsWith("/api/delivery-notes/")) {
    const id = idFromPath(url.pathname);
    if (method === "PUT") return updateDeliveryNote(request, env, user, id);
    if (method === "DELETE") return deleteDeliveryNote(env, user, id);
  }
  if (url.pathname === "/api/invoices" && method === "GET") return listInvoices(env);
  if (url.pathname === "/api/invoices" && method === "POST") return createInvoice(request, env, user);
  if (url.pathname === "/api/payment-methods" && method === "GET") return paymentMethods(env);
  if (url.pathname === "/api/payment-methods" && method === "POST") return createPaymentMethod(request, env, user);
  if (url.pathname === "/api/expense-accounts" && method === "GET") return expenseAccounts(env);
  if (url.pathname === "/api/reports/expenses" && method === "GET") return expenseReport(env, url);
  if ((url.pathname === "/api/reports/expenses.xlsx" || url.pathname === "/api/reports/expenses.xls") && method === "GET") return expenseReportXlsx(env, url);
  if (url.pathname === "/api/reports/collections" && method === "GET") return collectionReport(env, url);
  if (url.pathname === "/api/reports/collections.xlsx" && method === "GET") return collectionReportXlsx(env, url);
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
  checks.customers = await env.DB.prepare("SELECT COUNT(*) AS count FROM customers").first().catch(() => ({ count: "migration_needed" }));
  checks.custody_holders = await env.DB.prepare("SELECT COUNT(*) AS count FROM custody_holders").first().catch(() => ({ count: "migration_needed" }));
  checks.supply_orders = await env.DB.prepare("SELECT COUNT(*) AS count FROM supply_orders").first().catch(() => ({ count: "migration_needed" }));
  checks.delivery_notes = await env.DB.prepare("SELECT COUNT(*) AS count FROM delivery_notes").first().catch(() => ({ count: "migration_needed" }));
  checks.invoices = await env.DB.prepare("SELECT COUNT(*) AS count FROM invoices").first().catch(() => ({ count: "migration_needed" }));
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
  const customers = await env.DB.prepare("SELECT id, name FROM customers WHERE active = 1 ORDER BY name").all().catch(() => ({ results: [] }));
  const custodyHolders = await env.DB.prepare("SELECT id, name FROM custody_holders WHERE active = 1 ORDER BY name").all().catch(() => ({ results: [] }));
  const designs = await env.DB.prepare("SELECT id, name FROM designs WHERE active = 1 ORDER BY name").all().catch(() => ({ results: [] }));
  const productSizes = await env.DB.prepare("SELECT id, name FROM product_sizes WHERE active = 1 ORDER BY name").all().catch(() => ({ results: [] }));
  const materials = await env.DB.prepare("SELECT id, name FROM materials WHERE active = 1 ORDER BY name").all().catch(() => ({ results: [] }));
  const users = await env.DB.prepare("SELECT id, username, display_name, role, active, created_at FROM users ORDER BY username").all();
  return json({
    payment_methods: paymentMethods.results,
    expense_accounts: expenseAccounts.results,
    customers: customers.results,
    custody_holders: custodyHolders.results,
    designs: designs.results,
    product_sizes: productSizes.results,
    materials: materials.results,
    users: users.results,
    responsibles: RESPONSIBLES,
    collection_types: COLLECTION_TYPES,
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
  const selectedType = String(payload.collection_type || "").trim();
  const otherType = String(payload.collection_type_other || "").trim();
  const collectionType = selectedType === "أخرى" ? otherType : selectedType;
  return {
    entry_date: entryDate,
    month,
    responsible: String(payload.responsible || "").trim(),
    customer_id: Number(payload.customer_id || 0) || null,
    client_name: String(payload.client_name || "").trim(),
    collection_type: collectionType || null,
    collection_type_other: selectedType === "أخرى" ? otherType || null : null,
    amount: Number(payload.amount || 0),
    payment_method: String(payload.payment_method || "غير محدد").trim(),
    custody_holder: String(payload.custody_holder || "").trim(),
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
  if (!data.customer_id) throw new HttpError("العميل مطلوب", 400);
  if (!data.client_name) throw new HttpError("اسم العميل مطلوب", 400);
  if (!data.collection_type) throw new HttpError("نوع التحصيل مطلوب", 400);
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new HttpError("قيمة التحصيل يجب أن تكون أكبر من صفر", 400);
}

async function applyCustomer(env, data) {
  if (!data.customer_id) return data;
  const customer = await env.DB.prepare("SELECT id, name FROM customers WHERE id = ? AND active = 1").bind(data.customer_id).first();
  if (!customer) throw new HttpError("العميل غير صحيح", 400);
  data.client_name = customer.name;
  return data;
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

function normalizeCustomerName(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedCustomerKey(value) {
  return normalizeCustomerName(value)
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function normalizeCustodyName(value) {
  return normalizeCustomerName(value);
}

function normalizedCustodyKey(value) {
  return normalizedCustomerKey(value);
}

function isCustodyMethod(value) {
  return value === CUSTODY_METHOD || String(value || "").startsWith(`${CUSTODY_METHOD} - `);
}

function custodyMethodName(holderName) {
  return `${CUSTODY_METHOD} - ${holderName}`;
}

async function ensureCustodyHolder(env, name) {
  const cleanName = normalizeCustodyName(name);
  if (!cleanName) throw new HttpError("اسم صاحب العهدة مطلوب", 400);
  const normalized = normalizedCustodyKey(cleanName);
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO custody_holders(name, normalized_name, active, created_at, updated_at)
     VALUES(?, ?, 1, ?, ?)
     ON CONFLICT(normalized_name) DO UPDATE SET active=1, name=excluded.name, updated_at=excluded.updated_at`
  ).bind(cleanName, normalized, now, now).run();
  return cleanName;
}

async function applyCollectionCustody(env, data) {
  if (!isCustodyMethod(data.payment_method)) return data;
  const holderName = await ensureCustodyHolder(env, data.custody_holder || data.payment_method.replace(`${CUSTODY_METHOD} - `, ""));
  data.custody_holder = holderName;
  data.payment_method = custodyMethodName(holderName);
  return data;
}

async function applyTransferCustody(env, data) {
  if (isCustodyMethod(data.source_method)) {
    const holderName = await ensureCustodyHolder(env, data.source_custody_holder || data.source_method.replace(`${CUSTODY_METHOD} - `, ""));
    data.source_custody_holder = holderName;
    data.source_method = custodyMethodName(holderName);
  }
  if (isCustodyMethod(data.target_method)) {
    const holderName = await ensureCustodyHolder(env, data.target_custody_holder || data.target_method.replace(`${CUSTODY_METHOD} - `, ""));
    data.target_custody_holder = holderName;
    data.target_method = custodyMethodName(holderName);
  }
  return data;
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
    clauses.push("(client_name LIKE ? OR collection_type LIKE ? OR note LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
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

async function listCustomers(env) {
  const result = await env.DB.prepare(
    `SELECT customers.id, customers.name, customers.active, customers.created_at,
            COALESCE(SUM(collections.amount), 0) AS total_collections,
            COUNT(collections.id) AS collection_count,
            MAX(collections.entry_date) AS last_collection_date
     FROM customers
     LEFT JOIN collections ON collections.customer_id = customers.id
     WHERE customers.active = 1
     GROUP BY customers.id
     ORDER BY total_collections DESC, collection_count DESC, customers.name`
  ).all();
  return json({ items: result.results });
}

async function createCustomer(request, env, user) {
  assertCanWrite(user);
  const payload = await readJson(request);
  const name = normalizeCustomerName(payload.name || "");
  if (!name) throw new HttpError("اسم العميل مطلوب", 400);
  const normalized = normalizedCustomerKey(name);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO customers(name, normalized_name, active, created_at, updated_at)
     VALUES(?, ?, 1, ?, ?)
     ON CONFLICT(normalized_name) DO UPDATE SET active=1, name=excluded.name, updated_at=excluded.updated_at`
  ).bind(name, normalized, now, now).run();
  const customer = await env.DB.prepare("SELECT id, name FROM customers WHERE normalized_name = ?").bind(normalized).first();
  await insertAudit(env, request, user, "INSERT", "customers", customer?.id || result.meta.last_row_id || null, null, { name, normalized_name: normalized });
  return json({ id: customer?.id || result.meta.last_row_id, name });
}

async function listSupplyOrders(env) {
  const result = await env.DB.prepare(
    `SELECT supply_orders.*, users.display_name AS created_by_name
     FROM supply_orders
     LEFT JOIN users ON users.id = supply_orders.created_by
     ORDER BY COALESCE(order_date, '') DESC, id DESC
     LIMIT 300`
  ).all();
  return json({ items: result.results });
}

function supplyOrderData(payload) {
  return {
    order_date: parseDateValue(payload.order_date) || new Date().toISOString().slice(0, 10),
    customer_id: Number(payload.customer_id || 0) || null,
    new_customer_name: normalizeCustomerName(payload.new_customer_name || ""),
    design_id: Number(payload.design_id || 0) || null,
    new_design_name: normalizeCustomerName(payload.new_design_name || ""),
    size_id: Number(payload.size_id || 0) || null,
    new_size_name: normalizeCustomerName(payload.new_size_name || ""),
    material_id: Number(payload.material_id || 0) || null,
    new_material_name: normalizeCustomerName(payload.new_material_name || ""),
    quantity_unit: ["كيلو", "كرتونه"].includes(payload.quantity_unit) ? payload.quantity_unit : "كيلو",
    quantity_amount: Number(payload.quantity_amount || 0),
    price_without_cover: Number(payload.price_without_cover || 0),
    price_with_cover: Number(payload.price_with_cover || 0),
    serial_color_price: Number(payload.serial_color_price || 0),
    delivery_cost_party: ["المصنع", "العميل"].includes(payload.delivery_cost_party) ? payload.delivery_cost_party : "المصنع",
    supply_date: parseDateValue(payload.supply_date) || null,
    print_approval_status: String(payload.print_approval_status || "").trim() || null,
    cylinder_colors_count: String(payload.cylinder_colors_count || "").trim() || null,
    delivery_duration: String(payload.delivery_duration || "").trim() || null,
    payment_method: String(payload.payment_method || "").trim() || null,
    delivery_place: String(payload.delivery_place || "").trim() || null,
    note: String(payload.note || "").trim() || null,
  };
}

async function createSupplyOrder(request, env, user) {
  assertCanWrite(user);
  const data = await prepareSupplyOrder(env, request, user, await readJson(request));
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO supply_orders(order_date, customer_id, customer_name, design_id, design_name, size_id, size_name, material_id, material_name, quantity_unit, quantity_amount, price_without_cover, price_with_cover, serial_color_price, delivery_cost_party, supply_date, print_approval_status, cylinder_colors_count, delivery_duration, payment_method, delivery_place, note, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.order_date,
    data.customer_id,
    data.customer_name,
    data.design_id,
    data.design_name,
    data.size_id,
    data.size_name,
    data.material_id,
    data.material_name,
    data.quantity_unit,
    data.quantity_amount,
    data.price_without_cover,
    data.price_with_cover,
    data.serial_color_price,
    data.delivery_cost_party,
    data.supply_date,
    data.print_approval_status,
    data.cylinder_colors_count,
    data.delivery_duration,
    data.payment_method,
    data.delivery_place,
    data.note,
    user.id,
    now,
    now
  ).run();
  await insertAudit(env, request, user, "INSERT", "supply_orders", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function prepareSupplyOrder(env, request, user, payload) {
  const data = supplyOrderData(payload);
  const customer = await resolveSupplyCustomer(env, request, user, data);
  const design = await resolveLookup(env, request, user, "designs", data.design_id, data.new_design_name, "اسم التصميم مطلوب");
  const size = await resolveLookup(env, request, user, "product_sizes", data.size_id, data.new_size_name, "المقاس المطلوب مطلوب");
  const material = await resolveLookup(env, request, user, "materials", data.material_id, data.new_material_name, "الخامة مطلوبة");
  if (!Number.isFinite(data.quantity_amount) || data.quantity_amount <= 0) throw new HttpError("الكمية المطلوبة يجب أن تكون أكبر من صفر", 400);
  if (!Number.isFinite(data.price_without_cover) || data.price_without_cover < 0) throw new HttpError("السعر بدون غطاء غير صحيح", 400);
  if (!Number.isFinite(data.price_with_cover) || data.price_with_cover < 0) throw new HttpError("السعر بالغطاء غير صحيح", 400);
  if (!Number.isFinite(data.serial_color_price) || data.serial_color_price < 0) throw new HttpError("سعر السريل للون واحد غير صحيح", 400);
  return {
    ...data,
    customer_id: customer.id,
    customer_name: customer.name,
    design_id: design.id,
    design_name: design.name,
    size_id: size.id,
    size_name: size.name,
    material_id: material.id,
    material_name: material.name,
  };
}

async function updateSupplyOrder(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM supply_orders WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = await prepareSupplyOrder(env, request, user, await readJson(request));
  await env.DB.prepare(
    `UPDATE supply_orders
     SET order_date=?, customer_id=?, customer_name=?, design_id=?, design_name=?, size_id=?, size_name=?, material_id=?, material_name=?, quantity_unit=?, quantity_amount=?, price_without_cover=?, price_with_cover=?, serial_color_price=?, delivery_cost_party=?, supply_date=?, print_approval_status=?, cylinder_colors_count=?, delivery_duration=?, payment_method=?, delivery_place=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(
    data.order_date,
    data.customer_id,
    data.customer_name,
    data.design_id,
    data.design_name,
    data.size_id,
    data.size_name,
    data.material_id,
    data.material_name,
    data.quantity_unit,
    data.quantity_amount,
    data.price_without_cover,
    data.price_with_cover,
    data.serial_color_price,
    data.delivery_cost_party,
    data.supply_date,
    data.print_approval_status,
    data.cylinder_colors_count,
    data.delivery_duration,
    data.payment_method,
    data.delivery_place,
    data.note,
    nowIso(),
    id
  ).run();
  await insertAudit(env, request, user, "UPDATE", "supply_orders", id, before, data);
  return json({ ok: true });
}

async function resolveSupplyCustomer(env, request, user, data) {
  if (data.customer_id) {
    const customer = await env.DB.prepare("SELECT id, name FROM customers WHERE id = ? AND active = 1").bind(data.customer_id).first();
    if (!customer) throw new HttpError("العميل غير صحيح", 400);
    return customer;
  }
  const name = data.new_customer_name;
  if (!name) throw new HttpError("اسم العميل مطلوب", 400);
  const normalized = normalizedCustomerKey(name);
  const existing = await env.DB.prepare("SELECT id, name FROM customers WHERE normalized_name = ?").bind(normalized).first();
  if (existing) throw new HttpError("العميل موجود بالفعل، اختره من القائمة", 400);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO customers(name, normalized_name, active, created_at, updated_at)
     VALUES(?, ?, 1, ?, ?)`
  ).bind(name, normalized, now, now).run();
  await insertAudit(env, request, user, "INSERT", "customers", result.meta.last_row_id, null, { name, normalized_name: normalized, source: "supply_order" });
  return { id: result.meta.last_row_id, name };
}

async function resolveLookup(env, request, user, tableName, id, newName, errorMessage) {
  if (id) {
    const item = await env.DB.prepare(`SELECT id, name FROM ${tableName} WHERE id = ? AND active = 1`).bind(id).first();
    if (!item) throw new HttpError(errorMessage, 400);
    return item;
  }
  const name = normalizeCustomerName(newName || "");
  if (!name) throw new HttpError(errorMessage, 400);
  const normalized = normalizedCustomerKey(name);
  const existing = await env.DB.prepare(`SELECT id, name FROM ${tableName} WHERE normalized_name = ?`).bind(normalized).first();
  if (existing) return existing;
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO ${tableName}(name, normalized_name, active, created_at, updated_at)
     VALUES(?, ?, 1, ?, ?)`
  ).bind(name, normalized, now, now).run();
  await insertAudit(env, request, user, "INSERT", tableName, result.meta.last_row_id, null, { name, normalized_name: normalized, source: "supply_order" });
  return { id: result.meta.last_row_id, name };
}

async function listDeliveryNotes(env) {
  const result = await env.DB.prepare(
    `SELECT delivery_notes.*, users.display_name AS created_by_name,
            COUNT(delivery_note_items.id) AS item_count,
            COALESCE(SUM(delivery_note_items.quantity_amount), 0) AS total_quantity
     FROM delivery_notes
     LEFT JOIN delivery_note_items ON delivery_note_items.delivery_note_id = delivery_notes.id
     LEFT JOIN users ON users.id = delivery_notes.created_by
     GROUP BY delivery_notes.id
     ORDER BY COALESCE(delivery_date, '') DESC, delivery_notes.id DESC
     LIMIT 300`
  ).all();
  const items = await env.DB.prepare(
    `SELECT delivery_note_items.*
     FROM delivery_note_items
     JOIN delivery_notes ON delivery_notes.id = delivery_note_items.delivery_note_id
     ORDER BY delivery_note_items.delivery_note_id DESC, delivery_note_items.line_no`
  ).all();
  const byNote = new Map();
  items.results.forEach((item) => {
    if (!byNote.has(item.delivery_note_id)) byNote.set(item.delivery_note_id, []);
    byNote.get(item.delivery_note_id).push(item);
  });
  return json({ items: result.results.map((note) => ({ ...note, items: byNote.get(note.id) || [] })) });
}

function deliveryNoteData(payload) {
  return {
    delivery_date: parseDateValue(payload.delivery_date) || new Date().toISOString().slice(0, 10),
    customer_id: Number(payload.customer_id || 0) || null,
    note: String(payload.note || "").trim() || null,
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

function deliveryItemData(payload, index) {
  return {
    line_no: index + 1,
    product_type: ["كوبايات - علب", "غطيان"].includes(payload.product_type) ? payload.product_type : "",
    design_id: Number(payload.design_id || 0) || null,
    size_id: Number(payload.size_id || 0) || null,
    quantity_unit: ["كيلو", "كرتونه"].includes(payload.quantity_unit) ? payload.quantity_unit : "كيلو",
    quantity_amount: Number(payload.quantity_amount || 0),
    note: String(payload.note || "").trim() || null,
  };
}

async function createDeliveryNote(request, env, user) {
  assertCanWrite(user);
  const data = await prepareDeliveryNote(env, await readJson(request));
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO delivery_notes(delivery_date, customer_id, customer_name, note, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.delivery_date, data.customer_id, data.customer_name, data.note, user.id, now, now).run();
  const deliveryNoteId = result.meta.last_row_id;

  await insertDeliveryNoteItems(env, deliveryNoteId, data.items);
  await insertAudit(env, request, user, "INSERT", "delivery_notes", deliveryNoteId, null, data);
  return json({ id: deliveryNoteId, item_count: data.items.length });
}

async function prepareDeliveryNote(env, payload) {
  const data = deliveryNoteData(payload);
  if (!data.customer_id) throw new HttpError("العميل مطلوب", 400);
  if (!data.items.length) throw new HttpError("يجب إضافة صنف واحد على الأقل في إذن التسليم", 400);
  const customer = await env.DB.prepare("SELECT id, name FROM customers WHERE id = ? AND active = 1").bind(data.customer_id).first();
  if (!customer) throw new HttpError("العميل غير صحيح", 400);

  const items = [];
  for (let index = 0; index < data.items.length; index += 1) {
    const item = deliveryItemData(data.items[index], index);
    if (!item.product_type) throw new HttpError(`نوع الصنف مطلوب في السطر ${item.line_no}`, 400);
    if (item.product_type !== "غطيان" && !item.design_id) throw new HttpError(`التصميم مطلوب في السطر ${item.line_no}`, 400);
    if (!item.size_id) throw new HttpError(`المقاس مطلوب في السطر ${item.line_no}`, 400);
    if (!Number.isFinite(item.quantity_amount) || item.quantity_amount <= 0) throw new HttpError(`العدد يجب أن يكون أكبر من صفر في السطر ${item.line_no}`, 400);
    const design = item.product_type === "غطيان"
      ? { id: null, name: "" }
      : await env.DB.prepare("SELECT id, name FROM designs WHERE id = ? AND active = 1").bind(item.design_id).first();
    if (item.product_type !== "غطيان" && !design) throw new HttpError(`التصميم غير صحيح في السطر ${item.line_no}`, 400);
    const size = await env.DB.prepare("SELECT id, name FROM product_sizes WHERE id = ? AND active = 1").bind(item.size_id).first();
    if (!size) throw new HttpError(`المقاس غير صحيح في السطر ${item.line_no}`, 400);
    items.push({ ...item, design_id: design.id, design_name: design.name, size_name: size.name });
  }
  return {
    ...data,
    customer_id: customer.id,
    customer_name: customer.name,
    items,
  };
}

async function insertDeliveryNoteItems(env, deliveryNoteId, items) {
  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO delivery_note_items(delivery_note_id, line_no, product_type, design_id, design_name, size_id, size_name, quantity_unit, quantity_amount, note)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      deliveryNoteId,
      item.line_no,
      item.product_type,
      item.design_id,
      item.design_name,
      item.size_id,
      item.size_name,
      item.quantity_unit,
      item.quantity_amount,
      item.note
    ).run();
  }
}

async function deliveryNoteWithItems(env, id) {
  const note = await env.DB.prepare("SELECT * FROM delivery_notes WHERE id = ?").bind(id).first();
  if (!note) return null;
  const items = await env.DB.prepare("SELECT * FROM delivery_note_items WHERE delivery_note_id = ? ORDER BY line_no").bind(id).all();
  return { ...note, items: items.results };
}

async function updateDeliveryNote(request, env, user, id) {
  assertCanWrite(user);
  const before = await deliveryNoteWithItems(env, id);
  if (!before) throw new HttpError("Record not found", 404);
  const data = await prepareDeliveryNote(env, await readJson(request));
  await env.DB.prepare(
    `UPDATE delivery_notes
     SET delivery_date=?, customer_id=?, customer_name=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(data.delivery_date, data.customer_id, data.customer_name, data.note, nowIso(), id).run();
  await env.DB.prepare("DELETE FROM delivery_note_items WHERE delivery_note_id = ?").bind(id).run();
  await insertDeliveryNoteItems(env, id, data.items);
  await insertAudit(env, request, user, "UPDATE", "delivery_notes", id, before, data);
  return json({ ok: true });
}

async function deleteDeliveryNote(env, user, id) {
  assertCanWrite(user);
  const before = await deliveryNoteWithItems(env, id);
  if (!before) throw new HttpError("Record not found", 404);
  await env.DB.prepare("DELETE FROM delivery_note_items WHERE delivery_note_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM delivery_notes WHERE id = ?").bind(id).run();
  await insertAudit(env, null, user, "DELETE", "delivery_notes", id, before, null);
  return json({ ok: true });
}

async function listInvoices(env) {
  const result = await env.DB.prepare(
    `SELECT invoices.*, users.display_name AS created_by_name, COUNT(invoice_items.id) AS item_count
     FROM invoices
     LEFT JOIN invoice_items ON invoice_items.invoice_id = invoices.id
     LEFT JOIN users ON users.id = invoices.created_by
     GROUP BY invoices.id
     ORDER BY COALESCE(invoice_date, '') DESC, invoices.id DESC
     LIMIT 300`
  ).all();
  return json({ items: result.results });
}

function invoiceData(payload) {
  return {
    invoice_date: parseDateValue(payload.invoice_date) || new Date().toISOString().slice(0, 10),
    delivery_note_id: Number(payload.delivery_note_id || 0) || null,
    delivery_charge: Number(payload.delivery_charge || 0),
    note: String(payload.note || "").trim() || null,
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

async function createInvoice(request, env, user) {
  assertCanWrite(user);
  const data = invoiceData(await readJson(request));
  if (!data.delivery_note_id) throw new HttpError("إذن التسليم مطلوب", 400);
  if (!Number.isFinite(data.delivery_charge) || data.delivery_charge < 0) throw new HttpError("مصاريف النقل غير صحيحة", 400);
  const deliveryNote = await deliveryNoteWithItems(env, data.delivery_note_id);
  if (!deliveryNote) throw new HttpError("إذن التسليم غير صحيح", 400);
  if (!deliveryNote.items.length) throw new HttpError("إذن التسليم لا يحتوي على أصناف", 400);
  const existing = await env.DB.prepare("SELECT id FROM invoices WHERE delivery_note_id = ?").bind(data.delivery_note_id).first();
  if (existing) throw new HttpError("تم إصدار فاتورة لهذا إذن التسليم بالفعل", 400);

  const payloadItems = new Map(data.items.map((item) => [String(item.delivery_note_item_id), item]));
  const items = [];
  let requiresDeliveryCharge = false;

  for (const noteItem of deliveryNote.items) {
    const payloadItem = payloadItems.get(String(noteItem.id));
    if (!payloadItem) throw new HttpError(`بيانات الفاتورة ناقصة للسطر ${noteItem.line_no}`, 400);
    let supplyOrderId = Number(payloadItem.supply_order_id || 0) || null;
    let priceType = String(payloadItem.price_type || "").trim();
    let unitPrice = Number(payloadItem.unit_price || 0);

    if (noteItem.product_type === "غطيان") {
      supplyOrderId = null;
      priceType = "manual";
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new HttpError(`سعر الغطيان غير صحيح في السطر ${noteItem.line_no}`, 400);
    } else {
      if (!supplyOrderId) throw new HttpError(`أمر التوريد مطلوب في السطر ${noteItem.line_no}`, 400);
      const order = await env.DB.prepare("SELECT * FROM supply_orders WHERE id = ?").bind(supplyOrderId).first();
      if (!order) throw new HttpError(`أمر التوريد غير صحيح في السطر ${noteItem.line_no}`, 400);
      if (Number(order.customer_id) !== Number(deliveryNote.customer_id)) throw new HttpError(`أمر التوريد لا يخص نفس العميل في السطر ${noteItem.line_no}`, 400);
      if (Number(order.design_id) !== Number(noteItem.design_id) || Number(order.size_id) !== Number(noteItem.size_id)) {
        throw new HttpError(`أمر التوريد لا يطابق التصميم والمقاس في السطر ${noteItem.line_no}`, 400);
      }
      if (order.delivery_cost_party === "العميل") requiresDeliveryCharge = true;
      if (priceType === "with_cover") unitPrice = Number(order.price_with_cover || 0);
      else if (priceType === "without_cover") unitPrice = Number(order.price_without_cover || 0);
      else throw new HttpError(`نوع السعر مطلوب في السطر ${noteItem.line_no}`, 400);
    }

    const quantity = Number(noteItem.quantity_amount || 0);
    const lineTotal = quantity * unitPrice;
    items.push({
      delivery_note_item_id: noteItem.id,
      line_no: noteItem.line_no,
      product_type: noteItem.product_type,
      design_id: noteItem.design_id,
      design_name: noteItem.design_name,
      size_id: noteItem.size_id,
      size_name: noteItem.size_name,
      quantity_unit: noteItem.quantity_unit,
      quantity_amount: quantity,
      supply_order_id: supplyOrderId,
      price_type: priceType,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  if (requiresDeliveryCharge && data.delivery_charge <= 0) throw new HttpError("مصاريف النقل مطلوبة لأن أحد أوامر التوريد النقل فيه على العميل", 400);
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const total = subtotal + data.delivery_charge;
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO invoices(invoice_date, delivery_note_id, customer_id, customer_name, subtotal, delivery_charge, total, note, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.invoice_date, deliveryNote.id, deliveryNote.customer_id, deliveryNote.customer_name, subtotal, data.delivery_charge, total, data.note, user.id, now, now).run();
  const invoiceId = result.meta.last_row_id;
  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO invoice_items(invoice_id, delivery_note_item_id, line_no, product_type, design_id, design_name, size_id, size_name, quantity_unit, quantity_amount, supply_order_id, price_type, unit_price, line_total)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(invoiceId, item.delivery_note_item_id, item.line_no, item.product_type, item.design_id, item.design_name, item.size_id, item.size_name, item.quantity_unit, item.quantity_amount, item.supply_order_id, item.price_type, item.unit_price, item.line_total).run();
  }
  await insertAudit(env, request, user, "INSERT", "invoices", invoiceId, null, {
    invoice_date: data.invoice_date,
    delivery_note_id: deliveryNote.id,
    customer_id: deliveryNote.customer_id,
    customer_name: deliveryNote.customer_name,
    subtotal,
    delivery_charge: data.delivery_charge,
    total,
    note: data.note,
    items,
  });
  return json({ id: invoiceId, subtotal, delivery_charge: data.delivery_charge, total });
}

async function createCollection(request, env, user) {
  assertCanWrite(user);
  const data = await applyCollectionCustody(env, await applyCustomer(env, collectionData(await readJson(request))));
  validateCollection(data);
  const now = nowIso();
  const result = await env.DB.prepare(
    `INSERT INTO collections(entry_date, month, responsible, customer_id, client_name, collection_type, collection_type_other, amount, payment_method, note, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(data.entry_date, data.month, data.responsible, data.customer_id, data.client_name, data.collection_type, data.collection_type_other, data.amount, data.payment_method, data.note, now, now).run();
  await insertAudit(env, request, user, "INSERT", "collections", result.meta.last_row_id, null, data);
  return json({ id: result.meta.last_row_id });
}

async function updateCollection(request, env, user, id) {
  assertCanWrite(user);
  const before = await env.DB.prepare("SELECT * FROM collections WHERE id = ?").bind(id).first();
  if (!before) throw new HttpError("Record not found", 404);
  const data = await applyCollectionCustody(env, await applyCustomer(env, collectionData(await readJson(request))));
  validateCollection(data);
  await env.DB.prepare(
    `UPDATE collections
     SET entry_date=?, month=?, responsible=?, customer_id=?, client_name=?, collection_type=?, collection_type_other=?, amount=?, payment_method=?, note=?, updated_at=?
     WHERE id=?`
  ).bind(data.entry_date, data.month, data.responsible, data.customer_id, data.client_name, data.collection_type, data.collection_type_other, data.amount, data.payment_method, data.note, nowIso(), id).run();
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

async function collectionReportData(env, url) {
  const { dateFrom, dateTo } = reportDates(url);
  const customerId = Number(url.searchParams.get("customer_id") || 0) || null;
  const responsible = String(url.searchParams.get("responsible") || "").trim();
  const collectionType = String(url.searchParams.get("collection_type") || "").trim();
  const filters = ["COALESCE(entry_date, '') >= ?", "COALESCE(entry_date, '') <= ?"];
  const binds = [dateFrom, dateTo];
  if (customerId) {
    filters.push("customer_id = ?");
    binds.push(customerId);
  }
  if (responsible) {
    filters.push("responsible = ?");
    binds.push(responsible);
  }
  if (collectionType) {
    filters.push("collection_type = ?");
    binds.push(collectionType);
  }
  const whereSql = filters.join(" AND ");
  const items = await env.DB.prepare(
    `SELECT id, entry_date, month, responsible, customer_id, client_name, collection_type, amount, payment_method, note
     FROM collections
     WHERE ${whereSql}
     ORDER BY entry_date, id`
  ).bind(...binds).all();
  const totals = await env.DB.prepare(
    `SELECT COALESCE(client_name, 'غير محدد') AS client_name,
            COALESCE(collection_type, 'غير محدد') AS collection_type,
            COALESCE(responsible, 'غير محدد') AS responsible,
            SUM(amount) AS total,
            COUNT(*) AS count
     FROM collections
     WHERE ${whereSql}
     GROUP BY client_name, collection_type, responsible
     ORDER BY total DESC, client_name, collection_type, responsible`
  ).bind(...binds).all();
  const totalAmount = items.results.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { date_from: dateFrom, date_to: dateTo, customer_id: customerId, responsible, collection_type: collectionType, total: totalAmount, items: items.results, totals: totals.results };
}

async function collectionReport(env, url) {
  return json(await collectionReportData(env, url));
}

async function collectionReportXlsx(env, url) {
  const data = await collectionReportData(env, url);
  const file = collectionXlsx(data);
  return new Response(file, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="collections-${data.date_from}-to-${data.date_to}.xlsx"`,
    },
  });
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

async function expenseReportXlsx(env, url) {
  const data = await expenseReportData(env, url);
  const file = expenseXlsx(data);
  return new Response(file, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="expenses-${data.date_from}-to-${data.date_to}.xlsx"`,
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

function expenseXlsx(data) {
  const { rows, merges } = expenseSheetRows(data);
  return reportXlsx("تقرير المصروفات", rows, merges);
}

function collectionXlsx(data) {
  const { rows, merges } = collectionSheetRows(data);
  return reportXlsx("تقرير التحصيلات", rows, merges);
}

function reportXlsx(title, rows, merges) {
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "docProps/core.xml": corePropsXml(title),
    "docProps/app.xml": appPropsXml(),
    "xl/workbook.xml": workbookXml(title),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(),
    "xl/styles.xml": workbookStylesXml(),
    "xl/worksheets/sheet1.xml": worksheetXml(rows, merges),
  };
  return zipStore(files);
}

function collectionSheetRows(data) {
  const period = `${data.date_from === "0000-01-01" ? "البداية" : data.date_from} - ${data.date_to === "9999-12-31" ? "النهاية" : data.date_to}`;
  const filters = [
    data.responsible ? `المسؤول: ${data.responsible}` : "كل المسؤولين",
    data.collection_type ? `نوع التحصيل: ${data.collection_type}` : "كل الأنواع",
  ].join(" / ");
  const rows = [];
  const merges = [];
  const addRow = (values, style = "normal", mergeAcross = 0) => {
    const rowNumber = rows.length + 1;
    rows.push({ values, style });
    if (mergeAcross > 1) merges.push(`A${rowNumber}:${columnName(mergeAcross)}${rowNumber}`);
  };

  addRow(["تقرير التحصيلات"], "title", 5);
  addRow(["الفترة", period, "الفلاتر", filters, "الإجمالي", data.total], "meta");
  addRow(["", "", "", "", ""], "normal");
  addRow(["العميل", "نوع التحصيل", "المسؤول", "عدد التحصيلات", "الإجمالي"], "header");
  data.totals.forEach((item) => {
    addRow([
      item.client_name || "",
      item.collection_type || "",
      item.responsible || "",
      item.count || 0,
      item.total || 0,
    ], "normal");
  });
  if (!data.totals.length) {
    addRow(["لا توجد تحصيلات مطابقة للفلاتر"], "normal", 5);
  }
  return { rows, merges };
}

function expenseSheetRows(data) {
  const groups = new Map();
  data.totals.forEach((item) => {
    const category = item.expense_category || "غير محدد";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const period = `${data.date_from === "0000-01-01" ? "البداية" : data.date_from} - ${data.date_to === "9999-12-31" ? "النهاية" : data.date_to}`;
  const typeLabel = data.expense_type || "كل الأنواع";
  const selectedCodes = data.codes.length ? data.codes.join("، ") : "كل الأكواد";
  const rows = [];
  const merges = [];
  const addRow = (values, style = "normal", mergeAcross = 0) => {
    const rowNumber = rows.length + 1;
    rows.push({ values, style });
    if (mergeAcross > 1) merges.push(`A${rowNumber}:${columnName(mergeAcross)}${rowNumber}`);
  };

  addRow(["تقرير المصروفات"], "title", 4);
  addRow(["الفترة", period, "النوع", typeLabel], "meta");
  addRow(["الأكواد", selectedCodes, "الإجمالي", data.total], "meta");
  addRow(["", "", "", ""], "normal");

  groups.forEach((items, category) => {
    const categoryTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    addRow([category], "section", 4);
    addRow(["رقم المصروف", "اسم المصروف", "عدد العمليات", "القيمة"], "header");
    items.forEach((item) => {
      addRow([
        item.expense_code || "",
        item.expense_name || "",
        item.count || 0,
        item.total || 0,
      ], "normal");
    });
    addRow(["", "إجمالي", "", categoryTotal], "total");
    addRow(["", "", "", ""], "normal");
  });

  if (!groups.size) {
    addRow(["لا توجد مصروفات مطابقة للفلاتر"], "normal", 4);
  }

  return { rows, merges };
}

function worksheetXml(rows, merges) {
  const styleIds = { normal: 0, title: 1, section: 2, header: 3, meta: 4, total: 5 };
  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
  <cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="20" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="6" width="18" customWidth="1"/></cols>
  <sheetData>
${rows.map((row, index) => xlsxRow(row, index + 1, styleIds[row.style] ?? 0)).join("\n")}
  </sheetData>
  ${merges.length ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : ""}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

function xlsxRow(row, rowNumber, styleId) {
  return `    <row r="${rowNumber}">${row.values.map((value, index) => xlsxCell(value, `${columnName(index + 1)}${rowNumber}`, styleId)).join("")}</row>`;
}

function xlsxCell(value, ref, styleId) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function columnName(index) {
  let name = "";
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function workbookXml(sheetName = "تقرير") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookViews><workbookView xWindow="0" yWindow="0" windowWidth="16384" windowHeight="8192"/></workbookViews>
  <sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function workbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFA6A6A6"/></left><right style="thin"><color rgb="FFA6A6A6"/></right><top style="thin"><color rgb="FFA6A6A6"/></top><bottom style="thin"><color rgb="FFA6A6A6"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function corePropsXml(title = "تقرير") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(title)}</dc:title>
  <dc:creator>تحصيلات</dc:creator>
  <cp:lastModifiedBy>تحصيلات</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(nowIso())}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlEscape(nowIso())}</dcterms:modified>
</cp:coreProperties>`;
}

function appPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
</Properties>`;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    return { name, nameBytes, data, crc: crc32(data) };
  });
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  entries.forEach((entry) => {
    const local = zipLocalHeader(entry);
    localParts.push(local, entry.data);
    centralParts.push(zipCentralHeader(entry, offset));
    offset += local.length + entry.data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(entries.length, centralSize, offset);
  return concatBytes([...localParts, ...centralParts, end]);
}

function zipLocalHeader(entry) {
  const header = new Uint8Array(30 + entry.nameBytes.length);
  const view = new DataView(header.buffer);
  const { time, date } = zipDosTimestamp();
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, entry.crc, true);
  view.setUint32(18, entry.data.length, true);
  view.setUint32(22, entry.data.length, true);
  view.setUint16(26, entry.nameBytes.length, true);
  header.set(entry.nameBytes, 30);
  return header;
}

function zipCentralHeader(entry, offset) {
  const header = new Uint8Array(46 + entry.nameBytes.length);
  const view = new DataView(header.buffer);
  const { time, date } = zipDosTimestamp();
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.data.length, true);
  view.setUint32(24, entry.data.length, true);
  view.setUint16(28, entry.nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(entry.nameBytes, 46);
  return header;
}

function zipEndRecord(count, centralSize, centralOffset) {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return end;
}

function zipDosTimestamp() {
  const date = new Date();
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
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
    source_custody_holder: String(payload.source_custody_holder || "").trim(),
    target_custody_holder: String(payload.target_custody_holder || "").trim(),
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
  const data = await applyTransferCustody(env, transferData(await readJson(request)));
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
  const data = await applyTransferCustody(env, transferData(await readJson(request)));
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
  for (const table of ["users", "payment_methods", "expense_accounts", "customers", "custody_holders", "designs", "product_sizes", "materials", "collections", "expenses", "transfers", "supply_orders", "delivery_notes", "delivery_note_items", "invoices", "invoice_items", "audit_logs"]) {
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
