# Changelog

All notable changes to Jotat. Versions follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`.

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
