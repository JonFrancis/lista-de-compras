(() => {
  "use strict";
  const STORAGE_KEY = "minhalista.items.v1";
  const PRIORITY_LABELS = ["", "Pode esperar", "Baixa", "Média", "Alta", "Quero muito"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $("#item-form");
  const nameInput = $("#item-name");
  const urlInput = $("#item-link");
  const priceInput = $("#item-price");
  const list = $("#items-list");
  const emptyState = $("#empty-state");
  const searchEmpty = $("#search-empty");
  const dialog = $("#edit-dialog");
  let selectedPriority = 1;
  let selectedEditPriority = 1;
  let activeFilter = "active";
  let toastTimer;
  let items = readItems();

  function readItems() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === "string" && typeof item.name === "string") : [];
    } catch { return []; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      showToast("Não foi possível salvar. Confira o espaço disponível no navegador.");
      return false;
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }
  function formatPrice(value) {
    if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "";
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(" de ", " ");
  }
  function priorityDots(value) {
    return `<span class="priority-dots" aria-label="Prioridade ${value} de 5">${[1,2,3,4,5].map((n) => `<i class="${n <= value ? "filled" : ""}"></i>`).join("")}</span>`;
  }
  function render() {
    const active = items.filter((item) => !item.bought);
    const bought = items.filter((item) => item.bought);
    $("#summary-count").textContent = active.length;
    $("#heading-count").textContent = items.length;
    $("#active-count").textContent = active.length;
    $("#bought-count").textContent = bought.length;
    $("#summary-total").textContent = formatPrice(active.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    const query = $("#search").value.trim().toLocaleLowerCase("pt-BR");
    const current = activeFilter === "bought" ? bought : active;
    let visible = current.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(query));
    const sort = $("#sort").value;
    visible.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "price-low") return (a.price === "" ? Infinity : Number(a.price)) - (b.price === "" ? Infinity : Number(b.price));
      if (sort === "price-high") return (Number(b.price) || 0) - (Number(a.price) || 0);
      return Number(b.priority || 1) - Number(a.priority || 1) || new Date(b.createdAt) - new Date(a.createdAt);
    });
    list.innerHTML = visible.map((item) => {
      const url = safeUrl(item.url);
      const priority = Math.min(5, Math.max(1, Number(item.priority) || 1));
      const price = formatPrice(item.price);
      return `<article class="item-row ${item.bought ? "is-bought" : ""}" data-id="${escapeHtml(item.id)}">
        <button type="button" class="item-check" data-action="toggle" aria-label="${item.bought ? "Marcar como não comprado" : "Marcar como comprado"}" title="${item.bought ? "Marcar como não comprado" : "Marcar como comprado"}">${item.bought ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</button>
        <div class="item-copy"><h3 class="item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
          <div class="item-meta">${url ? `<a class="item-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Ver produto <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5m-.5-4.5L11 13m-2-7H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : "<span>Sem link salvo</span>"}<span>·</span><span class="${item.bought ? "bought-label" : "item-price"} ${!price ? "empty" : ""}">${price || "Preço não anotado"}</span></div>
          <div class="item-priority">${priorityDots(priority)} <span>${escapeHtml(PRIORITY_LABELS[priority])}</span></div></div>
        <div class="item-side"><div class="item-price-block"><div class="${price ? "item-price" : "item-price empty"}">${price || "—"}</div><div class="item-date">${formatDate(item.updatedAt || item.createdAt)}</div></div>
          <div class="item-actions"><button type="button" class="icon-button" data-action="edit" aria-label="Editar ${escapeHtml(item.name)}" title="Editar"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-.9L19 8.6a2.12 2.12 0 0 0-3-3L5.5 16.1 4 20Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="icon-button delete" data-action="delete" aria-label="Excluir ${escapeHtml(item.name)}" title="Excluir"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>
      </article>`;
    }).join("");
    const hasItems = items.length > 0;
    emptyState.hidden = hasItems;
    $("#empty-add").hidden = hasItems;
    list.hidden = visible.length === 0;
    searchEmpty.hidden = !query || visible.length > 0;
    const filterEmpty = $("#filter-empty");
    const hasNoItemsInFilter = hasItems && !query && current.length === 0;
    filterEmpty.hidden = !hasNoItemsInFilter;
    filterEmpty.textContent = activeFilter === "bought"
      ? "Nenhuma compra concluída ainda. Quando você marcar um item como comprado, ele aparece aqui."
      : "Tudo comprado por enquanto! Adicione outro item quando encontrar algo que queira. ";
  }
  function setPriority(root, value, edit = false) {
    const safe = Math.min(5, Math.max(1, Number(value) || 1));
    if (edit) selectedEditPriority = safe; else selectedPriority = safe;
    $$(".priority-option", root).forEach((button) => {
      const selected = Number(button.dataset.priority) === safe;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const hint = edit ? $("#edit-priority-hint") : $("#priority-hint");
    if (hint) hint.textContent = PRIORITY_LABELS[safe];
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
  }

  $$("#item-form .priority-option").forEach((button) => button.addEventListener("click", () => setPriority(form, button.dataset.priority)));
  $("#edit-priority").addEventListener("click", (event) => {
    const button = event.target.closest(".priority-option");
    if (button) setPriority($("#edit-priority"), button.dataset.priority, true);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const rawUrl = urlInput.value.trim();
    const url = safeUrl(rawUrl);
    const rawPrice = priceInput.value.trim();
    const price = rawPrice ? Number(rawPrice.replace(",", ".")) : "";
    const message = $("#form-message");
    if (!name) { message.textContent = "Dê um nome ao produto para adicionar."; nameInput.focus(); return; }
    if (rawUrl && !url) { message.textContent = "Digite um link válido começando com http:// ou https://."; urlInput.focus(); return; }
    if (rawPrice && (!Number.isFinite(price) || price < 0)) { message.textContent = "Digite um preço válido."; priceInput.focus(); return; }
    message.textContent = "";
    const now = new Date().toISOString();
    items.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, url, price, priority: selectedPriority, bought: false, createdAt: now, updatedAt: now });
    save(); form.reset(); setPriority(form, 1); render(); nameInput.focus(); showToast("Item adicionado à sua lista");
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const item = items.find((entry) => entry.id === row?.dataset.id);
    if (!item) return;
    if (button.dataset.action === "toggle") {
      item.bought = !item.bought; item.updatedAt = new Date().toISOString(); save(); render(); showToast(item.bought ? "Marcado como comprado" : "Item voltou para sua lista");
    } else if (button.dataset.action === "delete") {
      items = items.filter((entry) => entry.id !== item.id); save(); render(); showToast("Item removido da lista");
    } else if (button.dataset.action === "edit") {
      $("#edit-id").value = item.id; $("#edit-name").value = item.name; $("#edit-link").value = item.url || ""; $("#edit-price").value = item.price === "" ? "" : item.price; setPriority($("#edit-priority"), item.priority, true); dialog.showModal(); $("#edit-name").focus();
    }
  });
  $("#edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const item = items.find((entry) => entry.id === $("#edit-id").value);
    if (!item) return;
    const name = $("#edit-name").value.trim();
    const rawUrl = $("#edit-link").value.trim();
    const url = safeUrl(rawUrl);
    const rawPrice = $("#edit-price").value.trim();
    const price = rawPrice ? Number(rawPrice.replace(",", ".")) : "";
    if (!name) { $("#edit-name").focus(); return; }
    if (rawUrl && !url) { $("#edit-link").focus(); showToast("Digite um link válido começando com http:// ou https://."); return; }
    if (rawPrice && (!Number.isFinite(price) || price < 0)) { $("#edit-price").focus(); return; }
    Object.assign(item, { name, url, price, priority: selectedEditPriority, updatedAt: new Date().toISOString() });
    save(); dialog.close(); render(); showToast("Alterações salvas");
  });
  $$(".close-dialog").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  $$(".filter-tab").forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    $$(".filter-tab").forEach((tab) => { const active = tab === button; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active)); });
    render();
  }));
  $("#search").addEventListener("input", render);
  $("#sort").addEventListener("change", render);
  $("#clear-search").addEventListener("click", () => { $("#search").value = ""; render(); $("#search").focus(); });
  $("#empty-add").addEventListener("click", () => nameInput.focus());
  render();
})();
