/* Google Tag Manager, vùng chứa GTM-MD6TDLJN.
   Nằm ở tệp riêng thay vì đoạn dán sẵn của Google vì CSP (script-src không có 'unsafe-inline') chặn mọi script inline.
   GA4 (G-J9FR8F25SP) do chính vùng chứa này gửi, bằng thẻ "Google tag" kích hoạt ở Initialization - All Pages:
   KHÔNG nạp thêm gtag.js hay gọi gtag('config', ...) ở nơi khác, nếu không mỗi lượt xem bị đếm hai lần.

   Thời điểm nạp: ngay SAU DOMContentLoaded, vào lúc trình duyệt rảnh (tối đa 1,2 s). Nạp sớm hơn thì gtm.js (~200 KB,
   ~140 ms CPU) chạy chen giữa lúc trình duyệt đang chạy các script của trang và kéo trễ cả trang (đo được ~2 s ở trang
   chủ có màn chào). Đổi lại chỉ bỏ sót người rời đi trong khoảng 1 giây đầu. */
(function (w, d, l, i) {
  w[l] = w[l] || [];
  var started = false;
  function load() {
    if (started) return;
    started = true;
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
    (d.head || d.documentElement).appendChild(s);
  }
  function whenIdle() {
    if ('requestIdleCallback' in w) w.requestIdleCallback(load, { timeout: 1200 });
    else setTimeout(load, 0);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', whenIdle, { once: true });
  else whenIdle();
})(window, document, 'dataLayer', 'GTM-MD6TDLJN');
