/* ==========================================================================
   MÀN "XIN CHÀO" — nét chữ là ảnh động WebP thay cho hoạt ảnh SVG
   Hoạt ảnh stroke-dashoffset của SVG chạy trên luồng chính, nên lúc trang khởi tạo (cảnh 3D, căn chữ, i18n…)
   nét chữ phải chờ rồi giật cục. Ảnh động thì compositor của trình duyệt tự chạy. Ảnh được dựng từ chính SVG đó
   (cùng nét, thời gian, easing) bằng tools/hello-anim/build.cjs. Chạy đồng bộ ngay sau #preloader để kịp trước core.js.
   Ảnh chỉ được chèn sau tác vụ DOMContentLoaded (các scene khởi tạo, ~1 s liền trên máy bàn): trong tác vụ đó trình duyệt
   không đưa khung hình mới ra màn hình, còn nhịp ảnh động vẫn chạy => chữ hiện ra đã viết dở. Chèn sau đó thì nhịp và
   hình khớp nhau, chữ luôn viết từ nét đầu, và trên máy nhanh thì bắt đầu sớm hơn.
   Bị tắt / ảnh lỗi => không làm gì, core.js viết bằng SVG như cũ.
   ========================================================================== */
(function () {
  'use strict';

  // [ảnh, thời lượng ms = data-duration của SVG tương ứng]; LEAD = khoảng trống đầu ảnh (LEAD trong tools/hello-anim/build.cjs)
  const ANIM = { vi: ['assets/hello/xin-chao.webp', 2167], en: ['assets/hello/hello-en.webp', 1833] };
  const LEAD = 100;

  const pre = document.getElementById('preloader');
  const q = new URLSearchParams(location.search);
  let greeted = false;
  try { greeted = sessionStorage.getItem('ltv-hello') === '1'; } catch (_) { /* bỏ qua */ }
  if (!pre || window.LTV_HELLO_ANIM === false || q.has('skip') || q.has('nomotion') || window.__ltvLangSwitch ||
      document.documentElement.classList.contains('is-pt-in') || (greeted && !q.has('hello')) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!pre.querySelector('svg.hello')) return;
  const [src, dur] = ANIM[q.get('lang') === 'en' ? 'en' : 'vi'];

  // Ẩn svg bằng lớp để cả svg "Hello" mà i18n.js thay vào cũng ẩn theo; ảnh giữ đúng khung của svg (meet = contain)
  const css = document.createElement('style');
  css.textContent = '#preloader.is-anim svg.hello{display:none!important}#preloader .hello--img{object-fit:contain}';
  document.head.appendChild(css);
  pre.classList.add('is-anim');

  // Tải ngay (bản VI đã preload trong <head>), chỉ chèn vào trang khi tới lúc viết
  const img = new Image();
  img.className = 'hello hello--ldt hello--img';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.fetchPriority = 'high';
  img.decoding = 'sync'; // giải mã ngay trong lần vẽ đầu, không chờ thêm một lượt vẽ
  img.src = src;

  // core.js hỏi: wait(xong, lỗi). Lỗi => core.js viết bằng SVG.
  const ctrl = window.LTV_HELLO_ANIM = {
    done: false, failed: false, cbs: [],
    wait(ok, fail) { if (this.done) ok(); else if (this.failed) fail(); else this.cbs.push([ok, fail]); }
  };
  const settle = ok => {
    if (ctrl.done || ctrl.failed) return;
    ctrl[ok ? 'done' : 'failed'] = true;
    if (!ok) { img.remove(); pre.classList.remove('is-anim'); }
    ctrl.cbs.forEach(c => c[ok ? 0 : 1]());
  };

  // Nhịp ảnh chạy từ lần đầu ảnh (đã tải) vào khung hình: sau khi chèn và sau khi tải xong. +100 ms dự phòng;
  // core.js còn chờ thêm 280 ms trước khi kéo màn, nên nét cuối luôn kịp xong.
  let insertedAt = 0, loadedAt = 0, timer = 0;
  const schedule = () => {
    if (!insertedAt || !loadedAt) return;
    clearTimeout(timer);
    timer = setTimeout(() => settle(true), Math.max(0, Math.max(insertedAt, loadedAt) + LEAD + dur + 100 - performance.now()));
  };
  img.onload = () => { loadedAt = performance.now(); schedule(); };
  img.onerror = () => settle(false);

  const insert = () => {
    if (insertedAt || ctrl.failed) return;
    const svg = pre.querySelector('svg.hello');
    if (!svg || !pre.isConnected) return settle(false);
    insertedAt = performance.now();
    svg.after(img);
    if (img.complete && img.naturalWidth) { loadedAt = loadedAt || insertedAt; schedule(); }
  };
  // Sau toàn bộ tác vụ DOMContentLoaded (hello.js đăng ký trước mọi scene nên setTimeout này chạy sau chúng)
  document.addEventListener('DOMContentLoaded', () => setTimeout(insert, 0), { once: true });
  // Mạng chậm: HTML còn đang tải (luồng chính rảnh) thì viết luôn, khỏi chờ
  setTimeout(() => { if (document.readyState === 'loading') insert(); }, 1200);
  setTimeout(insert, 4000);
  setTimeout(() => { if (!timer) settle(false); }, 7000); // ảnh không về kịp => viết bằng SVG
})();
