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
  invoices: [],
  invoiceDraft: null,
  customerStatement: null,
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

const searchableSelects = new WeakMap();

function normalizeFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

function optionMatches(option, query, selectedValues) {
  return !query
    || !option.value
    || selectedValues.has(String(option.value))
    || normalizeFilterText(option.textContent).includes(query);
}

function applySelectFilter(select) {
  const control = searchableSelects.get(select);
  if (!control) return;
  const query = normalizeFilterText(control.input.value);
  const selectedValues = new Set(qsa("option:checked", select).map((option) => String(option.value)));
  const fragment = document.createDocumentFragment();

  control.options.forEach((source) => {
    if (source.tagName === "OPTGROUP") {
      const groupMatches = normalizeFilterText(source.label).includes(query);
      const group = source.cloneNode(false);
      qsa("option", source).forEach((sourceOption) => {
        if (groupMatches || optionMatches(sourceOption, query, selectedValues)) {
          const option = sourceOption.cloneNode(true);
          option.selected = selectedValues.has(String(option.value));
          group.appendChild(option);
        }
      });
      if (group.children.length) fragment.appendChild(group);
      return;
    }
    if (optionMatches(source, query, selectedValues)) {
      const option = source.cloneNode(true);
      option.selected = selectedValues.has(String(option.value));
      fragment.appendChild(option);
    }
  });

  select.replaceChildren(fragment);
  control.empty.classList.toggle("hidden", select.options.length > 0);
}

function refreshSearchableSelect(select, clearQuery = true) {
  const control = searchableSelects.get(select);
  if (!control) return;
  control.options = Array.from(select.children, (child) => child.cloneNode(true));
  if (clearQuery) control.input.value = "";
  applySelectFilter(select);
}

function enhanceSearchableSelect(select) {
  if (!select || searchableSelects.has(select)) return;
  const wrapper = document.createElement("div");
  wrapper.className = `searchable-select${select.multiple ? " searchable-select-multiple" : ""}`;
  const input = document.createElement("input");
  input.type = "search";
  input.className = "select-search-input";
  input.placeholder = select.multiple ? "اكتب لتصفية الخيارات" : "اكتب جزءًا من اسم الاختيار";
  input.autocomplete = "off";
  input.setAttribute("aria-label", `بحث في ${select.closest("label")?.childNodes[0]?.textContent?.trim() || "الاختيارات"}`);
  const empty = document.createElement("span");
  empty.className = "select-search-empty hidden";
  empty.textContent = "لا توجد اختيارات مطابقة";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(input, select, empty);
  searchableSelects.set(select, {
    input,
    empty,
    options: Array.from(select.children, (child) => child.cloneNode(true)),
  });
  input.addEventListener("input", () => applySelectFilter(select));
  select.addEventListener("change", () => {
    const control = searchableSelects.get(select);
    if (!control || !control.input.value) return;
    control.input.value = "";
    applySelectFilter(select);
  });
}

function enhanceSearchableSelects(root = document) {
  const selects = root.matches?.("select") ? [root] : qsa("select", root);
  selects.forEach(enhanceSearchableSelect);
}

document.addEventListener("reset", (event) => {
  setTimeout(() => {
    qsa("select", event.target).forEach((select) => {
      const control = searchableSelects.get(select);
      if (!control) return;
      control.input.value = "";
      applySelectFilter(select);
    });
  });
});

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

function effectiveRole() {
  return state.user?.role === "user" ? "collector" : state.user?.role;
}

function isAdmin() {
  return effectiveRole() === "admin";
}

function isViewer() {
  return effectiveRole() === "viewer";
}

function isCollector() {
  return effectiveRole() === "collector";
}

function isPlanner() {
  return effectiveRole() === "planner";
}

function canEditSupplyOrders() {
  return isAdmin() || isCollector();
}

function displayRole(role) {
  if (role === "collector" || role === "user") return "محصل";
  if (role === "planner") return "Planner";
  return role || "";
}

function roleLabel() {
  return displayRole(effectiveRole());
}

function applyRolePermissions() {
  const collector = isCollector();
  const planner = isPlanner();
  qsa(".tab").forEach((tab) => {
    const allowedForCollector = ["collections", "supplyOrders"].includes(tab.dataset.tab);
    const allowedForPlanner = tab.dataset.tab === "supplyOrders";
    tab.classList.toggle("hidden", (collector && !allowedForCollector) || (planner && !allowedForPlanner));
  });
  qsa(".admin-only").forEach((item) => item.classList.toggle("hidden", !isAdmin()));
  qs("#mainMetrics")?.classList.toggle("hidden", collector || planner);
  qs("#backupBtn")?.classList.toggle("hidden", collector || planner);

  const forms = ["collectionForm", "customerForm", "supplyOrderForm", "deliveryNoteForm", "invoiceForm", "expenseForm", "methodForm", "transferForm", "userForm"];
  forms.forEach((id) => {
    const allowed = isAdmin() || (collector && ["collectionForm", "supplyOrderForm"].includes(id));
    qs(`#${id}`)?.classList.toggle("hidden", !allowed);
  });
  qsa(".entry-layout").forEach((layout) => layout.classList.toggle("read-only-layout", isViewer() || planner));

  if (collector) setActiveTab("collections");
  else if (planner) setActiveTab("supplyOrders");
  else if (qs(".tab.active.hidden")) setActiveTab("dashboard");
}

function adminRecordActions(editAttribute, deleteAttribute, id) {
  if (!isAdmin()) return "";
  return `
    <button type="button" ${editAttribute}="${id}" title="تعديل">✎</button>
    <button class="danger" type="button" ${deleteAttribute}="${id}" title="حذف">×</button>
  `;
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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
  refreshSearchableSelect(select);
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

function fillInvoiceDeliverySelect() {
  const select = qs('#invoiceForm select[name="delivery_note_id"]');
  if (!select) return;
  const current = select.value;
  const editingInvoiceId = qs('#invoiceForm input[name="id"]')?.value || "";
  const editingInvoice = state.invoices.find((invoice) => String(invoice.id) === String(editingInvoiceId));
  const invoiced = new Set(state.invoices.map((invoice) => String(invoice.delivery_note_id)));
  select.innerHTML = `<option value="">اختر إذن التسليم</option>`;
  state.deliveryNotes.forEach((note) => {
    if (invoiced.has(String(note.id)) && String(note.id) !== String(editingInvoice?.delivery_note_id || "")) return;
    const option = document.createElement("option");
    option.value = note.id;
    option.textContent = `#${note.id} - ${note.customer_name} - ${note.delivery_date || ""}`;
    select.appendChild(option);
  });
  if (current) select.value = current;
  refreshSearchableSelect(select);
}

function matchingSupplyOrders(note, item) {
  return state.supplyOrders.filter((order) => (
    String(order.customer_id) === String(note.customer_id)
    && String(order.design_id || "") === String(item.design_id || "")
    && String(order.size_id || "") === String(item.size_id || "")
  ));
}

function selectedDeliveryNote() {
  const id = qs('#invoiceForm select[name="delivery_note_id"]')?.value;
  return state.deliveryNotes.find((note) => String(note.id) === String(id));
}

function resetInvoiceForm() {
  const form = qs("#invoiceForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  qs("#invoiceFormTitle").textContent = "إصدار فاتورة";
  form.delivery_charge.value = "0";
  state.invoiceDraft = null;
  fillInvoiceDeliverySelect();
  renderInvoiceEditor();
}

function buildInvoiceDraft(note) {
  return {
    delivery_note_id: note.id,
    items: (note.items || []).map((item) => ({
      delivery_note_item_id: item.id,
      supply_order_id: "",
      price_type: item.product_type === "غطيان" ? "manual" : "without_cover",
      unit_price: 0,
    })),
  };
}

function syncInvoiceDraftFromDom() {
  if (!state.invoiceDraft) return;
  state.invoiceDraft.items.forEach((item) => {
    const row = qs(`[data-invoice-item="${item.delivery_note_item_id}"]`);
    if (!row) return;
    item.supply_order_id = row.querySelector('[name="supply_order_id"]')?.value || "";
    item.price_type = row.querySelector('[name="price_type"]')?.value || "manual";
    item.unit_price = Number(row.querySelector('[name="unit_price"]')?.value || 0);
  });
}

function invoiceLineTotal(noteItem, draftItem) {
  return Number(noteItem.quantity_amount || 0) * Number(draftItem.unit_price || 0);
}

function invoiceNeedsDeliveryCharge() {
  if (!state.invoiceDraft) return false;
  return state.invoiceDraft.items.some((item) => {
    const order = state.supplyOrders.find((row) => String(row.id) === String(item.supply_order_id));
    return order?.delivery_cost_party === "العميل";
  });
}

function invoiceTotals() {
  const note = selectedDeliveryNote();
  if (!note || !state.invoiceDraft) return { subtotal: 0, deliveryCharge: 0, total: 0 };
  const subtotal = (note.items || []).reduce((sum, noteItem) => {
    const draftItem = state.invoiceDraft.items.find((row) => String(row.delivery_note_item_id) === String(noteItem.id));
    return sum + (draftItem ? invoiceLineTotal(noteItem, draftItem) : 0);
  }, 0);
  const deliveryCharge = Number(qs('#invoiceForm input[name="delivery_charge"]')?.value || 0);
  return { subtotal, deliveryCharge, total: subtotal + deliveryCharge };
}

function renderInvoiceEditor() {
  const host = qs("#invoiceItemEditor");
  if (!host) return;
  const note = selectedDeliveryNote();
  if (!note) {
    host.innerHTML = `<p class="muted">اختر إذن التسليم لبدء إصدار الفاتورة.</p>`;
    qs("#invoiceDeliveryChargeWrap").classList.add("hidden");
    return;
  }
  if (!state.invoiceDraft || String(state.invoiceDraft.delivery_note_id) !== String(note.id)) {
    state.invoiceDraft = buildInvoiceDraft(note);
  }
  host.innerHTML = (note.items || []).map((noteItem, index) => {
    const draftItem = state.invoiceDraft.items[index];
    const orders = noteItem.product_type === "غطيان" ? [] : matchingSupplyOrders(note, noteItem);
    const selectedOrder = state.supplyOrders.find((order) => String(order.id) === String(draftItem.supply_order_id));
    if (selectedOrder && draftItem.price_type === "with_cover") draftItem.unit_price = Number(selectedOrder.price_with_cover || 0);
    if (selectedOrder && draftItem.price_type === "without_cover") draftItem.unit_price = Number(selectedOrder.price_without_cover || 0);
    return `
      <div class="line-card" data-invoice-item="${noteItem.id}">
        <div class="line-card-head"><strong>الصنف ${index + 1}</strong><span>${noteItem.product_type}</span></div>
        <dl class="mini-summary">
          <div><dt>التصميم</dt><dd>${noteItem.design_name || "-"}</dd></div>
          <div><dt>المقاس</dt><dd>${noteItem.size_name || "-"}</dd></div>
          <div><dt>العدد</dt><dd>${money(noteItem.quantity_amount)} ${noteItem.quantity_unit || ""}</dd></div>
        </dl>
        ${noteItem.product_type === "غطيان" ? `
          <input type="hidden" name="price_type" value="manual">
          <label>سعر الغطيان<input name="unit_price" type="number" min="0" step="0.01" value="${draftItem.unit_price || 0}"></label>
        ` : `
          <label>أمر التوريد<select name="supply_order_id" required>
            <option value="">اختر أمر التوريد</option>
            ${orders.map((order) => `<option value="${order.id}" ${String(order.id) === String(draftItem.supply_order_id) ? "selected" : ""}>#${order.id} - ${order.order_date || ""} - بدون ${money(order.price_without_cover)} / بغطاء ${money(order.price_with_cover)}</option>`).join("")}
          </select></label>
          <label>نوع السعر<select name="price_type">
            <option value="without_cover" ${draftItem.price_type === "without_cover" ? "selected" : ""}>بدون غطاء - ${selectedOrder ? money(selectedOrder.price_without_cover) : "0"}</option>
            <option value="with_cover" ${draftItem.price_type === "with_cover" ? "selected" : ""}>بغطاء - ${selectedOrder ? money(selectedOrder.price_with_cover) : "0"}</option>
          </select></label>
          <label>السعر المستخدم<input name="unit_price" type="number" min="0" step="0.01" value="${draftItem.unit_price || 0}" readonly></label>
        `}
        <strong>إجمالي الصنف: ${money(invoiceLineTotal(noteItem, draftItem))}</strong>
      </div>
    `;
  }).join("");
  enhanceSearchableSelects(host);
  qs("#invoiceDeliveryChargeWrap").classList.toggle("hidden", !invoiceNeedsDeliveryCharge());
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
      <td class="actions">${adminRecordActions("data-edit-collection", "data-delete-collection", item.id)}</td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="muted">لا توجد تحصيلات مطابقة</td></tr>`;
}

function renderCustomers() {
  const body = qs("#customerRows");
  if (!body) return;
  const query = normalizeFilterText(qs("#customerSearch")?.value);
  const customers = state.customers.filter((item) => !query || normalizeFilterText(item.name).includes(query));
  const count = qs("#customerCount");
  if (count) count.textContent = query ? `${customers.length} من ${state.customers.length}` : state.customers.length;
  body.innerHTML = customers.map((item) => `
    <tr>
      <td data-label="العميل">${escapeHtml(item.name)}</td>
      <td data-label="إجمالي التحصيل">${money(item.total_collections)}</td>
      <td data-label="عدد التحصيلات">${money(item.collection_count)}</td>
      <td data-label="آخر تحصيل">${escapeHtml(item.last_collection_date || "-")}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">${query ? "لا يوجد عميل مطابق للبحث" : "لا توجد بيانات عملاء"}</td></tr>`;
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
      <td class="actions">${adminRecordActions("data-edit-expense", "data-delete-expense", item.id)}</td>
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
      <td class="actions">${adminRecordActions("data-edit-transfer", "data-delete-transfer", item.id)}</td>
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
        ${canEditSupplyOrders() ? `<button type="button" data-edit-supply-order="${item.id}" title="تعديل">✎</button>` : ""}
        <button type="button" data-xlsx-supply-order="${item.id}" title="Excel">Excel</button>
        <button type="button" data-pdf-supply-order="${item.id}" title="PDF">PDF</button>
        ${isAdmin() ? `<button class="danger" type="button" data-delete-supply-order="${item.id}" title="حذف">×</button>` : ""}
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
        ${isAdmin() ? `<button type="button" data-edit-delivery-note="${item.id}" title="تعديل">✎</button>` : ""}
        <button type="button" data-xlsx-delivery-note="${item.id}" title="Excel">Excel</button>
        <button type="button" data-pdf-delivery-note="${item.id}" title="PDF">PDF</button>
        ${isAdmin() ? `<button class="danger" type="button" data-delete-delivery-note="${item.id}" title="حذف">×</button>` : ""}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">لا توجد أذونات تسليم مسجلة</td></tr>`;
}

function renderInvoices() {
  const body = qs("#invoiceRows");
  if (!body) return;
  body.innerHTML = state.invoices.map((item) => `
    <tr>
      <td data-label="رقم">${item.id}</td>
      <td data-label="التاريخ">${item.invoice_date || "-"}</td>
      <td data-label="إذن التسليم">#${item.delivery_note_id}</td>
      <td data-label="العميل">${item.customer_name || "-"}</td>
      <td data-label="الأصناف">${money(item.item_count)}</td>
      <td data-label="الإجمالي">${money(item.total)}</td>
      <td data-label="المستخدم">${item.created_by_name || "-"}</td>
      <td class="actions">
        ${isAdmin() ? `<button type="button" data-edit-invoice="${item.id}" title="تعديل">✎</button>` : ""}
        <button type="button" data-xlsx-invoice="${item.id}" title="Excel">Excel</button>
        <button type="button" data-pdf-invoice="${item.id}" title="PDF">PDF</button>
        ${isAdmin() ? `<button class="danger" type="button" data-delete-invoice="${item.id}" title="حذف">×</button>` : ""}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="muted">لا توجد فواتير مسجلة</td></tr>`;
}

function renderUsers() {
  const body = qs("#userRows");
  if (!body) return;
  body.innerHTML = state.users.map((item) => `
    <tr>
      <td data-label="اسم المستخدم">${item.username}</td>
      <td data-label="الاسم الكامل">${item.display_name}</td>
      <td data-label="الصلاحية">${displayRole(item.role)}</td>
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

function renderCustomerStatement() {
  const data = state.customerStatement;
  qs("#statementInvoiceTotal").textContent = money(data?.totals?.invoices || 0);
  qs("#statementCollectionTotal").textContent = money(data?.totals?.collections || 0);
  qs("#statementRemaining").textContent = money(data?.totals?.remaining || 0);

  const invoiceBody = qs("#statementInvoiceRows");
  if (invoiceBody) {
    const rows = data?.invoices || [];
    invoiceBody.innerHTML = rows.map((item) => `
      <tr>
        <td data-label="رقم الفاتورة">#${item.id}</td>
        <td data-label="التاريخ">${item.invoice_date || "-"}</td>
        <td data-label="إذن التسليم">#${item.delivery_note_id}</td>
        <td data-label="الإجمالي">${money(item.total)}</td>
        <td data-label="ملاحظة">${item.note || "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="muted">لا توجد فواتير لهذا العميل</td></tr>`;
  }

  const collectionBody = qs("#statementCollectionRows");
  if (collectionBody) {
    const rows = data?.collections || [];
    collectionBody.innerHTML = rows.map((item) => `
      <tr>
        <td data-label="رقم">#${item.id}</td>
        <td data-label="التاريخ">${item.entry_date || "-"}</td>
        <td data-label="المسؤول">${item.responsible || "-"}</td>
        <td data-label="النوع">${item.collection_type || "-"}</td>
        <td data-label="المبلغ">${money(item.amount)}</td>
        <td data-label="الطريقة">${item.payment_method || "-"}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="muted">لا توجد تحصيلات لهذا العميل</td></tr>`;
  }
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

function printDocument(title, blocks) {
  const win = window.open("", "_blank");
  if (!win) {
    showToast("اسمح بفتح النوافذ المنبثقة لطباعة PDF", true);
    return;
  }
  const content = blocks.map((block) => {
    if (block.type === "meta") {
      return `<dl class="meta">${block.rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
    }
    if (block.type === "table") {
      return `<h2>${escapeHtml(block.title)}</h2><table><thead><tr>${block.headers.map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    if (block.type === "totals") {
      return `<dl class="totals">${block.rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
    }
    return "";
  }).join("");
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,Tahoma,sans-serif;margin:24px;color:#111827}
    h1{font-size:24px;margin:0 0 18px;text-align:center}
    h2{font-size:18px;margin:18px 0 8px}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    th,td{border:1px solid #98a2b3;padding:7px;text-align:center;font-size:12px}
    th{background:#eef4ff}
    .meta,.totals{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
    .meta div,.totals div{border:1px solid #d0d5dd;padding:8px}
    dt{color:#667085;font-size:12px} dd{margin:2px 0 0;font-weight:bold}
    @media print{button{display:none} body{margin:10mm}}
  </style></head><body><h1>${escapeHtml(title)}</h1>${content}<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
  win.document.close();
}

function printSupplyOrder(id) {
  const item = state.supplyOrders.find((row) => String(row.id) === String(id));
  if (!item) return;
  printDocument(`أمر توريد #${item.id}`, [
    { type: "meta", rows: [["التاريخ", item.order_date || "-"], ["العميل", item.customer_name || "-"], ["التصميم", item.design_name || "-"], ["المقاس", item.size_name || "-"], ["الخامة", item.material_name || "-"], ["الكمية", `${money(item.quantity_amount)} ${item.quantity_unit || ""}`], ["السعر بدون غطاء", money(item.price_without_cover)], ["السعر بالغطاء", money(item.price_with_cover)], ["سعر السريل", money(item.serial_color_price)], ["تكلفة النقل", item.delivery_cost_party || "-"], ["تاريخ التوريد", item.supply_date || "-"], ["ملاحظة", item.note || "-"]] },
  ]);
}

function printDeliveryNote(id) {
  const note = state.deliveryNotes.find((row) => String(row.id) === String(id));
  if (!note) return;
  printDocument(`إذن تسليم #${note.id}`, [
    { type: "meta", rows: [["التاريخ", note.delivery_date || "-"], ["العميل", note.customer_name || "-"]] },
    { type: "table", title: "الأصناف", headers: ["#", "الصنف", "التصميم", "المقاس", "العدد", "ملاحظة"], rows: (note.items || []).map((item) => [item.line_no, item.product_type, item.design_name || "-", item.size_name || "-", `${money(item.quantity_amount)} ${item.quantity_unit || ""}`, item.note || "-"]) },
  ]);
}

function printInvoice(id) {
  const invoice = state.invoices.find((row) => String(row.id) === String(id));
  if (!invoice) return;
  printDocument(`فاتورة #${invoice.id}`, [
    { type: "meta", rows: [["التاريخ", invoice.invoice_date || "-"], ["العميل", invoice.customer_name || "-"], ["إذن التسليم", `#${invoice.delivery_note_id}`]] },
    { type: "table", title: "الأصناف", headers: ["#", "الصنف", "التصميم", "المقاس", "العدد", "أمر التوريد", "السعر", "الإجمالي"], rows: (invoice.items || []).map((item) => [item.line_no, item.product_type, item.design_name || "-", item.size_name || "-", `${money(item.quantity_amount)} ${item.quantity_unit || ""}`, item.supply_order_id ? `#${item.supply_order_id}` : "-", money(item.unit_price), money(item.line_total)]) },
    { type: "totals", rows: [["إجمالي الأصناف", money(invoice.subtotal)], ["مصاريف النقل", money(invoice.delivery_charge)], ["إجمالي الفاتورة", money(invoice.total)]] },
  ]);
}

function printCustomerStatement() {
  const data = state.customerStatement;
  if (!data) throw new Error("اعرض كشف الحساب أولا");
  printDocument(`كشف حساب ${data.customer.name}`, [
    { type: "totals", rows: [["إجمالي الفواتير", money(data.totals.invoices)], ["إجمالي التحصيلات", money(data.totals.collections)], ["المتبقي للتحصيل", money(data.totals.remaining)]] },
    { type: "table", title: "الفواتير", headers: ["رقم", "التاريخ", "إذن التسليم", "الإجمالي", "ملاحظة"], rows: data.invoices.map((item) => [`#${item.id}`, item.invoice_date || "-", `#${item.delivery_note_id}`, money(item.total), item.note || "-"]) },
    { type: "table", title: "التحصيلات", headers: ["رقم", "التاريخ", "المسؤول", "النوع", "المبلغ", "الطريقة"], rows: data.collections.map((item) => [`#${item.id}`, item.entry_date || "-", item.responsible || "-", item.collection_type || "-", money(item.amount), item.payment_method || "-"]) },
  ]);
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
  applyRolePermissions();
  qsa('select[name="responsible"]').forEach((select) => fillSelect(select, state.responsibles));
  qsa('select[name="customer_id"]').forEach((select) => fillCustomerSelect(select, select.value));
  fillCustomerSelect(qs("#collectionReportCustomer"), qs("#collectionReportCustomer")?.value);
  fillCustomerSelect(qs("#statementCustomer"), qs("#statementCustomer")?.value);
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
  fillInvoiceDeliverySelect();
  qsa('select[name="source_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  qsa('select[name="target_method"]').forEach((select) => fillSelect(select, state.paymentMethods));
  fillCustodyDatalist();
  qs("#statusLine").textContent = "نسخة Cloudflare العامة";
  qs("#currentUser").textContent = state.user ? `${state.user.display_name} (${roleLabel()})` : "";
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
  fillCustomerSelect(qs("#statementCustomer"), qs("#statementCustomer")?.value);
  fillSupplyOrderFormLookups();
  fillDeliveryNoteFormLookups();
}

async function loadExpenses() {
  const data = await api(`/api/expenses?${expenseQuery()}`);
  state.expenses = data.items;
  renderExpenses();
}

async function loadAudit() {
  if (!state.user || (!isAdmin() && !isViewer())) {
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
  renderInvoiceEditor();
}

async function loadDeliveryNotes() {
  const data = await api("/api/delivery-notes");
  state.deliveryNotes = data.items;
  renderDeliveryNotes();
  fillInvoiceDeliverySelect();
  renderInvoiceEditor();
}

async function loadInvoices() {
  const data = await api("/api/invoices");
  state.invoices = data.items;
  renderInvoices();
  fillInvoiceDeliverySelect();
}

async function loadUsers() {
  if (!state.user || (!isAdmin() && !isViewer())) {
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

async function loadCustomerStatement() {
  const customerId = qs("#statementCustomer")?.value;
  if (!customerId) throw new Error("اختر العميل أولا");
  state.customerStatement = await api(`/api/customer-statement?customer_id=${encodeURIComponent(customerId)}`);
  renderCustomerStatement();
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
  if (isCollector()) {
    await Promise.all([loadCollections(), loadSupplyOrders()]);
    return;
  }
  if (isPlanner()) {
    await loadSupplyOrders();
    return;
  }
  await Promise.all([loadDashboard(), loadCollections(), loadCustomers(), loadExpenses(), loadTransfers(), loadSupplyOrders(), loadDeliveryNotes(), loadInvoices(), loadUsers(), loadAudit(), loadExpenseReport(), loadCollectionReport(), loadResponsibleMonthly()]);
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
  if (isCollector()) await Promise.all([loadBootstrap(), loadCollections()]);
  else await Promise.all([loadBootstrap(), loadDashboard(), loadCollections(), loadCustomers(), loadAudit()]);
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
  if (isCollector()) await Promise.all([loadBootstrap(), loadSupplyOrders()]);
  else await Promise.all([loadBootstrap(), loadSupplyOrders(), loadCustomers(), loadAudit()]);
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

function invoicePayload() {
  const form = qs("#invoiceForm");
  const note = selectedDeliveryNote();
  if (!note) throw new Error("إذن التسليم مطلوب");
  syncInvoiceDraftFromDom();
  const needsDelivery = invoiceNeedsDeliveryCharge();
  const deliveryCharge = Number(form.delivery_charge.value || 0);
  if (needsDelivery && deliveryCharge <= 0) throw new Error("مصاريف النقل مطلوبة لأن النقل على العميل");
  const items = (note.items || []).map((noteItem) => {
    const draftItem = state.invoiceDraft.items.find((row) => String(row.delivery_note_item_id) === String(noteItem.id));
    if (!draftItem) throw new Error(`بيانات الصنف ${noteItem.line_no} ناقصة`);
    if (noteItem.product_type !== "غطيان" && !draftItem.supply_order_id) throw new Error(`اختر أمر التوريد للصنف ${noteItem.line_no}`);
    if (!Number.isFinite(Number(draftItem.unit_price)) || Number(draftItem.unit_price) < 0) throw new Error(`السعر غير صحيح للصنف ${noteItem.line_no}`);
    return {
      delivery_note_item_id: noteItem.id,
      supply_order_id: draftItem.supply_order_id,
      price_type: draftItem.price_type,
      unit_price: Number(draftItem.unit_price || 0),
    };
  });
  return {
    invoice_date: form.invoice_date.value,
    delivery_note_id: note.id,
    delivery_charge: needsDelivery ? deliveryCharge : 0,
    note: form.note.value.trim(),
    items,
  };
}

function showInvoiceReview() {
  const payload = invoicePayload();
  const note = selectedDeliveryNote();
  const totals = invoiceTotals();
  const rows = (note.items || []).map((noteItem) => {
    const draftItem = state.invoiceDraft.items.find((item) => String(item.delivery_note_item_id) === String(noteItem.id));
    const order = state.supplyOrders.find((item) => String(item.id) === String(draftItem?.supply_order_id));
    return `
      <tr>
        <td>${noteItem.product_type}</td>
        <td>${noteItem.design_name || "-"}</td>
        <td>${noteItem.size_name || "-"}</td>
        <td>${money(noteItem.quantity_amount)} ${noteItem.quantity_unit || ""}</td>
        <td>${order ? `#${order.id}` : "-"}</td>
        <td>${draftItem?.price_type === "with_cover" ? "بغطاء" : draftItem?.price_type === "without_cover" ? "بدون غطاء" : "يدوي"}</td>
        <td>${money(draftItem?.unit_price)}</td>
        <td>${money(invoiceLineTotal(noteItem, draftItem))}</td>
      </tr>
    `;
  }).join("");
  qs("#invoiceReviewSummary").innerHTML = `
    <p><strong>العميل:</strong> ${note.customer_name}</p>
    <p><strong>إذن التسليم:</strong> #${note.id}</p>
    <div class="table-wrap records">
      <table>
        <thead><tr><th>الصنف</th><th>التصميم</th><th>المقاس</th><th>العدد</th><th>أمر التوريد</th><th>نوع السعر</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <dl class="invoice-total">
      <div><dt>إجمالي الأصناف</dt><dd>${money(totals.subtotal)}</dd></div>
      <div><dt>مصاريف النقل</dt><dd>${money(payload.delivery_charge)}</dd></div>
      <div><dt>إجمالي الفاتورة</dt><dd>${money(totals.subtotal + payload.delivery_charge)}</dd></div>
    </dl>
  `;
  qs("#invoiceReviewModal").classList.remove("hidden");
}

async function issueInvoice() {
  const payload = invoicePayload();
  const id = qs('#invoiceForm input[name="id"]').value;
  if (id) {
    await api(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  } else {
    await api("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
  }
  qs("#invoiceReviewModal").classList.add("hidden");
  resetInvoiceForm();
  showToast(id ? "تم تعديل الفاتورة" : "تم إصدار الفاتورة");
  await Promise.all([loadInvoices(), loadAudit()]);
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

function editInvoice(id) {
  const item = state.invoices.find((row) => String(row.id) === String(id));
  if (!item) return;
  const form = qs("#invoiceForm");
  form.elements.id.value = item.id;
  form.invoice_date.value = item.invoice_date || "";
  form.delivery_charge.value = item.delivery_charge || 0;
  form.note.value = item.note || "";
  fillInvoiceDeliverySelect();
  form.delivery_note_id.value = item.delivery_note_id || "";
  const note = selectedDeliveryNote();
  state.invoiceDraft = {
    delivery_note_id: item.delivery_note_id,
    items: (note?.items || []).map((noteItem) => {
      const invoiceItem = (item.items || []).find((row) => String(row.delivery_note_item_id) === String(noteItem.id));
      return {
        delivery_note_item_id: noteItem.id,
        supply_order_id: invoiceItem?.supply_order_id || "",
        price_type: invoiceItem?.price_type || (noteItem.product_type === "غطيان" ? "manual" : "without_cover"),
        unit_price: invoiceItem?.unit_price || 0,
      };
    }),
  };
  qs("#invoiceFormTitle").textContent = `تعديل فاتورة #${item.id}`;
  renderInvoiceEditor();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeRecord(kind, id) {
  const labels = { collections: "التحصيل", expenses: "المصروف", transfers: "التوسيط", "supply-orders": "أمر التوريد", "delivery-notes": "إذن التسليم", invoices: "الفاتورة" };
  const label = labels[kind] || "السجل";
  if (!confirm(`حذف ${label} رقم ${id}؟`)) return;
  await api(`/api/${kind}/${id}`, { method: "DELETE" });
  showToast("تم الحذف");
  await Promise.all([
    loadDashboard(),
    kind === "collections" ? loadCollections() : kind === "expenses" ? loadExpenses() : kind === "transfers" ? loadTransfers() : kind === "supply-orders" ? loadSupplyOrders() : kind === "delivery-notes" ? loadDeliveryNotes() : loadInvoices(),
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

  qs("#loadStatementBtn").addEventListener("click", () => {
    loadCustomerStatement().catch((error) => showToast(error.message, true));
  });

  qs("#exportStatementExcelBtn").addEventListener("click", () => {
    const customerId = qs("#statementCustomer")?.value;
    if (!customerId) return showToast("اختر العميل أولا", true);
    window.location.href = `/api/customer-statement.xlsx?customer_id=${encodeURIComponent(customerId)}`;
  });

  qs("#exportStatementPdfBtn").addEventListener("click", () => {
    try {
      printCustomerStatement();
    } catch (error) {
      showToast(error.message, true);
    }
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
  qs('#invoiceForm select[name="delivery_note_id"]').addEventListener("change", () => {
    const note = selectedDeliveryNote();
    state.invoiceDraft = note ? buildInvoiceDraft(note) : null;
    renderInvoiceEditor();
  });
  qs("#reviewInvoiceBtn").addEventListener("click", () => {
    try {
      showInvoiceReview();
    } catch (error) {
      showToast(error.message, true);
    }
  });
  qs("#issueInvoiceBtn").addEventListener("click", () => {
    issueInvoice().catch((error) => showToast(error.message, true));
  });
  qs("#continueInvoiceEditBtn").addEventListener("click", () => {
    qs("#invoiceReviewModal").classList.add("hidden");
  });
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
  qs("#customerSearch").addEventListener("input", renderCustomers);
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
  qs("#invoiceItemEditor").addEventListener("change", (event) => {
    const row = event.target.closest("[data-invoice-item]");
    if (!row) return;
    const draftItem = state.invoiceDraft?.items.find((item) => String(item.delivery_note_item_id) === String(row.dataset.invoiceItem));
    if (!draftItem) return;
    draftItem.supply_order_id = row.querySelector('[name="supply_order_id"]')?.value || "";
    draftItem.price_type = row.querySelector('[name="price_type"]')?.value || "manual";
    const order = state.supplyOrders.find((item) => String(item.id) === String(draftItem.supply_order_id));
    if (order && draftItem.price_type === "with_cover") draftItem.unit_price = Number(order.price_with_cover || 0);
    else if (order && draftItem.price_type === "without_cover") draftItem.unit_price = Number(order.price_without_cover || 0);
    else draftItem.unit_price = Number(row.querySelector('[name="unit_price"]')?.value || 0);
    renderInvoiceEditor();
  });
  qs("#invoiceItemEditor").addEventListener("input", (event) => {
    if (event.target.name !== "unit_price") return;
    const row = event.target.closest("[data-invoice-item]");
    const draftItem = state.invoiceDraft?.items.find((item) => String(item.delivery_note_item_id) === String(row?.dataset.invoiceItem));
    if (draftItem) draftItem.unit_price = Number(event.target.value || 0);
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
    const invoiceEdit = event.target.closest("[data-edit-invoice]");
    const invoiceDelete = event.target.closest("[data-delete-invoice]");
    const supplyOrderXlsx = event.target.closest("[data-xlsx-supply-order]");
    const supplyOrderPdf = event.target.closest("[data-pdf-supply-order]");
    const deliveryNoteXlsx = event.target.closest("[data-xlsx-delivery-note]");
    const deliveryNotePdf = event.target.closest("[data-pdf-delivery-note]");
    const invoiceXlsx = event.target.closest("[data-xlsx-invoice]");
    const invoicePdf = event.target.closest("[data-pdf-invoice]");
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
    if (invoiceEdit) editInvoice(invoiceEdit.dataset.editInvoice);
    if (invoiceDelete) removeRecord("invoices", invoiceDelete.dataset.deleteInvoice).catch((error) => showToast(error.message, true));
    if (supplyOrderXlsx) window.location.href = `/api/supply-orders/${supplyOrderXlsx.dataset.xlsxSupplyOrder}.xlsx`;
    if (supplyOrderPdf) printSupplyOrder(supplyOrderPdf.dataset.pdfSupplyOrder);
    if (deliveryNoteXlsx) window.location.href = `/api/delivery-notes/${deliveryNoteXlsx.dataset.xlsxDeliveryNote}.xlsx`;
    if (deliveryNotePdf) printDeliveryNote(deliveryNotePdf.dataset.pdfDeliveryNote);
    if (invoiceXlsx) window.location.href = `/api/invoices/${invoiceXlsx.dataset.xlsxInvoice}.xlsx`;
    if (invoicePdf) printInvoice(invoicePdf.dataset.pdfInvoice);
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
  enhanceSearchableSelects();
  bindEvents();
  try {
    await reloadAll();
    resetCollectionForm();
    resetExpenseForm();
    resetSupplyOrderForm();
    resetDeliveryNoteForm();
    resetInvoiceForm();
    renderCustomerStatement();
    showApp();
    showToast("النظام جاهز");
  } catch (error) {
    showLogin();
  }
  showLoginErrorFromUrl();
}

init().catch((error) => showToast(error.message, true));
