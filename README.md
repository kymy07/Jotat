# Snippit — Notes, Snaps & OCR

A zero-build, mobile-friendly **note-taking web app**. Jot notes, snap a photo
with the camera, and let **OCR** read the printed text into an editable note —
in **English and Bahasa Melayu**. Accounts and notes live in **Firebase**
(Authentication + Realtime Database); everything else is static files, themed
with a vintage-editorial palette
(`#151515` ink · `#D9D9CF` canvas · `#E7E7DF` paper).

Live demo: https://kymy07.github.io/Snippit/

Current version: **1.0.0** — see [CHANGELOG.md](CHANGELOG.md).

Designed as an **editorial / vintage-print interface**: oversized condensed
headlines, a single ink colour for all text, black pill buttons, film grain, and
a camera viewfinder that turns snapshots into searchable notes.

---

## Tech stack

- **Vanilla HTML/CSS/JS** — no build step, no bundler, no framework
- **Firebase Authentication 10.14** — email / password sign-up, log-in, reset
- **Firebase Realtime Database 10.14** — per-user notes and photos, live sync
- **Tesseract.js 5.1** — in-browser OCR, `eng` + `msa` language data
- **MediaDevices `getUserMedia`** — live camera with front / back flip
- **Google Fonts** — Inter Tight (headlines + UI), Instrument Serif (logo), Caveat (hero notes)

Everything except auth and storage runs in the browser. There is no server of
our own and no API besides Firebase.

---

## Folder structure

```
Snippit/
├── index.html               # landing page (hero, features, call to action)
├── auth.html                # log in / sign up (tabs, ?mode=signup opens sign-up)
├── app.html                 # the notes app (list, editor, camera modal)
├── css/style.css            # all styles — tokens, landing, auth, app, responsive
├── js/
│   ├── firebase-config.js   # Firebase web config (apiKey / appId injected at deploy)
│   ├── firebase.js          # initialises Firebase, exports auth + db
│   ├── auth.js              # sign-up, log-in, persistence, password reset
│   ├── app.js               # notes CRUD, autosave, search, camera, OCR
│   └── version.js           # app version shown in the UI (v1.0.0)
├── assets/favicon.svg       # brand mark (four-point spark)
├── database.rules.json      # Realtime Database security rules
├── firebase.json            # Firebase CLI config (rules + optional Hosting)
├── VERSION                  # current version number (1.0.0)
├── CHANGELOG.md             # release notes per version
├── release.sh               # bump version, commit, tag and push a release
├── .firebaserc              # default Firebase project: snippit-f17e8
└── .github/workflows/
    └── deploy.yml           # deploy + GitHub Release on every version tag (v*.*.*)
```

---

## Local development

No install, no build — just serve the folder over HTTP so ES modules and the
camera can load.

```bash
# Python (any 3.x)
python -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000/

> Opening `index.html` directly via `file://` will fail — browsers block ES
> module imports under the file protocol, and the camera needs a secure context
> (`https://` or `http://localhost`).

### Firebase setup

The app talks to the Firebase project **`snippit-f17e8`**
(Realtime Database in `asia-southeast1`). One-time setup in the
[Firebase Console](https://console.firebase.google.com/project/snippit-f17e8):

1. **Project settings → General → Your apps** — add a Web app (`</>`) and copy
   `apiKey`, `messagingSenderId` and `appId`.
2. **Authentication → Sign-in method** — enable **Email/Password**.
3. **Authentication → Settings → Authorized domains** — add `kymy07.github.io`.
4. **Realtime Database → Rules** — paste [`database.rules.json`](database.rules.json) and publish.

The three config values can go in two places:

- **Locally:** paste them into `js/firebase-config.js`.
- **Deploy only:** set the repository secrets `FIREBASE_API_KEY`,
  `FIREBASE_MESSAGING_SENDER_ID` and `FIREBASE_APP_ID`; the workflow injects
  them at deploy time (see *Deployment*).

> **The web `apiKey` is not a secret.** It identifies the Firebase project and
> ships to every browser that opens the site. Data is protected by the
> database rules, which only let a signed-in user read and write
> `users/{their uid}`. Keeping it in secrets just keeps the repo tidy.

While any value is still a `PASTE_…` placeholder, every page shows a black
warning bar at the top.

---

## Features

| # | Feature            | Entry point              | What it does                                                      |
|---|--------------------|--------------------------|-------------------------------------------------------------------|
| 1 | Sign up / log in   | `auth.js`                | Email + password accounts, *Remember me*, password reset by email |
| 2 | Notes list         | `renderList()`           | Pinned first, then newest; tags for *Pinned*, *Photo*, *Scanned*   |
| 3 | Editor + autosave  | `scheduleSave()`         | Saves 600 ms after you stop typing — no save button               |
| 4 | Search             | `#searchInput`           | Live filter across titles and note text                           |
| 5 | Pin / copy / delete| `#pinBtn`, `#copyBtn`    | Pin to top, copy note to clipboard, delete with confirmation      |
| 6 | Snap & scan        | `openCamera()`           | In-app camera (flip front / back) or upload; creates a new note   |
| 7 | Photo attachment   | `handleCapture()`        | Attach a photo to the open note; stored compressed (~100–200 KB)   |
| 8 | OCR                | `runOCR()`               | Reads printed text (English + Malay) and appends it to the note   |
| 9 | Live sync          | `onValue()`              | Edits show up on every signed-in device in real time              |
| 10| Mobile layout      | `@media (max-width:760px)` | List ↔ full-screen editor, floating actions, phone back gesture  |

### Data layout

```
users/{uid}/profile        name, email, createdAt
users/{uid}/notes/{id}     title, body, pinned, hasImage, ocr, createdAt, updatedAt
users/{uid}/images/{id}    data   (compressed JPEG data URL)
```

Photos are kept apart from notes so the list loads without pulling every image;
an image is fetched only when its note is opened. Storing them in the Realtime
Database means no Cloud Storage bucket — the project stays on the free
**Spark** plan.

---

## Theming

All pages share one palette, declared as CSS custom properties at the top of
`css/style.css`.

| Token     | Value                  | Role                                             |
|-----------|------------------------|--------------------------------------------------|
| `--ink`   | `#151515`              | The one text colour — headings, body, buttons    |
| `--bg`    | `#D9D9CF`              | Page canvas — warm grey-beige                    |
| `--paper` | `#E7E7DF`              | Cards, active list row, auth panel               |
| `--line`  | `rgba(21,21,21,.18)`   | Hairline dividers                                |
| `--soft`  | `rgba(21,21,21,.06)`   | Hover fill                                       |

Headlines are Inter Tight 800, uppercase, letter-spacing `-0.055em`, line-height
`0.84`; small labels are 11 px uppercase with `0.08em` tracking. A fixed SVG
noise layer adds the film grain.

---

## Deployment

### GitHub Pages (current)

The site runs at **https://kymy07.github.io/Snippit/**, served as static files
by GitHub Pages — no build step, no container.

Deploys are **driven by version tags**. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
runs when a tag like `v1.0.0` is pushed (or manually: *Actions → Deploy to GitHub Pages → Run workflow*):

1. check that the tag matches `VERSION` and `js/version.js` — a mismatch stops the deploy
2. optionally inject the Firebase config from repository secrets (see *Firebase setup*)
3. stage the site into `_site/`, excluding `.git`, `.github`, Firebase CLI files, docs and `release.sh`, and list every published file in the log
4. upload and deploy to GitHub Pages
5. check that `/`, `auth.html`, `app.html`, the stylesheet and the app script answer 200
6. create a **GitHub Release** for the tag, with that version's notes from `CHANGELOG.md`

Ordinary pushes to `main` do **not** deploy — only a version tag does, so what
is live always matches a numbered release.

Pages must be set to **Settings → Pages → Source: GitHub Actions**. Each run's
log and the deployed URL are visible under the repository's **Actions** tab;
every release is listed under **Releases**.

### Firebase Hosting (alternative)

```bash
npm i -g firebase-tools
firebase login
firebase deploy            # publishes the site + database.rules.json
```

`firebase.json` serves the repository root as-is — there is no `./dist`.

---

## Versioning

Versions follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`,
currently **1.0.0**.

| Change                          | Example          |
|---------------------------------|------------------|
| Bug fix, small tweak            | `1.0.0 → 1.0.1`  |
| New feature, backwards-compatible | `1.0.1 → 1.1.0` |
| Breaking change / redesign      | `1.1.0 → 2.0.0`  |

To release a new version:

1. add a `## [1.0.1] — YYYY-MM-DD` section to [`CHANGELOG.md`](CHANGELOG.md)
2. run the release script (Git Bash on Windows):

```bash
./release.sh 1.0.1
```

It writes the number into `VERSION`, `js/version.js`, the page labels and this
README, commits, tags `v1.0.1` and pushes — the tag push deploys the site and
publishes the GitHub Release. The version shows in the landing footer, the
sign-in header and the notes list.

---

## Notes & limits

- **Camera needs a secure context.** It works on `https://` and
  `http://localhost`; on a plain-HTTP LAN address the app falls back to the
  phone's file / camera picker.
- **First OCR run is slow.** Tesseract downloads its English and Malay language
  data (~10–20 MB) once; the browser caches it after that.
- **OCR reads print, not handwriting.** Clear, well-lit, close-up photos of
  printed text work best; handwriting is unreliable.
- **Photos live in the Realtime Database.** They are resized to 1280 px JPEG to
  stay small, but thousands of photos will grow the database — move them to
  Cloud Storage if that happens.
- **Authorized domains.** Sign-in fails with `auth/unauthorized-domain` until
  the hosting domain is added in Firebase Authentication settings.

---

## Credits

- Auth & database — [Firebase](https://firebase.google.com/) by Google
- OCR engine — [Tesseract.js](https://tesseract.projectnaptha.com/)
- Typefaces — [Inter Tight](https://fonts.google.com/specimen/Inter+Tight),
  [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif),
  [Caveat](https://fonts.google.com/specimen/Caveat) via Google Fonts
