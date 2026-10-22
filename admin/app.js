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
    say("a-out", "Sent. Users see it the next time the app checks.", true);
    load();
  } catch (e) { say("a-out", "Could not send: " + (e.code || e.message), false); }
};
$("a-clear").onclick = async () => {
  try { await saveConfig({ annId: "" }); say("a-out", "Message removed.", true); load(); }
  catch (e) { say("a-out", "Could not remove: " + (e.code || e.message), false); }
};

onAuthStateChanged(auth, (user) => {
  const ok = user && !user.isAnonymous;
  $("login").classList.toggle("hidden", !!ok);
  $("app").classList.toggle("hidden", !ok);
  if (ok) { $("who").textContent = user.email; load().catch((e) => alert("Could not load (is this the admin account?): " + (e.code || e.message))); }
});
