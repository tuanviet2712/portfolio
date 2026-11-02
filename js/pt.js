/* ==========================================================================
   CHUYỂN CẢNH KHI VÀO TRANG (TRANG CHỦ & GÓC KIẾN THỨC / BÀI VIẾT)
   Trang trước đã kéo màn xanh có logo lên che màn hình (js/fx.js, .pt.is-leave); file này lo nửa còn lại:
   trang mới mở ra với màn xanh có logo phủ sẵn, định vị xong vị trí trang đích ở phía sau rồi mới
   mượt mà hạ màn xuống để lộ nội dung, thay vì hiện ra đột ngột.

   Phải nạp ĐỒNG BỘ trong <head> (không dùng defer) để màn phủ có ngay từ khung hình đầu tiên.
   Kiểu dáng nằm ở css/kb-core.css (html.is-pt-in / html.is-pt-out).

   Chỉ chạy khi người đọc vừa bấm một liên kết chuyển trang trong website (nhận biết qua cờ phiên "ltv-pt"
   của fx.js, hoặc trang giới thiệu cùng tên miền). Đổi ngôn ngữ tức thì (ltv-lang-scroll), mở thẳng địa chỉ,
   tải lại trang hay bấm nút quay lại đều KHÔNG có màn phủ.
   ========================================================================== */
(() => {
  'use strict';
  const html = document.documentElement;

  // Khi đổi ngôn ngữ tức thì (EN <-> VI), bỏ qua màn phủ và nhảy ngay về Hero section (scrollY = 0)
  let isLangSwitch = false;
  try {
    isLangSwitch = sessionStorage.getItem('ltv-lang-switch') === '1' || !!sessionStorage.getItem('ltv-lang-scroll');
    if (isLangSwitch) {
      sessionStorage.removeItem('ltv-lang-switch');
      sessionStorage.removeItem('ltv-lang-scroll');
    }
  } catch (_) {}
  if (isLangSwitch) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    html.classList.remove('smooth');
    html.classList.add('is-lang-switch');
    window.__ltvLangSwitch = true;
    try {
      const st = document.createElement('style');
      st.textContent = 'html.is-lang-switch{scroll-behavior:auto!important}html.is-lang-switch body.is-loading{overflow:auto!important}html.is-lang-switch #preloader{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}html.is-lang-switch .hero-name .hn>span,html.is-lang-switch .intro-fade{opacity:1!important;transform:none!important;transition:none!important;transition-delay:0s!important}';
      (document.head || html).appendChild(st);
      window.scrollTo(0, 0);
    } catch (_) {}
    return;
  }

  // Cờ do fx.js đặt lúc rời trang. Đọc xong xoá ngay để không còn sót lại cho lần sau.
  let flagged = false;
  try {
    flagged = sessionStorage.getItem('ltv-pt') === '1';
    sessionStorage.removeItem('ltv-pt');
  } catch (_) { /* trình duyệt chặn sessionStorage: bỏ qua */ }

  const params = location.search;
  if (params.indexOf('nomotion') > -1 || params.indexOf('nofx') > -1) return;      // ?nofx dùng khi đo hiệu năng

  // Vào từ một trang khác của chính website (không tính tải lại trang và nút quay lại)
  const entry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  const sameSite = document.referrer.indexOf(location.origin + '/') === 0;
  const fresh = !entry.type || entry.type === 'navigate';
  if (!flagged && !(sameSite && fresh)) return;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  html.classList.add('is-pt-in');

  let done = false;
  const open = () => {
    if (done) return;
    done = true;
    const pt = document.querySelector('.pt');
    if (pt) {
      pt.classList.remove('is-leave', 'is-cover', 'is-out');
      // Ép trình duyệt chốt trạng thái màn xanh đang phủ kín (clip-path: inset(0 0 0 0))
      // trước khi thêm is-pt-out để hiệu ứng hạ màn xuống luôn kích hoạt mượt 100%
      void pt.offsetHeight;
      try { void getComputedStyle(pt).clipPath; } catch (_) {}
    }
    requestAnimationFrame(() => {
      html.classList.add('is-pt-out');
      setTimeout(() => html.classList.remove('is-pt-in', 'is-pt-out'), 1150);
    });
  };
  window.__ltvOpenPt = open;

  const start = () => {
    // Nếu stage.js đang định vị vị trí trang đích ngầm phía sau màn phủ, để stage.js chủ động hạ màn sau khi định vị xong
    if (window.__ltvPtManaged) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(open, 90);
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  setTimeout(open, 2500);                                  // an toàn: không để màn phủ kẹt lại
})();
