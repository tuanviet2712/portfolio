/* ==========================================================================
   GÓC KIẾN THỨC — trải nghiệm cuộn (thiết kế trang giữ nguyên)
   - Trang tổng / chủ đề: phần đầu trang trôi chậm + mờ dần khi cuộn qua, thẻ chủ đề và thẻ bài viết
     nhô lên từ chiều sâu theo cuộn (lệch nhịp theo cột)
   - Trang bài viết: chỉ cuộn mượt (Lenis trong js/stage.js) + hình minh hoạ hiện ra nhẹ khi tới
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const S = L && L.stage;
  if (!S || S.off) return;
  const { $, $$, clamp } = L;
  const { r, ease } = S;
  const setVar = (el, k, v) => { const s = v.toFixed(4); if (el['_' + k] !== s) { el['_' + k] = s; el.style.setProperty(k, s); } };

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('kbs');
    const top = $('.kb-top');
    if (top) {
      const inner = top.firstElementChild;
      if (inner) S.track(top, q => setVar(inner, '--tq', clamp((q - 0.5) * 2)));
    }
    // thẻ trong cùng một lưới lệch nhịp theo cột
    $$('.kb-cats, .kb-grid, .kb-feature, .kb-list').forEach(grid => {
      $$(':scope > *', grid).forEach((card, i) => {
        card.classList.add('kbs-c');
        card.style.setProperty('--k', i % 3);
        S.track(card, q => { const e = ease.out(r(q, 0.0, 0.3 + (i % 3) * 0.03)); setVar(card, '--e', e); card.classList.toggle('is-done', e >= 1); });
      });
    });
    $$('.kb-prose .kb-fig').forEach(fig => {
      fig.classList.add('kbs-f');
      S.track(fig, q => { const e = ease.out(r(q, 0.0, 0.28)); setVar(fig, '--e', e); fig.classList.toggle('is-done', e >= 1); });
    });
  });
})();
