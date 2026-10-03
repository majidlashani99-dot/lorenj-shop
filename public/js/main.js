/* ==========================================================
   لُرنج — منطق سایت (بدون هیچ کتابخانه خارجی؛ آفلاین کار می‌کند)
   ========================================================== */

/* ───────── تنظیمات: این بخش را با اطلاعات واقعی خودتان عوض کنید ───────── */
const CONFIG = { telegram: SHOP.telegram, phone: SHOP.phone, freeShipFrom: SHOP.freeShipFrom, shipCost: SHOP.shipCost };

/* قیمت هر سایز (تومان). برای تغییر قیمت فقط عدد price را عوض کنید. */
const PRODUCTS = [
  { id: "1000", kg: 1,  label: "۱ کیلوگرم",  price: 620000,  img: "img/bag-1000.png",  ar: 0.632, h: 66, note: "برای اولین خرید. یک بسته ۱ کیلویی برای امتحان طعم و عطر برنج دورود کافی است.", tryFirst: false },
  { id: "5000", kg: 5,  label: "۵ کیلوگرم",  price: 3050000, img: "img/bag-5000.png",  ar: 0.702, h: 78, note: "برای خانواده‌هایی که طعم این برنج را می‌شناسند و مصرف منظم دارند.", tryFirst: true },
  { id: "10000",kg: 10, label: "۱۰ کیلوگرم", price: 6000000, img: "img/bag-10000.png", ar: 0.771, h: 88, note: "برای مصرف چندماهه و خرید به‌صرفه‌تر.", tryFirst: true }
];

/* ───────── ابزارها ───────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fa = n => Number(n).toLocaleString("fa-IR");
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const win = (v, a, b, c, d) => smooth(a, b, v) * (1 - smooth(c, d, v));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const byId = id => PRODUCTS.find(p => p.id === id);
const perKg = p => Math.round(p.price / p.kg);

PRODUCTS.forEach(p => { p.price = SHOP.prices[p.id]; });
PRODUCTS.forEach(p => { const i = new Image(); i.src = p.img; });   // پیش‌بارگذاری برای تعویض روان

/* ==========================================================
   ۱) صحنه اول: بسته بزرگ می‌شود و به پشت می‌چرخد
   ========================================================== */
const hero = $(".hero");
const stage = $(".hero__stage");
const heroBag = $(".hero__bag");
const heroBack = $(".hero__face--back");
const heroLogo = $(".hero__logo");
const heroTag = $(".hero__tag");
const heroCue = $(".hero__cue");
const scrim = $(".hero__scrim");
const capBack = $(".cap--back"), capEnd = $(".cap--end");

// t = پیشرفت اسکرول، s = بزرگ‌نمایی (S = حداکثر مجاز)، ry = چرخش به پشت
const KF = [
  { t: 0,    s: 0.66, ry: 0,   r: -4, ty: 21 },
  { t: 0.16, s: 1.00, ry: 0,   r: 0,  ty: 5  },
  { t: 0.30, s: 1.05, ry: 0,   r: 0,  ty: 0  },
  { t: 0.64, s: "S",  ry: 180, r: 0,  ty: 0  },   // بزرگ می‌شود و می‌چرخد
  { t: 0.82, s: "S",  ry: 180, r: 0,  ty: 0  },   // پشت بسته می‌ماند
  { t: 0.94, s: 0.84, ry: 180, r: 0,  ty: 12 },
  { t: 1.00, s: 0.82, ry: 180, r: 0,  ty: 14 }
];
function camera(t) {
  const W = heroBag.offsetWidth || 1, H = heroBag.offsetHeight || 1;
  const backW = H * (heroBack.naturalWidth && heroBack.naturalHeight ? heroBack.naturalWidth / heroBack.naturalHeight : .82);
  const S = Math.min(1.32, (innerWidth * .94) / backW, (innerHeight * .86) / H);
  const val = k => k.s === "S" ? S : k.s;
  let i = 0;
  while (i < KF.length - 2 && t > KF[i + 1].t) i++;
  const a = KF[i], b = KF[i + 1], k = smooth(a.t, b.t, t);
  return { s: lerp(val(a), val(b), k), ry: lerp(a.ry, b.ry, k), r: lerp(a.r, b.r, k), ty: lerp(a.ty, b.ty, k) };
}
/* پس‌زمینه: عکس گهر دورود با پارالاکس موس و حرکت دوربین با اسکرول */
const world = $("[data-world]"), spot = $(".hero__spot"), photo = $(".hero__photo");
let px = 0, py = 0, intro = reduced ? 1 : 0;
addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || reduced) return;
  px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; schedule();
});
function runIntro(ts) {            // رونمایی: بسته آرام از پایین بالا می‌آید
  runIntro.t0 = runIntro.t0 || ts;
  intro = clamp((ts - runIntro.t0) / 1900);
  renderHero(heroCur);
  if (intro < 1) requestAnimationFrame(runIntro);
}
const FOREST = [18, 58, 39], PADDY = [245, 236, 215];
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;

let heroCur = 0, heroTarget = 0;
function renderHero(t) {
  const c = camera(t), vh = innerHeight / 100;
  const ease = 1 - Math.pow(1 - intro, 3), calm = 1 - smooth(.08, .3, t);
  heroBag.style.transform = `perspective(1800px) translate3d(0,${c.ty * vh + (1 - ease) * 55 * vh}px,0) scale(${c.s}) rotateY(${c.ry + px * 16 * calm}deg) rotateX(${-py * 6 * calm}deg) rotate(${c.r}deg)`;
  heroBag.style.opacity = Math.min(1, ease * 2.2);
  world.style.opacity = 1 - smooth(.78, .93, t);
  photo.style.transform = `translate3d(${-px * 34}px,${(1 - ease) * 9 * vh + t * 7 * vh}px,0) scale(${1 + t * .45})`;
  spot.style.opacity = ease * (1 - smooth(.55, .8, t));
  spot.style.transform = `translate(${-px * 30}px,0) scale(${.7 + ease * .3 + t * .5})`;

  const fadeOut = smooth(.04, .2, t);
  heroLogo.style.opacity = (1 - fadeOut) * Math.min(1, ease * 1.6);
  heroLogo.style.transform = `translateX(-50%) translateY(${-fadeOut * 40}px) scale(${1 + fadeOut * .22})`;
  heroTag.style.opacity = (1 - smooth(.03, .14, t)) * smooth(.45, .9, intro);
  heroCue.style.opacity = 1 - smooth(0, .035, t);

  const bk = win(t, .60, .67, .80, .86), e = smooth(.94, .99, t);
  capBack.style.opacity = bk; capBack.style.transform = `translateY(${(1 - bk) * 24}px)`;
  capEnd.style.opacity = e;  capEnd.style.transform = `translateY(${(1 - e) * 24}px)`;
  scrim.style.opacity = Math.min(1, bk * 1.1);
  stage.style.setProperty("--bg", mix(FOREST, PADDY, smooth(.86, .96, t)));
}

/* ==========================================================
   ۳) مقایسه سایزها
   ========================================================== */
const lineupRow = $("[data-lineup]");
const maxKg = Math.max(...PRODUCTS.map(p => p.h));
lineupRow.innerHTML = PRODUCTS.map(p => `
  <button class="lineup__item" type="button" data-pick="${p.id}" style="--r:${(p.h / maxKg).toFixed(3)};--ar:${p.ar}" aria-label="خرید ${p.label}">
    <img src="${p.img}" alt="بسته ${p.label}" loading="lazy">
    <b>${p.label}</b>
    <span>${fa(p.price)} تومان</span>
  </button>`).join("");
const lineupItems = $$(".lineup__item");
function renderLineup() {
  if (reduced) return;
  const r = lineupRow.getBoundingClientRect();
  const base = clamp((innerHeight - r.top) / (innerHeight * .75));
  lineupItems.forEach((el, i) => {
    const e = smooth(0, 1, clamp(base * 1.7 - i * .2));
    el.style.opacity = e;
    el.style.transform = `translateY(${(1 - e) * 110}px) scale(${.88 + e * .12})`;
  });
}
lineupRow.addEventListener("click", e => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  select(b.dataset.pick);
  $("#shop").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

/* ==========================================================
   ۴) انتخاب سایز (شکل بسته عوض می‌شود)
   ========================================================== */
const bagWrap = $("[data-bagwrap]"), bagImg = $("[data-bag]"), shopStage = $("[data-stage]");
const sizesBox = $("[data-sizes]");
let current = "1000", qty = 1;

sizesBox.innerHTML = PRODUCTS.map(p =>
  `<button type="button" role="radio" aria-checked="${p.id === current}" data-size="${p.id}">${p.label}</button>`).join("");

function paintProduct(p) {
  bagImg.src = p.img;
  bagImg.alt = `بسته برنج لرنج، ${p.label}`;
  bagWrap.style.height = p.h + "%";
  bagWrap.style.aspectRatio = p.ar;
  $("[data-title]").textContent = `برنج دورود لرستان، ${p.label}`;
  $("[data-note]").textContent = p.note;
  $("[data-try]").hidden = !p.tryFirst;
  $("[data-price]").textContent = fa(p.price * qty);
  $("[data-perkg]").textContent = `کیلویی ${fa(perKg(p))} تومان`;
  $("[data-qty-out]").textContent = fa(qty);
  $$("[data-size]").forEach(b => b.setAttribute("aria-checked", b.dataset.size === p.id));
}
async function select(id) {
  if (id === current && bagImg.getAttribute("src") === byId(id).img) return;
  current = id; qty = 1;
  const p = byId(id);
  if (reduced || !bagWrap.animate) { paintProduct(p); return; }
  const out = bagWrap.animate(
    [{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(28px) scale(.9) rotate(-3deg)" }],
    { duration: 190, easing: "ease-in", fill: "forwards" });
  try { await out.finished; } catch (_) {}
  paintProduct(p);
  out.cancel();
  bagWrap.animate(
    [{ opacity: 0, transform: "translateY(-34px) scale(.88) rotate(3deg)" }, { opacity: 1, transform: "none" }],
    { duration: 620, easing: "cubic-bezier(.2,1.15,.3,1)" });
}
$("[data-try-btn]").addEventListener("click", () => { select("1000"); });
sizesBox.addEventListener("click", e => { const b = e.target.closest("[data-size]"); if (b) select(b.dataset.size); });
$$("[data-qty]").forEach(b => b.addEventListener("click", () => {
  qty = clamp(qty + Number(b.dataset.qty), 1, 99);
  paintProduct(byId(current));
}));
// کج شدن ملایم بسته با موس
shopStage.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || reduced) return;
  const r = shopStage.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  bagWrap.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 8}deg)`;
});
shopStage.addEventListener("pointerleave", () => { bagWrap.style.transform = ""; });
paintProduct(byId(current));

/* ==========================================================
   ۵) سبد خرید
   ========================================================== */
const cartEl = $("[data-cart]"), veil = $("[data-veil]");
let cart = {};
try { cart = JSON.parse(localStorage.getItem("lorenj_cart") || "{}"); } catch (_) {}
Object.keys(cart).forEach(k => { if (!byId(k)) delete cart[k]; });

const saveCart = () => { try { localStorage.setItem("lorenj_cart", JSON.stringify(cart)); } catch (_) {} };
const cartTotal = () => Object.entries(cart).reduce((s, [id, q]) => s + byId(id).price * q, 0);
const cartCount = () => Object.values(cart).reduce((s, q) => s + q, 0);

function toast(msg) {
  const t = $("[data-toast]");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("on"), 2400);
}
function renderCart() {
  const ids = Object.keys(cart);
  const list = $("[data-items]");
  list.innerHTML = ids.map(id => {
    const p = byId(id), q = cart[id];
    return `<li class="line">
      <img src="${p.img}" alt="" style="width:${Math.round(80 * p.ar)}px">
      <div>
        <h4>برنج دورود لرستان، ${p.label}</h4>
        <div class="qty" role="group" aria-label="تعداد">
          <button type="button" data-line="${id}" data-d="-1" aria-label="کمتر">−</button>
          <output>${fa(q)}</output>
          <button type="button" data-line="${id}" data-d="1" aria-label="بیشتر">+</button>
        </div>
        <button class="line__rm" type="button" data-rm="${id}">حذف</button>
      </div>
      <div class="line__price">${fa(p.price * q)}</div>
    </li>`;
  }).join("");
  $("[data-empty]").hidden = ids.length > 0;
  $(".cart__foot").hidden = ids.length === 0;
  $("[data-total]").textContent = fa(cartTotal());
  const n = cartCount(), badge = $("[data-cart-count]");
  badge.textContent = fa(n); badge.classList.add("bump"); setTimeout(() => badge.classList.remove("bump"), 260);

  const ship = $(".ship");
  if (!CONFIG.freeShipFrom || !ids.length) { ship.hidden = true; return; }
  ship.hidden = false;
  const left = CONFIG.freeShipFrom - cartTotal();
  $("[data-ship-text]").textContent = left > 0 ? `${fa(left)} تومان دیگر تا ارسال رایگان` : "ارسال سفارش شما رایگان است.";
  $("[data-ship-bar]").style.width = clamp(cartTotal() / CONFIG.freeShipFrom) * 100 + "%";
}
function addToCart(id, n = 1) {
  cart[id] = clamp((cart[id] || 0) + n, 0, 99);
  saveCart(); renderCart();
}
function openCart() {
  veil.hidden = false; requestAnimationFrame(() => veil.classList.add("on"));
  cartEl.classList.add("open"); cartEl.setAttribute("aria-hidden", "false");
  $("[data-cart-close]").focus();
}
function closeCart() {
  veil.classList.remove("on"); setTimeout(() => (veil.hidden = true), 300);
  cartEl.classList.remove("open"); cartEl.setAttribute("aria-hidden", "true");
  setTimeout(() => { if (cartEl.dataset.view === "done") cartEl.dataset.view = ""; }, 450);
}
$("[data-cart-open]").addEventListener("click", openCart);
$("[data-cart-close]").addEventListener("click", closeCart);
veil.addEventListener("click", closeCart);
addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });

$("[data-add]").addEventListener("click", () => {
  addToCart(current, qty);
  toast(`${fa(qty)} بسته ${byId(current).label} به سبد اضافه شد`);
  openCart();
});
cartEl.addEventListener("click", e => {
  const l = e.target.closest("[data-line]"), r = e.target.closest("[data-rm]");
  if (l) { const id = l.dataset.line; addToCart(id, Number(l.dataset.d)); if (!cart[id]) delete cart[id]; saveCart(); renderCart(); }
  if (r) { delete cart[r.dataset.rm]; saveCart(); renderCart(); }
});

const enDigits = s => String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const coForm = $("[data-co]");
const shipFee = () => (CONFIG.freeShipFrom && cartTotal() >= CONFIG.freeShipFrom) ? 0 : CONFIG.shipCost;
const payMethods = [
  { id: "prepay", t: "پیش‌پرداخت", d: "پرداخت آنلاین یا کارت‌به‌کارت، پیش از ارسال بسته" },
  { id: "cod", t: "پرداخت در محل", d: "مبلغ را هنگام تحویل بسته می‌پردازید" }
];
function copyText(txt) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
  const ta = document.createElement("textarea");
  ta.value = txt; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta);
  ta.select(); document.execCommand("copy"); ta.remove(); return Promise.resolve();
}
function setView(v) { cartEl.dataset.view = v || ""; if (v) $(".cart__items").scrollTop = 0; }
function renderCo() {
  const sub = cartTotal(), ship = shipFee();
  $("[data-co-sum]").innerHTML =
    `<div><span>جمع سبد</span><span>${fa(sub)} تومان</span></div>` +
    `<div><span>هزینه ارسال</span><span>${ship ? fa(ship) + " تومان" : "رایگان"}</span></div>` +
    `<div class="t"><span>مبلغ قابل پرداخت</span><span>${fa(sub + ship)} تومان</span></div>`;
  $("[data-pay-list]").innerHTML = payMethods.length
    ? payMethods.map((m, i) => `<label class="co__opt"><input type="radio" name="pay" value="${m.id}" ${i ? "" : "checked"}><span>${m.t}<small>${m.d}</small></span></label>`).join("")
    : `<p style="font-size:14px;opacity:.8">جزئیات پرداخت پس از ثبت سفارش، از طریق پیام‌رسان برایتان هماهنگ می‌شود.</p>`;
}
$("[data-checkout]").addEventListener("click", () => {
  try { const s = JSON.parse(localStorage.getItem("lorenj_cust") || "{}"); Object.entries(s).forEach(([k, v]) => { if (coForm.elements[k] && !coForm.elements[k].value) coForm.elements[k].value = v; }); } catch (_) {}
  renderCo(); setView("co");
});
$("[data-co-back]").addEventListener("click", () => setView(""));
$("[data-done-close]").addEventListener("click", () => { setView(""); closeCart(); });

function validate(c) {
  const bad = [];
  if (c.name.trim().length < 3) bad.push("name");
  if (!/^09\d{9}$/.test(enDigits(c.phone).replace(/\s|-/g, ""))) bad.push("phone");
  if (c.province.trim().length < 2) bad.push("province");
  if (c.city.trim().length < 2) bad.push("city");
  if (c.address.trim().length < 10) bad.push("address");
  if (!/^\d{10}$/.test(enDigits(c.postal))) bad.push("postal");
  return bad;
}
coForm.addEventListener("submit", async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(coForm));
  const err = $("[data-co-err]"); err.textContent = "";
  $$("input,textarea", coForm).forEach(i => i.classList.remove("bad"));
  const bad = validate(f);
  if (bad.length) {
    bad.forEach(n => coForm.elements[n].classList.add("bad"));
    coForm.elements[bad[0]].focus();
    err.textContent = "لطفاً موارد قرمز را درست و کامل وارد کنید (موبایل با ۰۹ و کد پستی ۱۰ رقمی)."; return;
  }
  const cust = { name: f.name.trim(), phone: enDigits(f.phone).replace(/\s|-/g, ""), province: f.province.trim(), city: f.city.trim(), address: f.address.trim(), postal: enDigits(f.postal), note: (f.note || "").trim() };
  try { localStorage.setItem("lorenj_cust", JSON.stringify(cust)); } catch (_) {}
  const pay = f.pay === "cod" ? "cod" : "prepay";
  const btn = $("[data-co-submit]"); btn.disabled = true; btn.textContent = "در حال ثبت سفارش…";
  try {
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: cust, payment: pay, items: Object.entries(cart).map(([id, qty]) => ({ id, qty })) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { err.textContent = data.error || "ثبت سفارش انجام نشد."; return; }
    cart = {}; saveCart();
    if (data.paymentUrl) { location.href = data.paymentUrl; return; }
    $("[data-done-code]").textContent = data.code;
    const T = fa(data.total) + " تومان";
    $("[data-done-pay]").textContent = pay === "cod"
      ? `مبلغ ${T} را هنگام تحویل بسته پرداخت می‌کنید. همکاران ما برای تأیید سفارش با شما تماس می‌گیرند.`
      : data.card ? `لطفاً مبلغ ${T} را به کارت ${data.card}${data.cardOwner ? " به نام " + data.cardOwner : ""} واریز کنید و رسید را در تلگرام @${CONFIG.telegram} بفرستید.`
      : `همکاران ما برای پیش‌پرداخت مبلغ ${T} با شما تماس می‌گیرند و راه پرداخت را اعلام می‌کنند.`;
    renderCart(); setView("done");
  } catch (_) {
    err.textContent = "ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.";
  } finally { btn.disabled = false; renderCo(); }
});

/* ==========================================================
   ۶) محاسبه‌گر مصرف
   ========================================================== */
const peopleIn = $("[data-people]"), mealsIn = $("[data-meals]");
let combo = {};
function renderCalc() {
  const people = +peopleIn.value, meals = +mealsIn.value;
  $("[data-people-out]").textContent = fa(people);
  $("[data-meals-out]").textContent = fa(meals);
  const raw = people * meals * 4.3 * 0.1;
  const need = Math.max(1, Math.ceil(raw));
  $("[data-need]").textContent = fa(need);

  combo = {}; let left = need;
  [...PRODUCTS].sort((a, b) => b.kg - a.kg).forEach(p => {
    const n = Math.floor(left / p.kg);
    if (n > 0) { combo[p.id] = n; left -= n * p.kg; }
  });
  const parts = Object.entries(combo).map(([id, n]) => `${fa(n)} بسته ${byId(id).label}`);
  $("[data-combo]").textContent = `پیشنهاد ما: ${parts.join(" و ")}`;
}
peopleIn.addEventListener("input", renderCalc);
mealsIn.addEventListener("input", renderCalc);
$("[data-add-combo]").addEventListener("click", () => {
  Object.entries(combo).forEach(([id, n]) => addToCart(id, n));
  toast("پیشنهاد به سبد اضافه شد"); openCart();
});
renderCalc();

/* ==========================================================
   خرید عمده
   ========================================================== */
const whForm = $("[data-wh]");
$("[data-tiers]").innerHTML = SHOP.wholesale.map(t => `<li><span>${t.label}</span><b>${fa(t.price)} <small>تومان / کیلو</small></b></li>`).join("");
function renderWh() {
  const kg = Math.floor(Number(enDigits(whForm.elements.kg.value))) || 0, per = SHOP.wholesalePrice(kg);
  $("[data-wh-per]").textContent = per > 0 ? `قیمت هر کیلو: ${fa(per)} تومان` : per < 0 ? "بیش از ۵ تن: تماس بگیرید" : "خرید عمده از ۱۰۰ کیلو شروع می‌شود";
  $("[data-wh-total]").textContent = per > 0 ? `${fa(kg * per)} تومان` : "";
}
whForm.addEventListener("input", renderWh); renderWh();
whForm.addEventListener("submit", async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(whForm)), err = $("[data-wh-err]"); err.textContent = "";
  try {
    const res = await fetch("/api/wholesale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { err.textContent = d.error || "ثبت نشد."; return; }
    whForm.reset(); whForm.elements.kg.value = 100; renderWh(); toast("درخواست شما ثبت شد؛ به‌زودی تماس می‌گیریم");
  } catch (_) { err.textContent = "ارتباط با سرور برقرار نشد."; }
});
const qp = new URLSearchParams(location.search);
if (qp.get("pay")) { toast(qp.get("pay") === "ok" ? `پرداخت موفق بود. کد سفارش: ${qp.get("code")}` : "پرداخت انجام نشد. اگر مبلغی کسر شده با ما تماس بگیرید."); history.replaceState(null, "", location.pathname); }

/* ==========================================================
   ۷) نوار بالا + حلقه اسکرول
   ========================================================== */
const nav = $(".nav");
const themed = $$("[data-theme]:not(.nav)");
function renderNav(heroT) {
  let theme = "dark";
  for (const s of themed) {
    const r = s.getBoundingClientRect();
    if (r.top <= 36 && r.bottom > 36) { theme = s.dataset.theme; break; }
  }
  if (theme === "dark" && heroT > 0.9 && hero.getBoundingClientRect().bottom > 36) theme = "light";
  if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
}

let ticking = false;
function tick() {
  const r = hero.getBoundingClientRect();
  heroTarget = reduced ? 0 : clamp(-r.top / (r.height - innerHeight));
  heroCur += (heroTarget - heroCur) * (reduced ? 1 : 0.14);
  if (Math.abs(heroTarget - heroCur) < 0.0004) heroCur = heroTarget;
  if (!reduced) renderHero(heroCur);
  renderLineup();
  renderNav(heroCur);
  if (heroCur !== heroTarget) requestAnimationFrame(tick); else ticking = false;
}
function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule);

/* ───────── راه‌اندازی ───────── */
if (CONFIG.shipText) $("[data-faq-ship]").textContent = CONFIG.shipText;
const faNum = s => s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
$("[data-contact]").innerHTML = `<a href="tel:${SHOP.phone}" dir="ltr">${faNum(SHOP.phone)}</a>  ·  <a href="https://t.me/${SHOP.telegram}" target="_blank" rel="noopener">تلگرام: @${SHOP.telegram}</a>`;
renderCart();
heroCur = 0;
schedule();
if (reduced) renderHero(0); else requestAnimationFrame(runIntro);
$(".hero__face--front").addEventListener("load", schedule);
heroBack.addEventListener("load", schedule);
addEventListener("load", schedule);
