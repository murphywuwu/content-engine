function kindName(k) { return t("kind_" + k); }
function profileList() { return GRAPH.profiles || []; }
function activePillars() {
  const by = GRAPH.pillars_by_profile || {};
  if (profileScope && by[profileScope]) return by[profileScope];
  const merged = {};
  Object.values(by).forEach(p => Object.assign(merged, p));
  return Object.keys(merged).length ? merged : (GRAPH.pillars || {});
}
function pillarName(id) {
  const p = activePillars()[id] || (GRAPH.pillars || {})[id];
  if (!p) return id;
  return lang === "zh" ? p.zh : p.en;
}
function formatPillar(cell) {
  if (!cell) return "";
  const ids = [...new Set(String(cell).match(/P\d+/g) || [])];
  if (!ids.length) return cell;
  const sep = lang === "zh" ? "：" : ": ";
  return ids.map(id => `${id}${sep}${pillarName(id)}`).join(" · ");
}
function pillarIds() {
  return Object.keys(activePillars());
}
function nodeProfiles(n) {
  if (!n) return [];
  if (n.kind === "profile") return [n.ident];
  if (n.kind === "account") return n.profile_id ? [n.profile_id] : [];
  if (n.profile) return [n.profile];
  if (n.profiles) {
    return String(n.profiles).split(",").map(s => s.trim()).filter(s => s && s !== "*");
  }
  if (n.kind === "published" && n.run_id) {
    const run = GRAPH.nodes.find(x => x.kind === "run" && x.ident === n.run_id);
    return run && run.profile ? [run.profile] : [];
  }
  if (n.kind === "raw" && n.capture_id) {
    const c = GRAPH.nodes.find(x => x.kind === "capture" && x.ident === n.capture_id);
    return c && c.profile ? [c.profile] : [];
  }
  return [];
}
function inScope(n) {
  if (!profileScope) return true;
  if (n.kind === "profile") return n.ident === profileScope;
  if (n.kind === "account") return n.profile_id === profileScope;
  if (n.lib && n.profiles) {
    const parts = String(n.profiles).split(",").map(s => s.trim());
    if (parts.includes("*") || parts.includes(profileScope)) return true;
    return false;
  }
  const ps = nodeProfiles(n);
  if (!ps.length) return true;
  return ps.includes(profileScope);
}
function scoped(kind) { return GRAPH.nodes.filter(n => n.kind === kind && inScope(n)); }

let byId = {};
let adj = new Map();
function rebuildIndexes() {
  byId = Object.fromEntries((GRAPH.nodes || []).map(n => [n.id, n]));
  adj = new Map();
  for (const e of GRAPH.edges || []) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  }
}
rebuildIndexes();

let view = "overview";
let notesTab = "notes";
let mediaTag = "";
let mediaSubject = "";
let mediaRole = "";
let libKind = "";
let libSubtype = "";
let libStatus = "";
let runShip = "";
let runPlat = "";
let runTopic = "";
let runTab = "calendar";
const _nowInit = new Date();
let calYear = _nowInit.getFullYear();
let calMonth = _nowInit.getMonth();
let calPlatFilter = "";
let calSelectedDate = `${_nowInit.getFullYear()}-${String(_nowInit.getMonth() + 1).padStart(2, '0')}-${String(_nowInit.getDate()).padStart(2, '0')}`;
let heatmapSelectedDate = "";
let heatmapPlatFilter = "";
let pubTopic = "";
let pubPlat = "";
let topicStatus = "";
let topicPillar = "";
let topicSrc = "";
let topicUsage = "unused";
let needStatus = "";
let capIngest = "";
let hitKw = "";
let hitKwQ = "";
let hitSt = "";
let hitSig = "";
let hitsSub = "list"; // list = 命中 · catalog = 关键词
let kwCatalogQ = "";
let kwCatalogTrack = ""; // "" | listen | search | ask

const KW_TRACKS = ["listen", "search", "ask"];
const TOPIC_SOURCES = ["need", "inbox", "user", "product", "recommendation"];
let selected = null;
let wikiGraphMode = "spine";
let wikiSurface = "list";
let baseTab = "assets"; // assets | graph
let brandDirty = false;
let brandDraft = null; // unsaved form values; kept across tab switches
let brandProfileId = "";
let brandFonts = [];
let brandFontsError = "";
let brandFontsTried = false;
let brandFontOffBound = false;
let brandPreviewHtml = "";
let wikiGraphAnim = null;
let wikiGraphTransform = { x: 0, y: 0, k: 1 };
let wikiGraphQuery = "";
let wikiGraphApi = null; // { focusNode, applyQuery } while force graph is mounted
const $list = document.getElementById("list");
const $insp = document.getElementById("insp");
const $q = document.getElementById("q");
const tabs = document.getElementById("tabs");
const $modal = document.getElementById("mdModal");
const $sheet = document.getElementById("mdSheet");
const $mdTitle = document.getElementById("mdTitle");
const $mdSub = document.getElementById("mdSub");
const $mdPath = document.getElementById("mdPath");
const $mdBody = document.getElementById("mdBody");
const $mdRail = document.getElementById("mdRail");
const STAGE_ORDER = ["idea", "brief", "packet", "draft", "editor", "rubric", "pack", "feedback"];
let runModal = null; // { id, stage }
let runInspOpenStage = "";
let mdFetchToken = 0;
document.getElementById("stamp").textContent = GRAPH.generated_at || "";

function graphApiUrl(name) {
  return new URL(name, location.href).toString();
}

async function loadLiveGraph() {
  if (!isHttpServe()) return false;
  const res = await fetch(graphApiUrl("api/graph"), { cache: "no-store" });
  if (!res.ok) throw new Error(`graph ${res.status}`);
  const next = await res.json();
  if (!next || !Array.isArray(next.nodes)) throw new Error("invalid graph");
  GRAPH = next;
  rebuildIndexes();
  document.getElementById("stamp").textContent = GRAPH.generated_at || "";
  return true;
}

function watchVault() {
  if (!isHttpServe() || typeof EventSource === "undefined") return;
  let timer = 0;
  const es = new EventSource(graphApiUrl("api/events"));
  es.onmessage = () => {
    clearTimeout(timer);
    // Debounce bursts of Agent writes into one refetch.
    timer = setTimeout(async () => {
      try {
        await loadLiveGraph();
        applyChrome();
        render();
      } catch (err) {
        console.warn("workbench live reload failed", err);
      }
    }, 250);
  };
  es.onerror = () => {
    // Browser will retry EventSource; no hard fail.
  };
}

function vaultFetchUrl(rel) {
  return "../" + String(rel || "").replace(/^\/+/, "");
}

function isHttpServe() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function refreshServeBanner() {
  const el = document.getElementById("serveBanner");
  if (!isHttpServe()) {
    el.classList.add("on");
    el.innerHTML = `${t("serve_banner")} <code>${esc(t("serve_cmd"))}</code>`;
  } else {
    el.classList.remove("on");
    el.textContent = "";
  }
}

function closeMd() {
  $modal.classList.remove("open");
  document.body.style.overflow = "";
  $sheet.classList.remove("run-mode");
  $mdBody.innerHTML = "";
  $mdRail.innerHTML = "";
  $mdPath.textContent = "";
  $mdSub.textContent = "";
  runModal = null;
  mdFetchToken += 1;
}

async function loadMdIntoBody(rel) {
  const token = ++mdFetchToken;
  $mdPath.textContent = rel || "";
  $mdBody.innerHTML = `<p class="note">${esc(t("md_loading"))}</p>`;
  if (!rel) {
    $mdBody.innerHTML = `<p class="md-err">${esc(t("md_missing"))}</p>`;
    return;
  }
  if (!isHttpServe()) {
    $mdBody.innerHTML = `<p class="md-err">${esc(t("md_need_serve"))}</p><p><code>${esc(t("serve_cmd"))}</code></p>`;
    return;
  }
  try {
    const res = await fetch(vaultFetchUrl(rel));
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    if (token !== mdFetchToken) return;
    $mdBody.innerHTML = renderMarkdown(text);
  } catch {
    if (token !== mdFetchToken) return;
    $mdBody.innerHTML = `<p class="md-err">${esc(t("md_missing"))}</p><p class="note">${esc(rel)}</p>`;
  }
}

function paintRunRail(n, active) {
  const files = n.stage_files || {};
  const steps = STAGE_ORDER.map((k, i) => {
    const p = files[k];
    const cls = ["rail-step", p ? "has" : "miss", k === active ? "on" : ""].filter(Boolean).join(" ");
    const idx = String(i + 1).padStart(2, "0");
    const fileHint = p ? p.split("/").pop() : t("no_stage");
    return `<li><button type="button" class="${cls}" data-stage="${esc(k)}" ${p ? "" : "disabled"}>
      <span class="rail-spine" aria-hidden="true"><span class="dot"></span><span class="wire"></span></span>
      <span class="rail-card">
        <span class="rail-step-title"><span class="idx">${idx}</span>${esc(fileHint)}</span>
      </span>
    </button></li>`;
  }).join("");
  $mdRail.innerHTML = `<div class="rail-lab">${t("stages_h")}</div><ol class="rail-flow">${steps}</ol>`;
  $mdRail.querySelectorAll("button[data-stage]:not([disabled])").forEach(btn => {
    btn.onclick = () => openRun(n, btn.getAttribute("data-stage"));
  });
}

function defaultStage(n) {
  const files = n.stage_files || {};
  return STAGE_ORDER.find(k => files[k]) || STAGE_ORDER[0];
}

function openRun(n, stage) {
  if (!n || n.kind !== "run") return;
  const files = n.stage_files || {};
  const st = stage && files[stage] ? stage : defaultStage(n);
  runModal = { id: n.id, stage: st };
  $sheet.classList.add("run-mode");
  $mdTitle.textContent = n.ident;
  $mdSub.textContent = n.label || "";
  paintRunRail(n, st);
  $modal.classList.add("open");
  document.body.style.overflow = "hidden";
  $mdBody.scrollTop = 0;
  loadMdIntoBody(files[st] || "");
}

async function openMd(rel, title) {
  if (!rel) return;
  runModal = null;
  $sheet.classList.remove("run-mode");
  $mdRail.innerHTML = "";
  $mdTitle.textContent = title || rel.split("/").pop();
  $mdSub.textContent = "";
  $modal.classList.add("open");
  document.body.style.overflow = "hidden";
  $mdBody.scrollTop = 0;
  await loadMdIntoBody(rel);
}

function accountVoicePath(n) {
  const v = String(n.voice || "").trim();
  if (!v || v === "profile") {
    return n.profile_id ? `profiles/${n.profile_id}/voice.md` : "";
  }
  return v;
}

function openAccount(n) {
  if (!n || n.kind !== "account") return;
  runModal = null;
  $sheet.classList.remove("run-mode");
  $mdRail.innerHTML = "";
  $mdTitle.textContent = n.ident;
  $mdSub.textContent = t("kind_account");
  $mdPath.textContent = "";
  const voicePath = accountVoicePath(n);
  const rows = [
    [t("acct_handle"), n.ident],
    [t("kv_profile"), n.profile_id],
    [t("acct_status"), n.status],
    [t("acct_platforms"), n.platforms],
    [t("acct_default_plat"), n.default_platform],
    [t("acct_voice"), voicePath || n.voice || t("none")],
    [t("acct_overrides"), n.overrides || t("none")],
  ].filter(([, v]) => v);
  const voiceFold = voicePath
    ? `<details class="acct-voice" id="acctVoice">
        <summary>${esc(t("acct_voice_md"))}<span class="sp">${esc(voicePath.split("/").pop())}</span></summary>
        <div class="acct-voice-body" id="acctVoiceBody"><p class="note">${esc(t("md_loading"))}</p></div>
      </details>`
    : "";
  $mdBody.innerHTML = `<dl class="acct-kv">${rows.map(([k, v]) =>
    `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`
  ).join("")}</dl>
    <p class="acct-note">${esc(t("acct_note"))}</p>
    ${voiceFold}`;
  $modal.classList.add("open");
  document.body.style.overflow = "hidden";
  $mdBody.scrollTop = 0;
  const fold = $mdBody.querySelector("#acctVoice");
  const body = $mdBody.querySelector("#acctVoiceBody");
  if (fold && body) {
    fold.addEventListener("toggle", async () => {
      if (!fold.open || body.dataset.loaded === "1") return;
      if (!isHttpServe()) {
        body.innerHTML = `<p class="md-err">${esc(t("md_need_serve"))}</p>`;
        return;
      }
      try {
        const res = await fetch(vaultFetchUrl(voicePath));
        if (!res.ok) throw new Error(String(res.status));
        body.innerHTML = renderMarkdown(await res.text());
        body.dataset.loaded = "1";
      } catch {
        body.innerHTML = `<p class="md-err">${esc(t("md_missing"))}</p><p class="note">${esc(voicePath)}</p>`;
      }
    });
  }
}

function inlineMd(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function splitFrontmatter(src) {
  const text = String(src || "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { meta: null, body: text };
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return { meta: null, body: text };
  return {
    meta: parseSimpleYaml(text.slice(4, end)),
    body: text.slice(end + 5).replace(/^\n+/, ""),
  };
}

function parseSimpleYaml(block) {
  const meta = {};
  String(block || "").split("\n").forEach(line => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const m = /^([A-Za-z0-9_/-]+):\s*(.*)$/.exec(line);
    if (!m) return;
    const key = m[1];
    let val = m[2].trim();
    if (!val) {
      meta[key] = "";
      return;
    }
    if (val.startsWith("[") && val.endsWith("]")) {
      meta[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      return;
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  });
  return meta;
}

function fmTone(s) {
  return /^(ready|working|supported|active|trial|hypothesis|unknown|dead|retired|weakened|killed)$/i.test(s)
    ? ` tone-${String(s).toLowerCase()}`
    : "";
}

function fmValueHtml(val) {
  if (val == null || val === "") return `<span class="md-fm-chip">${esc(t("md_empty"))}</span>`;
  if (Array.isArray(val)) {
    if (!val.length) return `<span class="md-fm-chip">${esc(t("md_empty"))}</span>`;
    return val.map(v => `<span class="md-fm-chip">${esc(v)}</span>`).join("");
  }
  const s = String(val);
  const tone = fmTone(s);
  if (tone || (/^[A-Za-z0-9_./:-]+$/.test(s) && s.length < 40)) {
    return `<span class="md-fm-chip${tone}">${esc(s)}</span>`;
  }
  return esc(s);
}

function humanizeKey(k) {
  return String(k || "").replace(/_/g, " ");
}

function fieldValueHtml(raw) {
  const s = String(raw || "").trim();
  if (!s) return `<span class="md-fm-chip">${esc(t("md_empty"))}</span>`;
  if (fmTone(s) || (/^[A-Za-z0-9_./:-]+$/.test(s) && s.length < 40)) {
    return fmValueHtml(s);
  }
  return inlineMd(s);
}

function parseFieldLine(line) {
  const trimmed = String(line || "").trim();
  // Vault convention: **Label:** value (colon inside bold)
  let m = /^\*\*([^*]+?):\*\*\s*(.*)$/.exec(trimmed);
  if (m) return { key: m[1].trim(), val: m[2] };
  // Also accept **Label**: value
  m = /^\*\*([^*]+)\*\*:\s*(.*)$/.exec(trimmed);
  if (m) return { key: m[1].trim(), val: m[2] };
  return null;
}

function renderFrontmatterHtml(meta) {
  if (!meta || !Object.keys(meta).length) return "";
  const priority = [
    "status", "date", "platform", "pillar", "lane", "profile", "account",
    "generation_mode", "source_type", "purpose", "scout_label", "need_ids",
    "product_ids", "recommendation_ids", "capture_id", "scout_note",
  ];
  const skip = new Set(["id"]);
  const keys = [
    ...priority.filter(k => Object.prototype.hasOwnProperty.call(meta, k)),
    ...Object.keys(meta).filter(k => !priority.includes(k) && !skip.has(k)),
  ].filter(k => {
    const v = meta[k];
    if (v == null || v === "") return false;
    if (Array.isArray(v) && !v.length) return false;
    return true;
  });
  if (!keys.length) return "";
  return `<section class="md-fm">
    <div class="md-fm-head"><span>${esc(t("md_meta"))}</span></div>
    <dl class="md-fm-grid">${keys.map(k => `
      <div><dt>${esc(humanizeKey(k))}</dt><dd>${fmValueHtml(meta[k])}</dd></div>
    `).join("")}</dl>
  </section>`;
}

function renderMarkdown(src) {
  const { meta, body } = splitFrontmatter(src);
  const lines = String(body || "").split("\n");
  const out = [];
  let i = 0;
  let para = [];
  let listType = null;
  let fieldBuf = [];
  const flushPara = () => {
    if (!para.length) return;
    out.push("<p>" + inlineMd(para.join(" ")) + "</p>");
    para = [];
  };
  const flushList = () => {
    if (!listType) return;
    out.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  };
  const flushFields = () => {
    if (!fieldBuf.length) return;
    out.push(`<div class="md-field-card">${fieldBuf.join("")}</div>`);
    fieldBuf = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushFields();
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushAll();
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
      i += 1;
      continue;
    }
    if (/^\|.+\|$/.test(line) && i + 1 < lines.length && /^\|[\s:\-|]+\|$/.test(lines[i + 1])) {
      flushAll();
      const rows = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i])) {
        if (!/^\|[\s:\-|]+\|$/.test(lines[i])) rows.push(lines[i]);
        i += 1;
      }
      const cells = (row) => row.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(rows[0] || "");
      const bodyRows = rows.slice(1);
      out.push("<table><thead><tr>" + head.map(c => "<th>" + inlineMd(c) + "</th>").join("") + "</tr></thead>");
      out.push("<tbody>" + bodyRows.map(r => "<tr>" + cells(r).map(c => "<td>" + inlineMd(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>");
      continue;
    }
    if (!line.trim()) {
      flushAll();
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      flushAll();
      out.push("<hr>");
      i += 1;
      continue;
    }
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      flushAll();
      const lvl = hm[1].length;
      out.push(`<h${lvl}>` + inlineMd(hm[2]) + `</h${lvl}>`);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      flushFields();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      out.push("<blockquote><p>" + inlineMd(quote.join(" ")) + "</p></blockquote>");
      continue;
    }
    const field = parseFieldLine(line);
    if (field) {
      flushPara();
      flushList();
      fieldBuf.push(`<div class="md-field"><span class="md-field-k">${esc(field.key)}</span><span class="md-field-v">${fieldValueHtml(field.val)}</span></div>`);
      i += 1;
      continue;
    }
    const ul = /^[-*]\s+(.+)$/.exec(line);
    const ol = /^\d+\.\s+(.+)$/.exec(line);
    if (ul || ol) {
      flushPara();
      flushFields();
      const kind = ul ? "ul" : "ol";
      if (listType !== kind) {
        flushList();
        listType = kind;
        out.push(kind === "ul" ? "<ul>" : "<ol>");
      }
      out.push("<li>" + inlineMd((ul || ol)[1]) + "</li>");
      i += 1;
      continue;
    }
    flushList();
    flushFields();
    para.push(line);
    i += 1;
  }
  flushAll();
  return `${renderFrontmatterHtml(meta)}${out.join("\n")}` || "<p></p>";
}

function mdFileForNode(n) {
  if (!n) return "";
  if (n.kind === "run") return "";
  if (n.open_file) return n.open_file;
  if (n.path && String(n.path).endsWith(".md")) return n.path;
  return "";
}

function runMetaHtml(n) {
  const files = n.stage_files || {};
  const have = STAGE_ORDER.filter(k => files[k]).join(" · ") || t("no_stage");
  const sel = n.selection || {};
  const todayStr = getTodayStr();
  const st = getPostStatusInfo(n, todayStr);
  const chain = n.pack_chain || {};
  const contracts = chain.contracts || [];
  const media = chain.media || [];
  const templates = chain.templates || [];
  const exp = chain.experiment || {};
  const meta = chain.meta || {};

  let schedHtml = "";
  if (st.code === "reviewed") {
    schedHtml = `<p class="note" style="color:#164673; font-weight:600;">🔵 已复盘 (结果: ${esc(n.published_result || "unknown")}) · 发布于 ${esc(n.published_date || n.date)} ${n.published_url ? `· <a href="${esc(n.published_url)}" target="_blank" rel="noreferrer">查看帖子 ↗</a>` : ""}</p>`;
  } else if (st.code === "published") {
    schedHtml = `<p class="note" style="color:#20572b; font-weight:600;">🟢 已发布于 ${esc(n.published_date || n.date)} ${n.published_url ? `· <a href="${esc(n.published_url)}" target="_blank" rel="noreferrer">查看帖子 ↗</a>` : ""}</p>`;
  } else if (st.code === "overdue") {
    schedHtml = `<p class="note" style="color:#9e2319; font-weight:600;">🔴 过期未发 · 原定时间 ${esc(n.scheduled_date || n.date)}（待手动发布）</p>`;
  } else if (st.code === "scheduled") {
    schedHtml = `<p class="note" style="color:#8a4f00; font-weight:600;">🟠 计划发布时间：${esc(n.scheduled_date || n.date)}（待手动发布）</p>`;
  } else {
    schedHtml = `<p class="note">⚪ 当前状态：${esc(n.status)}（尚未设定具体排期）</p>`;
  }

  let chainHtml = "";
  if (contracts.length || templates.length || media.length || chain.arc) {
    const contractLines = contracts.map(c =>
      `P${c.page}: ${esc(c.page_role || "—")} · ${esc(c.density || "")} · ${esc(c.slot_summary || "")}`
    ).join("<br>");
    const mediaLines = media.map(m =>
      `P${esc(m.page)}: ${esc(m.media_id)} (${esc(m.subject || "")}/${esc(m.role || "")})`
    ).join("<br>");
    const tplLines = templates.map(trow =>
      `P${trow.page}: ${esc(trow.layout_family || "—")} / ${esc(trow.template_id || "—")} · ${esc(trow.mode || "")} · ${esc(trow.evidence || "")}`
    ).join("<br>");
    chainHtml = `<div class="note" style="margin-top:10px;line-height:1.45;">
      <strong>选择链</strong>
      ${meta.w_ids ? `<br>W-: ${esc(meta.w_ids)}` : ""}
      ${n.topic_id ? `<br>Topic: ${esc(n.topic_id)}` : ""}
      ${chain.arc ? `<br>Arc: ${esc(chain.arc)}` : ""}
      ${contractLines ? `<br><br>Page Contracts<br>${contractLines}` : ""}
      ${mediaLines ? `<br><br>Media<br>${mediaLines}` : ""}
      ${tplLines ? `<br><br>Layout / Template<br>${tplLines}` : ""}
      ${(n.published_result || n.published_evidence_tier) ? `<br><br>Published · result=${esc(n.published_result || "—")} · evidence=${esc(n.published_evidence_tier || "unknown")}${n.published_layout_family ? ` · family=${esc(n.published_layout_family)}` : ""}` : ""}
      ${exp.comparable ? `<br>Experiment comparable=${esc(exp.comparable)}${exp.variables_changed ? ` · changed=${esc(exp.variables_changed)}` : ""}` : ""}
    </div>`;
  }

  return `${schedHtml}
    <p class="note">${t("stages_h")}：${esc(have)}</p>
    <p class="note">${t("topic_bind", { t: n.topic_id || t("none"), s: sel.swipe, c: sel.claim })}</p>
    ${chainHtml}
    ${n.supersedes ? `<p class="note">${t("supersedes", { id: n.supersedes })}</p>` : ""}
    ${n.superseded_by ? `<p class="note">${t("superseded_by", { id: n.superseded_by })}</p>` : ""}`;
}

function mdActionsHtml(n) {
  const path = mdFileForNode(n);
  const actions = [];
  if (n.kind === "run") {
    actions.push(`<button type="button" class="btn-primary" data-run-open="${esc(n.id)}"><span>⚡</span> <span>${t("open_run")}</span></button>`);
  }
  if (path) {
    actions.push(`<button type="button" data-md="${esc(path)}" data-md-title="${esc(n.ident)}"><span>📄</span> <span>${t("read_md")}</span></button>`);
  }
  actions.push(`<button type="button" class="btn-copy-ident" data-copy-ident="${esc(n.ident || n.id)}"><span>📋</span> <span>${t("copy_ident")}</span></button>`);

  return `
    <div class="insp-actions-bar">
      ${actions.join("")}
    </div>
    ${n.kind === "run" ? `<p class="note" style="margin-top:6px;">${t("stages_hint")}</p>` : ""}
  `;
}

document.addEventListener("click", (e) => {
  const runBtn = e.target.closest("[data-run-open]");
  if (runBtn && !runBtn.closest("#mdModal")) {
    e.preventDefault();
    e.stopPropagation();
    const rid = runBtn.getAttribute("data-run-open");
    const node = findRunNode(rid) || byId[rid];
    const stage = runBtn.getAttribute("data-run-stage") || "";
    if (node && node.kind === "run") openRun(node, stage || undefined);
    else if (rid) select(rid);
    return;
  }
  const acctBtn = e.target.closest("[data-account-open]");
  if (acctBtn && !acctBtn.closest("#mdModal")) {
    e.preventDefault();
    e.stopPropagation();
    const node = byId[acctBtn.getAttribute("data-account-open")];
    if (node) openAccount(node);
    return;
  }
  const el = e.target.closest("[data-md]");
  if (!el || el.closest("#mdModal")) return;
  const rel = el.getAttribute("data-md");
  if (!rel) return;
  e.preventDefault();
  e.stopPropagation();
  openMd(rel, el.getAttribute("data-md-title") || "");
});

document.getElementById("ctxClose").onclick = closeTopicContext;
document.querySelectorAll(".ctx-tab").forEach(btn => {
  btn.onclick = () => setTopicContextTab(btn.getAttribute("data-ctx-tab"));
});
document.getElementById("ctxModal").addEventListener("click", (e) => {
  if (e.target.id === "ctxModal") closeTopicContext();
});
document.getElementById("mdClose").onclick = closeMd;
$modal.addEventListener("click", (e) => { if (e.target === $modal) closeMd(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const ctx = document.getElementById("ctxModal");
  if (ctx && ctx.classList.contains("open")) { closeTopicContext(); return; }
  closeMd();
});

const VIEW_PARENT = {
  overview: "overview",
  select: "select",
  content: "content",
  shipped: "shipped",
  base: "base",
  brand: "brand",
  media: "media",
  // legacy aliases → new parents
  foundation: "select",
  discover: "select",
  // object pages highlight the stage tab they belong to
  needs: "base",
  hits: "base",
  topics: "select",
  runs: "content",
  pub: "shipped",
  wiki: "base",
  notes: "base",
  library: "base",
  products: "base",
  recommendations: "base",
};
// views whose page is a stage/overview shell (search overrides them)
const PRIMARY_VIEWS = ["overview", "select", "content", "shipped", "base", "brand", "media"];
// every object page, in workflow order, for the "全部页面" menu
const MORE_VIEWS = [
  { view: "topics", label: "card_topics_title" },
  { view: "runs", label: "card_runs_title" },
  { view: "pub", label: "card_pub_title" },
  { view: "hits", label: "card_hits_title" },
  { view: "needs", label: "card_needs_title" },
  { view: "wiki", label: "card_wiki_title" },
  { view: "notes", label: "card_notes_title" },
  { view: "library", label: "card_library_title" },
  { view: "products", label: "card_products_title" },
  { view: "recommendations", label: "card_recs_title" },
];
function countForView(v) {
  const map = {
    needs: () => nodesOf("need").length,
    notes: () => nodesOf("capture").length,
    hits: () => nodesOf("hit").length,
    topics: () => nodesOf("topic").length,
    wiki: () => nodesOf("wiki").length,
    products: () => nodesOf("product").length,
    recommendations: () => nodesOf("recommendation").length,
    runs: () => nodesOf("run").length,
    media: () => (GRAPH.media || []).length,
    library: () => GRAPH.nodes.filter(n => n.lib && inScope(n)).length,
    pub: () => nodesOf("published").length,
  };
  return (map[v] || (() => 0))();
}

function jumpToView(targetView, opts = {}) {
  if (!targetView) return;
  // legacy stage ids redirect to the new pipeline tabs
  if (targetView === "foundation" || targetView === "discover") targetView = "select";
  // Context modal is global; leaving a surface must not keep a stale Topic/Run graph open.
  if (targetView !== view) closeTopicContext();
  view = targetView;
  if (opts.runTab && (targetView === "runs" || targetView === "content")) runTab = opts.runTab;
  closeMoreMenu();
  applyChrome();
  render();
}

function isProduceRunsSurface() {
  // Produce tab hosts the Run views; "runs" via 全部页面 is the same surface.
  return view === "content" || view === "runs";
}

function refreshRunSurface() {
  // Re-draw calendar/kanban/heatmap without leaving the current tab.
  if (view === "content") renderContent();
  else renderRuns();
  renderInsp();
}

function buildMoreMenu() {
  const menu = document.getElementById("moreMenu");
  if (!menu) return;
  menu.innerHTML = MORE_VIEWS.map(m =>
    `<button type="button" data-v="${m.view}"><span>${esc(t(m.label))}</span><span class="more-count">${countForView(m.view)}</span></button>`
  ).join("");
  menu.querySelectorAll("button").forEach(btn => {
    btn.classList.toggle("on", btn.getAttribute("data-v") === view);
    btn.onclick = () => jumpToView(btn.getAttribute("data-v"));
  });
}
function closeMoreMenu() {
  const menu = document.getElementById("moreMenu");
  const btn = document.getElementById("moreNavBtn");
  if (menu) menu.classList.remove("open");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function applyChrome() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  $q.placeholder = t("search");
  document.getElementById("langBtn").textContent = lang === "zh" ? "EN" : "中文";
  refreshServeBanner();

  const curTheme = document.documentElement.getAttribute("data-theme") || "light";
  const tBtn = document.getElementById("themeBtn");
  if (tBtn) {
    tBtn.textContent = curTheme === "dark" ? "☀️" : "🌙";
    tBtn.title = t("theme_toggle");
  }
  const iBtn = document.getElementById("inspToggleBtn");
  if (iBtn) iBtn.title = t("insp_toggle");

  const sel = document.getElementById("profileSel");
  const ids = profileList().map(p => p.id);
  if (profileScope && !ids.includes(profileScope)) profileScope = "";
  sel.innerHTML = `<option value="">${t("ip_all")}</option>` +
    ids.map(id => `<option value="${id}" ${id === profileScope ? "selected" : ""}>${id}</option>`).join("");

  const NAV_LABELS = {
    overview: "overview",
    select: "hub_select_title",
    content: "hub_produce_title",
    shipped: "hub_learn_title",
    base: "hub_base_title",
    brand: "brand_title",
    media: "media_nav",
    find: "find",
    more: "nav_more",
  };
  Object.entries(NAV_LABELS).forEach(([k, key]) => {
    const el = document.getElementById(`lbl-${k}`);
    if (el) el.textContent = t(key);
  });
  buildMoreMenu();
  const badge = document.getElementById("brandBadge");
  if (badge) badge.textContent = t("brand_badge");

  const parent = VIEW_PARENT[view] || view;
  document.querySelectorAll(".nav-primary .nav-tab").forEach(tab => {
    tab.classList.toggle("on", tab.getAttribute("data-v") === parent);
  });

  const updateBadge = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(count);
  };
  const triageN = nodesOf("hit").filter(h => h.status === "triage").length;
  const ideasN = nodesOf("topic").filter(tp => !tp.usage || tp.usage === "unused").length;
  const activeN = unshippedRuns().length;
  const pubN = nodesOf("published").length;
  const baseN = nodesOf("wiki").length
    + nodesOf("need").length
    + nodesOf("hit").length
    + GRAPH.nodes.filter(n => n.lib && inScope(n)).length;
  const mediaN = (GRAPH.media || []).length;
  updateBadge("badge-select", ideasN);
  updateBadge("badge-content", activeN);
  updateBadge("badge-shipped", pubN);
  updateBadge("badge-base", baseN + triageN);
  updateBadge("badge-media", mediaN);
}
document.getElementById("langBtn").onclick = () => {
  lang = lang === "zh" ? "en" : "zh";
  localStorage.setItem("wb-lang", lang);
  applyChrome();
  render();
};

document.querySelectorAll(".nav-primary .nav-tab").forEach(btn => {
  btn.onclick = () => jumpToView(btn.getAttribute("data-v"));
});
const searchFocusBtn = document.getElementById("searchFocusBtn");
if (searchFocusBtn) {
  searchFocusBtn.onclick = () => {
    $q.focus();
    $q.select();
  };
}
const moreNavBtn = document.getElementById("moreNavBtn");
if (moreNavBtn) {
  moreNavBtn.onclick = (e) => {
    e.stopPropagation();
    const menu = document.getElementById("moreMenu");
    const open = menu.classList.toggle("open");
    moreNavBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-more-wrap")) closeMoreMenu();
  });
}

const inspToggleBtn = document.getElementById("inspToggleBtn");
const shellEl = document.getElementById("shell");
function setInspectorCollapsed(collapsed) {
  if (!shellEl) return;
  shellEl.classList.toggle("inspector-collapsed", collapsed);
  localStorage.setItem("wb-insp-collapsed", collapsed ? "1" : "0");
  if (inspToggleBtn) inspToggleBtn.classList.toggle("on", !collapsed);
}
if (inspToggleBtn) {
  inspToggleBtn.onclick = () => {
    setInspectorCollapsed(!shellEl.classList.contains("inspector-collapsed"));
  };
}
if (localStorage.getItem("wb-insp-collapsed") !== "0") {
  setInspectorCollapsed(true);
}

const themeBtn = document.getElementById("themeBtn");
if (themeBtn) {
  themeBtn.onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("wb-theme", next);
    themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
  };
}
const savedTheme = localStorage.getItem("wb-theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
  if (themeBtn) themeBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
}

const qClear = document.getElementById("qClear");
const searchKbd = document.getElementById("searchKbd");
if ($q && qClear) {
  $q.addEventListener("input", () => {
    qClear.style.display = $q.value ? "flex" : "none";
    if (searchKbd) searchKbd.style.display = $q.value ? "none" : "";
  });
  qClear.onclick = () => {
    $q.value = "";
    qClear.style.display = "none";
    if (searchKbd) searchKbd.style.display = "";
    $q.focus();
    render();
  };
}

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    $q.focus();
    $q.select();
  } else if (e.key === "/" && document.activeElement !== $q && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    $q.focus();
    $q.select();
  } else if (e.key === "\\" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    if (inspToggleBtn) inspToggleBtn.click();
  }
});

document.getElementById("profileSel").onchange = (e) => {
  profileScope = e.target.value;
  localStorage.setItem("wb-profile", profileScope);
  if (profileScope) selected = `profile:${profileScope}`;
  else if (selected && byId[selected]?.kind === "profile") selected = null;
  applyChrome();
  render();
};

$q.addEventListener("input", () => render());

function nodesOf(kind) { return GRAPH.nodes.filter(n => n.kind === kind && inScope(n)); }
function nodesOfAll(kind) { return GRAPH.nodes.filter(n => n.kind === kind); }
function runIsShipped(r) {
  if ((r.ship_urls || []).length) return true;
  return nodesOf("published").some(p =>
    (p.run_id && p.run_id === r.ident) ||
    (r.folder && p.run_folder && p.run_folder === r.folder)
  );
}
function runClosedWithoutShip(r) {
  return r.status === "superseded" || r.status === "killed";
}
function unshippedRuns() {
  return nodesOf("run").filter(r => !runIsShipped(r) && !runClosedWithoutShip(r));
}
function citesPart(p, n) {
  const id = n.ident;
  const cell = n.kind === "swipe" ? p.swipe : n.kind === "atom" ? p.atoms : n.kind === "claim" ? p.claim : "";
  const v = String(cell || "").trim();
  if (!v || v.toLowerCase() === "none") return false;
  return v.split(/[,;]/).some(tok => (tok.split(":").pop() || "").trim() === id);
}
function publishedFor(n, ctx) {
  if (n.kind === "published") return [n];
  if (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") {
    return nodesOf("published").filter(p => citesPart(p, n));
  }
  const runs = n.kind === "run" ? [n] : ctx.filter(x => x.kind === "run");
  return nodesOf("published").filter(p => runs.some(r =>
    (p.run_id && p.run_id === r.ident) || (r.folder && p.run_folder === r.folder)
  ));
}
function qmatch(n) {
  const q = $q.value.trim().toLowerCase();
  if (!q) return true;
  const blob = [n.ident, n.label, n.kind, n.status, n.pillar, n.lane, n.generation_mode, n.profile, n.profiles, n.src_handle, n.url, n.notes, n.type, n.atom_type, n.topic_id, n.audience, n.need_ids, n.product_ids, n.product_fit, n.recommendation_ids, n.source_type, n.capture_id, n.source, n.keyword_id, n.hit_kind, n.signal, n.excerpt].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(q);
}
function connected(id) {
  const seen = new Set([id]);
  const q = [id];
  while (q.length) {
    const cur = q.shift();
    for (const n of adj.get(cur) || []) {
      if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return [...seen].map(i => byId[i]).filter(Boolean);
}

function select(id) {
  if (byId[id] && byId[id].kind === "run" && id !== selected) runInspOpenStage = "";
  const n = byId[id];
  // If the context modal is open, remount it for the new hub (Topic→Run etc.)
  // instead of leaving the previous graph on screen.
  if (id !== selected) syncContextModalToNode(n);
  if (view === "overview" && n && n.kind === "account") {
    openAccount(n);
    return;
  }
  selected = id;
  const graphLive = $list.querySelector(".wiki-graph-svg");
  if (graphLive && (view === "wiki" || (view === "base" && baseTab === "graph"))) {
    graphLive.querySelectorAll(".node").forEach(g => {
      g.classList.toggle("sel", g.dataset.id === id);
    });
    renderInsp();
    return;
  }
  if (view === "media" && $list.querySelector(".mediagrid")) {
    $list.querySelectorAll(".mediacard").forEach(card => {
      const hid = card.querySelector(".hid");
      const mid = hid ? `media:${hid.textContent}` : "";
      card.classList.toggle("sel", mid === id);
    });
    renderInsp();
    return;
  }
  render();
}

function rowEl(n, extra) {
  const d = document.createElement("div");
  d.className = "row" + (selected === n.id ? " sel" : "");
  d.dataset.kind = n.kind;
  d.onclick = () => select(n.id);
  const score = n.kind === "topic" && (n.craft || n.total)
    ? `<div class="score">${esc(n.fit ? `${n.craft}/${n.fit}` : n.total)}</div>`
    : "";
  const clean = n.kind === "run" || n.kind === "published";
  const meta = clean ? "" : (extra || metaLine(n));
  d.innerHTML = `<div class="stripe"></div>
    <div>
      <div class="id">${esc(n.ident)}</div>
      <div class="label">${esc(n.label)}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
    </div>
    <div class="side">
      <div class="pills">${score}${pills(n)}</div>
      ${clean ? platMarkHtml(n) : ""}
    </div>`;
  return d;
}

function runPlatform(n) {
  return String(n.primary_platform || n.platform || n.platforms || "").split(",")[0].trim().toLowerCase();
}

function getPlatformSvg(p, size = 16, color = "currentColor") {
  const plat = String(p || "").toLowerCase();
  const brandColors = {
    x: "#171411",
    twitter: "#171411",
    linkedin: "#0a66c2",
    xiaohongshu: "#ff2442",
    red: "#ff2442",
    instagram: "#c13584",
    ig: "#c13584",
    threads: "#171411",
    tiktok: "#000000",
    wechat: "#07c160",
    weixin: "#07c160"
  };
  const fill = (color === "brand" ? (brandColors[plat] || "currentColor") : color);

  if (plat === "x" || plat === "twitter") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`;
  }
  if (plat === "xiaohongshu" || plat === "red") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z"/></svg>`;
  }
  if (plat === "linkedin") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
  }
  if (plat === "instagram" || plat === "ig") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>`;
  }
  if (plat === "threads") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/></svg>`;
  }
  if (plat === "tiktok") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`;
  }
  if (plat === "wechat" || plat === "weixin") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="vertical-align:middle; flex-shrink:0;"><path d="M8.691 2.188C3.891 2.188 0 5.478 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .161.13.29.29.29.08 0 .15-.029.21-.07l1.909-1.11c.17-.1.37-.13.56-.08.93.26 1.92.4 2.945.4.15 0 .3-.01.45-.02-.6-.97-.94-2.11-.94-3.328 0-3.69 3.5-6.68 7.82-6.68.39 0 .77.03 1.14.07-.97-2.73-4.44-4.732-8.489-4.732zm-2.07 4.28c.63 0 1.14.51 1.14 1.14s-.51 1.14-1.14 1.14-1.14-.51-1.14-1.14.51-1.14 1.14-1.14zm5.18 0c.63 0 1.14.51 1.14 1.14s-.51 1.14-1.14 1.14-1.14-.51-1.14-1.14.51-1.14 1.14-1.14zm4.079 4.212c-4.04 0-7.31 2.78-7.31 6.21 0 1.86.97 3.54 2.5 4.67.14.1.22.27.18.45l-.32 1.25c-.02.06-.04.12-.04.18 0 .14.11.24.25.24.07 0 .13-.02.18-.06l1.61-.94c.14-.08.31-.11.47-.07.78.22 1.62.34 2.48.34 4.04 0 7.31-2.78 7.31-6.21s-3.27-6.21-7.31-6.21zm-2.2 3.57c.52 0 .95.42.95.95s-.43.95-.95.95c-.53 0-.95-.42-.95-.95s.42-.95.95-.95zm4.4 0c.53 0 .95.42.95.95s-.42.95-.95.95c-.52 0-.95-.42-.95-.95s.43-.95.95-.95z"/></svg>`;
  }
  return `<span style="font-size:${size}px; line-height:1; vertical-align:middle;">🌐</span>`;
}

function platMarkHtml(n, size = 14) {
  const id = runPlatform(n);
  return `<span class="plat-mark-svg" title="${esc(id || "")}">${getPlatformSvg(id, size, "brand")}</span>`;
}
function metaLine(n) {
  return [n.date, n.profile, n.status, formatPillar(n.pillar), n.platform || n.platforms, n.type || n.atom_type || n.form].filter(Boolean).join(" · ");
}
function numCompact(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n >= 10000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  return String(Math.round(n));
}
function heatMetric(n, key) {
  return numCompact(n[`src_${key}`]);
}
function hasHeat(n) {
  return ["likes", "replies", "bookmarks", "views"].some(k => heatMetric(n, k) !== null);
}
function heatStripHtml(n, opts = {}) {
  // No strip when every metric is missing — empty "—" chips inflate row height.
  if (!hasHeat(n)) return "";
  const hint = opts.hint ? `<span class="heat-note">${esc(t("heat_hint"))}</span>` : "";
  const items = [
    { key: "views", sym: "👁", title: "views" },
    { key: "likes", sym: "♥", title: "likes" },
    { key: "replies", sym: "💬", title: "replies" },
    { key: "bookmarks", sym: "🔖", title: "bookmarks" },
  ];
  const chips = items.map(({ key, sym, title }) => {
    const val = heatMetric(n, key);
    if (val === null && opts.skipEmpty) return "";
    const shown = val === null ? "—" : val;
    const empty = val === null ? " empty" : "";
    return `<span class="heat-chip ${key}${empty}" title="${esc(title)}"><span class="sym">${sym}</span><span class="val">${esc(shown)}</span></span>`;
  }).join("");
  return `<div class="heat" title="${esc(t("heat_hint"))}">${chips}</div>${hint}`;
}

function heatChipsFromText(blob) {
  const raw = String(blob || "").trim();
  if (!raw) return "";
  const specs = [
    { key: "views", sym: "👁", re: /([\d.,]+\s*[kKmMbB]?)\s*views?\b/i },
    { key: "likes", sym: "♥", re: /([\d.,]+\s*[kKmMbB]?)\s*likes?\b/i },
    { key: "replies", sym: "💬", re: /([\d.,]+\s*[kKmMbB]?)\s*replies?\b/i },
    { key: "bookmarks", sym: "🔖", re: /([\d.,]+\s*[kKmMbB]?)\s*bookmarks?\b/i },
  ];
  const chips = specs.map(({ key, sym, re }) => {
    const m = raw.match(re);
    if (!m) return "";
    return `<span class="heat-chip ${key}" title="${esc(key)}"><span class="sym">${sym}</span><span class="val">${esc(m[1].replace(/\s+/g, ""))}</span></span>`;
  }).filter(Boolean).join("");
  return chips ? `<div class="heat">${chips}</div>` : "";
}

function heatFieldHtml(node, heatText) {
  if (node && hasHeat(node)) return heatStripHtml(node, { skipEmpty: true });
  return heatChipsFromText(heatText);
}
function listRowEl(n, extra) {
  const d = document.createElement("div");
  d.className = "row" + (selected === n.id ? " sel" : "");
  d.dataset.kind = n.kind;
  d.onclick = () => select(n.id);
  const meta = extra || metaLine(n);
  d.innerHTML = `<div class="stripe"></div>
    <div>
      <div class="id">${esc(n.ident)}</div>
      <div class="label">${esc(n.label)}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
      ${heatStripHtml(n)}
    </div>
    <div class="side">
      <div class="pills">${pills(n)}</div>
      ${platMarkHtml(n)}
    </div>`;
  return d;
}
function pills(n) {
  const bits = [];
  if (n.kind === "need") {
    const st = n.status || "";
    const cls = st === "promoted" ? "ok" : (st === "captured" ? "gap" : "");
    if (st) bits.push(`<span class="pill ${cls}">${esc(st)}</span>`);
    if (n.source_type) bits.push(`<span class="pill">${esc(n.source_type)}</span>`);
    if (n.frequency) bits.push(`<span class="pill">×${esc(n.frequency)}</span>`);
  }
  if (n.kind === "hit") {
    const st = n.status || "";
    const cls = st === "triage" ? "gap" : (st === "discarded" ? "" : "ok");
    if (st) bits.push(`<span class="pill ${cls}">${esc(st)}</span>`);
    if (n.keyword_id) bits.push(`<button type="button" class="kw-chip" data-kw-filter="${esc(n.keyword_id)}">${esc(n.keyword_id)}</button>`);
    if (n.signal) bits.push(`<span class="pill">${esc(n.signal)}</span>`);
    if (n.hit_kind) bits.push(`<span class="pill">${esc(n.hit_kind)}</span>`);
  }
  if (n.kind === "topic") {
    bits.push(`<span class="pill">${esc(n.status)}</span>`);
    if (n.source_type) bits.push(`<span class="pill">${esc(n.source_type)}</span>`);
    if (n.generation_mode) bits.push(`<span class="pill">${esc(n.generation_mode)}</span>`);
    bits.push(n.usage === "unused" ? `<span class="pill gap">${t("unused")}</span>` : `<span class="pill ok">${esc(n.usage)}</span>`);
  }
  if (n.kind === "run") {
    const cls = n.status === "published" ? "ok" : n.status === "superseded" || n.status === "killed" ? "gap" : "";
    bits.push(`<span class="pill ${cls}">${esc(n.status)}</span>`);
    if (!runIsShipped(n)) {
      if (n.status === "superseded") bits.push(`<span class="pill">${t("gap_superseded")}</span>`);
      else if (n.status === "killed") bits.push(`<span class="pill">${t("gap_killed")}</span>`);
      else bits.push(`<span class="pill gap">${t("gap_unshipped")}</span>`);
    }
  }
  if (n.kind === "capture" && n.library_cell === "none") bits.push(`<span class="pill gap">${t("no_lib")}</span>`);
  if (n.kind === "published") {
    if (n.result) bits.push(`<span class="pill">${esc(n.result)}</span>`);
    if (!n.reviewable) bits.push(`<span class="pill gap">${t("thin")}</span>`);
  }
  if (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") {
    const st = n.status || "";
    const cls = n.kind === "claim"
      ? (st === "supported" ? "ok" : (st === "weakened" || st === "retired" ? "gap" : ""))
      : (st === "working" ? "ok" : (st === "dead" ? "gap" : ""));
    const row1 = [];
    if (st) row1.push(`<span class="pill ${cls}">${esc(st)}</span>`);
    row1.push(`<span class="pill hit-win">${esc(t("lib_win", { v: n.win ?? 0 }))}</span>`);
    row1.push(`<span class="pill hit-loss">${esc(t("lib_loss", { v: n.loss ?? 0 }))}</span>`);
    row1.push(`<span class="pill hit-n">${esc(t("lib_n", { v: n.n ?? 0 }))}</span>`);
    const row2 = [`<span class="pill">${esc(t("lib_refs", { n: n.refs ?? 0 }))}</span>`];
    if (n.kind === "claim" && !n.has_evidence) row2.push(`<span class="pill gap">${t("no_ev")}</span>`);
    bits.push(`<span class="pill-stack"><span class="pill-row">${row1.join("")}</span><span class="pill-row">${row2.join("")}</span></span>`);
  }
  return bits.join("");
}
function brandRows() { return GRAPH.brands || []; }
function logoMedia() {
  return (GRAPH.media || []).filter(m => m.role === "logo" || (m.tags || []).includes("logo"));
}
function defaultBrandProfile() {
  if (brandProfileId && profileList().some(p => p.id === brandProfileId)) return brandProfileId;
  if (profileScope && profileList().some(p => p.id === profileScope)) return profileScope;
  const active = (GRAPH.accounts || []).find(a => a.status === "active" && a.profile_id);
  if (active && profileList().some(p => p.id === active.profile_id)) return active.profile_id;
  return (profileList()[0] || {}).id || "";
}
function brandFor(id) {
  return brandRows().find(b => b.profile_id === id) || {
    profile_id: id, display_name: "", handle: "", logo: "",
    primary: "", accent: "", background: "", text: "", heading_font: "", body_font: "",
  };
}
function brandHex(id) {
  const el = document.getElementById(id);
  const v = (el && el.value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : "";
}
function syncBrandPicker(textId) {
  const hex = brandHex(textId);
  const pick = document.getElementById(textId + "Pick");
  if (pick && hex) pick.value = hex;
}
function fontFormat(url) {
  const ext = String(url || "").split(".").pop().toLowerCase().split("?")[0];
  return { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[ext] || "woff2";
}
function cssFontFamily(name) {
  const family = String(name || "").replace(/['\\]/g, "");
  return family ? `'${family}', sans-serif` : "Inter, sans-serif";
}
function applyBrandFontFaces() {
  let style = document.getElementById("brandFontFaces");
  if (!style) {
    style = document.createElement("style");
    style.id = "brandFontFaces";
    document.head.appendChild(style);
  }
  if (style.dataset.n === String(brandFonts.length) && style.textContent) return;
  style.dataset.n = String(brandFonts.length);
  style.textContent = brandFonts.map(f => {
    const src = graphApiUrl("api/font-file?url=" + encodeURIComponent(f.url));
    const family = String(f.name).replace(/['\\]/g, "");
    return `@font-face{font-family:'${family}';src:url('${src}') format('${fontFormat(f.url)}');font-display:swap;}`;
  }).join("\n");
}
function ensureBrandGoogleFonts() {
  if (document.getElementById("brandGoogleFonts")) return;
  const link = document.createElement("link");
  link.id = "brandGoogleFonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@500;700&family=Libre+Baskerville:wght@700&display=swap";
  document.head.appendChild(link);
}
function scaleBrandPage() {
  const frame = document.getElementById("brandFrame");
  const page = document.getElementById("brandPage");
  if (!frame || !page) return;
  const scale = frame.clientWidth / 1080;
  page.style.transform = `scale(${scale})`;
  frame.style.height = `${Math.round(1440 * scale)}px`;
}
async function ensureBrandPreviewHtml() {
  // Bust cache when the static preview assets change (query is ignored by file server).
  const res = await fetch(new URL("brand-preview-page.html?v=easysociable-2", location.href), { cache: "no-store" });
  if (!res.ok) throw new Error(`preview page ${res.status}`);
  brandPreviewHtml = await res.text();
  return brandPreviewHtml;
}
async function mountBrandPreview() {
  const frame = document.getElementById("brandFrame");
  if (!frame) return;
  try {
    const html = await ensureBrandPreviewHtml();
    if (view !== "brand" || !document.getElementById("brandFrame")) return;
    frame.innerHTML = html;
    paintBrandPreview();
  } catch (err) {
    frame.innerHTML = `<div class="empty"><strong>Preview</strong>${esc(String(err.message || err))}</div>`;
  }
}
function paintBrandPreview() {
  const page = document.getElementById("brandPage");
  if (!page) return;
  const form = document.getElementById("brandForm");
  const fallback = brandFormValues(defaultBrandProfile());
  const validHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(String(v || "").trim()) ? String(v).trim() : "";
  const bg = (form && brandHex("brandBg")) || validHex(fallback.background) || "#000000";
  const fg = (form && brandHex("brandFg")) || validHex(fallback.text) || "#1678DA";
  const accent = (form && brandHex("brandAccent")) || validHex(fallback.accent) || "#FFFFFF";
  const headFont = (form && document.getElementById("brandHeadFont")?.value.trim()) || fallback.heading_font || "Libre Baskerville";
  const bodyFont = (form && document.getElementById("brandBodyFont")?.value.trim()) || fallback.body_font || "Inter";
  ensureBrandGoogleFonts();
  applyBrandFontFaces();
  page.style.setProperty("--es-color-canvas", bg);
  page.style.setProperty("--es-color-text", fg);
  page.style.setProperty("--es-color-accent", accent);
  page.style.setProperty("--es-color-muted", "#8B8680");
  page.style.setProperty("--es-font-heading", cssFontFamily(headFont));
  page.style.setProperty("--es-font-body", cssFontFamily(bodyFont));
  // Paint canvas on page, background layer, and outer frame so init never flashes cream letterboxing.
  page.style.backgroundColor = bg;
  const bgLayer = page.querySelector('[data-type="background"]');
  if (bgLayer) bgLayer.style.backgroundColor = bg;
  const frame = document.getElementById("brandFrame");
  if (frame) frame.style.setProperty("--brand-frame-canvas", bg);
  // Display name only drives the bottom signature line — keep the product title fixed.
  const displayName = (form && document.getElementById("brandName")?.value.trim()) || fallback.display_name || "EasySociable";
  const handleRaw = (form && document.getElementById("brandHandle")?.value.trim()) || fallback.handle || "";
  const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`) : "";
  const nameLine = page.querySelector('[data-variable="text_4"]');
  if (nameLine) {
    const strong = nameLine.querySelector("strong");
    if (strong) strong.textContent = displayName;
    else nameLine.textContent = displayName;
  }
  const handleLine = page.querySelector('[data-variable="text_5"]');
  if (handleLine) {
    const strong = handleLine.querySelector("strong");
    const line = handle || t("brand_preview_tagline");
    if (strong) strong.textContent = line;
    else handleLine.textContent = line;
  }
  const logoImg = page.querySelector('[data-variable="image_1"]');
  const logoId = (form && document.getElementById("brandLogo")?.value) || fallback.logo || "";
  const media = logoMedia().find(m => m.id === logoId);
  if (logoImg) {
    if (media && media.src) logoImg.src = vaultFetchUrl(media.src);
    else logoImg.src = new URL("brand-preview-logo.png", location.href).href;
    logoImg.alt = displayName + " logo";
  }
  document.querySelectorAll(".font-pick").forEach(pick => {
    const hidden = pick.querySelector("input[type=hidden]");
    const sample = pick.querySelector(".font-pick-btn .font-sample");
    if (hidden && sample) sample.style.fontFamily = cssFontFamily(hidden.value || "Inter");
  });
  if (form) ["brandPrimary", "brandAccent", "brandBg", "brandFg"].forEach(syncBrandPicker);
  scaleBrandPage();
}
const FONT_SAMPLE = "Ag Aa";
function fontChoices(current) {
  const names = brandFonts.map(f => f.name);
  if (current && !names.includes(current)) names.unshift(current);
  return names;
}
function fontControl(id, current) {
  if (!brandFonts.length) {
    return `<input id="${id}" value="${esc(current)}" maxlength="80">`;
  }
  const chosen = current || "";
  const items = fontChoices(chosen).map(name => `
    <button type="button" class="font-pick-item ${name === chosen ? "on" : ""}" data-font="${esc(name)}">
      <span class="font-sample" style="font-family:${cssFontFamily(name)}">${FONT_SAMPLE}</span>
    </button>`).join("");
  return `
    <div class="font-pick">
      <input type="hidden" id="${id}" value="${esc(chosen)}">
      <button type="button" class="font-pick-btn" aria-haspopup="listbox">
        <span class="font-sample" style="font-family:${cssFontFamily(chosen || "Inter")}">${FONT_SAMPLE}</span>
      </button>
      <div class="font-pick-menu" hidden>${items}</div>
    </div>`;
}
function bindFontPicks(root) {
  root.querySelectorAll(".font-pick").forEach(pick => {
    const btn = pick.querySelector(".font-pick-btn");
    const menu = pick.querySelector(".font-pick-menu");
    const hidden = pick.querySelector("input[type=hidden]");
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll(".font-pick-menu").forEach(m => { m.hidden = true; });
      if (!open) return;
      const r = btn.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.left = `${r.left}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.width = `${r.width}px`;
      menu.hidden = false;
    };
    menu.querySelectorAll(".font-pick-item").forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hidden.value = item.getAttribute("data-font") || "";
        menu.querySelectorAll(".font-pick-item").forEach(n => n.classList.toggle("on", n === item));
        menu.hidden = true;
        brandDirty = true;
        captureBrandDraft();
        paintBrandPreview();
      };
    });
  });
}
async function ensureBrandFonts() {
  if (brandFonts.length || brandFontsTried) return;
  brandFontsTried = true;
  try {
    const res = await fetch(graphApiUrl("api/fonts"), { cache: "no-store" });
    const data = await res.json();
    brandFonts = Array.isArray(data.fonts) ? data.fonts : [];
    brandFontsError = brandFonts.length ? "" : (data.error || t("brand_font_error"));
  } catch (err) {
    brandFontsError = String(err.message || err);
  }
}
function brandColorField(id, key, val) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(val || "") ? val : "#112233";
  return `<label>${esc(t(key))}<span class="brand-color"><input type="color" id="${id}Pick" value="${esc(hex)}" aria-label="${esc(t(key))}"><input type="text" id="${id}" value="${esc(val)}" placeholder="#112233" maxlength="7" spellcheck="false"></span></label>`;
}
function readBrandFormValues() {
  const form = document.getElementById("brandForm");
  if (!form) return null;
  return {
    profile_id: document.getElementById("brandProfile")?.value || brandProfileId,
    display_name: document.getElementById("brandName")?.value || "",
    handle: document.getElementById("brandHandle")?.value || "",
    logo: document.getElementById("brandLogo")?.value || "",
    primary: document.getElementById("brandPrimary")?.value || "",
    accent: document.getElementById("brandAccent")?.value || "",
    background: document.getElementById("brandBg")?.value || "",
    text: document.getElementById("brandFg")?.value || "",
    heading_font: document.getElementById("brandHeadFont")?.value || "",
    body_font: document.getElementById("brandBodyFont")?.value || "",
  };
}
function captureBrandDraft() {
  const vals = readBrandFormValues();
  if (!vals) return;
  brandDraft = vals;
  brandProfileId = vals.profile_id || brandProfileId;
}
function brandFormValues(pid) {
  const file = brandFor(pid);
  if (brandDirty && brandDraft && brandDraft.profile_id === pid) {
    return { ...file, ...brandDraft, profile_id: pid };
  }
  return file;
}
async function renderBrand() {
  await ensureBrandFonts();
  if (view !== "brand") return;
  const pid = defaultBrandProfile();
  brandProfileId = pid;
  const b = brandFormValues(pid);
  const logos = logoMedia();
  const logoOpts = [`<option value="">${esc(t("brand_logo_none"))}</option>`]
    .concat(logos.map(m => `<option value="${esc(m.id)}" ${m.id === b.logo ? "selected" : ""}>${esc(m.id)} · ${esc(m.caption || m.file || "")}</option>`))
    .join("");
  const profiles = profileList().map(p =>
    `<option value="${esc(p.id)}" ${p.id === pid ? "selected" : ""}>${esc(p.id)}</option>`
  ).join("");
  setInspectorCollapsed(false);
  $list.innerHTML = `
    <div class="brand-wrap">
      <p class="hub-kicker">${esc(t("brand_title"))}</p>
      <h1 class="hub-title">${esc(t("brand_title"))}</h1>
      <p class="brand-note">${esc(t("brand_desc"))}</p>
      <form class="brand-form" id="brandForm">
        <div class="brand-group">
          <h2>${esc(t("brand_group_who"))}</h2>
          <label>${esc(t("brand_profile"))}<select id="brandProfile">${profiles}</select></label>
          <label>${esc(t("brand_display"))}<input id="brandName" value="${esc(b.display_name)}" maxlength="80"></label>
          <label>${esc(t("brand_handle"))}<input id="brandHandle" value="${esc(b.handle)}" maxlength="80" placeholder="@murphywuwu"></label>
          <p class="brand-help">${esc(t("brand_handle_help"))}</p>
          <label>${esc(t("brand_logo"))}
            <span class="brand-logo-row">
              <select id="brandLogo">${logoOpts}</select>
              <button type="button" id="brandLogoUpload">${esc(t("brand_logo_upload"))}</button>
              <input type="file" id="brandLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
            </span>
          </label>
          ${logos.length ? "" : `<p class="brand-note">${esc(t("brand_logo_empty"))}</p>`}
          <p class="brand-help" id="brandLogoStatus"></p>
        </div>
        <div class="brand-group">
          <h2>${esc(t("brand_group_colors"))}</h2>
          ${brandColorField("brandPrimary", "brand_primary", b.primary)}
          ${brandColorField("brandAccent", "brand_accent", b.accent)}
          ${brandColorField("brandBg", "brand_background", b.background)}
          ${brandColorField("brandFg", "brand_text", b.text)}
        </div>
        <div class="brand-group">
          <h2>${esc(t("brand_group_type"))}</h2>
          <label>${esc(t("brand_heading"))}${fontControl("brandHeadFont", b.heading_font)}</label>
          <label>${esc(t("brand_body"))}${fontControl("brandBodyFont", b.body_font)}</label>
          ${brandFontsError ? `<p class="brand-note">${esc(brandFontsError)}</p>` : ""}
        </div>
      </form>
      <div class="brand-actions">
        <button type="button" id="brandSave">${esc(t("brand_save"))}</button>
        <span class="brand-status" id="brandStatus"></span>
      </div>
    </div>`;
  const form = document.getElementById("brandForm");
  const onBrandEdit = (e) => {
    brandDirty = true;
    const pick = e.target;
    if (pick && pick.type === "color" && pick.id.endsWith("Pick")) {
      const text = document.getElementById(pick.id.slice(0, -4));
      if (text) text.value = pick.value.toUpperCase();
    }
    captureBrandDraft();
    paintBrandPreview();
  };
  form.addEventListener("input", onBrandEdit);
  form.addEventListener("change", onBrandEdit);
  document.getElementById("brandProfile").onchange = () => {
    brandDirty = false;
    brandDraft = null;
    brandProfileId = document.getElementById("brandProfile").value;
    renderBrand();
  };
  document.getElementById("brandLogo").value = b.logo || "";
  bindFontPicks(form);
  bindBrandLogoUpload();
  if (!brandFontOffBound) {
    brandFontOffBound = true;
    document.addEventListener("click", () => {
      document.querySelectorAll(".font-pick-menu").forEach(m => { m.hidden = true; });
    });
  }
  document.getElementById("brandSave").onclick = saveBrand;
  paintBrandPreview();
}
function bindBrandLogoUpload() {
  const btn = document.getElementById("brandLogoUpload");
  const fileInput = document.getElementById("brandLogoFile");
  const status = document.getElementById("brandLogoStatus");
  if (!btn || !fileInput) return;
  btn.onclick = () => {
    if (!isHttpServe()) {
      if (status) status.textContent = t("brand_need_serve");
      return;
    }
    fileInput.click();
  };
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    btn.disabled = true;
    if (status) status.textContent = t("brand_logo_uploading");
    try {
      const body = new FormData();
      body.append("file", file, file.name);
      body.append("role", "logo");
      body.append("tags", "logo");
      body.append("links", "brand");
      body.append("rights", "own-upload");
      body.append("caption", file.name.replace(/\.[^.]+$/, "") || "logo");
      const res = await fetch(graphApiUrl("api/media-upload"), { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `upload ${res.status}`);
      const id = data.media && data.media.id;
      if (!id) throw new Error("upload missing id");
      brandDirty = true;
      captureBrandDraft();
      if (brandDraft) brandDraft.logo = id;
      await loadLiveGraph();
      applyChrome();
      await renderBrand();
      const again = document.getElementById("brandLogoStatus");
      if (again) again.textContent = t("brand_logo_uploaded") + ` · ${id}`;
    } catch (err) {
      if (status) status.textContent = String(err.message || err);
      btn.disabled = false;
    }
  };
}
async function saveBrand() {
  const status = document.getElementById("brandStatus");
  if (!isHttpServe()) {
    status.textContent = t("brand_need_serve");
    return;
  }
  const btn = document.getElementById("brandSave");
  btn.disabled = true;
  status.textContent = "";
  const body = {
    profile_id: document.getElementById("brandProfile").value,
    display_name: document.getElementById("brandName").value,
    handle: document.getElementById("brandHandle").value,
    logo: document.getElementById("brandLogo").value,
    primary: document.getElementById("brandPrimary").value,
    accent: document.getElementById("brandAccent").value,
    background: document.getElementById("brandBg").value,
    text: document.getElementById("brandFg").value,
    heading_font: document.getElementById("brandHeadFont").value,
    body_font: document.getElementById("brandBodyFont").value,
  };
  try {
    const res = await fetch(graphApiUrl("api/brand"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `save ${res.status}`);
    brandDirty = false;
    brandDraft = null;
    await loadLiveGraph();
    applyChrome();
    render();
    const again = document.getElementById("brandStatus");
    if (again) again.textContent = t("brand_saved");
  } catch (err) {
    status.textContent = String(err.message || err);
    btn.disabled = false;
  }
}

function render() {
  const graphViewLive = view === "wiki" || (view === "base" && baseTab === "graph");
  if (!graphViewLive) stopWikiGraphAnim();
  document.querySelectorAll(".nav-primary .nav-tab").forEach(b => {
    const parent = VIEW_PARENT[view] || view;
    b.classList.toggle("on", b.getAttribute("data-v") === parent);
  });
  const q = ($q.value || "").trim();
  if (shellEl) shellEl.classList.toggle("brand-stage", view === "brand" && !q);
  // Leaving Brand destroys #brandForm; snapshot unsaved edits before another view replaces the list.
  if (view !== "brand" && brandDirty && document.getElementById("brandForm")) captureBrandDraft();
  if (PRIMARY_VIEWS.includes(view) && q) {
    stopWikiGraphAnim();
    renderSearchResults(q);
  } else if (view === "overview") {
    renderOverview();
  } else if (view === "select" || view === "foundation" || view === "discover" || view === "topics") {
    renderTopics();
  } else if (view === "base") {
    renderBaseHub();
  } else if (view === "brand") {
    // Skip remount only while still editing Brand in place (e.g. live graph refresh).
    // After Base/other tabs, #brandForm is gone — must remount even if dirty.
    if (!brandDirty || !document.getElementById("brandForm")) renderBrand();
    else paintBrandPreview();
  } else if (view === "content") {
    renderContent();
  } else if (view === "shipped") {
    renderShipped();
  } else if (view === "needs") {
    renderNeeds();
  } else if (view === "hits") {
    renderHits();
  } else if (view === "products") {
    renderProducts();
  } else if (view === "recommendations") {
    renderRecommendations();
  } else if (view === "wiki") {
    renderWiki();
  } else if (view === "notes") {
    renderNotes();
  } else if (view === "library") {
    renderLibrary();
  } else if (view === "media") {
    renderMedia();
  } else if (view === "runs") {
    renderRuns();
  } else if (view === "pub") {
    renderPub();
  }
  renderInsp();
  if (view === "brand" && !q && document.getElementById("brandForm")) paintBrandPreview();
}

function insertSelectBack() {
  const bar = document.createElement("div");
  bar.className = "page-back";
  bar.innerHTML = `<button type="button">${esc(t("page_back_select"))}</button>`;
  bar.querySelector("button").onclick = () => jumpToView("select");
  $list.appendChild(bar);
}

function insertBaseBack() {
  const bar = document.createElement("div");
  bar.className = "page-back";
  bar.innerHTML = `<button type="button">${esc(t("page_back_base"))}</button>`;
  bar.querySelector("button").onclick = () => jumpToView("base");
  $list.appendChild(bar);
}

function humanNeedStatus(st) {
  const map = {
    captured: "st_need_captured",
    promoted: "st_need_promoted",
    retired: "st_need_retired",
  };
  return map[st] ? t(map[st]) : (st || "");
}

function humanHitStatus(st) {
  const map = {
    triage: "st_hit_triage",
    need: "st_hit_need",
    needs: "st_hit_need",
    library: "st_hit_library",
    discard: "st_hit_discard",
    discarded: "st_hit_discard",
    capture: "st_hit_capture",
  };
  return map[st] ? t(map[st]) : (st || "");
}

function needStatusClass(st) {
  if (st === "captured") return "ready";
  if (st === "promoted") return "ok";
  if (st === "retired") return "gap";
  return "";
}

function hitStatusClass(st) {
  if (st === "triage") return "triage gap";
  if (st === "need" || st === "needs" || st === "library" || st === "capture") return "ready";
  if (st === "discard" || st === "discarded") return "gap";
  return "";
}

function needCardEl(n) {
  const el = document.createElement("div");
  el.className = "decision-card" + (selected === n.id ? " sel" : "");
  const quote = n.quote || n.label || n.ident;
  const st = n.status || "";
  const tags = [
    st ? `<span class="pill ${needStatusClass(st)}">${esc(humanNeedStatus(st))}</span>` : "",
    n.frequency ? `<span class="pill">${esc(t("need_freq", { n: n.frequency }))}</span>` : "",
    n.source_type ? `<span class="pill">${esc(n.source_type)}</span>` : "",
    n.topic_ids && n.topic_ids !== "none" ? `<span class="pill">${esc(n.topic_ids)}</span>` : "",
  ].filter(Boolean).join("");
  el.innerHTML = `
    <div>
      <p class="decision-card-kicker">${esc(n.ident)}${n.date ? ` · ${esc(n.date)}` : ""}</p>
      <p class="decision-card-quote">“${esc(quote)}”</p>
      ${tags ? `<div class="decision-card-tags">${tags}</div>` : ""}
    </div>
    <div class="decision-card-side">
      <span class="decision-card-status">${esc(humanNeedStatus(st) || "—")}</span>
    </div>
  `;
  el.onclick = () => select(n.id);
  return el;
}

function hitCardEl(n) {
  const el = document.createElement("div");
  el.className = "decision-card" + (selected === n.id ? " sel" : "");
  const body = n.excerpt || n.label || n.ident;
  const st = n.status || "";
  const tags = [
    st ? `<span class="pill ${hitStatusClass(st)}">${esc(humanHitStatus(st))}</span>` : "",
    n.signal ? `<span class="pill">${esc(n.signal)}</span>` : "",
    n.hit_kind ? `<span class="pill">${esc(n.hit_kind)}</span>` : "",
    n.keyword_id ? `<button type="button" class="kw-chip" data-kw-filter="${esc(n.keyword_id)}">${esc(n.keyword_id)}</button>` : "",
  ].filter(Boolean).join("");
  const meta = [n.platform, n.src_handle, n.date].filter(Boolean).join(" · ");
  el.innerHTML = `
    <div>
      <p class="decision-card-kicker">${esc(n.ident)}${meta ? ` · ${esc(meta)}` : ""}</p>
      <p class="decision-card-quote">${esc(body)}</p>
      ${heatStripHtml(n)}
      ${tags ? `<div class="decision-card-tags">${tags}</div>` : ""}
    </div>
    <div class="decision-card-side">
      ${platMarkHtml(n, 18)}
      <span class="decision-card-status">${esc(humanHitStatus(st) || "—")}</span>
      <span class="decision-card-id">${n.keyword_id ? esc(t("hit_from_kw", { id: n.keyword_id })) : ""}</span>
    </div>
  `;
  el.onclick = () => select(n.id);
  return el;
}

function renderNeedsList(into) {
  const board = document.createElement("div");
  board.className = "decision-board";
  let needs = nodesOf("need").filter(qmatch);
  if (needStatus) needs = needs.filter(n => n.status === needStatus);
  needs.sort((a, b) => {
    const rank = (s) => (s === "captured" ? 0 : s === "promoted" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    if (d) return d;
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
  needs.forEach(n => board.appendChild(needCardEl(n)));
  if (!needs.length) {
    board.innerHTML = `<p class='empty'>${t("no_need")}</p><p class="note">${esc(t("need_empty_hint"))}</p>`;
  }
  into.appendChild(board);
}

function renderNeeds() {
  $list.innerHTML = "";
  insertBaseBack();
  $list.insertAdjacentHTML("beforeend",
    `<p class="lead">${esc(t("card_needs_title"))}</p><p class="lede">${esc(t("card_needs_desc"))}</p>`);
  const statusRow = document.createElement("div");
  statusRow.className = "filt";
  const statuses = [...new Set(nodesOf("need").map(x => x.status).filter(Boolean))];
  statusRow.appendChild(chipRow(t("f_status"), statuses.map(s => ({
    id: s,
    label: humanNeedStatus(s),
  })), needStatus, (id) => {
    needStatus = id;
    renderNeeds();
    renderInsp();
  }));
  $list.appendChild(statusRow);
  renderNeedsList($list);
}

function keywordsInScope(opts = {}) {
  const all = GRAPH.keywords || [];
  let rows = profileScope
    ? all.filter(k => k.profile === profileScope)
    : all.slice();
  if (opts.activeOnly !== false) rows = rows.filter(k => k.status === "active" || !k.status);
  if (opts.track) rows = rows.filter(k => (k.track || "listen") === opts.track);
  return rows;
}
function listenKeywordsInScope() {
  return keywordsInScope({ track: "listen" });
}
function hitCountForKeyword(kid) {
  return nodesOf("hit").filter(h => h.keyword_id === kid).length;
}
function triageCountForKeyword(kid) {
  return nodesOf("hit").filter(h => h.keyword_id === kid && h.status === "triage").length;
}
function keywordMatchesQuery(k, q) {
  if (!q) return true;
  const blob = [k.id, k.why, k.query, k.intent, k.layer, k.pillar].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(q);
}
function rankedKeywords(opts = {}) {
  const base = opts.forHits ? listenKeywordsInScope() : keywordsInScope({ activeOnly: false, track: opts.track || "" });
  return base
    .map(k => ({
      ...k,
      track: k.track || "listen",
      triage: triageCountForKeyword(k.id),
      total: hitCountForKeyword(k.id),
    }))
    .sort((a, b) => (b.triage - a.triage) || (b.total - a.total) || (Number(b.weight || 0) - Number(a.weight || 0)));
}
function keywordById(kid) {
  return (GRAPH.keywords || []).find(k => k.id === kid && (!profileScope || k.profile === profileScope))
    || (GRAPH.keywords || []).find(k => k.id === kid)
    || null;
}
function keywordIdNum(id) {
  const m = String(id || "").match(/K-(\d+)/i);
  return m ? Number(m[1]) : 0;
}
function keywordOptionLabel(k) {
  const triage = typeof k.triage === "number" ? k.triage : triageCountForKeyword(k.id);
  const total = typeof k.total === "number" ? k.total : hitCountForKeyword(k.id);
  const bits = [k.id];
  if (k.track && k.track !== "listen") bits.push(k.track);
  if (k.layer) bits.push(k.layer);
  bits.push(`${triage}/${total}`);
  return bits.join(" · ");
}
function bindKwFilters(root) {
  root.querySelectorAll("[data-kw-filter]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const kid = btn.getAttribute("data-kw-filter") || "";
      hitKw = hitKw === kid ? "" : kid;
      hitsSub = "list";
      renderHits();
    };
  });
}
function renderKeywordFilter(into) {
  const wrap = document.createElement("div");
  wrap.className = "kw-filter";
  const ranked = rankedKeywords({ forHits: true });
  const q = hitKwQ.trim().toLowerCase();
  const filtered = ranked.filter(k => keywordMatchesQuery(k, q));
  const withHits = filtered.filter(k => k.total > 0);
  const listenN = listenKeywordsInScope().length;

  const row = document.createElement("div");
  row.className = "kw-filter-row";
  const searchWrap = document.createElement("div");
  searchWrap.className = "kw-search";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("kw_search");
  search.setAttribute("aria-label", t("kw_search"));
  search.value = hitKwQ;
  search.oninput = () => {
    const pos = search.selectionStart;
    hitKwQ = search.value;
    renderHits();
    const s2 = $list.querySelector(".kw-search input[type='search']");
    if (s2) {
      s2.focus();
      try { s2.setSelectionRange(pos, pos); } catch (_) {}
    }
  };
  searchWrap.appendChild(search);
  row.appendChild(searchWrap);
  wrap.appendChild(row);

  const quickWrap = document.createElement("div");
  quickWrap.className = "kw-quick";
  if (!listenN) {
    quickWrap.innerHTML = `<span class="vacant">${esc(t("no_keyword"))}</span>`;
  } else if (!withHits.length) {
    quickWrap.innerHTML = `<span class="vacant">${esc(t("no_hit"))}</span>`;
  } else {
    withHits.forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kw-chip" + (hitKw === k.id ? " on" : "");
      b.innerHTML = `${esc(k.id)}<span class="n">${k.triage}</span>`;
      b.title = [k.query, k.why, `${k.triage} ${t("kw_triage")} · ${k.total} ${t("kw_hits")}`].filter(Boolean).join("\n");
      b.onclick = () => {
        hitKw = hitKw === k.id ? "" : k.id;
        renderHits();
      };
      quickWrap.appendChild(b);
    });
  }
  wrap.appendChild(quickWrap);

  if (hitKw) {
    const k = keywordById(hitKw);
    const active = document.createElement("div");
    active.className = "kw-active";
    const triage = triageCountForKeyword(hitKw);
    const total = hitCountForKeyword(hitKw);
    active.innerHTML = `<span class="kid">${esc(hitKw)}</span>
      <span class="meta">${esc([(k && k.layer) || "", (k && k.intent) || "", (k && k.pillar) || ""].filter(Boolean).join(" · "))}</span>
      <span class="query" title="${esc((k && k.why) || "")}">${esc((k && k.query) || "")}</span>
      <span class="meta"><b>${triage}</b> ${esc(t("kw_triage"))} · ${total} ${esc(t("kw_hits"))}</span>
      <button type="button" class="clear">${esc(t("kw_clear"))}</button>`;
    active.querySelector(".clear").onclick = () => { hitKw = ""; renderHits(); };
    wrap.appendChild(active);
  }

  into.appendChild(wrap);
  return { filtered };
}
function renderHitsSubtabs() {
  const sub = document.createElement("div");
  sub.className = "subtabs";
  sub.innerHTML = `<button type="button" data-hits-sub="list">${t("hits_sub_list")}</button><button type="button" data-hits-sub="catalog">${t("hits_sub_catalog")}</button>`;
  sub.querySelectorAll("button").forEach(b => {
    b.classList.toggle("on", b.dataset.hitsSub === hitsSub);
    b.onclick = () => {
      hitsSub = b.dataset.hitsSub;
      renderHits();
    };
  });
  $list.appendChild(sub);
}
function openKeywordInHits(kid) {
  hitKw = kid || "";
  hitsSub = "list";
  renderHits();
}
function renderKeywordCatalog() {
  const row = document.createElement("div");
  row.className = "kw-filter-row";
  const searchWrap = document.createElement("div");
  searchWrap.className = "kw-search";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("kw_catalog_search");
  search.setAttribute("aria-label", t("kw_catalog_search"));
  search.value = kwCatalogQ;
  search.oninput = () => {
    const pos = search.selectionStart;
    kwCatalogQ = search.value;
    renderHits();
    const s2 = $list.querySelector(".kw-search input[type='search']");
    if (s2) {
      s2.focus();
      try { s2.setSelectionRange(pos, pos); } catch (_) {}
    }
  };
  searchWrap.appendChild(search);
  row.appendChild(searchWrap);

  const tracks = document.createElement("div");
  tracks.className = "kw-quick";
  [
    ["", "kw_track_all"],
    ["listen", "kw_track_listen"],
    ["search", "kw_track_search"],
    ["ask", "kw_track_ask"],
  ].forEach(([id, labelKey]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kw-chip" + (kwCatalogTrack === id ? " on" : "");
    b.textContent = t(labelKey);
    b.onclick = () => { kwCatalogTrack = id; renderHits(); };
    tracks.appendChild(b);
  });
  row.appendChild(tracks);
  $list.appendChild(row);

  const q = kwCatalogQ.trim().toLowerCase();
  const keys = rankedKeywords({ track: kwCatalogTrack || "" })
    .filter(k => keywordMatchesQuery(k, q))
    .sort((a, b) => keywordIdNum(a.id) - keywordIdNum(b.id));
  const count = document.createElement("p");
  count.className = "note";
  count.style.margin = "8px 0 0";
  count.textContent = t("kw_catalog_count", { n: keys.length });
  $list.appendChild(count);
  const grid = document.createElement("div");
  grid.className = "kw-catalog-grid";
  if (!keys.length) {
    grid.innerHTML = `<p class='empty'>${esc(t("kw_catalog_empty"))}</p>`;
  } else {
    keys.forEach(k => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "kw-catalog-card";
      const vol = k.track === "search" && k.volume
        ? ` · ${t("kw_vol")} ${esc(k.volume)}`
        : "";
      const go = k.track === "listen"
        ? `<span class="go">${esc(t("kw_open_hits"))} →</span>`
        : `<span class="meta">${esc(k.track)}</span>`;
      card.innerHTML = `<div class="kid">${esc(k.id)} <span class="pill">${esc(k.track || "listen")}</span></div>
        <div class="meta">${esc([k.layer, k.intent, k.pillar, k.status].filter(Boolean).join(" · "))}${vol}</div>
        <div class="query">${esc(k.query || "")}</div>
        ${k.why ? `<div class="why">${esc(k.why)}</div>` : ""}
        <div class="count"><b>${k.triage}</b> ${esc(t("kw_triage"))} · ${k.total} ${esc(t("kw_hits"))}${k.last_scanned ? ` · ${esc(k.last_scanned)}` : ""}</div>
        ${go}`;
      card.onclick = () => {
        if ((k.track || "listen") === "listen") openKeywordInHits(k.id);
      };
      grid.appendChild(card);
    });
  }
  $list.appendChild(grid);
}
function renderHitsList() {
  const statuses = [...new Set(nodesOf("hit").map(x => x.status).filter(Boolean))];
  const signals = [...new Set(nodesOf("hit").map(x => x.signal).filter(Boolean))];
  const { filtered } = renderKeywordFilter($list);
  const kwOptions = filtered.length ? filtered : rankedKeywords({ forHits: true });
  filterBar(
    `<select id="h-st"><option value="">${t("f_status")}</option>${statuses.map(s => `<option value="${s}" ${s === hitSt ? "selected" : ""}>${esc(humanHitStatus(s))}</option>`).join("")}</select>
     <select id="h-sig"><option value="">${t("f_signal")}</option>${signals.map(s => `<option value="${s}" ${s === hitSig ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
     <select id="h-kw"><option value="">${t("f_keyword")} (${listenKeywordsInScope().length})</option>${kwOptions.map(k => `<option value="${esc(k.id)}" ${k.id === hitKw ? "selected" : ""}>${esc(keywordOptionLabel(k))}</option>`).join("")}</select>`,
    (w) => {
      const st = w.querySelector("#h-st");
      const sig = w.querySelector("#h-sig");
      const kw = w.querySelector("#h-kw");
      if (hitKw && ![...kw.options].some(o => o.value === hitKw)) {
        const opt = document.createElement("option");
        opt.value = hitKw;
        opt.textContent = keywordOptionLabel(keywordById(hitKw) || { id: hitKw });
        opt.selected = true;
        kw.appendChild(opt);
      }
      const paintCards = () => {
        [...$list.querySelectorAll(".decision-board, .cards")].forEach(n => n.remove());
        const board = document.createElement("div");
        board.className = "decision-board";
        let rows = nodesOf("hit").filter(qmatch).sort((a, b) => {
          const ta = a.status === "triage" ? 0 : 1;
          const tb = b.status === "triage" ? 0 : 1;
          if (ta !== tb) return ta - tb;
          const ha = Number(String(a.src_likes || "0").replace(/,/g, "")) || 0;
          const hb = Number(String(b.src_likes || "0").replace(/,/g, "")) || 0;
          if (hb !== ha) return hb - ha;
          return String(b.date || "").localeCompare(String(a.date || ""));
        });
        if (hitSt) rows = rows.filter(x => x.status === hitSt);
        if (hitSig) rows = rows.filter(x => x.signal === hitSig);
        if (hitKw) rows = rows.filter(x => x.keyword_id === hitKw);
        rows.forEach(x => board.appendChild(hitCardEl(x)));
        if (!rows.length) {
          board.innerHTML = `<p class='empty'>${t("no_hit")}</p><p class="note">${esc(t("hit_empty_hint"))}</p>`;
        }
        $list.appendChild(board);
        bindKwFilters(board);
      };
      st.onchange = () => { hitSt = st.value || ""; paintCards(); };
      sig.onchange = () => { hitSig = sig.value || ""; paintCards(); };
      kw.onchange = () => { hitKw = kw.value || ""; renderHits(); };
      paintCards();
    }
  );
}
function renderHits() {
  $list.innerHTML = "";
  insertBaseBack();
  $list.insertAdjacentHTML("beforeend",
    `<p class="lead">${esc(t("card_hits_title"))}</p><p class="lede">${esc(t("card_hits_desc"))}</p>`);
  renderHitsSubtabs();
  if (hitsSub === "catalog") renderKeywordCatalog();
  else renderHitsList();
}

function renderProducts() {
  $list.innerHTML = "";
  const products = nodesOf("product").filter(qmatch).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  $list.insertAdjacentHTML("beforeend", `<p class="lead">Needs describe demand. Products describe the offer. Topics connect them only when the fit is honest.</p>`);
  const cards = document.createElement("div");
  cards.className = "cards";
  products.forEach(product => {
    const meta = [
      product.status,
      product.audience,
      product.price,
      product.effective_from,
    ].filter(Boolean).join(" · ");
    cards.appendChild(rowEl(product, meta));
  });
  if (!products.length) cards.innerHTML = `<p class='empty'>No products in products/_index.md</p>`;
  $list.appendChild(cards);
}

function renderRecommendations() {
  $list.innerHTML = "";
  const recommendations = nodesOf("recommendation").filter(qmatch).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  $list.insertAdjacentHTML("beforeend", `<p class="lead">Recommendations are third-party review subjects, not owned Products.</p>`);
  const cards = document.createElement("div");
  cards.className = "cards";
  recommendations.forEach(item => {
    const meta = [
      item.status,
      item.category,
      item.relationship,
      item.last_researched,
    ].filter(Boolean).join(" · ");
    cards.appendChild(rowEl(item, meta));
  });
  if (!recommendations.length) cards.innerHTML = `<p class='empty'>No recommendations in recommendations/_index.md</p>`;
  $list.appendChild(cards);
}

function wikiKindColor(kind) {
  const map = {
    profile: "#8b6b4a",
    wiki: "#9c3d32",
    need: "#5a9e8f",
    capture: "#7d9aa8",
    product: "#7a6b9e",
    topic: "#9c3d32",
    run: "#8aa87a",
    published: "#6b8f9e",
    swipe: "#c4a06a",
    atom: "#a78bb0",
    claim: "#d08a78",
  };
  return map[kind] || "#8a8276";
}

function wikiGraphKinds() {
  if (wikiGraphMode === "judgments") return new Set(["profile", "wiki"]);
  // Spine includes captures + library candidates (candidates edges from W- pages).
  if (wikiGraphMode === "full") {
    return new Set(["profile", "wiki", "need", "capture", "product", "topic", "run", "published", "swipe", "atom", "claim"]);
  }
  return new Set(["profile", "wiki", "need", "capture", "product", "topic", "run", "published", "swipe", "atom", "claim"]);
}

function buildWikiSubgraph() {
  const kinds = wikiGraphKinds();
  const wikiNodes = (GRAPH.nodes || []).filter(n => n.kind === "wiki" && inScope(n));
  const seed = new Set(wikiNodes.map(n => n.id));
  if (profileScope && byId[`profile:${profileScope}`]) seed.add(`profile:${profileScope}`);
  const keep = new Set(seed);
  for (const e of GRAPH.edges || []) {
    if (!seed.has(e.from) && !seed.has(e.to)) continue;
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) continue;
    if (!kinds.has(a.kind) || !kinds.has(b.kind)) continue;
    keep.add(e.from); keep.add(e.to);
  }
  // pull published results for included runs
  if (kinds.has("published")) {
    const runIds = new Set([...keep].filter(id => id.startsWith("run:")));
    for (const e of GRAPH.edges || []) {
      if (e.rel !== "from_run") continue;
      if (!runIds.has(e.to)) continue;
      const pub = byId[e.from];
      if (pub && pub.kind === "published") keep.add(e.from);
    }
  }
  const nodes = [...keep].map(id => byId[id]).filter(Boolean);
  const nodeSet = new Set(nodes.map(n => n.id));
  const links = (GRAPH.edges || []).filter(e => nodeSet.has(e.from) && nodeSet.has(e.to));
  return { nodes, links };
}

function stopWikiGraphAnim() {
  if (wikiGraphAnim) {
    cancelAnimationFrame(wikiGraphAnim);
    wikiGraphAnim = null;
  }
  wikiGraphApi = null;
}

function shortWikiLabel(n) {
  if (n.kind === "wiki") return n.ident.replace(/^W-/, "");
  if (n.kind === "need") return n.ident.replace(/^N-\d{8}-/, "N-");
  if (n.kind === "topic") return n.ident.replace(/^T-\d{8}-/, "T-");
  if (n.kind === "run") return n.ident.replace(/^RUN-/, "R-").slice(0, 18);
  if (n.kind === "published") return (n.date || n.ident || "pub").slice(0, 12);
  if (n.kind === "profile") return "profile";
  return String(n.ident || n.label || "").slice(0, 16);
}

function nodeGraphBlob(n) {
  return [
    n.id, n.ident, n.label, n.kind, n.state, n.status, n.one_liner, n.caption,
    n.topic_id, n.platform, n.platforms, n.profile, n.path, shortWikiLabel(n),
  ].filter(Boolean).join(" ").toLowerCase();
}

function nodeMatchesGraphQuery(n, q) {
  const qq = String(q || "").trim().toLowerCase();
  if (!qq) return true;
  return nodeGraphBlob(n).includes(qq);
}

function mountWikiForceGraph(host, graph) {
  stopWikiGraphAnim();
  wikiGraphApi = null;
  const width = Math.max(host.clientWidth || 720, 560);
  const height = Math.min(window.innerHeight * 0.72, 780);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "wiki-graph-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(root);
  host.appendChild(svg);

  const nodes = graph.nodes.map((n, i) => {
    const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    const ring = n.kind === "profile" ? 0 : n.kind === "wiki" ? 180 : 320;
    // Tiny deterministic jitter — avoids zero-distance repulsion spikes on shared rings.
    const jx = ((i * 37) % 11) - 5;
    const jy = ((i * 53) % 11) - 5;
    return {
      ...n,
      x: width / 2 + Math.cos(angle) * ring + jx,
      y: height / 2 + Math.sin(angle) * ring + jy,
      vx: 0,
      vy: 0,
    };
  });
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = graph.links
    .map(e => ({ ...e, source: by[e.from], target: by[e.to] }))
    .filter(e => e.source && e.target);

  const gLinks = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const gLabels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const gNodes = document.createElementNS("http://www.w3.org/2000/svg", "g");
  root.appendChild(gLinks);
  root.appendChild(gLabels);
  root.appendChild(gNodes);

  const linkEls = links.map(e => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "link");
    line.setAttribute("stroke-width", e.rel === "owns" || e.rel === "generates" || e.rel === "tests" ? "1.6" : "1");
    gLinks.appendChild(line);
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("class", "link-label");
    lab.textContent = e.rel || "";
    gLabels.appendChild(lab);
    return { e, line, lab };
  });

  const nodeEls = nodes.map(n => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "node" + (selected === n.id ? " sel" : ""));
    g.dataset.id = n.id;
    const r = n.kind === "profile" ? 16 : n.kind === "wiki" ? 13 : 8;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", String(r));
    c.setAttribute("fill", wikiKindColor(n.kind));
    c.setAttribute("stroke", "#faf6ec");
    c.setAttribute("stroke-width", "1.5");
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("class", "node-label");
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("dy", String(r + 12));
    lab.textContent = shortWikiLabel(n);
    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("class", "node-sub");
    sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("dy", String(r + 23));
    sub.textContent = n.kind === "wiki" ? (n.state || n.status || "") : n.kind;
    g.appendChild(c);
    g.appendChild(lab);
    if (n.kind === "wiki" || n.kind === "profile") g.appendChild(sub);
    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      select(n.id);
    });
    g.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      if (n.path) openMd(n.path, n.ident);
    });
    // node drag
    let dragging = false;
    g.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      dragging = true;
      n.fx = n.x; n.fy = n.y;
      g.setPointerCapture(ev.pointerId);
      ev.stopPropagation();
    });
    g.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const pt = clientToGraph(ev.clientX, ev.clientY);
      n.fx = pt.x; n.fy = pt.y;
      n.x = pt.x; n.y = pt.y;
      wake(0.2);
    });
    g.addEventListener("pointerup", (ev) => {
      if (!dragging) return;
      dragging = false;
      n.fx = null; n.fy = null;
      try { g.releasePointerCapture(ev.pointerId); } catch (_) {}
      wake(0.25);
    });
    gNodes.appendChild(g);
    return { n, g, r };
  });

  function applyTransform() {
    root.setAttribute("transform", `translate(${wikiGraphTransform.x},${wikiGraphTransform.y}) scale(${wikiGraphTransform.k})`);
  }
  applyTransform();

  function clientToGraph(cx, cy) {
    const rect = svg.getBoundingClientRect();
    const x = (cx - rect.left - wikiGraphTransform.x) / wikiGraphTransform.k;
    const y = (cy - rect.top - wikiGraphTransform.y) / wikiGraphTransform.k;
    return { x, y };
  }

  function focusNode(id) {
    const n = by[id];
    if (!n) return false;
    const k = Math.max(wikiGraphTransform.k, 1.35);
    wikiGraphTransform.k = k;
    wikiGraphTransform.x = width / 2 - n.x * k;
    wikiGraphTransform.y = height / 2 - n.y * k;
    applyTransform();
    select(id);
    return true;
  }

  // pan + zoom
  let panning = false, pan0 = null;
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    if (ev.target.closest(".node")) return;
    panning = true;
    svg.classList.add("dragging");
    pan0 = { x: ev.clientX, y: ev.clientY, tx: wikiGraphTransform.x, ty: wikiGraphTransform.y };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!panning || !pan0) return;
    wikiGraphTransform.x = pan0.tx + (ev.clientX - pan0.x);
    wikiGraphTransform.y = pan0.ty + (ev.clientY - pan0.y);
    applyTransform();
  });
  svg.addEventListener("pointerup", (ev) => {
    panning = false;
    pan0 = null;
    svg.classList.remove("dragging");
    try { svg.releasePointerCapture(ev.pointerId); } catch (_) {}
  });
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const prev = wikiGraphTransform.k;
    const next = Math.min(2.8, Math.max(0.35, prev * (ev.deltaY < 0 ? 1.08 : 0.92)));
    wikiGraphTransform.x = mx - (mx - wikiGraphTransform.x) * (next / prev);
    wikiGraphTransform.y = my - (my - wikiGraphTransform.y) * (next / prev);
    wikiGraphTransform.k = next;
    applyTransform();
  }, { passive: false });

  // Force layout: visible cool-down from ring seed (soft charge, no infinite thrash).
  let alpha = 1;
  const alphaMin = 0.02;
  const alphaDecay = 0.97;
  // Stronger repulsion + longer springs so ~80 nodes don't pack into a ball.
  const charge = Math.min(1400, Math.max(520, 48000 / Math.max(nodes.length, 1)));
  // Simulate in a room larger than the viewport; user can pan/zoom.
  const roomW = width * 1.55;
  const roomH = height * 1.55;
  const originX = (width - roomW) / 2;
  const originY = (height - roomH) / 2;

  function stepPhysics(strength) {
    let energy = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(dist2);
        const force = (charge * strength) / dist2;
        dx = dx / dist * force; dy = dy / dist * force;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
    }
    for (const e of links) {
      const a = e.source, b = e.target;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const ideal = (a.kind === "wiki" || b.kind === "wiki") ? 170 : 140;
      const f = (dist - ideal) * 0.03 * strength;
      dx = dx / dist * f; dy = dy / dist * f;
      a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
    }
    for (const n of nodes) {
      // Weak centering — let clusters breathe instead of collapsing to mid.
      n.vx += (width / 2 - n.x) * 0.002 * strength;
      n.vy += (height / 2 - n.y) * 0.002 * strength;
      if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
      // Soft walls on the larger room (hard clamp was packing everything).
      const pad = 40;
      if (n.x < originX + pad) n.vx += (originX + pad - n.x) * 0.05;
      if (n.x > originX + roomW - pad) n.vx += (originX + roomW - pad - n.x) * 0.05;
      if (n.y < originY + pad) n.vy += (originY + pad - n.y) * 0.05;
      if (n.y > originY + roomH - pad) n.vy += (originY + roomH - pad - n.y) * 0.05;
      energy += n.vx * n.vx + n.vy * n.vy;
    }
    return energy;
  }

  function paint() {
    const q = wikiGraphQuery.trim().toLowerCase();
    for (const { e, line, lab } of linkEls) {
      line.setAttribute("x1", e.source.x);
      line.setAttribute("y1", e.source.y);
      line.setAttribute("x2", e.target.x);
      line.setAttribute("y2", e.target.y);
      lab.setAttribute("x", (e.source.x + e.target.x) / 2);
      lab.setAttribute("y", (e.source.y + e.target.y) / 2);
      const hit = !q
        || nodeMatchesGraphQuery(e.source, q)
        || nodeMatchesGraphQuery(e.target, q)
        || String(e.rel || "").toLowerCase().includes(q);
      line.classList.toggle("dim", Boolean(q) && !hit);
      lab.classList.toggle("dim", Boolean(q) && !hit);
      lab.style.display = wikiGraphTransform.k < 0.7 ? "none" : "";
    }
    for (const { n, g } of nodeEls) {
      g.setAttribute("transform", `translate(${n.x},${n.y})`);
      g.classList.toggle("sel", selected === n.id);
      const hit = nodeMatchesGraphQuery(n, q);
      g.classList.toggle("dim", Boolean(q) && !hit);
      g.classList.toggle("hit", Boolean(q) && hit);
    }
  }

  function wake(boost = 0.5) {
    alpha = Math.max(alpha, boost);
    if (!wikiGraphAnim) wikiGraphAnim = requestAnimationFrame(tick);
  }

  function tick() {
    const energy = stepPhysics(alpha);
    alpha *= alphaDecay;
    paint();
    if (alpha >= alphaMin) {
      wikiGraphAnim = requestAnimationFrame(tick);
    } else {
      alpha = 0;
      wikiGraphAnim = null;
    }
  }

  // Start slightly zoomed out so the looser layout fits the first view.
  if (wikiGraphTransform.k === 1 && wikiGraphTransform.x === 0 && wikiGraphTransform.y === 0) {
    wikiGraphTransform.k = 0.78;
    wikiGraphTransform.x = width * 0.11;
    wikiGraphTransform.y = height * 0.11;
    applyTransform();
  }
  paint();
  wikiGraphAnim = requestAnimationFrame(tick);
  wikiGraphApi = {
    focusNode,
    hasNode: (id) => Boolean(by[id]),
    nodeIds: () => nodes.map(n => n.id),
  };
}

function renderWikiList() {
  const rows = nodesOf("wiki")
    .filter(qmatch)
    .slice()
    .sort((a, b) => String(a.ident || "").localeCompare(String(b.ident || "")));
  if (!rows.length) {
    $list.insertAdjacentHTML("beforeend", `<p class='empty'>${t("wiki_empty")}</p>`);
    return;
  }
  const cards = document.createElement("div");
  cards.className = "cards";
  rows.forEach(n => {
    const meta = [
      n.state || n.status || "",
      n.confidence ? `conf ${n.confidence}` : "",
      n.profile || "",
    ].filter(Boolean).join(" · ");
    cards.appendChild(listRowEl(n, meta));
  });
  $list.appendChild(cards);
}

function refreshWikiGraph() {
  wikiGraphTransform = { x: 0, y: 0, k: 1 };
  if (view === "base") {
    baseTab = "graph";
    renderBaseHub();
  } else {
    wikiSurface = "graph";
    renderWiki();
  }
  renderInsp();
}

function renderWikiGraphSurface() {
  const graph = buildWikiSubgraph();
  const hasWiki = graph.nodes.some(n => n.kind === "wiki");
  $list.insertAdjacentHTML("beforeend", `<p class="lede">${esc(t("wiki_graph_lede"))}</p>`);

  const filt = document.createElement("div");
  filt.className = "filt";
  filt.appendChild(chipRow(t("wiki_graph_title"), [
    { id: "spine", label: t("wiki_mode_spine") },
    { id: "full", label: t("wiki_mode_full") },
    { id: "judgments", label: t("wiki_mode_judgments") },
  ], wikiGraphMode, (id) => {
    wikiGraphMode = id;
    refreshWikiGraph();
  }));
  $list.appendChild(filt);

  if (!hasWiki) {
    $list.insertAdjacentHTML("beforeend", `<p class='empty'>${t("wiki_empty")}</p>`);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "wiki-graph-wrap";
  const toolbar = document.createElement("div");
  toolbar.className = "wiki-graph-toolbar";
  const notebook = (GRAPH.wiki_notebooks || []).find(n => n.profile === profileScope);
  if (notebook) {
    const openRoot = document.createElement("button");
    openRoot.type = "button";
    openRoot.textContent = "README";
    openRoot.onclick = () => openMd(notebook.root_file || `${notebook.path}/README.md`, notebook.profile);
    toolbar.appendChild(openRoot);
    const openGraph = document.createElement("button");
    openGraph.type = "button";
    openGraph.textContent = "GRAPH.md";
    openGraph.onclick = () => openMd(`${notebook.path}/GRAPH.md`, "GRAPH");
    toolbar.appendChild(openGraph);
  }

  const searchWrap = document.createElement("div");
  searchWrap.className = "wg-search";
  const search = document.createElement("input");
  search.type = "search";
  search.value = wikiGraphQuery;
  search.placeholder = t("wiki_graph_search");
  search.setAttribute("aria-label", t("wiki_graph_search"));
  searchWrap.appendChild(search);
  toolbar.appendChild(searchWrap);

  const stat = document.createElement("span");
  stat.className = "wg-stat";
  stat.textContent = `${graph.nodes.length} nodes · ${graph.links.length} edges`;
  toolbar.appendChild(stat);
  wrap.appendChild(toolbar);

  const hitsBox = document.createElement("div");
  hitsBox.className = "wg-hits";
  hitsBox.hidden = true;
  wrap.appendChild(hitsBox);

  const legend = document.createElement("div");
  legend.className = "wiki-graph-legend";
  const legendKinds = [...wikiGraphKinds()];
  legend.innerHTML = legendKinds.map(k =>
    `<span><i style="background:${wikiKindColor(k)}"></i>${esc(kindName(k))}</span>`
  ).join("");
  wrap.appendChild(legend);

  const host = document.createElement("div");
  wrap.appendChild(host);
  $list.appendChild(wrap);
  mountWikiForceGraph(host, graph);

  const onMapIds = new Set(graph.nodes.map(n => n.id));
  const mapKinds = new Set(["profile", "wiki", "need", "capture", "product", "topic", "run", "published", "swipe", "atom", "claim"]);

  function fillHits() {
    const q = wikiGraphQuery.trim();
    hitsBox.innerHTML = "";
    if (!q) {
      hitsBox.hidden = true;
      return;
    }
    const onMap = graph.nodes.filter(n => nodeMatchesGraphQuery(n, q)).slice(0, 24);
    const offMap = (GRAPH.nodes || [])
      .filter(n => inScope(n) && mapKinds.has(n.kind) && !onMapIds.has(n.id) && nodeMatchesGraphQuery(n, q))
      .slice(0, 24);
    if (!onMap.length && !offMap.length) {
      hitsBox.hidden = false;
      hitsBox.innerHTML = `<p class="wg-hits-head">${esc(t("wiki_graph_none"))}</p>`;
      return;
    }
    hitsBox.hidden = false;
    const appendGroup = (label, rows, off) => {
      if (!rows.length) return;
      const head = document.createElement("p");
      head.className = "wg-hits-head";
      head.textContent = label.replace("{n}", String(rows.length));
      hitsBox.appendChild(head);
      rows.forEach(n => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wg-hit" + (off ? " off" : "") + (selected === n.id ? " on" : "");
        btn.innerHTML = `
          <span class="wg-hit-kind" style="background:${wikiKindColor(n.kind)}">${esc(kindName(n.kind))}</span>
          <span class="wg-hit-main">
            <span class="wg-hit-id">${esc(n.ident || n.id)}</span>
            <span class="wg-hit-label">${esc(n.label || n.one_liner || "")}</span>
          </span>
          ${off ? `<span class="wg-hit-badge">${esc(t("wiki_graph_not_linked"))}</span>` : ""}
        `;
        btn.onclick = () => {
          if (off) {
            select(n.id);
            return;
          }
          if (wikiGraphApi && wikiGraphApi.focusNode(n.id)) return;
          select(n.id);
        };
        hitsBox.appendChild(btn);
      });
    };
    appendGroup(t("wiki_graph_on_map"), onMap, false);
    appendGroup(t("wiki_graph_off_map"), offMap, true);
  }

  let searchTimer = null;
  search.addEventListener("input", () => {
    wikiGraphQuery = search.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fillHits, 80);
  });
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = hitsBox.querySelector(".wg-hit:not(.off)") || hitsBox.querySelector(".wg-hit");
    if (first) first.click();
  });
  fillHits();
  if (wikiGraphQuery) {
    queueMicrotask(() => search.focus());
  }
}

function renderWiki() {
  stopWikiGraphAnim();
  $list.innerHTML = "";
  $list.insertAdjacentHTML("beforeend",
    `<p class="lead">${esc(t("card_wiki_title"))}</p><p class="lede">${esc(t("card_wiki_desc"))}</p>`);

  const surface = document.createElement("div");
  surface.className = "subtabs wiki-surface-tabs";
  surface.innerHTML = `
    <button data-t="list">${t("wiki_sub_list")}</button>
    <button data-t="graph">${t("wiki_sub_graph")}</button>
  `;
  $list.appendChild(surface);
  surface.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.t === wikiSurface));
  surface.onclick = (e) => {
    const tname = e.target.dataset.t;
    if (!tname) return;
    wikiSurface = tname;
    renderWiki();
    renderInsp();
  };

  if (wikiSurface === "graph") renderWikiGraphSurface();
  else renderWikiList();
}

function libCardEl(n) {
  const subtype = n.atom_type || n.form || n.claim_type || "";
  const el = document.createElement("button");
  el.type = "button";
  el.className = "lib-card" + (selected === n.id ? " sel" : "");
  el.dataset.kind = n.kind || "";
  el.onclick = () => select(n.id);
  const chips = [
    n.status ? `<span class="lib-chip tone-status">${esc(n.status)}</span>` : "",
    `<span class="lib-chip">${esc(subtype || t("lib_no_subtype"))}</span>`,
    n.platforms ? `<span class="lib-chip">${esc(n.platforms)}</span>` : "",
  ].filter(Boolean).join("");
  const refs = n.refs != null && n.refs !== "" ? `<span>${esc(t("lib_refs"))} <b>${esc(String(n.refs))}</b></span>` : "";
  const hits = n.n != null ? `<span>${esc(t("lib_hits"))} <b>${esc(String(n.n))}</b></span>` : "";
  const metrics = (refs || hits) ? `<div class="lib-metrics">${refs}${hits}</div>` : `<span></span>`;
  el.innerHTML = `
    <div class="lib-card-top">
      <span class="lib-kind">${esc(n.kind || "")}</span>
      <span class="lib-id">${esc(n.ident || n.id || "")}</span>
    </div>
    <p class="lib-title">${esc(n.label || n.ident || "")}</p>
    <div class="lib-meta">${chips}</div>
    <div class="lib-foot">
      ${metrics}
      <span class="lib-open">${esc(t("hub_open"))} →</span>
    </div>
  `;
  return el;
}

function renderLibrary() {
  $list.innerHTML = "";
  const items = GRAPH.nodes.filter(n => n.lib && inScope(n));
  const subtypeOf = (n) => n.atom_type || n.form || n.claim_type || "";
  const kinds = [...new Set(items.map(n => n.kind))];
  const pool = items.filter(n => !libKind || n.kind === libKind);
  const subs = [...new Set(pool.map(subtypeOf).filter(Boolean))].sort();
  const statusVocab = {
    swipe: ["trial", "working", "dead"],
    atom: ["trial", "working", "dead"],
    claim: ["hypothesis", "supported", "weakened", "retired"],
  };
  const statuses = statusVocab[libKind] || [];

  $list.insertAdjacentHTML("beforeend", `
    <div class="lib-page-head">
      <h1 class="lib-page-title">${esc(t("card_library_title"))}</h1>
      <p class="lib-page-lede">${esc(t("lib_page_lede"))}</p>
    </div>
  `);

  const box = document.createElement("div");
  box.className = "filt";
  box.appendChild(chipRow(t("f_lib_kind"), kinds.map(k => ({ id: k, label: k })), libKind, (id) => {
    libKind = id;
    libSubtype = "";
    libStatus = "";
    renderLibrary();
    renderInsp();
  }));
  box.appendChild(chipRow(t("f_lib_subtype"), subs.map(s => ({ id: s, label: s })), libSubtype, (id) => {
    libSubtype = id;
    renderLibrary();
    renderInsp();
  }));
  if (libKind) {
    box.appendChild(chipRow(t("f_lib_status"), statuses.map(s => ({ id: s, label: s })), libStatus, (id) => {
      libStatus = id;
      renderLibrary();
      renderInsp();
    }));
  }
  $list.appendChild(box);

  const grid = document.createElement("div");
  grid.className = "lib-grid";
  let rows = pool.filter(qmatch);
  if (libSubtype) rows = rows.filter(n => subtypeOf(n) === libSubtype);
  if (libStatus) rows = rows.filter(n => n.status === libStatus);
  rows.sort((a, b) => String(a.ident).localeCompare(String(b.ident)));
  rows.forEach(n => grid.appendChild(libCardEl(n)));
  if (!rows.length) grid.innerHTML = `<p class='empty'>${esc(t("lib_empty"))}</p>`;
  $list.appendChild(grid);
}

function renderNotes() {
  $list.innerHTML = "";
  notesTab = "notes";
  const box = document.createElement("div");
  box.className = "filt";
  box.appendChild(chipRow(t("f_cap_ingest"), [
    { id: "ingested", label: t("f_cap_ingested") },
    { id: "not_ingested", label: t("f_cap_not_ingested") },
  ], capIngest, (id) => {
    capIngest = id;
    renderNotes();
    renderInsp();
  }));
  $list.appendChild(box);
  const cards = document.createElement("div");
  cards.className = "cards";
  let caps = nodesOf("capture").filter(qmatch).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (capIngest === "ingested") caps = caps.filter(c => c.status === "ingested");
  if (capIngest === "not_ingested") caps = caps.filter(c => c.status !== "ingested");
  caps.forEach(c => cards.appendChild(listRowEl(c, `${c.type} · ${c.status} · raw ${c.has_raw ? t("raw_yes") : t("raw_no")}`)));
  if (!caps.length) cards.innerHTML = `<p class='empty'>${t("no_note")}</p>`;
  $list.appendChild(cards);
}

function renderMedia() {
  $list.innerHTML = "";
  $list.insertAdjacentHTML("beforeend", `
    <div class="media-page-head">
      <p class="hub-kicker">${esc(t("media_nav"))}</p>
      <h1 class="hub-title">${esc(t("card_media_title"))}</h1>
      <p class="lib-page-lede">${esc(t("media_page_lede"))}</p>
      <p class="media-page-status" id="mediaPageStatus"></p>
    </div>
  `);
  const q = $q.value.trim().toLowerCase();
  const catalog = (GRAPH.media || []).map(m => {
    const node = byId[`media:${m.id}`];
    return node ? { ...m, ...node, id: m.id } : m;
  });
  const all = catalog.filter(m => {
    if (!q) return true;
    const blob = [m.id, m.caption, m.role, (m.tags || []).join(" "), (m.links || []).join(" "), (m.subjects || []).join(" "), m.rights, m.file].join(" ").toLowerCase();
    return blob.includes(q);
  });
  const subjects = [...new Set(all.flatMap(m => m.subjects || []))].sort();
  const roles = [...new Set(all.map(m => m.role).filter(Boolean))].sort();
  const tags = [...new Set(all.flatMap(m => m.tags || []))].sort();
  if (mediaSubject && !subjects.includes(mediaSubject)) mediaSubject = "";
  if (mediaRole && !roles.includes(mediaRole)) mediaRole = "";
  if (mediaTag && !tags.includes(mediaTag)) mediaTag = "";
  const items = all.filter(m =>
    (!mediaSubject || (m.subjects || []).includes(mediaSubject))
    && (!mediaRole || m.role === mediaRole)
    && (!mediaTag || (m.tags || []).includes(mediaTag))
  );
  const filt = document.createElement("div");
  filt.className = "filt";
  if (subjects.length) {
    filt.appendChild(chipRow(t("media_subject"), subjects.map(s => ({ id: s, label: s })), mediaSubject, (id) => {
      mediaSubject = id; renderMedia(); renderInsp();
    }));
  }
  if (roles.length) {
    filt.appendChild(chipRow(t("media_role"), roles.map(r => ({ id: r, label: r })), mediaRole, (id) => {
      mediaRole = id; renderMedia(); renderInsp();
    }));
  }
  if (tags.length) {
    filt.appendChild(chipRow(t("media_f_tag"), tags.map(tg => ({ id: tg, label: tg })), mediaTag, (id) => {
      mediaTag = id; renderMedia(); renderInsp();
    }));
  }
  if (filt.childNodes.length) $list.appendChild(filt);

  const grid = document.createElement("div");
  grid.className = "mediagrid";
  grid.appendChild(mediaAddTile());
  items.forEach(m => grid.appendChild(mediaCard(m)));
  bindMediaGridDrop(grid);
  $list.appendChild(grid);
}

function mediaStatusEl() {
  return document.getElementById("mediaPageStatus");
}

function mediaAddTile() {
  const card = document.createElement("div");
  card.className = "mediacard media-add";
  card.innerHTML = `
    <div class="media-add-plus">+</div>
    <div class="media-add-label">${esc(t("media_add"))}</div>
    <div class="media-add-hint">${esc(t("media_add_hint"))}</div>
    <input type="file" id="mediaUploadFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden>
  `;
  const fileInput = card.querySelector("#mediaUploadFile");
  card.onclick = () => {
    if (!isHttpServe()) {
      const st = mediaStatusEl();
      if (st) st.textContent = t("media_need_serve");
      return;
    }
    fileInput.click();
  };
  fileInput.onclick = (e) => e.stopPropagation();
  fileInput.onchange = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    await uploadMediaFiles(files, { statusEl: mediaStatusEl() });
  };
  return card;
}

function bindMediaGridDrop(grid) {
  const setDrop = (on) => {
    grid.classList.toggle("is-drop", on);
    grid.querySelector(".media-add")?.classList.toggle("is-drop", on);
  };
  grid.addEventListener("dragenter", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    setDrop(true);
  });
  grid.addEventListener("dragover", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    setDrop(true);
  });
  grid.addEventListener("dragleave", (e) => {
    if (!grid.contains(e.relatedTarget)) setDrop(false);
  });
  grid.addEventListener("drop", async (e) => {
    e.preventDefault();
    setDrop(false);
    const files = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|svg)$/i.test(f.name));
    if (!files.length) return;
    await uploadMediaFiles(files, { statusEl: mediaStatusEl() });
  });
}

async function uploadMediaFiles(files, { role = "other", tags = "photo", links = "", statusEl = null } = {}) {
  if (!isHttpServe()) {
    if (statusEl) statusEl.textContent = t("media_need_serve");
    return;
  }
  if (statusEl) statusEl.textContent = t("media_uploading");
  const body = new FormData();
  files.forEach(f => body.append("file", f, f.name));
  body.append("role", role);
  body.append("tags", tags);
  body.append("links", links);
  body.append("rights", "own-upload");
  try {
    const res = await fetch(graphApiUrl("api/media-upload"), { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `upload ${res.status}`);
    const n = (data.items || (data.media ? [data.media] : [])).length;
    await loadLiveGraph();
    applyChrome();
    render();
    const again = mediaStatusEl();
    if (again) again.textContent = fillTemplate("media_upload_done", { n }) + (data.errors?.length ? ` · ${data.errors.length} failed` : "");
  } catch (err) {
    if (statusEl) statusEl.textContent = String(err.message || err);
  }
}

async function deleteOneMedia(id) {
  if (!id) return;
  if (!isHttpServe()) {
    const st = mediaStatusEl();
    if (st) st.textContent = t("media_need_serve");
    return;
  }
  if (!confirm(t("media_delete_confirm_one"))) return;
  const st = mediaStatusEl();
  if (st) st.textContent = t("media_deleting");
  try {
    const res = await fetch(graphApiUrl("api/media-delete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `delete ${res.status}`);
    if (selected === `media:${id}`) selected = null;
    await loadLiveGraph();
    applyChrome();
    render();
    const again = mediaStatusEl();
    if (again) again.textContent = t("media_delete_done");
  } catch (err) {
    if (st) st.textContent = String(err.message || err);
  }
}

function mediaCard(m) {
  const card = document.createElement("div");
  card.className = "mediacard" + (selected === `media:${m.id}` ? " sel" : "");
  const gNode = byId[`media:${m.id}`];
  const gReady = gNode ? mediaIsReady(gNode) : false;
  const gBadge = gReady
    ? `<span class="media-gbadge ready">${esc(t("media_badge_ready"))}</span>`
    : `<span class="media-gbadge">${esc(t("media_badge_incomplete"))}</span>`;
  const rolePill = m.role ? `<span class="pill">${esc(m.role)}</span>` : "";
  const hosted = m.hosted
    ? `<span class="pill ok" title="${esc(m.hosted_image_id)}">${t("media_hosted")}</span>`
    : `<span class="pill">${t("media_local")}</span>`;
  const links = (m.subjects || m.links || []).map(l => `<span class="pill">${esc(l)}</span>`).join("");
  const src = m.src ? vaultFetchUrl(m.src) : "";
  const thumb = src
    ? `<div class="thumb"><img loading="lazy" src="${esc(src)}" alt="${esc(m.caption || m.id)}" onerror="this.closest('.thumb').classList.add('thumb-missing');this.remove();"></div>`
    : `<div class="thumb thumb-missing">?</div>`;
  const tagOnly = (m.tags || []).filter(tg => tg !== m.role).map(tg => `<span class="pill">${esc(tg)}</span>`).join("");
  card.innerHTML = `
    ${gBadge}
    <button type="button" class="media-del" title="${esc(t("media_delete_one"))}" aria-label="${esc(t("media_delete_one"))}">×</button>
    ${thumb}
    <div class="mediameta">
      <div class="hid">${esc(m.id)}</div>
      <p class="ttl">${esc(m.caption || m.file || "")}</p>
      <div class="pill-row">${rolePill}${tagOnly}${hosted}</div>
      ${links ? `<div class="pill-row">${links}</div>` : ""}
    </div>`;
  card.querySelector(".media-del").onclick = (e) => {
    e.stopPropagation();
    deleteOneMedia(m.id);
  };
  card.onclick = () => select(`media:${m.id}`);
  return card;
}

function evidenceLabel(tier) {
  const key = {
    unknown: "outcome_unknown",
    observed: "outcome_observed",
    tested: "outcome_tested",
    supported: "outcome_supported",
    weakened: "outcome_weakened",
  }[String(tier || "unknown").toLowerCase()] || "outcome_unknown";
  return t(key);
}

function outcomeClass(tier) {
  const v = String(tier || "unknown").toLowerCase();
  if (v === "supported") return "good";
  if (v === "tested" || v === "observed") return "warn";
  if (v === "weakened") return "bad";
  return "";
}

function pubEvidenceTier(p) {
  const tier = String(p.evidence_tier || "").trim().toLowerCase();
  if (/^(unknown|observed|tested|supported|weakened)$/.test(tier)) return tier;
  return "unknown";
}

function pubNote(p) {
  const notes = String(p.notes || "").trim();
  if (notes) return notes;
  const raw = String(p.evidence_tier || "").trim();
  if (raw && !/^(unknown|observed|tested|supported|weakened)$/i.test(raw)) return raw;
  return "";
}

function pubResult(p) {
  const r = String(p.result || "unknown").trim().toLowerCase();
  return /^(win|flat|loss|unknown)$/.test(r) ? r : "unknown";
}

function resultLabel(result) {
  const key = {
    win: "result_win",
    flat: "result_flat",
    loss: "result_loss",
    unknown: "result_unknown",
  }[pubResult({ result })] || "result_unknown";
  return t(key);
}

function resultToneClass(result) {
  const r = pubResult({ result });
  if (r === "win") return "good";
  if (r === "flat") return "warn";
  if (r === "loss") return "bad";
  return "";
}

function pubTitle(p) {
  const folder = String(p.run_folder || "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/-(x|ig|instagram|linkedin|threads|tiktok|xiaohongshu)$/i, "")
    .replace(/-/g, " ")
    .trim();
  if (folder) return folder.charAt(0).toUpperCase() + folder.slice(1);
  const claim = String(p.claim || "").trim();
  if (claim && claim.toLowerCase() !== "none") return claim;
  if (p.date && p.platform) return `${p.platform} · ${p.date}`;
  return p.ident || p.url || "—";
}

function pubCraftTags(p) {
  const tags = [];
  if (p.pillar) tags.push(p.pillar);
  const swipe = String(p.swipe || "").trim();
  if (swipe && swipe.toLowerCase() !== "none") tags.push(swipe.split(/\s+/)[0]);
  const claim = String(p.claim || "").trim();
  if (claim && claim.toLowerCase() !== "none") tags.push(claim.split(/\s+/)[0]);
  if (p.layout_family) tags.push(p.layout_family);
  if (p.topic_id) tags.push(p.topic_id);
  return tags.slice(0, 5);
}

function learnCardEl(p) {
  const result = pubResult(p);
  const tier = pubEvidenceTier(p);
  const note = pubNote(p);
  const needsReview = result === "unknown";
  const tone = needsReview ? "review" : result === "win" ? "win" : result === "loss" ? "loss" : "flat";
  const badge = needsReview
    ? `<span class="learn-badge review"><span class="dot"></span>${esc(t("learn_needs_review"))}</span>`
    : `<span class="learn-badge ${tone}"><span class="dot"></span>${esc(t("learn_has_result"))}</span>`;
  const tags = pubCraftTags(p)
    .map(x => `<span class="pill">${esc(x)}</span>`)
    .join("");
  const el = document.createElement("div");
  el.className = `learn-card tone-${tone}` + (selected === p.id ? " sel" : "");
  el.innerHTML = `
    <div class="learn-card-top">
      <div class="learn-card-meta">
        ${p.date ? `<span class="learn-chip">${esc(p.date)}</span>` : ""}
        ${p.platform ? `<span class="learn-chip plat">${esc(p.platform)}</span>` : ""}
        ${p.run_id ? `<span class="learn-chip">${esc(String(p.run_id).replace(/^RUN-/, ""))}</span>` : ""}
      </div>
      ${badge}
    </div>
    <div>
      <p class="learn-card-title">${esc(pubTitle(p))}</p>
      ${note ? `<p class="learn-card-note">${esc(note)}</p>` : ""}
    </div>
    <div class="learn-metrics">
      <div class="learn-metric">
        <span class="learn-metric-k">${esc(t("learn_result"))}</span>
        <span class="learn-metric-v ${resultToneClass(result)}">${esc(resultLabel(result))}</span>
        <span class="learn-metric-h">${esc(t(`learn_result_hint_${result}`))}</span>
      </div>
      <div class="learn-metric">
        <span class="learn-metric-k">${esc(t("learn_evidence"))}</span>
        <span class="learn-metric-v ${outcomeClass(tier)}">${esc(evidenceLabel(tier))}</span>
        <span class="learn-metric-h">${esc(t(`learn_evidence_hint_${tier}`))}</span>
      </div>
    </div>
    <div class="learn-card-foot">
      <div class="learn-card-tags">${tags}</div>
      ${p.url ? `<a class="learn-card-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(t("learn_open_post"))}</a>` : ""}
    </div>
  `;
  el.onclick = (e) => {
    if (e.target.closest("a")) return;
    select(p.id);
  };
  return el;
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = t("now_copied");
    setTimeout(() => { btn.textContent = prev; }, 1600);
  });
}

function bindSayCopy(root) {
  root.querySelectorAll("[data-copy-say]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      copyText(btn.getAttribute("data-copy-say") || "", btn);
    };
  });
}

function runStageState(r) {
  const files = r.stage_files || {};
  const steps = [
    { id: "idea", label: t("stage_idea"), keys: ["idea"] },
    { id: "brief", label: t("stage_brief"), keys: ["brief", "packet"] },
    { id: "draft", label: t("stage_draft"), keys: ["draft"] },
    { id: "review", label: t("stage_review"), keys: ["editor", "rubric"] },
    { id: "visual", label: t("stage_visual"), keys: ["pack"] },
    { id: "ship", label: t("stage_ship"), keys: ["feedback"] },
  ];
  let current = steps[0].id;
  const out = steps.map(step => {
    const done = step.keys.some(k => files[k]);
    return { ...step, done };
  });
  for (let i = 0; i < out.length; i++) {
    if (out[i].done) current = out[Math.min(i + 1, out.length - 1)].id;
    else {
      current = out[i].id;
      break;
    }
  }
  if (runIsShipped(r)) current = "ship";
  return { steps: out, current };
}

function missingForRun(r) {
  const st = runStageState(r);
  const cur = st.steps.find(s => s.id === st.current);
  if (!cur) return "";
  if (cur.id === "visual") return lang === "zh" ? "还没有页面任务 / 配图包" : "Page contract / visual pack still missing";
  if (cur.id === "draft") return lang === "zh" ? "草稿还没写完" : "Draft is incomplete";
  if (cur.id === "review") return lang === "zh" ? "还没审稿" : "Review not done";
  if (cur.id === "brief") return lang === "zh" ? "简报还没定" : "Brief not locked";
  if (cur.id === "ship") return lang === "zh" ? "还没记录发布反馈" : "Publish feedback not recorded";
  return cur.label;
}

function unusedTopics() {
  return nodesOf("topic")
    .filter(tp => !tp.usage || tp.usage === "unused")
    .sort((a, b) => Number(b.craft || b.total || 0) - Number(a.craft || a.total || 0));
}

function readyRuns() {
  return unshippedRuns().filter(r => {
    const files = r.stage_files || {};
    return !!(files.pack || files.rubric || files.editor);
  });
}

function writingRuns() {
  const readyIds = new Set(readyRuns().map(r => r.id));
  return unshippedRuns().filter(r => !readyIds.has(r.id));
}

function sayCardHtml({ kicker, title, meta, say, stagesHtml = "", extra = "" }) {
  return `<div class="say-card">
    <p class="say-kicker">${esc(kicker)}</p>
    <h1 class="say-title">${esc(title)}</h1>
    ${meta ? `<p class="say-meta">${esc(meta)}</p>` : ""}
    ${stagesHtml}
    <p class="now-say-label">${esc(t("now_say_label"))}</p>
    <div class="say-box">
      <code>${esc(say)}</code>
      <button type="button" data-copy-say="${esc(say)}">${t("now_copy")}</button>
    </div>
    ${extra}
  </div>`;
}

function nowFocusHtml({ mode, badge, title, why, meta, say, stagesHtml = "", extra = "" }) {
  return `<section class="now-focus mode-${esc(mode)}">
    <div class="now-focus-bar">
      <div class="now-badge"><span class="dot"></span>${esc(badge)}</div>
      ${extra ? `<div class="now-focus-action">${extra}</div>` : ""}
    </div>
    <h2 class="say-title">${esc(title)}</h2>
    ${why ? `<p class="now-why">${esc(why)}</p>` : ""}
    ${meta ? `<p class="say-meta">${esc(meta)}</p>` : ""}
    ${stagesHtml}
    <div class="now-say-block">
      <span class="now-say-label">${esc(t("now_say_label"))}</span>
      <div class="say-box">
        <code>${esc(say)}</code>
        <button type="button" data-copy-say="${esc(say)}">${t("now_copy")}</button>
      </div>
    </div>
  </section>`;
}

function nowDateLabel() {
  const d = new Date();
  if (lang === "zh") {
    const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`;
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function renderOverview() {
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "now-desk";

  const active = writingRuns();
  const ready = readyRuns();
  const focusRun = active[0] || ready[0];
  const ideas = unusedTopics();
  const needs = nodesOf("need");
  const unknownPub = nodesOf("published").filter(p => {
    const tier = (p.evidence_tier || "").toLowerCase();
    const result = (p.result || "").toLowerCase();
    return !tier || tier === "unknown" || result === "unknown" || !result;
  });

  let focusHtml = "";
  if (focusRun) {
    const missing = missingForRun(focusRun);
    focusHtml = nowFocusHtml({
      mode: "write",
      badge: t("now_writing"),
      title: focusRun.label || focusRun.one_liner || focusRun.ident,
      why: t("now_why_write"),
      meta: `${focusRun.ident} · ${focusRun.primary_platform || focusRun.platforms || ""} · ${t("now_missing")}: ${missing}`,
      say: fillTemplate("say_continue_run", { id: focusRun.ident }),
      stagesHtml: stageRailHtml(focusRun),
      extra: `<button type="button" class="ghost-link" data-open-run="${esc(focusRun.id)}">${t("now_open_run")} →</button>`,
    });
  } else if (ideas.length) {
    const tp = ideas[0];
    focusHtml = nowFocusHtml({
      mode: "decide",
      badge: t("now_decide"),
      title: tp.label || tp.ident,
      why: t("now_why_decide"),
      meta: [
        tp.ident,
        tp.pillar ? formatPillar(tp.pillar) : "",
        tp.generation_mode || "",
        tp.need_ids && tp.need_ids !== "none" ? tp.need_ids : "",
      ].filter(Boolean).join(" · "),
      say: fillTemplate("say_open_run", { id: tp.ident }),
      extra: `<button type="button" class="ghost-link" data-goto="select">${t("now_goto_select")} →</button>`,
    });
  } else if (unknownPub.length) {
    const p = unknownPub[0];
    focusHtml = nowFocusHtml({
      mode: "review",
      badge: t("now_review"),
      title: p.label || p.url || p.ident,
      why: t("now_why_review"),
      meta: `${p.date || ""} · ${p.platform || ""} · ${evidenceLabel(p.evidence_tier || "unknown")}`,
      say: fillTemplate("say_review", { url: p.url || p.label || p.ident }),
      extra: `<button type="button" class="ghost-link" data-goto="shipped">${t("now_goto_learn")} →</button>`,
    });
  } else if (needs.length < 3) {
    focusHtml = nowFocusHtml({
      mode: "start",
      badge: t("now_start"),
      title: needs.length
        ? (lang === "zh" ? `已有 ${needs.length} 条听众原话` : `${needs.length} audience quotes so far`)
        : (lang === "zh" ? "还没有开始" : "Nothing started yet"),
      why: t("now_why_start"),
      meta: needs.length
        ? (lang === "zh" ? "再补几条原话，选题会更稳。" : "A few more quotes will make topics credible.")
        : (lang === "zh" ? "先采访自己，再收集听众原话。" : "Interview yourself, then collect audience language."),
      say: needs.length ? t("say_needs") : t("say_interview"),
      extra: `<button type="button" class="ghost-link" data-goto="base">${t("now_goto_base")} →</button>`,
    });
  } else {
    focusHtml = nowFocusHtml({
      mode: "decide",
      badge: t("now_decide"),
      title: lang === "zh" ? "有原话，还没有选题" : "Quotes exist — no topic yet",
      why: t("now_why_topics"),
      meta: lang === "zh" ? `听众原话 ${needs.length} 条` : `${needs.length} audience quotes`,
      say: t("say_topics"),
      extra: `<button type="button" class="ghost-link" data-goto="select">${t("now_goto_select")} →</button>`,
    });
  }

  const topicN = ideas.length;
  const writingN = unshippedRuns().length;
  const reviewN = unknownPub.length;

  wrap.innerHTML = `
    <div class="now-top">
      <div>
        <p class="now-greeting">${esc(t("now_greeting"))}</p>
        <p class="now-date">${esc(nowDateLabel())}</p>
      </div>
      <div class="now-pulse" aria-label="pipeline pulse">
        <button type="button" class="now-pulse-chip" data-goto="select"><b>${topicN}</b><span>${esc(t("now_pulse_topics"))}</span></button>
        <button type="button" class="now-pulse-chip" data-goto="content"><b>${writingN}</b><span>${esc(t("now_pulse_writing"))}</span></button>
        <button type="button" class="now-pulse-chip" data-goto="shipped"><b>${reviewN}</b><span>${esc(t("now_pulse_review"))}</span></button>
      </div>
    </div>
    ${focusHtml}
    <div class="now-goto now-map">
      <div class="now-map-head">
        <div class="now-map-head-row">
          <p class="now-goto-label">${esc(t("now_goto"))}</p>
          <span class="now-map-subbadge">${esc(t("now_map_subbadge"))}</span>
        </div>
        <p class="now-map-hint">${esc(t("now_goto_hint"))}</p>
      </div>
      <div class="now-map-flow">
        <button type="button" class="now-door tone-select" data-goto="select">
          <div class="now-door-top">
            <span class="now-door-step"><span class="step-dot"></span>01 · ${esc(t("now_goto_select"))}</span>
            <span class="now-door-count"><b>${topicN}</b><small>${esc(t("now_pulse_topics"))}</small></span>
          </div>
          <p class="now-door-title">${esc(t("now_goto_select"))}</p>
          <p class="now-door-role">${esc(t("now_door_select_role"))}</p>
          <div class="now-door-foot"><span>${esc(t("hub_open"))} →</span></div>
        </button>
        <div class="now-map-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </div>
        <button type="button" class="now-door tone-produce" data-goto="content">
          <div class="now-door-top">
            <span class="now-door-step"><span class="step-dot"></span>02 · ${esc(t("now_goto_produce"))}</span>
            <span class="now-door-count"><b>${writingN}</b><small>${esc(t("now_pulse_writing"))}</small></span>
          </div>
          <p class="now-door-title">${esc(t("now_goto_produce"))}</p>
          <p class="now-door-role">${esc(t("now_door_produce_role"))}</p>
          <div class="now-door-foot"><span>${esc(t("hub_open"))} →</span></div>
        </button>
        <div class="now-map-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </div>
        <button type="button" class="now-door tone-learn" data-goto="shipped">
          <div class="now-door-top">
            <span class="now-door-step"><span class="step-dot"></span>03 · ${esc(t("now_goto_learn"))}</span>
            <span class="now-door-count"><b>${reviewN}</b><small>${esc(t("now_pulse_review"))}</small></span>
          </div>
          <p class="now-door-title">${esc(t("now_goto_learn"))}</p>
          <p class="now-door-role">${esc(t("now_door_learn_role"))}</p>
          <div class="now-door-foot"><span>${esc(t("hub_open"))} →</span></div>
        </button>
      </div>
      <div class="now-map-bridge" aria-hidden="true">
        <span class="now-bridge-badge">${esc(t("now_bridge_badge"))}</span>
      </div>
      <button type="button" class="now-door now-door-base tone-base" data-goto="base">
        <div class="now-door-base-copy">
          <span class="now-door-step"><span class="step-dot"></span>00 · ${esc(t("now_goto_base"))}</span>
          <p class="now-door-title">${esc(t("now_door_base_title"))}</p>
          <p class="now-door-role">${esc(t("now_door_base_role"))}</p>
        </div>
        <div class="now-door-base-side">
          <div class="now-door-base-pills">
            <span class="base-pill-tag">${esc(t("hub_base_group_audience"))}</span>
            <span class="base-pill-tag">${esc(t("hub_base_group_belief"))}</span>
            <span class="base-pill-tag">${esc(t("hub_base_group_craft"))}</span>
            <span class="base-pill-tag">${esc(t("hub_base_group_offer"))}</span>
          </div>
          <span class="now-door-base-mark">${esc(t("hub_open"))} →</span>
        </div>
      </button>
    </div>
  `;

  $list.appendChild(wrap);
  bindSayCopy(wrap);
  wrap.querySelectorAll("[data-open-run]").forEach(btn => {
    btn.onclick = () => {
      const node = byId[btn.getAttribute("data-open-run")];
      if (node) openRun(node);
    };
  });
  wrap.querySelectorAll("[data-goto]").forEach(btn => {
    btn.onclick = () => jumpToView(btn.getAttribute("data-goto"));
  });
}

function stageRailHtml(r) {
  const st = runStageState(r);
  return `<div class="stage-rail">${st.steps.map(s => {
    const cls = s.id === st.current ? "now" : (s.done ? "done" : "");
    return `<span class="stage-pill ${cls}">${esc(s.label)}</span>`;
  }).join("")}</div>`;
}

function hubCard(c) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hub-card";
  el.innerHTML = `
    <div class="hub-card-top">
      <span class="hub-card-icon">${c.icon}</span>
      ${c.hideCount ? "" : `<span class="hub-card-count">${countForView(c.view)}</span>`}
    </div>
    <p class="hub-card-title">${esc(t(c.title))}</p>
    <p class="hub-card-desc">${esc(t(c.desc))}</p>
    <span class="hub-card-cta">${esc(t("hub_open"))} →</span>
  `;
  el.onclick = () => jumpToView(c.view);
  return el;
}

function renderHub(titleKey, descKey, cards) {
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "hub-page";
  wrap.innerHTML = `
    <div class="hub-hero">
      <p class="hub-kicker">${esc(t(titleKey))}</p>
      <h1 class="hub-title">${esc(t(titleKey))}</h1>
      <p class="hub-desc">${esc(t(descKey))}</p>
    </div>
    <div class="hub-grid" id="hubGrid"></div>
  `;
  $list.appendChild(wrap);
  const grid = wrap.querySelector("#hubGrid");
  cards.forEach(c => grid.appendChild(hubCard(c)));
}

function renderSelectHub() {
  renderTopics();
}

function appendBaseShelf(grid, shelf) {
  const card = document.createElement("div");
  card.className = "asset-shelf-card";
  card.innerHTML = `
    <div class="asset-shelf-top">
      <div class="asset-shelf-info">
        <p class="asset-shelf-name">${esc(t(shelf.title))}</p>
        <p class="asset-shelf-desc">${esc(t(shelf.desc))}</p>
      </div>
      <div class="asset-shelf-actions">
        <span class="asset-shelf-badge">${shelf.items.length}</span>
        <button type="button" class="asset-shelf-open" data-open-view="${esc(shelf.view)}">${esc(t("hub_base_open"))} →</button>
      </div>
    </div>
  `;
  if (!shelf.items.length) {
    card.insertAdjacentHTML("beforeend", `<div class="asset-shelf-empty">${esc(t(shelf.empty))}</div>`);
  } else {
    const list = document.createElement("div");
    list.className = "asset-preview-list";
    shelf.items.slice(0, 3).forEach(n => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "asset-preview-item";
      const label = n.quote || n.excerpt || n.label || n.one_liner || n.caption || n.ident || n.id;
      const ident = n.ident || n.id || "";
      btn.innerHTML = `
        <span class="asset-item-tag">${esc(ident)}</span>
        <span class="asset-item-text" title="${esc(label)}">${esc(label)}</span>
        <span class="asset-item-arrow">→</span>
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        if (n.kind === "media" || String(n.id || "").startsWith("media:")) {
          selected = n.id || `media:${n.ident}`;
          jumpToView("media");
          return;
        }
        select(n.id);
      };
      list.appendChild(btn);
    });
    card.appendChild(list);
  }
  card.querySelector("[data-open-view]").onclick = () => jumpToView(shelf.view);
  grid.appendChild(card);
}

function renderBaseAssets(host) {
  const wikiItems = nodesOf("wiki");
  const noteItems = nodesOf("capture");
  const libItems = GRAPH.nodes.filter(n => n.lib && inScope(n));
  const productItems = nodesOf("product");
  const recItems = nodesOf("recommendation");
  const hitItems = nodesOf("hit").filter(h => h.status === "triage");
  const hitPool = hitItems.length ? hitItems : nodesOf("hit");
  const needItems = nodesOf("need").filter(n => !n.status || n.status === "captured");
  const needPool = needItems.length ? needItems : nodesOf("need");

  const sections = [
    {
      q: "hub_base_group_audience",
      why: "hub_base_group_audience_why",
      kicker: "hub_base_kicker_audience",
      shelves: [
        { view: "hits", title: "card_hits_title", desc: "card_hits_desc", items: hitPool, empty: "hub_base_empty_hits" },
        { view: "needs", title: "card_needs_title", desc: "card_needs_desc", items: needPool, empty: "hub_base_empty_needs" },
      ],
    },
    {
      q: "hub_base_group_belief",
      why: "hub_base_group_belief_why",
      kicker: "hub_base_kicker_belief",
      shelves: [
        { view: "wiki", title: "card_wiki_title", desc: "card_wiki_desc", items: wikiItems, empty: "hub_base_empty_wiki" },
        { view: "notes", title: "card_notes_title", desc: "card_notes_desc", items: noteItems, empty: "hub_base_empty_notes" },
      ],
    },
    {
      q: "hub_base_group_craft",
      why: "hub_base_group_craft_why",
      kicker: "hub_base_kicker_craft",
      shelves: [
        { view: "library", title: "card_library_title", desc: "card_library_desc", items: libItems, empty: "hub_base_empty_library" },
      ],
    },
    {
      q: "hub_base_group_offer",
      why: "hub_base_group_offer_why",
      kicker: "hub_base_kicker_offer",
      shelves: [
        { view: "products", title: "card_products_title", desc: "card_products_desc", items: productItems, empty: "hub_base_empty_products" },
        { view: "recommendations", title: "card_recs_title", desc: "card_recs_desc", items: recItems, empty: "hub_base_empty_recs" },
      ],
    },
  ];

  sections.forEach((sec) => {
    const section = document.createElement("section");
    section.className = "base-group";
    section.innerHTML = `
      <div class="base-group-head">
        <div class="base-group-left">
          <span class="base-group-kicker">${esc(t(sec.kicker))}</span>
          <h2 class="base-group-title">${esc(t(sec.q))}</h2>
        </div>
        <p class="base-group-why">${esc(t(sec.why))}</p>
      </div>
    `;
    const grid = document.createElement("div");
    grid.className = "base-shelf-grid";
    sec.shelves.forEach(shelf => appendBaseShelf(grid, shelf));
    section.appendChild(grid);
    host.appendChild(section);
  });
}

function renderBaseHub() {
  stopWikiGraphAnim();
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "hub-page";
  wrap.innerHTML = `
    <div class="hub-hero">
      <p class="hub-kicker">${esc(t("hub_base_title"))}</p>
      <h1 class="hub-title">${esc(t("hub_base_title"))}</h1>
      <p class="hub-desc">${esc(t("hub_base_desc"))}</p>
    </div>
  `;
  $list.appendChild(wrap);

  const tabs = document.createElement("div");
  tabs.className = "subtabs";
  tabs.style.marginBottom = "14px";
  tabs.innerHTML = `
    <button type="button" data-base-tab="assets">${esc(t("hub_base_tab_assets"))}</button>
    <button type="button" data-base-tab="graph">${esc(t("hub_base_tab_graph"))}</button>
  `;
  $list.appendChild(tabs);
  tabs.querySelectorAll("button").forEach(b => {
    b.classList.toggle("on", b.dataset.baseTab === baseTab);
    b.onclick = () => {
      baseTab = b.dataset.baseTab;
      renderBaseHub();
      renderInsp();
    };
  });

  if (baseTab === "graph") {
    renderWikiGraphSurface();
    return;
  }
  const host = document.createElement("div");
  host.id = "baseGroups";
  $list.appendChild(host);
  renderBaseAssets(host);
}

function pipeCard(n, stageLabel) {
  const el = document.createElement("div");
  el.className = "pipe-card";
  const plat = n.primary_platform || n.platforms || n.platform || "";
  el.innerHTML = `
    <div class="pipe-stage">${esc(stageLabel)}</div>
    <div>
      <p class="pipe-title">${esc(n.label || n.one_liner || n.ident)}</p>
      <p class="pipe-meta">${esc([n.ident, plat, n.status || ""].filter(Boolean).join(" · "))}</p>
    </div>
    <div class="pipe-go">→</div>
  `;
  el.onclick = () => {
    if (n.kind === "run") openRun(n);
    else select(n.id);
  };
  return el;
}

function renderContent() {
  // Produce tab = stage chrome + Run views (calendar / kanban / heatmap / all).
  // Media & library live under 底座.
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "hub-page";
  wrap.innerHTML = `
    <div class="hub-hero">
      <p class="hub-kicker">${esc(t("hub_produce_title"))}</p>
      <h1 class="hub-title">${esc(t("hub_produce_title"))}</h1>
      <p class="hub-desc">${esc(t("hub_produce_desc"))}</p>
    </div>
  `;
  $list.appendChild(wrap);

  if (runTab === "schedule" || runTab === "cadence") runTab = "calendar";
  const sub = document.createElement("div");
  sub.className = "subtabs";
  sub.innerHTML = `
    <button data-t="calendar">${t("runs_sub_calendar")}</button>
    <button data-t="kanban">${t("runs_sub_kanban")}</button>
    <button data-t="heatmap">${t("runs_sub_heatmap")}</button>
    <button data-t="all">${t("runs_sub_all")}</button>
  `;
  $list.appendChild(sub);
  sub.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.t === runTab));
  sub.onclick = (e) => {
    const tname = e.target.dataset.t;
    if (!tname) return;
    runTab = tname;
    view = "content";
    refreshRunSurface();
  };

  if (runTab === "calendar") {
    renderRunCalendar();
  } else if (runTab === "kanban") {
    renderRunKanban();
  } else if (runTab === "heatmap") {
    renderRunHeatmap();
  } else {
    renderRunAll();
  }
}

function renderShipped() {
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "hub-page";
  const published = nodesOf("published")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  wrap.innerHTML = `
    <div class="hub-hero">
      <p class="hub-kicker">${t("hub_learn_title")}</p>
      <h1 class="hub-title">${t("hub_learn_title")}</h1>
      <p class="hub-desc">${t("hub_learn_desc")}</p>
    </div>
    <div class="learn-summary" id="learnSummary"></div>
    <div class="learn-list" id="shippedList"></div>
  `;
  $list.appendChild(wrap);
  const list = wrap.querySelector("#shippedList");
  const summary = wrap.querySelector("#learnSummary");
  if (!published.length) {
    summary.hidden = true;
    list.innerHTML = `<div class="desk-empty">${sayCardHtml({
      kicker: t("shipped"),
      title: lang === "zh" ? "还没有发布记录" : "No published posts yet",
      meta: lang === "zh" ? "发出去之后，把链接和反馈告诉 Agent。" : "After you publish, give the Agent the URL and feedback.",
      say: fillTemplate("say_review", { url: "https://" }),
    })}</div>`;
    bindSayCopy(list);
    return;
  }
  const reviewN = published.filter(p => pubResult(p) === "unknown").length;
  const knownN = published.length - reviewN;
  summary.innerHTML = `
    <span class="learn-summary-chip"><b>${published.length}</b>${esc(t("learn_summary_total"))}</span>
    <span class="learn-summary-chip tone-warn"><b>${reviewN}</b>${esc(t("learn_summary_review"))}</span>
    <span class="learn-summary-chip tone-ok"><b>${knownN}</b>${esc(t("learn_summary_known"))}</span>
  `;
  published.forEach(p => list.appendChild(learnCardEl(p)));
}

function renderSearchResults(q) {
  $list.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "hub-page";
  const qq = q.toLowerCase();
  const hits = GRAPH.nodes.filter(n => {
    const blob = [n.ident, n.label, n.one_liner, n.caption, n.url, n.kind, n.platform, n.platforms, n.topic_id, n.status]
      .filter(Boolean).join(" ").toLowerCase();
    return blob.includes(qq);
  }).slice(0, 40);
  wrap.innerHTML = `
    <div class="hub-hero">
      <p class="hub-kicker">${t("find")}</p>
      <h1 class="hub-title">${t("search_results")}</h1>
      <p class="hub-desc">${esc(q)}</p>
    </div>
    <div class="learn-list" id="searchList"></div>
  `;
  $list.appendChild(wrap);
  const list = wrap.querySelector("#searchList");
  if (!hits.length) {
    list.innerHTML = `<div class="panel-empty">${t("search_empty")}</div>`;
    return;
  }
  hits.forEach(n => {
    const item = document.createElement("div");
    item.className = "next-item";
    item.innerHTML = `
      <div class="next-item-main">
        <p class="next-item-title">${esc(n.label || n.ident)}</p>
        <p class="next-item-meta">${esc(kindName(n.kind))} · ${esc(n.ident)}</p>
      </div>
      <div class="next-item-action">→</div>
    `;
    item.onclick = () => {
      if (n.kind === "run") openRun(n);
      else select(n.id);
    };
    list.appendChild(item);
  });
}

function chipRow(label, opts, current, onPick) {
  const row = document.createElement("div");
  row.className = "filt-row";
  const lab = document.createElement("span");
  lab.className = "filt-lab";
  lab.textContent = label;
  row.appendChild(lab);
  const tabs = document.createElement("div");
  tabs.className = "subtabs";
  [{ id: "", label: t("f_all") }, ...opts].forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.label;
    if ((o.id || "") === (current || "")) b.classList.add("on");
    b.onclick = () => onPick(o.id);
    tabs.appendChild(b);
  });
  row.appendChild(tabs);
  return row;
}

function filterBar(html, onReady) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  wrap.className = "filters";
  $list.appendChild(wrap);
  onReady(wrap);
}

function topicMeta(x) {
  const bits = [
    formatPillar(x.pillar),
    x.generation_mode,
    x.source_type,
  ].filter(Boolean);
  return bits.join(" · ");
}

function topicCardEl(x) {
  const el = document.createElement("div");
  const isOpen = x.usage === "promoted";
  const isWait = !isOpen;
  el.className = "topic-card"
    + (isOpen ? " is-open" : " is-wait")
    + (selected === x.id ? " sel" : "");
  const score = x.fit ? `${x.craft}/${x.fit}` : (x.craft || x.total || "—");
  const usageLabel = isOpen ? t("st_topic_promoted") : t("st_topic_unused");
  const hint = isOpen ? t("topic_hint_open") : t("topic_hint_wait");
  const tags = [
    x.status ? `<span class="pill">${esc(x.status)}</span>` : "",
    x.need_ids && x.need_ids !== "none" ? `<span class="pill">${esc(x.need_ids)}</span>` : "",
  ].filter(Boolean).join("");
  el.innerHTML = `
    <div>
      <p class="decision-card-kicker">${esc(x.ident)}</p>
      <p class="topic-card-title">${esc(x.label || x.one_liner || x.ident)}</p>
      <p class="topic-card-meta">${esc(topicMeta(x))}</p>
      ${tags ? `<div class="topic-card-tags">${tags}</div>` : ""}
      <p class="topic-card-hint">${esc(hint)}</p>
    </div>
    <div class="topic-card-side">
      <span class="topic-badge ${isOpen ? "open" : "wait"}"><span class="dot"></span>${esc(usageLabel)}</span>
      <span class="topic-card-score">${esc(score)}</span>
    </div>
  `;
  el.onclick = () => select(x.id);
  return el;
}

function renderTopics() {
  $list.innerHTML = "";
  if (topicSrc && !TOPIC_SOURCES.includes(topicSrc)) topicSrc = "";

  $list.insertAdjacentHTML("beforeend",
    `<p class="lead">${esc(t("hub_select_title"))}</p><p class="lede">${esc(t("hub_select_desc"))}</p>`);

  const usageRow = document.createElement("div");
  usageRow.className = "filt";
  usageRow.appendChild(chipRow(t("f_use"), [
    { id: "unused", label: t("st_topic_unused") },
    { id: "promoted", label: t("st_topic_promoted") },
  ], topicUsage, (id) => {
    topicUsage = id;
    renderTopics();
    renderInsp();
  }));
  $list.appendChild(usageRow);

  const statuses = [...new Set(nodesOf("topic").map(x => x.status).filter(Boolean))];
  filterBar(
    `<select id="f-st"><option value="">${t("f_status")}</option>${statuses.map(s => `<option value="${s}" ${s === topicStatus ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
     <select id="f-p"><option value="">${t("f_pillar")}</option>${pillarIds().map(id => `<option value="${id}" ${id === topicPillar ? "selected" : ""}>${esc(formatPillar(id))}</option>`).join("")}</select>
     <select id="f-src"><option value="">${t("f_src")}</option>${TOPIC_SOURCES.map(s => `<option value="${s}" ${s === topicSrc ? "selected" : ""}>${s}</option>`).join("")}</select>`,
    (w) => {
      const st = w.querySelector("#f-st");
      const pill = w.querySelector("#f-p");
      const src = w.querySelector("#f-src");
      const paint = () => {
        topicStatus = st.value;
        topicPillar = pill.value;
        topicSrc = src.value;
        [...$list.querySelectorAll(".topic-board")].forEach(n => n.remove());
        const board = document.createElement("div");
        board.className = "topic-board";
        let rows = nodesOf("topic").filter(qmatch).sort((a, b) => {
          const ua = a.usage === "promoted" ? 1 : 0;
          const ub = b.usage === "promoted" ? 1 : 0;
          if (ua !== ub) return ua - ub;
          return Number(b.craft || b.total) - Number(a.craft || a.total);
        });
        if (topicStatus) rows = rows.filter(x => x.status === topicStatus);
        if (topicPillar) rows = rows.filter(x => (x.pillar || "").includes(topicPillar));
        if (topicSrc) rows = rows.filter(x => x.source_type === topicSrc);
        if (topicUsage) rows = rows.filter(x => x.usage === topicUsage);
        rows.forEach(x => board.appendChild(topicCardEl(x)));
        if (!rows.length) board.innerHTML = `<p class='empty'>${t("no_topic")}</p>`;
        $list.appendChild(board);
      };
      w.querySelectorAll("select").forEach(s => s.onchange = paint);
      paint();
    }
  );
}

function topicIdOf(n) {
  if (n.topic_id) return n.topic_id;
  if (n.kind === "published" && n.run_id) {
    return byId[`run:${n.run_id}`]?.topic_id || "";
  }
  return "";
}

function topicSelectHtml(nodes, current) {
  const ids = [...new Set(nodes.map(topicIdOf).filter(Boolean))].sort();
  const hasNone = nodes.some(n => !topicIdOf(n));
  const opts = [
    `<option value="">${t("f_run_topic")} · ${t("f_all")}</option>`,
    ...ids.map(id => {
      const n = nodes.filter(x => topicIdOf(x) === id).length;
      return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(t("f_run_topic_n", { id, n }))}</option>`;
    }),
  ];
  if (hasNone) {
    opts.push(`<option value="__none__" ${current === "__none__" ? "selected" : ""}>${esc(t("f_run_no_topic"))}</option>`);
  }
  return `<select id="f-topic" aria-label="${esc(t("f_run_topic"))}">${opts.join("")}</select>`;
}

function parseDateParts(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

function getWeekKey(s) {
  const p = parseDateParts(s);
  if (!p) return { key: "unknown", label: "未知周", year: 0, weekNo: 0 };
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

  const target = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const day = target.getUTCDay() || 7;
  const mon = new Date(target);
  mon.setUTCDate(target.getUTCDate() - day + 1);
  const sun = new Date(target);
  sun.setUTCDate(target.getUTCDate() - day + 7);
  const monStr = `${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`;
  const sunStr = `${String(sun.getUTCMonth() + 1).padStart(2, '0')}-${String(sun.getUTCDate()).padStart(2, '0')}`;

  const yr = date.getUTCFullYear();
  return {
    key: `${yr}-W${String(weekNo).padStart(2, '0')}`,
    label: `${yr}年 第${weekNo}周 (${monStr} ~ ${sunStr})`,
    year: yr,
    weekNo: weekNo
  };
}

function getMonthKey(s) {
  const p = parseDateParts(s);
  if (!p) return "未知月";
  return `${p.y}-${String(p.m).padStart(2, '0')}`;
}

function formatFriendlyDate(s, currentLang) {
  const p = parseDateParts(s);
  if (!p) return s || "";
  const d = new Date(p.y, p.m - 1, p.d);
  const wDays = currentLang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wDay = wDays[d.getDay()];
  if (currentLang === "zh") {
    return `${p.m}月${p.d}日 ${wDay}`;
  }
  return `${p.m}/${p.d} ${wDay}`;
}

function getDiffDaysFromToday(s) {
  const p = parseDateParts(s);
  if (!p) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(p.y, p.m - 1, p.d);
  return Math.round((targetUtc - todayUtc) / (24 * 3600 * 1000));
}

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getPostStatusInfo(item, todayStr) {
  if (!todayStr) todayStr = getTodayStr();
  const isShipped = item.kind === "published" || item.is_published || item.status === "published";
  const res = item.result || item.published_result || "";

  if (isShipped) {
    if (res && res !== "unknown") {
      return {
        code: "reviewed",
        label: t("status_reviewed"),
        color: "#164673",
        bg: "#e8f1f8",
        border: "#bad5ec",
        dot: "🔵",
        badgeClass: "tag-reviewed"
      };
    }
    return {
      code: "published",
      label: t("status_published"),
      color: "#20572b",
      bg: "#eaf3ec",
      border: "#b7d8be",
      dot: "🟢",
      badgeClass: "tag-shipped"
    };
  }

  const schedDate = item.scheduled_date || (item.status === "scheduled" ? item.date : "");
  if (schedDate) {
    if (schedDate < todayStr) {
      return {
        code: "overdue",
        label: t("status_overdue"),
        color: "#9e2319",
        bg: "#fdeeed",
        border: "#f5c4c0",
        dot: "🔴",
        badgeClass: "tag-overdue"
      };
    }
    return {
      code: "scheduled",
      label: t("status_scheduled"),
      color: "#8a4f00",
      bg: "#fcf3e3",
      border: "#f1d8ab",
      dot: "🟠",
      badgeClass: "tag-sched"
    };
  }

  return {
    code: "draft",
    label: t("status_draft"),
    color: "#5c5549",
    bg: "#f0ebd9",
    border: "#d5cbb8",
    dot: "⚪",
    badgeClass: "tag-draft"
  };
}

function findRunNode(runId) {
  if (!runId) return null;
  if (byId[runId]) return byId[runId];
  if (byId["run:" + runId]) return byId["run:" + runId];
  const cleaned = runId.replace(/^run:/, "");
  return GRAPH.nodes.find(n => n.kind === "run" && (n.ident === cleaned || n.id === runId || n.id === "run:" + cleaned));
}

function getUnifiedCalendarItems() {
  const runs = nodesOf("run").filter(qmatch);
  const pubs = nodesOf("published").filter(qmatch);
  const items = [];
  const handledRunIds = new Set();
  const handledUrls = new Set();

  pubs.forEach(p => {
    const runId = p.run_id || "";
    const runNode = findRunNode(runId);
    if (runId) {
      const raw = runId.replace(/^run:/, "");
      handledRunIds.add(runId);
      handledRunIds.add(raw);
      handledRunIds.add("run:" + raw);
    }
    if (runNode) {
      handledRunIds.add(runNode.id);
      if (runNode.ident) handledRunIds.add(runNode.ident);
      if (runNode.published_url) handledUrls.add(runNode.published_url.trim());
    }
    if (p.url) handledUrls.add(p.url.trim());

    const dateStr = p.date || (runNode ? (runNode.published_date || runNode.date) : "") || "";
    const plat = (p.platform || (runNode ? runPlatform(runNode) : "") || "x").toLowerCase();
    const displayLabel = (runNode && runNode.label) ? runNode.label : (p.notes || p.ident || "已发帖");

    items.push({
      id: p.id,
      run_id: runNode ? runNode.id : (runId ? ("run:" + runId.replace(/^run:/, "")) : p.id),
      is_published: true,
      status: "published",
      result: p.result || (runNode ? runNode.published_result : "") || "unknown",
      date: dateStr,
      scheduled_date: "",
      platform: plat,
      label: displayLabel,
      url: p.url || (runNode ? runNode.published_url : ""),
      notes: p.notes || (runNode ? runNode.notes : "") || "",
      topic_id: p.topic_id || (runNode ? runNode.topic_id : ""),
      pillar: p.pillar || (runNode ? runNode.pillar : ""),
      profile: p.profile || (runNode ? (runNode.profile || runNode.account) : ""),
      raw: p,
      run_node: runNode
    });
  });

  runs.forEach(r => {
    const isPub = r.is_published || r.status === "published";
    if (handledRunIds.has(r.id) || (r.ident && handledRunIds.has(r.ident))) {
      return;
    }
    if (r.published_url && handledUrls.has(r.published_url.trim())) {
      return;
    }
    if (r.ship_urls && r.ship_urls.some(u => handledUrls.has(u.trim()))) {
      return;
    }

    const plat = (runPlatform(r) || "x").toLowerCase();
    const dateStr = (isPub ? (r.published_date || r.date) : (r.scheduled_date || r.date)) || "";

    items.push({
      id: r.id,
      run_id: r.id,
      is_published: isPub,
      status: r.status || (r.is_scheduled ? "scheduled" : "open"),
      result: r.published_result || "",
      date: dateStr,
      scheduled_date: r.scheduled_date || (r.status === "scheduled" ? r.date : ""),
      platform: plat,
      label: r.label || r.ident || "Run",
      url: r.published_url || "",
      notes: r.notes || "",
      topic_id: r.topic_id || "",
      pillar: r.pillar || "",
      profile: r.profile || r.account || "",
      raw: r,
      run_node: r
    });
  });

  return items;
}

function calculatePublishingStreaks(shippedDates, todayStr) {
  const sortedDates = Array.from(shippedDates).filter(Boolean).sort();
  let maxStreak = 0;
  let curRunningStreak = 0;
  let prevDate = null;

  sortedDates.forEach(dStr => {
    if (!prevDate) {
      curRunningStreak = 1;
    } else {
      const p1 = parseDateParts(prevDate);
      const p2 = parseDateParts(dStr);
      if (p1 && p2) {
        const d1 = new Date(Date.UTC(p1.y, p1.m - 1, p1.d));
        const d2 = new Date(Date.UTC(p2.y, p2.m - 1, p2.d));
        const diffDays = Math.round((d2 - d1) / (24 * 3600 * 1000));
        if (diffDays === 1) {
          curRunningStreak += 1;
        } else if (diffDays > 1) {
          curRunningStreak = 1;
        }
      }
    }
    if (curRunningStreak > maxStreak) {
      maxStreak = curRunningStreak;
    }
    prevDate = dStr;
  });

  let currentStreak = 0;
  let checkDate = new Date();
  let checkStr = todayStr;
  if (!shippedDates.has(checkStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
    checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
  }

  while (shippedDates.has(checkStr)) {
    currentStreak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
    checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
  }

  return {
    totalActiveDays: sortedDates.length,
    maxStreak: maxStreak,
    currentStreak: currentStreak
  };
}

function renderRuns() {
  $list.innerHTML = "";
  if (runTab === "schedule" || runTab === "cadence") runTab = "calendar";

  const sub = document.createElement("div");
  sub.className = "subtabs";
  sub.innerHTML = `
    <button data-t="calendar">${t("runs_sub_calendar")}</button>
    <button data-t="kanban">${t("runs_sub_kanban")}</button>
    <button data-t="heatmap">${t("runs_sub_heatmap")}</button>
    <button data-t="all">${t("runs_sub_all")}</button>
  `;
  $list.appendChild(sub);
  sub.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.t === runTab));
  sub.onclick = (e) => {
    const tname = e.target.dataset.t;
    if (!tname) return;
    runTab = tname;
    refreshRunSurface();
  };

  if (runTab === "calendar") {
    renderRunCalendar();
  } else if (runTab === "kanban") {
    renderRunKanban();
  } else if (runTab === "heatmap") {
    renderRunHeatmap();
  } else {
    renderRunAll();
  }
}

function renderRunKanban() {
  const runs = nodesOf("run").filter(qmatch);
  const cols = [
    { id: "idea", title: t("kanban_col_idea"), icon: "💡", items: [] },
    { id: "draft", title: t("kanban_col_draft"), icon: "✍️", items: [] },
    { id: "pack", title: t("kanban_col_pack"), icon: "📦", items: [] },
    { id: "sched", title: t("kanban_col_sched"), icon: "⏰", items: [] },
    { id: "shipped", title: t("kanban_col_shipped"), icon: "✅", items: [] },
  ];

  runs.forEach(r => {
    const isShip = runIsShipped(r);
    const stages = Object.keys(r.stage_files || {});
    if (isShip) {
      cols[4].items.push(r);
    } else if (r.scheduled || r.status === "scheduled") {
      cols[3].items.push(r);
    } else if (stages.includes("pack") || r.status === "ready") {
      cols[2].items.push(r);
    } else if (stages.includes("draft") || stages.includes("editor") || r.status === "drafting") {
      cols[1].items.push(r);
    } else {
      cols[0].items.push(r);
    }
  });

  const board = document.createElement("div");
  board.className = "kanban-board";

  cols.forEach(col => {
    const colEl = document.createElement("div");
    colEl.className = "kanban-col";
    colEl.innerHTML = `
      <div class="kanban-col-head">
        <span class="kanban-col-title"><span>${col.icon}</span> <span>${esc(col.title)}</span></span>
        <span class="kanban-col-cnt">${col.items.length}</span>
      </div>
      <div class="kanban-cards"></div>
    `;
    const cardsEl = colEl.querySelector(".kanban-cards");
    if (!col.items.length) {
      cardsEl.innerHTML = `<div class="vacant" style="text-align:center;padding:24px 8px;opacity:.6;">${t("ck_kanban_empty")}</div>`;
    } else {
      col.items.forEach(r => {
        const card = document.createElement("div");
        const isSel = selected === r.id;
        card.className = "kanban-card" + (isSel ? " sel" : "");
        const plat = r.platform || r.platforms || r.primary_platform || "x";
        const pillar = r.pillar || "";
        const st = r.status || "draft";
        card.innerHTML = `
          <div class="kanban-card-head">
            <span class="plat-mark-svg" style="width:18px;height:18px;">${getPlatformSvg(plat, 13, "brand")}</span>
            <span class="kanban-card-id">${esc(r.ident)}</span>
            <span class="sched-status-tag tag-${st === "published" ? "shipped" : st === "scheduled" ? "sched" : "ready"}" style="font-size:9px;padding:1px 5px;">${esc(st)}</span>
          </div>
          <div class="kanban-card-ttl">${esc(r.one_liner || r.label || r.ident)}</div>
          <div class="kanban-card-foot">
            <span>${esc(r.date || r.scheduled || "")}</span>
            ${pillar ? `<span class="pill" style="font-size:10px;padding:1px 5px;">${esc(pillar)}</span>` : ""}
          </div>
        `;
        card.onclick = (e) => {
          e.stopPropagation();
          select(r.id);
        };
        card.ondblclick = (e) => {
          e.stopPropagation();
          selected = r.id;
          openRun(r);
        };
        cardsEl.appendChild(card);
      });
    }
    board.appendChild(colEl);
  });

  $list.appendChild(board);
}

function renderRunCalendar() {
  const allItems = getUnifiedCalendarItems();
  const todayStr = getTodayStr();
  const currentMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const currentWeekKey = getWeekKey(todayStr).key;

  const activePlats = ["x", "xiaohongshu", "linkedin", "instagram", "threads", "tiktok"];
  const platLabels = {
    x: "𝕏 (Twitter)",
    xiaohongshu: "小红书",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    threads: "Threads",
    tiktok: "TikTok"
  };

  // 1. Cadence strip at top
  const cadenceStrip = document.createElement("div");
  cadenceStrip.className = "cal-cadence-strip";

  activePlats.forEach(p => {
    const pItems = allItems.filter(it => it.platform === p);
    const pPubs = pItems.filter(it => it.is_published || it.status === "published");
    const monthCount = pPubs.filter(it => (it.date || "").startsWith(currentMonthPrefix)).length;
    const weekCount = pPubs.filter(it => getWeekKey(it.date || "").key === currentWeekKey).length;
    const schedCount = pItems.filter(it => !it.is_published && (it.status === "scheduled" || it.scheduled_date)).length;

    const card = document.createElement("div");
    card.className = "cal-cadence-card" + (calPlatFilter === p ? " active-filter" : "");
    card.onclick = () => {
      calPlatFilter = (calPlatFilter === p ? "" : p);
      refreshRunSurface();
    };

    card.innerHTML = `
      <div class="cal-cadence-card-head">
        <div class="cal-cadence-card-name">
          ${getPlatformSvg(p, 14, "brand")}
          <span>${esc(p === "x" ? "𝕏" : platLabels[p] || p)}</span>
        </div>
        <span class="cal-cadence-card-cnt">${pPubs.length}</span>
      </div>
      <div class="cal-cadence-card-stats">
        <span>${t("cadence_month")}: <b>${monthCount}</b></span>
        <span>${t("cadence_week")}: <b>${weekCount}</b></span>
        ${schedCount > 0 ? `<span style="color:#b8741a;">${t("cadence_sched")}: <b>${schedCount}</b></span>` : ""}
      </div>
    `;
    cadenceStrip.appendChild(card);
  });

  $list.appendChild(cadenceStrip);

  let filteredItems = allItems;
  if (calPlatFilter) {
    filteredItems = filteredItems.filter(it => it.platform === calPlatFilter);
  }

  const monthItems = filteredItems.filter(it => (it.date || "").startsWith(currentMonthPrefix));
  let pubCount = 0;
  let schedCount = 0;
  let revCount = 0;
  let overdueCount = 0;

  filteredItems.forEach(it => {
    const st = getPostStatusInfo(it, todayStr);
    if (st.code === "overdue") overdueCount++;
  });

  monthItems.forEach(it => {
    const st = getPostStatusInfo(it, todayStr);
    if (st.code === "published") pubCount++;
    else if (st.code === "reviewed") revCount++;
    else if (st.code === "scheduled") schedCount++;
  });

  const calBox = document.createElement("div");
  calBox.className = "cal-container";

  const monthNamesZh = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthTitleStr = lang === "zh" ? `${calYear} 年 ${monthNamesZh[calMonth]}` : `${monthNamesEn[calMonth]} ${calYear}`;

  calBox.innerHTML = `
    <div class="cal-header">
      <div class="cal-nav">
        <button type="button" class="cal-btn-arrow" id="calPrevBtn" title="${esc(t("cal_prev_month"))}">‹</button>
        <div class="cal-title">${esc(monthTitleStr)}</div>
        <button type="button" class="cal-btn-arrow" id="calNextBtn" title="${esc(t("cal_next_month"))}">›</button>
        <button type="button" class="cal-btn-today" id="calTodayBtn">${esc(t("cal_today"))}</button>
      </div>
      <div class="cal-kpis">
        <span class="cal-kpi-pill kpi-pub">🟢 ${esc(t("status_published"))} <b>${pubCount}</b></span>
        <span class="cal-kpi-pill kpi-sched">🟠 ${esc(t("status_scheduled"))} <b>${schedCount}</b></span>
        <span class="cal-kpi-pill kpi-rev">🔵 ${esc(t("status_reviewed"))} <b>${revCount}</b></span>
        ${overdueCount > 0 ? `<span class="cal-kpi-pill kpi-overdue">🔴 ${esc(t("status_overdue"))} <b>${overdueCount}</b></span>` : ""}
      </div>
    </div>

    <div class="cal-toolbar">
      <div class="cal-select-group">
        <span class="cal-select-icon" id="calPlatIcon">${getPlatformSvg(calPlatFilter, 15, "brand")}</span>
        <select id="calPlatSelect" class="cal-platform-dropdown" aria-label="${esc(t("cal_all_plats"))}">
          <option value="" ${!calPlatFilter ? "selected" : ""}>${esc(t("cal_all_plats"))}</option>
          <option value="x" ${calPlatFilter === "x" ? "selected" : ""}>X (Twitter)</option>
          <option value="xiaohongshu" ${calPlatFilter === "xiaohongshu" ? "selected" : ""}>小红书 (Xiaohongshu)</option>
          <option value="linkedin" ${calPlatFilter === "linkedin" ? "selected" : ""}>LinkedIn</option>
          <option value="instagram" ${calPlatFilter === "instagram" ? "selected" : ""}>Instagram</option>
          <option value="threads" ${calPlatFilter === "threads" ? "selected" : ""}>Threads</option>
          <option value="tiktok" ${calPlatFilter === "tiktok" ? "selected" : ""}>TikTok</option>
        </select>
      </div>
      <div class="cal-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#20572b;"></span> ${esc(t("status_published"))}</span>
        <span class="legend-item"><span class="legend-dot" style="background:#164673;"></span> ${esc(t("status_reviewed"))}</span>
        <span class="legend-item"><span class="legend-dot" style="background:#8a4f00;"></span> ${esc(t("status_scheduled"))}</span>
        <span class="legend-item"><span class="legend-dot" style="background:#9e2319;"></span> ${esc(t("status_overdue"))}</span>
        <span class="legend-item"><span class="legend-dot" style="background:#7a7263;"></span> ${esc(t("status_draft"))}</span>
      </div>
    </div>

    <div class="cal-grid" id="calGrid"></div>
  `;

  $list.appendChild(calBox);

  calBox.querySelector("#calPrevBtn").onclick = () => {
    calMonth -= 1;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    }
    refreshRunSurface();
  };
  calBox.querySelector("#calNextBtn").onclick = () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    refreshRunSurface();
  };
  calBox.querySelector("#calTodayBtn").onclick = () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    calSelectedDate = getTodayStr();
    selected = null;
    refreshRunSurface();
  };
  const platSelect = calBox.querySelector("#calPlatSelect");
  if (platSelect) {
    platSelect.onchange = (e) => {
      calPlatFilter = e.target.value;
      refreshRunSurface();
    };
  }

  const $grid = calBox.querySelector("#calGrid");
  const weekDayHeadersZh = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const weekDayHeadersEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDays = lang === "zh" ? weekDayHeadersZh : weekDayHeadersEn;

  weekDays.forEach(wd => {
    const el = document.createElement("div");
    el.className = "cal-day-name";
    el.textContent = wd;
    $grid.appendChild(el);
  });

  const itemsByDate = new Map();
  filteredItems.forEach(it => {
    if (!it.date) return;
    if (!itemsByDate.has(it.date)) itemsByDate.set(it.date, []);
    itemsByDate.get(it.date).push(it);
  });

  const firstDayOfMonth = new Date(calYear, calMonth, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
  const totalCells = (startDayOfWeek + daysInMonth > 35) ? 42 : 35;

  for (let i = 0; i < totalCells; i++) {
    let cellYear = calYear;
    let cellMonth = calMonth;
    let cellDay = 1;
    let isOtherMonth = false;

    if (i < startDayOfWeek) {
      isOtherMonth = true;
      cellMonth = calMonth - 1;
      if (cellMonth < 0) {
        cellMonth = 11;
        cellYear -= 1;
      }
      cellDay = daysInPrevMonth - (startDayOfWeek - 1 - i);
    } else if (i >= startDayOfWeek + daysInMonth) {
      isOtherMonth = true;
      cellMonth = calMonth + 1;
      if (cellMonth > 11) {
        cellMonth = 0;
        cellYear += 1;
      }
      cellDay = i - (startDayOfWeek + daysInMonth) + 1;
    } else {
      cellDay = i - startDayOfWeek + 1;
    }

    const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
    const isToday = (dateStr === todayStr);
    const isSelected = (dateStr === calSelectedDate);
    const dayItems = itemsByDate.get(dateStr) || [];

    const cell = document.createElement("div");
    cell.className = "cal-cell" + (isOtherMonth ? " other-month" : "") + (isToday ? " is-today" : "") + (isSelected ? " is-selected" : "");
    cell.onclick = () => {
      calSelectedDate = dateStr;
      selected = null;
      refreshRunSurface();
    };

    const head = document.createElement("div");
    head.className = "cal-cell-head";
    head.innerHTML = `
      <span class="cal-cell-daynum">${cellDay}</span>
      ${isToday ? `<span class="cal-cell-badge">${esc(t("cal_today"))}</span>` : ""}
      ${dayItems.length > 0 ? `<span class="cal-cell-cnt">${dayItems.length}</span>` : ""}
    `;
    cell.appendChild(head);

    const previewItems = dayItems.slice(0, 2);
    const moreCount = dayItems.length - previewItems.length;

    previewItems.forEach(item => {
      const st = getPostStatusInfo(item, todayStr);
      const pill = document.createElement("div");
      pill.className = `cal-post-pill status-${st.code}`;
      pill.title = `[${st.label}] ${item.platform.toUpperCase()} · ${item.label}${item.notes ? `\n备注: ${item.notes}` : ""}`;
      pill.onclick = (e) => {
        e.stopPropagation();
        calSelectedDate = dateStr;
        select(item.run_id || item.id);
      };
      pill.innerHTML = `
        <span class="cal-post-dot" style="background:${st.color};"></span>
        <span class="cal-post-plat">${platMarkHtml({ platform: item.platform }, 12)}</span>
        <span class="cal-post-title">${esc(item.label)}</span>
      `;
      cell.appendChild(pill);
    });

    if (moreCount > 0) {
      const morePill = document.createElement("div");
      morePill.className = "cal-more-pill";
      morePill.textContent = t("cal_more_posts", { n: moreCount });
      morePill.onclick = (e) => {
        e.stopPropagation();
        calSelectedDate = dateStr;
        selected = null;
        refreshRunSurface();
      };
      cell.appendChild(morePill);
    }

    $grid.appendChild(cell);
  }

  // 3. Upcoming Queue section below calendar
  const queueBox = document.createElement("div");
  queueBox.className = "cal-queue-box";

  const upcomingItems = filteredItems.filter(it => !it.is_published && (it.status === "scheduled" || it.scheduled_date));
  upcomingItems.sort((a, b) => (a.scheduled_date || a.date || "").localeCompare(b.scheduled_date || b.date || ""));

  let queueCardsHtml = "";
  if (upcomingItems.length === 0) {
    queueCardsHtml = `
      <div style="background:var(--paper); border:1px dashed var(--line); border-radius:10px; padding:16px 14px; text-align:center; color:var(--muted); font-size:12px;">
        <div style="font-weight:600; color:var(--sumi); margin-bottom:3px;">${esc(t("queue_empty_title"))}</div>
        <div style="font-size:11px; margin-bottom:8px;">${esc(t("queue_empty_hint"))}</div>
        <button type="button" class="ghost-link" data-md="runs/_index.md" data-md-title="runs/_index.md" style="font-size:11px;">打开 runs/_index.md</button>
      </div>
    `;
  } else {
    queueCardsHtml = upcomingItems.map(item => {
      const dt = item.scheduled_date || item.date;
      const diff = getDiffDaysFromToday(dt);
      let badgeText = dt;
      let cls = "is-soon";
      if (diff !== null && diff < 0) {
        badgeText = `🔴 逾期 ${Math.abs(diff)} 天 (${dt})`;
        cls = "is-overdue";
      } else if (diff === 0) {
        badgeText = `🟡 今天待发`;
        cls = "is-today";
      } else if (diff === 1) {
        badgeText = `明天 (${dt})`;
      } else if (diff !== null) {
        badgeText = `${diff} 天后 (${dt})`;
      }

      return `
        <div class="cal-queue-card ${cls}" data-run-id="${esc(item.run_id || item.id)}">
          <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
            <span style="font-size:11px; font-weight:700; color:var(--sumi); background:var(--bg-2); padding:2px 6px; border-radius:4px; flex-shrink:0;">${esc(badgeText)}</span>
            <span class="plat-mark-svg" style="width:18px; height:18px; flex-shrink:0;">${getPlatformSvg(item.platform, 13, "brand")}</span>
            <span style="font-size:12px; font-weight:600; color:var(--sumi); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.label)}</span>
          </div>
          <button type="button" class="ghost-link" style="font-size:11px; color:var(--accent); flex-shrink:0;">查看 →</button>
        </div>
      `;
    }).join("");
  }

  queueBox.innerHTML = `
    <div class="cal-queue-head">
      <div class="cal-queue-title">
        <span>📋 ${esc(t("queue_upcoming_title"))}</span>
        <span class="pill">${upcomingItems.length} 篇</span>
      </div>
      <button type="button" class="ghost-link" data-md="runs/_index.md" data-md-title="runs/_index.md" style="font-size:11px;">打开 runs/_index.md</button>
    </div>
    <div class="cal-queue-list">
      ${queueCardsHtml}
    </div>
  `;

  queueBox.querySelectorAll(".cal-queue-card").forEach(card => {
    card.onclick = () => {
      const rid = card.dataset.runId;
      if (rid) select(rid);
    };
  });

  $list.appendChild(queueBox);
}

function renderCalendarSidebar(dateStr) {
  if (!dateStr) dateStr = getTodayStr();
  const allItems = getUnifiedCalendarItems();
  const todayStr = getTodayStr();

  let dayItems = allItems.filter(it => it.date === dateStr);
  if (calPlatFilter) {
    dayItems = dayItems.filter(it => it.platform === calPlatFilter);
  }

  const parts = parseDateParts(dateStr);
  let dayTitle = dateStr;
  let dayRel = "";
  if (parts) {
    const d = new Date(parts.y, parts.m - 1, parts.d);
    const weekDaysZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const weekDaysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const wd = lang === "zh" ? weekDaysZh[d.getDay()] : weekDaysEn[d.getDay()];
    dayTitle = lang === "zh" ? `${parts.y} 年 ${parts.m} 月 ${parts.d} 日` : `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
    if (dateStr === todayStr) {
      dayRel = lang === "zh" ? `今天 · ${wd}` : `Today · ${wd}`;
    } else {
      dayRel = wd;
    }
  }

  let pubCount = 0;
  let schedCount = 0;
  let revCount = 0;
  let overdueCount = 0;

  dayItems.forEach(it => {
    const st = getPostStatusInfo(it, todayStr);
    if (st.code === "published") pubCount++;
    else if (st.code === "reviewed") revCount++;
    else if (st.code === "scheduled") schedCount++;
    else if (st.code === "overdue") overdueCount++;
  });

  let itemsHtml = "";
  if (dayItems.length === 0) {
    itemsHtml = `
      <div style="background:var(--paper); border:1px dashed var(--line); border-radius:12px; padding:28px 20px; text-align:center; color:var(--muted); margin-top:14px;">
        <div style="font-size:24px; margin-bottom:8px;">☕</div>
        <div style="font-weight:600; font-size:13px; color:var(--sumi); margin-bottom:4px;">${esc(t("cal_day_empty"))}</div>
        <div style="font-size:11px; color:var(--muted); line-height:1.5;">${esc(t("cal_day_empty_hint"))}</div>
      </div>
    `;
  } else {
    itemsHtml = dayItems.map(item => {
      const st = getPostStatusInfo(item, todayStr);
      const platSvg = getPlatformSvg(item.platform, 16, "brand");
      const runId = item.run_id || item.id;
      const metaParts = [
        formatPillar(item.pillar),
        item.topic_id ? `选题 ${item.topic_id}` : "",
        item.profile ? `账号 ${item.profile}` : ""
      ].filter(Boolean).join(" · ");

      return `
        <div class="cal-sidebar-card status-${st.code}" data-run-id="${esc(runId)}">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="plat-mark-svg" style="width:22px; height:22px;">${platSvg}</span>
              <span style="font-size:12px; font-weight:700; color:var(--sumi);">${esc((item.platform || "x").toUpperCase())}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="tag-status ${st.badgeClass || ''}" style="font-size:11px; padding:2px 7px; border-radius:999px; background:${st.bg}; border:1px solid ${st.border}; color:${st.color}; font-weight:600;">
                ${st.dot} ${esc(st.label)}
              </span>
              ${item.result && item.result !== "unknown" ? `<span class="tag-status" style="font-size:10px; font-weight:600; padding:1px 5px; border-radius:4px; background:var(--bg-2); border:1px solid var(--line);">${esc(item.result)}</span>` : ""}
            </div>
          </div>

          <div style="font-size:13px; font-weight:700; line-height:1.4; color:var(--sumi); margin-bottom:6px; cursor:pointer;" title="${esc(item.label)}">
            ${esc(item.label)}
          </div>

          ${metaParts ? `<div style="font-size:11px; color:var(--muted); margin-bottom:8px;">${esc(metaParts)}</div>` : ""}

          ${item.notes ? `<div style="background:var(--bg-2); border:1px solid var(--line); border-radius:6px; padding:6px 9px; font-size:11px; color:var(--text); line-height:1.4; margin-bottom:8px; word-break:break-word;">${esc(item.notes)}</div>` : ""}

          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; padding-top:6px; border-top:1px solid var(--bg-3);">
            <button type="button" class="ghost-link" data-cal-open-run="${esc(runId)}" style="font-size:11px; font-weight:600; color:var(--accent); padding:2px 0;">
              ${esc(t("cal_open_run"))} →
            </button>
            ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer" class="ghost-link" style="font-size:11px; color:var(--muted);" onclick="event.stopPropagation();">打开原帖 ↗</a>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  $insp.innerHTML = `
    <div class="cal-sidebar-box">
      <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--line);">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); margin-bottom:3px;">
          ${esc(t("cal_day_title"))}
        </div>
        <div style="font-size:18px; font-weight:800; color:var(--sumi); line-height:1.2; font-family:'Iowan Old Style','Songti SC',Georgia,serif;">
          ${esc(dayTitle)}
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px; font-size:12px; color:var(--muted);">
          ${dayRel ? `<span style="font-weight:600; color:var(--sumi);">${esc(dayRel)}</span> · ` : ""}
          <span>${t("cal_day_total", { n: dayItems.length })}</span>
        </div>
        ${dayItems.length > 0 ? `
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px;">
            ${pubCount > 0 ? `<span class="cal-kpi-pill kpi-pub" style="font-size:10px; padding:2px 7px;">🟢 ${esc(t("status_published"))} <b>${pubCount}</b></span>` : ""}
            ${schedCount > 0 ? `<span class="cal-kpi-pill kpi-sched" style="font-size:10px; padding:2px 7px;">🟠 ${esc(t("status_scheduled"))} <b>${schedCount}</b></span>` : ""}
            ${revCount > 0 ? `<span class="cal-kpi-pill kpi-rev" style="font-size:10px; padding:2px 7px;">🔵 ${esc(t("status_reviewed"))} <b>${revCount}</b></span>` : ""}
            ${overdueCount > 0 ? `<span class="cal-kpi-pill kpi-overdue" style="font-size:10px; padding:2px 7px;">🔴 ${esc(t("status_overdue"))} <b>${overdueCount}</b></span>` : ""}
          </div>
        ` : ""}
      </div>
      <div class="cal-sidebar-items">
        ${itemsHtml}
      </div>
    </div>
  `;

  $insp.querySelectorAll(".cal-sidebar-card").forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest("a, button")) return;
      const rid = card.dataset.runId;
      if (rid) select(rid);
    };
  });
  // Open Run inspector (includes "See what was used"), not the stage markdown modal.
  $insp.querySelectorAll("[data-cal-open-run]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rid = btn.getAttribute("data-cal-open-run");
      const node = findRunNode(rid) || byId[rid];
      if (node) select(node.id);
      else if (rid) select(rid);
    };
  });
}

function renderRunHeatmap() {
  const allUnified = getUnifiedCalendarItems();
  const todayStr = getTodayStr();

  let allItems = allUnified;
  if (heatmapPlatFilter) {
    allItems = allItems.filter(it => it.platform === heatmapPlatFilter);
  }

  const shippedDates = new Set();
  const itemsByDate = new Map();

  allItems.forEach(it => {
    if (!it.date) return;
    if (!itemsByDate.has(it.date)) itemsByDate.set(it.date, []);
    itemsByDate.get(it.date).push(it);

    if (it.is_published || it.status === "published") {
      shippedDates.add(it.date);
    }
  });

  const streakInfo = calculatePublishingStreaks(shippedDates, todayStr);
  const totalShipped = Array.from(allItems).filter(it => it.is_published || it.status === "published").length;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOffsetFromMonday = (dayOfWeek + 6) % 7;
  const daysToSunday = 6 - dayOffsetFromMonday;
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (52 * 7 - 1));

  const ghCard = document.createElement("div");
  ghCard.className = "gh-card";

  ghCard.innerHTML = `
    <div class="gh-header">
      <div class="gh-title">🟩 ${esc(t("gh_annual_title"))}</div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="cal-select-group">
          <span class="cal-select-icon" id="ghPlatIcon">${getPlatformSvg(heatmapPlatFilter, 15, "brand")}</span>
          <select id="ghPlatSelect" class="cal-platform-dropdown" aria-label="${esc(t("cal_all_plats"))}">
            <option value="" ${!heatmapPlatFilter ? "selected" : ""}>${esc(t("cal_all_plats"))}</option>
            <option value="x" ${heatmapPlatFilter === "x" ? "selected" : ""}>X (Twitter)</option>
            <option value="xiaohongshu" ${heatmapPlatFilter === "xiaohongshu" ? "selected" : ""}>小红书 (Xiaohongshu)</option>
            <option value="linkedin" ${heatmapPlatFilter === "linkedin" ? "selected" : ""}>LinkedIn</option>
            <option value="instagram" ${heatmapPlatFilter === "instagram" ? "selected" : ""}>Instagram</option>
            <option value="threads" ${heatmapPlatFilter === "threads" ? "selected" : ""}>Threads</option>
            <option value="tiktok" ${heatmapPlatFilter === "tiktok" ? "selected" : ""}>TikTok</option>
          </select>
        </div>
        <button type="button" class="ghost-link" data-md="published/_index.md" data-md-title="published/_index.md">打开 published/_index.md</button>
      </div>
    </div>

    <div class="gh-stats-strip">
      <div class="gh-stat-box">
        <div class="gh-stat-val">${totalShipped}</div>
        <div class="gh-stat-lab">${esc(t("gh_stat_shipped"))}</div>
      </div>
      <div class="gh-stat-box">
        <div class="gh-stat-val">${streakInfo.currentStreak} <span style="font-size:12px; font-weight:normal;">天</span></div>
        <div class="gh-stat-lab">${esc(t("gh_stat_streak_cur"))}</div>
      </div>
      <div class="gh-stat-box">
        <div class="gh-stat-val">${streakInfo.maxStreak} <span style="font-size:12px; font-weight:normal;">天</span></div>
        <div class="gh-stat-lab">${esc(t("gh_stat_streak_max"))}</div>
      </div>
      <div class="gh-stat-box">
        <div class="gh-stat-val">${streakInfo.totalActiveDays} <span style="font-size:12px; font-weight:normal;">天</span></div>
        <div class="gh-stat-lab">${esc(t("gh_stat_active_days"))}</div>
      </div>
    </div>

    <div class="gh-scroll-container" id="ghScrollContainer">
      <div class="gh-matrix-wrap">
        <div class="gh-months-row" id="ghMonthsRow"></div>
        <div class="gh-body">
          <div class="gh-days-col">
            <div class="gh-day-label">${lang === "zh" ? "周一" : "Mon"}</div>
            <div class="gh-day-label"></div>
            <div class="gh-day-label">${lang === "zh" ? "周三" : "Wed"}</div>
            <div class="gh-day-label"></div>
            <div class="gh-day-label">${lang === "zh" ? "周五" : "Fri"}</div>
            <div class="gh-day-label"></div>
            <div class="gh-day-label">${lang === "zh" ? "周日" : "Sun"}</div>
          </div>
          <div class="gh-weeks-grid" id="ghWeeksGrid"></div>
        </div>
      </div>
    </div>

    <div class="gh-footer">
      <div class="note">${heatmapSelectedDate ? `当前已锁定日期：<b>${heatmapSelectedDate}</b> · 点击格子可取消锁定` : "点击任意小方格，查看该日发布与排期详情"}</div>
      <div class="gh-legend">
        <span>少</span>
        <span class="gh-legend-cell lvl-0" style="background:#ede5d5;"></span>
        <span class="gh-legend-cell lvl-1" style="background:#39d353;"></span>
        <span class="gh-legend-cell lvl-2" style="background:#26a641;"></span>
        <span class="gh-legend-cell lvl-3" style="background:#006d32;"></span>
        <span>多</span>
      </div>
    </div>
  `;

  $list.appendChild(ghCard);

  const ghSel = ghCard.querySelector("#ghPlatSelect");
  if (ghSel) {
    ghSel.onchange = (e) => {
      heatmapPlatFilter = e.target.value;
      refreshRunSurface();
    };
  }

  const $monthsRow = ghCard.querySelector("#ghMonthsRow");
  const $weeksGrid = ghCard.querySelector("#ghWeeksGrid");
  const monthNamesZh = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mLabels = lang === "zh" ? monthNamesZh : monthNamesEn;

  let prevMonth = -1;

  for (let w = 0; w < 52; w++) {
    const weekMon = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (w * 7));
    const curM = weekMon.getMonth();

    if (curM !== prevMonth) {
      const mSpan = document.createElement("span");
      mSpan.className = "gh-month-label";
      mSpan.style.left = `${w * 15}px`;
      mSpan.textContent = mLabels[curM];
      $monthsRow.appendChild(mSpan);
      prevMonth = curM;
    }

    const weekCol = document.createElement("div");
    weekCol.className = "gh-week-col";

    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (w * 7 + d));
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
      const isSelected = (heatmapSelectedDate === dateStr);
      const isToday = (dateStr === todayStr);

      const dayItems = itemsByDate.get(dateStr) || [];
      const shipped = dayItems.filter(it => it.is_published || it.status === "published");
      const overdue = dayItems.filter(it => !it.is_published && it.scheduled_date && it.scheduled_date < todayStr);
      const sched = dayItems.filter(it => !it.is_published && it.scheduled_date && it.scheduled_date >= todayStr);

      let lvlClass = "lvl-0";
      if (shipped.length >= 3) lvlClass = "lvl-3";
      else if (shipped.length === 2) lvlClass = "lvl-2";
      else if (shipped.length === 1) lvlClass = "lvl-1";
      else if (overdue.length > 0) lvlClass = "has-overdue";
      else if (sched.length > 0) lvlClass = "has-sched";

      const cell = document.createElement("div");
      cell.className = `gh-cell ${lvlClass}` + (isSelected ? " selected" : "") + (isToday ? " is-today-cell" : "");

      let tip = `${formatFriendlyDate(dateStr, lang)}: ${shipped.length} 篇已发布`;
      if (sched.length) tip += ` · ${sched.length} 篇待发布`;
      if (overdue.length) tip += ` · ${overdue.length} 篇超期待发`;
      if (dayItems.length > 0) {
        tip += `\n` + dayItems.map(x => `${x.platform.toUpperCase()}: ${x.label}`).join("\n");
      }
      cell.title = tip;

      cell.onclick = () => {
        heatmapSelectedDate = (heatmapSelectedDate === dateStr ? "" : dateStr);
        refreshRunSurface();
      };

      weekCol.appendChild(cell);
    }

    $weeksGrid.appendChild(weekCol);
  }

  // Auto-scroll to end so recent activity is immediately visible!
  const scrollWrap = ghCard.querySelector("#ghScrollContainer");
  if (scrollWrap) {
    setTimeout(() => {
      scrollWrap.scrollLeft = scrollWrap.scrollWidth;
    }, 30);
  }

  const feedSec = document.createElement("div");
  feedSec.className = "gh-feed-sec";

  let displayItems = [];
  let feedTitle = "";

  if (heatmapSelectedDate) {
    feedTitle = t("gh_feed_day", { date: formatFriendlyDate(heatmapSelectedDate, lang) });
    displayItems = itemsByDate.get(heatmapSelectedDate) || [];
  } else {
    feedTitle = t("gh_feed_recent");
    displayItems = [...allItems].filter(it => it.is_published || it.status === "published").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 15);
  }

  feedSec.innerHTML = `
    <div class="gh-feed-header">
      <div class="gh-feed-title">
        <span>${esc(feedTitle)}</span>
        <span class="pill">${displayItems.length} 篇</span>
      </div>
      ${heatmapSelectedDate ? `<button type="button" class="ghost-link" id="ghFeedClearBtn" style="font-size:11px;">${esc(t("gh_feed_clear"))}</button>` : ""}
    </div>
  `;

  if (!displayItems.length) {
    feedSec.innerHTML += `<p class="vacant" style="padding:14px 4px;">${esc(t("gh_feed_empty"))}</p>`;
  } else {
    displayItems.forEach(item => {
      const st = getPostStatusInfo(item, todayStr);
      const row = document.createElement("div");
      row.className = "sched-card" + (selected === (item.run_id || item.id) ? " sel" : "");
      row.onclick = () => select(item.run_id || item.id);

      const p = parseDateParts(item.date);
      const monthDay = p ? `${p.m}/${p.d}` : "--";
      const wDays = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weekday = p ? wDays[new Date(p.y, p.m - 1, p.d).getDay()] : "";

      row.innerHTML = `
        <div class="sched-date-badge">
          <div class="month-day">${esc(monthDay)}</div>
          <div class="weekday">${esc(weekday)}</div>
        </div>
        <div style="min-width:0; flex:1;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
            ${platMarkHtml({platform: item.platform})}
            <span style="font-weight:600; font-size:13px; color:var(--sumi);">${esc(item.platform.toUpperCase())}</span>
            <span class="sched-status-tag ${st.badgeClass}">${esc(st.label)}</span>
            ${item.topic_id ? `<span class="pill" style="font-size:10px;">${esc(item.topic_id)}</span>` : ""}
            ${item.pillar ? `<span class="pill" style="font-size:10px;">${esc(formatPillar(item.pillar))}</span>` : ""}
            ${item.result && item.result !== "unknown" ? `<span class="pill" style="font-size:10px; font-weight:600;">复盘: ${esc(item.result)}</span>` : ""}
          </div>
          <div style="font-size:13px; color:var(--text); line-height:1.4; overflow:hidden; text-overflow:ellipsis;">${esc(item.label)}</div>
          ${item.notes ? `<div class="note" style="margin-top:4px;">${esc(item.notes.slice(0, 80))}</div>` : ""}
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
          ${item.run_id ? `<button type="button" class="ghost-link" data-run-open="${esc(item.run_id)}" style="font-size:11px;">查看内容</button>` : ""}
          ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer" class="ghost-link" style="font-size:11px;" onclick="event.stopPropagation();">查看原帖 ↗</a>` : ""}
        </div>
      `;
      feedSec.appendChild(row);
    });
  }

  $list.appendChild(feedSec);
  const clearBtn = feedSec.querySelector("#ghFeedClearBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      heatmapSelectedDate = "";
      refreshRunSurface();
    };
  }
}

function renderRunAll() {
  const runs = nodesOf("run");
  const plats = ["x", "tiktok", "instagram", "linkedin", "threads", "xiaohongshu"];
  const box = document.createElement("div");
  box.className = "filt";
  const top = document.createElement("div");
  top.className = "filters";
  top.style.marginBottom = "0";
  top.innerHTML = topicSelectHtml(runs, runTopic);
  box.appendChild(top);
  box.appendChild(chipRow(t("f_run_ship"), [
    { id: "shipped", label: t("f_run_shipped") },
    { id: "unshipped", label: t("f_run_unshipped") },
  ], runShip, (id) => { runShip = id; refreshRunSurface(); }));
  box.appendChild(chipRow(t("f_run_plat"), plats.map(p => ({ id: p, label: p })), runPlat, (id) => {
    runPlat = id; refreshRunSurface();
  }));
  $list.appendChild(box);
  top.querySelector("#f-topic").onchange = (e) => {
    runTopic = e.target.value;
    refreshRunSurface();
  };
  const cards = document.createElement("div");
  cards.className = "cards";
  let rows = runs.filter(qmatch).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (runTopic === "__none__") rows = rows.filter(r => !topicIdOf(r));
  else if (runTopic) rows = rows.filter(r => topicIdOf(r) === runTopic);
  if (runShip === "shipped") rows = rows.filter(runIsShipped);
  if (runShip === "unshipped") rows = rows.filter(r => !runIsShipped(r));
  if (runPlat) {
    rows = rows.filter(r =>
      String(r.platforms || r.primary_platform || "").split(",").map(s => s.trim().toLowerCase()).includes(runPlat)
    );
  }
  rows.forEach(r => cards.appendChild(rowEl(r)));
  if (!rows.length) cards.innerHTML = `<p class='empty'>${t("no_run")}</p>`;
  $list.appendChild(cards);
}

function renderPub() {
  $list.innerHTML = "";
  $list.insertAdjacentHTML("beforeend", `<p class="lead">${t("pub_lead")}</p><p class="lede">${t("pub_lede")}</p>`);
  const pubs = nodesOf("published");
  const plats = ["x", "tiktok", "instagram", "linkedin", "threads", "xiaohongshu"];
  const box = document.createElement("div");
  box.className = "filt";
  const top = document.createElement("div");
  top.className = "filters";
  top.style.marginBottom = "0";
  top.innerHTML = topicSelectHtml(pubs, pubTopic);
  box.appendChild(top);
  box.appendChild(chipRow(t("f_run_plat"), plats.map(p => ({ id: p, label: p })), pubPlat, (id) => {
    pubPlat = id; renderPub(); renderInsp();
  }));
  $list.appendChild(box);
  top.querySelector("#f-topic").onchange = (e) => {
    pubTopic = e.target.value;
    renderPub();
    renderInsp();
  };
  const cards = document.createElement("div");
  cards.className = "cards";
  let rows = pubs.filter(qmatch).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (pubTopic === "__none__") rows = rows.filter(p => !topicIdOf(p));
  else if (pubTopic) rows = rows.filter(p => topicIdOf(p) === pubTopic);
  if (pubPlat) {
    rows = rows.filter(p => String(p.platform || "").trim().toLowerCase() === pubPlat);
  }
  if (!rows.length) cards.innerHTML = `<p class='empty'>${t("no_pub")}</p>`;
  rows.forEach(p => cards.appendChild(rowEl(p)));
  $list.appendChild(cards);
}

function rawLinksFor(n, ctx) {
  const out = [];
  if (n.kind === "raw" && n.source_url) {
    out.push({ id: n.id, ident: n.ident, label: n.label, url: n.source_url, path: n.path });
    return out;
  }
  if (n.kind === "capture") {
    ctx.filter(x => x.kind === "raw").forEach(r => {
      out.push({ id: r.id, ident: r.ident, label: r.label, url: r.source_url || "", path: r.path });
    });
  }
  return out;
}

function sourceBlockHtml(n, ctx) {
  const topicUrl = n.src_url || "";
  const ownUrl = n.source_url || "";
  const raws = rawLinksFor(n, ctx);
  let html = "";
  if (topicUrl) {
    html += `<p class="note">${t("src_url")}<a href="${esc(topicUrl)}" target="_blank" rel="noreferrer">${esc(topicUrl)}</a><br>${t("src_heat")}
      ${n.src_likes ? ` likes ${esc(n.src_likes)} · replies ${esc(n.src_replies)} · bookmarks ${esc(n.src_bookmarks)}` : ""}</p>`;
  }
  if (n.kind === "capture" || n.kind === "raw") {
    html += `<h2>${t("raw_section")}</h2>`;
    if (!raws.length && !ownUrl) {
      html += `<p class="vacant">${t("raw_none")}</p>`;
    } else if (n.kind === "raw") {
      if (ownUrl) html += `<p class="note">${t("raw_link")}：<a href="${esc(ownUrl)}" target="_blank" rel="noreferrer">${esc(ownUrl)}</a></p>`;
    } else {
      raws.forEach(r => {
        html += `<div class="note" style="margin:0 0 10px">
          <div><button type="button" class="ghost-link" data-goto="${esc(r.id)}">${esc(r.ident)}</button> · ${esc(r.label.slice(0, 80))}</div>
          ${r.url ? `<div>${t("raw_link")}：<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></div>` : `<div class="vacant">${t("raw_none")}</div>`}
          ${r.path ? `<div>${t("raw_file")}：<button type="button" class="ghost-link" data-md="${esc(r.path)}" data-md-title="${esc(r.ident)}">${esc(r.path)}</button></div>` : ""}
        </div>`;
      });
    }
  } else if (ownUrl && !topicUrl) {
    html += `<p class="note">${t("src_url")}<a href="${esc(ownUrl)}" target="_blank" rel="noreferrer">${esc(ownUrl)}</a></p>`;
  }
  return html;
}

function profileCounts(profileId) {
  return {
    capture: nodesOfAll("capture").filter(n => n.profile === profileId).length,
    need: nodesOfAll("need").filter(n => n.profile === profileId).length,
    hit: nodesOfAll("hit").filter(n => n.profile === profileId).length,
    topic: nodesOfAll("topic").filter(n => n.profile === profileId).length,
    lib: GRAPH.nodes.filter(n => n.lib && (String(n.profiles || "").includes(profileId) || String(n.profiles || "").includes("*"))).length,
    run: nodesOfAll("run").filter(n => n.profile === profileId).length,
    published: nodesOfAll("published").filter(n => n.profile === profileId).length,
  };
}

function countsFor(profileId) {
  if (profileId) return profileCounts(profileId);
  return {
    capture: nodesOfAll("capture").length,
    need: nodesOfAll("need").length,
    hit: nodesOfAll("hit").length,
    topic: nodesOfAll("topic").length,
    lib: GRAPH.nodes.filter(n => n.lib).length,
    run: nodesOfAll("run").length,
    published: nodesOfAll("published").length,
  };
}

function gapsFor(profileId) {
  const topics = profileId ? nodesOfAll("topic").filter(n => n.profile === profileId) : nodesOfAll("topic");
  const needs = profileId ? nodesOfAll("need").filter(n => n.profile === profileId) : nodesOfAll("need");
  const hits = profileId ? nodesOfAll("hit").filter(n => n.profile === profileId) : nodesOfAll("hit");
  const caps = profileId ? nodesOfAll("capture").filter(n => n.profile === profileId) : nodesOfAll("capture");
  const pubs = profileId ? nodesOfAll("published").filter(n => n.profile === profileId) : nodesOfAll("published");
  const needCount = needs.length;
  const gaps = [
    [hits.filter(h => h.status === "triage").length, "gap_hits_n"],
    [topics.filter(x => x.status === "ready" && x.usage === "unused").length, "gap_ready_n"],
    [needs.filter(n => n.status === "captured" && (!n.topic_ids || n.topic_ids === "none")).length, "gap_needs_n"],
    [caps.filter(c => c.status !== "ingested").length, "gap_lib_n"],
    [pubs.filter(p => !p.reviewable).length, "gap_review_n"],
  ].filter(([n]) => n > 0);
  if (GRAPH.needs_index_present && needCount < 3) {
    const idx = gaps.findIndex(([, k]) => k === "gap_needs_n");
    gaps.splice(idx < 0 ? gaps.length : idx, 0, [needCount, "gap_needs_thin_n"]);
  }
  return gaps;
}

function statsHtml(counts) {
  const rows = [
    ["kpi_topics", "kpi_topics_hint", counts.topic],
    ["kpi_runs", "kpi_runs_hint", counts.run],
    ["kpi_published", "kpi_published_hint", counts.published],
    ["kpi_needs", "kpi_needs_hint", counts.need || 0],
    ["kpi_hits", "kpi_hits_hint", counts.hit || 0],
    ["kpi_lib", "kpi_lib_hint", counts.lib],
    ["kpi_cap", "kpi_cap_hint", counts.capture],
  ];
  return `<div class="vault-stats">${rows.map(([label, hint, n]) => `
    <div class="vault-stat">
      <div class="vault-stat-label">${esc(t(label))}<span class="vault-stat-hint">${esc(t(hint))}</span></div>
      <b>${n}</b>
    </div>`).join("")}</div>`;
}

const GAP_GOTO = {
  gap_hits_n: "hits",
  gap_ready_n: "select",
  gap_needs_n: "needs",
  gap_needs_thin_n: "needs",
  gap_lib_n: "notes",
  gap_review_n: "shipped",
};

function gapsHtml(profileId) {
  const gaps = gapsFor(profileId);
  if (!gaps.length) return `<p class="vault-clear">${esc(t("gap_none"))}</p>`;
  return `<div class="vault-gaps">${gaps.map(([n, k]) => {
    const goto = GAP_GOTO[k] || "";
    return `<button type="button" class="vault-gap" ${goto ? `data-goto="${esc(goto)}"` : ""}>
      <span class="vault-gap-n">${n}</span>
      <span class="vault-gap-copy">${esc(t(k, { n }))}</span>
      <span class="vault-gap-go">→</span>
    </button>`;
  }).join("")}</div>`;
}

function bindVaultPanel(root) {
  root.querySelectorAll("[data-goto]").forEach(btn => {
    btn.onclick = () => jumpToView(btn.getAttribute("data-goto"));
  });
}

function renderVaultInsp() {
  $insp.innerHTML = `<div class="vault-panel">
    <header class="vault-hero">
      <p class="vault-kicker">${esc(t("vault_kicker"))}</p>
      <h2 class="vault-title">${esc(t("vault_title"))}</h2>
      <p class="vault-lede">${esc(t("vault_lede"))}</p>
    </header>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("profile_stats"))}</h3>
        <p class="vault-block-why">${esc(t("profile_stats_why"))}</p>
      </div>
      ${statsHtml(countsFor(""))}
    </section>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("gap_section"))}</h3>
        <p class="vault-block-why">${esc(t("gap_section_why"))}</p>
      </div>
      ${gapsHtml("")}
    </section>
    <p class="vault-foot">${esc(t("readonly"))}</p>
  </div>`;
  bindVaultPanel($insp);
}

function renderProfileInsp(n) {
  const pillars = (GRAPH.pillars_by_profile || {})[n.ident] || {};
  const accounts = nodesOfAll("account").filter(a => a.profile_id === n.ident);
  const files = n.files || {};
  const docOrder = [
    ["readme", t("doc_readme")],
    ["voice", t("doc_voice")],
    ["audience", t("doc_audience")],
    ["pillars", t("doc_pillars")],
    ["lanes", t("doc_lanes")],
    ["keywords", t("doc_keywords")],
    ["handles", t("doc_handles")],
  ];
  const pillarRows = Object.entries(pillars).map(([id, p]) => {
    const title = lang === "zh" ? p.zh : p.en;
    return `<div class="prof-pill"><span class="hid">${esc(id)}</span><span>${esc(title)}</span></div>`;
  }).join("") || `<p class="vacant">${t("vacant")}</p>`;
  const acctRows = accounts.map(a =>
    `<button type="button" data-account-open="${esc(a.id)}">${esc(a.ident)} · ${esc(a.platforms || a.default_platform || "")} · ${esc(a.status || "")}</button>`
  ).join("") || `<p class="vacant">${t("vacant")}</p>`;
  const docRows = docOrder.filter(([k]) => files[k]).map(([k, label]) =>
    `<button type="button" class="stage-file-lite" data-md="${esc(files[k])}" data-md-title="${esc(label)}">
      <span class="sk">${esc(label)}</span><span class="sp">${esc(files[k].split("/").pop())}</span><span class="sa">${t("read_md")}</span>
    </button>`
  ).join("") || `<p class="vacant">${t("vacant")}</p>`;
  $insp.innerHTML = `<div class="vault-panel">
    <header class="vault-hero">
      <p class="vault-kicker">${esc(t("kind_profile"))}</p>
      <h2 class="vault-title">${esc(n.label || n.ident)}</h2>
      <p class="vault-lede">${esc(n.ident)}</p>
    </header>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("profile_stats"))}</h3>
        <p class="vault-block-why">${esc(t("profile_stats_why"))}</p>
      </div>
      ${statsHtml(countsFor(n.ident))}
    </section>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("gap_section"))}</h3>
        <p class="vault-block-why">${esc(t("gap_section_why"))}</p>
      </div>
      ${gapsHtml(n.ident)}
    </section>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("profile_pillars"))}</h3>
      </div>
      <div class="prof-pillars">${pillarRows}</div>
    </section>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("profile_accounts"))}</h3>
      </div>
      <div class="tcard prof-accts">${acctRows}</div>
    </section>
    <section class="vault-block">
      <div class="vault-block-head">
        <h3 class="vault-block-title">${esc(t("profile_docs"))}</h3>
      </div>
      <div class="prof-docs">${docRows}</div>
    </section>
    <p class="vault-foot">${esc(t("readonly"))}</p>
  </div>`;
  bindVaultPanel($insp);
  $insp.querySelectorAll("[data-account-open]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const node = byId[btn.getAttribute("data-account-open")];
      if (node) openAccount(node);
    };
  });
}


function mediaGraphStatus(n) {
  const s = String(n.graph_status || "").trim();
  if (s === "linked" || s === "orphaned" || s === "described" || s === "cataloged") return s;
  const semantic = (n.links || []).filter(l => /^(P|R|C|W|RUN)-/.test(l));
  const edges = mediaDirectEdges(n.id);
  if (edges.length) return "linked";
  if (semantic.length) return "orphaned";
  if (n.described) return "described";
  return "cataloged";
}

function mediaIsReady(n) {
  // Two UI states only: incomplete vs ready (has description and/or graph presence).
  const st = mediaGraphStatus(n);
  return st === "described" || st === "linked" || st === "orphaned" || Boolean(n.described) || mediaDirectEdges(n.id).length > 0;
}

function mediaDirectEdges(mediaId) {
  const out = [];
  for (const e of GRAPH.edges || []) {
    if (e.from !== mediaId && e.to !== mediaId) continue;
    const otherId = e.from === mediaId ? e.to : e.from;
    const other = byId[otherId];
    if (!other) continue;
    out.push({ rel: e.rel || "", node: other, from: e.from, to: e.to });
  }
  const rank = { wiki: 0, product: 1, recommendation: 2, capture: 3, run: 4, published: 5 };
  out.sort((a, b) => (rank[a.node.kind] ?? 9) - (rank[b.node.kind] ?? 9));
  return out.slice(0, 12);
}

function mediaGraphPanelHtml(n) {
  const ready = mediaIsReady(n);
  const edges = mediaDirectEdges(n.id);
  const orphans = Array.isArray(n.orphan_links) ? n.orphan_links : [];
  const statusClass = ready ? "ready" : "incomplete";
  const statusLabel = ready ? t("media_graph_ready") : t("media_graph_incomplete");
  let lede = ready ? t("media_graph_lede_ready") : t("media_graph_lede_incomplete");
  if (ready && orphans.length) {
    lede = fillTemplate("media_graph_lede_ready_orphan", { ids: orphans.join(" ") });
  }

  if (!ready) {
    // Incomplete: panel is just a short pointer; Copy to Agent card below does the work.
    return `<div class="media-graph-panel" data-media-id="${esc(n.ident)}">
      <span class="media-graph-status ${statusClass}">${esc(statusLabel)}</span>
      <p class="media-graph-lede">${esc(lede)}</p>
    </div>`;
  }

  const caption = (n.caption || n.label || "").trim();
  const captionHtml = caption
    ? `<div class="note" style="font-weight:700">${esc(t("media_graph_caption"))}</div>
       <p class="media-caption-block">${esc(caption)}</p>`
    : "";
  let nbrHtml = "";
  if (edges.length) {
    nbrHtml = `<div class="note" style="font-weight:700">${esc(t("media_graph_neighbors"))}</div>
      <ul class="media-nbr-list">${edges.map(({ rel, node }) => `
        <li><button type="button" class="media-nbr" data-goto="${esc(node.id)}">
          <span class="media-nbr-rel">${esc(rel || "related")}</span>
          <span class="media-nbr-main">
            <span class="media-nbr-id">${esc(kindName(node.kind))} · ${esc(node.ident)}</span>
            <span class="media-nbr-label">${esc(node.label || node.one_liner || "")}</span>
          </span>
        </button></li>`).join("")}</ul>`;
  } else {
    nbrHtml = `<p class="media-graph-lede">${esc(t("media_graph_empty_nbr"))}</p>`;
  }
  return `<div class="media-graph-panel" data-media-id="${esc(n.ident)}">
    <span class="media-graph-status ${statusClass}">${esc(statusLabel)}</span>
    <p class="media-graph-lede">${esc(lede)}</p>
    ${captionHtml}
    ${nbrHtml}
  </div>`;
}

function bindMediaGraphPanel(root, n) {
  // Read-only panel in both UI states; Agent prompt handles writes.
}

const TOPIC_PROV_ROLES = [
  "input", "judgment", "evidence", "counter_evidence",
  "craft", "claim", "need", "product", "capture", "wiki", "constraint"
];

function topicProvRoleLabel(role) {
  const key = "topic_prov_" + role;
  const lab = t(key);
  return lab === key ? role : lab;
}

function topicNodeByIdent(ident) {
  if (!ident) return null;
  return Object.values(byId).find(n => n.ident === ident) || null;
}

function topicHandoffPrompt(n) {
  const en = lang !== "zh";
  const platform = n.platform || (en ? "(unset)" : "（未定）");
  const profile = n.profile || n.profile_id || (en ? "(unset)" : "（未定）");
  const lane = n.lane || (en ? "(unset)" : "（未定）");
  const mode = (n.generation_mode || "").replace(/_/g, " ") || (en ? "(unset)" : "（未定）");
  const core = n.core_judgment || n.label || "";
  const gaps = (n.gaps || "").trim();
  const runId = (n.run_id || "").trim();
  if (en) {
    let body = `Next step: open a run from this Topic.\n\nTopic: ${n.ident}\nPlatform: ${platform}\nProfile: ${profile}\nLane: ${lane}\nGeneration mode: ${mode}\n\nCore judgment:\n${core}\n\nPlease:\n1. Check hard gates for opening a Run from this Topic.\n2. Read its Context Packet, linked W- judgments, product facts, constraints, and generation Trace.\n3. If platform is set, create one Run for that platform.\n4. If multiple platforms are needed, create one Run per platform.\n5. Keep topic_id=${n.ident} on the Run.\n6. Do not reinvent the Core judgment; if evidence is thin or the cut must change, return to the Topic first.`;
    if (gaps) body += `\n\nEvidence gaps:\n${gaps}`;
    if (runId) body += `\n\nNote: a Run already exists (${runId}). Prefer continuing it unless I ask for a new one.`;
    return body;
  }
  let body = `下一步：用这个 Topic 开一单。\n\nTopic: ${n.ident}\nPlatform: ${platform}\nProfile: ${profile}\nLane: ${lane}\nGeneration mode: ${mode}\n\n核心判断：\n${core}\n\n请执行：\n1. 先检查这个 Topic 是否满足开 Run 的 hard gate。\n2. 读取它的 Context Packet、关联 W- 判断、产品事实、约束和生成时的 Trace。\n3. 如果 platform 已明确，创建一个对应平台的 Run。\n4. 如果需要多个 platform，则每个平台创建一个独立 Run。\n5. 在 Run 中保留 topic_id=${n.ident}。\n6. 不要重新发明 Topic 的 Core judgment；如果发现证据不足或判断需要变化，先返回 Topic。`;
  if (gaps) body += `\n\n证据缺口：\n${gaps}`;
  if (runId) body += `\n\n注意：已经有 Run（${runId}）。除非我要求新开，否则优先继续那一单。`;
  return body;
}

function topicBeats(n) {
  return [
    ["topic_beat_who", n.who_for || ""],
    ["topic_beat_believe", n.believe_now || ""],
    ["topic_beat_cut", n.cut || ""],
    ["topic_beat_after", n.change_after || ""],
  ].filter(([, v]) => String(v).trim());
}

function topicDecisionHtml(n) {
  const core = n.core_judgment || n.label || "";
  const beats = topicBeats(n).map(([key, v]) =>
    `<div class="topic-beat"><div class="topic-beat-label">${esc(t(key))}</div><p>${esc(v)}</p></div>`
  ).join("");
  const why = (n.why_status || "").trim();
  return `<section class="topic-section topic-decision">
    ${core ? `<p class="topic-core">${esc(core)}</p>` : ""}
    ${beats}
    ${why ? `<p class="topic-why">${esc(why)}</p>` : ""}
  </section>`;
}

function topicWarnings(n) {
  const warns = [];
  const st = String(n.verdict || n.status || "").toLowerCase();
  if (st === "killed" || st === "discard") warns.push(t("topic_warn_killed"));
  if (!(n.platform || "").trim()) warns.push(t("topic_warn_no_platform"));
  if (!(n.profile || n.profile_id || "").toString().trim()) warns.push(t("topic_warn_no_profile"));
  if ((n.run_id || "").trim()) warns.push(fillTemplate("topic_warn_has_run", { id: n.run_id }));
  return warns;
}

function topicReadyHtml(n) {
  const warns = topicWarnings(n);
  const gaps = (n.gaps || "").trim();
  if (!warns.length && !gaps) {
    return `<p class="topic-ready-ok">${esc(t("topic_ready_ok"))}</p>`;
  }
  const warnHtml = warns.map(w => `<p class="topic-warn">${esc(w)}</p>`).join("");
  const gapHtml = gaps
    ? `<p class="topic-gap"><span>${esc(t("topic_field_gaps"))}</span>${esc(gaps)}</p>`
    : "";
  return `<div class="topic-ready-block">${warnHtml}${gapHtml}</div>`;
}

const TOPIC_CTX_COL = {
  input: "input", product: "input", need: "input",
  judgment: "judgment", wiki: "judgment",
  evidence: "evidence", counter_evidence: "evidence", capture: "evidence",
  craft: "craft", claim: "craft", swipe: "craft", atom: "craft",
};
const TOPIC_CTX_RANK = { input: 0, judgment: 1, evidence: 2, craft: 3 };

function topicContextColumns(n) {
  const cols = { input: [], judgment: [], evidence: [], craft: [] };
  const best = new Map();
  for (const row of (n.provenance || [])) {
    if (!row || !row.ident || row.role === "constraint") continue;
    const col = TOPIC_CTX_COL[row.role] || "craft";
    const prev = best.get(row.ident);
    const prevCol = prev ? prev.col : "craft";
    if (!prev || TOPIC_CTX_RANK[col] < TOPIC_CTX_RANK[prevCol]) {
      best.set(row.ident, { ...row, col });
    }
  }
  for (const row of best.values()) cols[row.col].push(row);
  return cols;
}

function topicContextCount(cols) {
  return Object.values(cols).reduce((sum, list) => sum + list.length, 0);
}

function topicContextSummaryHtml(n) {
  const cols = topicContextColumns(n);
  const total = topicContextCount(cols);
  const bits = ["input", "judgment", "evidence", "craft"]
    .filter(col => cols[col].length)
    .map(col => `${t("topic_ctx_col_" + col)} ${cols[col].length}`)
    .join(" · ");
  const head = total
    ? fillTemplate("topic_ctx_read", { n: total })
    : t("topic_ctx_none_short");
  return `<section class="topic-section topic-ctx-card">
    <p class="topic-ctx-summary">${esc(head)}</p>
    ${bits ? `<p class="topic-ctx-bits">${esc(bits)}</p>` : ""}
    <button type="button" class="topic-ctx-open" id="topicCtxOpen">${esc(t("topic_ctx_open"))}</button>
  </section>`;
}

function topicRolePlain(role) {
  const key = "topic_ctx_plain_" + (role || "");
  const lab = t(key);
  return lab === key ? (role || "") : lab;
}

let ctxTopic = null;
let ctxSelected = "";
let ctxTab = "graph";
let ctxMountGen = 0;

const TOPIC_CTX_ROLE_COLOR = {
  input: "#7a6b9e",
  judgment: "#9c3d32",
  evidence: "#7d9aa8",
  craft: "#c4a06a",
  topic: "#9c3d32",
  run: "#2f6fed",
  craft_hub: "#8b6914",
};
const TOPIC_CTX_RING = { input: 130, judgment: 170, evidence: 210, craft: 250 };

let ctxAnim = null;
let ctxGraphApi = null;
let ctxTransform = { x: 0, y: 0, k: 1 };

function stopTopicContextAnim() {
  if (ctxAnim) {
    cancelAnimationFrame(ctxAnim);
    ctxAnim = null;
  }
  ctxGraphApi = null;
}

function topicContextRows() {
  if (!ctxTopic) return [];
  const cols = topicContextColumns(ctxTopic);
  return Object.values(cols).flat();
}

function buildTopicContextGraph(topic) {
  const rows = [];
  const cols = topicContextColumns(topic);
  for (const col of ["input", "judgment", "evidence", "craft"]) {
    for (const row of cols[col]) rows.push(row);
  }
  const topicId = topic.id || `topic:${topic.ident}`;
  const hubKind = topic.kind === "run" ? "run"
    : (topic.kind === "swipe" || topic.kind === "atom" || topic.kind === "claim") ? "craft_hub"
    : "topic";
  const nodes = [{
    id: topicId,
    ident: topic.ident,
    label: topic.core_judgment || topic.label || "",
    kind: hubKind,
    role: hubKind,
    hubKind,
    isTopic: true,
  }];
  const links = [];
  const seen = new Set([topic.ident]);
  for (const row of rows) {
    if (seen.has(row.ident)) continue;
    seen.add(row.ident);
    const live = topicNodeByIdent(row.ident);
    const id = live ? live.id : `${row.kind || "node"}:${row.ident}`;
    nodes.push({
      id,
      ident: row.ident,
      label: live ? (live.label || "") : "",
      kind: live ? live.kind : (row.kind || "wiki"),
      role: row.role || row.col || "craft",
      col: row.col || TOPIC_CTX_COL[row.role] || "craft",
      epistemic: row.epistemic || "",
      reason: row.reason || "",
      isTopic: false,
    });
    links.push({
      from: id,
      to: topicId,
      rel: topicProvRoleLabel(row.role || row.col || "craft"),
    });
  }
  return { nodes, links };
}

function mountTopicContextGraph(host, topic) {
  stopTopicContextAnim();
  const mountGen = ctxMountGen;
  ctxTransform = { x: 0, y: 0, k: 1 };
  const graph = buildTopicContextGraph(topic);
  const width = Math.max(host.clientWidth || 640, 420);
  const height = Math.max(host.clientHeight || 420, 320);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ctx-graph-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(root);
  host.innerHTML = "";
  host.appendChild(svg);

  const byRole = { input: [], judgment: [], evidence: [], craft: [] };
  for (const n of graph.nodes) {
    if (n.isTopic) continue;
    (byRole[n.col] || byRole.craft).push(n);
  }
  const nodes = graph.nodes.map((n, i) => {
    if (n.isTopic) {
      return { ...n, x: width / 2, y: height / 2, vx: 0, vy: 0, fx: width / 2, fy: height / 2 };
    }
    const bucket = byRole[n.col] || byRole.craft;
    const idx = bucket.indexOf(n);
    const count = Math.max(bucket.length, 1);
    const base = { input: -Math.PI * 0.75, judgment: -Math.PI * 0.25, evidence: Math.PI * 0.25, craft: Math.PI * 0.75 };
    const span = Math.PI * 0.45;
    const angle = (base[n.col] || 0) - span / 2 + (count === 1 ? span / 2 : (idx / (count - 1)) * span);
    const ring = TOPIC_CTX_RING[n.col] || 200;
    const jx = ((i * 37) % 9) - 4;
    const jy = ((i * 53) % 9) - 4;
    return {
      ...n,
      x: width / 2 + Math.cos(angle) * ring + jx,
      y: height / 2 + Math.sin(angle) * ring + jy,
      vx: 0,
      vy: 0,
    };
  });
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = graph.links
    .map(e => ({ ...e, source: by[e.from], target: by[e.to] }))
    .filter(e => e.source && e.target);

  const gLinks = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const gLabels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const gNodes = document.createElementNS("http://www.w3.org/2000/svg", "g");
  root.appendChild(gLinks);
  root.appendChild(gLabels);
  root.appendChild(gNodes);

  const linkEls = links.map(e => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "link");
    line.setAttribute("stroke-width", "1.4");
    gLinks.appendChild(line);
    return { e, line };
  });

  function shortLabel(n) {
    if (n.isTopic) return n.ident.replace(/^T-\d{8}-/, "T-");
    return String(n.ident || "").slice(0, 22);
  }

  const nodeEls = nodes.map(n => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const selectedOn = (!n.isTopic && ctxSelected === n.ident) || (n.isTopic && !ctxSelected);
    g.setAttribute("class", "node" + (n.isTopic ? " topic" : "") + (selectedOn && !n.isTopic ? " sel" : ""));
    g.dataset.ident = n.ident;
    const r = n.isTopic ? 18 : 11;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", String(r));
    c.setAttribute("fill", TOPIC_CTX_ROLE_COLOR[n.isTopic ? (n.hubKind || "topic") : (n.col || "craft")] || "#8a8276");
    c.setAttribute("stroke", "#faf6ec");
    c.setAttribute("stroke-width", n.isTopic ? "2" : "1.5");
    const lab = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lab.setAttribute("class", "node-label");
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("dy", String(r + 13));
    lab.textContent = shortLabel(n);
    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("class", "node-sub");
    sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("dy", String(r + 24));
    const title = String(n.label || "").trim();
    sub.textContent = title ? (title.length > 28 ? title.slice(0, 27) + "…" : title) : "";
    g.appendChild(c);
    g.appendChild(lab);
    if (sub.textContent) g.appendChild(sub);
    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (n.isTopic) {
        ctxSelected = "";
      } else {
        ctxSelected = n.ident;
      }
      paintSelection();
      renderTopicContextDetail();
    });
    let dragging = false;
    g.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || n.isTopic) return;
      dragging = true;
      n.fx = n.x; n.fy = n.y;
      g.setPointerCapture(ev.pointerId);
      ev.stopPropagation();
    });
    g.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const pt = clientToGraph(ev.clientX, ev.clientY);
      n.fx = pt.x; n.fy = pt.y;
      n.x = pt.x; n.y = pt.y;
      wake(0.25);
    });
    g.addEventListener("pointerup", (ev) => {
      if (!dragging) return;
      dragging = false;
      n.fx = null; n.fy = null;
      try { g.releasePointerCapture(ev.pointerId); } catch (_) {}
      wake(0.2);
    });
    gNodes.appendChild(g);
    return { n, g, r };
  });

  function paintSelection() {
    const has = !!ctxSelected;
    nodeEls.forEach(({ n, g }) => {
      const on = !n.isTopic && ctxSelected === n.ident;
      g.classList.toggle("sel", on);
      g.classList.toggle("dim", has && !on && !n.isTopic);
    });
    linkEls.forEach(({ e, line }) => {
      const on = has && (e.source.ident === ctxSelected || e.target.ident === ctxSelected);
      line.classList.toggle("on", on);
      line.classList.toggle("dim", has && !on);
    });
  }

  function applyTransform() {
    root.setAttribute("transform", `translate(${ctxTransform.x},${ctxTransform.y}) scale(${ctxTransform.k})`);
  }
  applyTransform();

  function clientToGraph(cx, cy) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (cx - rect.left - ctxTransform.x) / ctxTransform.k,
      y: (cy - rect.top - ctxTransform.y) / ctxTransform.k,
    };
  }

  let panning = false, pan0 = null;
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    if (ev.target.closest(".node")) return;
    panning = true;
    svg.classList.add("dragging");
    pan0 = { x: ev.clientX, y: ev.clientY, tx: ctxTransform.x, ty: ctxTransform.y };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!panning || !pan0) return;
    ctxTransform.x = pan0.tx + (ev.clientX - pan0.x);
    ctxTransform.y = pan0.ty + (ev.clientY - pan0.y);
    applyTransform();
  });
  svg.addEventListener("pointerup", () => {
    panning = false;
    pan0 = null;
    svg.classList.remove("dragging");
  });
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const prev = ctxTransform.k;
    const next = Math.min(2.4, Math.max(0.45, prev * (ev.deltaY < 0 ? 1.08 : 0.92)));
    ctxTransform.x = mx - (mx - ctxTransform.x) * (next / prev);
    ctxTransform.y = my - (my - ctxTransform.y) * (next / prev);
    ctxTransform.k = next;
    applyTransform();
  }, { passive: false });

  let alpha = 1;
  const alphaMin = 0.03;
  const alphaDecay = 0.94;
  const charge = Math.min(900, Math.max(280, 18000 / Math.max(nodes.length, 1)));

  function stepPhysics(strength) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(dist2);
        const force = (charge * strength) / dist2;
        dx = dx / dist * force; dy = dy / dist * force;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
    }
    for (const e of links) {
      const a = e.source, b = e.target;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const ideal = TOPIC_CTX_RING[a.col] || 180;
      const f = (dist - ideal) * 0.045 * strength;
      dx = dx / dist * f; dy = dy / dist * f;
      a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
    }
    for (const n of nodes) {
      if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.min(width - 24, Math.max(24, n.x));
      n.y = Math.min(height - 28, Math.max(28, n.y));
    }
  }

  function paint() {
    for (const { e, line } of linkEls) {
      line.setAttribute("x1", e.source.x);
      line.setAttribute("y1", e.source.y);
      line.setAttribute("x2", e.target.x);
      line.setAttribute("y2", e.target.y);
    }
    for (const { n, g } of nodeEls) {
      g.setAttribute("transform", `translate(${n.x},${n.y})`);
    }
  }

  function wake(boost) {
    alpha = Math.max(alpha, boost || 0.35);
    if (!ctxAnim) ctxAnim = requestAnimationFrame(tick);
  }

  function tick() {
    ctxAnim = null;
    // Drop frames from a previous Topic/Run mount after the hub switched.
    if (mountGen !== ctxMountGen) return;
    if (alpha < alphaMin) {
      paint();
      return;
    }
    stepPhysics(alpha);
    alpha *= alphaDecay;
    paint();
    ctxAnim = requestAnimationFrame(tick);
  }

  paint();
  paintSelection();
  ctxAnim = requestAnimationFrame(tick);
  ctxGraphApi = { paintSelection };
  return ctxGraphApi;
}

function ctxKindLabel(kind) {
  const key = "topic_ctx_kind_" + (kind || "");
  const lab = t(key);
  return lab === key ? (kind || "") : lab;
}

function epistemicPlain(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "";
  if (s.includes("proposal")) return t("topic_ctx_as_proposal");
  if (s.includes("observation")) return t("topic_ctx_as_obs");
  if (s.includes("hypothesis") || s.includes("judgment")) return t("topic_ctx_as_judgment");
  if (s.includes("fact")) return t("topic_ctx_as_fact");
  return "";
}

function ctxBlock(title, bodyHtml, extraClass = "") {
  if (!bodyHtml) return "";
  const cls = extraClass ? ` ctx-block ${extraClass}` : "ctx-block";
  return `<section class="${cls.trim()}"><h4>${esc(title)}</h4><div class="ctx-block-body">${bodyHtml}</div></section>`;
}

function ctxP(text) {
  const v = String(text || "").trim();
  return v ? `<p>${esc(v)}</p>` : "";
}

function ctxList(items) {
  const rows = (items || []).map(x => String(x || "").trim()).filter(Boolean);
  if (!rows.length) return "";
  return `<ul>${rows.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function ctxField(label, value, { feature = false, html = false } = {}) {
  const v = String(value || "").trim();
  if (!v) return "";
  const body = feature
    ? `<p class="ctx-feature">${html ? v : esc(v)}</p>`
    : `<p class="ctx-field-value">${html ? v : esc(v)}</p>`;
  return `<div class="ctx-field"><div class="ctx-field-label">${esc(label)}</div>${body}</div>`;
}

function ctxChips(items) {
  const rows = (items || []).map(x => String(x || "").trim()).filter(Boolean);
  if (!rows.length) return "";
  return rows.map(x => `<span class="ctx-chip">${esc(x)}</span>`).join("");
}

function ctxHero({ kicker, title, ident, chips = [], meta = "" }) {
  return `<header class="ctx-hero">
    <div class="ctx-hero-top">
      <span class="ctx-kicker">${esc(kicker || "")}</span>
      ${ctxChips(chips)}
    </div>
    <p class="ctx-lead">${esc(title || "")}</p>
    ${ident ? `<p class="ctx-id">${esc(ident)}</p>` : ""}
    ${meta ? `<p class="ctx-meta">${esc(meta)}</p>` : ""}
  </header>`;
}

function ctxSaysHtml(node, detail) {
  const d = detail || {};
  const kind = (node && node.kind) || d.kind || "";
  if (kind === "wiki") {
    return [
      ctxField(t("topic_ctx_belief"), d.belief || (node && node.label) || "", { feature: true }),
      ctxField(t("topic_ctx_counter"), d.counter_evidence),
      ctxField(t("topic_ctx_next_test"), d.next_test),
    ].join("");
  }
  if (kind === "product") {
    return [
      ctxField(t("topic_ctx_promise"), d.promise, { feature: true }),
      ctxField(t("topic_ctx_what"), d.what_it_is || (node && node.label) || ""),
      ctxField(t("topic_ctx_best"), d.best_for || d.audience || (node && node.audience) || ""),
      ctxField(t("topic_ctx_not"), d.not_for),
      ctxField(t("topic_ctx_bounds"), d.boundaries),
      d.do_not_say && d.do_not_say.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_donot"))}</div>${ctxList(d.do_not_say)}</div>`
        : "",
    ].join("");
  }
  if (kind === "capture") {
    const sourceHtml = [
      d.handle ? esc(d.handle) : "",
      d.source_url ? `<a href="${esc(d.source_url)}" target="_blank" rel="noreferrer">${esc(d.source_url)}</a>` : "",
    ].filter(Boolean).join(" · ");
    return [
      ctxField(t("topic_ctx_observed"), d.one_liner || (node && node.label) || "", { feature: true }),
      sourceHtml ? ctxField(t("topic_ctx_source"), sourceHtml, { html: true }) : "",
      (() => {
        const heatHtml = heatFieldHtml(node, d.heat);
        return heatHtml
          ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_heat"))}</div>${heatHtml}</div>`
          : "";
      })(),
      d.notes && d.notes.length ? ctxList(d.notes) : "",
    ].join("");
  }
  if (kind === "claim") {
    return [
      ctxField(t("topic_ctx_claim"), d.claim || (node && node.label) || "", { feature: true }),
      d.applies_when && d.applies_when.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_applies"))}</div>${ctxList(d.applies_when)}</div>` : "",
      d.avoid_when && d.avoid_when.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_avoid"))}</div>${ctxList(d.avoid_when)}</div>` : "",
    ].join("");
  }
  if (kind === "swipe") {
    return [
      (d.title || (node && node.label))
        ? `<p class="ctx-feature">${esc(d.title || node.label)}</p>` : "",
      d.when_to_use && d.when_to_use.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_use"))}</div>${ctxList(d.when_to_use)}</div>` : "",
      d.beats && d.beats.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_beats"))}</div>${ctxList(d.beats)}</div>` : "",
      d.when_to_avoid && d.when_to_avoid.length
        ? `<div class="ctx-field"><div class="ctx-field-label">${esc(t("topic_ctx_avoid"))}</div>${ctxList(d.when_to_avoid)}</div>` : "",
    ].join("");
  }
  if (kind === "atom") {
    return [
      ctxField(t("topic_ctx_claim"), d.text || (node && node.label) || "", { feature: true }),
      ctxField(t("topic_ctx_status"), [d.atom_type, d.status].filter(Boolean).join(" · ")),
    ].join("");
  }
  if (kind === "need") {
    return [
      ctxField(t("topic_ctx_quote"), d.quote || (node && node.quote) || (node && node.label) || "", { feature: true }),
      ctxField(t("topic_ctx_speaker"), d.speaker || (node && node.speaker) || ""),
      ctxField(t("topic_ctx_status"), [d.frequency && `×${d.frequency}`, d.status].filter(Boolean).join(" · ")),
    ].join("");
  }
  return ctxP((node && node.label) || "");
}

function ctxEffectForRole(role) {
  const map = {
    input: "topic_ctx_effect_input",
    product: "topic_ctx_effect_input",
    need: "topic_ctx_effect_input",
    judgment: "topic_ctx_effect_judgment",
    wiki: "topic_ctx_effect_judgment",
    evidence: "topic_ctx_effect_evidence",
    counter_evidence: "topic_ctx_effect_evidence",
    capture: "topic_ctx_effect_evidence",
    craft: "topic_ctx_effect_craft",
    swipe: "topic_ctx_effect_craft",
    atom: "topic_ctx_effect_craft",
    claim: "topic_ctx_effect_claim",
  };
  const key = map[role] || "";
  return key ? t(key) : "";
}

function ctxCaveats(row, node, detail) {
  const out = [];
  const epi = String((row && row.epistemic) || "").toLowerCase();
  const status = String((detail && detail.status) || (node && node.status) || "").toLowerCase();
  const role = (row && row.role) || "";
  if (epi.includes("hypothesis") || epi.includes("judgment") || status === "hypothesis") {
    out.push(t("topic_ctx_caveat_hyp"));
  }
  if (epi.includes("observation") || (node && node.kind === "capture")) {
    out.push(t("topic_ctx_caveat_obs"));
  }
  if ((node && node.kind === "swipe") || role === "craft") {
    const tags = (detail && detail.tags) || [];
    const foilish = tags.includes("foil") || /foil/i.test((node && node.label) || "");
    if (foilish || role === "craft") out.push(t("topic_ctx_caveat_foil"));
  }
  if (node && node.kind === "product") out.push(t("topic_ctx_caveat_product"));
  // unique
  return [...new Set(out)];
}

function ctxWhyHtml(row) {
  const role = topicRolePlain(row.role);
  const why = String(row.reason || "").trim();
  const effect = ctxEffectForRole(row.role);
  return [
    ctxField(t("topic_ctx_role_here"), role),
    ctxField(t("topic_ctx_why_read"), why),
    ctxField(t("topic_ctx_effect"), effect),
  ].join("");
}

function ctxTrustHtml(row, node, detail) {
  const bits = [];
  const epi = epistemicPlain(row && row.epistemic);
  if (epi) bits.push(ctxP(epi));
  const conf = (detail && detail.confidence) || (node && node.confidence) || "";
  if (conf) bits.push(ctxP(fillTemplate("topic_ctx_conf", { v: conf })));
  const state = (detail && detail.state) || (node && node.state) || "";
  const status = (detail && detail.status) || (node && node.status) || "";
  const st = [state, status].filter(Boolean).join(" · ");
  if (st) bits.push(ctxField(t("topic_ctx_status"), st));
  const caveats = ctxCaveats(row, node, detail);
  if (caveats.length) bits.push(ctxList(caveats));
  return bits.join("");
}

function renderTopicContextDetail() {
  const $detail = document.getElementById("ctxDetail");
  if (!$detail || !ctxTopic) return;
  if (!ctxSelected) {
    const isRunHub = ctxTopic.kind === "run";
    const who = (ctxTopic.who_for || "").trim();
    const why = (ctxTopic.why_status || ctxTopic.cut || "").trim();
    const gaps = (ctxTopic.gaps || "").trim();
    const chips = [ctxTopic.verdict || ctxTopic.status, ctxTopic.usage].filter(Boolean);
    const cons = (ctxTopic.constraints || []).filter(Boolean).slice(0, 4);
    $detail.innerHTML = `<div class="ctx-detail-inner">
      ${ctxHero({
        kicker: ctxKindLabel(isRunHub ? "run" : "topic"),
        title: ctxTopic.core_judgment || ctxTopic.label || ctxTopic.ident,
        ident: ctxTopic.ident,
        chips,
        meta: who,
      })}
      ${isRunHub
        ? ctxBlock(t("run_insp_thesis"), ctxTopic.core_judgment ? `<p class="ctx-feature">${esc(ctxTopic.core_judgment)}</p>` : "")
          + (cons.length ? ctxBlock(t("run_insp_constraints"), ctxList(cons)) : "")
        : ctxBlock(t("topic_ctx_topic_why"), why ? `<p class="ctx-feature">${esc(why)}</p>` : "")
          + ctxBlock(t("topic_ctx_topic_gaps"), ctxP(gaps))}
      <p class="ctx-empty">${esc(t("topic_ctx_pick"))}</p>
    </div>`;
    return;
  }
  const row = topicContextRows().find(r => r.ident === ctxSelected);
  if (!row) {
    $detail.innerHTML = `<div class="ctx-detail-inner"><p class="ctx-empty">${esc(t("topic_ctx_pick"))}</p></div>`;
    return;
  }
  const node = topicNodeByIdent(row.ident);
  const detail = (node && node.context_detail) || {};
  const kind = (node && node.kind) || row.kind || "";
  const title = detail.title || (node && node.label) || row.ident;
  const chips = [
    detail.state,
    detail.status || (node && node.status) || "",
    detail.confidence ? fillTemplate("topic_ctx_conf", { v: detail.confidence }) : "",
    detail.form || "",
  ].filter(Boolean);
  $detail.innerHTML = `<div class="ctx-detail-inner">
    ${ctxHero({
      kicker: ctxKindLabel(kind),
      title,
      ident: row.ident,
      chips,
    })}
    ${ctxBlock(t("topic_ctx_sec_says"), ctxSaysHtml(node, detail))}
    ${ctxBlock(t("topic_ctx_sec_why"), ctxWhyHtml(row))}
    ${ctxBlock(t("topic_ctx_sec_trust"), ctxTrustHtml(row, node, detail), "trust")}
  </div>`;
}

function renderTopicPrompt() {
  const box = document.getElementById("ctxPrompt");
  if (!box || !ctxTopic || ctxTopic.kind !== "topic") return;
  const text = String(ctxTopic.generation_prompt || "").trim();
  const source = ctxTopic.generation_prompt_source || "";
  const note = !text
    ? t("topic_ctx_prompt_empty")
    : (source === "logged" ? t("topic_ctx_prompt_logged") : t("topic_ctx_prompt_rebuilt"));
  box.innerHTML = `
    <p class="ctx-prompt-note">${esc(note)}</p>
    ${text ? `<button type="button" class="ctx-prompt-copy" id="ctxPromptCopy">${esc(t("topic_ctx_prompt_copy"))}</button>` : ""}
    ${text ? `<pre id="ctxPromptText">${esc(text)}</pre>` : ""}
  `;
  const btn = document.getElementById("ctxPromptCopy");
  if (btn) btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = t("topic_ctx_prompt_copied");
    } catch (err) {
      btn.textContent = String(err.message || err);
    }
  };
}

function setTopicContextTab(tab) {
  ctxTab = tab === "prompt" ? "prompt" : "graph";
  const graph = document.getElementById("ctxBodyGraph");
  const prompt = document.getElementById("ctxPrompt");
  const showPrompt = ctxTopic && ctxTopic.kind === "topic" && ctxTab === "prompt";
  if (graph) graph.hidden = !!showPrompt;
  if (prompt) prompt.hidden = !showPrompt;
  document.querySelectorAll(".ctx-tab").forEach(btn => {
    btn.classList.toggle("on", btn.getAttribute("data-ctx-tab") === ctxTab);
  });
  if (showPrompt) {
    stopTopicContextAnim();
    renderTopicPrompt();
  } else if (ctxTopic) {
    renderTopicContext();
  }
}

function renderTopicContext() {
  const $map = document.getElementById("ctxMap");
  const $title = document.getElementById("ctxTitle");
  const $lede = document.getElementById("ctxLede");
  if (!$map || !ctxTopic) return;
  const isRunHub = ctxTopic.kind === "run";
  const isCraftHub = ctxTopic.kind === "swipe" || ctxTopic.kind === "atom" || ctxTopic.kind === "claim";
  const tabs = document.getElementById("ctxTabs");
  const showTabs = ctxTopic.kind === "topic";
  if (tabs) tabs.hidden = !showTabs;
  const tabGraph = document.getElementById("ctxTabGraph");
  const tabPrompt = document.getElementById("ctxTabPrompt");
  if (tabGraph) tabGraph.textContent = t("topic_ctx_tab_graph");
  if (tabPrompt) tabPrompt.textContent = t("topic_ctx_tab_prompt");
  if (showTabs && ctxTab === "prompt") {
    const graph = document.getElementById("ctxBodyGraph");
    const prompt = document.getElementById("ctxPrompt");
    if (graph) graph.hidden = true;
    if (prompt) prompt.hidden = false;
    $title.textContent = t("topic_ctx_title");
    $lede.textContent = t("topic_ctx_lede");
    renderTopicPrompt();
    return;
  }
  const graph = document.getElementById("ctxBodyGraph");
  const prompt = document.getElementById("ctxPrompt");
  if (graph) graph.hidden = false;
  if (prompt) prompt.hidden = true;
  $title.textContent = t(isCraftHub ? "lib_ctx_title" : (isRunHub ? "run_ctx_title" : "topic_ctx_title"));
  $lede.textContent = t(isCraftHub ? "lib_ctx_lede" : (isRunHub ? "run_ctx_lede" : "topic_ctx_lede"));
  const cols = topicContextColumns(ctxTopic);
  const total = topicContextCount(cols);
  const constraints = (ctxTopic.constraints || []).filter(Boolean);
  if (!total && !constraints.length) {
    stopTopicContextAnim();
    $map.innerHTML = `<p class="note" style="padding:16px">${esc(t(isCraftHub ? "lib_ctx_none" : (isRunHub ? "run_ctx_none" : "topic_ctx_none")))}</p>`;
    renderTopicContextDetail();
    return;
  }
  const legend = ["input", "judgment", "evidence", "craft"]
    .filter(col => cols[col].length)
    .map(col => `<span><i style="background:${TOPIC_CTX_ROLE_COLOR[col]}"></i>${esc(t("topic_ctx_col_" + col))}</span>`)
    .join("");
  const hubLab = isCraftHub ? "Craft" : (isRunHub ? "Run" : "Topic");
  const hubColor = isCraftHub ? TOPIC_CTX_ROLE_COLOR.craft_hub : (isRunHub ? TOPIC_CTX_ROLE_COLOR.run : TOPIC_CTX_ROLE_COLOR.topic);
  const consHtml = constraints.length
    ? `<div class="ctx-constraints"><h3>${esc(t("topic_ctx_constraints"))}</h3><ul>${
        constraints.map(c => `<li>${esc(c)}</li>`).join("")
      }</ul></div>`
    : "";
  $map.innerHTML = `<div class="ctx-graph-host" id="ctxGraphHost"></div>
    <div class="ctx-legend">${legend}<span><i style="background:${hubColor}"></i>${esc(hubLab)}</span></div>
    ${consHtml}`;
  // Wait a frame so host has size after modal display.
  // Capture hub key + generation so a stale Topic open cannot paint over a newer Run open.
  const hub = ctxTopic;
  const hubKey = String(hub.id || hub.ident || "");
  const gen = ctxMountGen;
  requestAnimationFrame(() => {
    if (gen !== ctxMountGen) return;
    if (!ctxTopic || String(ctxTopic.id || ctxTopic.ident || "") !== hubKey) return;
    const host = document.getElementById("ctxGraphHost");
    if (host) mountTopicContextGraph(host, hub);
  });
  renderTopicContextDetail();
}

function contextHubForNode(n) {
  if (!n) return null;
  if (n.kind === "run") return runContextHub(n);
  if (n.kind === "topic") return n;
  if (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") return libContextHub(n);
  return null;
}

function syncContextModalToNode(n) {
  const ctx = document.getElementById("ctxModal");
  if (!ctx || !ctx.classList.contains("open")) return;
  const hub = contextHubForNode(n);
  if (hub) openTopicContext(hub);
  else closeTopicContext();
}

function openTopicContext(n) {
  if (!n) return;
  stopTopicContextAnim();
  ctxMountGen += 1;
  ctxTopic = n;
  ctxSelected = "";
  ctxTab = "graph";
  const $map = document.getElementById("ctxMap");
  const $detail = document.getElementById("ctxDetail");
  const $title = document.getElementById("ctxTitle");
  const $lede = document.getElementById("ctxLede");
  const prompt = document.getElementById("ctxPrompt");
  const graph = document.getElementById("ctxBodyGraph");
  if ($map) $map.innerHTML = "";
  if ($detail) $detail.innerHTML = "";
  if ($title) $title.textContent = "";
  if ($lede) $lede.textContent = "";
  if (prompt) {
    prompt.hidden = true;
    prompt.innerHTML = "";
  }
  if (graph) graph.hidden = false;
  const modal = document.getElementById("ctxModal");
  if (modal) {
    modal.dataset.ctxHub = `${n.kind || ""}:${n.ident || n.id || ""}`;
    modal.classList.add("open");
  }
  renderTopicContext();
}

function closeTopicContext() {
  stopTopicContextAnim();
  ctxMountGen += 1;
  const el = document.getElementById("ctxModal");
  if (el) {
    el.classList.remove("open");
    delete el.dataset.ctxHub;
  }
  ctxSelected = "";
  ctxTopic = null;
  ctxTab = "graph";
  const $map = document.getElementById("ctxMap");
  const $detail = document.getElementById("ctxDetail");
  const prompt = document.getElementById("ctxPrompt");
  const graph = document.getElementById("ctxBodyGraph");
  if ($map) $map.innerHTML = "";
  if ($detail) $detail.innerHTML = "";
  if (prompt) {
    prompt.hidden = true;
    prompt.innerHTML = "";
  }
  if (graph) graph.hidden = false;
}



function craftDetailOf(n) {
  return (n && n.craft_detail && typeof n.craft_detail === "object") ? n.craft_detail : {};
}

function craftContextOf(n) {
  return (n && n.context_detail && typeof n.context_detail === "object") ? n.context_detail : {};
}

function libListHtml(items) {
  const arr = (items || []).filter(Boolean);
  if (!arr.length) return "";
  return `<ul class="lib-list">${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function libKvHtml(rows) {
  const bits = rows.filter(([, v]) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v) && !v.length) return false;
    return true;
  }).map(([label, val]) => {
    const body = Array.isArray(val) ? libListHtml(val) : `<dd>${esc(String(val))}</dd>`;
    if (Array.isArray(val)) {
      return `<div><dt>${esc(label)}</dt>${body}</div>`;
    }
    return `<div><dt>${esc(label)}</dt>${body}</div>`;
  });
  return bits.length ? `<dl class="lib-kv">${bits.join("")}</dl>` : "";
}

function libSubtypeLabel(n) {
  return n.atom_type || n.form || n.claim_type || n.kind || "";
}

function libPillClass(status) {
  const s = String(status || "").toLowerCase();
  if (["working", "supported", "trial", "hypothesis", "dead", "weakened", "retired", "contradicted"].includes(s)) return s;
  return "";
}

function libReading(n) {
  const st = String(n.status || "").toLowerCase();
  const cd = craftDetailOf(n);
  const usage = cd.usage_runs || [];
  if (n.kind === "claim") {
    if (st === "supported") return t("lib_reading_supported");
    if (st === "weakened") return t("lib_reading_weakened");
    if (st === "retired") return t("lib_reading_retired");
    if (usage.length && usage.every(u => !u.result || u.result === "unknown")) return t("lib_reading_unknown");
    return t("lib_reading_hypothesis");
  }
  if (st === "working") return t("lib_reading_working");
  if (st === "dead") return t("lib_reading_dead");
  if (!usage.length) return t("lib_reading_unused");
  if (usage.every(u => !u.result || u.result === "unknown")) return t("lib_reading_unknown");
  return t("lib_reading_trial");
}

function libFeatureText(n) {
  const d = craftContextOf(n);
  if (n.kind === "claim") return d.claim || n.label || "";
  if (n.kind === "atom") return d.text || n.label || "";
  return n.label || d.title || "";
}

function libWhatHtml(n) {
  const feature = libFeatureText(n);
  const lede = n.kind === "swipe"
    ? (lang === "zh" ? "这是一套可复用的内容结构，不是可直接复制的成稿。" : "A reusable argument structure — not finished copy.")
    : n.kind === "atom"
    ? (lang === "zh" ? "这是一个单独的表达动作。" : "A single reusable writing move.")
    : (lang === "zh" ? "这是一条需要被验证的主张，不是已证实事实。" : "A claim to validate — not a verified fact.");
  return `<section class="lib-section">
    <h3>${esc(t("lib_insp_what"))}</h3>
    <p class="note" style="margin:0">${esc(lede)}</p>
    ${feature ? `<p class="lib-feature">${esc(feature)}</p>` : ""}
  </section>`;
}

function libHowBullets(items) {
  const arr = (items || []).map(x => String(x || "").trim()).filter(Boolean);
  if (!arr.length) return `<p class="lib-how-empty">—</p>`;
  return `<ul class="lib-how-bullets">${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function libHowPanel(tone, label, items) {
  const arr = (items || []).map(x => String(x || "").trim()).filter(Boolean);
  if (!arr.length) return "";
  return `<div class="lib-how-panel ${tone}">
    <div class="lib-how-panel-head">
      <span class="lib-how-dot" aria-hidden="true"></span>
      <p class="lib-how-panel-label">${esc(label)}</p>
    </div>
    ${libHowBullets(arr)}
  </div>`;
}

function libHowSteps(items) {
  const arr = (items || []).map(x => String(x || "").trim()).filter(Boolean);
  if (!arr.length) return "";
  const steps = arr.map((raw, i) => {
    const body = raw.replace(/^\d+[\.\)]\s*/, "").replace(/^\*\*?/, "").replace(/\*\*$/, "").trim() || raw;
    const num = String(i + 1).padStart(2, "0");
    return `<li class="lib-how-step">
      <span class="lib-how-step-num">${num}</span>
      <p class="lib-how-step-body">${esc(body)}</p>
    </li>`;
  }).join("");
  return `<ol class="lib-how-steps">${steps}</ol>`;
}

function libHowHtml(n) {
  const d = craftContextOf(n);
  const useItems = n.kind === "swipe" ? d.when_to_use : d.applies_when;
  const avoidItems = n.kind === "swipe" ? d.when_to_avoid : d.avoid_when;
  const usePanel = libHowPanel("use", t("lib_insp_when_use"), useItems);
  const avoidPanel = libHowPanel("avoid", t("lib_insp_when_avoid"), avoidItems);
  const pairCount = (usePanel ? 1 : 0) + (avoidPanel ? 1 : 0);
  const pair = pairCount
    ? `<div class="lib-how-pair${pairCount === 2 ? " two" : ""}">${usePanel}${avoidPanel}</div>`
    : "";

  let primary = "";
  if (n.kind === "swipe" && (d.beats || []).length) {
    primary = `<div class="lib-how-block">
      <p class="lib-how-block-label">${esc(t("lib_insp_beats"))}</p>
      ${libHowSteps(d.beats)}
    </div>`;
  } else if ((n.kind === "atom" || n.kind === "claim") && (d.procedure || []).length) {
    primary = `<div class="lib-how-block">
      <p class="lib-how-block-label">${esc(t("lib_insp_procedure"))}</p>
      ${libHowSteps(d.procedure)}
    </div>`;
  }

  let extras = "";
  if (n.kind === "swipe" && (d.constraints || []).length) {
    extras += libHowPanel("soft", t("lib_insp_constraints"), d.constraints);
  }
  if (n.kind === "atom" && (d.examples || []).length) {
    extras += `<div class="lib-how-block">
      <p class="lib-how-block-label">${esc(t("lib_insp_examples"))}</p>
      ${libHowBullets(d.examples)}
    </div>`;
  }

  const chips = [];
  if (n.kind === "claim") {
    const metric = d.primary_metric || n.primary_metric || "";
    const conf = d.confidence || n.confidence || "";
    if (metric) chips.push(`<span class="lib-how-chip"><b>${esc(t("lib_insp_metric"))}</b>${esc(metric)}</span>`);
    if (conf) chips.push(`<span class="lib-how-chip"><b>${esc(t("lib_insp_confidence"))}</b>${esc(conf)}</span>`);
  }
  const meta = chips.length ? `<div class="lib-how-meta">${chips.join("")}</div>` : "";

  if (!pair && !primary && !extras && !meta) return "";
  return `<section class="lib-section">
    <h3>${esc(t("lib_insp_how"))}</h3>
    <div class="lib-how">
      ${pair}
      ${primary}
      ${extras}
      ${meta}
    </div>
  </section>`;
}

function libVerifyHtml(n) {
  const cd = craftDetailOf(n);
  const usage = cd.usage_runs || [];
  const pub = cd.published_count || 0;
  const usageLine = usage.length
    ? fillTemplate("lib_insp_used_n", { n: usage.length })
      + (pub ? ` · ${fillTemplate("lib_insp_published_n", { n: pub })}` : "")
    : t("lib_insp_unused");
  const st = n.status || "";
  const win = n.win != null ? `${n.win}w` : "";
  const loss = n.loss != null ? `${n.loss}l` : "";
  const hits = (win || loss) ? [win, loss].filter(Boolean).join(" / ") : "";
  const rows = [
    [t("lib_insp_verify"), st],
    [t("lib_insp_usage"), usageLine],
  ];
  if (n.kind === "claim") {
    rows.push([t("lib_insp_confidence"), n.confidence || craftContextOf(n).confidence || ""]);
    rows.push([t("lib_insp_metric"), n.primary_metric || craftContextOf(n).primary_metric || ""]);
  }
  if (hits) rows.push([t("kv_hits"), hits]);
  return `<section class="lib-section">
    <h3>${esc(t("lib_insp_verify"))}</h3>
    ${libKvHtml(rows)}
    <p class="lib-reading"><strong>${esc(t("lib_insp_reading"))}</strong> · ${esc(libReading(n))}</p>
  </section>`;
}

function libProvReason(code) {
  const map = {
    source: "lib_ctx_why_source",
    selected_by_topic: "lib_ctx_why_topic",
    used_in_run: "lib_ctx_why_run",
    claim_evidence: "lib_ctx_why_evidence",
    related_craft: "lib_ctx_why_related",
  };
  return t(map[code] || code) || code;
}

function libContextHub(n) {
  const cd = craftDetailOf(n);
  const prov = (cd.provenance || []).map(row => ({
    ...row,
    reason: libProvReason(row.reason || ""),
  }));
  return {
    kind: n.kind,
    id: n.id,
    ident: n.ident,
    label: n.label || "",
    status: n.status || "",
    core_judgment: libFeatureText(n),
    constraints: craftContextOf(n).constraints || craftContextOf(n).avoid_when || [],
    provenance: prov,
  };
}

function libGraphHtml(n) {
  const hub = libContextHub(n);
  const cols = topicContextColumns(hub);
  const total = topicContextCount(cols);
  const bits = ["input", "judgment", "evidence", "craft"]
    .filter(col => cols[col].length)
    .map(col => `${t("topic_ctx_col_" + col)} ${cols[col].length}`)
    .join(" · ");
  const head = total
    ? fillTemplate("lib_ctx_read", { n: total })
    : t("lib_ctx_none_short");
  return `<section class="lib-section topic-ctx-card">
    <h3>${esc(t("lib_insp_graph"))}</h3>
    <p class="topic-ctx-summary">${esc(head)}</p>
    ${bits ? `<p class="topic-ctx-bits">${esc(bits)}</p>` : ""}
    <button type="button" class="topic-ctx-open" id="libCtxOpen">${esc(t("lib_insp_open_graph"))}</button>
  </section>`;
}

function libUsageHtml(n) {
  const usage = craftDetailOf(n).usage_runs || [];
  if (!usage.length) return "";
  const items = usage.slice(0, 8).map(u => {
    const runNode = Object.values(byId).find(x => x.kind === "run" && x.ident === u.ident);
    const meta = [u.status, u.result, u.platform].filter(Boolean).join(" · ");
    const attrs = runNode ? `data-goto="${esc(runNode.id)}"` : `data-run-open-ident="${esc(u.ident)}"`;
    return `<button type="button" ${attrs}>
      <div class="u-id">${esc(u.ident)}</div>
      <div class="u-lab">${esc(u.label || "")}</div>
      ${meta ? `<div class="u-meta">${esc(meta)}</div>` : ""}
    </button>`;
  }).join("");
  return `<section class="lib-section">
    <h3>${esc(t("lib_insp_usage"))}</h3>
    <div class="lib-usage">${items}</div>
  </section>`;
}

function libHandoffPrompt(n) {
  const en = lang !== "zh";
  const d = craftContextOf(n);
  const feature = libFeatureText(n);
  const subtype = libSubtypeLabel(n);
  const avoid = (d.avoid_when || d.when_to_avoid || []).slice(0, 3);
  const use = (d.applies_when || d.when_to_use || []).slice(0, 3);
  if (n.kind === "claim") {
    if (en) {
      let body = `Next step: use this claim carefully.\n\nClaim: ${n.ident}\nStatus: ${n.status || "hypothesis"}\nConfidence: ${n.confidence || d.confidence || "low"}\n\nObjective:\n${feature}\n\nPlease:\n1. Treat this as a hypothesis, not a verified fact.\n2. Keep evidence gaps visible.\n3. Obey Applies when / Avoid when.\n4. Write 1–2 draft angles for the current Topic/Run.`;
      if (use.length) body += `\n\nApplies when:\n- ` + use.join("\n- ");
      if (avoid.length) body += `\n\nAvoid when:\n- ` + avoid.join("\n- ");
      return body;
    }
    let body = `下一步：谨慎使用这条主张。\n\n主张：${n.ident}\n状态：${n.status || "hypothesis"}\n置信度：${n.confidence || d.confidence || "low"}\n\n主张内容：\n${feature}\n\n请执行：\n1. 把它当待验证假设，不要写成事实。\n2. 保留证据缺口。\n3. 遵守 Applies when / Avoid when。\n4. 为当前 Topic/Run 写 1–2 个角度。`;
    if (use.length) body += `\n\n适用：\n- ` + use.join("\n- ");
    if (avoid.length) body += `\n\n避免：\n- ` + avoid.join("\n- ");
    return body;
  }
  if (n.kind === "atom") {
    const proc = (d.procedure || []).slice(0, 5);
    if (en) {
      let body = `Next step: apply this craft atom.\n\nAtom: ${n.ident}\nType: ${subtype}\n\nCore move:\n${feature}\n\nPlease:\n1. Read Procedure / Applies when / Avoid when.\n2. Use it as writing structure only — invent no product facts.\n3. Write 2 draft passages for the current theme, keeping voice.`;
      if (proc.length) body += `\n\nProcedure:\n- ` + proc.join("\n- ");
      return body;
    }
    let body = `下一步：使用这个表达原子。\n\n原子：${n.ident}\n类型：${subtype}\n\n核心动作：\n${feature}\n\n请执行：\n1. 先读 Procedure / Applies when / Avoid when。\n2. 只当作写作结构，不要发明产品事实。\n3. 按当前主题写 2 段落地文案，保持语气。`;
    if (proc.length) body += `\n\n写法：\n- ` + proc.join("\n- ");
    return body;
  }
  // swipe
  const beats = (d.beats || []).slice(0, 6);
  if (en) {
    let body = `Next step: apply this swipe structure.\n\nSwipe: ${n.ident}\nForm: ${subtype}\n\nOne-liner:\n${feature}\n\nPlease:\n1. Follow When to use / When to avoid / Constraints.\n2. Reuse the beat structure, not finished copy from sources.\n3. Draft one outline for the current Topic/Run.`;
    if (beats.length) body += `\n\nBeats:\n- ` + beats.join("\n- ");
    return body;
  }
  let body = `下一步：使用这套 Swipe 结构。\n\nSwipe：${n.ident}\n形式：${subtype}\n\n一句话：\n${feature}\n\n请执行：\n1. 遵守 When to use / When to avoid / Constraints。\n2. 复用结构节拍，不要照搬来源成稿。\n3. 为当前 Topic/Run 写一份大纲。`;
  if (beats.length) body += `\n\n节拍：\n- ` + beats.join("\n- ");
  return body;
}

function openLibContext(n) {
  openTopicContext(libContextHub(n));
}

function renderLibInsp(n) {
  const subtype = libSubtypeLabel(n);
  const st = n.status || "";
  const cd = craftDetailOf(n);
  const usage = cd.usage_runs || [];
  const metaBits = [
    subtype,
    n.platforms || n.platform,
    n.profiles || n.profile,
  ].filter(Boolean);
  const usageMeta = usage.length
    ? fillTemplate("lib_insp_used_n", { n: usage.length })
    : t("lib_insp_unused");
  const handoff = libHandoffPrompt(n);
  const mdPath = mdFileForNode(n);

  $insp.innerHTML = `<div class="lib-insp">
    <div class="lib-hero">
      <div class="lib-hero-top">
        ${st ? `<span class="lib-pill ${libPillClass(st)}">${esc(st)}</span>` : ""}
        <span class="lib-pill">${esc(n.kind)}</span>
      </div>
      <p class="title">${esc(n.label || n.ident)}</p>
      <p class="lib-id">${esc(n.ident)}</p>
      ${metaBits.length ? `<p class="lib-meta">${metaBits.map(esc).join(" · ")}</p>` : ""}
      <p class="lib-meta">${esc(usageMeta)}</p>
    </div>

    <section class="lib-section">
      <h3>${esc(t("lib_insp_copy"))}</h3>
      <p class="note" style="margin:0">${esc(t("lib_handoff_lede"))}</p>
      <div class="action-prompt-preview">${esc(handoff)}</div>
      <div class="lib-actions">
        <button type="button" class="primary" id="libCopyPromptBtn">${esc(t("lib_insp_copy"))}</button>
        ${mdPath ? `<button type="button" data-md="${esc(mdPath)}" data-md-title="${esc(n.ident)}">${esc(t("lib_insp_open_md"))}</button>` : ""}
      </div>
    </section>

    ${libWhatHtml(n)}
    ${libHowHtml(n)}
    ${libVerifyHtml(n)}
    ${libGraphHtml(n)}
    ${libUsageHtml(n)}
    <p class="note">${t("readonly")}</p>
  </div>`;

  const cp = $insp.querySelector("#libCopyPromptBtn");
  if (cp) {
    cp.onclick = () => {
      navigator.clipboard.writeText(handoff).then(() => {
        cp.textContent = t("lib_insp_copied");
        setTimeout(() => { cp.textContent = t("lib_insp_copy"); }, 2000);
      });
    };
  }
  const ctxBtn = $insp.querySelector("#libCtxOpen");
  if (ctxBtn) ctxBtn.onclick = () => openLibContext(n);
  $insp.querySelectorAll("[data-goto]").forEach(btn => {
    btn.onclick = () => select(btn.getAttribute("data-goto"));
  });
  $insp.querySelectorAll("[data-run-open-ident]").forEach(btn => {
    btn.onclick = () => {
      const ident = btn.getAttribute("data-run-open-ident");
      const run = Object.values(byId).find(x => x.kind === "run" && x.ident === ident);
      if (run) {
        selected = run.id;
        render();
        openRun(run);
      }
    };
  });
}

function runDetailOf(n) {
  return (n && n.run_detail && typeof n.run_detail === "object") ? n.run_detail : {};
}

function runStageLabel(name) {
  return t("run_stage_" + name) || name;
}

function runPillClass(code) {
  const s = String(code || "").toLowerCase();
  if (s === "published" || s === "reviewed") return s;
  if (s === "ready" || s === "scored") return "ready";
  if (s === "hold" || s === "killed" || s === "overdue" || s === "blocked") return s === "overdue" ? "overdue" : "hold";
  if (s === "scheduled") return "scheduled";
  if (s === "draft" || s === "open" || s === "brief" || s === "drafting") return "draft";
  return "";
}

function runCurrentStage(n) {
  const d = runDetailOf(n);
  if (d.current_stage) return d.current_stage;
  const files = n.stage_files || {};
  return STAGE_ORDER.find(k => files[k]) || "idea";
}

function runStageSummaryLine(name, info) {
  if (!info) return t("run_insp_stage_missing");
  if (info.skipped) return t("run_insp_stage_skip");
  if (!info.exists) return t("run_insp_stage_missing");
  const bits = [];
  if (info.summary) bits.push(info.summary);
  else if (info.status) bits.push(info.status);
  else if (info.done) bits.push(t("run_insp_stage_done"));
  else bits.push(t("run_insp_stage_todo"));
  return bits.join(" · ");
}

function runStagePanelHtml(n, name) {
  const d = runDetailOf(n);
  const info = (d.stages || {})[name] || {};
  const rows = [];
  const push = (label, val) => {
    if (val == null || val === "" || (Array.isArray(val) && !val.length)) return;
    const body = Array.isArray(val) ? val.map(x => `• ${x}`).join("\n") : String(val);
    rows.push(`<div><dt>${esc(label)}</dt><dd>${esc(body)}</dd></div>`);
  };
  if (name === "idea") {
    push(t("run_insp_thesis"), info.summary || d.thesis);
    push(t("run_insp_constraints"), d.constraints);
  } else if (name === "brief") {
    push(t("run_insp_thesis"), info.thesis || info.summary || d.thesis);
    push("For whom", info.for_whom);
    push("Evidence", info.evidence);
    push(t("run_insp_constraints"), info.boundaries);
    if (info.gate_score) push("Gate", `${info.gate_score}${info.gate_pass ? " · pass" : ""}`);
  } else if (name === "packet") {
    push(t("run_insp_thesis"), info.summary);
    push("Hard bans", info.bans);
  } else if (name === "draft") {
    push("Excerpt", info.excerpt || info.summary || d.draft_excerpt);
  } else if (name === "editor") {
    push("Verdict", info.verdict || info.summary);
    push("Why", info.why);
    push("Must fix", info.must_fix);
    push("Optional", info.optional);
  } else if (name === "rubric") {
    push("Total", info.total);
    push("Gate", info.gate);
    push("Ship", info.ship ? "yes" : (info.done ? "—" : ""));
  } else if (name === "pack") {
    push("Status", info.summary || info.status);
    push("Pages", info.page_count);
    push("Platform", info.platform);
  } else if (name === "feedback") {
    push("Result", info.result || info.summary);
    push("URL", info.url);
  }
  if (!rows.length) {
    push("Status", runStageSummaryLine(name, info));
  }
  const openBtn = info.path
    ? `<button type="button" data-run-open="${esc(n.id)}" data-run-stage="${esc(name)}">${esc(t("run_insp_open_stage"))}</button>`
    : "";
  return `<div class="run-rail-panel">
    <dl class="run-kv">${rows.join("")}</dl>
    ${openBtn ? `<div class="run-action-actions">${openBtn}</div>` : ""}
  </div>`;
}

function runActionBody(n) {
  const d = runDetailOf(n);
  const cur = runCurrentStage(n);
  const info = (d.stages || {})[cur] || {};
  const st = String(n.status || "").toLowerCase();
  if (st === "published" || n.is_published) return t("run_action_published");
  if (cur === "rubric" && String(d.editor_verdict || "").toUpperCase() === "APPROVE") {
    return t("run_action_editor_ok");
  }
  if (cur === "editor" && info.done && String(info.verdict || "").toUpperCase() === "APPROVE") {
    return t("run_action_editor_ok");
  }
  return t("run_action_" + cur) || t("run_action_draft");
}

function runHandoffPrompt(n) {
  const en = lang !== "zh";
  const d = runDetailOf(n);
  const cur = runCurrentStage(n);
  const thesis = d.thesis || n.label || "";
  const topic = d.topic_id || n.topic_id || "";
  const platform = n.platform || n.platforms || "";
  const profile = n.profile || n.profile_id || "";
  const stageLab = runStageLabel(cur);
  const action = runActionBody(n);
  const constraints = (d.constraints || []).slice(0, 4);
  if (en) {
    let body = `Next step: continue this Run from ${stageLab}.\n\nRun: ${n.ident}\nStatus: ${n.status || "draft"}\nCurrent stage: ${stageLab}\nPlatform: ${platform || "(unset)"}\nProfile: ${profile || "(unset)"}\nTopic: ${topic || "(unset)"}\n\nThesis:\n${thesis}\n\nWhat to do now:\n${action}\n\nPlease:\n1. Read the current stage file and upstream stages for this Run.\n2. Use the Topic's declared Swipe / Atom / Claim strategy; do not re-select it.\n3. Advance only the current stage (${cur}); do not skip gates.\n4. Keep topic_id and Core judgment intact; invent no evidence.\n5. Write results back into the Run folder.`;
    if (constraints.length) body += `\n\nHard limits:\n- ` + constraints.join("\n- ");
    if (d.next_hint) body += `\n\nIndex note (next): ${d.next_hint}`;
    return body;
  }
  let body = `下一步：从 ${stageLab} 继续这一单。\n\nRun: ${n.ident}\n状态: ${n.status || "draft"}\n当前阶段: ${stageLab}\n平台: ${platform || "（未定）"}\nProfile: ${profile || "（未定）"}\nTopic: ${topic || "（未定）"}\n\n核心命题：\n${thesis}\n\n现在需要你做什么：\n${action}\n\n请执行：\n1. 读取这一单当前阶段文件及上游阶段。\n2. 使用 Topic 已确定的 Swipe / Atom / Claim，不要重新选择。\n3. 只推进当前阶段（${cur}），不要跳闸。\n4. 保持 topic_id 与核心判断；不要发明证据。\n5. 把结果写回 Run 文件夹。`;
  if (constraints.length) body += `\n\n硬边界：\n- ` + constraints.join("\n- ");
  if (d.next_hint) body += `\n\n索引备注（next）: ${d.next_hint}`;
  return body;
}

function runProgressRailHtml(n) {
  const d = runDetailOf(n);
  const stages = d.stages || {};
  const cur = runCurrentStage(n);
  const open = runInspOpenStage || cur;
  const items = STAGE_ORDER.map(name => {
    const info = stages[name] || { exists: !!(n.stage_files || {})[name], done: false };
    let cls = "run-rail-item";
    if (info.done) cls += " done";
    else if (info.skipped) cls += " skipped";
    else if (!info.exists) cls += " missing";
    if (name === cur) cls += " current";
    if (name === open) cls += " open";
    const sub = name === cur
      ? t("run_insp_stage_current")
      : runStageSummaryLine(name, info);
    const panel = name === open ? runStagePanelHtml(n, name) : "";
    return `<li class="${cls}">
      <div class="run-rail-spine"><div class="run-rail-dot"></div></div>
      <div>
        <button type="button" class="run-rail-btn" data-run-rail="${esc(name)}">
          <div class="run-rail-name">${esc(runStageLabel(name))}</div>
          <div class="run-rail-sub">${esc(sub)}</div>
        </button>
        ${panel}
      </div>
    </li>`;
  }).join("");
  return `<section class="run-section">
    <h3>${esc(t("run_insp_progress"))}</h3>
    <ul class="run-rail">${items}</ul>
  </section>`;
}

function runSayHtml(n) {
  const d = runDetailOf(n);
  const thesis = d.thesis || n.label || "";
  if (!thesis) return "";
  return `<section class="run-section">
    <h3>${esc(t("run_insp_say"))}</h3>
    <p class="run-feature">${esc(thesis)}</p>
  </section>`;
}

function runCraftIdents(raw) {
  const out = [];
  for (const part of String(raw || "").split(/[\s,]+/).filter(Boolean)) {
    const clean = part.replace(/^(?:hook|process|visual):/i, "");
    if (clean) out.push(clean);
  }
  return out;
}

function runContextProvenance(n) {
  const d = runDetailOf(n);
  const sel = d.selection || n.selection || {};
  const rows = [];
  const seen = new Set();
  const push = (ident, role, reasonKey) => {
    const id = String(ident || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const live = topicNodeByIdent(id);
    rows.push({
      ident: id,
      role,
      kind: live ? live.kind : (
        id.startsWith("W-") ? "wiki" :
        id.startsWith("S") ? "swipe" :
        id.startsWith("A-") ? "atom" :
        id.startsWith("C-") ? "claim" :
        id.startsWith("T-") ? "topic" :
        id.startsWith("P-") ? "product" : "wiki"
      ),
      epistemic: "",
      reason: t(reasonKey),
    });
  };
  const topic = d.topic_id || n.topic_id || "";
  if (topic) push(topic, "input", "run_ctx_why_topic");
  const topicNode = topic
    ? Object.values(byId).find(x => x.kind === "topic" && x.ident === topic)
    : null;
  for (const row of (topicNode && topicNode.provenance) || []) {
    if (!row || row.role === "constraint") continue;
    const role = row.role === "counter_evidence" ? "evidence" : row.role;
    push(row.ident, role || "input", "run_ctx_why_inherited");
  }
  const inherited = d.inherited_strategy || {};
  for (const id of inherited.swipes || []) push(id, "craft", "run_ctx_why_inherited");
  for (const id of inherited.atoms || []) push(id, "craft", "run_ctx_why_inherited");
  for (const id of inherited.claims || []) push(id, "claim", "run_ctx_why_inherited");
  for (const wid of (d.w_ids || [])) push(wid, "judgment", "run_ctx_why_wiki");
  const packW = (((n.pack_chain || {}).meta || {}).w_ids || "");
  String(packW).split(/[\s,]+/).filter(id => /^W-[A-Za-z0-9-]+$/.test(id)).forEach(wid => push(wid, "judgment", "run_ctx_why_wiki"));
  runCraftIdents(sel.swipe).forEach(id => push(id, "craft", "run_ctx_why_craft"));
  runCraftIdents(sel.atoms).forEach(id => push(id, "craft", "run_ctx_why_craft"));
  runCraftIdents(sel.claim).forEach(id => push(id, "claim", "run_ctx_why_claim"));
  return rows;
}

function runContextHub(n) {
  const d = runDetailOf(n);
  return {
    kind: "run",
    id: n.id,
    ident: n.ident,
    label: n.label || "",
    status: n.status || "",
    core_judgment: d.thesis || n.label || "",
    constraints: d.constraints || [],
    provenance: runContextProvenance(n),
  };
}

function runContextHtml(n) {
  const d = runDetailOf(n);
  const hub = runContextHub(n);
  const cols = topicContextColumns(hub);
  const total = topicContextCount(cols);
  const bits = ["input", "judgment", "evidence", "craft"]
    .filter(col => cols[col].length)
    .map(col => `${t("topic_ctx_col_" + col)} ${cols[col].length}`)
    .join(" · ");
  const head = total
    ? fillTemplate("run_ctx_read", { n: total })
    : t("run_ctx_none_short");
  const cons = (hub.constraints || []).filter(Boolean);
  const drift = d.strategy_drift
    ? `<p class="topic-gap"><span>${esc(t("run_ctx_drift"))}</span>${esc(t("run_ctx_drift_desc"))}</p>`
    : "";
  const hydration = d.hydration || {};
  const hydrationError = (hydration.errors || []).length
    ? `<p class="topic-gap"><span>Context blocked</span>${esc(hydration.errors.join(" "))}</p>`
    : "";
  if (!total && !cons.length && !hydrationError) return "";
  return `<section class="run-section topic-ctx-card">
    <h3>${esc(t("run_insp_context"))}</h3>
    <p class="topic-ctx-summary">${esc(head)}</p>
    ${bits ? `<p class="topic-ctx-bits">${esc(bits)}</p>` : ""}
    ${drift}
    ${hydrationError}
    <button type="button" class="topic-ctx-open" id="runCtxOpen">${esc(t("run_ctx_open"))}</button>
  </section>`;
}

function openRunContext(n) {
  openTopicContext(runContextHub(n));
}

function runArtifactsHtml(n) {
  const d = runDetailOf(n);
  const stages = d.stages || {};
  const chips = STAGE_ORDER.map(name => {
    const info = stages[name] || { exists: !!(n.stage_files || {})[name], done: false, skipped: false };
    let cls = "run-chip";
    let mark = "○";
    if (info.done) { cls += " ok"; mark = "✓"; }
    else if (info.skipped) { cls += " skip"; mark = "–"; }
    else if (info.exists) { cls += " wait"; mark = "●"; }
    const tip = runStageSummaryLine(name, info);
    return `<button type="button" class="${cls}" data-run-rail="${esc(name)}" title="${esc(tip)}">${mark} ${esc(runStageLabel(name))}</button>`;
  }).join("");
  return `<section class="run-section">
    <h3>${esc(t("run_insp_artifacts"))}</h3>
    <div class="run-chips">${chips}</div>
  </section>`;
}

function renderRunInsp(n) {
  const d = runDetailOf(n);
  const cur = runCurrentStage(n);
  if (!runInspOpenStage) runInspOpenStage = cur;
  const stInfo = getPostStatusInfo(n);
  const statusCode = stInfo.code || n.status || "draft";
  const metaBits = [
    n.platform || n.platforms,
    n.profile || n.profile_id,
    (n.lane || "").replace(/_/g, " "),
  ].filter(Boolean);
  const handoff = runHandoffPrompt(n);
  const nextHint = d.next_hint
    ? `<p class="run-meta">${esc(d.next_hint)}</p>`
    : "";
  const calBackHtml = (isProduceRunsSurface() && runTab === "calendar" && calSelectedDate)
    ? `<div style="margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--line);">
        <button type="button" class="ghost-link" id="calBackToDayBtn" style="font-size:12px; font-weight:600; color:var(--accent); display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; background:var(--bg-2); border:1px solid var(--line); cursor:pointer;">
          ← ${esc(t("cal_back_to_day"))} ${esc(calSelectedDate)} ${esc(t("cal_day_list"))}
        </button>
      </div>`
    : "";

  $insp.innerHTML = `${calBackHtml}<div class="run-insp">
    <div class="run-hero">
      <div class="run-hero-top">
        <span class="run-pill ${runPillClass(statusCode)}">${esc(stInfo.label || n.status || "draft")}</span>
        <span class="run-pill stage">${esc(runStageLabel(cur))}</span>
      </div>
      <p class="title">${esc(n.label || n.ident)}</p>
      <p class="run-id">${esc(n.ident)}</p>
      ${metaBits.length ? `<p class="run-meta">${metaBits.map(esc).join(" · ")}</p>` : ""}
      ${nextHint}
    </div>

    <section class="run-section run-action">
      <h3>${esc(t("run_insp_now"))}</h3>
      <p class="run-action-body">${esc(runActionBody(n))}</p>
      <p class="note" style="margin:0">${esc(t("run_insp_handoff_lede"))}</p>
      <div class="action-prompt-preview">${esc(handoff)}</div>
      <div class="run-action-actions">
        <button type="button" class="primary" id="runCopyPromptBtn">${esc(t("run_insp_copy"))}</button>
        <button type="button" data-run-open="${esc(n.id)}" data-run-stage="${esc(cur)}">${esc(t("run_insp_open_full"))}</button>
      </div>
    </section>

    ${runProgressRailHtml(n)}
    ${runSayHtml(n)}
    ${runContextHtml(n)}
    ${runArtifactsHtml(n)}
    <p class="note">${t("readonly")}</p>
  </div>`;

  const calBackBtn = $insp.querySelector("#calBackToDayBtn");
  if (calBackBtn) {
    calBackBtn.onclick = () => {
      selected = null;
      renderInsp();
    };
  }
  const cp = $insp.querySelector("#runCopyPromptBtn");
  if (cp) {
    cp.onclick = () => {
      navigator.clipboard.writeText(handoff).then(() => {
        cp.textContent = t("run_insp_copied");
        setTimeout(() => { cp.textContent = t("run_insp_copy"); }, 2000);
      });
    };
  }
  const runCtxBtn = $insp.querySelector("#runCtxOpen");
  if (runCtxBtn) runCtxBtn.onclick = () => openRunContext(n);
  $insp.querySelectorAll("[data-run-rail]").forEach(btn => {
    btn.onclick = () => {
      const name = btn.getAttribute("data-run-rail");
      runInspOpenStage = (runInspOpenStage === name) ? "" : name;
      renderRunInsp(n);
    };
  });
  $insp.querySelectorAll("[data-goto]").forEach(btn => {
    btn.onclick = () => select(btn.getAttribute("data-goto"));
  });
}

function renderTopicInsp(n) {
  const verdict = (n.verdict || n.status || "").trim();
  const usage = (n.usage || "").trim();
  const opp = n.craft || n.opp || n.total || "";
  const aud = n.fit || n.aud || "";
  const metaBits = [
    n.platform,
    n.lane,
    (n.generation_mode || "").replace(/_/g, " "),
    n.profile || n.profile_id,
  ].filter(Boolean);
  const score = (opp || aud)
    ? fillTemplate("topic_score_line", { opp: opp || "—", aud: aud || "—" })
    : "";
  const pillClass = (v) => {
    const s = String(v || "").toLowerCase();
    if (s === "ready") return "ready";
    if (s === "unused") return "unused";
    if (s === "promoted") return "promoted";
    if (s === "killed" || s === "discard") return "killed";
    return "";
  };
  const runId = (n.run_id || "").trim();
  const runNode = runId ? (Object.values(byId).find(x => x.kind === "run" && x.ident === runId) || null) : null;
  const openRunBtn = runNode
    ? `<button type="button" class="btn-primary" data-run-open="${esc(runNode.id)}">${esc(t("topic_already_run"))}</button>`
    : "";
  const handoff = topicHandoffPrompt(n);

  $insp.innerHTML = `<div class="topic-insp">
    <div>
      <p class="kicker">${esc(kindName(n.kind))} · ${esc(n.ident)}</p>
      <p class="title">${esc(n.label)}</p>
      <div class="topic-status-row">
        ${verdict ? `<span class="topic-pill ${pillClass(verdict)}">${esc(verdict)}</span>` : ""}
        ${usage ? `<span class="topic-pill ${pillClass(usage)}">${esc(usage)}</span>` : ""}
        ${score ? `<span class="topic-score">${esc(score)}</span>` : ""}
      </div>
      ${metaBits.length ? `<p class="topic-meta-line">${metaBits.map(esc).join('<span class="sep">·</span>')}</p>` : ""}
    </div>

    <div class="action-prompt-card">
      <div class="action-prompt-head">
        <span class="action-prompt-title">${esc(t("topic_open_as_run"))}</span>
        <button type="button" class="action-prompt-btn" id="copyPromptBtn"><span id="copyPromptBtnText">${esc(t("topic_copy_handoff"))}</span></button>
      </div>
      <p class="action-prompt-lede">${esc(t("topic_handoff_lede"))}</p>
      <div class="action-prompt-preview">${esc(handoff)}</div>
      ${openRunBtn ? `<div class="media-link-actions" style="margin-top:4px">${openRunBtn}</div>` : ""}
    </div>

    ${topicDecisionHtml(n)}
    ${topicReadyHtml(n)}
    ${topicContextSummaryHtml(n)}
    ${mdActionsHtml(n)}
    <p class="note">${t("readonly")}</p>
  </div>`;

  const ctxBtn = $insp.querySelector("#topicCtxOpen");
  if (ctxBtn) ctxBtn.onclick = () => openTopicContext(n);
  const cpBtn = $insp.querySelector("#copyPromptBtn");
  if (cpBtn) {
    cpBtn.onclick = () => {
      navigator.clipboard.writeText(handoff).then(() => {
        const txt = cpBtn.querySelector("#copyPromptBtnText");
        if (txt) {
          txt.textContent = t("topic_handoff_copied");
          setTimeout(() => { txt.textContent = t("topic_copy_handoff"); }, 2000);
        }
      });
    };
  }
  $insp.querySelectorAll("[data-copy-ident]").forEach(btn => {
    btn.onclick = () => {
      const ident = btn.getAttribute("data-copy-ident");
      const toCopy = `[[${ident}]]`;
      navigator.clipboard.writeText(toCopy).then(() => {
        const origHtml = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> <span>${t("copy_ident_done")}</span>`;
        setTimeout(() => { btn.innerHTML = origHtml; }, 1800);
      });
    };
  });
}

function getAiActionPrompt(n) {
  const en = lang !== "zh";
  const k = n.kind;
  const name = `${n.ident}${n.label || n.caption ? " · " + (n.label || n.caption) : ""}`;

  if (k === "media") {
    const ready = mediaIsReady(n);
    const links = Array.isArray(n.links) ? n.links.join(" ") : String(n.links || "");
    const path = n.src || n.path || `media/${n.file || ""}`;
    if (!ready) {
      return en
        ? `Next step: set up this image for the knowledge graph.\n\nImage: ${name}\nFile: ${path}\n\nPlease look at the image, then:\n1. Write a one-line caption of what it shows.\n2. Suggest who it belongs to (P-*/R-*/C-*/RUN-*/W-*) if clear; otherwise ask me.\n3. Write caption + links into media/_index.md.\n4. Do not edit any W- judgment / Parts that fit / Evidence.`
        : `下一步：完善这张图，让它能进知识图谱。\n\n图片：${name}\n文件：${path}\n\n请先看图，然后：\n1. 用一句话写清画面内容（caption）。\n2. 若能判断属于谁，建议 P-*/R-*/C-*/RUN-*/W-*；不确定就问我。\n3. 把 caption + links 写入 media/_index.md。\n4. 不要改任何 W- 判断 / Parts that fit / Evidence。`;
    }
    const nbr = mediaDirectEdges(n.id).map(e => `${e.node.ident} (${e.rel})`).join(", ") || (en ? "none" : "无");
    return en
      ? `Next step: use this image.\n\nImage: ${name}\nCaption: ${n.caption || ""}\nHung on: ${nbr}\n\nPlease suggest which Run/page it fits. Do not edit W- judgments unless I confirm.`
      : `下一步：使用这张图。\n\n图片：${name}\n说明：${n.caption || ""}\n已挂：${nbr}\n\n请建议它适合哪些 Run/页。未经确认不要改 W- 判断。`;
  }

  if (k === "topic") {
    return topicHandoffPrompt(n);
  }
  if (k === "wiki") {
    return en
      ? `Next step: strengthen this judgment.\n\nLesson: ${name}\nConfidence: ${n.confidence || "high"}\n\nPlease write a short memo: 2 counterfactuals, 3 supporting points, 2 topic directions.`
      : `下一步：加固这条认知判断。\n\n笔记：${name}\n置信度：${n.confidence || "高"}\n\n请写一份短备忘：2 个反事实、3 条支撑、2 个可派生选题。`;
  }
  if (k === "run") {
    return runHandoffPrompt(n);
  }
  if (k === "need") {
    return en
      ? `Next step: turn this audience quote into topics.\n\nNeed: ${name}\nVerbatim: "${n.quote || n.label || ""}"\n\nPlease propose 3 topic angles, each with a matching W- judgment and action.`
      : `下一步：把这条听众原话做成选题。\n\n需求：${name}\n原声："${n.quote || n.label || ""}"\n\n请给 3 个选题角度，每个配一条 W- 判断和行动建议。`;
  }
  if (k === "hit") {
    return en
      ? `Next step: mine craft from this hit.\n\nHit: ${name}\n\nPlease extract the hook structure and formulas worth saving to Swipe/Atom.`
      : `下一步：从这条命中拆表达零件。\n\nHit：${name}\n\n请拆钩子结构，并提炼可进 Swipe/Atom 的公式。`;
  }
  if (k === "swipe" || k === "atom" || k === "claim") {
    return libHandoffPrompt(n);
  }
  return en
    ? `Next step: decide what to do with this item.\n\nItem: ${name}\nKind: ${k}\n\nPlease explain its upstream/downstream links and recommend one concrete next action.`
    : `下一步：决定这条要怎么处理。\n\n条目：${name}\n类型：${k}\n\n请说明上下游关联，并给出一个具体下一步。`;
}

function renderInsp() {
  if (view === "brand" && !($q.value || "").trim()) {
    $insp.innerHTML = `
      <div class="brand-stage-panel">
        <p class="kicker">${esc(t("brand_looks"))}</p>
        <div class="brand-frame" id="brandFrame"></div>
      </div>`;
    mountBrandPreview();
    return;
  }
  if (!selected || !byId[selected]) {
    if (view === "overview") {
      renderVaultInsp();
    } else if (isProduceRunsSurface() && runTab === "calendar") {
      renderCalendarSidebar(calSelectedDate);
    } else {
      $insp.innerHTML = `<div class='empty'><strong>${t("empty_t")}</strong>${t("empty_b")}</div>`;
    }
    return;
  }
  const n = byId[selected];
  if (n.kind === "profile") {
    renderProfileInsp(n);
    return;
  }
  if (n.kind === "topic") {
    renderTopicInsp(n);
    return;
  }
  if (n.kind === "run") {
    renderRunInsp(n);
    return;
  }
  if (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") {
    renderLibInsp(n);
    return;
  }
  const ctx = connected(n.id);
  const byKind = {};
  for (const k of TRACE_ORDER) byKind[k] = ctx.filter(x => x.kind === k);
  const kv = Object.entries({
    [t("kv_kind")]: kindName(n.kind),
    [t("kv_date")]: n.date,
    [t("kv_status")]: n.kind === "wiki" ? (n.state || n.status || "") : n.status,
    Confidence: n.kind === "wiki" ? (n.confidence || "") : "",
    [t("kv_refs")]: (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") ? String(n.refs ?? 0) : "",
    [t("kv_hits")]: (n.kind === "swipe" || n.kind === "atom" || n.kind === "claim") && n.n != null
      ? `${n.win || 0}w / ${n.loss || 0}l / n=${n.n}`
      : "",
    [t("kv_pillar")]: formatPillar(n.pillar),
    [t("kv_lane")]: n.kind === "topic" ? (n.lane || "") : "",
    [t("kv_mode")]: n.kind === "topic" ? (n.generation_mode || "") : "",
    [t("kv_plat")]: n.platform || n.platforms,
    [t("kv_profile")]: n.profile || n.profile_id || (n.profiles || ""),
    [t("kv_score")]: n.fit ? `${n.craft} opp / ${n.fit} aud` : n.total,
    [t("kv_use")]: n.usage,
    [t("kv_src")]: n.kind === "hit" ? (n.source || "") : n.source_type,
    [t("kv_hit_kind")]: n.kind === "hit" ? (n.hit_kind || "") : "",
    [t("kv_signal")]: n.kind === "hit" ? (n.signal || "") : "",
    Keyword: n.kind === "hit" ? (n.keyword_id || "") : "",
    [t("kv_hit_source")]: n.kind === "hit" ? (n.source || "") : "",
    [t("kv_needs")]: n.kind === "topic" ? (n.need_ids || "") : "",
    Quote: n.kind === "need" ? (n.quote || "") : "",
    Excerpt: n.kind === "hit" ? (n.excerpt || "") : "",
    Speaker: n.kind === "need" ? (n.speaker || "") : "",
    Frequency: n.kind === "need" ? (n.frequency || "") : "",
    Topics: n.kind === "need" ? (n.topic_ids || "") : "",
    Products: n.kind === "topic" ? (n.product_ids || "") : "",
    "Product fit": n.kind === "topic" ? (n.product_fit || "") : "",
    [t("kv_recs")]: n.kind === "topic" ? (n.recommendation_ids || "") : "",
    Audience: n.kind === "product" ? (n.audience || "") : "",
    Price: n.kind === "product" ? (n.price || "") : "",
    "Effective from": n.kind === "product" ? (n.effective_from || "") : "",
    Category: n.kind === "recommendation" ? (n.category || "") : "",
    Relationship: n.kind === "recommendation" ? (n.relationship || "") : "",
    "Last researched": n.kind === "recommendation" ? (n.last_researched || "") : "",
    Handle: n.source_handle || n.src_handle || "",
    [t("kv_heat_at")]: (n.kind === "capture" || n.kind === "hit") ? (n.engagement_at || "") : "",
    [t("kv_result")]: n.result,
  }).filter(([, v]) => v);
  const kwMeta = n.kind === "hit" && n.keyword_id
    ? (GRAPH.keywords || []).find(k => k.id === n.keyword_id && (!n.profile || k.profile === n.profile))
    : null;
  const kwBlock = n.kind === "hit" && n.keyword_id
    ? `<p class="note"><button type="button" class="kw-chip" data-kw-filter="${esc(n.keyword_id)}">${esc(n.keyword_id)}</button>${kwMeta ? ` · ${esc([kwMeta.layer, kwMeta.intent, kwMeta.why].filter(Boolean).join(" · "))}` : ""}</p>`
    : "";
  const heatBlock = (n.kind === "capture" || n.kind === "hit")
    ? `${heatStripHtml(n, { hint: true })}${n.source_url ? `<p class="note">${t("src_url")}<a href="${esc(n.source_url)}" target="_blank" rel="noreferrer">${esc(n.source_url)}</a></p>` : ""}`
    : "";

  let calBackHtml = "";
  if (isProduceRunsSurface() && runTab === "calendar") {
    calBackHtml = `
      <div style="margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--line);">
        <button type="button" class="ghost-link" id="calBackToDayBtn" style="font-size:12px; font-weight:600; color:var(--accent); display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; background:var(--bg-2); border:1px solid var(--line); cursor:pointer;">
          ← ${esc(t("cal_back_to_day"))} ${esc(calSelectedDate || "")} ${esc(t("cal_day_list"))}
        </button>
      </div>
    `;
  }

  const mediaSrc = n.kind === "media" && n.src ? vaultFetchUrl(n.src) : "";
  const mediaPreview = mediaSrc
    ? `<div class="insp-media-preview"><img src="${esc(mediaSrc)}" alt="${esc(n.caption || n.label || n.ident)}"></div>`
    : "";
  const mediaGraphPanel = n.kind === "media" ? mediaGraphPanelHtml(n) : "";
  const showAgentPrompt = !(n.kind === "media" && mediaIsReady(n));
  const agentPromptHtml = showAgentPrompt
    ? `<div class="action-prompt-card">
      <div class="action-prompt-head">
        <span class="action-prompt-title">${t("prompt_box_title")}</span>
        <button type="button" class="action-prompt-btn" id="copyPromptBtn"><span id="copyPromptBtnText">${t("prompt_copy_btn")}</span></button>
      </div>
      <p class="action-prompt-lede">${esc(t("prompt_box_lede"))}</p>
      <div class="action-prompt-preview">${esc(getAiActionPrompt(n))}</div>
    </div>`
    : "";
  $insp.innerHTML = `${calBackHtml}<h2>${t("obj")}</h2>
    <p class="kicker">${esc(kindName(n.kind))} · ${esc(n.ident)}</p>
    <p class="title">${n.kind === "run" ? `<button type="button" class="ghost-link title-btn" data-run-open="${esc(n.id)}">${esc(n.label)}</button>` : esc(n.label)}</p>
    ${mediaPreview}
    ${mediaGraphPanel}
    <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${kwBlock}
    ${heatBlock}
    ${n.kind === "swipe" || n.kind === "atom" ? `<p class="note">${esc(t("lib_use_hist"))}</p>` : ""}
    ${n.kind === "claim" ? `<p class="note">${esc(t("lib_claim_ev"))}</p>` : ""}
    ${sourceBlockHtml(n, ctx)}
    ${n.url && n.kind === "published" ? `<p><a href="${esc(n.url)}" target="_blank" rel="noreferrer">${esc(n.url)}</a></p>
      ${n.reviewable ? "" : `<p class='warn'>${t("thin_warn")}</p>`}` : ""}
    ${n.kind === "run" ? runMetaHtml(n) : ""}
    
    ${mdActionsHtml(n)}
    ${agentPromptHtml}
    <h2>${t("trace")}</h2>
    <div class="trace" id="trace"></div>
    <p class="note">${t("readonly")}</p>`;
  const calBackBtn = $insp.querySelector("#calBackToDayBtn");
  if (calBackBtn) {
    calBackBtn.onclick = () => {
      selected = null;
      renderInsp();
    };
  }
  $insp.querySelectorAll("[data-goto]").forEach(btn => {
    btn.onclick = () => select(btn.getAttribute("data-goto"));
  });
  if (n.kind === "media") bindMediaGraphPanel($insp, n);
  bindKwFilters($insp);

  const cpBtn = $insp.querySelector("#copyPromptBtn");
  if (cpBtn) {
    const promptText = getAiActionPrompt(n);
    cpBtn.onclick = () => {
      navigator.clipboard.writeText(promptText).then(() => {
        const txt = cpBtn.querySelector("#copyPromptBtnText");
        if (txt) {
          txt.textContent = t("prompt_copied");
          setTimeout(() => { txt.textContent = t("prompt_copy_btn"); }, 2000);
        }
      });
    };
  }
  $insp.querySelectorAll("[data-copy-ident]").forEach(btn => {
    btn.onclick = () => {
      const ident = btn.getAttribute("data-copy-ident");
      const toCopy = `[[${ident}]]`;
      navigator.clipboard.writeText(toCopy).then(() => {
        const origHtml = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> <span>${t("copy_ident_done")}</span>`;
        setTimeout(() => { btn.innerHTML = origHtml; }, 1800);
      });
    };
  });

  const trace = $insp.querySelector("#trace");
  for (const k of TRACE_ORDER) {
    const items = k === "published" ? publishedFor(n, ctx) : (byKind[k] || []);
    const step = document.createElement("div");
    step.className = "tstep";
    const here = items.some(x => x.id === n.id);
    const on = items.length > 0;
    step.innerHTML = `<div class="tspine"><div class="dot${on ? " on" : ""}${here ? " here" : ""}"></div><div class="rail"></div></div>`;
    const body = document.createElement("div");
    body.className = "tcard";
    const lab = document.createElement("div");
    lab.className = "note";
    lab.textContent = kindName(k);
    body.appendChild(lab);
    if (!items.length) {
      const v = document.createElement("div");
      v.className = "vacant";
      v.textContent = t("vacant");
      body.appendChild(v);
    } else {
      items.forEach(item => {
        const b = document.createElement("button");
        if (item.source_url && item.kind === "raw") {
          b.innerHTML = `${esc(item.ident)}  ${esc(item.label.slice(0, 48))}<br><span class="note">${esc(item.source_url)}</span>`;
        } else {
          b.textContent = `${item.ident}  ${item.label.slice(0, 72)}`;
        }
        b.onclick = () => {
          if (item.kind === "run") {
            selected = item.id;
            render();
            openRun(item);
            return;
          }
          select(item.id);
          const md = mdFileForNode(item);
          if (md) openMd(md, item.ident);
        };
        body.appendChild(b);
      });
    }
    step.appendChild(body);
    trace.appendChild(step);
  }
}

async function boot() {
  try {
    await loadLiveGraph();
  } catch (err) {
    console.warn("workbench live graph unavailable; using baked snapshot if present", err);
  }
  applyChrome();
  render();
  watchVault();
}
boot();

  