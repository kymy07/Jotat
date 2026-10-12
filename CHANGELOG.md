# Changelog

All notable changes to Jotara. Versions follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

## [1.1.0] — 2026-10-13

### Changed
- Renamed the app from **Snippit** to **Jotara** — logo, page titles, copy, README and workflow.
- GitHub repository renamed to `kymy07/Jotara`; the site now lives at https://kymy07.github.io/Jotara/.
- Version global renamed `SNIPPIT_VERSION` → `JOTARA_VERSION`.

### Unchanged
- Firebase project ID stays `snippit-f17e8` (project IDs cannot be renamed); existing accounts and notes are unaffected.

## [1.0.0] — 2026-10-13

First release.

### Added
- Landing page in the vintage-editorial style (single ink colour, oversized headlines, film grain).
- Email / password sign-up, log-in, *Remember me* and password reset (Firebase Authentication).
- Notes app: create, autosave, search, pin, copy, delete; live sync via Firebase Realtime Database.
- Snap & scan: in-app camera (front / back) or upload, photo attached to the note.
- OCR with Tesseract.js — English and Bahasa Melayu — appended into the note.
- Mobile layout: list ↔ full-screen editor, floating actions, phone back gesture.
- Database rules limiting each user to `users/{uid}`.
- GitHub Actions deploy to GitHub Pages with Firebase config injection and health check.
