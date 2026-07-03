const state = {
  paymentMethods: [],
  expenseAccounts: [],
  collectionTypes: [],
  customers: [],
  custodyHolders: [],
  designs: [],
  productSizes: [],
  materials: [],
  responsibles: [],
  dashboard: null,
  collections: [],
  expenses: [],
  transfers: [],
  supplyOrders: [],
  deliveryNotes: [],
  deliveryDraft: { index: 0, items: [] },
  audit: [],
  users: [],
  expenseReport: null,
  collectionReport: null,
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

function fillCustomerSelect(select, current = "") {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = select.id === "collectionReportCustomer" ? "كل العملاء" : "اختر العميل";
  select.appendChild(placeholder);
  state.customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.id;
    option.textContent = customer.name;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function fillSupplyCustomerSelect(select, current = "") {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "اختر العميل";
  select.appendChild(placeholder);
  state.customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.id;
    option.textContent = customer.name;
    select.appendChild(option);
  });
  const newOption = document.createElement("option");
  newOption.value = "__new";
  newOption.textContent = "عميل جديد";
  select.appendChild(newOption);
  if (current) select.value = current;
}

function fillLookupSelect(select, values, placeholderText, newText, current = "") {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  select.appendChild(placeholder);
  values.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  const newOption = document.createElement("option");
  newOption.value = "__new";
  newOption.textContent = newText;
  select.appendChild(newOption);
  if (current) select.value = current;
}

function fillExistingLookupSelect(select, values, placeholderText, current = "") {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  select.appendChild(placeholder);
  values.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function fillCustodyDatalist() {
  const list = qs("#custodyHolderOptions");
  if (!list) return;
  list.innerHTML = state.custodyHolders.map((item) => `<option value="${escapeHtml(item.name)}"></option>`).join("");
}

function splitCustodyMethod(value) {
  const text = String(value || "");
  if (!text.startsWith("عهدة - ")) return { method: text, holder: "" };
  return { method: "عهدة", holder: text.slice("عهدة - ".length).trim() };
}

function isCustodySelected(value) {
  return splitCustodyMethod(value).method === "عهدة";
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

function toggleCollectionOtherType() {
  const form = qs("#collectionForm");
  const isOther = form.collection_type.value === "أخرى";
  qs("#collectionTypeOtherWrap").classList.toggle("hidden", !isOther);
  form.collection_type_other.required = isOther;
  if (!isOther) form.collection_type_other.value = "";
}

function toggleCollectionCustody() {
  const form = qs("#collectionForm");
  const isCustody = isCustodySelected(form.payment_method.value);
  qs("#collectionCustodyWrap").classList.toggle("hidden", !isCustody);
  form.custody_holder.required = isCustody;
  if (!isCustody) form.custody_holder.value = "";
}

function toggleTransferCustody() {
  const form = qs("#transferForm");
  const sourceCustody = isCustodySelected(form.source_method.value);
  const targetCustody = isCustodySelected(form.target_method.value);
  qs("#sourceCustodyWrap").classList.toggle("hidden", !sourceCustody);
  qs("#targetCustodyWrap").classList.toggle("hidden", !targetCustody);
  form.source_custody_holder.required = sourceCustody;
  form.target_custody_holder.required = targetCustody;
  if (!sourceCustody) form.source_custody_holder.value = "";
  if (!targetCustody) form.target_custody_holder.value = "";
}

function toggleSupplyNewFields() {
  const form = qs("#supplyOrderForm");
  if (!form) return;
  [
    ["customer_id", "new_customer_name", "#newSupplyCustomerWrap"],
    ["design_id", "new_design_name", "#newSupplyDesignWrap"],
    ["size_id", "new_size_name", "#newSupplySizeWrap"],
    ["material_id", "new_material_name", "#newSupplyMaterialWrap"],
  ].forEach(([selectName, inputName, wrapperSelector]) => {
    const isNew = form.elements[selectName].value === "__new";
    qs(wrapperSelector).classList.toggle("hidden", !isNew);
    form.elements[inputName].required = isNew;
    if (!isNew) form.elements[inputName].value = "";
  });
}

function fillSupplyOrderFormLookups() {
  const form = qs("#supplyOrderForm");
  if (!form) return;
  fillSupplyCustomerSelect(form.customer_id, form.customer_id.value);
  fillLookupSelect(form.design_id, state.designs, "اختر التصميم", "تصميم جديد", form.design_id.value);
  fillLookupSelect(form.size_id, state.productSizes, "اختر المقاس", "مقاس جديد", form.size_id.value);
  fillLookupSelect(form.material_id, state.materials, "اختر الخامة", "خامة جديدة", form.material_id.value);
  toggleSupplyNewFields();
}

function blankDeliveryItem() {
  return {
    product_type: "كوبايات - علب",
    design_id: "",
    size_id: "",
    quantity_unit: "كيلو",
    quantity_amount: "",
    note: "",
  };
}

function fillDeliveryNoteFormLookups() {
  const form = qs("#deliveryNoteForm");
  if (!form) return;
  fillCustomerSelect(form.customer_id, form.customer_id.value);
  fillExistingLookupSelect(form.design_id, state.designs, "اختر التصميم", form.design_id.value);
  fillExistingLookupSelect(form.size_id, state.productSizes, "اختر المقاس", form.size_id.value);
}

function toggleDeliveryProductType() {
  const form = qs("#deliveryNoteForm");
  if (!form) return;
  const isCovers = form.product_type.value === "غطيان";
  qs("#deliveryDesignWrap").classList.toggle("hidden", isCovers);
  form.design_id.required = !isCovers;
  if (isCovers) form.design_id.value = "";
}

function deliveryCurrentItem() {
  return state.deliveryDraft.items[state.deliveryDraft.index] || blankDeliveryItem();
}

function saveVisibleDeliveryItem() {
  const form = qs("#deliveryNoteForm");
  if (!form) return;
  const isCovers = form.product_type.value === "غطيان";
  state.deliveryDraft.items[state.deliveryDraft.index] = {
    product_type: form.product_type.value,
    design_id: isCovers ? "" : form.design_id.value,
    size_id: form.size_id.value,
    quantity_unit: form.quantity_unit.value,
    quantity_amount: form.quantity_amount.value,
    note: form.item_note.value.trim(),
  };
}

function showDeliveryItem(index) {
  const form = qs("#deliveryNoteForm");
  if (!form) return;
  state.deliveryDraft.index = Math.max(0, Math.min(index, state.deliveryDraft.items.length - 1));
  const item = deliveryCurrentItem();
  form.product_type.value = item.product_type || "كوبايات - علب";
  fillExistingLookupSelect(form.design_id, state.designs, "اختر التصميم", item.design_id || "");
  fillExistingLookupSelect(form.size_id, state.productSizes, "اختر المقاس", item.size_id || "");
  form.quantity_unit.value = item.quantity_unit || "كيلو";
  form.quantity_amount.value = item.quantity_amount || "";
  form.item_note.value = item.note || "";
  toggleDeliveryProductType();
  qs("#deliveryItemCounter").textContent = `الصنف ${state.deliveryDraft.index + 1} من ${state.deliveryDraft.items.length}`;
  qs("#prevDeliveryItemBtn").disabled = state.deliveryDraft.index === 0;
  renderDeliveryDraftRows();
}

function renderDeliveryDraftRows() {
  const body = qs("#deliveryDraftRows");
  if (!body) return;
  body.innerHTML = state.deliveryDraft.items.map((item, index) => {
    const design = state.designs.find((row) => String(row.id) === String(item.design_id));
    const size = state.productSizes.find((row) => String(row.id) === String(item.size_id));
    return `
      <tr class="${index === state.deliveryDraft.index ? "selected-row" : ""}">
        <td data-label="#">${index + 1}</td>
        <td data-label="الصنف">${item.product_type || "-"}</td>
        <td data-label="التصميم">${design?.name || "-"}</td>
        <td data-label="المقاس">${size?.name || "-"}</td>
        <td data-label="العدد">${item.quantity_amount ? `${money(item.quantity_amount)} ${item.quantity_unit || ""}` : "-"}</td>
        <td data-label="ملاحظة">${item.note || "-"}</td>
      </tr>
    `;
  }).join("");
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

  const bestMonth = data.insights.best_month;
  const bestDay = data.insights.best_day;
  const bestResponsible = data.insights.best_responsible;
  const largestClient = data.insights.largest_client;
  qs("#bestMonth").textContent = bestMonth ? `${monthName(bestMonth.month)} - ${money(bestMonth.total)}` : "-";
  qs("#bestDay").textContent = bestDay ? `${bestDay.entry_date} - ${money(bestDay.total)}` : "-";
  qs("#bestResponsible").textContent = bestResponsible ? `${bestResponsible.responsible} - ${money(bestResponsible.total)}` : "-";
  qs("#largestClient").textContent = largestClient ? `${largestClient.client_name} - ${money(largestClient.total)}` : "-";

  qs("#monthlyTrendChart").innerHTML = monthlyTrendChart(data.by_month);
  qs("#responsibleDonutChart").innerHTML = donutChart(data.by_responsible, "responsible", "total");
  qs("#topClientsChart").innerHTML = barChart(data.top_clients, "client_name", "total", { limit: 8 });
  qs("#treasuryBalanceChart").innerHTML = barChart(data.treasury_by_method, "payment_method", "balance", { limit: 8, signed: true });

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

function monthlyTrendChart(rows) {
  const data = rows || [];
  const width = 760;
  const height = 300;
  const pad = { top: 18, right: 22, bottom: 42, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const series = [
    { key: "collections", label: "التحصيل", color: "#2f9b34" },
    { key: "expenses", label: "المصروفات", color: "#111111" },
    { key: "net", label: "الصافي", color: "#6aa84f" },
  ];
  const values = data.flatMap((row) => series.map((item) => Number(row[item.key] || 0)));
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(0, ...values);
  const range = Math.max(1, maxValue - minValue);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const y = (value) => pad.top + innerH - ((Number(value || 0) - minValue) / range) * innerH;
  const x = (index) => pad.left + index * stepX;
  const lines = series.map((item) => {
    const points = data.map((row, index) => `${x(index)},${y(row[item.key])}`).join(" ");
    return `<polyline class="chart-line" points="${points}" stroke="${item.color}"/>`;
  }).join("");
  const labels = data.map((row, index) => `<text class="chart-axis" x="${x(index)}" y="${height - 14}" text-anchor="middle">${monthName(row.month).replace("شهر ", "")}</text>`).join("");
  const legend = series.map((item, index) => `
    <span class="chart-legend-item"><i style="background:${item.color}"></i>${item.label}</span>
  `).join("");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="الأداء الشهري">
      <line class="chart-grid" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"/>
      <line class="chart-grid" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"/>
      ${[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const value = minValue + range * tick;
        const ty = y(value);
        return `<line class="chart-grid ${Math.abs(value) < 0.001 ? "" : "faint"}" x1="${pad.left}" y1="${ty}" x2="${width - pad.right}" y2="${ty}"/><text class="chart-axis" x="${pad.left - 8}" y="${ty + 4}" text-anchor="end">${money(value)}</text>`;
      }).join("")}
      ${lines}
      ${labels}
    </svg>
    <div class="chart-legend">${legend}</div>
  `;
}

function donutChart(rows, labelKey, valueKey) {
  const data = (rows || []).filter((row) => Number(row[valueKey] || 0) > 0);
  if (!data.length) return emptyChart();
  const total = data.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const colors = ["#2f9b34", "#111111", "#6aa84f", "#7fbf7b", "#8c8c8c", "#c4d9bd"];
  let offset = 25;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const rings = data.map((row, index) => {
    const value = Number(row[valueKey] || 0);
    const dash = (value / total) * circumference;
    const stroke = colors[index % colors.length];
    const circle = `<circle class="donut-segment" r="${radius}" cx="60" cy="60" stroke="${stroke}" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="-${offset}"/>`;
    offset += dash;
    return circle;
  }).join("");
  const legend = data.map((row, index) => `
    <div class="rank-row"><span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(row[labelKey] || "غير محدد")}</span><strong>${money(row[valueKey])}</strong></div>
  `).join("");
  return `
    <div class="donut-layout">
      <svg viewBox="0 0 120 120" role="img" aria-label="توزيع التحصيل">
        <circle class="donut-bg" r="${radius}" cx="60" cy="60"/>
        ${rings}
        <text class="donut-total" x="60" y="57" text-anchor="middle">${money(total)}</text>
        <text class="donut-caption" x="60" y="74" text-anchor="middle">إجمالي</text>
      </svg>
      <div class="rank-list">${legend}</div>
    </div>
  `;
}

function barChart(rows, labelKey, valueKey, options = {}) {
  const data = (rows || [])
    .filter((row) => Number(row[valueKey] || 0) !== 0)
    .slice(0, options.limit || 8);
  if (!data.length) return emptyChart();
  const maxValue = Math.max(1, ...data.map((row) => Math.abs(Number(row[valueKey] || 0))));
  return `<div class="bar-list">${data.map((row) => {
    const value = Number(row[valueKey] || 0);
    const pct = Math.max(4, (Math.abs(value) / maxValue) * 100);
    const negative = value < 0;
    return `
      <div class="bar-row">
        <div class="bar-meta"><span>${escapeHtml(row[labelKey] || "غير محدد")}</span><strong class="${negative ? "negative" : "positive"}">${money(value)}</strong></div>
        <div class="bar-track"><div class="bar-fill ${negative ? "negative-fill" : ""}" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join("")}</div>`;
}

function emptyChart() {
  return `<div class="empty-chart">لا توجد بيانات كافية</div>`;
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
      <td data-label="نوع التحصيل">${item.collection_type || "-"}</td>
      <td data-label="المبلغ">${money(item.amount)}</td>
      <td data-label="الطريقة">${item.payment_method}</td>
      <td class="actions">
        <button type="button" data-edit-collection="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-collection="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="muted">لا توجد تحصيلات مطابقة</td></tr>`;
}

function renderCustomers() {
  const body = qs("#customerRows");
  if (!body) return;
  body.innerHTML = state.customers.map((item) => `
    <tr>
      <td data-label="العميل">${item.name}</td>
      <td data-label="إجمالي التحصيل">${money(item.total_collections)}</td>
      <td data-label="عدد التحصيلات">${money(item.collection_count)}</td>
      <td data-label="آخر تحصيل">${item.last_collection_date || "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">لا توجد بيانات عملاء</td></tr>`;
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
      <td data-label="ملاحظة">${item.note || "-"}</td>
      <td class="actions">
        <button type="button" data-edit-expense="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-expense="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="9" class="muted">لا توجد مصروفات مطابقة</td></tr>`;
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

function renderSupplyOrders() {
  const body = qs("#supplyOrderRows");
  if (!body) return;
  body.innerHTML = state.supplyOrders.map((item) => `
    <tr>
      <td data-label="رقم">${item.id}</td>
      <td data-label="التاريخ">${item.order_date || "-"}</td>
      <td data-label="العميل">${item.customer_name || "-"}</td>
      <td data-label="التصميم">${item.design_name || "-"}</td>
      <td data-label="المقاس">${item.size_name || "-"}</td>
      <td data-label="الخامة">${item.material_name || "-"}</td>
      <td data-label="الكمية">${money(item.quantity_amount)} ${item.quantity_unit || ""}</td>
      <td data-label="السعر">${money(item.price_without_cover)} / ${money(item.price_with_cover)}</td>
      <td data-label="سعر السريل">${money(item.serial_color_price)}</td>
      <td data-label="تاريخ التوريد">${item.supply_date || "-"}</td>
      <td data-label="المستخدم">${item.created_by_name || "-"}</td>
      <td class="actions">
        <button type="button" data-edit-supply-order="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-supply-order="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="12" class="muted">لا توجد أوامر توريد مسجلة</td></tr>`;
}

function renderDeliveryNotes() {
  const body = qs("#deliveryNoteRows");
  if (!body) return;
  body.innerHTML = state.deliveryNotes.map((item) => `
    <tr>
      <td data-label="رقم">${item.id}</td>
      <td data-label="التاريخ">${item.delivery_date || "-"}</td>
      <td data-label="العميل">${item.customer_name || "-"}</td>
      <td data-label="عدد الأصناف">${money(item.item_count)}</td>
      <td data-label="إجمالي العدد">${money(item.total_quantity)}</td>
      <td data-label="المستخدم">${item.created_by_name || "-"}</td>
      <td class="actions">
        <button type="button" data-edit-delivery-note="${item.id}" title="تعديل">✎</button>
        <button class="danger" type="button" data-delete-delivery-note="${item.id}" title="حذف">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">لا توجد أذونات تسليم مسجلة</td></tr>`;
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

function renderCollectionReport() {
  const body = qs("#collectionReportRows");
  if (!body) return;
  const rows = state.collectionReport?.totals || [];
  body.innerHTML = rows.map((item) => `
    <tr>
      <td data-label="العميل">${item.client_name || "-"}</td>
      <td data-label="نوع التحصيل">${item.collection_type || "-"}</td>
      <td data-label="المسؤول">${item.responsible || "-"}</td>
      <td data-label="الإجمالي">${money(item.total)}</td>
      <td data-label="عدد التحصيلات">${money(item.count)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">لا توجد تحصيلات في هذه الفترة</td></tr>`;
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
  state.customers = data.customers || [];
  state.custodyHolders = data.custody_holders || [];
  state.designs = data.designs || [];
  state.productSizes = data.product_sizes || [];
  state.materials = data.materials || [];
  state.collectionTypes = data.collection_types || [];
  state.responsibles = data.responsibles;
  state.user = data.user;
  qsa('select[name="responsible"]').forEach((select) => fillSelect(select, state.responsibles));
  qsa('select[name="customer_id"]').forEach((select) => fillCustomerSelect(select, select.value));
  fillCustomerSelect(qs("#collectionReportCustomer"), qs("#collectionReportCustomer")?.value);
  qsa('select[name="collection_type"]').forEach((select) => fillSelect(select, state.collectionTypes, select.value));
  fillSelect(qs("#collectionReportType"), ["", ...state.collectionTypes], qs("#collectionReportType")?.value);
  qs("#collectionReportType").options[0].textContent = "كل الأنواع";
  fillSelect(qs("#collectionReportResponsible"), ["", ...state.responsibles], qs("#collectionReportResponsible")?.value);
  qs("#collectionReportResponsible").options[0].textContent = "كل المسؤولين";
  qsa('select[name="payment_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="expense_account_id"]').forEach((select) => fillExpenseAccountSelect(select, select.value));
  fillExpenseReportCodes();
  fillSupplyOrderFormLookups();
  fillDeliveryNoteFormLookups();
  qsa('select[name="source_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="target_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  fillCustodyDatalist();
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

async function loadCustomers() {
  const data = await api("/api/customers");
  state.customers = data.items;
  renderCustomers();
  qsa('select[name="customer_id"]').forEach((select) => fillCustomerSelect(select, select.value));
  fillSupplyOrderFormLookups();
  fillDeliveryNoteFormLookups();
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

async function loadSupplyOrders() {
  const data = await api("/api/supply-orders");
  state.supplyOrders = data.items;
  renderSupplyOrders();
}

async function loadDeliveryNotes() {
  const data = await api("/api/delivery-notes");
  state.deliveryNotes = data.items;
  renderDeliveryNotes();
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

async function loadCollectionReport() {
  const params = collectionReportParams();
  state.collectionReport = await api(`/api/reports/collections?${params.toString()}`);
  renderCollectionReport();
}

function collectionReportParams() {
  const params = new URLSearchParams();
  const from = qs("#collectionReportFrom")?.value;
  const to = qs("#collectionReportTo")?.value;
  const customerId = qs("#collectionReportCustomer")?.value;
  const responsible = qs("#collectionReportResponsible")?.value;
  const type = qs("#collectionReportType")?.value;
  if (from) params.set("date_from", from);
  if (to) params.set("date_to", to);
  if (customerId) params.set("customer_id", customerId);
  if (responsible) params.set("responsible", responsible);
  if (type) params.set("collection_type", type);
  return params;
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
  await Promise.all([loadDashboard(), loadCollections(), loadCustomers(), loadExpenses(), loadTransfers(), loadSupplyOrders(), loadDeliveryNotes(), loadUsers(), loadAudit(), loadExpenseReport(), loadCollectionReport(), loadResponsibleMonthly()]);
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
  fillCustomerSelect(form.customer_id);
  fillSelect(form.collection_type, state.collectionTypes);
  fillSelect(form.payment_method, state.paymentMethods);
  toggleCollectionOtherType();
  toggleCollectionCustody();
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

function resetSupplyOrderForm() {
  const form = qs("#supplyOrderForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.price_without_cover.value = "0";
  form.price_with_cover.value = "0";
  form.serial_color_price.value = "0";
  form.quantity_unit.value = "كيلو";
  form.delivery_cost_party.value = "المصنع";
  qs("#supplyOrderFormTitle").textContent = "أمر التوريد";
  fillSupplyOrderFormLookups();
}

function resetDeliveryNoteForm() {
  const form = qs("#deliveryNoteForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  qs("#deliveryNoteFormTitle").textContent = "إذن التسليم";
  state.deliveryDraft = { index: 0, items: [blankDeliveryItem()] };
  fillDeliveryNoteFormLookups();
  showDeliveryItem(0);
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
  await Promise.all([loadBootstrap(), loadDashboard(), loadCollections(), loadCustomers(), loadAudit()]);
}

async function saveCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/customers", { method: "POST", body: JSON.stringify(formData(form)) });
  form.reset();
  showToast("تم إضافة العميل");
  await Promise.all([loadBootstrap(), loadCustomers(), loadAudit()]);
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
  await Promise.all([loadBootstrap(), loadDashboard(), loadTransfers(), loadAudit()]);
}

async function saveSupplyOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  const id = data.id;
  delete data.id;
  ["customer_id", "design_id", "size_id", "material_id"].forEach((key) => {
    if (data[key] === "__new") data[key] = "";
  });
  if (id) {
    await api(`/api/supply-orders/${id}`, { method: "PUT", body: JSON.stringify(data) });
    showToast("تم تعديل أمر التوريد");
  } else {
    await api("/api/supply-orders", { method: "POST", body: JSON.stringify(data) });
    showToast("تم حفظ أمر التوريد");
  }
  resetSupplyOrderForm();
  await Promise.all([loadBootstrap(), loadSupplyOrders(), loadCustomers(), loadAudit()]);
}

async function saveDeliveryNote(event) {
  event.preventDefault();
  const form = event.currentTarget;
  saveVisibleDeliveryItem();
  const items = state.deliveryDraft.items.filter((item) => item.design_id || item.size_id || item.quantity_amount);
  if (!form.customer_id.value) throw new Error("العميل مطلوب");
  if (!items.length) throw new Error("يجب إضافة صنف واحد على الأقل");
  const payload = {
    delivery_date: form.delivery_date.value,
    customer_id: form.customer_id.value,
    note: form.note.value.trim(),
    items,
  };
  const id = form.elements.id.value;
  if (id) {
    await api(`/api/delivery-notes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    showToast("تم تعديل إذن التسليم");
  } else {
    await api("/api/delivery-notes", { method: "POST", body: JSON.stringify(payload) });
    showToast("تم حفظ إذن التسليم");
  }
  resetDeliveryNoteForm();
  await Promise.all([loadDeliveryNotes(), loadAudit()]);
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
  fillCustomerSelect(form.customer_id, item.customer_id || "");
  if (state.collectionTypes.includes(item.collection_type)) {
    form.collection_type.value = item.collection_type;
    form.collection_type_other.value = "";
  } else {
    form.collection_type.value = "أخرى";
    form.collection_type_other.value = item.collection_type || "";
  }
  toggleCollectionOtherType();
  form.amount.value = item.amount;
  const collectionMethod = splitCustodyMethod(item.payment_method);
  form.payment_method.value = collectionMethod.method;
  form.custody_holder.value = collectionMethod.holder;
  toggleCollectionCustody();
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
  toggleTransferCustody();
  qs("#transferFormTitle").textContent = "توسيط بين طرق الدفع";
}

function editTransfer(id) {
  const item = state.transfers.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#transferForm");
  form.elements.id.value = item.id;
  form.entry_date.value = item.entry_date || "";
  const sourceMethod = splitCustodyMethod(item.source_method);
  const targetMethod = splitCustodyMethod(item.target_method);
  form.source_method.value = sourceMethod.method;
  form.source_custody_holder.value = sourceMethod.holder;
  form.target_method.value = targetMethod.method;
  form.target_custody_holder.value = targetMethod.holder;
  toggleTransferCustody();
  form.amount.value = item.amount;
  form.note.value = item.note || "";
  qs("#transferFormTitle").textContent = `تعديل توسيط #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editSupplyOrder(id) {
  const item = state.supplyOrders.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#supplyOrderForm");
  form.elements.id.value = item.id;
  form.order_date.value = item.order_date || "";
  fillSupplyCustomerSelect(form.customer_id, item.customer_id || "");
  fillLookupSelect(form.design_id, state.designs, "اختر التصميم", "تصميم جديد", item.design_id || "");
  fillLookupSelect(form.size_id, state.productSizes, "اختر المقاس", "مقاس جديد", item.size_id || "");
  fillLookupSelect(form.material_id, state.materials, "اختر الخامة", "خامة جديدة", item.material_id || "");
  toggleSupplyNewFields();
  form.quantity_unit.value = item.quantity_unit || "كيلو";
  form.quantity_amount.value = item.quantity_amount || "";
  form.price_without_cover.value = item.price_without_cover || 0;
  form.price_with_cover.value = item.price_with_cover || 0;
  form.serial_color_price.value = item.serial_color_price || 0;
  form.delivery_cost_party.value = item.delivery_cost_party || "المصنع";
  form.supply_date.value = item.supply_date || "";
  form.print_approval_status.value = item.print_approval_status || "";
  form.cylinder_colors_count.value = item.cylinder_colors_count || "";
  form.delivery_duration.value = item.delivery_duration || "";
  form.payment_method.value = item.payment_method || "";
  form.delivery_place.value = item.delivery_place || "";
  form.note.value = item.note || "";
  qs("#supplyOrderFormTitle").textContent = `تعديل أمر توريد #${item.id}`;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editDeliveryNote(id) {
  const item = state.deliveryNotes.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#deliveryNoteForm");
  form.elements.id.value = item.id;
  form.delivery_date.value = item.delivery_date || "";
  fillCustomerSelect(form.customer_id, item.customer_id || "");
  form.note.value = item.note || "";
  state.deliveryDraft = {
    index: 0,
    items: (item.items || []).map((row) => ({
      product_type: row.product_type || "كوبايات - علب",
      design_id: row.design_id || "",
      size_id: row.size_id || "",
      quantity_unit: row.quantity_unit || "كيلو",
      quantity_amount: row.quantity_amount || "",
      note: row.note || "",
    })),
  };
  if (!state.deliveryDraft.items.length) state.deliveryDraft.items = [blankDeliveryItem()];
  qs("#deliveryNoteFormTitle").textContent = `تعديل إذن تسليم #${item.id}`;
  showDeliveryItem(0);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeRecord(kind, id) {
  const labels = { collections: "التحصيل", expenses: "المصروف", transfers: "التوسيط", "supply-orders": "أمر التوريد", "delivery-notes": "إذن التسليم" };
  const label = labels[kind] || "السجل";
  if (!confirm(`حذف ${label} رقم ${id}؟`)) return;
  await api(`/api/${kind}/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  await Promise.all([
    loadDashboard(),
    kind === "collections" ? loadCollections() : kind === "expenses" ? loadExpenses() : kind === "transfers" ? loadTransfers() : kind === "supply-orders" ? loadSupplyOrders() : loadDeliveryNotes(),
    kind === "collections" ? loadCustomers() : Promise.resolve(),
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

  qs("#loadCollectionReportBtn").addEventListener("click", () => {
    loadCollectionReport().catch((error) => showToast(error.message, true));
  });

  qs("#expenseReportType").addEventListener("change", () => {
    fillExpenseReportCodes();
  });

  qs("#exportExpenseReportBtn").addEventListener("click", () => {
    const params = expenseReportParams();
    window.location.href = `/api/reports/expenses.xlsx?${params.toString()}`;
  });

  qs("#exportCollectionReportBtn").addEventListener("click", () => {
    const params = collectionReportParams();
    window.location.href = `/api/reports/collections.xlsx?${params.toString()}`;
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
  qs("#customerForm").addEventListener("submit", (event) => saveCustomer(event).catch((error) => showToast(error.message, true)));
  qs("#supplyOrderForm").addEventListener("submit", (event) => saveSupplyOrder(event).catch((error) => showToast(error.message, true)));
  qs("#deliveryNoteForm").addEventListener("submit", (event) => saveDeliveryNote(event).catch((error) => showToast(error.message, true)));
  qs("#expenseForm").addEventListener("submit", (event) => saveExpense(event).catch((error) => showToast(error.message, true)));
  qs("#transferForm").addEventListener("submit", (event) => saveTransfer(event).catch((error) => showToast(error.message, true)));
  qs("#userForm").addEventListener("submit", (event) => saveUser(event).catch((error) => showToast(error.message, true)));
  qs("#cancelCollectionEdit").addEventListener("click", resetCollectionForm);
  qs("#cancelExpenseEdit").addEventListener("click", resetExpenseForm);
  qs("#cancelTransferEdit").addEventListener("click", resetTransferForm);
  qs("#cancelSupplyOrderEdit").addEventListener("click", resetSupplyOrderForm);
  qs("#cancelDeliveryNoteEdit").addEventListener("click", resetDeliveryNoteForm);
  qs("#nextDeliveryItemBtn").addEventListener("click", () => {
    const form = qs("#deliveryNoteForm");
    if (!form.reportValidity()) return;
    saveVisibleDeliveryItem();
    if (state.deliveryDraft.index === state.deliveryDraft.items.length - 1) {
      state.deliveryDraft.items.push(blankDeliveryItem());
    }
    showDeliveryItem(state.deliveryDraft.index + 1);
  });
  qs("#prevDeliveryItemBtn").addEventListener("click", () => {
    saveVisibleDeliveryItem();
    showDeliveryItem(state.deliveryDraft.index - 1);
  });

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
  qs('#collectionForm select[name="collection_type"]').addEventListener("change", toggleCollectionOtherType);
  qs('#collectionForm select[name="payment_method"]').addEventListener("change", toggleCollectionCustody);
  qs("#expenseSearch").addEventListener("input", debounce(loadExpenses, 250));
  qs("#expenseMonth").addEventListener("change", loadExpenses);
  qs('#transferForm select[name="source_method"]').addEventListener("change", toggleTransferCustody);
  qs('#transferForm select[name="target_method"]').addEventListener("change", toggleTransferCustody);
  qsa('#supplyOrderForm select').forEach((select) => {
    select.addEventListener("change", toggleSupplyNewFields);
  });
  qsa('#deliveryNoteForm input, #deliveryNoteForm select, #deliveryNoteForm textarea').forEach((field) => {
    field.addEventListener("change", () => {
      toggleDeliveryProductType();
      saveVisibleDeliveryItem();
      renderDeliveryDraftRows();
    });
  });

  document.addEventListener("click", (event) => {
    const collectionEdit = event.target.closest("[data-edit-collection]");
    const collectionDelete = event.target.closest("[data-delete-collection]");
    const expenseEdit = event.target.closest("[data-edit-expense]");
    const expenseDelete = event.target.closest("[data-delete-expense]");
    const transferEdit = event.target.closest("[data-edit-transfer]");
    const transferDelete = event.target.closest("[data-delete-transfer]");
    const supplyOrderEdit = event.target.closest("[data-edit-supply-order]");
    const supplyOrderDelete = event.target.closest("[data-delete-supply-order]");
    const deliveryNoteEdit = event.target.closest("[data-edit-delivery-note]");
    const deliveryNoteDelete = event.target.closest("[data-delete-delivery-note]");
    if (collectionEdit) editCollection(collectionEdit.dataset.editCollection);
    if (collectionDelete) removeRecord("collections", collectionDelete.dataset.deleteCollection).catch((error) => showToast(error.message, true));
    if (expenseEdit) editExpense(expenseEdit.dataset.editExpense);
    if (expenseDelete) removeRecord("expenses", expenseDelete.dataset.deleteExpense).catch((error) => showToast(error.message, true));
    if (transferEdit) editTransfer(transferEdit.dataset.editTransfer);
    if (transferDelete) removeRecord("transfers", transferDelete.dataset.deleteTransfer).catch((error) => showToast(error.message, true));
    if (supplyOrderEdit) editSupplyOrder(supplyOrderEdit.dataset.editSupplyOrder);
    if (supplyOrderDelete) removeRecord("supply-orders", supplyOrderDelete.dataset.deleteSupplyOrder).catch((error) => showToast(error.message, true));
    if (deliveryNoteEdit) editDeliveryNote(deliveryNoteEdit.dataset.editDeliveryNote);
    if (deliveryNoteDelete) removeRecord("delivery-notes", deliveryNoteDelete.dataset.deleteDeliveryNote).catch((error) => showToast(error.message, true));
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
    resetSupplyOrderForm();
    resetDeliveryNoteForm();
    showApp();
    showToast("النظام جاهز");
  } catch (error) {
    showLogin();
  }
  showLoginErrorFromUrl();
}

init().catch((error) => showToast(error.message, true));
