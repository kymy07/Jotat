import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  ref, push, set, update, remove, get, onValue, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const $ = (s) => document.querySelector(s);
const el = {
  app: $("#app"),
  list: $("#noteList"),
  count: $("#noteCount"),
  search: $("#searchInput"),
  title: $("#titleInput"),
  body: $("#bodyInput"),
  status: $("#saveStatus"),
  metaDate: $("#metaDate"),
  metaWords: $("#metaWords"),
  empty: $("#emptyState"),
  pin: $("#pinBtn"),
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
let camStream = null;
let camTarget = "new";      // "new" = create a note from the capture, otherwise attach to current note
let facing = "environment";
let ocrWorker = null;
let ocrBusy = false;
let currentImage = null;    // full-resolution image of the open note (used for OCR)

const isMobile = () => matchMedia("(max-width: 760px)").matches;
const notesPath = () => `users/${user.uid}/notes`;
const notePath = (id) => `users/${user.uid}/notes/${id}`;
const imagePath = (id) => `users/${user.uid}/images/${id}`;

/* ---------------- helpers ---------------- */
let toastTimer;
function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
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
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
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
    li.textContent = total ? "No notes match your search." : "No notes yet. Tap “New note” or “Snap & scan” to begin.";
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
function createNote(initial = {}) {
  const r = push(ref(db, notesPath()));
  const data = {
    title: "",
    body: "",
    pinned: false,
    hasImage: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...initial,
  };
  // show it instantly; the realtime listener will replace it with the server copy
  notes[r.key] = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
  set(r, data).catch((err) => toast("Could not create note — " + err.message));
  renderList();
  openNote(r.key);
  return r.key;
}

function openNote(id) {
  if (id !== currentId) flushSave();
  const n = notes[id];
  if (!n) return;
  currentId = id;

  el.title.value = n.title || "";
  el.body.value = n.body || "";
  el.empty.classList.add("hidden");
  el.app.classList.add("show-editor");
  setStatus("Saved");
  renderMeta();
  renderList();
  hideAttachment();

  if (isMobile() && !history.state?.note) history.pushState({ note: true }, "");

  if (n.hasImage) {
    get(ref(db, imagePath(id))).then((snap) => {
      if (currentId === id && snap.exists()) showAttachment(snap.val().data);
    });
  }
}

function closeNote() {
  flushSave();
  currentId = null;
  currentImage = null;
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
  el.metaWords.textContent = `${wordCount(el.body.value)} words`;
  el.pin.classList.toggle("is-on", !!n.pinned);
  el.pin.setAttribute("aria-pressed", String(!!n.pinned));
}

function setStatus(text) { el.status.textContent = text; }

function scheduleSave() {
  setStatus("Saving…");
  el.metaWords.textContent = `${wordCount(el.body.value)} words`;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}

function saveNow() {
  saveTimer = null;
  const id = currentId;
  if (!id || !notes[id]) return;
  const changes = { title: el.title.value, body: el.body.value };
  Object.assign(notes[id], changes);
  update(ref(db, notePath(id)), { ...changes, updatedAt: serverTimestamp() })
    .then(() => { if (currentId === id) setStatus("Saved"); })
    .catch((err) => { setStatus("Not saved"); toast("Save failed — " + err.message); });
}

function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
}

el.title.addEventListener("input", scheduleSave);
el.body.addEventListener("input", scheduleSave);
el.title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.body.focus(); } });
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

$("#copyBtn").addEventListener("click", async () => {
  const text = [el.title.value, el.body.value].filter(Boolean).join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Copy not allowed by this browser");
  }
});

$("#deleteBtn").addEventListener("click", async () => {
  if (!currentId) return;
  const id = currentId;
  if (!confirm(`Delete “${el.title.value || "Untitled"}”? This can't be undone.`)) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  leaveEditor();
  try {
    await Promise.all([remove(ref(db, notePath(id))), remove(ref(db, imagePath(id)))]);
    toast("Note deleted");
  } catch (err) {
    toast("Delete failed — " + err.message);
  }
});

el.empty.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "new") { createNote(); el.title.focus(); }
  if (action === "snap") openCamera("new");
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
  await remove(ref(db, imagePath(id)));
  await update(ref(db, notePath(id)), { hasImage: false });
  toast("Photo removed");
});

/* ---------------- OCR (Tesseract.js, English + Malay) ---------------- */
function ocrProgress(m) {
  if (m.status === "recognizing text") {
    el.ocrLabel.textContent = `Reading text… ${Math.round(m.progress * 100)}%`;
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
  return ocrWorker;
}

async function runOCR() {
  if (ocrBusy || !currentId) return;
  const id = currentId;
  const src = currentImage || el.attachmentImg.src;
  if (!src) return;

  ocrBusy = true;
  el.ocrBtn.disabled = true;
  el.ocrFill.style.width = "0%";
  el.ocrLabel.textContent = "Preparing image…";
  el.ocrProgress.classList.add("show");

  try {
    const worker = await getWorker();
    const input = await resize(src, 2000, 0.92);
    const { data } = await worker.recognize(input);
    const text = data.text.replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      toast("No readable text found — try a sharper, closer photo");
    } else if (currentId === id) {
      el.body.value = el.body.value.trim() ? `${el.body.value.trimEnd()}\n\n${text}` : text;
      saveNow();
      update(ref(db, notePath(id)), { ocr: true });
      toast("Text added to your note");
    } else {
      const body = notes[id]?.body?.trim() ? `${notes[id].body.trimEnd()}\n\n${text}` : text;
      update(ref(db, notePath(id)), { body, ocr: true, updatedAt: serverTimestamp() });
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

function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Please choose an image file");
  const reader = new FileReader();
  reader.onload = () => handleCapture(reader.result);
  reader.readAsDataURL(file);
}
el.fileInput.addEventListener("change", onFilePicked);
el.fileInputGallery.addEventListener("change", onFilePicked);
