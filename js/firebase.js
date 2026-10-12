import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const configMissing = Object.values(firebaseConfig).some((v) => String(v).startsWith("PASTE_"));

if (configMissing) {
  const bar = document.createElement("div");
  bar.className = "config-warning";
  bar.innerHTML = "Firebase config incomplete — paste your <code>apiKey</code>, <code>messagingSenderId</code> and <code>appId</code> into <code>js/firebase-config.js</code>.";
  document.body.prepend(bar);
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
