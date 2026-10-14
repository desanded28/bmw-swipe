/*!
 * Sorriso booking widget
 *
 * Floating button that opens the booking form in a dialog:
 *   <script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" async></script>
 *
 * Inline, inside an element of your page:
 *   <div id="booking"></div>
 *   <script src="https://YOUR-DOMAIN/widget.js" data-clinic="studio-bianchi" data-target="#booking" async></script>
 *
 * Optional attributes:
 *   data-lang          it, en, de, fr, es, pt, ro or pl. Default: the page's <html lang>, then the
 *                      visitor's browser language, then Italian.
 *   data-practitioner, data-service, data-location   preselect (ids)
 *   data-label, data-color                           the floating button's text and colour
 *   data-events        opt in to the window "sorriso:booked" CustomEvent when a booking completes.
 *                      Its detail is { source, type } and carries no personal data. Don't forward it
 *                      to advertising or analytics tags: it reveals a dental booking (health data).
 *   data-include-id    with data-events, add { appointmentId } to the event's detail.
 *
 * The frame is told this page's origin (?parent=) and posts messages only to it, never to "*".
 * No cookies, no storage, no third-party requests.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var d = script.dataset;
  if (!d.clinic) return console.warn("[sorriso] data-clinic is required");

  var LOCALES = ["it", "en", "de", "fr", "es", "pt", "ro", "pl"];
  var LABELS = {
    it: { button: "Prenota una visita", title: "Prenota una visita", close: "Chiudi" },
    en: { button: "Book an appointment", title: "Book an appointment", close: "Close" },
    de: { button: "Termin buchen", title: "Termin buchen", close: "Schließen" },
    fr: { button: "Prendre rendez-vous", title: "Prendre rendez-vous", close: "Fermer" },
    es: { button: "Pedir cita", title: "Pedir cita", close: "Cerrar" },
    pt: { button: "Marcar consulta", title: "Marcar consulta", close: "Fechar" },
    ro: { button: "Programează o vizită", title: "Programează o vizită", close: "Închide" },
    pl: { button: "Umów wizytę", title: "Umów wizytę", close: "Zamknij" },
  };

  /** The first supported language among data-lang, <html lang> and the browser's, by primary subtag. */
  function pickLang() {
    var candidates = [d.lang, document.documentElement.lang, navigator.language];
    for (var i = 0; i < candidates.length; i++) {
      var tag = String(candidates[i] || "").trim().toLowerCase().split(/[-_]/)[0];
      if (LOCALES.indexOf(tag) !== -1) return tag;
    }
    return "it";
  }

  var lang = pickLang();
  var text = LABELS[lang];
  var origin = new URL(script.src).origin;
  var events = "events" in d;
  var includeId = events && "includeId" in d;
  var params = new URLSearchParams();
  params.set("parent", window.location.origin);
  ["practitioner", "service", "location"].forEach(function (k) {
    if (d[k]) params.set(k, d[k]);
  });
  if (events) params.set("events", "1");
  if (includeId) params.set("id", "1");
  var src = origin + "/" + lang + "/embed/" + encodeURIComponent(d.clinic) + "?" + params.toString();
  var color = d.color || "#0c675d";

  var frame = null;
  function makeFrame(height) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = text.title;
    f.lang = lang;
    f.style.cssText = "width:100%;border:0;display:block;height:" + height + ";background:#fff";
    f.setAttribute("allow", "clipboard-write");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    return f;
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !frame || e.source !== frame.contentWindow) return;
    var data = e.data;
    if (!data || data.source !== "sorriso") return;
    if (data.type === "resize" && inline && typeof data.height === "number") frame.style.height = Math.ceil(data.height) + "px";
    if (data.type === "booked" && events) {
      var detail = { source: "sorriso", type: "booked" };
      if (includeId && typeof data.appointmentId === "string") detail.appointmentId = data.appointmentId;
      window.dispatchEvent(new CustomEvent("sorriso:booked", { detail: detail }));
    }
  });

  var inline = false;
  if (d.target) {
    var host = document.querySelector(d.target);
    if (!host) return console.warn("[sorriso] target not found:", d.target);
    inline = true;
    frame = makeFrame("640px");
    host.appendChild(frame);
    return;
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = d.label || text.button;
  btn.setAttribute("aria-haspopup", "dialog");
  btn.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 20px;border:0;border-radius:999px;" +
    "font:600 15px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;cursor:pointer;" +
    "box-shadow:0 10px 30px rgba(15,23,42,.25);outline-offset:3px;background:" +
    color;

  var overlay = null;
  var closeBtn = null;
  var bodyOverflow = "";

  /** Focus sentinels around the dialog keep Tab inside it (the frame's own content in between). */
  function sentinel(onFocus) {
    var s = document.createElement("span");
    s.tabIndex = 0;
    s.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    s.addEventListener("focus", onFocus);
    return s;
  }

  function open() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", text.title);
    overlay.lang = lang;
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:760px;height:min(820px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)";
    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", text.close);
    closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
    closeBtn.style.cssText =
      "position:absolute;top:8px;right:10px;z-index:1;width:40px;height:40px;border:0;border-radius:999px;background:#e2e8f0;color:#0b1324;font-size:24px;line-height:1;cursor:pointer";
    closeBtn.onclick = shut;
    overlay.onclick = function (e) {
      if (e.target === overlay) shut();
    };
    frame = makeFrame("100%");
    panel.appendChild(closeBtn);
    panel.appendChild(frame);
    overlay.appendChild(
      sentinel(function () {
        frame.focus();
      }),
    );
    overlay.appendChild(panel);
    overlay.appendChild(
      sentinel(function () {
        closeBtn.focus();
      }),
    );
    document.body.appendChild(overlay);
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", esc);
    btn.setAttribute("aria-expanded", "true");
    // Into the form: the frame takes focus (its first control follows with Tab).
    frame.addEventListener("load", function () {
      if (overlay) frame.focus();
    });
    frame.focus();
  }

  function shut() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    frame = null;
    closeBtn = null;
    document.body.style.overflow = bodyOverflow;
    document.removeEventListener("keydown", esc);
    btn.setAttribute("aria-expanded", "false");
    btn.focus();
  }

  function esc(e) {
    if (e.key === "Escape") shut();
  }

  btn.setAttribute("aria-expanded", "false");
  btn.onclick = open;
  document.body.appendChild(btn);
})();
