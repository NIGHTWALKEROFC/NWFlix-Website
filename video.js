(function () {
  var box = document.getElementById("demo");
  if (!box) return;
  var yt = (box.getAttribute("data-youtube") || "").trim();
  var file = (box.getAttribute("data-file") || "").trim();
  var frame = box.querySelector(".frame");
  if (!frame || (!yt && !file)) return;
  box.hidden = false;
  if (file) {
    var v = document.createElement("video");
    v.src = file;
    v.controls = true;
    v.playsInline = true;
    v.preload = "metadata";
    frame.appendChild(v);
    return;
  }
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "play";
  btn.setAttribute("aria-label", "Play video");
  var img = document.createElement("img");
  img.src = "https://i.ytimg.com/vi/" + encodeURIComponent(yt) + "/hqdefault.jpg";
  img.alt = "";
  var tri = document.createElement("i");
  btn.appendChild(img);
  btn.appendChild(tri);
  btn.addEventListener("click", function () {
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt) + "?autoplay=1&rel=0";
    f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    f.title = "NWFlix app video";
    frame.innerHTML = "";
    frame.appendChild(f);
  });
  frame.appendChild(btn);
})();
