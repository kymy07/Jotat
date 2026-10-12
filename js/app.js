import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  ref, push, set, update, get, onValue, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import {
  EMOJI, SYMBOLS, TEMPLATES, createPad, recognizeInk, prepareForOcr, cleanOcrText, exportNote,
  CODE_LANGUAGES, langFromFilename, langInfo,
} from "./tools.js";

const $ = (s) => document.querySelector(s);
const el = {
  app: $("#app"),
  list: $("#noteList"),
  count: $("#noteCount"),
  search: $("#searchInput"),
  title: $("#titleInput"),
  status: $("#saveStatus"),
  metaDate: $("#metaDate"),
  metaWords: $("#metaWords"),
  empty: $("#emptyState"),
  pin: $("#pinBtn"),
  sheet: $("#sheet"),
  paper: $("#paperSelect"),
  attachment: $("#attachment"),
  attachmentImg: $("#attachmentImg"),
  ocrBtn: $("#ocrBtn"),
  ocrProgress: $("#ocrProgress"),
  ocrLabel: $("#ocrLabel"),
  ocrFill: $("#ocrFill"),
  camModal: $("#camModal"),
  camVideo: $("#camVideo"),
  fileInput: $("#fileInput"),
  fileInputGallery: $("#fileInputGallery"),
  toast: $("#toast"),
};

let user = null;
let notes = {};
let currentId = null;
let saveTimer = null;
let loadingContent = false;
let contentReady = Promise.resolve(); // resolves when the open note is loaded and editable
const pendingHtml = {};      // template HTML to apply once a new note opens
let camStream = null;
let camTarget = "new";      // "new" = create a note from the capture, otherwise attach to current note
let facing = "environment";
let ocrWorker = null;
let ocrBusy = false;
let currentImage = null;    // full-resolution image of the open note (used for OCR)

const isMobile = () => matchMedia("(max-width: 760px)").matches;
const userPath = () => `users/${user.uid}`;
const notesPath = () => `users/${user.uid}/notes`;
const notePath = (id) => `users/${user.uid}/notes/${id}`;
const imagePath = (id) => `users/${user.uid}/images/${id}`;
const contentPath = (id) => `users/${user.uid}/content/${id}`;

/* ---------------- editor (Quill) ---------------- */
const Font = Quill.import("formats/font");
Font.whitelist = ["serif", "elegant", "display", "hand", "mono"];
Quill.register(Font, true);
const Size = Quill.import("attributors/style/size");
Size.whitelist = ["12px", "14px", "20px", "24px", "32px", "48px"];
Quill.register(Size, true);
Quill.register(Quill.import("attributors/style/align"), true);

const quill = new Quill("#quill", {
  theme: "snow",
  placeholder: "Start writing… or snap a photo and let Jotat read it for you.",
  modules: {
    toolbar: { container: "#toolbar", handlers: { image: () => $("#imageInsertInput").click() } },
    history: { delay: 800, maxStack: 300, userOnly: true },
    // code blocks get a language dropdown and colours from highlight.js
    syntax: window.hljs ? { hljs: window.hljs, languages: CODE_LANGUAGES.map(({ key, label }) => ({ key, label })) } : false,
  },
});
quill.disable();

// The toolbar scrolls sideways on phones, which would clip Quill's dropdowns,
// so open them as fixed-position menus under their button.
document.querySelectorAll("#toolbar .ql-picker").forEach((picker) => {
  const label = picker.querySelector(".ql-picker-label");
  const options = picker.querySelector(".ql-picker-options");
  label.addEventListener("mousedown", () => requestAnimationFrame(() => {
    if (!picker.classList.contains("ql-expanded")) return;
    const r = label.getBoundingClientRect();
    options.style.position = "fixed";
    options.style.right = "auto";
    if (!picker.classList.contains("ql-color-picker")) {
      options.style.width = "max-content";
      options.style.minWidth = `${Math.max(r.width, 120)}px`;
    }
    options.style.top = `${r.bottom + 6}px`;
    options.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - options.offsetWidth - 8))}px`;
  }));
});
$("#toolbar").addEventListener("scroll", () => {
  document.querySelectorAll("#toolbar .ql-picker.ql-expanded").forEach((p) => p.classList.remove("ql-expanded"));
}, { passive: true });

// The last place the caret was, so pickers and pads insert where the user was writing
let lastRange = { index: 0, length: 0 };
quill.on("selection-change", (range) => { if (range) lastRange = range; updateCodeUi(); });
const caret = () => {
  const len = quill.getLength();
  return Math.min(lastRange.index, len - 1);
};
function insertAtCaret(text) {
  const at = caret();
  quill.insertText(at, text, "user");
  quill.setSelection(at + text.length, 0, "silent");
  lastRange = { index: at + text.length, length: 0 };
  return at;
}
function insertImageAtCaret(dataUrl) {
  const at = caret();
  quill.insertEmbed(at, "image", dataUrl, "user");
  quill.insertText(at + 1, "\n", "user");
  quill.setSelection(at + 2, 0, "silent");
  lastRange = { index: at + 2, length: 0 };
}

quill.on("text-change", () => {
  if (loadingContent || !currentId) return;
  scheduleSave();
  updateCodeUi();
});

/* ---------------- code blocks ---------------- */
const codeOpenBtn = $("#codeOpenBtn");
const openCodeTb = $("#openCodeTb");

// The code block the caret is in: its DOM container, full text and language
function codeAt(index) {
  if (index == null) return null;
  const [line] = quill.getLine(Math.min(index, quill.getLength() - 1));
  if (!line || line.statics.blotName !== "code-block") return null;
  const container = line.parent.domNode;
  const lines = [...container.querySelectorAll(".ql-code-block")];
  return {
    container,
    code: lines.map((l) => l.textContent).join("\n"),
    lang: lines[0]?.getAttribute("data-language") || "plain",
  };
}

function updateCodeUi() {
  const range = quill.getSelection();
  const info = range && codeAt(range.index);
  openCodeTb.disabled = !info;
  codeOpenBtn.classList.toggle("hidden", !info);
  if (!info) return;
  const c = info.container.getBoundingClientRect();
  const sheet = el.sheet.getBoundingClientRect();
  codeOpenBtn.style.top = `${c.top - sheet.top + 8}px`;
  codeOpenBtn.style.right = `${sheet.right - c.right + 10}px`;
}
codeOpenBtn.addEventListener("mousedown", (e) => e.preventDefault());

// After "mark as code", guess the language so the colours show straight away
$("#toolbar").addEventListener("click", (e) => {
  if (!e.target.closest("button.ql-code-block")) return;
  const range = quill.getSelection();
  const info = range && codeAt(range.index);
  if (!info || info.lang !== "plain" || info.code.trim().length < 8 || !window.hljs) return;
  const guess = hljs.highlightAuto(info.code, CODE_LANGUAGES.map((l) => l.key).filter((k) => k !== "plain"));
  if (!guess.language || guess.relevance < 3) return;
  const { start, end } = codeBlockRange(range.index);
  quill.formatLine(start, end - start, "code-block", guess.language, "user");
  toast(`Looks like ${langInfo(guess.language).label} — change it at the top-left of the block`, 3200);
});
codeOpenBtn.addEventListener("click", () => openCodeAtCaret());

function openCodeAtCaret() {
  const range = quill.getSelection() || lastRange;
  const info = codeAt(range?.index);
  if (!info) return toast("Put the cursor inside a code block first");
  openCodeViewer(info.code, info.lang);
}

// Index range [start, end) of the whole code block that contains `index`
function codeBlockRange(index) {
  const [line] = quill.getLine(index);
  const container = line.parent;
  const start = quill.getIndex(container);
  return { start, end: start + container.length() };
}

// Insert code on its own lines, formatted as a code block, never merged into a neighbouring block
async function insertCode(code, lang, { select = false } = {}) {
  await contentReady;
  let at = caret();
  if (codeAt(at)) {
    // step out of the block the caret is in: add two plain lines after it and use the second
    const { end } = codeBlockRange(at);
    quill.insertText(end - 1, "\n\n", "user");
    quill.formatLine(end, 2, "code-block", false, "user");
    at = end + 1;
  } else if (at > 0 && quill.getText(at - 1, 1) !== "\n") {
    quill.insertText(at, "\n", "user");
    at++;
  }
  const text = code.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  quill.insertText(at, text + "\n", { "code-block": lang }, "user");
  // select a placeholder so typing replaces it; otherwise put the caret after the block
  const range = select ? { index: at, length: text.length } : { index: at + text.length + 1, length: 0 };
  quill.setSelection(range.index, range.length, "user");
  lastRange = range;
  return at;
}

/* code viewer */
const codeModal = $("#codeModal");
let viewing = { code: "", lang: "plain" };

function openCodeViewer(code, lang) {
  const info = langInfo(lang);
  viewing = { code, lang };
  const lines = code.split("\n").length;
  $("#codeLang").textContent = info.label;
  $("#codeStats").textContent = `${lines} line${lines === 1 ? "" : "s"} · ${code.length} characters`;
  const out = $("#codeOut");
  if (lang !== "plain" && window.hljs?.getLanguage(lang)) {
    out.innerHTML = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } else {
    out.textContent = code;
  }
  $("#codeGutter").textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  codeModal.classList.add("show");
}
function closeCodeViewer() { codeModal.classList.remove("show"); }
$("#codeClose").addEventListener("click", closeCodeViewer);
codeModal.addEventListener("click", (e) => { if (e.target === codeModal) closeCodeViewer(); });
$("#codeWrap").addEventListener("click", () => {
  const on = $("#codeView").classList.toggle("is-wrap");
  $("#codeWrap").setAttribute("aria-pressed", String(on));
});
$("#codeCopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(viewing.code); toast("Code copied"); }
  catch { toast("Copy not allowed by this browser"); }
});
$("#codeDownload").addEventListener("click", () => {
  const base = (el.title.value || "code").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 60) || "code";
  const name = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.${langInfo(viewing.lang).ext}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([viewing.code], { type: "text/plain;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Downloaded ${name}`);
});

/* upload a code file */
let codeFileTarget = "current";
$("#codeFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 300 * 1024) return toast("That file is over 300 KB — too big for a note");
  try {
    const text = await readFile(file, "text");
    const lang = langFromFilename(file.name);
    if (codeFileTarget === "new" || !currentId) createNote({ title: file.name });
    await insertCode(text, lang);
    toast(`Added ${file.name} as ${langInfo(lang).label}`);
  } catch {
    toast("Could not read that file");
  }
});

/* ---------------- helpers ---------------- */
let toastTimer;
function toast(text, ms = 2600) {
  el.toast.textContent = text;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), ms);
}

function formatDate(ts) {
  if (!ts) return "Just now";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return "Today " + d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

const plainText = () => quill.getText().replace(/\n+$/, "").trim();
const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resize(src, max, quality) {
  const img = await loadImage(src);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function readFile(file, as = "dataURL") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    as === "text" ? reader.readAsText(file) : reader.readAsDataURL(file);
  });
}

/* ---------------- auth ---------------- */
onAuthStateChanged(auth, (u) => {
  if (!u) return location.replace("auth.html");
  user = u;
  $("#userName").textContent = u.displayName || u.email.split("@")[0];
  $("#userEmail").textContent = u.email;

  onValue(
    ref(db, notesPath()),
    (snap) => {
      notes = snap.val() || {};
      renderList();
      if (currentId && !notes[currentId]) leaveEditor();
      else if (currentId) renderMeta();
    },
    (err) => toast("Could not load notes — " + err.message)
  );
});

$("#logoutBtn").addEventListener("click", async () => {
  flushSave();
  await signOut(auth);
  location.replace("index.html");
});

/* ---------------- sidebar tabs ---------------- */
function showPane(which) {
  const features = which === "features";
  $("#tabNotes").setAttribute("aria-selected", String(!features));
  $("#tabFeatures").setAttribute("aria-selected", String(features));
  $("#notesPane").classList.toggle("hidden", features);
  $("#featuresPane").classList.toggle("hidden", !features);
  $("#paneTitle").textContent = features ? "Features" : "Notes";
}
$("#tabNotes").addEventListener("click", () => showPane("notes"));
$("#tabFeatures").addEventListener("click", () => showPane("features"));

/* ---------------- list ---------------- */
function sortedNotes() {
  const q = el.search.value.trim().toLowerCase();
  return Object.entries(notes)
    .filter(([, n]) => !q || `${n.title || ""} ${n.body || ""}`.toLowerCase().includes(q))
    .sort(([, a], [, b]) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
}

function renderList() {
  const total = Object.keys(notes).length;
  el.count.textContent = `${total} note${total === 1 ? "" : "s"}`;
  el.list.replaceChildren();

  const items = sortedNotes();
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "list-empty mono-label";
    li.textContent = total ? "No notes match your search." : "No notes yet. Tap “New note”, “Snap & scan”, or open the Features tab.";
    el.list.append(li);
    return;
  }

  for (const [id, n] of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "note-item" + (id === currentId ? " is-active" : "");
    btn.addEventListener("click", () => openNote(id));

    const top = document.createElement("div");
    top.className = "note-item__top";
    const title = document.createElement("span");
    title.className = "note-item__title";
    title.textContent = n.title || "Untitled";
    const date = document.createElement("span");
    date.className = "mono-label";
    date.textContent = formatDate(n.updatedAt);
    top.append(title, date);

    const snip = document.createElement("p");
    snip.className = "note-item__snip";
    snip.textContent = n.body ? n.body.slice(0, 180) : "No text yet";

    const meta = document.createElement("div");
    meta.className = "note-item__meta";
    if (n.pinned) meta.append(tag("Pinned"));
    if (n.hasImage) meta.append(tag("Photo"));
    if (n.ocr) meta.append(tag("Scanned"));
    if (n.hasCode) meta.append(tag("Code"));

    btn.append(top, snip);
    if (meta.children.length) btn.append(meta);
    li.append(btn);
    el.list.append(li);
  }
}

function tag(text) {
  const s = document.createElement("span");
  s.className = "tag";
  s.textContent = text;
  return s;
}

el.search.addEventListener("input", renderList);

/* ---------------- notes CRUD ---------------- */
function createNote(initial = {}, html = "") {
  const r = push(ref(db, notesPath()));
  const data = {
    title: "",
    body: "",
    pinned: false,
    hasImage: false,
    paper: "plain",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...initial,
  };
  // show it instantly; the realtime listener will replace it with the server copy
  notes[r.key] = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
  if (html) pendingHtml[r.key] = html;
  set(r, data).catch((err) => toast("Could not create note — " + err.message));
  showPane("notes");
  renderList();
  openNote(r.key);
  return r.key;
}

function openNote(id) {
  if (id !== currentId) flushSave();
  const n = notes[id];
  if (!n) return;
  currentId = id;
  closePopover();

  el.title.value = n.title || "";
  el.empty.classList.add("hidden");
  el.app.classList.add("show-editor");
  setStatus("Saved");
  setPaper(n.paper || "plain");
  renderList();
  hideAttachment();
  currentImage = null;
  lastRange = { index: 0, length: 0 };

  if (isMobile() && !history.state?.note) history.pushState({ note: true }, "");

  if (n.hasImage) {
    get(ref(db, imagePath(id))).then((snap) => {
      if (currentId === id && snap.exists()) showAttachment(snap.val().data);
    });
  }
  contentReady = loadContent(id, n);
  return contentReady;
}

// Load the rich content; older notes only have plain text in `body`.
// Quill drops edits while disabled, so anything that inserts text awaits contentReady.
async function loadContent(id, n) {
  loadingContent = true;
  quill.disable();
  quill.setText("", "silent");
  try {
    const snap = await get(ref(db, contentPath(id)));
    if (currentId !== id) return;
    if (pendingHtml[id]) {
      quill.setContents(quill.clipboard.convert({ html: pendingHtml[id] }), "silent");
      delete pendingHtml[id];
      loadingContent = false;
      saveNow();
    } else if (snap.exists()) {
      quill.setContents(JSON.parse(snap.val().delta), "silent");
    } else if (n.body) {
      quill.setText(n.body + "\n", "silent");
    }
  } catch (err) {
    toast("Could not load this note — " + err.message);
  } finally {
    if (currentId === id) {
      loadingContent = false;
      quill.enable();
      quill.history.clear();
      quill.getModule("syntax")?.highlight(null, true);
      renderMeta();
    }
  }
}

function closeNote() {
  flushSave();
  currentId = null;
  currentImage = null;
  closePopover();
  codeOpenBtn.classList.add("hidden");
  quill.disable();
  el.empty.classList.remove("hidden");
  el.app.classList.remove("show-editor");
  renderList();
}

// On mobile the editor is a pushed history entry, so the phone's back gesture works too
function leaveEditor() {
  if (history.state?.note) history.back();
  else closeNote();
}
window.addEventListener("popstate", () => { if (currentId) closeNote(); });
$("#backBtn").addEventListener("click", leaveEditor);

function renderMeta() {
  const n = notes[currentId];
  if (!n) return;
  el.metaDate.textContent = "Edited " + formatDate(n.updatedAt);
  el.metaWords.textContent = `${wordCount(plainText())} words`;
  el.pin.classList.toggle("is-on", !!n.pinned);
  el.pin.setAttribute("aria-pressed", String(!!n.pinned));
}

function setStatus(text) { el.status.textContent = text; }

function scheduleSave() {
  setStatus("Saving…");
  el.metaWords.textContent = `${wordCount(plainText())} words`;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const id = currentId;
  if (!id || !notes[id] || loadingContent) return;
  const title = el.title.value;
  const body = plainText().slice(0, 20000);
  const ops = quill.getContents().ops;
  const hasCode = ops.some((op) => op.attributes?.["code-block"]);
  Object.assign(notes[id], { title, body, hasCode });
  // one atomic write: list metadata + the rich content stored separately
  update(ref(db, userPath()), {
    [`notes/${id}/title`]: title,
    [`notes/${id}/body`]: body,
    [`notes/${id}/hasCode`]: hasCode,
    [`notes/${id}/updatedAt`]: serverTimestamp(),
    [`content/${id}`]: { delta: JSON.stringify(ops) },
  })
    .then(() => { if (currentId === id) setStatus("Saved"); })
    .catch((err) => { setStatus("Not saved"); toast("Save failed — " + err.message); });
}

function flushSave() {
  if (saveTimer) saveNow();
}

el.title.addEventListener("input", scheduleSave);
el.title.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); quill.focus(); quill.setSelection(0, 0); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });
window.addEventListener("beforeunload", flushSave);

$("#newBtn").addEventListener("click", () => {
  createNote();
  if (!isMobile()) el.title.focus();
});

el.pin.addEventListener("click", () => {
  if (!currentId) return;
  const pinned = !notes[currentId].pinned;
  notes[currentId].pinned = pinned;
  renderMeta();
  update(ref(db, notePath(currentId)), { pinned });
  toast(pinned ? "Pinned to top" : "Unpinned");
});

function setPaper(paper) {
  el.sheet.dataset.paper = paper;
  el.paper.value = paper;
}
el.paper.addEventListener("change", () => {
  if (!currentId) return;
  setPaper(el.paper.value);
  notes[currentId].paper = el.paper.value;
  update(ref(db, notePath(currentId)), { paper: el.paper.value });
});

$("#deleteBtn").addEventListener("click", async () => {
  if (!currentId) return;
  const id = currentId;
  if (!confirm(`Delete “${el.title.value || "Untitled"}”? This can't be undone.`)) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  leaveEditor();
  try {
    await update(ref(db, userPath()), { [`notes/${id}`]: null, [`images/${id}`]: null, [`content/${id}`]: null });
    toast("Note deleted");
  } catch (err) {
    toast("Delete failed — " + err.message);
  }
});

el.empty.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "new") { createNote(); el.title.focus(); }
  if (action === "snap") openCamera("new");
  if (action === "features") showPane("features");
});

/* ---------------- export menu ---------------- */
const exportMenu = $("#exportMenu");
$("#exportBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = exportMenu.classList.toggle("hidden") === false;
  $("#exportBtn").setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-wrap")) { exportMenu.classList.add("hidden"); $("#exportBtn").setAttribute("aria-expanded", "false"); }
});
exportMenu.addEventListener("click", async (e) => {
  const kind = e.target.closest("[data-export]")?.dataset.export;
  if (!kind || !currentId) return;
  exportMenu.classList.add("hidden");
  const payload = {
    title: el.title.value,
    html: exportHtml(),
    text: plainText(),
    date: formatDate(notes[currentId]?.updatedAt),
  };
  try {
    if (kind === "copy") {
      await navigator.clipboard.writeText([payload.title, payload.text].filter(Boolean).join("\n\n"));
      toast("Copied to clipboard");
    } else {
      exportNote(kind, payload);
      if (kind !== "pdf") toast("Downloaded");
    }
  } catch (err) {
    toast(err.message || "Export failed");
  }
});

function exportHtml() {
  const copy = quill.root.cloneNode(true);
  copy.querySelectorAll(".ql-ui").forEach((n) => n.remove());
  return copy.innerHTML;
}

/* ---------------- toolbar extras ---------------- */
const popover = $("#popover");
let popoverKind = null;

function openPopover(kind, anchor) {
  if (popoverKind === kind) return closePopover();
  popoverKind = kind;
  const sets = kind === "emoji" ? EMOJI : SYMBOLS;
  const tabs = $("#popoverTabs");
  tabs.replaceChildren();
  const names = Object.keys(sets);
  const show = (name) => {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.set === name)));
    const grid = $("#popoverGrid");
    grid.replaceChildren();
    grid.classList.toggle("popover__grid--symbols", kind !== "emoji");
    for (const ch of sets[name].split(" ")) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ch;
      b.title = ch;
      b.addEventListener("mousedown", (ev) => ev.preventDefault());
      b.addEventListener("click", () => insertAtCaret(ch));
      grid.append(b);
    }
  };
  for (const name of names) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.set = name;
    b.textContent = name;
    b.addEventListener("mousedown", (ev) => ev.preventDefault());
    b.addEventListener("click", () => show(name));
    tabs.append(b);
  }
  show(names[0]);
  popover.classList.remove("hidden");
  const r = anchor.getBoundingClientRect();
  const w = Math.min(340, window.innerWidth - 24);
  popover.style.width = `${w}px`;
  popover.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - w - 12))}px`;
  popover.style.top = `${r.bottom + 8}px`;
}
function closePopover() {
  popoverKind = null;
  popover.classList.add("hidden");
}
document.addEventListener("mousedown", (e) => {
  if (!popover.contains(e.target) && !e.target.closest('[data-cmd="emoji"], [data-cmd="symbol"]')) closePopover();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopover(); });

$("#toolbar").addEventListener("mousedown", (e) => {
  // keep the caret in the note while clicking our own toolbar buttons
  if (e.target.closest(".tb-btn")) e.preventDefault();
});
$("#toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest(".tb-btn");
  if (!btn || !currentId) return;
  const cmd = btn.dataset.cmd;
  if (cmd === "undo") quill.history.undo();
  if (cmd === "redo") quill.history.redo();
  if (cmd === "emoji" || cmd === "symbol") openPopover(cmd, btn);
  if (cmd === "date") insertAtCaret(new Date().toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }));
  if (cmd === "handwrite") openPad("write");
  if (cmd === "draw") openPad("draw");
  if (cmd === "voice") openVoice();
  if (cmd === "codefile") { codeFileTarget = "current"; $("#codeFileInput").click(); }
  if (cmd === "opencode") openCodeAtCaret();
});

$("#imageInsertInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !currentId) return;
  try {
    insertImageAtCaret(await resize(await readFile(file), 1400, 0.82));
  } catch {
    toast("Could not add that picture");
  }
});

/* ---------------- Features tab ---------------- */
function ensureNote(title = "") {
  if (currentId) return currentId;
  return createNote({ title });
}

$("#featuresPane").addEventListener("click", async (e) => {
  const tool = e.target.closest("[data-tool]")?.dataset.tool;
  const template = e.target.closest("[data-template]")?.dataset.template;
  if (template) {
    const t = TEMPLATES[template];
    createNote({ title: t.title }, t.html());
    return;
  }
  switch (tool) {
    case "blank": createNote(); if (!isMobile()) el.title.focus(); break;
    case "snap": openCamera("new"); break;
    case "upload": camTarget = "new"; el.fileInputGallery.click(); break;
    case "handwrite": ensureNote("Handwritten note"); openPad("write"); break;
    case "draw": ensureNote("Sketch"); openPad("draw"); break;
    case "voice": ensureNote("Voice note"); openVoice(); break;
    case "checklist": createNote({ title: TEMPLATES.checklist.title }, TEMPLATES.checklist.html()); break;
    case "import": $("#importInput").click(); break;
    case "code": {
      ensureNote("Code snippet");
      await insertCode("// write or paste your code here", "javascript", { select: true });
      toast("Code block added — pick the language at its top-left");
      break;
    }
    case "codefile": codeFileTarget = "new"; $("#codeFileInput").click(); break;
  }
});

$("#importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await readFile(file, "text");
    const html = text.split(/\r?\n/).map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "<br>"}</p>`).join("");
    createNote({ title: file.name.replace(/\.(txt|md)$/i, "") }, html);
    toast("Imported " + file.name);
  } catch {
    toast("Could not read that file");
  }
});

/* ---------------- draw / handwrite pad ---------------- */
const padModal = $("#padModal");
const pad = createPad($("#padCanvas"), { onChange: () => $("#padHint").classList.toggle("hidden", !pad.isEmpty) });
const DRAW_COLORS = ["#151515", "#5b5b57", "#8a1c1c", "#c2410c", "#a16207", "#3f6212", "#0f766e", "#1e3a8a", "#6d28d9", "#be185d"];
let padLang = "en";
let lastInsert = null;     // { at, length } of the last converted word, so a candidate can replace it

const swatches = $("#swatches");
DRAW_COLORS.forEach((c, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  b.style.background = c;
  b.setAttribute("aria-label", `Colour ${i + 1}`);
  b.setAttribute("aria-pressed", String(i === 0));
  b.addEventListener("click", () => {
    pad.state.color = c;
    pad.state.erase = false;
    $("#eraserBtn").setAttribute("aria-pressed", "false");
    $("#eraserBtn").classList.remove("is-on");
    swatches.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
  });
  swatches.append(b);
});

function selectIn(group, btn) {
  group.querySelectorAll("[role=radio]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
}
$("#drawTools").addEventListener("click", (e) => {
  const b = e.target.closest("[data-size]");
  if (b) { pad.state.size = Number(b.dataset.size); selectIn(b.parentElement, b); }
});
$("#writeTools").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (b) { padLang = b.dataset.lang; selectIn(b.parentElement, b); }
});
$("#eraserBtn").addEventListener("click", () => {
  pad.state.erase = !pad.state.erase;
  $("#eraserBtn").classList.toggle("is-on", pad.state.erase);
  $("#eraserBtn").setAttribute("aria-pressed", String(pad.state.erase));
});

function setPadMode(mode) {
  pad.state.mode = mode;
  const write = mode === "write";
  $("#padTabWrite").setAttribute("aria-selected", String(write));
  $("#padTabDraw").setAttribute("aria-selected", String(!write));
  $("#writeTools").classList.toggle("hidden", !write);
  $("#drawTools").classList.toggle("hidden", write);
  $("#padActionLabel").textContent = write ? "Convert to text" : "Add sketch to note";
  $("#padHint").textContent = write ? "Write a word or a short line here, then tap ✓" : "Draw anything — it's added to your note as a picture";
  $("#candidates").replaceChildren();
  padModal.classList.toggle("is-draw", !write);
  pad.clear();
  lastInsert = null;
}
$("#padTabWrite").addEventListener("click", () => setPadMode("write"));
$("#padTabDraw").addEventListener("click", () => setPadMode("draw"));

function openPad(mode) {
  if (!currentId) return;
  closePopover();
  padModal.classList.add("show");
  setPadMode(mode);
  requestAnimationFrame(() => pad.resize());
}
function closePad() { padModal.classList.remove("show"); }
$("#padClose").addEventListener("click", closePad);
$("#padUndo").addEventListener("click", () => pad.undo());
$("#padClear").addEventListener("click", () => { pad.clear(); $("#candidates").replaceChildren(); });

function showCandidates(list) {
  const box = $("#candidates");
  box.replaceChildren();
  if (list.length < 2) return;
  const label = document.createElement("span");
  label.className = "mono-label";
  label.textContent = "Not right? Pick:";
  box.append(label);
  for (const word of list.slice(1)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "candidate";
    b.textContent = word;
    b.addEventListener("click", () => {
      if (!lastInsert) return;
      quill.deleteText(lastInsert.at, lastInsert.length, "user");
      quill.insertText(lastInsert.at, word + " ", "user");
      lastInsert = { at: lastInsert.at, length: word.length + 1 };
      quill.setSelection(lastInsert.at + lastInsert.length, 0, "silent");
      lastRange = { index: lastInsert.at + lastInsert.length, length: 0 };
      box.replaceChildren();
      toast(`Changed to “${word}”`);
    });
    box.append(b);
  }
}

$("#padAction").addEventListener("click", async () => {
  if (pad.isEmpty) return toast(pad.state.mode === "write" ? "Write something first" : "Draw something first");
  const btn = $("#padAction");
  if (pad.state.mode === "draw") {
    insertImageAtCaret(pad.toImage());
    toast("Sketch added to your note");
    closePad();
    return;
  }
  btn.disabled = true;
  $("#padActionLabel").textContent = "Reading…";
  try {
    const candidates = await recognizeInk(pad.ink(), pad.size(), padLang);
    const word = candidates[0];
    const at = insertAtCaret(word + " ");
    lastInsert = { at, length: word.length + 1 };
    showCandidates(candidates);
    pad.clear();
    toast(`Added “${word}”`);
  } catch (err) {
    toast(err.message.includes("fetch") ? "No connection to the handwriting service" : err.message);
  } finally {
    btn.disabled = false;
    $("#padActionLabel").textContent = "Convert to text";
  }
});

/* ---------------- voice to text ---------------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceModal = $("#voiceModal");
let recognizer = null;
let voiceLang = "en-US";
let voiceFinal = "";

function openVoice() {
  if (!currentId) return;
  if (!SpeechRecognition) return toast("Voice typing needs Chrome, Edge or Safari", 3500);
  voiceFinal = "";
  $("#voiceText").value = "";
  $("#voiceInsert").disabled = true;
  $("#voiceStatus").textContent = "Tap the mic and start talking";
  voiceModal.classList.add("show");
}
function stopVoice() {
  recognizer?.stop();
}
function closeVoice() {
  stopVoice();
  voiceModal.classList.remove("show");
}
$("#voiceClose").addEventListener("click", closeVoice);
$("#voiceLang").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (!b) return;
  voiceLang = b.dataset.lang;
  selectIn(b.parentElement, b);
  if (recognizer) { stopVoice(); }
});
$("#voiceText").addEventListener("input", () => {
  voiceFinal = $("#voiceText").value;
  $("#voiceInsert").disabled = !voiceFinal.trim();
});

$("#micBtn").addEventListener("click", () => {
  if (recognizer) return stopVoice();
  recognizer = new SpeechRecognition();
  recognizer.lang = voiceLang;
  recognizer.continuous = true;
  recognizer.interimResults = true;
  const base = $("#voiceText").value ? $("#voiceText").value.trimEnd() + " " : "";
  voiceFinal = base;
  recognizer.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) voiceFinal += r[0].transcript.trim() + " ";
      else interim += r[0].transcript;
    }
    $("#voiceText").value = voiceFinal + interim;
    $("#voiceInsert").disabled = !$("#voiceText").value.trim();
  };
  recognizer.onerror = (ev) => {
    $("#voiceStatus").textContent = ev.error === "not-allowed" ? "Microphone blocked — allow it in the address bar" : "Didn't catch that — tap the mic to try again";
  };
  recognizer.onend = () => {
    recognizer = null;
    $("#micBtn").classList.remove("is-live");
    $("#micBtn").setAttribute("aria-pressed", "false");
    if (!$("#voiceStatus").textContent.startsWith("Microphone")) $("#voiceStatus").textContent = "Paused — tap the mic to continue";
  };
  recognizer.start();
  $("#micBtn").classList.add("is-live");
  $("#micBtn").setAttribute("aria-pressed", "true");
  $("#voiceStatus").textContent = "Listening… tap again to stop";
});

$("#voiceInsert").addEventListener("click", () => {
  const text = $("#voiceText").value.trim();
  if (!text || !currentId) return;
  const at = caret();
  const prefix = at > 0 && !/\s$/.test(quill.getText(at - 1, 1)) ? " " : "";
  insertAtCaret(prefix + text + " ");
  toast("Added to your note");
  closeVoice();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (padModal.classList.contains("show")) closePad();
  if (codeModal.classList.contains("show")) closeCodeViewer();
  if (voiceModal.classList.contains("show")) closeVoice();
});

/* ---------------- attachments ---------------- */
function showAttachment(src) {
  el.attachmentImg.src = src;
  el.attachment.classList.add("show");
}
function hideAttachment() {
  el.attachment.classList.remove("show");
  el.attachmentImg.removeAttribute("src");
  el.ocrProgress.classList.remove("show");
}

async function handleCapture(dataUrl) {
  const id = camTarget === "new" || !currentId
    ? createNote({ title: "Scan — " + new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short" }) })
    : currentId;
  if (id !== currentId) openNote(id);
  await contentReady;

  try {
    const stored = await resize(dataUrl, 1280, 0.72);
    currentImage = dataUrl;
    showAttachment(stored);
    await set(ref(db, imagePath(id)), { data: stored, createdAt: serverTimestamp() });
    await update(ref(db, notePath(id)), { hasImage: true, updatedAt: serverTimestamp() });
  } catch (err) {
    toast("Could not save photo — " + err.message);
    return;
  }
  runOCR();
}

$("#removeImgBtn").addEventListener("click", async () => {
  if (!currentId) return;
  const id = currentId;
  hideAttachment();
  currentImage = null;
  await update(ref(db, userPath()), { [`images/${id}`]: null, [`notes/${id}/hasImage`]: false });
  toast("Photo removed");
});

/* ---------------- OCR (Tesseract.js, English + Malay) ---------------- */
let ocrStage = "";
function ocrProgress(m) {
  if (m.status === "recognizing text") {
    el.ocrLabel.textContent = `${ocrStage} ${Math.round(m.progress * 100)}%`;
    el.ocrFill.style.width = `${m.progress * 100}%`;
  } else {
    el.ocrLabel.textContent = "Loading OCR engine (first time takes a moment)…";
    el.ocrFill.style.width = `${(m.progress || 0) * 30}%`;
  }
}

async function getWorker() {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) throw new Error("OCR engine failed to load — check your connection.");
  ocrWorker = await Tesseract.createWorker(["eng", "msa"], 1, { logger: ocrProgress });
  await ocrWorker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
  return ocrWorker;
}

async function runOCR() {
  if (ocrBusy || !currentId) return;
  const id = currentId;
  const src = currentImage || el.attachmentImg.src;
  if (!src) return;

  ocrBusy = true;
  await contentReady;
  el.ocrBtn.disabled = true;
  el.ocrFill.style.width = "0%";
  el.ocrLabel.textContent = "Cleaning up the photo…";
  el.ocrProgress.classList.add("show");

  try {
    const worker = await getWorker();
    const { gray, binary } = await prepareForOcr(src);
    // Try the shadow-free version first; if it's unsure, also try the softer grayscale one
    ocrStage = "Reading text…";
    let best = (await worker.recognize(binary)).data;
    if (best.confidence < 70) {
      ocrStage = "Double-checking…";
      const second = (await worker.recognize(gray)).data;
      if (second.confidence > best.confidence) best = second;
    }
    const text = cleanOcrText(best.text);
    const shaky = best.confidence < 45;

    if (!text) {
      toast("No readable text found — try a sharper, closer photo in good light", 3500);
    } else if (currentId === id) {
      const end = quill.getLength() - 1;
      quill.insertText(end, (plainText() ? "\n" : "") + text + "\n", "user");
      update(ref(db, notePath(id)), { ocr: true });
      toast(shaky ? "Text added — some words may be wrong, please check" : "Text added to your note", 3500);
    } else {
      // the user moved to another note while OCR ran: append to the scanned note directly
      const snap = await get(ref(db, contentPath(id)));
      const ops = snap.exists() ? JSON.parse(snap.val().delta) : [{ insert: (notes[id]?.body || "") + "\n" }];
      ops.push({ insert: "\n" + text + "\n" });
      const body = ((notes[id]?.body || "") + "\n" + text).trim().slice(0, 20000);
      await update(ref(db, userPath()), {
        [`content/${id}`]: { delta: JSON.stringify(ops) },
        [`notes/${id}/body`]: body,
        [`notes/${id}/ocr`]: true,
        [`notes/${id}/updatedAt`]: serverTimestamp(),
      });
      toast("Text added to your scanned note");
    }
  } catch (err) {
    toast("OCR failed — " + (err.message || err));
  } finally {
    ocrBusy = false;
    el.ocrBtn.disabled = false;
    el.ocrProgress.classList.remove("show");
  }
}

el.ocrBtn.addEventListener("click", runOCR);

/* ---------------- camera ---------------- */
async function startStream() {
  camStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  el.camVideo.srcObject = camStream;
}

function stopStream() {
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  el.camVideo.srcObject = null;
}

async function openCamera(target) {
  camTarget = target;
  if (!navigator.mediaDevices?.getUserMedia) {
    el.fileInput.click(); // phones without camera API still get the native camera picker
    return;
  }
  try {
    await startStream();
    el.camModal.classList.add("show");
  } catch {
    toast("Camera not available — choose a photo instead");
    el.fileInputGallery.click();
  }
}

function closeCamera() {
  stopStream();
  el.camModal.classList.remove("show");
}

$("#snapBtn").addEventListener("click", () => openCamera("new"));
$("#attachBtn").addEventListener("click", () => openCamera("current"));
$("#camClose").addEventListener("click", closeCamera);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.camModal.classList.contains("show")) closeCamera();
});

$("#camShutter").addEventListener("click", () => {
  const v = el.camVideo;
  if (!v.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  canvas.getContext("2d").drawImage(v, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  closeCamera();
  handleCapture(dataUrl);
});

$("#camFlip").addEventListener("click", async () => {
  facing = facing === "environment" ? "user" : "environment";
  stopStream();
  try { await startStream(); } catch { toast("Could not switch camera"); }
});

$("#camUpload").addEventListener("click", () => {
  closeCamera();
  el.fileInputGallery.click();
});

async function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Please choose an image file");
  handleCapture(await readFile(file));
}
el.fileInput.addEventListener("change", onFilePicked);
el.fileInputGallery.addEventListener("change", onFilePicked);
