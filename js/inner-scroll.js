/* ==========================================================================
   Android: trang chủ cuộn trong thân trang (body) thay vì cuộn cả tài liệu
   --------------------------------------------------------------------------
   VÌ SAO: trình duyệt Android (Chrome, Chrome Custom Tab, trình duyệt nhúng) ẩn thanh địa chỉ khi cuộn TÀI LIỆU.
   Mỗi lần thanh trượt đi hay hiện lại, cả trang bị kéo lên xuống ~50px, chiều cao nhìn thấy đổi giữa chừng nên khung hero
   hở dải nền xanh hoặc thừa ra ngoài màn hình, và quãng cuộn đầu bị thanh "ăn" mất nên video đứng yên rồi mới chạy.
   Trình duyệt chỉ ẩn thanh khi cuộn tài liệu gốc. Cho body tự cuộn (html cố định) thì thanh luôn hiện, chiều cao nhìn thấy
   không bao giờ đổi, khung hero luôn vừa khít màn hình và cuộn chạy video ngay từ điểm chạm đầu tiên.

   CÁCH LÀM: script này chạy sớm nhất trong <head>, chỉ khi là điện thoại Android (không phải bot) và đặt lớp
   html.inner-scroll (CSS trong css/style.css). Các script còn lại của trang giữ nguyên: scrollY, scrollTo, scrollHeight,
   sự kiện scroll và ResizeObserver trên body được chuyển sang body để chúng không biết gì khác.
   Máy tính, iOS, bot: không làm gì cả. ?inner=0 tắt, ?inner=1 ép bật (kiểm thử).
   Nếu sau khi tải xong mà trang không cuộn được thì tự tắt và trả mọi thứ về như cũ (window.__innerScrollOff()).
   ========================================================================== */
(function () {
  'use strict';
  try {
    var w = window, d = document, de = d.documentElement, q = w.location.search;
    if (/[?&]inner=0(?:&|$)/.test(q)) return;
    var ua = w.navigator.userAgent || '';
    var forced = /[?&]inner=1(?:&|$)/.test(q);
    var auto = /Android/i.test(ua) && !/bot|crawl|spider|lighthouse|pagespeed|headlesschrome/i.test(ua) &&
      w.matchMedia('(max-width: 760px)').matches && w.matchMedia('(pointer: coarse)').matches;
    if (!forced && !auto) return;

    var undo = [];
    function patch(obj, name, desc) {
      var old = Object.getOwnPropertyDescriptor(obj, name);
      undo.push(function () { if (old) Object.defineProperty(obj, name, old); else delete obj[name]; });
      Object.defineProperty(obj, name, desc);
    }
    function method(obj, name, fn) {
      var old = obj[name];
      obj[name] = fn;
      undo.push(function () { obj[name] = old; });
    }
    var body = function () { return d.body; };
    var top = function () { var b = body(); return b ? b.scrollTop : 0; };
    function to(a, b) {
      var s = body();
      if (!s) return;
      if (a && typeof a === 'object') s.scrollTo(a); else s.scrollTo(+a || 0, +b || 0);
    }

    de.classList.add('inner-scroll');
    patch(w, 'scrollY', { get: top, configurable: true });
    patch(w, 'pageYOffset', { get: top, configurable: true });
    patch(de, 'scrollHeight', { get: function () { var b = body(); return b ? b.scrollHeight : 0; }, configurable: true });
    method(w, 'scrollTo', to);
    method(w, 'scroll', to);
    method(w, 'scrollBy', function (a, b) {
      var s = body();
      if (!s) return;
      if (a && typeof a === 'object') s.scrollBy(a); else s.scrollBy(+a || 0, +b || 0);
    });

    // body cao đúng bằng màn hình nên offsetHeight không còn phản ánh chiều cao trang: trả scrollHeight
    var oh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    if (oh && oh.get) patch(HTMLElement.prototype, 'offsetHeight', {
      get: function () { return this === d.body ? this.scrollHeight : oh.get.call(this); }, configurable: true
    });
    // ...và ResizeObserver trên body không còn thấy nội dung dài ra hay ngắn đi: quan sát các phần tử con trực tiếp của body
    var RO = w.ResizeObserver;
    if (RO) {
      var WRO = function (cb) {
        var ro = new RO(cb), obs = ro.observe.bind(ro);
        ro.observe = function (t, o) {
          if (t === d.body) Array.prototype.forEach.call(d.body.children, function (c) { if (c.tagName !== 'SCRIPT') obs(c, o); });
          else obs(t, o);
        };
        return ro;
      };
      WRO.prototype = RO.prototype;
      method(w, 'ResizeObserver', WRO);
    }

    // sự kiện scroll của body được phát lại trên window (kb-nav.js nghe trên window)
    var fwd = function () { w.dispatchEvent(new Event('scroll')); };
    function bind() { if (d.body) d.body.addEventListener('scroll', fwd, { passive: true }); }
    if (d.body) bind(); else d.addEventListener('DOMContentLoaded', bind);
    undo.push(function () { if (d.body) d.body.removeEventListener('scroll', fwd); });

    // chiều cao nhìn thấy cho khung hero (css: var(--ih))
    var ih = function () { de.style.setProperty('--ih', w.innerHeight + 'px'); };
    ih();
    w.addEventListener('resize', ih);

    function off() {
      de.classList.remove('inner-scroll');
      undo.reverse().forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } });
      undo = [];
    }
    w.__innerScrollOff = off;
    w.addEventListener('load', function () {
      setTimeout(function () {
        var b = d.body;
        if (b && de.classList.contains('inner-scroll') && b.scrollHeight <= w.innerHeight + 8) off();
      }, 2500);
    });
  } catch (e) { /* mọi lỗi: giữ nguyên cách cuộn thường */ }
})();
