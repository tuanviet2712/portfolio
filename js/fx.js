/* ==========================================================================
   FX — tính năng động dùng chung
   - Tiêu đề 1 dòng (fit-text)      - Chữ trồi lên theo từ (data-split)
   - Ánh sáng theo chuột trên thẻ (.spot)
   - Gợn sóng khi bấm nút             - Nút về đầu trang có vòng tiến trình
   - Chuyển trang có màn trượt        - Đồng hồ Hà Nội trực tiếp (data-clock)
   - Parallax (data-speed)            - Ảnh lộ dần (.reveal-img)
   - "Xem thêm" cho mô tả dài (.desc[data-more])
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const { $, $$, clamp } = L;

  /* ---------------- Tiêu đề luôn 1 dòng ---------------- */
  function fitOne(el) {
    if (!el.isConnected) return;
    el.style.fontSize = '';
    const w = el.clientWidth;
    if (!w) return;                       // đang ẩn: sẽ fit lại khi hiện
    const need = el.scrollWidth;
    if (need <= w + 1) return;
    const cur = parseFloat(getComputedStyle(el).fontSize);
    const min = parseFloat(el.dataset.fitMin || 13);
    el.style.fontSize = Math.max(min, Math.floor(cur * (w / need) * 0.98 * 10) / 10) + 'px';
  }
  L.fit = (root = document) => $$('[data-fit]', root).forEach(fitOne);


  /* ---------------- Chữ trồi lên theo từng từ ---------------- */
  function splitWords(el) {
    if (el.dataset.splitDone || L.reduced) return;
    el.dataset.splitDone = '1';
    el.classList.add('split');
    let wi = 0;
    const walk = (node, grad) => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'w__in' + (grad ? ' grad' : '');
            inner.style.setProperty('--wi', wi++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) {
          const isGrad = ch.classList.contains('grad');
          if (isGrad) ch.classList.remove('grad');
          walk(ch, grad || isGrad);
        }
      });
    };
    walk(el, false);
  }

  /* ---------------- Chữ lớn cuối trang trồi lên ----------------
     Nằm sát đáy trang nên bộ quan sát chung (bỏ 10% dưới màn hình) có thể không bao giờ bắt được trên mobile */
  function initFooterMark() {
    $$('.footer__mark [data-split]').forEach(el => {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        el.classList.add('is-in');
        io.disconnect();
      }, { threshold: 0.3 });
      io.observe(el);
    });
  }

  /* ---------------- Ánh sáng theo chuột ---------------- */
  function addGlow(root = document) {
    $$('.spot', root).forEach(el => {
      if (el.querySelector(':scope > .glow')) return;
      const g = document.createElement('span');
      g.className = 'glow';
      g.setAttribute('aria-hidden', 'true');
      el.prepend(g);
    });
  }
  function initSpot() {
    if (!L.fine) return;
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.spot');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }, { passive: true });
  }

  /* ---------------- Gợn sóng khi bấm ---------------- */
  function initRipple() {
    document.addEventListener('pointerdown', e => {
      if (L.reduced) return;
      const b = e.target.closest && e.target.closest('.btn, .round, .tab');
      if (!b) return;
      const r = b.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.4;
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s);
      setTimeout(() => s.remove(), 800);
    });
  }

  /* ---------------- Nút về đầu trang (vòng tiến trình) ---------------- */
  function initTotop() {
    const b = $('.totop');
    if (!b) return;
    const bar = $('.totop__bar', b);
    const C = 2 * Math.PI * 21;
    bar.style.strokeDasharray = C.toFixed(1);
    bar.style.strokeDashoffset = C.toFixed(1);
    let docH = 1, showAt = 600;
    const hero = $('#trang-chu');
    const measure = () => {
      docH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      showAt = hero ? hero.offsetHeight - innerHeight * 0.6 : innerHeight * 0.8;
    };
    measure();
    L.onLayout(measure);
    let last = -1, on = false;
    L.tick(s => {
      const p = clamp(s.y / docH);
      if (Math.abs(p - last) > 0.001) { last = p; bar.style.strokeDashoffset = (C * (1 - p)).toFixed(1); }
      const show = s.y > showAt;
      if (show !== on) { on = show; b.classList.toggle('is-on', show); }
    });
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: L.reduced ? 'auto' : 'smooth' }));
  }

  /* ---------------- Chuyển trang có màn trượt ---------------- */
  function initPageTransition() {
    const pt = $('.pt');
    if (!pt) return;
    if (pt.classList.contains('is-cover')) {
      requestAnimationFrame(() => requestAnimationFrame(() => pt.classList.add('is-out')));
    }
    addEventListener('pageshow', e => { if (e.persisted) pt.classList.remove('is-leave'); });
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (!/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      try { sessionStorage.setItem('ltv-pt', '1'); } catch (_) { /* bỏ qua */ }
      pt.classList.remove('is-cover', 'is-out');
      pt.classList.add('is-leave');
      setTimeout(() => { location.href = a.href; }, L.reduced ? 0 : 640);
    });
  }

  /* ---------------- Đồng hồ Hà Nội ---------------- */
  function initClock() {
    const els = $$('[data-clock]');
    if (!els.length) return;
    let fmt;
    try { fmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch (_) { fmt = { format: d => d.toTimeString().slice(0, 5) }; }
    const upd = () => { const t = fmt.format(new Date()); els.forEach(el => { if (el.textContent !== t) el.textContent = t; }); };
    upd();
    setInterval(upd, 10000);
  }

  /* ---------------- Parallax ---------------- */
  function initParallax() {
    if (L.reduced) return;
    const items = $$('[data-speed]').map(el => ({ el, sp: parseFloat(el.dataset.speed) || 0, last: 1e9, top: 0, h: 0 }));
    if (!items.length) return;
    // vị trí được đo sẵn => vòng lặp cuộn không đọc layout
    const measure = () => items.forEach(it => { const p = it.el.parentElement; it.top = L.docTop(p); it.h = p.offsetHeight; });
    measure();
    L.onLayout(measure);
    L.tick(s => {
      for (const it of items) {
        const top = it.top - s.y;
        if (top + it.h < -200 || top > s.vh + 200) continue;
        const y = ((top + it.h / 2) - s.vh / 2) * it.sp;
        if (Math.abs(y - it.last) < 0.3) continue;
        it.last = y;
        it.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }
    });
  }

  /* ---------------- Video nền tự chạy (ô chân dung) ----------------
     Chạy liên tục khi đang nhìn thấy; ra khỏi màn hình hoặc chuyển tab thì tạm dừng cho đỡ tốn pin.
     Máy bật "giảm chuyển động" => đứng yên ở khung đầu (ảnh poster). */
  function initVideos() {
    $$('video[autoplay]').forEach(v => {
      v.muted = true;                                  // bắt buộc để trình duyệt cho tự chạy
      if (L.reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
      const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
      // tải ngầm sau khi trang tải xong, lúc máy rảnh => cuộn tới là chạy ngay, không khựng khung hình
      const warm = () => { v.preload = 'auto'; v.load(); };
      const idle = () => (window.requestIdleCallback || setTimeout)(warm, { timeout: 2500 });
      document.readyState === 'complete' ? idle() : addEventListener('load', idle, { once: true });
      let seen = false;
      new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        if (seen && !document.hidden) play(); else v.pause();
      }, { threshold: 0.01 }).observe(v);
      document.addEventListener('visibilitychange', () => { if (document.hidden) v.pause(); else if (seen) play(); });
    });
  }

  /* ---------------- "Xem thêm" cho mô tả dài ---------------- */
  L.more = (root = document) => {
    $$('.desc[data-more]', root).forEach(p => {
      if (p.dataset.moreDone) return;
      p.dataset.moreDone = '1';
      requestAnimationFrame(() => {
        if (p.scrollHeight <= p.clientHeight + 2) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'more-btn';
        b.textContent = 'Xem thêm';
        b.addEventListener('click', () => {
          const open = p.classList.toggle('is-open');
          b.textContent = open ? 'Thu gọn' : 'Xem thêm';
        });
        p.after(b);
      });
    });
  };

  /* ---------------- Quan sát khi cuộn tới ---------------- */
  // Ảnh .reveal-img bị clip-path che hoàn toàn lúc đầu => Chrome coi là "không giao" => quan sát phần tử cha
  const proxy = new WeakMap();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const kids = proxy.get(el);
      if (kids) { kids.forEach(k => k.classList.add('is-in')); proxy.delete(el); io.unobserve(el); return; }
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

  /* Áp toàn bộ hiệu ứng cho một vùng DOM (dùng lại sau khi render động) */
  L.enhance = (root = document) => {
    $$('[data-split]', root).forEach(splitWords);
    addGlow(root);
    L.fit(root);
    L.more(root);
    $$('[data-split], .sec-head', root).forEach(el => { if (!el.classList.contains('is-in')) io.observe(el); });
    $$('.reveal-img', root).forEach(el => {
      if (el.classList.contains('is-in') || !el.parentElement) return;
      const host = el.parentElement;
      if (!proxy.has(host)) { proxy.set(host, []); io.observe(host); }
      proxy.get(host).push(el);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (L.params.has('nofx')) { L.fit(); return; }   // ?nofx : tắt hiệu ứng (dùng khi đo hiệu năng)
    L.enhance(document);
    initFooterMark();
    initSpot();
    initRipple();
    initTotop();
    initPageTransition();
    initClock();
    initParallax();
    initVideos();
    let rq = 0;
    L.onResize(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => L.fit()); });
    // Đo lại sau khi font thật về: 'Be Vietnam Pro' nạp từng nét một, fonts.ready có thể xong
    // trước khi nét cuối được yêu cầu, nên phải nghe thêm loadingdone, nếu không chữ giữ nguyên
    // cỡ đã co theo font dự phòng (rộng hơn font thật).
    if (document.fonts) {
      const refit = () => L.fit();
      if (document.fonts.ready) document.fonts.ready.then(refit);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refit);
    }
    addEventListener('load', () => L.fit());
  });
})();
