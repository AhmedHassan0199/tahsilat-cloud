const state = {
  paymentMethods: [],
  responsibles: [],
  dashboard: null,
  collections: [],
  expenses: [],
  transfers: [],
  audit: [],
  users: [],
  user: null,
};

const nf = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function money(value) {
  return nf.format(Number(value || 0));
}

function showToast(message, isError = false) {
  const toast = qs("#toast");
  toast.textContent = message;
  toast.style.background = isError ? "#b42318" : "#101828";
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/login") {
    showLogin();
    throw new Error("انتهت الجلسة، برجاء تسجيل الدخول");
  }
  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ غير متوقع");
  }
  return data;
}

function showLogin() {
  qs("#loginScreen").classList.remove("hidden");
  qs("#appShell").classList.add("hidden");
}

function showApp() {
  qs("#loginScreen").classList.add("hidden");
  qs("#appShell").classList.remove("hidden");
}

function setActiveTab(name) {
  qsa(".tab").forEach((item) => item.classList.toggle("active", item.dataset.tab === name));
  qsa(".tab-panel").forEach((item) => item.classList.toggle("active", item.id === name));
}

function fillSelect(select, values, current = "") {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = typeof value === "string" ? value : value.name;
    option.textContent = typeof value === "string" ? value : value.name;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function addMonthOptions() {
  ["#collectionMonth", "#expenseMonth"].forEach((id) => {
    const select = qs(id);
    for (let month = 1; month <= 12; month += 1) {
      const option = document.createElement("option");
      option.value = month;
      option.textContent = `شهر ${month}`;
      select.appendChild(option);
    }
  });
}

function monthName(month) {
  return month ? `شهر ${month}` : "-";
}

function renderDashboard() {
  const data = state.dashboard;
  if (!data) return;

  qs("#totalCollections").textContent = money(data.totals.collections);
  qs("#totalExpenses").textContent = money(data.totals.expenses);
  qs("#treasuryBalance").textContent = money(data.totals.treasury);
  qs("#operationCount").textContent = money(data.totals.collection_count + data.totals.expense_count);

  qs("#monthRows").innerHTML = data.by_month.map((row) => `
    <tr>
      <td>${monthName(row.month)}</td>
      <td>${money(row.collections)}</td>
      <td>${money(row.expenses)}</td>
      <td class="${Number(row.net) < 0 ? "negative" : "positive"}">${money(row.net)}</td>
    </tr>
  `).join("");

  qs("#responsibleRows").innerHTML = data.by_responsible.map((row) => `
    <tr><td>${row.responsible}</td><td>${money(row.total)}</td><td>${money(row.count)}</td></tr>
  `).join("") || `<tr><td colspan="3" class="muted">لا توجد بيانات</td></tr>`;

  qs("#clientRows").innerHTML = data.top_clients.map((row) => `
    <tr><td>${row.client_name}</td><td>${money(row.total)}</td><td>${money(row.count)}</td></tr>
  `).join("") || `<tr><td colspan="3" class="muted">لا توجد بيانات</td></tr>`;

  const bestMonth = data.insights.best_month;
  const bestDay = data.insights.best_day;
  const bestResponsible = data.insights.best_responsible;
  const largestClient = data.insights.largest_client;
  qs("#bestMonth").textContent = bestMonth ? `${monthName(bestMonth.month)} - ${money(bestMonth.total)}` : "-";
  qs("#bestDay").textContent = bestDay ? `${bestDay.entry_date} - ${money(bestDay.total)}` : "-";
  qs("#bestResponsible").textContent = bestResponsible ? `${bestResponsible.responsible} - ${money(bestResponsible.total)}` : "-";
  qs("#largestClient").textContent = largestClient ? `${largestClient.client_name} - ${money(largestClient.total)}` : "-";

  qs("#treasuryRows").innerHTML = data.treasury_by_method.map((row) => `
    <tr>
      <td>${row.payment_method || "غير محدد"}</td>
      <td>${money(row.collections)}</td>
      <td>${money(row.expenses)}</td>
      <td>${money(row.transfers_in)}</td>
      <td>${money(row.transfers_out)}</td>
      <td class="${Number(row.balance) < 0 ? "negative" : "positive"}">${money(row.balance)}</td>
    </tr>
  `).join("");
}

function collectionQuery() {
  const params = new URLSearchParams();
  const q = qs("#collectionSearch").value.trim();
  const month = qs("#collectionMonth").value;
  if (q) params.set("q", q);
  if (month) params.set("month", month);
  params.set("limit", "500");
  return params.toString();
}

function expenseQuery() {
  const params = new URLSearchParams();
  const q = qs("#expenseSearch").value.trim();
  const month = qs("#expenseMonth").value;
  if (q) params.set("q", q);
  if (month) params.set("month", month);
  params.set("limit", "500");
  return params.toString();
}

function renderCollections() {
  qs("#collectionRows").innerHTML = state.collections.map((item) => `
    <tr>
      <td>${item.entry_date || "-"}</td>
      <td>${item.month || "-"}</td>
      <td>${item.responsible}</td>
      <td>${item.client_name}</td>
      <td>${money(item.amount)}</td>
      <td>${item.payment_method}</td>
      <td class="actions">
        <button type="button" data-edit-collection="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-collection="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">لا توجد تحصيلات مطابقة</td></tr>`;
}

function renderExpenses() {
  qs("#expenseRows").innerHTML = state.expenses.map((item) => `
    <tr>
      <td>${item.entry_date || "-"}</td>
      <td>${item.month || "-"}</td>
      <td>${item.expense_type}</td>
      <td>${item.description}</td>
      <td>${money(item.amount)}</td>
      <td>${item.payment_method}</td>
      <td>${item.deducted_from_treasury ? "نعم" : "لا"}</td>
      <td class="actions">
        <button type="button" data-edit-expense="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-expense="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="muted">لا توجد مصروفات مطابقة</td></tr>`;
}

function renderAudit() {
  qs("#auditRows").innerHTML = state.audit.map((item) => `
    <tr>
      <td>${item.created_at}</td>
      <td>${item.username || "-"}</td>
      <td>${item.action}</td>
      <td>${item.table_name}</td>
      <td>${item.record_id || "-"}</td>
      <td><details><summary>عرض</summary>${auditDetails(item)}</details></td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">لا توجد تعديلات</td></tr>`;
}

function renderTransfers() {
  qs("#transferRows").innerHTML = state.transfers.map((item) => `
    <tr>
      <td>${item.entry_date || "-"}</td>
      <td>${item.source_method}</td>
      <td>${item.target_method}</td>
      <td>${money(item.amount)}</td>
      <td>${item.created_by_name || "-"}</td>
      <td>${item.note || "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">لا توجد عمليات توسيط</td></tr>`;
}

function renderUsers() {
  const body = qs("#userRows");
  if (!body) return;
  body.innerHTML = state.users.map((item) => `
    <tr>
      <td>${item.username}</td>
      <td>${item.display_name}</td>
      <td>${item.role}</td>
      <td>${item.active ? "نشط" : "موقوف"}</td>
      <td>${item.created_at}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">لا توجد بيانات مستخدمين</td></tr>`;
}

function auditDetails(item) {
  const before = safeJson(item.before_data);
  const after = safeJson(item.after_data);
  if (item.action === "INSERT") return `<pre>${escapeHtml(JSON.stringify(after, null, 2))}</pre>`;
  if (item.action === "DELETE") return `<pre>${escapeHtml(JSON.stringify(before, null, 2))}</pre>`;
  if (item.action === "UPDATE") {
    return `<div class="audit-diff"><strong>قبل</strong><pre>${escapeHtml(JSON.stringify(before, null, 2))}</pre><strong>بعد</strong><pre>${escapeHtml(JSON.stringify(after, null, 2))}</pre></div>`;
  }
  return `<pre>${escapeHtml(JSON.stringify(after || before || {}, null, 2))}</pre>`;
}

function safeJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

async function loadBootstrap() {
  const data = await api("/api/bootstrap");
  state.paymentMethods = data.payment_methods;
  state.responsibles = data.responsibles;
  state.user = data.user;
  qsa('select[name="responsible"]').forEach((select) => fillSelect(select, state.responsibles));
  qsa('select[name="payment_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="source_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="target_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa(".admin-only").forEach((item) => item.classList.toggle("hidden", state.user?.role !== "admin"));
  qs("#statusLine").textContent = "نسخة Cloudflare العامة";
  qs("#currentUser").textContent = state.user ? `${state.user.display_name} (${state.user.role})` : "";
}

async function loadDashboard() {
  state.dashboard = await api("/api/dashboard");
  renderDashboard();
}

async function loadCollections() {
  const data = await api(`/api/collections?${collectionQuery()}`);
  state.collections = data.items;
  renderCollections();
}

async function loadExpenses() {
  const data = await api(`/api/expenses?${expenseQuery()}`);
  state.expenses = data.items;
  renderExpenses();
}

async function loadAudit() {
  if (!state.user || state.user.role !== "admin") {
    state.audit = [];
    renderAudit();
    return;
  }
  const data = await api("/api/audit");
  state.audit = data.items;
  renderAudit();
}

async function loadTransfers() {
  const data = await api("/api/transfers");
  state.transfers = data.items;
  renderTransfers();
}

async function loadUsers() {
  if (!state.user || state.user.role !== "admin") {
    state.users = [];
    renderUsers();
    return;
  }
  const data = await api("/api/users");
  state.users = data.items;
  renderUsers();
}

async function reloadAll() {
  await loadBootstrap();
  await Promise.all([loadDashboard(), loadCollections(), loadExpenses(), loadTransfers(), loadUsers(), loadAudit()]);
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  qsa('input[type="checkbox"]', form).forEach((input) => {
    data[input.name] = input.checked ? 1 : 0;
  });
  return data;
}

function resetCollectionForm() {
  const form = qs("#collectionForm");
  form.reset();
  form.elements.id.value = "";
  qs("#collectionFormTitle").textContent = "إضافة تحصيل";
  fillSelect(form.responsible, state.responsibles);
  fillSelect(form.payment_method, state.paymentMethods);
}

function resetExpenseForm() {
  const form = qs("#expenseForm");
  form.reset();
  form.elements.id.value = "";
  form.deducted_from_treasury.checked = true;
  qs("#expenseFormTitle").textContent = "إضافة مصروف";
  fillSelect(form.payment_method, state.paymentMethods);
}

async function saveCollection(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const id = data.id;
  delete data.id;
  if (id) {
    await api(`/api/collections/${id}`, { method: "PUT", body: JSON.stringify(data) });
    showToast("تم تعديل التحصيل");
  } else {
    await api("/api/collections", { method: "POST", body: JSON.stringify(data) });
    showToast("تم حفظ التحصيل");
  }
  resetCollectionForm();
  await Promise.all([loadDashboard(), loadCollections(), loadAudit()]);
}

async function saveExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const id = data.id;
  delete data.id;
  if (id) {
    await api(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) });
    showToast("تم تعديل المصروف");
  } else {
    await api("/api/expenses", { method: "POST", body: JSON.stringify(data) });
    showToast("تم حفظ المصروف");
  }
  resetExpenseForm();
  await Promise.all([loadDashboard(), loadExpenses(), loadAudit()]);
}

async function saveTransfer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/transfers", { method: "POST", body: JSON.stringify(formData(form)) });
  form.reset();
  fillSelect(form.source_method, state.paymentMethods);
  fillSelect(form.target_method, state.paymentMethods);
  showToast("تم تنفيذ التوسيط");
  await Promise.all([loadDashboard(), loadTransfers(), loadAudit()]);
}

async function saveUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/users", { method: "POST", body: JSON.stringify(formData(form)) });
  form.reset();
  showToast("تم إنشاء المستخدم");
  await Promise.all([loadBootstrap(), loadUsers(), loadAudit()]);
}

async function downloadBackup() {
  const data = await api("/api/backup");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tahsilat-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("تم تحميل النسخة الاحتياطية");
}

function editCollection(id) {
  const item = state.collections.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#collectionForm");
  form.elements.id.value = item.id;
  form.entry_date.value = item.entry_date || "";
  form.month.value = item.month || "";
  form.responsible.value = item.responsible;
  form.client_name.value = item.client_name;
  form.amount.value = item.amount;
  form.payment_method.value = item.payment_method;
  form.note.value = item.note || "";
  qs("#collectionFormTitle").textContent = `تعديل تحصيل #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editExpense(id) {
  const item = state.expenses.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#expenseForm");
  form.elements.id.value = item.id;
  form.entry_date.value = item.entry_date || "";
  form.month.value = item.month || "";
  form.expense_type.value = item.expense_type;
  form.description.value = item.description;
  form.amount.value = item.amount;
  form.payment_method.value = item.payment_method;
  form.deducted_from_treasury.checked = Boolean(item.deducted_from_treasury);
  form.note.value = item.note || "";
  qs("#expenseFormTitle").textContent = `تعديل مصروف #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeRecord(kind, id) {
  const label = kind === "collections" ? "التحصيل" : "المصروف";
  if (!confirm(`حذف ${label} رقم ${id}؟`)) return;
  await api(`/api/${kind}/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  await Promise.all([
    loadDashboard(),
    kind === "collections" ? loadCollections() : loadExpenses(),
    loadAudit(),
  ]);
}

function bindEvents() {
  qsa(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      qsa(".tab").forEach((item) => item.classList.remove("active"));
      qsa(".tab-panel").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      qs(`#${tab.dataset.tab}`).classList.add("active");
    });
  });

  qs("#refreshBtn").addEventListener("click", async () => {
    await reloadAll();
    showToast("تم التحديث");
  });

  qs("#backupBtn").addEventListener("click", () => {
    downloadBackup().catch((error) => showToast(error.message, true));
  });

  qs("#logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    state.user = null;
    showLogin();
  });

  qs("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      setActiveTab("dashboard");
      await reloadAll();
      resetCollectionForm();
      resetExpenseForm();
      showApp();
      showToast("تم تسجيل الدخول");
    } catch (error) {
      showToast(error.message, true);
    }
  });

  qs("#collectionForm").addEventListener("submit", (event) => saveCollection(event).catch((error) => showToast(error.message, true)));
  qs("#expenseForm").addEventListener("submit", (event) => saveExpense(event).catch((error) => showToast(error.message, true)));
  qs("#transferForm").addEventListener("submit", (event) => saveTransfer(event).catch((error) => showToast(error.message, true)));
  qs("#userForm").addEventListener("submit", (event) => saveUser(event).catch((error) => showToast(error.message, true)));
  qs("#cancelCollectionEdit").addEventListener("click", resetCollectionForm);
  qs("#cancelExpenseEdit").addEventListener("click", resetExpenseForm);

  qs("#methodForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/payment-methods", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) });
      event.currentTarget.reset();
      await loadBootstrap();
      await loadDashboard();
      showToast("تمت إضافة طريقة الدفع");
    } catch (error) {
      showToast(error.message, true);
    }
  });

  qs("#collectionSearch").addEventListener("input", debounce(loadCollections, 250));
  qs("#collectionMonth").addEventListener("change", loadCollections);
  qs("#expenseSearch").addEventListener("input", debounce(loadExpenses, 250));
  qs("#expenseMonth").addEventListener("change", loadExpenses);

  document.addEventListener("click", (event) => {
    const collectionEdit = event.target.closest("[data-edit-collection]");
    const collectionDelete = event.target.closest("[data-delete-collection]");
    const expenseEdit = event.target.closest("[data-edit-expense]");
    const expenseDelete = event.target.closest("[data-delete-expense]");
    if (collectionEdit) editCollection(collectionEdit.dataset.editCollection);
    if (collectionDelete) removeRecord("collections", collectionDelete.dataset.deleteCollection).catch((error) => showToast(error.message, true));
    if (expenseEdit) editExpense(expenseEdit.dataset.editExpense);
    if (expenseDelete) removeRecord("expenses", expenseDelete.dataset.deleteExpense).catch((error) => showToast(error.message, true));
  });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args).catch((error) => showToast(error.message, true)), delay);
  };
}

async function init() {
  addMonthOptions();
  bindEvents();
  try {
    await reloadAll();
    resetCollectionForm();
    resetExpenseForm();
    showApp();
    showToast("النظام جاهز");
  } catch (error) {
    showLogin();
  }
}

init().catch((error) => showToast(error.message, true));
