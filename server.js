"use strict";
/* سرور لُرنج: بدون هیچ وابستگی خارجی (فقط Node.js 18 به بالا) */
const http = require("http"), https = require("https"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const SHOP = require("./public/js/shop-config.js");

const PORT = +process.env.PORT || 3000, HOST = process.env.HOST || "127.0.0.1";
const PROD = process.env.NODE_ENV === "production", PROXY = !!process.env.TRUST_PROXY;
const ZP = process.env.ZARINPAL_MERCHANT || "", SITE = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PUB = path.join(__dirname, "public"), DIR = path.join(__dirname, "data"), DBF = path.join(DIR, "db.json");
const STATUSES = ["new", "confirmed", "paid", "shipped", "delivered", "canceled"];

/* ───── پایگاه داده (فایل JSON، نوشتن اتمیک، دسترسی فقط برای صاحب فایل) ───── */
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
let db = { admin: null, orders: [], wholesale: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DBF, "utf8"))); } catch (_) {}
function save() { const t = DBF + ".tmp"; fs.writeFileSync(t, JSON.stringify(db), { mode: 0o600 }); fs.renameSync(t, DBF); }

/* ───── رمز عبور: scrypt + salt تصادفی ───── */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64, { N: 16384 }).toString("hex");
function setAdmin(user, pw) { const salt = crypto.randomBytes(16).toString("hex"); db.admin = { user, salt, hash: hashPw(pw, salt) }; save(); }
const randPw = () => crypto.randomBytes(12).toString("base64url");
if (process.argv.includes("--reset-admin") || !db.admin) {
  const pw = randPw(); setAdmin(process.env.ADMIN_USER || "admin", pw);
  console.log(`\n=== مدیر سایت ===\nنام کاربری: ${db.admin.user}\nرمز (فقط همین یک‌بار نمایش داده می‌شود): ${pw}\nبعد از اولین ورود از بخش «تنظیمات» عوضش کنید.\n`);
  if (process.argv.includes("--reset-admin")) process.exit(0);
}
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* ───── محدودکننده درخواست و نشست‌ها ───── */
const hits = new Map(), sessions = new Map();
function limited(key, max, ms) {
  const n = Date.now(), a = (hits.get(key) || []).filter(t => n - t < ms);
  a.push(n); hits.set(key, a); return a.length > max;
}
setInterval(() => { const n = Date.now(); hits.forEach((a, k) => { if (!a.length || n - a[a.length - 1] > 3600e3) hits.delete(k); }); sessions.forEach((s, k) => { if (s.exp < n) sessions.delete(k); }); }, 600e3).unref();
const ipOf = req => (PROXY && (req.headers["x-real-ip"] || "").trim()) || req.socket.remoteAddress || "?";

/* ───── ابزارها ───── */
const SEC = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()", "Cross-Origin-Opener-Policy": "same-origin"
};
if (PROD) SEC["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(code, { ...SEC, "Content-Type": type, "Cache-Control": "no-store", ...extra }); res.end(body);
}
const json = (res, code, o, extra) => send(res, code, JSON.stringify(o), undefined, extra);
function body(req) {
  return new Promise((ok, no) => {
    if (!/^application\/json/i.test(req.headers["content-type"] || "")) return no(new Error("type"));
    let d = "", n = 0;
    req.on("data", c => { n += c.length; if (n > 20000) { no(new Error("big")); req.destroy(); } else d += c; });
    req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (_) { no(new Error("json")); } });
    req.on("error", no);
  });
}
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const digits = s => String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const phoneOk = p => /^09\d{9}$/.test(p);
const newCode = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "L"; for (const b of crypto.randomBytes(6)) s += A[b % A.length]; return s; };
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(c => c.trim().split("=")).filter(c => c[0]).map(c => [c[0], c.slice(1).join("=")]));

/* ───── API عمومی: ثبت سفارش ───── */
function priceOrder(items) {
  if (!Array.isArray(items) || !items.length || items.length > 10) return null;
  const out = []; let sub = 0;
  for (const it of items) {
    const id = String(it.id), qty = Number(it.qty);
    if (!Object.hasOwn(SHOP.prices, id) || !Number.isInteger(qty) || qty < 1 || qty > 99) return null;
    out.push({ id, kg: +id / 1000, qty, price: SHOP.prices[id] }); sub += SHOP.prices[id] * qty;
  }
  const ship = SHOP.freeShipFrom && sub >= SHOP.freeShipFrom ? 0 : SHOP.shipCost;
  return { items: out, subtotal: sub, shipping: ship, total: sub + ship };
}
function zp(endpoint, data) {
  return new Promise((ok, no) => {
    const b = JSON.stringify(data);
    const r = https.request({ host: "payment.zarinpal.com", path: `/pg/v4/payment/${endpoint}.json`, method: "POST", timeout: 12000,
      headers: { "Content-Type": "application/json", Accept: "application/json", "Content-Length": Buffer.byteLength(b) } },
      s => { let d = ""; s.on("data", c => d += c); s.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { no(e); } }); });
    r.on("timeout", () => r.destroy(new Error("timeout"))); r.on("error", no); r.end(b);
  });
}
async function createOrder(req, res) {
  if (limited("ord:" + ipOf(req), 8, 3600e3)) return json(res, 429, { error: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." });
  const d = await body(req), c = d.customer || {};
  const p = priceOrder(d.items);
  const cust = { name: clean(c.name, 80), phone: digits(clean(c.phone, 20)).replace(/[\s-]/g, ""), province: clean(c.province, 40), city: clean(c.city, 40), address: clean(c.address, 300), postal: digits(clean(c.postal, 12)), note: clean(c.note, 200) };
  if (!p || cust.name.length < 3 || !phoneOk(cust.phone) || cust.province.length < 2 || cust.city.length < 2 || cust.address.length < 10 || !/^\d{10}$/.test(cust.postal) || !["prepay", "cod"].includes(d.payment))
    return json(res, 400, { error: "اطلاعات سفارش کامل یا معتبر نیست." });
  const o = { code: newCode(), at: Date.now(), status: "new", payment: d.payment, paid: false, customer: cust, ...p, tracking: "", adminNote: "" };
  db.orders.push(o);
  const out = { code: o.code, total: o.total, payment: o.payment };
  if (o.payment === "prepay") {
    if (ZP) {
      try {
        const r = await zp("request", { merchant_id: ZP, amount: o.total * 10, currency: "IRR", description: "سفارش " + o.code, callback_url: `${SITE}/api/pay/callback`, metadata: { mobile: cust.phone } });
        if (r.data && r.data.authority) { o.authority = r.data.authority; out.paymentUrl = "https://payment.zarinpal.com/pg/StartPay/" + r.data.authority; }
      } catch (_) {}
    }
    if (!out.paymentUrl && SHOP.cardNumber) { out.card = SHOP.cardNumber; out.cardOwner = SHOP.cardOwner; }
  }
  save(); json(res, 200, out);
}
async function payCallback(req, res, q) {          // بازگشت از درگاه: تأیید پرداخت سمت سرور
  const o = db.orders.find(x => x.authority && x.authority === q.get("Authority"));
  let ok = false;
  if (o && !o.paid && q.get("Status") === "OK" && ZP) {
    try { const r = await zp("verify", { merchant_id: ZP, amount: o.total * 10, authority: o.authority }); ok = !!r.data && [100, 101].includes(r.data.code); if (ok) { o.paid = true; o.status = "paid"; o.refId = String(r.data.ref_id || ""); save(); } } catch (_) {}
  }
  res.writeHead(302, { ...SEC, Location: `/?pay=${ok ? "ok" : "fail"}&code=${o ? o.code : ""}` }); res.end();
}
async function wholesale(req, res) {
  if (limited("wh:" + ipOf(req), 5, 3600e3)) return json(res, 429, { error: "تعداد درخواست‌ها زیاد است." });
  const d = await body(req), kg = Number(digits(d.kg)), per = SHOP.wholesalePrice(kg);
  const w = { id: newCode(), at: Date.now(), name: clean(d.name, 80), phone: digits(clean(d.phone, 20)).replace(/[\s-]/g, ""), note: clean(d.note, 300), kg, perKg: per, status: "new" };
  if (!Number.isInteger(kg) || per <= 0 || w.name.length < 3 || !phoneOk(w.phone)) return json(res, 400, { error: "مقدار (۱۰۰ تا ۵۰۰۰ کیلو)، نام و موبایل را درست وارد کنید." });
  db.wholesale.push(w); save(); json(res, 200, { id: w.id });
}

/* ───── API مدیر ───── */
function session(req) { const s = sessions.get(cookies(req).sid); if (!s || s.exp < Date.now()) return null; s.exp = Date.now() + 2 * 3600e3; return s; }
function sameOrigin(req) { const o = req.headers.origin; return !o || o === (req.headers.host && (PROD ? "https://" : "http://") + req.headers.host); }
const csvCell = v => { v = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
function customers() {
  const m = new Map();
  db.orders.forEach(o => { const c = m.get(o.customer.phone) || { ...o.customer, orders: 0, spent: 0, last: 0 }; c.orders++; if (o.status !== "canceled") c.spent += o.total; c.last = Math.max(c.last, o.at); c.name = o.customer.name; m.set(o.customer.phone, c); });
  return [...m.values()].sort((a, b) => b.last - a.last);
}
async function admin(req, res, p, q) {
  const ip = ipOf(req);
  if (p === "/api/admin/login" && req.method === "POST") {
    if (!sameOrigin(req)) return json(res, 403, { error: "forbidden" });
    if (limited("login:" + ip, 6, 15 * 60e3) || limited("login:all", 40, 15 * 60e3)) return json(res, 429, { error: "تلاش‌های زیاد. ۱۵ دقیقه بعد دوباره امتحان کنید." });
    const d = await body(req), hash = hashPw(String(d.pass || "").slice(0, 200), db.admin.salt);
    const ok = safeEq(hash, db.admin.hash) & safeEq(clean(d.user, 50), db.admin.user);
    if (!ok) return json(res, 401, { error: "نام کاربری یا رمز اشتباه است." });
    const sid = crypto.randomBytes(32).toString("hex"), csrf = crypto.randomBytes(16).toString("hex");
    sessions.set(sid, { csrf, exp: Date.now() + 2 * 3600e3 });
    return json(res, 200, { csrf }, { "Set-Cookie": `sid=${sid}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=7200${PROD ? "; Secure" : ""}` });
  }
  const s = session(req);
  if (!s) return json(res, 401, { error: "auth" });
  if (req.method === "POST" && (!sameOrigin(req) || req.headers["x-csrf"] !== s.csrf)) return json(res, 403, { error: "forbidden" });
  if (p === "/api/admin/me") return json(res, 200, { csrf: s.csrf });
  if (p === "/api/admin/logout" && req.method === "POST") { sessions.delete(cookies(req).sid); return json(res, 200, {}, { "Set-Cookie": "sid=; Max-Age=0; Path=/api/admin; HttpOnly; SameSite=Strict" }); }
  if (p === "/api/admin/data") {
    const act = db.orders.filter(o => o.status !== "canceled"), day = new Date().setHours(0, 0, 0, 0);
    return json(res, 200, { orders: [...db.orders].reverse(), wholesale: [...db.wholesale].reverse(), customers: customers(),
      stats: { orders: db.orders.length, today: db.orders.filter(o => o.at >= day).length, fresh: db.orders.filter(o => o.status === "new").length, revenue: act.filter(o => o.paid || o.status === "delivered").reduce((a, o) => a + o.total, 0), pending: act.filter(o => !o.paid && o.status !== "delivered").reduce((a, o) => a + o.total, 0), customers: customers().length, wholesale: db.wholesale.length } });
  }
  if (p === "/api/admin/export.csv") {
    const rows = [["کد", "تاریخ", "وضعیت", "پرداخت", "پرداخت‌شده", "نام", "موبایل", "استان", "شهر", "آدرس", "کدپستی", "اقلام", "جمع (تومان)", "کد رهگیری"]];
    db.orders.forEach(o => rows.push([o.code, new Date(o.at).toISOString(), o.status, o.payment, o.paid ? "بله" : "خیر", o.customer.name, o.customer.phone, o.customer.province, o.customer.city, o.customer.address, o.customer.postal, o.items.map(i => `${i.kg}kg×${i.qty}`).join(" + "), o.total, o.tracking]));
    return send(res, 200, "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"), "text/csv; charset=utf-8", { "Content-Disposition": 'attachment; filename="orders.csv"' });
  }
  if (p === "/api/admin/order" && req.method === "POST") {
    const d = await body(req), o = db.orders.find(x => x.code === d.code);
    if (!o || !STATUSES.includes(d.status)) return json(res, 400, { error: "bad" });
    o.status = d.status; o.tracking = clean(d.tracking, 40); o.adminNote = clean(d.adminNote, 300);
    if (d.paid === true || d.paid === false) o.paid = d.paid;
    save(); return json(res, 200, { ok: true });
  }
  if (p === "/api/admin/wholesale" && req.method === "POST") {
    const d = await body(req), w = db.wholesale.find(x => x.id === d.id);
    if (!w || !["new", "contacted", "done", "canceled"].includes(d.status)) return json(res, 400, { error: "bad" });
    w.status = d.status; save(); return json(res, 200, { ok: true });
  }
  if (p === "/api/admin/password" && req.method === "POST") {
    const d = await body(req), np = String(d.next || "");
    if (!safeEq(hashPw(String(d.old || ""), db.admin.salt), db.admin.hash)) return json(res, 400, { error: "رمز فعلی اشتباه است." });
    if (np.length < 10 || np.length > 200 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) return json(res, 400, { error: "رمز جدید باید حداقل ۱۰ کاراکتر و شامل حرف و عدد باشد." });
    setAdmin(db.admin.user, np); sessions.clear(); return json(res, 200, { ok: true });
  }
  json(res, 404, { error: "not found" });
}

/* ───── فایل‌های ایستا (فقط داخل public، بدون نمایش لیست پوشه) ───── */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
function serve(req, res, p) {
  if (p === "/") p = "/index.html";
  if (p === "/admin" || p === "/admin/") p = "/admin/index.html";
  let f; try { f = path.normalize(path.join(PUB, decodeURIComponent(p))); } catch (_) { return send(res, 400, "bad", "text/plain"); }
  if (!f.startsWith(PUB + path.sep) || p.includes("\0") || /(^|[\\/])\./.test(path.relative(PUB, f))) return send(res, 404, "not found", "text/plain");
  fs.readFile(f, (e, data) => {
    const t = TYPES[path.extname(f)];
    if (e || !t) return send(res, 404, "not found", "text/plain");
    const ex = { "Cache-Control": /\.(png|jpg|ttf|woff2)$/.test(f) ? "public, max-age=86400" : "no-cache" };
    if (p.startsWith("/admin")) ex["X-Robots-Tag"] = "noindex, nofollow";
    res.writeHead(200, { ...SEC, "Content-Type": t, ...ex }); res.end(req.method === "HEAD" ? undefined : data);
  });
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x"), p = u.pathname;
    if (limited("all:" + ipOf(req), 600, 60e3)) return json(res, 429, { error: "slow down" });
    if (p.startsWith("/api/")) {
      if (p === "/api/orders" && req.method === "POST") return await createOrder(req, res);
      if (p === "/api/wholesale" && req.method === "POST") return await wholesale(req, res);
      if (p === "/api/pay/callback" && req.method === "GET") return await payCallback(req, res, u.searchParams);
      if (p.startsWith("/api/admin/")) return await admin(req, res, p, u.searchParams);
      return json(res, 404, { error: "not found" });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", "text/plain");
    serve(req, res, p);
  } catch (e) {
    json(res, e && ["type", "big", "json"].includes(e.message) ? 400 : 500, { error: "خطا در پردازش درخواست" });
  }
}).listen(PORT, HOST, () => console.log(`لُرنج روی ${HOST}:${PORT} آماده است  →  ${SITE}   |  پنل مدیر: ${SITE}/admin`));
