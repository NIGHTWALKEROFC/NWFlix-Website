// Change this to your own GitHub "username/repository" (the one that holds the Releases).
var REPO = "NIGHTWALKEROFC/NWFlix-Website";

var FILES = {
  "arm64-v8a":   "app-arm64-v8a-release.apk",
  "armeabi-v7a": "app-armeabi-v7a-release.apk",
  "x86_64":      "app-x86_64-release.apk",
  "universal":   "app-universal-release.apk"
};
var NAMES = {
  "arm64-v8a":   "Most phones (64-bit)",
  "armeabi-v7a": "Older phones (32-bit)",
  "x86_64":      "Emulators and Intel devices",
  "universal":   "Works on every phone (larger file)"
};

var button = document.getElementById("download");
var note = document.getElementById("download-note");
var othersBox = document.getElementById("others");
var othersList = document.getElementById("others-list");

function latestUrl(file) {
  return "https://github.com/" + REPO + "/releases/latest/download/" + file;
}

function mb(bytes) {
  return (bytes / 1048576).toFixed(0) + " MB";
}

// Works out the phone's CPU type. Browsers often hide it, so "universal" is the safe answer.
async function detectAbi() {
  var ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return null;

  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      var h = await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness"]);
      var arch = (h.architecture || "").toLowerCase();
      var bits = h.bitness || "";
      if (arch.indexOf("arm") === 0) return bits === "32" ? "armeabi-v7a" : (bits === "64" ? "arm64-v8a" : "universal");
      if (arch.indexOf("x86") === 0) return bits === "32" ? "universal" : "x86_64";
    }
  } catch (e) { /* fall through */ }

  if (/aarch64|arm64|armv8/i.test(ua)) return "arm64-v8a";
  if (/armv7|armv6|armeabi/i.test(ua)) return "armeabi-v7a";
  if (/x86_64|x64/i.test(ua)) return "x86_64";
  return "universal";
}

function fillOthers(assets, tag) {
  othersList.innerHTML = "";
  Object.keys(FILES).forEach(function (abi) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = latestUrl(FILES[abi]);
    a.textContent = NAMES[abi];
    li.appendChild(a);
    var asset = assets && assets[FILES[abi]];
    if (asset) li.appendChild(document.createTextNode(" · " + mb(asset.size)));
    othersList.appendChild(li);
  });
  othersBox.style.display = "block";
}

async function init() {
  othersBox.style.display = "none";
  var abi = await detectAbi();
  var chosen = abi || "universal";
  button.href = latestUrl(FILES[chosen]);

  if (!abi) {
    note.textContent = "NWMovie is an Android app. Open this page on your Android phone to install it.";
  }

  try {
    var res = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest");
    if (!res.ok) throw new Error("no release");
    var rel = await res.json();
    var assets = {};
    (rel.assets || []).forEach(function (a) { assets[a.name] = a; });

    var file = assets[FILES[chosen]] || assets[FILES.universal];
    if (file) {
      button.href = file.browser_download_url;
      if (abi) note.textContent = "Version " + (rel.tag_name || "").replace(/^v/i, "") + " · " + mb(file.size);
    }
    fillOthers(assets, rel.tag_name);
  } catch (e) {
    if (abi) note.textContent = "Tap the button to download the latest version.";
    fillOthers(null, "");
  }
}

init();
