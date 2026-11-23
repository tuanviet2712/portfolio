/* ==========================================================================
   GÓC KIẾN THỨC — hành vi riêng của các trang /goc-kien-thuc/
   - Mục lục (hộp gập trong bài, bảng trượt): tô sáng mục đang đọc (vị trí tiêu đề đo một lần, đo lại khi bố cục đổi)
   - Thanh kết nối cố định ở đáy màn hình điện thoại + bảng mục lục trượt lên
   - Chia sẻ: sao chép liên kết (hoặc bảng chia sẻ của điện thoại)
   - Điện thoại: chữ căn đều hai bên mà không giãn khe (mục 8, tự ngắt dòng cả đoạn)
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

  /* ---------- 5. (đã bỏ 16/11/2026) ----------
     Trước đây nối hai chữ cuối của tiêu đề bằng khoảng trắng không ngắt khi dòng cuối chỉ còn một chữ, làm dòng trên
     xuống hàng khi chưa hết chỗ. Người dùng yêu cầu trên điện thoại mọi dòng phải dồn đầy rồi mới xuống: xem mục 8. */

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

  /* ---------- 8. Điện thoại: căn đều hai bên mà không giãn khe chữ ----------
     Trình duyệt ngắt dòng tham lam (dồn chữ tới hết dòng rồi mới xuống), dòng nào gặp chữ dài hay cụm liên kết ở cuối
     thì phần trống dồn hết vào khe giữa các chữ; ở cột chữ hẹp của điện thoại các khe đó mở rất rộng.
     Ở đây chọn chỗ xuống dòng cho cả đoạn một lúc (quy hoạch động kiểu Knuth–Plass, như js/m-justify.js của trang chủ)
     để phần trống chia đều cho các dòng, mỗi dòng được nhích khoảng cách chữ trong [-0,015em; +0,015em] trước khi giãn khe.
     Vẫn căn đều hai bên, không tách chữ, không gạch nối; đoạn đang hiện trên màn hình không bị thêm dòng
     (phần bên dưới không bị đẩy), đoạn khác chỉ thêm/bớt dòng khi khe chữ đỡ hẳn. Mỗi dòng là một <span class="kj-l">, nội dung gốc được giữ để dựng
     lại khi đổi khổ màn hình. Ô số liệu (.kb-case__m): nhãn nào phải xuống 2 dòng cạnh con số thì cả khối chuyển sang
     số ở trên, nhãn ở dưới (.kj-stack). Chữ không căn đều (tiêu đề, khối kêu gọi, ô bảng...) dồn đầy dòng rồi mới xuống:
     CSS bỏ balance/pretty, ở đây bỏ nối chữ &nbsp; (xem unbind). Chỉ chạy trên màn ≤760px, không chạy với bot tìm kiếm;
     thêm ?nokj vào địa chỉ để xem lại cách ngắt dòng của trình duyệt. Giao diện: css/kb-article.css (.kj, .kj-l, .kj-run, .kj-stack) */
  (function justifyLines() {
    const root = $('.kb-art__main');
    if (!root || !window.matchMedia || /bot|crawl|spider|slurp/i.test(navigator.userAgent || '')) return;
    if (/[?&]nokj\b/.test(location.search)) return;
    const mq = matchMedia('(max-width: 760px)');
    const SKIP = '.kb-cta, .kb-toc2, .kb-share, .kb-more, .kb-art__by, .kb-crumbs';
    const STRICT = { trMin: -0.015, trMax: 0.015, eMax: 0.55, eMin: -0.05 };
    const RELAX = { trMin: -0.015, trMax: 0.03, eMax: 4, eMin: -0.05 };
    const K_STRETCH = 0.25, K_SHRINK = 0.05, TR_REF = 0.02, W_TR = 30, W_TR_NEG = 70;
    const BIND_PEN = 600, LINK_PEN = 35, FEWER_PEN = 150, MORE_PEN = 400, SLICE_MS = 10;
    const trCost = (tr, fs) => (tr < 0 ? W_TR_NEG : W_TR) * (tr / fs / TR_REF) * (tr / fs / TR_REF);
    const isWs = c => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f' || c === '\u00A0';
    const done = new Set();
    let ctx = null, ctxFont = '', fonts = new Map(), widths = new Map(), gen = 0;

    // Thẻ có tiêu đề đậm xuống dòng rồi mới đến chữ (vd. <li><strong>Tiêu đề:</strong> nội dung</li> của .kb-list-cards):
    // gom phần chữ vào một <span class="kj-run"> (một khối, đúng như hộp vô danh trình duyệt vẫn tạo) để ngắt dòng riêng
    const HEAD_TAGS = /^(STRONG|B|EM|SMALL|SPAN)$/;
    const isBlock = n => n.nodeType === 1 && getComputedStyle(n).display !== 'inline';
    function wrapRuns(scope) {
      $$('li, p, dd, td', scope).forEach(el => {
        if (el.__kjRuns || el.closest(SKIP) || getComputedStyle(el).textAlign !== 'justify') return;
        const kids = [...el.childNodes];
        const blocks = kids.filter(isBlock);
        if (!blocks.length || !blocks.every(b => HEAD_TAGS.test(b.tagName) && !b.classList.contains('kj-run'))) return;
        el.__kjRuns = true;
        let run = [];
        const flush = () => {
          if (run.some(n => n.textContent.trim())) {
            const s = document.createElement('span');
            s.className = 'kj-run';
            run[0].before(s);
            s.append(...run);
          }
          run = [];
        };
        kids.forEach(n => { if (isBlock(n)) flush(); else run.push(n); });
        flush();
      });
    }

    // Khối căn đều chỉ chứa chữ và thẻ nội dòng (a, strong, em...): mới tự ngắt dòng được
    function targets(scope) {
      return $$('p, li, dd, td, div, span, figcaption, blockquote', scope).filter(el => {
        if (el.classList.contains('kj-l') || el.closest(SKIP)) return false;
        const cs = getComputedStyle(el);
        if (cs.textAlign !== 'justify' || cs.display.indexOf('inline') === 0 || cs.display === 'none' || cs.display === 'contents') return false;
        let text = false;
        for (const n of el.childNodes) {
          if (n.nodeType === 3) { if (n.nodeValue.trim()) text = true; continue; }
          if (n.nodeType !== 1) continue;
          if (getComputedStyle(n).display !== 'inline' || n.querySelector('img, svg, br, input, button, iframe, video, picture')) return false;
          for (const d of n.getElementsByTagName('*')) if (getComputedStyle(d).display !== 'inline') return false;
          if (n.textContent.trim()) text = true;
        }
        return text;
      });
    }

    function restore(el) {
      if (el.__kjOrig) { el.replaceChildren(...el.__kjOrig); el.__kjOrig = null; }
      el.classList.remove('kj');
    }

    // Phông của thẻ chứa chữ (đo bằng canvas, nhanh hơn đo từng chữ trên trang)
    function fontOf(node) {
      const p = node.parentElement;
      let f = fonts.get(p);
      if (f) return f;
      const cs = getComputedStyle(p);
      f = { font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, ls: parseFloat(cs.letterSpacing) || 0 };
      f.sw = textWidth(' ', f) + (parseFloat(cs.wordSpacing) || 0);
      fonts.set(p, f);
      return f;
    }
    function textWidth(t, f) {
      let wc = widths.get(f.font);
      if (!wc) widths.set(f.font, wc = new Map());
      let w = wc.get(t);
      if (w === undefined) {
        ctx = ctx || document.createElement('canvas').getContext('2d');
        if (ctxFont !== f.font) ctx.font = ctxFont = f.font;   // đặt phông cho canvas khá tốn: chỉ đặt khi đổi phông
        wc.set(t, w = ctx.measureText(t).width);
      }
      return w + t.length * f.ls;
    }

    // Tách khối thành các chữ (giữa hai khoảng trắng); một chữ có thể vắt qua nhiều thẻ, vd. "<a>Unilever</a>,"
    function tokenize(el) {
      const T = [];
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n, cur = null, sep = null;
      while ((n = tw.nextNode())) {
        const s = n.nodeValue;
        for (let i = 0; i < s.length; i++) {
          if (isWs(s[i])) {
            if (cur) { T.push(cur); cur = null; }
            if (!sep) sep = { node: n, endNode: n, endI: i + 1, nb: false };
            else { sep.endNode = n; sep.endI = i + 1; }
            if (s[i] === '\u00A0') sep.nb = true;
          } else {
            if (!cur) { cur = { pieces: [], sep: T.length ? sep : null }; sep = null; }
            const last = cur.pieces[cur.pieces.length - 1];
            if (last && last.n === n) last.e = i + 1; else cur.pieces.push({ n, s: i, e: i + 1 });
          }
        }
      }
      if (cur) T.push(cur);
      return T;
    }

    function measure(el) {
      if (!el.isConnected || !el.getClientRects().length) return null;
      const cs = getComputedStyle(el);
      const W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const H = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const lh = parseFloat(cs.lineHeight);
      if (W < 60 || !(H > 0)) return null;               // khối đang ẩn (vd. câu trả lời FAQ đang gập): dựng khi mở ra
      const T = tokenize(el);
      if (T.length < 4) return null;
      for (const t of T) {
        let w = 0, ch = 0;
        for (const p of t.pieces) { w += textWidth(p.n.nodeValue.slice(p.s, p.e), fontOf(p.n)); ch += p.e - p.s; }
        if (w > W) return null;                          // chữ dài hơn cả dòng (đường dẫn...): để trình duyệt tự xử lý
        t.w = w; t.ch = ch;
        t.sw = t.sep ? fontOf(t.sep.node).sw : 0;
        t.bind = !!(t.sep && t.sep.nb);
        const a = t.sep && t.sep.node.parentElement.closest('a');
        t.link = !!(a && el.contains(a) && a.contains(t.pieces[0].n));
      }
      const box = el.getBoundingClientRect();
      return {
        el, T, W, fs: parseFloat(cs.fontSize),
        ls: parseFloat(cs.letterSpacing) || 0, ws: parseFloat(cs.wordSpacing) || 0,
        target: lh > 0 ? Math.max(1, Math.round(H / lh)) : 0,
        hard: box.bottom > 0 && box.top < innerHeight   // đang hiện trên màn hình: không thêm dòng (chữ bên dưới không bị đẩy xuống)
      };
    }

    // Quy hoạch động: phạt khe giãn (bình phương), phạt nhích khoảng cách chữ, phạt dòng cuối quá ngắn hoặc chỉ 1–2 chữ,
    // phạt xuống dòng ngay chỗ khoảng trắng không ngắt (&nbsp;) hay giữa một liên kết
    function breakLines(A, W, fs, target, hard, lim) {
      const m = A.length;
      const PW = new Float64Array(m + 1), PS = new Float64Array(m + 1), PC = new Float64Array(m + 1);
      for (let k = 0; k < m; k++) { PW[k + 1] = PW[k] + A[k].w; PS[k + 1] = PS[k] + A[k].sw; PC[k + 1] = PC[k] + A[k].ch; }
      // GW[j]: bề rộng cụm bắt đầu ở chữ j (gồm các chữ dính sau nó bằng khoảng trắng không ngắt, vd. "4,3 tỷ")
      const GW = new Float64Array(m + 1);
      for (let k = m - 1; k >= 0; k--) GW[k] = A[k].w + (k + 1 < m && A[k + 1].bind ? A[k + 1].sw + GW[k + 1] : 0);
      const trMin = lim.trMin * fs, trMax = lim.trMax * fs;
      const tooWide = (i, j) => PW[j] - PW[i] + PS[j] - PS[i + 1] - W > -lim.eMin * fs * (j - i) - trMin * (PC[j] - PC[i] + j - i) + 1;
      // các dòng có thể có: dòng kết thúc ở chữ j bắt đầu từ chữ lo[j] … j-1; chi phí lưu trong mảng phẳng
      const lo = new Int32Array(m + 1), off = new Int32Array(m + 1);
      let total = 0;
      for (let j = 1; j <= m; j++) {
        let i = j - 1;
        while (i > 0 && !tooWide(i - 1, j)) i--;
        lo[j] = i; off[j] = total; total += j - i;
      }
      const COST = new Float64Array(total), TR = new Float64Array(total), WS = new Float64Array(total);
      for (let j = 1; j <= m; j++) {
        const last = j === m;
        for (let i = lo[j]; i < j; i++) {
          const nat = PW[j] - PW[i] + PS[j] - PS[i + 1];
          const C = PC[j] - PC[i] + (j - i - 1);
          const G = j - i - 1;
          const S = W - nat;
          let cost = 0, tr = 0, ws = 0;
          if (last) {
            if (S < 0) {
              tr = Math.max(S / C, trMin);
              const rest = S - C * tr;
              if (rest < 0) {
                if (!G || rest / G / fs < lim.eMin) cost = Infinity;
                else { ws = rest / G; cost = 100 * (ws / fs / K_SHRINK) * (ws / fs / K_SHRINK); }
              }
              cost += trCost(tr, fs);
            } else if (i > 0) {
              const fill = nat / W;
              if (fill < 0.3) cost += (0.3 - fill) * 900;
              if (G === 0) cost += 350;                  // dòng cuối chỉ 1 chữ
              else if (G === 1) cost += 120;             // dòng cuối chỉ 2 chữ
            }
          } else {
            const K = S >= 0 ? K_STRETCH : K_SHRINK;
            if (!G) {
              tr = S / C;
              cost = (tr < trMin || tr > trMax) ? Infinity : 250 + trCost(tr, fs);
            } else {
              const a = 100 / ((G * fs * K) * (G * fs * K)), b = (S >= 0 ? W_TR : W_TR_NEG) / ((TR_REF * fs) * (TR_REF * fs));
              tr = Math.min(trMax, Math.max(trMin, a * C * S / (a * C * C + b)));
              const e = (S - C * tr) / G / fs;
              if (e > lim.eMax || e < lim.eMin) cost = Infinity;
              else {
                cost = 100 * (e / K) * (e / K) + trCost(tr, fs);
                if (e < 0) ws = e * fs;
              }
            }
            if (A[j].bind) cost += BIND_PEN;
            if (A[j].link) cost += LINK_PEN;
            // dòng phải đầy: cụm chữ kế tiếp còn vừa với khoảng trắng bình thường thì không được đẩy nó xuống dòng dưới
            // (yêu cầu 16/11/2026: không xuống hàng khi chưa hết hàng)
            if (S - A[j].sw - GW[j] > 0.5) cost = Infinity;
          }
          const x = off[j] + i - lo[j];
          COST[x] = cost; TR[x] = tr; WS[x] = ws;
        }
      }
      const maxN = Math.min(m, target ? target + 1 : Math.ceil((PW[m] + PS[m]) / W) + 2);
      let prev = new Float64Array(m + 1).fill(Infinity);
      prev[0] = 0;
      const from = [null];
      let best = null;
      for (let k = 1; k <= maxN; k++) {
        const cur = new Float64Array(m + 1).fill(Infinity), fr = new Int32Array(m + 1).fill(-1);
        for (let j = k; j <= m; j++) {
          const base = off[j] - lo[j];
          for (let i = Math.max(lo[j], k - 1); i < j; i++) {
            if (prev[i] === Infinity) continue;
            const c = prev[i] + COST[base + i];
            if (c < cur[j]) { cur[j] = c; fr[j] = i; }
          }
        }
        from.push(fr);
        if (cur[m] < Infinity && (!hard || k <= target)) {
          // bớt 1 dòng thì nhẹ, thêm 1 dòng thì nặng (đẩy phần bên dưới xuống)
          const score = cur[m] + (!target ? 0 : k < target ? FEWER_PEN * (target - k) : MORE_PEN * (k - target));
          if (!best || score < best.score) best = { n: k, score };
        }
        prev = cur;
      }
      if (!best) return null;
      const out = [];
      for (let k = best.n, j = m; k > 0; k--) {
        const i = from[k][j], x = off[j] + i - lo[j];
        out.unshift([i, j, TR[x], WS[x]]);
        j = i;
      }
      return out;
    }

    // Dựng các dòng từ chính nội dung gốc: mỗi dòng là bản sao một khoảng chữ (thẻ bị cắt ngang được sao ở cả hai dòng)
    function commit(job) {
      const { el, T, W, fs, ls, ws, target, hard } = job;
      const Wl = W - 0.75;
      const res = breakLines(T, Wl, fs, target, hard, STRICT) || breakLines(T, Wl, fs, target, hard, RELAX)
        || (hard ? breakLines(T, Wl, fs, target, false, RELAX) : null);
      if (!res) return null;
      const m = T.length, ids = new Set(), r = document.createRange();
      const spans = res.map(([i, j, tr, wsx]) => {
        if (i === 0) r.setStart(el, 0); else r.setStart(T[i].pieces[0].n, T[i].pieces[0].s);
        if (j === m) r.setEnd(el, el.childNodes.length); else r.setEnd(T[j].sep.endNode, T[j].sep.endI);
        const frag = r.cloneContents();
        if (frag.querySelector('*')) {
          // thẻ bị cắt ở mép dòng mà không còn chữ (vd. <a></a>) thì bỏ; id chỉ giữ ở lần xuất hiện đầu
          $$('*', frag).reverse().forEach(e => { if (!e.textContent.trim()) e.remove(); });
          $$('[id]', frag).forEach(e => { if (ids.has(e.id)) e.removeAttribute('id'); else ids.add(e.id); });
        }
        const s = document.createElement('span');
        s.className = 'kj-l' + (j === m ? ' kj-end' : '');
        s.appendChild(frag);
        if (tr) s.style.letterSpacing = (ls + tr).toFixed(3) + 'px';
        if (wsx) s.style.wordSpacing = (ws + wsx - 0.2).toFixed(3) + 'px';
        let c = j - i - 1;
        for (let k = i; k < j; k++) c += T[k].ch;
        s.__c = c;
        return s;
      });
      el.__kjOrig = [...el.childNodes];
      el.replaceChildren(...spans);
      el.classList.add('kj');
      done.add(el);
      return spans;
    }

    // Dòng nào lố khung (sai số đo) thì siết khoảng cách chữ của riêng dòng đó
    function verify(spans) {
      const fixes = [];
      spans.forEach(s => { const over = s.scrollWidth - s.clientWidth; if (over > 0.5) fixes.push([s, over]); });
      fixes.forEach(([s, over]) => {
        const cur = parseFloat(getComputedStyle(s).letterSpacing) || 0;
        s.style.letterSpacing = (cur - (over + 0.4) / Math.max(1, s.__c)).toFixed(3) + 'px';
      });
    }

    // Ô số liệu: nhãn nào phải xuống 2 dòng cạnh con số thì cả khối xếp số trên, nhãn dưới
    function stackMetrics(scope) {
      $$('.kb-case__m', scope).forEach(dl => {
        dl.classList.remove('kj-stack');
        if (!mq.matches) return;
        if ($$('dd', dl).some(dd => dd.getBoundingClientRect().height > (parseFloat(getComputedStyle(dd).lineHeight) || 20) * 1.5)) dl.classList.add('kj-stack');
      });
    }

    // Bài viết dùng khoảng trắng không ngắt (&nbsp;) nối 2–3 chữ cuối câu để bản máy tính không có dòng cuối một chữ.
    // Trên điện thoại nó kéo cả cụm xuống dòng khi dòng trên còn chỗ (tiêu đề khối, ô bảng, chú thích...), nên ở đây coi
    // như khoảng trắng thường, trừ chỗ nối số với đơn vị (vd. "4,3 tỷ", "30 ngày"); màn hình rộng ra thì trả lại bản gốc
    const unbound = new Set();
    function unbind(scope) {
      const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        const v = n.nodeValue;
        if (v.indexOf('\u00A0') < 0) continue;
        const next = v.replace(/(^|[^\d])\u00A0/g, '$1 ');
        if (next === v) continue;
        if (n.__kjNb === undefined) n.__kjNb = v;
        n.nodeValue = next;
        unbound.add(n);
      }
    }
    function rebind() {
      unbound.forEach(n => { if (n.__kjNb !== undefined) { n.nodeValue = n.__kjNb; n.__kjNb = undefined; } });
      unbound.clear();
    }
    // Máy tính / máy tính bảng (yêu cầu 23/11/2026): trong các KHỐI của bài (bảng, thẻ, danh sách bước, số liệu,
    // tình huống, chú thích, FAQ, khối kêu gọi...) cụm 2–3 chữ nối &nbsp; bị đẩy xuống dòng khi dòng trên còn chỗ,
    // để lại khoảng trống vô lý — gỡ nối ở đó như trên điện thoại. Đoạn văn cột rộng giữ nối (không có dòng cuối một chữ).
    // Cùng bộ chọn với quy tắc cuối css/kb-article.css.
    const BLOCKS = '.kb-prose > :is(div, table, aside, section, figure, dl, details), .kb-prose > :is(ul, ol)[class]';
    function unbindBlocks() { $$(BLOCKS, root).forEach(unbind); }

    function run(scope) {
      scope = scope || root;
      const g = scope === root ? ++gen : gen;          // dựng lại cả bài thì bỏ các lượt cũ còn dở
      [...done].forEach(el => { if (scope.contains(el)) { restore(el); done.delete(el); } });
      fonts = new Map();
      if (mq.matches) unbind(scope); else { rebind(); unbindBlocks(); }
      stackMetrics(scope);
      if (!mq.matches) return;
      wrapRuns(scope);
      // đoạn đang hiện trên màn hình làm ngay; phần còn lại làm từng chút lúc trình duyệt rảnh (mỗi lượt ~10ms)
      // để không làm khựng trang trên điện thoại yếu
      const list = targets(scope);
      const vis = [], rest = [];
      list.forEach(el => { const b = el.getBoundingClientRect(); (b.bottom > 0 && b.top < innerHeight ? vis : rest).push(el); });
      const step = batch => {
        const jobs = batch.map(measure).filter(Boolean);              // đọc
        const spans = [].concat(...jobs.map(commit).filter(Boolean)); // ghi
        verify(spans);                                                 // đọc rồi ghi
      };
      step(vis);
      const next = () => {
        if (g !== gen || !mq.matches) return;
        const end = performance.now() + SLICE_MS;
        while (rest.length && performance.now() < end) step(rest.splice(0, 1));
        if (rest.length) later(next);
      };
      if (rest.length) later(next);
    }
    const later = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 400 }) : f => setTimeout(f, 16);

    let lastW = innerWidth, t;
    window.addEventListener('resize', () => {
      if (Math.abs(innerWidth - lastW) < 1) return;   // thanh địa chỉ điện thoại ẩn/hiện chỉ đổi chiều cao
      lastW = innerWidth;
      clearTimeout(t); t = setTimeout(() => run(), 150);
    }, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', () => run());
    // câu trả lời FAQ đang gập có thể chưa đo được: dựng lại phần đó khi mở ra
    $$('details', root).forEach(d => d.addEventListener('toggle', () => {
      if (d.open && mq.matches && $$('p, li', d).some(el => !el.classList.contains('kj') && el.textContent.trim())) run(d);
    }));
    const ff = document.fonts;
    (ff && ff.ready ? ff.ready : Promise.resolve()).then(() => {
      run();
      if (ff && ff.addEventListener) ff.addEventListener('loadingdone', () => { widths = new Map(); run(); });
    });
  })();
})();
