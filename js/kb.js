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
})();
