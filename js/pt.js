/* ==========================================================================
   CHUYỂN CẢNH KHI VÀO TRANG GÓC KIẾN THỨC
   Trang trước đã kéo màn tối lên che màn hình (js/fx.js, .pt.is-leave); file này lo nửa còn lại:
   trang mới mở ra với màn tối phủ sẵn rồi hạ xuống để lộ nội dung, thay vì hiện ra đột ngột.

   Phải nạp ĐỒNG BỘ trong <head> (không dùng defer) để màn phủ có ngay từ khung hình đầu tiên.
   Kiểu dáng nằm ở css/kb-core.css (html.is-pt-in / html.is-pt-out).

   Chỉ chạy khi người đọc vừa bấm một liên kết trong website (nhận biết qua cờ phiên "ltv-pt" của
   fx.js, hoặc trang giới thiệu cùng tên miền). Mở thẳng địa chỉ, tải lại trang, bấm nút quay lại
   hay vào từ Google đều KHÔNG có màn phủ.
   ========================================================================== */
(() => {
  'use strict';
  const html = document.documentElement;

  // Cờ do fx.js đặt lúc rời trang. Đọc xong xoá ngay để không còn sót lại cho lần sau.
  let flagged = false;
  try {
    flagged = sessionStorage.getItem('ltv-pt') === '1';
    sessionStorage.removeItem('ltv-pt');
  } catch (_) { /* trình duyệt chặn sessionStorage: bỏ qua */ }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = location.search;
  if (reduced || params.indexOf('nofx') > -1) return;      // ?nofx dùng khi đo hiệu năng

  // Vào từ một trang khác của chính website (không tính tải lại trang và nút quay lại)
  const entry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  const sameSite = document.referrer.indexOf(location.origin + '/') === 0;
  const fresh = !entry.type || entry.type === 'navigate';
  if (!flagged && !(sameSite && fresh)) return;

  html.classList.add('is-pt-in');

  let done = false;
  const open = () => {
    if (done) return;
    done = true;
    html.classList.add('is-pt-out');
    setTimeout(() => html.classList.remove('is-pt-in', 'is-pt-out'), 1200);
  };
  const start = () => requestAnimationFrame(() => requestAnimationFrame(open));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  setTimeout(open, 2500);                                  // an toàn: không để màn phủ kẹt lại
})();
