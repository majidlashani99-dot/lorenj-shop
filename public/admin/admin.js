"use strict";
const $ = s => document.querySelector(s), fa = n => Number(n).toLocaleString("fa-IR");
const ST = { new: "جدید", confirmed: "تأیید شده", paid: "پرداخت‌شده", shipped: "ارسال شد", delivered: "تحویل شد", canceled: "لغو شده" };
const WST = { new: "جدید", contacted: "تماس گرفته شد", done: "نهایی شد", canceled: "لغو" };
const PAY = { prepay: "پیش‌پرداخت", cod: "پرداخت در محل" };
let csrf = "", data = null, tab = "dash";
const el = (t, p = {}, ...k) => { const e = document.createElement(t); Object.entries(p).forEach(([a, v]) => a === "on" ? Object.entries(v).forEach(([ev, f]) => e.addEventListener(ev, f)) : a === "class" ? e.className = v : e[a] = v); k.flat().forEach(c => e.append(c)); return e; };
const when = t => new Date(t).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
async function api(path, body) {
  const r = await fetch("/api/admin/" + path, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF": csrf }, body: JSON.stringify(body) });
  if (r.status === 401 && path !== "login") { showLogin(); throw new Error("auth"); }
  const j = r.headers.get("content-type")?.includes("json") ? await r.json() : null;
  if (!r.ok) throw new Error((j && j.error) || "خطا");
  return j;
}
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }
async function load() { data = await api("data"); $("#login").hidden = true; $("#app").hidden = false; draw(); }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); const f = new FormData(e.target), err = $("#loginErr"); err.textContent = "";
  try { csrf = (await api("login", { user: f.get("user"), pass: f.get("pass") })).csrf; e.target.reset(); await load(); } catch (x) { err.textContent = x.message; }
});
$("#out").addEventListener("click", async () => { try { await api("logout", {}); } catch (_) {} csrf = ""; showLogin(); });
const TABS = [["dash", "داشبورد"], ["orders", "سفارش‌ها"], ["customers", "مشتریان"], ["wh", "خرید عمده"], ["set", "تنظیمات"]];
function draw() {
  const t = $("#tabs"); t.replaceChildren(...TABS.map(([k, n]) => el("button", { textContent: n, on: { click: () => { tab = k; draw(); } } , ariaCurrent: String(k === tab) })));
  TABS.forEach(([k], i) => t.children[i].setAttribute("aria-current", k === tab));
  $("#view").replaceChildren(...({ dash, orders, customers, wh, set })[tab]());
}
const card = (l, v) => el("div", { class: "card" }, el("small", { textContent: l }), el("b", { textContent: v }));
function table(head, rows) { return el("div", { class: "wrap" }, el("table", {}, el("thead", {}, el("tr", {}, head.map(h => el("th", { textContent: h })))), el("tbody", {}, rows))); }
const td = (v, cls) => el("td", cls ? { class: cls } : {}, v instanceof Node ? v : String(v));
function dash() {
  const s = data.stats;
  return [el("h2", { textContent: "نمای کلی" }), el("div", { class: "cards" }, card("کل سفارش‌ها", fa(s.orders)), card("سفارش امروز", fa(s.today)), card("سفارش جدید (بررسی‌نشده)", fa(s.fresh)), card("فروش تأییدشده (تومان)", fa(s.revenue)), card("در انتظار پرداخت (تومان)", fa(s.pending)), card("مشتریان", fa(s.customers)), card("درخواست عمده", fa(s.wholesale))),
    el("h2", { textContent: "آخرین سفارش‌ها" }), ordersTable(data.orders.slice(0, 6))];
}
function ordersTable(list) {
  return table(["کد", "زمان", "مشتری", "مبلغ (تومان)", "پرداخت", "وضعیت", ""], list.map(o => {
    const tr = el("tr", {}, td(o.code), td(when(o.at)), td(o.customer.name + " — " + o.customer.city), td(fa(o.total)),
      td(el("span", { class: "tag " + (o.paid ? "paid" : "no"), textContent: PAY[o.payment] + (o.paid ? " ✓" : "") })), td(el("span", { class: "tag", textContent: ST[o.status] })),
      td(el("button", { class: "ghost", textContent: "جزئیات", on: { click: () => detail(o, tr) } })));
    return tr;
  }));
}
function detail(o, tr) {
  const nx = tr.nextSibling; if (nx && nx.classList && nx.classList.contains("dt")) return nx.remove();
  const sel = el("select", {}, Object.entries(ST).map(([k, v]) => el("option", { value: k, textContent: v, selected: k === o.status })));
  const trk = el("input", { placeholder: "کد رهگیری پست", value: o.tracking || "" }), note = el("input", { placeholder: "یادداشت مدیر", value: o.adminNote || "" });
  const paid = el("input", { type: "checkbox", checked: o.paid, style: "width:auto" }), msg = el("span", { class: "ok" });
  const b = el("button", { class: "btn", textContent: "ذخیره", on: { click: async () => { try { await api("order", { code: o.code, status: sel.value, tracking: trk.value, adminNote: note.value, paid: paid.checked }); await load(); } catch (x) { msg.textContent = x.message; msg.className = "err"; } } } });
  const c = o.customer;
  tr.after(el("tr", { class: "dt" }, el("td", { colSpan: 7 }, el("div", { class: "det" },
    el("div", { textContent: `${c.name} | ${c.phone} | ${c.province}، ${c.city} | کدپستی ${c.postal}` }), el("div", { textContent: "آدرس: " + c.address }),
    el("div", { textContent: "اقلام: " + o.items.map(i => `${fa(i.qty)} × ${fa(i.kg)} کیلو`).join(" ، ") + ` | ارسال: ${o.shipping ? fa(o.shipping) : "رایگان"}` + (c.note ? " | توضیح مشتری: " + c.note : "") }),
    el("div", { class: "row" }, sel, trk, note, el("label", { class: "row" }, paid, "پرداخت شده"), b, msg)))));
}
function orders() {
  const q = el("input", { placeholder: "جستجو: کد، نام، موبایل، شهر…" }), f = el("select", {}, el("option", { value: "", textContent: "همه وضعیت‌ها" }), Object.entries(ST).map(([k, v]) => el("option", { value: k, textContent: v })));
  const box = el("div"); const run = () => { const s = q.value.trim().toLowerCase(); box.replaceChildren(ordersTable(data.orders.filter(o => (!f.value || o.status === f.value) && (!s || [o.code, o.customer.name, o.customer.phone, o.customer.city].join(" ").toLowerCase().includes(s))))); };
  q.addEventListener("input", run); f.addEventListener("change", run); run();
  return [el("h2", { textContent: "سفارش‌ها" }), el("div", { class: "row" }, q, f, el("a", { class: "ghost", href: "/api/admin/export.csv", textContent: "خروجی اکسل (CSV)" })), box];
}
function customers() {
  return [el("h2", { textContent: "اطلاعات مشتریان" }), table(["نام", "موبایل", "استان / شهر", "آدرس آخرین سفارش", "تعداد سفارش", "جمع خرید (تومان)", "آخرین خرید"], data.customers.map(c => el("tr", {}, td(c.name), td(c.phone), td(c.province + " / " + c.city), td(c.address), td(fa(c.orders)), td(fa(c.spent)), td(when(c.last)))))];
}
function wh() {
  return [el("h2", { textContent: "درخواست‌های خرید عمده" }), table(["زمان", "نام", "موبایل", "مقدار (کیلو)", "قیمت هر کیلو", "جمع تقریبی (تومان)", "توضیحات", "وضعیت"], data.wholesale.map(w => {
    const s = el("select", { on: { change: async () => { await api("wholesale", { id: w.id, status: s.value }); await load(); } } }, Object.entries(WST).map(([k, v]) => el("option", { value: k, textContent: v, selected: k === w.status })));
    return el("tr", {}, td(when(w.at)), td(w.name), td(w.phone), td(fa(w.kg)), td(fa(w.perKg)), td(fa(w.kg * w.perKg)), td(w.note || "—"), td(s));
  }))];
}
function set() {
  const o = el("input", { type: "password", autocomplete: "current-password" }), n = el("input", { type: "password", autocomplete: "new-password" }), m = el("p", { class: "err" });
  return [el("h2", { textContent: "تنظیمات" }), el("div", { class: "pw" }, el("b", { textContent: "تغییر رمز عبور" }), el("label", {}, "رمز فعلی", o), el("label", {}, "رمز جدید (حداقل ۱۰ کاراکتر، حرف و عدد)", n), m,
    el("button", { class: "btn", textContent: "تغییر رمز", on: { click: async () => { try { await api("password", { old: o.value, next: n.value }); showLogin(); } catch (x) { m.textContent = x.message; } } } })),
    el("p", { textContent: "قیمت‌ها و هزینه ارسال در فایل public/js/shop-config.js تغییر می‌کند." })];
}
api("me").then(r => { csrf = r.csrf; return load(); }).catch(() => showLogin());
