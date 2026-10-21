// The GitHub "username/repository" that holds the Releases.
var REPO = "NIGHTWALKEROFC/NWFlix-Website";

var FILES = {
  "arm64-v8a": "app-arm64-v8a-release.apk",
  "armeabi-v7a": "app-armeabi-v7a-release.apk",
  "x86_64": "app-x86_64-release.apk"
};
var LABELS = {
  "arm64-v8a": { name: "64-bit phones", note: "Most phones made after 2018" },
  "armeabi-v7a": { name: "32-bit phones", note: "Older and budget phones" },
  "x86_64": { name: "Emulators and Intel devices", note: "PC emulators, some Chromebooks" }
};

var release = { tag: "", assets: {} };
var $ = function (id) { return document.getElementById(id); };

function mb(bytes) { return (bytes / 1048576).toFixed(0) + " MB"; }
function fallbackUrl(abi) { return "https://github.com/" + REPO + "/releases/latest/download/" + FILES[abi]; }
function fileUrl(abi) { var a = release.assets[FILES[abi]]; return a ? a.browser_download_url : fallbackUrl(abi); }
function fileSize(abi) { var a = release.assets[FILES[abi]]; return a ? " · " + mb(a.size) : ""; }

// ---------------------------------------------------------------- release info
fetch("https://api.github.com/repos/" + REPO + "/releases/latest")
  .then(function (r) { if (!r.ok) throw new Error("no release"); return r.json(); })
  .then(function (rel) {
    release.tag = rel.tag_name || "";
    (rel.assets || []).forEach(function (a) { release.assets[a.name] = a; });
    if (release.tag) $("release-note").textContent = "Version " + release.tag.replace(/^v/i, "") + " · Free · Android 7 or newer";
  })
  .catch(function () { /* the download buttons still work with the "latest" link */ });

// ---------------------------------------------------------------- dialogs
function openDialog(id) { $(id).classList.add("open"); }
function closeAll() {
  var all = document.querySelectorAll(".overlay");
  for (var i = 0; i < all.length; i++) all[i].classList.remove("open");
}
document.addEventListener("click", function (e) {
  if (e.target.hasAttribute("data-close") || e.target.classList.contains("overlay")) closeAll();
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

var PANELS = ["p-check", "p-result", "p-version", "p-phone", "p-manual", "p-desktop"];
function show(panel) {
  PANELS.forEach(function (p) { $(p).classList.toggle("hidden", p !== panel); });
}

// ---------------------------------------------------------------- what phone is this?
// Returns { abi, sure, version } where abi is null when the browser gives no clue.
async function readPhone() {
  var ua = navigator.userAgent || "";
  var out = { android: /Android/i.test(ua), abi: null, sure: false, version: 0 };
  if (!out.android) return out;

  var m = ua.match(/Android\s+(\d+)/i);
  if (m) out.version = parseInt(m[1], 10);          // note: Chrome often shows a fixed "10" here

  var hintArch = "", hintBits = "";
  try {
    var uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) {
      var h = await uad.getHighEntropyValues(["architecture", "bitness", "platformVersion"]);
      if (h.platformVersion) { var v = parseInt(h.platformVersion, 10); if (v) out.version = v; }
      hintArch = (h.architecture || "").toLowerCase();
      hintBits = h.bitness || "";
    }
  } catch (e) { /* not supported */ }

  var plat = (navigator.platform || "").toLowerCase();
  if (hintArch.indexOf("arm") === 0 && hintBits === "64") { out.abi = "arm64-v8a"; out.sure = true; return out; }
  if (/aarch64|arm64|armv81/.test(plat)) { out.abi = "arm64-v8a"; out.sure = true; return out; }
  if (/x86_64|x64/.test(plat) || (hintArch.indexOf("x86") === 0 && hintBits === "64")) { out.abi = "x86_64"; out.sure = true; return out; }
  if (/armv7|armv6/.test(plat)) { out.abi = "armeabi-v7a"; out.sure = true; return out; }
  if (/armv8/.test(plat) || hintArch.indexOf("arm") === 0) {
    // a 32-bit browser on a 64-bit-capable phone: new Android versions are almost always 64-bit
    if (out.version >= 10) { out.abi = "arm64-v8a"; return out; }
    if (out.version > 0) { out.abi = "armeabi-v7a"; return out; }
  }
  return out;
}

function showResult(abi, intro, why) {
  $("r-intro").textContent = intro;
  $("r-title").textContent = "NWFlix " + (release.tag ? release.tag.replace(/^v/i, "") : "") + " for " + LABELS[abi].name;
  $("r-detail").textContent = (why ? why + " · " : "") + LABELS[abi].note + fileSize(abi);
  $("r-download").href = fileUrl(abi);
  show("p-result");
}

function fillManual() {
  var list = $("manual-list");
  list.innerHTML = "";
  Object.keys(FILES).forEach(function (abi) {
    var a = document.createElement("a");
    a.className = "btn btn-ghost choice";
    a.href = fileUrl(abi);
    a.innerHTML = "<span>" + LABELS[abi].name + "<small>" + LABELS[abi].note + fileSize(abi) + "</small></span>";
    list.appendChild(a);
  });
}

$("download").addEventListener("click", async function () {
  openDialog("dl-overlay");
  show("p-check");
  fillManual();
  var phone = await readPhone();
  if (!phone.android) { show("p-desktop"); return; }
  if (phone.abi && phone.sure) { showResult(phone.abi, "We found your phone.", "Detected automatically"); return; }
  if (phone.abi) { showResult(phone.abi, "This looks right for your phone.", "Android " + phone.version); return; }
  show("p-version");
});

$("help").addEventListener("click", function () { openDialog("help-overlay"); });

document.addEventListener("click", function (e) {
  var t = e.target.closest ? e.target.closest("[data-go]") : null;
  if (t) { show("p-" + t.getAttribute("data-go")); return; }
  var v = e.target.closest ? e.target.closest("[data-version]") : null;
  if (v) {
    if (v.getAttribute("data-version") === "new") showResult("arm64-v8a", "Good choice for Android 10 or newer.", "64-bit");
    else showResult("armeabi-v7a", "This version runs on older phones.", "32-bit");
  }
});

// ---------------------------------------------------------------- "I don't know": look the phone up
async function lookupPhone(name) {
  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    var api = "https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query";
    var s = await fetch(api + "&list=search&srlimit=1&srsearch=" + encodeURIComponent(name + " smartphone"), { signal: ctl.signal });
    var hit = (await s.json()).query.search[0];
    if (!hit) return null;
    var x = await fetch(api + "&prop=extracts&exintro=1&explaintext=1&titles=" + encodeURIComponent(hit.title), { signal: ctl.signal });
    var pages = (await x.json()).query.pages;
    var text = (pages[Object.keys(pages)[0]].extract || "");
    var android = text.match(/Android\s+(\d{1,2})/i);
    var year = text.match(/\b(20[0-2]\d)\b/);
    return {
      title: hit.title,
      android: android ? parseInt(android[1], 10) : 0,
      year: year ? parseInt(year[1], 10) : 0,
      thirtyTwo: /32-bit/i.test(text) && !/64-bit/i.test(text)
    };
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

$("phone-find").addEventListener("click", async function () {
  var name = $("phone-name").value.trim();
  var msg = $("phone-msg");
  if (name.length < 3) { msg.textContent = "Please type the phone's name."; msg.classList.remove("hidden"); return; }
  msg.innerHTML = '<span class="spin"></span>Looking it up…';
  msg.classList.remove("hidden");
  var info = await lookupPhone(name);
  if (!info || (!info.android && !info.year)) {
    msg.textContent = "We couldn't find that phone. Please choose a version yourself.";
    return;
  }
  var newer = info.android ? info.android >= 10 : info.year >= 2019;
  if (info.thirtyTwo) newer = false;
  var why = info.title + (info.android ? " · launched with Android " + info.android : (info.year ? " · released " + info.year : ""));
  showResult(newer ? "arm64-v8a" : "armeabi-v7a", "Found it: " + info.title + ".", why);
});
