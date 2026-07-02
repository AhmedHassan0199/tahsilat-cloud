const state = {
  paymentMethods: [],
  expenseAccounts: [],
  responsibles: [],
  dashboard: null,
  collections: [],
  expenses: [],
  transfers: [],
  audit: [],
  users: [],
  expenseReport: null,
  responsibleMonthly: [],
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
  const authMode = options.authMode || "default";
  const fetchOptions = { ...options };
  delete fetchOptions.authMode;
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...fetchOptions,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && authMode !== "login") {
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

function showLoginErrorFromUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("login_error") === "1") {
    showLogin();
    showToast("بيانات الدخول غير صحيحة", true);
    url.searchParams.delete("login_error");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  }
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

function fillExpenseAccountSelect(select, current = "") {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "اختر رقم واسم المصروف";
  select.appendChild(placeholder);

  const groups = new Map();
  state.expenseAccounts.forEach((item) => {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  });
  groups.forEach((items, category) => {
    const group = document.createElement("optgroup");
    group.label = category;
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.code} - ${item.name}`;
      group.appendChild(option);
    });
    select.appendChild(group);
  });
  if (current) select.value = current;
}

function fillExpenseReportCodes() {
  const select = qs("#expenseReportCodes");
  if (!select) return;
  const selected = new Set(qsa("option:checked", select).map((option) => option.value));
  const type = qs("#expenseReportType")?.value || "";
  const accounts = state.expenseAccounts.filter((item) => !type || item.category === type);
  select.innerHTML = "";
  accounts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = `${item.code} - ${item.name}`;
    option.selected = selected.has(item.code);
    select.appendChild(option);
  });
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
      <td data-label="الشهر">${monthName(row.month)}</td>
      <td data-label="التحصيل">${money(row.collections)}</td>
      <td data-label="المصروفات">${money(row.expenses)}</td>
      <td data-label="الصافي" class="${Number(row.net) < 0 ? "negative" : "positive"}">${money(row.net)}</td>
    </tr>
  `).join("");

  qs("#responsibleRows").innerHTML = data.by_responsible.map((row) => `
    <tr><td data-label="المسؤول">${row.responsible}</td><td data-label="الإجمالي">${money(row.total)}</td><td data-label="عدد التحصيلات">${money(row.count)}</td></tr>
  `).join("") || `<tr><td colspan="3" class="muted">لا توجد بيانات</td></tr>`;

  qs("#clientRows").innerHTML = data.top_clients.map((row) => `
    <tr><td data-label="العميل">${row.client_name}</td><td data-label="الإجمالي">${money(row.total)}</td><td data-label="عدد العمليات">${money(row.count)}</td></tr>
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
      <td data-label="طريقة الدفع">${row.payment_method || "غير محدد"}</td>
      <td data-label="تحصيل">${money(row.collections)}</td>
      <td data-label="مصروف">${money(row.expenses)}</td>
      <td data-label="توسيط داخل">${money(row.transfers_in)}</td>
      <td data-label="توسيط خارج">${money(row.transfers_out)}</td>
      <td data-label="الرصيد" class="${Number(row.balance) < 0 ? "negative" : "positive"}">${money(row.balance)}</td>
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
      <td data-label="التاريخ">${item.entry_date || "-"}</td>
      <td data-label="الشهر">${item.month || "-"}</td>
      <td data-label="المسؤول">${item.responsible}</td>
      <td data-label="العميل">${item.client_name}</td>
      <td data-label="المبلغ">${money(item.amount)}</td>
      <td data-label="الطريقة">${item.payment_method}</td>
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
      <td data-label="التاريخ">${item.entry_date || "-"}</td>
      <td data-label="الشهر">${item.month || "-"}</td>
      <td data-label="النوع">${item.expense_type}</td>
      <td data-label="وجه الصرف">${item.expense_code ? `${item.expense_code} - ${item.expense_name}` : item.description}</td>
      <td data-label="المبلغ">${money(item.amount)}</td>
      <td data-label="الطريقة">${item.payment_method}</td>
      <td data-label="الخزينة">${item.deducted_from_treasury ? "نعم" : "لا"}</td>
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
      <td data-label="الوقت">${item.created_at}</td>
      <td data-label="المستخدم">${item.username || "-"}</td>
      <td data-label="الإجراء">${item.action}</td>
      <td data-label="الجدول">${item.table_name}</td>
      <td data-label="رقم">${item.record_id || "-"}</td>
      <td data-label="التفاصيل"><details><summary>عرض</summary>${auditDetails(item)}</details></td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">لا توجد تعديلات</td></tr>`;
}

function renderTransfers() {
  qs("#transferRows").innerHTML = state.transfers.map((item) => `
    <tr>
      <td data-label="التاريخ">${item.entry_date || "-"}</td>
      <td data-label="من">${item.source_method}</td>
      <td data-label="إلى">${item.target_method}</td>
      <td data-label="المبلغ">${money(item.amount)}</td>
      <td data-label="المستخدم">${item.created_by_name || "-"}</td>
      <td data-label="ملاحظة">${item.note || "-"}</td>
      <td class="actions">
        <button type="button" data-edit-transfer="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-transfer="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">لا توجد عمليات توسيط</td></tr>`;
}

function renderUsers() {
  const body = qs("#userRows");
  if (!body) return;
  body.innerHTML = state.users.map((item) => `
    <tr>
      <td data-label="اسم المستخدم">${item.username}</td>
      <td data-label="الاسم الكامل">${item.display_name}</td>
      <td data-label="الصلاحية">${item.role}</td>
      <td data-label="الحالة">${item.active ? "نشط" : "موقوف"}</td>
      <td data-label="تاريخ الإنشاء">${item.created_at}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">لا توجد بيانات مستخدمين</td></tr>`;
}

function renderExpenseReport() {
  const body = qs("#expenseReportRows");
  if (!body) return;
  const rows = state.expenseReport?.totals || [];
  body.innerHTML = rows.map((item) => `
    <tr>
      <td data-label="التصنيف">${item.expense_category || "-"}</td>
      <td data-label="رقم المصروف">${item.expense_code || "-"}</td>
      <td data-label="اسم المصروف">${item.expense_name || "-"}</td>
      <td data-label="الإجمالي">${money(item.total)}</td>
      <td data-label="عدد العمليات">${money(item.count)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">لا توجد مصروفات في هذه الفترة</td></tr>`;
}

function renderResponsibleMonthly() {
  const body = qs("#responsibleMonthlyRows");
  if (!body) return;
  body.innerHTML = state.responsibleMonthly.map((item) => `
    <tr>
      <td data-label="الشهر">${monthName(item.month)}</td>
      <td data-label="نورا">${money(item.noura)}</td>
      <td data-label="محمد حسن">${money(item.mohamed_hassan)}</td>
      <td data-label="المصريه">${money(item.egyptian)}</td>
      <td data-label="الإجمالي">${money(item.total)}</td>
    </tr>
  `).join("");
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
  state.expenseAccounts = data.expense_accounts || [];
  state.responsibles = data.responsibles;
  state.user = data.user;
  qsa('select[name="responsible"]').forEach((select) => fillSelect(select, state.responsibles));
  qsa('select[name="payment_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="expense_account_id"]').forEach((select) => fillExpenseAccountSelect(select, select.value));
  fillExpenseReportCodes();
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

async function loadExpenseReport() {
  const params = expenseReportParams();
  state.expenseReport = await api(`/api/reports/expenses?${params.toString()}`);
  renderExpenseReport();
}

function expenseReportParams() {
  const params = new URLSearchParams();
  const from = qs("#expenseReportFrom")?.value;
  const to = qs("#expenseReportTo")?.value;
  const type = qs("#expenseReportType")?.value;
  const codes = qsa("#expenseReportCodes option:checked").map((option) => option.value);
  if (from) params.set("date_from", from);
  if (to) params.set("date_to", to);
  if (type) params.set("expense_type", type);
  codes.forEach((code) => params.append("code", code));
  return params;
}

async function loadResponsibleMonthly() {
  const data = await api("/api/reports/responsible-monthly");
  state.responsibleMonthly = data.items;
  renderResponsibleMonthly();
}

async function reloadAll() {
  await loadBootstrap();
  await Promise.all([loadDashboard(), loadCollections(), loadExpenses(), loadTransfers(), loadUsers(), loadAudit(), loadExpenseReport(), loadResponsibleMonthly()]);
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
  fillExpenseAccountSelect(form.expense_account_id);
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
  const data = formData(form);
  const id = data.id;
  delete data.id;
  if (id) {
    await api(`/api/transfers/${id}`, { method: "PUT", body: JSON.stringify(data) });
    showToast("تم تعديل التوسيط");
  } else {
    await api("/api/transfers", { method: "POST", body: JSON.stringify(data) });
    showToast("تم تنفيذ التوسيط");
  }
  resetTransferForm();
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
  fillExpenseAccountSelect(form.expense_account_id, item.expense_account_id || "");
  form.amount.value = item.amount;
  form.payment_method.value = item.payment_method;
  form.deducted_from_treasury.checked = Boolean(item.deducted_from_treasury);
  form.note.value = item.note || "";
  qs("#expenseFormTitle").textContent = `تعديل مصروف #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTransferForm() {
  const form = qs("#transferForm");
  form.reset();
  form.elements.id.value = "";
  fillSelect(form.source_method, state.paymentMethods);
  fillSelect(form.target_method, state.paymentMethods);
  qs("#transferFormTitle").textContent = "توسيط بين طرق الدفع";
}

function editTransfer(id) {
  const item = state.transfers.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#transferForm");
  form.elements.id.value = item.id;
  form.entry_date.value = item.entry_date || "";
  form.source_method.value = item.source_method;
  form.target_method.value = item.target_method;
  form.amount.value = item.amount;
  form.note.value = item.note || "";
  qs("#transferFormTitle").textContent = `تعديل توسيط #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeRecord(kind, id) {
  const labels = { collections: "التحصيل", expenses: "المصروف", transfers: "التوسيط" };
  const label = labels[kind] || "السجل";
  if (!confirm(`حذف ${label} رقم ${id}؟`)) return;
  await api(`/api/${kind}/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  await Promise.all([
    loadDashboard(),
    kind === "collections" ? loadCollections() : kind === "expenses" ? loadExpenses() : loadTransfers(),
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

  qsa(".report-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      qsa(".report-tab").forEach((item) => item.classList.remove("active"));
      qsa(".report-panel").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      qs(`#${tab.dataset.reportTab}`).classList.add("active");
    });
  });

  qs("#refreshBtn").addEventListener("click", async () => {
    await reloadAll();
    showToast("تم التحديث");
  });

  qs("#backupBtn").addEventListener("click", () => {
    downloadBackup().catch((error) => showToast(error.message, true));
  });

  qs("#loadExpenseReportBtn").addEventListener("click", () => {
    loadExpenseReport().catch((error) => showToast(error.message, true));
  });

  qs("#expenseReportType").addEventListener("change", () => {
    fillExpenseReportCodes();
  });

  qs("#exportExpenseReportBtn").addEventListener("click", () => {
    const params = expenseReportParams();
    window.location.href = `/api/reports/expenses.xls?${params.toString()}`;
  });

  qs("#logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    state.user = null;
    showLogin();
  });

  qs("#loginForm").addEventListener("submit", (event) => {
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "جاري الدخول...";
  });

  qs("#collectionForm").addEventListener("submit", (event) => saveCollection(event).catch((error) => showToast(error.message, true)));
  qs("#expenseForm").addEventListener("submit", (event) => saveExpense(event).catch((error) => showToast(error.message, true)));
  qs("#transferForm").addEventListener("submit", (event) => saveTransfer(event).catch((error) => showToast(error.message, true)));
  qs("#userForm").addEventListener("submit", (event) => saveUser(event).catch((error) => showToast(error.message, true)));
  qs("#cancelCollectionEdit").addEventListener("click", resetCollectionForm);
  qs("#cancelExpenseEdit").addEventListener("click", resetExpenseForm);
  qs("#cancelTransferEdit").addEventListener("click", resetTransferForm);

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
    const transferEdit = event.target.closest("[data-edit-transfer]");
    const transferDelete = event.target.closest("[data-delete-transfer]");
    if (collectionEdit) editCollection(collectionEdit.dataset.editCollection);
    if (collectionDelete) removeRecord("collections", collectionDelete.dataset.deleteCollection).catch((error) => showToast(error.message, true));
    if (expenseEdit) editExpense(expenseEdit.dataset.editExpense);
    if (expenseDelete) removeRecord("expenses", expenseDelete.dataset.deleteExpense).catch((error) => showToast(error.message, true));
    if (transferEdit) editTransfer(transferEdit.dataset.editTransfer);
    if (transferDelete) removeRecord("transfers", transferDelete.dataset.deleteTransfer).catch((error) => showToast(error.message, true));
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
  showLoginErrorFromUrl();
}

init().catch((error) => showToast(error.message, true));
