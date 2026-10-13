/*!
 * Sorriso booking widget
 *
 * Floating button that opens the booking flow in a modal:
 *   <script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" async></script>
 *
 * Inline, inside an element of your page:
 *   <div id="booking"></div>
 *   <script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" data-target="#booking" async></script>
 *
 * Optional: data-practitioner, data-service, data-location, data-label, data-color.
 * Emits window "sorriso:booked" CustomEvent with { appointmentId } when a booking completes.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var d = script.dataset;
  if (!d.clinic) return console.warn("[sorriso] data-clinic is required");
  var origin = new URL(script.src).origin;
  var params = new URLSearchParams();
  ["practitioner", "service", "location"].forEach(function (k) {
    if (d[k]) params.set(k, d[k]);
  });
  var src = origin + "/embed/" + encodeURIComponent(d.clinic) + (params.toString() ? "?" + params : "");
  var color = d.color || "#0d9488";

  function makeFrame(height) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = "Book an appointment";
    f.style.cssText = "width:100%;border:0;display:block;height:" + height + ";background:#fff";
    f.setAttribute("allow", "clipboard-write");
    return f;
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.source !== "sorriso") return;
    if (e.data.type === "resize" && inlineFrame) inlineFrame.style.height = e.data.height + "px";
    if (e.data.type === "booked") window.dispatchEvent(new CustomEvent("sorriso:booked", { detail: e.data }));
  });

  var inlineFrame = null;
  if (d.target) {
    var host = document.querySelector(d.target);
    if (!host) return console.warn("[sorriso] target not found:", d.target);
    inlineFrame = makeFrame("640px");
    host.appendChild(inlineFrame);
    return;
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = d.label || "Book an appointment";
  btn.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 20px;border:0;border-radius:999px;" +
    "font:600 15px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;cursor:pointer;" +
    "box-shadow:0 10px 30px rgba(15,23,42,.25);background:" + color;

  var overlay = null;
  function open() {
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:760px;height:min(820px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";
    close.style.cssText =
      "position:absolute;top:8px;right:10px;z-index:1;width:36px;height:36px;border:0;border-radius:999px;background:#f1f5f9;font-size:22px;cursor:pointer";
    close.onclick = shut;
    overlay.onclick = function (e) {
      if (e.target === overlay) shut();
    };
    panel.appendChild(close);
    panel.appendChild(makeFrame("100%"));
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", esc);
  }
  function shut() {
    if (overlay) overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", esc);
  }
  function esc(e) {
    if (e.key === "Escape") shut();
  }
  btn.onclick = open;
  document.body.appendChild(btn);
})();
