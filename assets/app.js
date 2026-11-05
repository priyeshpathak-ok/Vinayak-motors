(function () {
  var S = window.SITE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---- attribution (UTM) ---- */
  var utm = {};
  try {
    var saved = JSON.parse(sessionStorage.getItem("vm_utm") || "{}");
    var q = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) { if (q.get(k)) saved[k] = q.get(k); });
    if (!saved.referrer && document.referrer) saved.referrer = document.referrer;
    sessionStorage.setItem("vm_utm", JSON.stringify(saved));
    utm = saved;
  } catch (e) {}

  function track(event, detail) {
    try {
      var body = JSON.stringify({ event: event, detail: detail || "", page: location.pathname, utm_source: utm.utm_source, utm_campaign: utm.utm_campaign });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      else fetch("/api/event", { method: "POST", body: body, headers: { "Content-Type": "application/json" }, keepalive: true });
    } catch (e) {}
    if (window.gtag) gtag("event", event, { detail: detail });
    if (window.fbq) fbq("trackCustom", event, { detail: detail });
  }

  /* ---- contact details from config ---- */
  var waBase = S.whatsapp ? "https://wa.me/" + S.whatsapp : "";
  function waLink(text) { return waBase + "?text=" + encodeURIComponent(text); }
  $$("[data-call]").forEach(function (a) { if (S.phone) { a.href = "tel:+" + S.phone; a.hidden = false; a.addEventListener("click", function () { track("call_click"); }); } });
  $$("[data-wa]").forEach(function (a) { if (S.whatsapp) { a.href = waLink("Hi Vinayak Motors, I am interested in a pre-owned car."); a.hidden = false; a.addEventListener("click", function () { track("whatsapp_click"); }); } });
  if (S.address) { var ca = $("#cAddr"); ca.textContent = "Showroom: " + S.address; ca.hidden = false; }
  $("#cHours").textContent = "Hours: " + (S.hours || "");
  if (S.phone) { var cp = $("#cPhone"); cp.textContent = "Phone: +" + S.phone; cp.hidden = false; }
  if (S.email) { var cm = $("#cMail"); cm.textContent = "Email: " + S.email; cm.hidden = false; }
  if (S.mapEmbed) { var m = $("#map"); m.src = S.mapEmbed; m.hidden = false; }
  if (S.instagram) { $("#igLink").href = S.instagram; $("#igLink2").href = S.instagram; }
  if (S.heroVideo) { var hv = $("#heroVideo"); hv.src = S.heroVideo; hv.hidden = false; }
  $("#yr").textContent = new Date().getFullYear();

  /* ---- brands + cars ---- */
  $("#brandChips").innerHTML = (S.brands || []).map(function (b) { return "<span>" + esc(b) + "</span>"; }).join("");
  var CAR_SVG = '<svg viewBox="0 0 200 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 62h176M24 62c0-14 6-20 18-22l22-18c4-3 8-4 14-4h38c8 0 13 3 18 9l12 14c12 1 20 6 20 21"/><circle cx="55" cy="64" r="11" fill="#fff"/><circle cx="148" cy="64" r="11" fill="#fff"/><path d="M70 40h34V22M110 40h40"/></svg>';
  var active = "All";
  var brands = ["All"].concat(S.brands || []);
  function renderFilters() {
    $("#filters").innerHTML = brands.map(function (b) { return '<button class="chip" role="tab" aria-selected="' + (b === active) + '" data-b="' + esc(b) + '">' + esc(b) + "</button>"; }).join("");
  }
  function priceText(p) { return p ? "₹" + Number(p).toLocaleString("en-IN") : "Call for best price"; }
  function renderCars() {
    var list = (S.cars || []).filter(function (c) { return active === "All" || c.brand === active; });
    $("#emptyNote").hidden = list.length > 0;
    $("#carGrid").innerHTML = list.map(function (c) {
      var specs = [c.year, c.km ? Number(c.km).toLocaleString("en-IN") + " km" : "", c.fuel, c.owner].filter(Boolean);
      var media = c.video ? '<video src="' + esc(c.video) + '" muted loop playsinline preload="none" poster="' + esc(c.image || "") + '" controls></video>' : (c.image ? '<img loading="lazy" alt="' + esc(c.brand + " " + c.name) + '" src="' + esc(c.image) + '">' : CAR_SVG);
      return '<article class="car"><div class="media">' + media + (c.sample && S.showSampleBadge ? '<span class="badge">Sample listing</span>' : "") + '</div><div class="body"><span class="brandname">' + esc(c.brand) + "</span><h3>" + esc(c.name) + "</h3>" +
        (specs.length ? '<ul class="specs">' + specs.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" : "") +
        '<div class="price">' + priceText(c.price) + '</div><div class="actions"><button class="btn primary" data-enquire="' + esc(c.id) + '" data-type="Buy a car">Enquire</button><button class="btn ghost" data-enquire="' + esc(c.id) + '" data-type="Test drive">Test drive</button></div></div></article>';
    }).join("");
  }
  renderFilters(); renderCars();
  $("#filters").addEventListener("click", function (e) { var b = e.target.closest("[data-b]"); if (!b) return; active = b.dataset.b; renderFilters(); renderCars(); });
  $("#carGrid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-enquire]"); if (!b) return;
    var c = (S.cars || []).filter(function (x) { return x.id === b.dataset.enquire; })[0]; if (!c) return;
    track("car_view", c.brand + " " + c.name);
    openForm(b.dataset.type, c.brand + " " + c.name);
  });

  /* ---- form ---- */
  var form = $("#leadForm"), started = false;
  function openForm(type, car) {
    if (type) $("#interest").value = type;
    if (car != null) $("#carField").value = car;
    $("#formTitle").textContent = type === "Test drive" ? "Book a test drive" : type === "Sell my vehicle" ? "Get your vehicle valued" : type === "Car loan" ? "Check loan eligibility" : "Request a call back";
    $("#contact").scrollIntoView({ behavior: "smooth" });
    setTimeout(function () { form.elements.namedItem('name').focus({ preventScroll: true }); }, 500);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open-form]"); if (!b) return;
    e.preventDefault(); openForm(b.dataset.openForm, "");
  });
  form.addEventListener("input", function () { if (!started) { started = true; track("form_start"); } });

  function showErrors(errs) {
    $$("[data-err]").forEach(function (el) { el.textContent = errs[el.dataset.err] || ""; });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements, errs = {};
    var phone = f.namedItem('phone').value.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
    if (f.namedItem('name').value.trim().length < 2) errs.name = "Please enter your name";
    if (!/^[6-9]\d{9}$/.test(phone)) errs.phone = "Enter a valid 10-digit Indian mobile number";
    if (f.namedItem('email').value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.namedItem('email').value)) errs.email = "Enter a valid email";
    if (!f.namedItem('consent').checked) errs.consent = "Please agree so we can contact you";
    showErrors(errs); $("#formErr").textContent = "";
    if (Object.keys(errs).length) return;

    var btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Submitting...";
    var data = {
      name: f.namedItem('name').value, phone: phone, email: f.namedItem('email').value, city: f.namedItem('city').value, interest: f.namedItem('interest').value, car: f.namedItem('car').value,
      budget: f.namedItem('budget').value, preferredTime: f.namedItem('preferredTime').value, message: f.namedItem('message').value, consent: f.namedItem('consent').checked, website: f.namedItem('website').value,
      page: location.pathname, referrer: utm.referrer || "", utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign, utm_term: utm.utm_term, utm_content: utm.utm_content
    };
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) { if (res.j.errors) showErrors(res.j.errors); throw new Error(res.j.error || "validation"); }
        if (window.gtag) gtag("event", "generate_lead", { interest: data.interest });
        if (window.fbq) fbq("track", "Lead");
        var u = "thanks.html?ref=" + encodeURIComponent(res.j.ref) + "&t=" + encodeURIComponent(data.interest);
        location.href = u;
      })
      .catch(function () {
        $("#formErr").textContent = "Could not submit right now. Please call or WhatsApp us, or try again.";
        btn.disabled = false; btn.textContent = "Submit enquiry";
      });
  });

  /* ---- consent-gated analytics ---- */
  function loadAnalytics() {
    if (S.ga4 && !window.gtag) {
      var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(S.ga4); document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag("js", new Date()); gtag("config", S.ga4);
    }
    if (S.metaPixel && !window.fbq) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", S.metaPixel); fbq("track", "PageView");
    }
  }
  var consent = store.get("vm_consent");
  if (consent === "yes") loadAnalytics();
  else if (!consent && (S.ga4 || S.metaPixel)) $("#consentBar").hidden = false;
  $("#consentYes").onclick = function () { store.set("vm_consent", "yes"); $("#consentBar").hidden = true; loadAnalytics(); };
  $("#consentNo").onclick = function () { store.set("vm_consent", "no"); $("#consentBar").hidden = true; };
})();
