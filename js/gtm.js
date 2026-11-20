/* Google Tag Manager, vùng chứa GTM-MD6TDLJN.
   Nằm ở tệp riêng thay vì đoạn dán sẵn của Google vì CSP (script-src không có 'unsafe-inline') chặn mọi script inline.
   GA4 (G-J9FR8F25SP) do chính vùng chứa này gửi, bằng thẻ "Google tag" kích hoạt ở Initialization - All Pages:
   KHÔNG nạp thêm gtag.js hay gọi gtag('config', ...) ở nơi khác, nếu không mỗi lượt xem bị đếm hai lần. */
(function (w, d, l, i) {
  w[l] = w[l] || [];
  w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = d.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
  (d.head || d.documentElement).appendChild(s);
})(window, document, 'dataLayer', 'GTM-MD6TDLJN');
