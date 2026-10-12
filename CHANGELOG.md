# Changelog

All notable changes to Jotat. Versions follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

## [1.0.0] — 2026-10-13

First release.

### Notes and editor
- Rich editor (Quill): bold, italic, underline, strikethrough; six fonts (Sans, Serif, Elegant, Display,
  Handwriting, Mono); sizes; text colour and highlight; align left / centre / right / justify; bullet, numbered and
  **tick (checklist)** lists; headings, quote, link, pictures; undo / redo.
- Emoji and symbol pickers (ticks, arrows, maths, currency incl. RM, punctuation) and insert date & time.
- **Code blocks**: mark text as code with **</>** (language auto-detected, changeable in the block, syntax colours),
  inline code, upload a code file (.js, .py, .java, .sql, .html, … up to 300 KB), and **Open** a block full-screen
  with line numbers, wrap, copy and download. Notes with code are tagged **Code**.
- Paper styles per note (plain, lined, grid, dots); export to Word, PDF (print) and plain text.
- Autosave, search, pin, delete; live sync via Firebase Realtime Database.

### Ways to add a note (Features tab)
- Blank note, checklist, import .txt / .md, code snippet, code file.
- Templates: meeting, class, journal, project, shopping, recipe.
- **Handwrite → text**: write on the pad, tap ✓ and the word is typed into the note, with alternatives if it guessed
  wrong (English / Bahasa Melayu).
- **Sketch**: colours, brush sizes, eraser and undo; added to the note as a picture.
- **Voice note**: speech to text in English or Bahasa Melayu.
- **Snap & scan / photo to text**: in-app camera or upload; OCR (Tesseract.js, English + Malay) after photo clean-up —
  contrast stretch, shadow removal, upscaling — with a second pass when unsure.

### Look and accounts
- Vintage-editorial type with Apple-style frosted glass across landing, sign-in and notes; subtle motion effects.
- Sign in with **Google** or email + password (*Remember me*, password reset).
- Mobile layout: list ↔ full-screen editor, swipeable toolbar, bottom-sheet pads, phone back gesture.

### Platform
- Firebase project `snippit-f17e8`; database rules limit each user to `users/{uid}`.
- Deploys: Netlify at https://jotat.netlify.app/, plus a tag-driven GitHub Pages mirror with health check and an
  automatic GitHub Release from this changelog.
