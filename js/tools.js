// Editor helpers that don't touch Firebase: pickers, templates, the drawing /
// handwriting pad, handwriting recognition, OCR image clean-up and exports.

/* ---------------- emoji & symbols ---------------- */
export const EMOJI = {
  "Smileys": "😀 😄 😁 😊 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😇 🤔 🤨 😐 😴 😅 😂 🤣 😭 😢 😤 😡 🤯 😱 🥺 🙄 😬 🤗 🤭 🫡",
  "Hands": "👍 👎 👏 🙌 🙏 💪 👌 ✌️ 🤞 🤝 👋 ✍️ 👉 👈 👆 👇 ☝️ ✋",
  "Hearts": "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💖 💯 ✨ ⭐ 🌟 🔥 💡",
  "Work": "📌 📍 📎 📝 📒 📓 📔 📕 📚 🗂️ 📁 📅 🗓️ ⏰ ⏳ ✅ ☑️ ❌ ⚠️ ❗ ❓ 💬 📣 🔔 🔒 🔑 💼 📊 📈 📉 💰 🧾 🏷️",
  "Life": "🏠 🚗 ✈️ 🏖️ 🎉 🎂 🎁 🎓 🏆 ⚽ 🎵 🎧 📷 🍽️ ☕ 🍔 🍕 🍜 🍎 🥗 🛒 💊 🏃 🧘 🌙 ☀️ 🌧️ 🌈 🌸 🌿",
};

export const SYMBOLS = {
  "Marks": "✓ ✔ ✗ ✘ ☐ ☑ ☒ • ◦ ▪ ▫ ■ □ ● ○ ◆ ◇ ★ ☆ ✦ ✧ ※ † ‡ § ¶",
  "Arrows": "→ ← ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔ ➜ ➔ ↳ ↪ ↩ ⟶ ⤴ ⤵ ▶ ◀ ▲ ▼",
  "Maths": "+ − × ÷ = ≠ ≈ ≤ ≥ ± ∞ √ ∑ ∏ π ∆ ∫ ∂ ° % ‰ ½ ¼ ¾ ² ³ ∴ ∵",
  "Money": "RM $ € £ ¥ ₹ ₩ ¢ © ® ™ № ℃ ℉",
  "Punctuation": "“ ” ‘ ’ « » — – … · ¿ ¡ ‹ ›",
};

/* ---------------- templates ---------------- */
const today = () => new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const TEMPLATES = {
  meeting: {
    title: "Meeting notes",
    html: () => `<p><strong>Date:</strong> ${today()}</p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ol><li data-list="ordered">Topic one</li><li data-list="ordered">Topic two</li></ol><h2>Discussion</h2><p></p><h2>Decisions</h2><ol><li data-list="bullet"></li></ol><h2>Action items</h2><ol><li data-list="unchecked">Task — owner — due date</li><li data-list="unchecked"></li></ol>`,
  },
  class: {
    title: "Class notes",
    html: () => `<p><strong>Subject:</strong> &nbsp; <strong>Date:</strong> ${today()}</p><h2>Topic</h2><p></p><h2>Key points</h2><ol><li data-list="bullet"></li><li data-list="bullet"></li></ol><blockquote>Important definition or formula goes here</blockquote><h2>Questions to ask</h2><ol><li data-list="unchecked"></li></ol><h2>Summary</h2><p></p>`,
  },
  journal: {
    title: "Journal — " + new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short" }),
    html: () => `<p><em>${today()}</em></p><h2>How I feel today</h2><p>😊 </p><h2>Three things I'm grateful for</h2><ol><li data-list="ordered"></li><li data-list="ordered"></li><li data-list="ordered"></li></ol><h2>Highlights</h2><p></p><h2>Tomorrow I will…</h2><ol><li data-list="unchecked"></li></ol>`,
  },
  project: {
    title: "Project plan",
    html: () => `<h2>Goal</h2><p>What does done look like?</p><h2>Milestones</h2><ol><li data-list="ordered"><strong>Week 1</strong> — </li><li data-list="ordered"><strong>Week 2</strong> — </li><li data-list="ordered"><strong>Week 3</strong> — </li></ol><h2>Tasks</h2><ol><li data-list="unchecked"></li><li data-list="unchecked"></li><li data-list="unchecked"></li></ol><h2>Risks &amp; notes</h2><blockquote></blockquote>`,
  },
  shopping: {
    title: "Shopping list",
    html: () => `<h2>🥬 Fresh</h2><ol><li data-list="unchecked"></li></ol><h2>🥫 Pantry</h2><ol><li data-list="unchecked"></li></ol><h2>🧴 Household</h2><ol><li data-list="unchecked"></li></ol>`,
  },
  recipe: {
    title: "Recipe",
    html: () => `<p><strong>Serves:</strong> &nbsp; <strong>Time:</strong> </p><h2>Ingredients</h2><ol><li data-list="unchecked"></li><li data-list="unchecked"></li></ol><h2>Steps</h2><ol><li data-list="ordered"></li><li data-list="ordered"></li></ol><h2>Notes</h2><p></p>`,
  },
  checklist: {
    title: "To-do",
    html: () => `<ol><li data-list="unchecked"></li></ol>`,
  },
};

/* ---------------- drawing / handwriting pad ---------------- */
export function createPad(canvas, { onChange } = {}) {
  const ctx = canvas.getContext("2d");
  const state = { strokes: [], color: "#151515", size: 4, erase: false, mode: "write", start: 0 };
  let current = null;
  let width = 0, height = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function drawStroke(s) {
    const pts = s.points;
    if (!pts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], s.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, width, height);
    state.strokes.forEach(drawStroke);
  }

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, Math.round(performance.now() - state.start)];
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    canvas.setPointerCapture(e.pointerId);
    if (!state.strokes.length) state.start = performance.now();
    const writing = state.mode === "write";
    current = {
      color: writing ? "#151515" : state.color,
      size: writing ? 4 : state.size * (state.erase ? 4 : 1),
      erase: !writing && state.erase,
      points: [point(e)],
    };
    state.strokes.push(current);
    drawStroke(current);
    onChange?.();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!current) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) current.points.push(point(ev));
    redraw();
  });
  const end = () => { current = null; onChange?.(); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  new ResizeObserver(resize).observe(canvas);

  return {
    state,
    resize,
    get isEmpty() { return !state.strokes.some((s) => !s.erase); },
    clear() { state.strokes = []; redraw(); onChange?.(); },
    undo() { state.strokes.pop(); redraw(); onChange?.(); },
    // Ink in the format the handwriting service expects: per stroke [xs, ys, times]
    ink() {
      return state.strokes.filter((s) => !s.erase).map((s) => [
        s.points.map((p) => Math.round(p[0])),
        s.points.map((p) => Math.round(p[1])),
        s.points.map((p) => p[2]),
      ]);
    },
    size() { return { width: Math.round(width), height: Math.round(height) }; },
    // Flatten onto white, crop to the drawing, and compress for storage
    toImage(max = 1200) {
      const box = bounds(state.strokes, width, height, 24);
      const scale = Math.min(1, max / Math.max(box.w, box.h));
      const out = document.createElement("canvas");
      out.width = Math.round(box.w * scale);
      out.height = Math.round(box.h * scale);
      const o = out.getContext("2d");
      o.fillStyle = "#ffffff";
      o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, box.x * (canvas.width / width), box.y * (canvas.height / height),
        box.w * (canvas.width / width), box.h * (canvas.height / height), 0, 0, out.width, out.height);
      return out.toDataURL("image/jpeg", 0.88);
    },
  };
}

function bounds(strokes, w, h, pad) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const s of strokes) {
    if (s.erase) continue;
    for (const [x, y] of s.points) {
      x1 = Math.min(x1, x - s.size); y1 = Math.min(y1, y - s.size);
      x2 = Math.max(x2, x + s.size); y2 = Math.max(y2, y + s.size);
    }
  }
  if (x1 === Infinity) return { x: 0, y: 0, w, h };
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(w, x2 + pad); y2 = Math.min(h, y2 + pad);
  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

/* ---------------- handwriting recognition (free, stroke-based) ---------------- */
// Google Input Tools handwriting endpoint: free and keyless, but unofficial.
const HANDWRITING_URL = "https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8";

export async function recognizeInk(ink, { width, height }, language = "en") {
  const res = await fetch(HANDWRITING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      options: "enable_pre_space",
      requests: [{ writing_guide: { writing_area_width: width, writing_area_height: height }, ink, language }],
    }),
  });
  if (!res.ok) throw new Error(`Handwriting service error (${res.status})`);
  const data = await res.json();
  if (data[0] !== "SUCCESS" || !data[1]?.[0]?.[1]?.length) throw new Error("Couldn't read that — try writing a little bigger");
  return [...new Set(data[1][0][1].map((c) => c.trim()).filter(Boolean))].slice(0, 6);
}

/* ---------------- OCR image clean-up ---------------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Returns two cleaned versions of a photo for Tesseract:
//  gray   — upscaled, grayscale, contrast-stretched (good for print and neat handwriting)
//  binary — adaptive (Bradley) threshold, which removes shadows and uneven light
export async function prepareForOcr(src) {
  const img = await loadImage(src);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const scale = Math.min(2400 / Math.max(w0, h0), Math.max(1, 1400 / Math.min(w0, h0)));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const n = w * h;

  // grayscale + histogram
  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const g = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) | 0;
    gray[i] = g; hist[g]++;
  }
  // stretch between the 1st and 99th percentile
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.01) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / range));

  const grayUrl = toUrl(gray);

  // Bradley adaptive threshold via an integral image
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += gray[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + row;
    }
  }
  const s = Math.max(16, Math.round(Math.max(w, h) / 24)) >> 1;
  const T = 0.14;
  const bin = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - s), y2 = Math.min(h - 1, y + s);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - s), x2 = Math.min(w - 1, x + s);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)] - integral[y1 * (w + 1) + (x2 + 1)]
        - integral[(y2 + 1) * (w + 1) + x1] + integral[y1 * (w + 1) + x1];
      bin[y * w + x] = gray[y * w + x] * count <= sum * (1 - T) ? 0 : 255;
    }
  }
  return { gray: grayUrl, binary: toUrl(bin) };

  function toUrl(values) {
    const out = ctx.createImageData(w, h);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      out.data[j] = out.data[j + 1] = out.data[j + 2] = values[i];
      out.data[j + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL("image/png");
  }
}

// Drop lines that are mostly OCR noise (stray marks read as symbols)
export function cleanOcrText(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => {
      if (!l) return true;
      const letters = (l.match(/[\p{L}\p{N}]/gu) || []).length;
      return letters >= 2 && letters / l.replace(/\s/g, "").length >= 0.5;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------------- export ---------------- */
const fileName = (title) => (title || "Untitled").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "Untitled";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const EXPORT_CSS = `
  body { font-family: "Inter Tight", Arial, sans-serif; color: #151515; line-height: 1.6; font-size: 12pt; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1.doc-title { font-size: 30pt; line-height: 1; letter-spacing: -0.03em; text-transform: uppercase; margin: 0 0 6px; }
  .doc-meta { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; border-bottom: 1px solid #151515; padding-bottom: 12px; margin-bottom: 20px; }
  h1, h2, h3 { line-height: 1.15; } blockquote { border-left: 3px solid #151515; margin: 12px 0; padding: 4px 14px; font-style: italic; }
  img { max-width: 100%; border-radius: 8px; } li[data-list="checked"] { text-decoration: line-through; }
  .ql-font-serif { font-family: Lora, Georgia, serif; } .ql-font-elegant { font-family: "Playfair Display", Georgia, serif; }
  .ql-font-display { font-family: "Instrument Serif", Georgia, serif; } .ql-font-hand { font-family: Caveat, cursive; font-size: 1.3em; }
  .ql-font-mono { font-family: "JetBrains Mono", Consolas, monospace; }
  .ql-align-center { text-align: center; } .ql-align-right { text-align: right; } .ql-align-justify { text-align: justify; }`;

export function exportNote(kind, { title, html, text, date }) {
  const name = fileName(title);
  if (kind === "txt") {
    download(new Blob([`${title || "Untitled"}\n\n${text}`], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
    return;
  }
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Untitled")}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;800&family=Lora&family=Playfair+Display&family=Instrument+Serif&family=Caveat&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>${EXPORT_CSS}</style></head><body>
<h1 class="doc-title">${escapeHtml(title || "Untitled")}</h1><div class="doc-meta">Jotat · ${escapeHtml(date)}</div>
${html}</body></html>`;
  if (kind === "doc") {
    download(new Blob(["﻿", doc], { type: "application/msword" }), `${name}.doc`);
  } else if (kind === "pdf") {
    const win = window.open("", "_blank");
    if (!win) throw new Error("Allow pop-ups to print or save as PDF");
    win.document.write(doc);
    win.document.close();
    win.addEventListener("load", () => setTimeout(() => win.print(), 300));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
