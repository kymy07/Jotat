import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const $ = (s) => document.querySelector(s);
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const msg = $("#msg");
let busy = false; // stops the auth listener redirecting mid-signup

const COPY = {
  login: { title: "Welcome<br>back.", sub: "Log in to pick up where you left off — every note, photo and scan is waiting.", doc: "Jotara — Log in" },
  signup: { title: "Start<br>jotting.", sub: "Create a free account. Your notes stay private to you and sync across every device.", doc: "Jotara — Sign up" },
};

function setMode(mode) {
  const isSignup = mode === "signup";
  $("#tabLogin").setAttribute("aria-selected", String(!isSignup));
  $("#tabSignup").setAttribute("aria-selected", String(isSignup));
  loginForm.classList.toggle("hidden", isSignup);
  signupForm.classList.toggle("hidden", !isSignup);
  $("#bigTitle").innerHTML = `${COPY[mode].title}<small id="bigSub">${COPY[mode].sub}</small>`;
  document.title = COPY[mode].doc;
  history.replaceState(null, "", isSignup ? "?mode=signup" : location.pathname);
  hideMsg();
}

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.classList.add("show");
  msg.classList.toggle("ok", ok);
}
function hideMsg() { msg.classList.remove("show"); }

function friendly(err) {
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-email": "Please enter your email.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Sign up instead?",
    "auth/email-already-in-use": "That email already has an account. Try logging in.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed": "Network error — check your connection.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase Authentication yet.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API key missing or invalid — check js/firebase-config.js.",
  };
  return map[err.code] || err.message.replace("Firebase: ", "");
}

function setLoading(form, on, label) {
  const btn = form.querySelector('button[type="submit"]');
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.disabled = on;
  btn.textContent = on ? label : btn.dataset.label;
}

$("#tabLogin").addEventListener("click", () => setMode("login"));
$("#tabSignup").addEventListener("click", () => setMode("signup"));
document.querySelectorAll(".toggle-pw").forEach((b) =>
  b.addEventListener("click", () => {
    const input = b.previousElementSibling;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  })
);

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  const { email, password, remember } = loginForm.elements;
  if (!email.value || !password.value) return showMsg("Enter your email and password.");
  busy = true;
  setLoading(loginForm, true, "Logging in…");
  try {
    await setPersistence(auth, remember.checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    location.replace("app.html");
  } catch (err) {
    busy = false;
    showMsg(friendly(err));
    setLoading(loginForm, false);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  const { name, email, password, confirm } = signupForm.elements;
  if (!name.value.trim()) return showMsg("What should we call you?");
  if (password.value.length < 6) return showMsg("Password needs at least 6 characters.");
  if (password.value !== confirm.value) return showMsg("Passwords don't match.");
  busy = true;
  setLoading(signupForm, true, "Creating account…");
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
    await updateProfile(user, { displayName: name.value.trim() });
    await set(ref(db, `users/${user.uid}/profile`), {
      name: name.value.trim(),
      email: user.email,
      createdAt: serverTimestamp(),
    });
    location.replace("app.html");
  } catch (err) {
    busy = false;
    showMsg(friendly(err));
    setLoading(signupForm, false);
  }
});

$("#forgotBtn").addEventListener("click", async () => {
  const email = loginForm.elements.email.value.trim();
  if (!email) return showMsg("Type your email above first, then tap “Forgot password?” again.");
  try {
    await sendPasswordResetEmail(auth, email);
    showMsg(`Reset link sent to ${email}. Check your inbox (and spam).`, true);
  } catch (err) {
    showMsg(friendly(err));
  }
});

onAuthStateChanged(auth, (user) => {
  if (user && !busy) location.replace("app.html");
});

setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "login");
