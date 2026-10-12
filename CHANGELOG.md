# Changelog

All notable changes to Jotat. Versions follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

## [1.2.0] — 2026-10-13

### Added
- **Code blocks**: select text and tap **</>** to mark it as code — the language is detected automatically and can be
  changed from the dropdown in the block (JavaScript, TypeScript, Python, Java, C/C++, C#, PHP, Go, Rust, SQL,
  HTML, CSS, JSON, Bash, YAML and more), with syntax colours. Inline code too.
- **Upload a code file** (.js, .py, .java, .sql, .html, .css, .json, … up to 300 KB) into a note; the language comes
  from the file extension. Also in the Features tab: *Code snippet* and *Code file*.
- **Open code**: with the cursor in a code block, tap **Open** to view it full-screen with line numbers, word wrap,
  copy and download (saved with the right file extension).
- Notes that contain code are tagged **Code** in the list.

 — 2026-10-13

### Added
- **Rich editor** (Quill): bold, italic, underline, strikethrough; six fonts (Sans, Serif, Elegant, Display,
  Handwriting, Mono); sizes; text colour and highlight; align left / centre / right / justify; bullet, numbered and
  **tick (checklist)** lists; headings, quote, link, pictures; undo / redo.
- **Emoji and symbol pickers** (ticks, arrows, maths, currency incl. RM, punctuation) and insert date & time.
- **Handwrite → text**: write on the pad, tap ✓ and the word is typed into the note, with alternatives to pick
  from if it guessed wrong (English / Bahasa Melayu).
- **Sketch**: draw with colours, brush sizes, eraser and undo; added to the note as a picture.
- **Voice note**: speech to text in English or Bahasa Melayu.
- **Features tab** in the notes app: blank note, snap & scan, photo to text, handwrite, sketch, voice, checklist,
  import .txt / .md, and templates (meeting, class, journal, project, shopping, recipe).
- **Paper styles** per note (plain, lined, grid, dots) and **export** to Word, PDF (print) and plain text.

### Changed
- OCR cleans photos before reading — contrast stretch, shadow removal (adaptive threshold), upscaling small
  images — tries a second pass when unsure, and drops noise lines. Better on uneven light and neat handwriting.
- Formatted note content is stored separately (`users/{uid}/content/{id}`) so the note list stays fast.

## [1.0.0] — 2026-10-13

First release.

### Added
- Landing page: vintage-editorial type with Apple-style frosted glass — floating glass header,
  clear *Start free* / *I have an account* actions, *How it works* (Snap → Read → Keep), features and sign-up band.
- Sign-in page: segmented Log in / Sign up control, **Continue with Google**, email + password with
  *Remember me* and password reset, error messages at the top of the card.
- Notes app: create, autosave, search, pin, copy, delete; live sync via Firebase Realtime Database.
- Snap & scan: in-app camera (front / back) or upload, photo attached to the note.
- OCR with Tesseract.js — English and Bahasa Melayu — appended into the note.
- Mobile layout: list ↔ full-screen editor, floating glass action bar, phone back gesture.
- Firebase project `snippit-f17e8` connected; database rules limit each user to `users/{uid}`.
- Deploys: Netlify at https://jotat.netlify.app/, plus a tag-driven GitHub Pages mirror with health check
  and automatic GitHub Release from this changelog.
