// 读书手账 · 前端逻辑
const state = {
  view: "grid",
  status: "全部",
  tag: "全部",
  minRating: 0,
  year: "全部",
  search: ""
};

let DATA = [];
let noteSeq = 0;
const noteRegistry = {};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uniq = (a) => [...new Set(a)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function stars(n) {
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= n ? "★" : '<span class="off">★</span>';
  return s;
}

function spineHTML(b, size = "") {
  const bg = b.cover
    ? `background-image:url('${esc(b.cover)}');background-size:cover;background-position:center;`
    : `background:${b.color};`;
  return `<div class="cover spine ${size}" style="${bg}"><span class="spine-title">${esc(b.title)}</span></div>`;
}

// 一条深度笔记的卡片（compact 用于卡片内展开，full 用于详情抽屉）
function noteCardHTML(n, mode = "full") {
  const nid = "n" + (noteSeq++);
  noteRegistry[nid] = n;
  const tags = (n.tags || []).map((t) => `<span class="ntag">${esc(t)}</span>`).join("");
  const copyBtn = `<button class="copy-btn" data-nid="${nid}" type="button">复制</button>`;
  let html = `<div class="note-card">`;
  html += `<div class="note-head"><span class="note-summary">${esc(n.summary || "（无摘要）")}</span><span class="note-actions">${tags ? `<span class="note-tags">${tags}</span>` : ""}${copyBtn}</span></div>`;
  if (mode === "full" || n.excerpt) {
    html += `<div class="note-block note-excerpt"><span class="note-label">原文摘录</span><p>${esc(n.excerpt || "")}</p></div>`;
  }
  if (n.thinking) {
    html += `<div class="note-block note-thinking"><span class="note-label">我的思考 / 评论</span><p>${esc(n.thinking)}</p></div>`;
  }
  if (mode === "full" && n.critique) {
    html += `<div class="note-block note-critique"><span class="note-label">观点批判</span><p>${esc(n.critique)}</p></div>`;
  }
  html += `</div>`;
  return html;
}

function getFiltered() {
  const q = state.search.toLowerCase();
  return DATA.filter((b) => {
    if (state.status !== "全部" && b.statusLabel !== state.status) return false;
    if (state.tag !== "全部" && !(b.tags || []).includes(state.tag)) return false;
    if (state.minRating > 0 && b.rating < state.minRating) return false;
    if (state.year !== "全部" && String(b.year) !== String(state.year)) return false;
    if (q) {
      const hay = (b.searchText || (b.title + b.author + (b.notes || ""))).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ---------- renderers ---------- */
function renderStatus() {
  const statuses = ["全部", ...uniq(DATA.map((b) => b.statusLabel))];
  $("#statusRow").innerHTML =
    '<span class="filter-label">状态</span><div class="chips">' +
    statuses.map((s) => `<button class="chip ${state.status === s ? "active" : ""}" data-status="${esc(s)}">${esc(s)}</button>`).join("") +
    "</div>";
}

function renderSidebar() {
  const tags = uniq(DATA.flatMap((b) => b.tags || []));
  const years = uniq(DATA.map((b) => b.year)).sort((a, b) => b - a);
  const noteCount = DATA.reduce((s, b) => s + (b.detailedNotes?.length || 0), 0);
  $("#sidebar").innerHTML = `
    <div class="side-block"><h3>读书手帐 · ${DATA.length} 本 / ${noteCount} 则笔记</h3></div>
    <div class="side-block">
      <h3>标签</h3>
      <div class="side-list">
        <button data-filter="tag" data-value="全部" class="${state.tag === "全部" ? "active" : ""}">全部</button>
        ${tags.map((t) => `<button data-filter="tag" data-value="${esc(t)}" class="${state.tag === t ? "active" : ""}">${esc(t)}</button>`).join("")}
      </div>
    </div>
    <div class="side-block">
      <h3>评分</h3>
      <div class="side-list">
        <button data-filter="rating" data-value="0" class="${state.minRating === 0 ? "active" : ""}">全部</button>
        ${[5, 4, 3, 2, 1].map((r) => `<button data-filter="rating" data-value="${r}" class="${state.minRating === r ? "active" : ""}">${"★".repeat(r)} 及以上</button>`).join("")}
      </div>
    </div>
    <div class="side-block">
      <h3>年份</h3>
      <div class="side-list">
        <button data-filter="year" data-value="全部" class="${state.year === "全部" ? "active" : ""}">全部</button>
        ${years.map((y) => `<button data-filter="year" data-value="${y}" class="${state.year === String(y) ? "active" : ""}">${y}</button>`).join("")}
      </div>
    </div>`;
}

function renderGrid(list) {
  return `<div class="grid">` + list.map((b) => {
    const noteHTML = (b.detailedNotes || []).map((n) => noteCardHTML(n, "compact")).join("");
    return `
    <div class="card" data-id="${b.id}">
      <div class="card-head">
        ${spineHTML(b)}
        <div class="card-head-text">
          <h2>${esc(b.title)}</h2>
          <p class="author">${esc(b.author)}</p>
          <div class="stars">${stars(b.rating)}</div>
        </div>
      </div>
      <div class="tags">${(b.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <p class="excerpt">${esc(b.summary || "")}</p>
      <div class="card-foot">
        <span class="status-pill ${b.status}">${esc(b.statusLabel)} · ${esc(b.date)}</span>
        <button class="expand-btn">展开</button>
      </div>
      <div class="card-detail"><div>
        ${noteHTML || '<p class="notes" style="color:var(--faint)">（这本书还没有详细笔记）</p>'}
      </div></div>
    </div>`;
  }).join("") + `</div>`;
}

function renderList(list) {
  return `<div class="list">` + list.map((b) => `
    <div class="list-item" data-id="${b.id}">
      ${spineHTML(b, "mini")}
      <div>
        <h2>${esc(b.title)}</h2>
        <div class="meta">${esc(b.author)} · ${esc(b.statusLabel)} · <span class="stars">${stars(b.rating)}</span> · ${(b.detailedNotes || []).length} 则笔记</div>
      </div>
      <div class="right">${esc(b.date)}</div>
    </div>`).join("") + `</div>`;
}

function renderTimeline(list) {
  const years = uniq(list.map((b) => b.year)).sort((a, b) => b - a);
  return `<div class="timeline">` + years.map((y) => {
    const items = list.filter((b) => b.year === y).sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="tl-year">${y}</div>` + items.map((b) => `
      <div class="tl-item" data-id="${b.id}">
        <div class="tl-card">
          <h2>${esc(b.title)}</h2>
          <div class="meta">${esc(b.author)} · ${esc(b.statusLabel)} · ${esc(b.date)} · ${(b.detailedNotes || []).length} 则笔记</div>
        </div>
      </div>`).join("");
  }).join("") + `</div>`;
}

function render() {
  renderStatus();
  renderSidebar();
  const list = getFiltered();
  const c = $("#content");
  if (list.length === 0) {
    c.innerHTML = `<div class="empty">暂无匹配的读书笔记</div>`;
  } else if (state.view === "grid") {
    c.innerHTML = renderGrid(list);
  } else if (state.view === "list") {
    c.innerHTML = renderList(list);
  } else {
    c.innerHTML = renderTimeline(list);
  }
}

/* ---------- drawer ---------- */
function openDrawer(id) {
  const b = DATA.find((x) => x.id === id);
  if (!b) return;
  const notesHTML = (b.detailedNotes || []).map((n) => noteCardHTML(n, "full")).join("");
  $("#drawer .drawer-inner").innerHTML = `
    <button class="drawer-close" aria-label="关闭">✕</button>
    <div class="drawer-book">
      ${spineHTML(b, "lg")}
      <div class="drawer-book-info">
        <h2>${esc(b.title)}</h2>
        <p class="author">${esc(b.author)}</p>
        <div class="meta-row">
          <span class="status-pill ${b.status}">${esc(b.statusLabel)}</span>
          <span class="stars">${stars(b.rating)}</span>
          <span class="tag">${esc(b.date)}</span>
          ${(b.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </div>
      </div>
    </div>
    ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ''}
    <div class="notes-section-title">读书笔记 · ${(b.detailedNotes || []).length} 则</div>
    <div class="notes-list">${notesHTML || '<p class="notes" style="color:var(--faint)">（这本书还没有详细笔记）</p>'}</div>`;
  $("#overlay").classList.add("show");
  $("#drawer").classList.add("show");
}
function closeDrawer() {
  $("#overlay").classList.remove("show");
  $("#drawer").classList.remove("show");
}

/* 复制一条笔记为纯文本 */
function copyNote(nid, btn) {
  const n = noteRegistry[nid];
  if (!n) return;
  const parts = [];
  if (n.summary) parts.push("【笔记摘要】" + n.summary);
  if (n.excerpt) parts.push("【原文摘录】" + n.excerpt);
  if (n.thinking) parts.push("【我的思考 / 评论】" + n.thinking);
  if (n.critique) parts.push("【观点批判】" + n.critique);
  if (n.tags && n.tags.length) parts.push("【标签】" + n.tags.join("、"));
  const text = parts.join("\n\n");
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "已复制 ✓";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) {}
  document.body.removeChild(ta);
}

/* ---------- events ---------- */
function bindEvents() {
  $("#content").addEventListener("click", (e) => {
    const exp = e.target.closest(".expand-btn");
    if (exp) {
      const card = exp.closest(".card");
      card.classList.toggle("open");
      exp.textContent = card.classList.contains("open") ? "收起" : "展开";
      return;
    }
    const item = e.target.closest("[data-id]");
    if (item) openDrawer(String(item.dataset.id));
  });

  $("#sidebar").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    const type = chip.dataset.filter;
    if (type === "tag") state.tag = chip.dataset.value;
    if (type === "rating") state.minRating = Number(chip.dataset.value);
    if (type === "year") state.year = chip.dataset.value;
    render();
  });

  $("#statusRow").addEventListener("click", (e) => {
    const c = e.target.closest("[data-status]");
    if (!c) return;
    state.status = c.dataset.status;
    render();
  });

  $("#search").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    render();
  });

  $$(".seg button").forEach((btn) => btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    $$(".seg button").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  }));

  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  });

  document.addEventListener("click", (e) => {
    const cb = e.target.closest(".copy-btn");
    if (cb) { e.stopPropagation(); copyNote(cb.dataset.nid, cb); return; }
    if (e.target.id === "overlay") closeDrawer();
    if (e.target.closest(".drawer-close")) closeDrawer();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
}

(async function init() {
  DATA = await loadData();
  bindEvents();
  render();
})();
