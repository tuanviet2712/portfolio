/* ==========================================================================
   GÓC KIẾN THỨC — mục "Góc kiến thức" trên thanh điều hướng
   1. Chữ tiếng Anh: phần tử có data-en / data-en-label đổi chữ khi trang ở ?lang=en
      (js/i18n.js đặt html[data-lang] trước; file này chạy trước fx.js tách chữ).
   2. Menu thả xuống trên máy tính: rê chuột để xem nhanh, bấm mũi tên để giữ mở, bấm chữ để vào trang tổng; bàn phím đầy đủ.
   3. Menu di động: bấm "Góc kiến thức" để mở danh sách 4 chủ đề.
   Dùng ở trang chủ và các trang /goc-kien-thuc/.
   ========================================================================== */
(function () {
  'use strict';
  const doc = document.documentElement;

  /* 1. Tiếng Anh */
  if (doc.dataset.lang === 'en') {
    document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset.en; });
    document.querySelectorAll('[data-en-label]').forEach(el => el.setAttribute('aria-label', el.dataset.enLabel));
  }

  /* 2. Menu thả xuống (máy tính) */
  const trig = document.querySelector('.nav__kb');
  const panel = document.getElementById('kb-dd');
  if (trig && panel) {
    const host = trig.parentElement;                 // .nav__links (position: relative)
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let open = false, pinned = false, tIn = 0, tOut = 0, y0 = 0;

    const bar = trig.closest('.nav__inner');
    const place = () => {
      const hr = host.getBoundingClientRect();
      const tr = trig.getBoundingClientRect();
      const w = panel.offsetWidth;
      const vw = doc.clientWidth;
      const br = bar ? bar.getBoundingClientRect() : { left: 12, right: vw - 12 };
      const cx = tr.left + tr.width / 2;
      // nằm dưới nút, không vượt mép thanh điều hướng (và mép màn hình)
      const lo = Math.max(12, br.left), hi = Math.min(vw - 12, br.right) - w;
      const left = Math.max(lo, Math.min(hi, cx - w / 2));
      panel.style.setProperty('--kbdd-x', (left - hr.left).toFixed(1) + 'px');
      panel.style.setProperty('--kbdd-caret', Math.max(28, Math.min(w - 28, cx - left)).toFixed(1) + 'px');
    };
    const set = (v, how) => {
      clearTimeout(tIn); clearTimeout(tOut);
      if (v === open) { if (v && how !== 'hover') pinned = true; return; }
      open = v;
      pinned = v && how !== 'hover';
      if (v) { place(); y0 = window.scrollY; }
      panel.classList.toggle('is-open', v);
      trig.classList.toggle('is-open', v);
      trig.setAttribute('aria-expanded', String(v));
    };

    trig.addEventListener('click', e => {
      /* Chuột: bấm vào chữ "Góc kiến thức" mở trang tổng (href thật); chỉ mũi tên nhỏ bên cạnh mới bật/tắt menu.
         Màn cảm ứng không rê chuột được nên bấm vẫn mở menu, trang tổng nằm ở nút "Xem tất cả bài viết". */
      if (fine && !e.target.closest('.nav__chev')) { set(false); return; }
      e.preventDefault();
      if (!open) set(true, 'click');
      else if (!pinned) pinned = true;               // đã mở bằng rê chuột: bấm để giữ mở
      else set(false);
    });
    trig.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowDown') {
        e.preventDefault();
        set(true, 'key');
        const first = panel.querySelector('a');
        if (first) first.focus();
      }
    });
    if (fine) {
      const enter = () => { clearTimeout(tOut); if (!open) tIn = setTimeout(() => set(true, 'hover'), 110); };
      const leave = () => { clearTimeout(tIn); if (open && !pinned) tOut = setTimeout(() => set(false), 260); };
      trig.addEventListener('pointerenter', enter);
      trig.addEventListener('pointerleave', leave);
      panel.addEventListener('pointerenter', () => clearTimeout(tOut));
      panel.addEventListener('pointerleave', leave);
    }
    document.addEventListener('pointerdown', e => { if (open && !panel.contains(e.target) && !trig.contains(e.target)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { set(false); trig.focus(); } });
    panel.addEventListener('focusout', e => {
      const to = e.relatedTarget;
      if (open && to && !panel.contains(to) && to !== trig) set(false);
    });
    panel.addEventListener('keydown', e => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = Array.from(panel.querySelectorAll('a'));
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      let n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
      n = (n + items.length) % items.length;
      items[n].focus();
    });
    addEventListener('resize', () => { if (open) place(); });
    addEventListener('scroll', () => { if (open && Math.abs(window.scrollY - y0) > 140) set(false); }, { passive: true });
  }

  /* 3. Menu di động */
  document.querySelectorAll('.menu-kb__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(v));
      const box = btn.closest('.menu-kb');
      if (box) box.classList.toggle('is-open', v);
    });
  });
})();
