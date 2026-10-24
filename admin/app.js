import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, limit, getDocs, getCountFromServer,
  doc, getDoc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const users = collection(db, "users");
const cfgRef = doc(db, "config", "app");

function say(id, text, ok) { const e = $(id); e.textContent = text; e.className = "msg " + (ok ? "ok" : "bad"); }
function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return Math.round(s / 86400) + " d ago";
}
async function count(q) { return (await getCountFromServer(q)).data().count; }
const since = (ms) => Timestamp.fromMillis(Date.now() - ms);

function bars(id, map) {
  const box = $(id); box.innerHTML = "";
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = rows.length ? rows[0][1] : 1;
  rows.forEach(([k, v]) => {
    const d = document.createElement("div");
    d.innerHTML = '<span></span><i></i><b></b>';
    d.children[0].textContent = k || "unknown";
    d.children[1].style.width = Math.max(3, (v / max) * 100) + "%";
    d.children[2].textContent = v;
    box.appendChild(d);
  });
}

async function load() {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const [live, today, week, month, fresh, total] = await Promise.all([
    count(query(users, where("lastSeen", ">", since(12 * 60e3)))),
    count(query(users, where("lastSeen", ">", Timestamp.fromDate(midnight)))),
    count(query(users, where("lastSeen", ">", since(7 * 86400e3)))),
    count(query(users, where("lastSeen", ">", since(30 * 86400e3)))),
    count(query(users, where("firstSeen", ">", Timestamp.fromDate(midnight)))),
    count(users)
  ]);
  $("s-live").textContent = live; $("s-today").textContent = today; $("s-week").textContent = week; $("s-month").textContent = month;
  $("s-new").textContent = fresh; $("s-total").textContent = total;

  const snap = await getDocs(query(users, orderBy("lastSeen", "desc"), limit(300)));
  const ver = {}, ctry = {}, os = {}, rows = [];
  snap.forEach((d) => {
    const u = d.data();
    ver[u.v || "?"] = (ver[u.v || "?"] || 0) + 1;
    ctry[u.country || "?"] = (ctry[u.country || "?"] || 0) + 1;
    os["Android " + (u.os || "?")] = (os["Android " + (u.os || "?")] || 0) + 1;
    rows.push(u);
  });
  bars("b-ver", ver); bars("b-country", ctry); bars("b-os", os);
  const tb = $("t-users"); tb.innerHTML = "";
  rows.slice(0, 50).forEach((u) => {
    const tr = document.createElement("tr");
    [u.model || "?", u.os || "?", u.v || "?", u.country || "?", u.opens || 0, u.lastSeen ? ago(u.lastSeen.toMillis()) : "?"]
      .forEach((t) => { const td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
    tb.appendChild(tr);
  });

  const c = await getDoc(cfgRef);
  const d = c.exists() ? c.data() : {};
  $("m-on").checked = !!d.maintenanceOn;
  $("m-title").value = d.maintenanceTitle || "";
  $("m-msg").value = d.maintenanceMessage || "";
  $("u-current").textContent = d.updCode
    ? "Published: version " + (d.updName || d.updCode) + " (code " + d.updCode + ")" + (d.updForce ? " - FORCED" : "") + ". 64-bit link: " + (d.updArm64 ? "yes" : "no") + ", 32-bit link: " + (d.updArm32 ? "yes" : "no") + "."
    : "No update is published.";
  if (d.updCode && !$("u-name").value) {
    $("u-name").value = d.updName || ""; $("u-code").value = d.updCode; $("u-notes").value = d.updNotes || "";
    $("u-arm64").value = d.updArm64 || ""; $("u-arm32").value = d.updArm32 || ""; $("u-x86").value = d.updX86 || "";
    $("u-sha64").value = d.updSha64 || ""; $("u-sha32").value = d.updSha32 || ""; $("u-shax").value = d.updShaX86 || "";
    $("u-force").checked = !!d.updForce;
  }
  $("a-current").textContent = d.annId ? 'Current message: "' + (d.annTitle || "") + '" (id ' + d.annId + ')' : "No message is active.";
}

async function saveConfig(patch) { await setDoc(cfgRef, patch, { merge: true }); }

$("signin").onclick = async () => {
  try { await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value); }
  catch (e) { $("login-msg").textContent = "Could not sign in: " + (e.code || e.message); }
};
$("signout").onclick = () => signOut(auth);
$("refresh").onclick = () => load().catch((e) => alert("Could not load: " + (e.code || e.message)));

$("m-save").onclick = async () => {
  try {
    await saveConfig({ maintenanceOn: $("m-on").checked, maintenanceTitle: $("m-title").value.trim(), maintenanceMessage: $("m-msg").value.trim() });
    say("m-out", $("m-on").checked ? "Maintenance mode is ON." : "Maintenance mode is off.", true);
  } catch (e) { say("m-out", "Could not save: " + (e.code || e.message), false); }
};
$("a-send").onclick = async () => {
  const title = $("a-title").value.trim(), msg = $("a-msg").value.trim();
  if (!msg) { say("a-out", "Write a message first.", false); return; }
  const url = $("a-url").value.trim(), btn = $("a-btn").value.trim();
  if (url && !url.startsWith("https://")) { say("a-out", "The link must start with https://", false); return; }
  const hours = parseInt($("a-exp").value || "0", 10);
  try {
    await saveConfig({
      annId: String(Date.now()), annTitle: title, annMessage: msg, annButtonText: btn, annButtonUrl: url,
      annDismissible: $("a-dismiss").checked,
      annExpiresAt: hours > 0 ? Timestamp.fromMillis(Date.now() + hours * 3600e3) : Timestamp.fromMillis(0),
      annMinVersion: parseInt($("a-min").value || "0", 10), annMaxVersion: parseInt($("a-max").value || "0", 10),
      annCountry: $("a-country").value.trim().toUpperCase()
    });
    say("a-out", "Sent. Phones with the app open get it within about 20 seconds. Others get it the next time they open the app.", true);
    load();
  } catch (e) { say("a-out", "Could not send: " + (e.code || e.message), false); }
};
$("a-clear").onclick = async () => {
  try { await saveConfig({ annId: "" }); say("a-out", "Message removed.", true); load(); }
  catch (e) { say("a-out", "Could not remove: " + (e.code || e.message), false); }
};

function codeFor(name) {
  const n = name.split(".").map((x) => parseInt(x.replace(/\D/g, ""), 10) || 0);
  return (n[0] || 0) * 1000000 + (n[1] || 0) * 1000 + (n[2] || 0);
}
$("u-name").oninput = () => { $("u-code").value = codeFor($("u-name").value.trim()) || ""; };

function linkOk(v) { return !v || v.startsWith("https://"); }
function shaOk(v) { return !v || /^[0-9a-fA-F]{64}$/.test(v); }

$("u-publish").onclick = async () => {
  const name = $("u-name").value.trim(), code = parseInt($("u-code").value || "0", 10);
  const a64 = $("u-arm64").value.trim(), a32 = $("u-arm32").value.trim(), x86 = $("u-x86").value.trim();
  if (!name || !code) { say("u-out", "Type the version name first.", false); return; }
  if (!a64 && !a32 && !x86) { say("u-out", "Add at least one download link.", false); return; }
  if (!linkOk(a64) || !linkOk(a32) || !linkOk(x86)) { say("u-out", "Every link must start with https://", false); return; }
  const s64 = $("u-sha64").value.trim().toLowerCase(), s32 = $("u-sha32").value.trim().toLowerCase(), sx = $("u-shax").value.trim().toLowerCase();
  if (!shaOk(s64) || !shaOk(s32) || !shaOk(sx)) { say("u-out", "A SHA-256 must be exactly 64 letters and numbers, or left empty.", false); return; }
  try {
    await saveConfig({
      updSha64: s64, updSha32: s32, updShaX86: sx,
      updName: name, updCode: code, updNotes: $("u-notes").value.trim(), updForce: $("u-force").checked,
      updArm64: a64, updArm32: a32, updX86: x86, updAt: Timestamp.now()
    });
    say("u-out", "Update published. Phones with the app open get it within about 20 seconds. Others get it the next time they open the app.", true);
    load();
  } catch (e) { say("u-out", "Could not publish: " + (e.code || e.message), false); }
};
async function setForce(on) {
  try {
    await saveConfig({ updForce: on });
    $("u-force").checked = on;
    say("u-out", on ? "Force update is ON for the published version." : "Force update is removed.", true);
    load();
  } catch (e) { say("u-out", "Could not save: " + (e.code || e.message), false); }
}
$("u-forceon").onclick = () => setForce(true);
$("u-forceoff").onclick = () => setForce(false);
$("u-remove").onclick = async () => {
  try {
    await saveConfig({ updCode: 0, updName: "", updNotes: "", updForce: false, updArm64: "", updArm32: "", updX86: "", updSha64: "", updSha32: "", updShaX86: "" });
    ["u-name", "u-code", "u-notes", "u-arm64", "u-arm32", "u-x86", "u-sha64", "u-sha32", "u-shax"].forEach((i) => { $(i).value = ""; });
    $("u-force").checked = false;
    say("u-out", "Update removed.", true);
    load();
  } catch (e) { say("u-out", "Could not remove: " + (e.code || e.message), false); }
};

onAuthStateChanged(auth, (user) => {
  const ok = user && !user.isAnonymous;
  $("login").classList.toggle("hidden", !!ok);
  $("app").classList.toggle("hidden", !ok);
  if (ok) { $("who").textContent = user.email; load().catch((e) => alert("Could not load (is this the admin account?): " + (e.code || e.message))); }
});
