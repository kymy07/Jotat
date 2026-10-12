# Snippit

Jot notes, snap photos, and turn printed text into editable notes (OCR, English + Bahasa Melayu).
Static site: HTML/CSS/JS + Firebase Auth + Realtime Database + Tesseract.js.

## Setup
1. Firebase Console → Project settings → General → Your apps → add a **Web app** (</>) if there isn't one.
   Copy `apiKey`, `messagingSenderId` and `appId` into `js/firebase-config.js`.
2. Authentication → Sign-in method → enable **Email/Password**.
3. Realtime Database → Rules → paste the contents of `database.rules.json` → Publish.

## Run locally
ES modules and the camera need http(s), not file://.

    npx serve .        # or: python -m http.server 5500

Open http://localhost:3000 (camera works on localhost; on other devices it needs HTTPS).

## Deploy (Firebase Hosting)

    npm i -g firebase-tools
    firebase login
    firebase deploy

## Data layout
    users/{uid}/profile        name, email, createdAt
    users/{uid}/notes/{id}     title, body, pinned, hasImage, ocr, createdAt, updatedAt
    users/{uid}/images/{id}    data (compressed JPEG data URL, ~100–200 KB)

Images live in the Realtime Database (no Cloud Storage needed on the Spark plan).
