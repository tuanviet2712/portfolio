/* ==========================================================================
   GÓC KIẾN THỨC — hành vi riêng của các trang /goc-kien-thuc/
   - Mục lục (hộp gập trong bài, bảng trượt): tô sáng mục đang đọc (vị trí tiêu đề đo một lần, đo lại khi bố cục đổi)
   - Thanh kết nối cố định ở đáy màn hình điện thoại + bảng mục lục trượt lên
   - Chia sẻ: sao chép liên kết (hoặc bảng chia sẻ của điện thoại)
   Nav, thanh tiến trình, nút về đầu trang, hiệu ứng chung: js/core.min.js + js/fx.js + js/kb-nav.js
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const L = window.LTV || {};
  const OFFSET = 132;                                  // chiều cao nav + khoảng thở khi xác định mục đang đọc

  /* ---------- 1. Mục lục theo vị trí đọc ---------- */
  const heads = $$('.kb-prose h2[id], .kb-prose h3[id]').filter(h => !h.classList.contains('kb-faq__q'));
  const links = $$('.kb-toc__list a[href^="#"]');
  if (heads.length && links.length) {
    const byId = new Map();
    links.forEach(a => {
      const id = decodeURIComponent(a.hash.slice(1));
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(a);
    });
    const parentOf = new Map();                        // h3 → h2 chứa nó
    let lastH2 = null;
    heads.forEach(h => { if (h.tagName === 'H2') lastH2 = h; else if (lastH2) parentOf.set(h, lastH2); });

    let tops = [];
    const measure = () => { tops = heads.map(h => h.getBoundingClientRect().top + window.scrollY); };
    let current = null;
    const update = () => {
      const y = window.scrollY + OFFSET;
      let i = -1;
      for (let k = 0; k < tops.length; k++) { if (tops[k] <= y) i = k; else break; }
      const h = i >= 0 ? heads[i] : null;
      if (h === current) return;
      current = h;
      links.forEach(a => a.classList.remove('is-active', 'is-parent'));
      if (!h) return;
      (byId.get(h.id) || []).forEach(a => a.classList.add('is-active'));
      const p = parentOf.get(h);
      if (p) (byId.get(p.id) || []).forEach(a => a.classList.add('is-parent'));
    };
    measure();
    let raf = 0;
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
    const remeasure = () => { measure(); update(); };
    addEventListener('resize', remeasure);
    addEventListener('load', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => remeasure()); const prose = $('.kb-prose'); if (prose) ro.observe(prose); }
    update();
  }

  /* ---------- 2. Thanh kết nối cố định (điện thoại, máy tính bảng) ---------- */
  const bar = $('.kb-bar');
  const head = $('.kb-art__head');
  if (bar && head && 'IntersectionObserver' in window) {
    let past = false;
    const ends = new Set();
    const sync = () => {
      const on = past && ends.size === 0;
      bar.classList.toggle('is-on', on);
      bar.inert = !on;
      bar.setAttribute('aria-hidden', String(!on));
      document.body.classList.toggle('has-bar', on);
    };
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(head);
    const io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? ends.add(e.target) : ends.delete(e.target))); sync(); });
    $$('.kb-offer, .footer').forEach(el => io.observe(el));    // khối dịch vụ cuối bài đã có nút liên hệ riêng
  }

  /* ---------- 2b. Ô liên hệ cột phải: dính theo cuộn suốt bài ở mọi chiều cao màn hình ----------
     Màn hình đủ cao: dính ở mép trên (dưới thanh menu). Màn hình thấp hơn thẻ: vị trí dính được đẩy lên
     (top âm) để thẻ dính theo mép dưới, nút "Nhận tư vấn" cuối thẻ luôn nằm trong tầm nhìn. */
  const sideCard = $('.kb-side__cta');
  if (sideCard) {
    const place = () => {
      const room = innerHeight - sideCard.offsetHeight - 16;
      sideCard.style.setProperty('--side-top', Math.min(96, room) + 'px');        // thanh menu đang hiện
      sideCard.style.setProperty('--side-top-h', Math.min(28, room) + 'px');      // thanh menu đã ẩn
    };
    place();
    addEventListener('resize', place);
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(sideCard);
  }

  /* ---------- 3. Bảng mục lục trượt từ dưới lên ---------- */
  const sheet = $('#kb-sheet');
  if (sheet) {
    const openSheet = () => {
      if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
      doc().style.overflow = 'hidden';
      const act = sheet.querySelector('.is-active');
      if (act) act.scrollIntoView({ block: 'center' });
    };
    const closeSheet = () => {
      doc().style.overflow = '';                         // trả lại cuộn ngay, trước khi trình duyệt nhảy tới mục
      if (sheet.open) { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); }
    };
    sheet.addEventListener('close', () => { doc().style.overflow = ''; });
    $$('[data-sheet-open]').forEach(b => b.addEventListener('click', openSheet));
    $$('[data-sheet-close]', sheet).forEach(b => b.addEventListener('click', closeSheet));
    sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });     // bấm ra ngoài
    $$('a', sheet).forEach(a => a.addEventListener('click', closeSheet));               // đóng trước khi trình duyệt cuộn tới mục
  }
  function doc() { return document.documentElement; }

  /* ---------- 4. Chia sẻ: sao chép liên kết ---------- */
  const toast = msg => (L.toast ? L.toast(msg) : null);
  const copy = text => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  };
  const coarse = matchMedia('(pointer: coarse)').matches;
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-share-copy]');
    if (!b) return;
    const url = b.dataset.shareCopy;
    if (coarse && navigator.share) {                   // điện thoại: bảng chia sẻ của hệ điều hành
      navigator.share({ title: document.title, url }).catch(() => {});
      return;
    }
    copy(url).then(() => toast('Đã sao chép liên kết bài viết'), () => toast(url));
  });

  /* ---------- 5. Điện thoại: tiêu đề không để một chữ lẻ ở dòng cuối ----------
     CSS đã bỏ "balance" cho tiêu đề (trước đây câu bị chẻ đôi dù dòng đầu còn chỗ). Nếu dòng cuối của một tiêu đề chỉ còn
     một chữ ngắn thì nối hai chữ cuối bằng khoảng trắng không ngắt, chỉ nhận khi không làm tăng số dòng.
     Cỡ chữ tiêu đề do CSS đặt đồng bộ cho mọi tiêu đề cùng cấp, không hạ riêng từng tiêu đề.
     Chỉ chạy trên màn ≤760px; rộng hơn thì trả tiêu đề về nguyên trạng. */
  (function fitHeadings() {
    const mq = window.matchMedia('(max-width: 760px)');
    const els = $$('.kb-art__h1, .kb-prose h2, .kb-prose h3').filter(h => !h.classList.contains('kb-faq__q'));
    if (!els.length) return;
    const rectsOf = el => { const r = document.createRange(); r.selectNodeContents(el); return Array.from(r.getClientRects()).filter(q => q.width > 1); };
    const lineCount = el => new Set(rectsOf(el).map(q => Math.round(q.top))).size;
    const lastLineWidth = el => {
      const rs = rectsOf(el); const top = Math.max(...rs.map(q => Math.round(q.top)));
      const line = rs.filter(q => Math.round(q.top) === top);
      return Math.max(...line.map(q => q.right)) - Math.min(...line.map(q => q.left));
    };
    const lastTextNode = el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, last = null; while ((n = w.nextNode())) if (n.nodeValue.trim()) last = n; return last; };
    const orig = new Map();
    const restore = el => { const o = orig.get(el); if (o) { o.node.nodeValue = o.text; orig.delete(el); } };
    const run = () => {
      els.forEach(restore);
      if (!mq.matches) return;
      els.forEach(el => {
        const n = lineCount(el); if (n < 2) return;
        if (lastLineWidth(el) >= el.getBoundingClientRect().width * 0.25) return;
        const node = lastTextNode(el); if (!node) return;
        const text = node.nodeValue; const p = text.trimEnd().lastIndexOf(' ');
        if (p < 1 || text.trim().split(/\s+/).length < 3) return;
        orig.set(el, { node, text });
        node.nodeValue = text.slice(0, p) + ' ' + text.slice(p + 1);
        if (lineCount(el) > n) restore(el);
      });
    };
    let t;
    const later = () => { clearTimeout(t); t = setTimeout(run, 120); };
    window.addEventListener('resize', later, { passive: true });
    window.addEventListener('orientationchange', later);
    if (mq.addEventListener) mq.addEventListener('change', run);
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run);
  })();

  /* ---------- 6. Bài viết có liên quan: carousel trôi liên tục chậm rãi, kéo để lướt ---------- */
  (function initRelatedCarousel() {
    const vp = $('[data-more-viewport]');
    const track = $('[data-more-track]');
    if (!vp || !track) return;
    const items = Array.from(track.children);
    if (!items.length) return;

    // Nhân bản danh sách 1 lần (ẩn với trình đọc màn hình / tab) để tạo vòng lặp vô tận mượt mà
    items.forEach(el => {
      const c = el.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      $$('a', c).forEach(a => { a.tabIndex = -1; });
      track.appendChild(c);
    });

    const SPEED = 22; // px/giây — tự chạy chậm rãi kiểu casual
    let w = track.scrollWidth / 2, x = 0, v = 0, cur = SPEED, hover = false, drag = null, moved = false, vis = false, inView = false;
    const setW = () => { w = track.scrollWidth / 2; };
    if (L.onResize) L.onResize(setW);
    else addEventListener('resize', setW, { passive: true });
    setW();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(vp);
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.3 }).observe(vp);
    } else {
      vis = true;
    }

    vp.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    vp.addEventListener('pointerleave', () => { hover = false; });
    vp.addEventListener('dragstart', e => e.preventDefault());

    vp.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { startX: e.clientX, x: e.clientX, t: performance.now(), id: e.pointerId };
      moved = false;
      v = 0;
    });
    vp.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(e.clientX - drag.startX) > 6) {
        moved = true;
        vp.classList.add('is-drag');
        try { vp.setPointerCapture(drag.id); } catch (_) {}
      }
      if (!moved) return;
      const now = performance.now();
      x += dx;
      v = dx / Math.max(8, now - drag.t) * 1000;
      drag.x = e.clientX;
      drag.t = now;
    });
    const release = () => {
      if (!drag) return;
      drag = null;
      vp.classList.remove('is-drag');
      if (moved) setTimeout(() => { moved = false; }, 60);
    };
    vp.addEventListener('pointerup', release);
    vp.addEventListener('pointercancel', release);
    vp.addEventListener('click', e => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    const stepW = () => { const c = $('.kb-post--slide', track); return c ? c.offsetWidth + 18 : 296; };
    let kick = 0;
    const go = dir => { kick -= dir * stepW(); };
    $$('[data-more-nav]').forEach(b => b.addEventListener('click', () => go(+b.dataset.moreNav)));

    const step = s => {
      if (!vis || !w) return;
      const dt = s.dt || 0.016;
      const target = hover || drag || L.reduced ? 0 : SPEED;
      cur += (target - cur) * (1 - Math.exp(-dt * 5));
      if (!drag || !moved) {
        x += (-cur + v) * dt;
        v *= Math.exp(-dt * 3);
        if (kick) { const k = kick * Math.min(1, dt * 6); x += k; kick -= k; }
      }
      x %= w;
      if (x > 0) x -= w;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    };
    if (L.tick) L.tick(step);

    addEventListener('keydown', e => {
      if (!inView || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    });
  })();

  /* ---------- 7. Cột phải: số bài từng chuyên mục và "Kiến thức mới" theo hiện tại ----------
     build-kb.cjs dựng cột phải ĐÓNG BĂNG tại lúc đăng bài (đăng bài mới không phải dựng lại trang cũ). Ở đây đọc
     goc-kien-thuc/recent.json rồi cập nhật hai khối đó bằng đúng thẻ, đúng lớp như bản dựng, không đổi giao diện:
     - số bài: chỉ đổi chữ số trong cùng một dòng;
     - "Kiến thức mới": dựng danh sách mới ẩn bên cạnh để đo, chỉ thay khi cao ĐÚNG BẰNG danh sách cũ (không xô lệch
       cột phải; lệch thì giữ bản đóng băng) và sau khi ảnh mới đã tải (không chớp ô ảnh trống).
     Chỉ chạy khi cột phải đang hiện (từ 1280px); màn nhỏ hơn không tải gì, phóng to cửa sổ thì chạy lúc đó. */
  (function freshSide() {
    const side = $('.kb-side[data-kb-recent]');
    const aside = side && side.closest('.kb-art__aside');
    if (!side || !aside || !window.fetch) return;
    const src = side.dataset.kbRecent;
    const rel = src.replace(/goc-kien-thuc\/recent\.json$/, '');
    let started = false, t = 0;
    const start = () => {
      if (started || !aside.getClientRects().length) return;
      started = true;
      removeEventListener('resize', later);
      fetch(src, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(apply)
        .catch(() => {});                                // lỗi mạng: giữ nguyên cột phải đóng băng
    };
    const later = () => { clearTimeout(t); t = setTimeout(start, 200); };
    addEventListener('resize', later, { passive: true });
    start();

    const vnDate = d => { const [y, m, dd] = String(d).split('-'); return `${dd}/${m}/${y}`; };
    const tag = (name, attrs) => { const n = document.createElement(name); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); return n; };
    // Cùng cấu trúc với một dòng "Kiến thức mới" của build-kb.cjs (articleSide)
    const item = p => {
      const li = tag('li');
      const a = tag('a', { class: 'kb-side__post', href: rel + p.u });
      if (p.img) {
        const fig = tag('span', { class: 'kb-side__img' });
        fig.appendChild(tag('img', { src: /^https?:/.test(p.img) ? p.img : rel + p.img, alt: '', width: '320', height: '168', loading: 'lazy', decoding: 'async' }));
        a.appendChild(fig);
      }
      const txt = tag('span', { class: 'kb-side__txt' });
      const b = tag('b', { title: p.t });
      (p.l && p.l.length ? p.l : [p.t]).forEach((line, i) => { if (i) b.appendChild(document.createTextNode(' ')); const s = tag('span'); s.textContent = line; b.appendChild(s); });
      const small = tag('small');
      const time = tag('time', { datetime: p.d });
      time.textContent = vnDate(p.d);
      small.appendChild(time);
      txt.append(b, small);
      a.appendChild(txt);
      li.appendChild(a);
      return li;
    };

    function apply(j) {
      // 1. Số bài từng chuyên mục (liên kết tới trang chủ đề)
      const n = j && j.n ? j.n : {};
      $$('.kb-side__cat', side).forEach(a => {
        const m = /goc-kien-thuc\/([a-z0-9-]+)\/$/.exec(a.getAttribute('href') || '');
        if (!m || !(m[1] in n)) return;
        let s = $('.kb-side__n', a);
        if (n[m[1]]) {
          if (!s) { s = tag('span', { class: 'kb-side__n' }); a.appendChild(s); }
          if (s.textContent !== String(n[m[1]])) s.textContent = n[m[1]];
        } else if (s) s.remove();
      });

      // 2. Kiến thức mới
      const ul = $('.kb-side__posts', side);
      if (!ul || !j || !Array.isArray(j.posts)) return;
      const self = side.dataset.kbSelf || '';
      const items = j.posts.filter(p => p && p.u && p.u !== self).slice(0, 5).map(item);
      if (!items.length) return;
      const now = Array.from(ul.children);
      if (items.length === now.length && items.every((li, i) => li.outerHTML === now[i].outerHTML)) return;   // đã đúng
      const probe = ul.cloneNode(false);
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;margin:0;left:-9999px;top:0;width:${ul.getBoundingClientRect().width}px`;
      items.forEach(li => probe.appendChild(li.cloneNode(true)));
      ul.parentNode.appendChild(probe);
      const same = Math.abs(probe.getBoundingClientRect().height - ul.getBoundingClientRect().height) < 0.5;
      probe.remove();
      if (!same) return;
      const imgs = items.map(li => li.querySelector('img')).filter(Boolean).map(img => new Promise(done => {
        const im = new Image();
        im.onload = im.onerror = () => done();
        im.src = img.src;
      }));
      Promise.race([Promise.all(imgs), new Promise(done => setTimeout(done, 3000))])
        .then(() => requestAnimationFrame(() => ul.replaceChildren(...items)));
    }
  })();
})();
