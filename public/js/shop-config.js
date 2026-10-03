/* تنظیمات مشترک سایت و سرور (قیمت‌ها فقط همین‌جا عوض می‌شود؛ سرور قیمت نهایی را خودش از همین فایل حساب می‌کند) */
(function (root) {
  const C = {
    phone: "09109268102",
    telegram: "lorenj_ir",
    prices: { "1000": 620000, "5000": 3050000, "10000": 6000000 },   // تومان
    shipCost: 150000,          // هزینه ارسال (نمونه؛ مقدار واقعی خودتان را بگذارید)
    freeShipFrom: 1500000,     // ارسال رایگان از این مبلغ به بالا (0 = غیرفعال)
    cardNumber: "",            // شماره کارت برای پیش‌پرداخت کارت‌به‌کارت (اختیاری)
    cardOwner: "",
    // خرید عمده: قیمت هر کیلو (تومان). از ۱۰۰ کیلو تا ۵ تن
    wholesale: [
      { min: 100,  price: 585000, label: "۱۰۰ کیلو به بالا" },
      { min: 200,  price: 580000, label: "۲۰۰ کیلو به بالا" },
      { min: 1000, price: 550000, label: "۱ تا ۵ تن" }
    ],
    wholesaleMax: 5000,
    wholesalePrice(kg) {       // 0 = زیر حد عمده، -1 = بالای ۵ تن (تماس بگیرید)
      if (!(kg >= 100)) return 0;
      if (kg > C.wholesaleMax) return -1;
      let p = 0; C.wholesale.forEach(t => { if (kg >= t.min) p = t.price; });
      return p;
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = C; else root.SHOP = C;
})(typeof self !== "undefined" ? self : this);
