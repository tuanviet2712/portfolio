/* ==========================================================================
   CORE — vòng lặp animation, preloader, nav, cursor, reveal, tilt, magnetic
   ========================================================================== */
(function () {
  'use strict';

  const LTV = (window.LTV = window.LTV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  Object.assign(LTV, { $, $$, clamp, lerp, smooth });

  LTV.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  LTV.fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  LTV.params = new URLSearchParams(location.search);
  const DATA = window.SITE_DATA || { profile: {} };

  // CSS của showcase chỉ cần ở phần dự án rất xa màn hình đầu. Nạp sau lần vẽ đầu
  // để không chặn FCP, nhưng vẫn sẵn sàng rất lâu trước khi người dùng cuộn tới.
  const deferredStyle = document.getElementById('showcase-css');
  if (deferredStyle) {
    const activateStyle = () => { deferredStyle.rel = 'stylesheet'; deferredStyle.removeAttribute('as'); };
    if ('requestIdleCallback' in window) requestIdleCallback(activateStyle, { timeout: 1200 });
    else setTimeout(activateStyle, 0);
  }

  /* ---------------- events ---------------- */
  const handlers = {};
  LTV.on = (n, f) => (handlers[n] = handlers[n] || []).push(f);
  LTV.emit = (n, d) => (handlers[n] || []).forEach(f => f(d));

  /* ---------------- main loop ---------------- */
  const tickers = [];
  const resizers = [];
  LTV.tick = fn => tickers.push(fn);
  LTV.onResize = fn => resizers.push(fn);
  const st = (LTV.state = { y: window.scrollY, vy: 0, dt: 0.016, t: 0, vh: innerHeight, vw: innerWidth });
  let lastT = performance.now();
  let lastY = window.scrollY;
  function frame(now) {
    const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
    lastT = now;
    st.y = window.scrollY;
    st.vy = lerp(st.vy, (st.y - lastY) / dt, 1 - Math.exp(-dt * 8));
    lastY = st.y;
    st.dt = dt;
    st.t = now / 1000;
    for (let i = 0; i < tickers.length; i++) tickers[i](st);
    requestAnimationFrame(frame);
  }
  let rq = 0;
  const runResize = () => { st.vh = innerHeight; st.vw = innerWidth; resizers.forEach(f => f(st)); runLayout(); };
  addEventListener('resize', () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(runResize); });
  addEventListener('load', runResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(runResize);
  LTV.refresh = runResize;

  /* Đo vị trí phần tử MỘT LẦN rồi lưu lại (không đọc layout trong vòng lặp cuộn => không giật).
     Đo lại khi cửa sổ đổi cỡ hoặc chiều cao trang thay đổi (vd. mở/đóng danh sách). */
  const layoutFns = [];
  let lq = 0;
  function runLayout() { layoutFns.forEach(f => f(st)); }
  LTV.onLayout = fn => { layoutFns.push(fn); };
  LTV.docTop = el => el.getBoundingClientRect().top + window.scrollY;
  if ('ResizeObserver' in window) {
    let lastH = 0;
    new ResizeObserver(() => {
      const h = document.body.offsetHeight;
      if (h === lastH) return;
      lastH = h;
      cancelAnimationFrame(lq);
      lq = requestAnimationFrame(runLayout);
    }).observe(document.body);
  }

  if (LTV.reduced) document.documentElement.classList.remove('smooth');

  /* ---------------- profile links ---------------- */
  function applyProfile() {
    const p = DATA.profile || {};
    const zalo = p.zalo || ('https://zalo.me/' + (p.phoneRaw || '0935702321'));
    $$('[data-zalo]').forEach(a => (a.href = zalo));
    if (p.cv) $$('[data-cv]').forEach(a => (a.href = p.cv));
    if (p.email) $$('[data-mailto]').forEach(a => (a.href = 'mailto:' + p.email));
  }

  /* ---------------- preloader "xin chào" ---------------- */
  LTV.preloader = (function () {
    const pre = $('#preloader');
    const body = document.body;
    let progress = 0, heroReady = false, writingDone = false, closed = false;
    const pct = pre && $('.preloader__pct', pre);
    const bar = pre && $('.preloader__bar i', pre);
    const finish = () => {
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      LTV.emit('ready');
    };
    if (!pre || LTV.params.has('skip')) {
      if (pre) pre.remove();
      requestAnimationFrame(finish);
      return { set() {}, ready() {} };
    }
    function set(p) {
      progress = Math.max(progress, clamp(p));
      if (pct) pct.textContent = Math.round(progress * 100) + '%';
      if (bar) bar.style.setProperty('--p', progress);
    }
    function tryClose() {
      if (closed || !heroReady || !writingDone) return;
      closed = true;
      set(1);
      setTimeout(() => {
        pre.classList.add('is-done');
        finish();
        setTimeout(() => pre.remove(), 1400);
      }, 280);
    }
    // Đã chào trong phiên này (vd. quay lại từ trang dự án) => bỏ màn "xin chào", chỉ chờ tải khung
    let greeted = false;
    try { greeted = sessionStorage.getItem('ltv-hello') === '1'; sessionStorage.setItem('ltv-hello', '1'); } catch (_) { /* bỏ qua */ }
    if (greeted && !LTV.params.has('hello')) {
      pre.classList.add('is-quick');
      writingDone = true;
    } else {
      const pens = $$('.hello__pen', pre);
      const completeWriting = () => {
        if (writingDone) return;
        pre.classList.add('is-written');
        writingDone = true;
        tryClose();
      };
      // The last pen ends only after every letter and Vietnamese accent is drawn.
      const lastPen = pens[pens.length - 1];
      if (lastPen) lastPen.addEventListener('animationend', completeWriting, { once: true });
      requestAnimationFrame(() => {
        pre.classList.add('is-writing');
        if (LTV.reduced || !lastPen) completeWriting();
        else {
          const duration = Number($('.hello', pre).dataset.duration) || 3600;
          setTimeout(completeWriting, duration + 500); // CSS animation fallback
        }
      });
    }
    setTimeout(() => { heroReady = true; tryClose(); }, 10000); // failsafe
    return { set, ready() { heroReady = true; tryClose(); } };
  })();

  /* ---------------- nav ---------------- */
  function initNav() {
    const nav = $('#nav');
    if (!nav) return;
    const links = $$('.nav__links a');
    const pill = $('.nav__pill');
    const burger = $('.nav__burger');
    const menu = $('#menu');
    let active = null;

    function movePill(a) {
      if (!pill || !a) return;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
      pill.style.opacity = 1;
    }
    function setActive(id) {
      const a = links.find(l => l.dataset.nav === id);
      if (!a || a === active) return;
      links.forEach(l => l.classList.toggle('is-active', l === a));
      active = a;
      movePill(a);
    }
    const map = { 'gia-tri': 'gioi-thieu', 'quy-trinh': 'nang-luc' };
    const secs = $$('main > section[id]');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(map[e.target.id] || e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
    setActive(document.body.dataset.navActive || 'trang-chu');
    LTV.onResize(() => movePill(active));

    // hide on scroll down, show on scroll up; thu gọn khi đã cuộn
    let hidden = false, scrolled = false;
    LTV.tick(s => {
      const sc = s.y > 30;
      if (sc !== scrolled) { scrolled = sc; nav.classList.toggle('is-scrolled', sc); }
      const open = nav.classList.contains('is-open');
      const shouldHide = !open && s.y > 240 && s.vy > 60;
      const shouldShow = open || s.vy < -40 || s.y < 240;
      if (shouldHide && !hidden) { hidden = true; nav.classList.add('is-hidden'); }
      else if (shouldShow && hidden) { hidden = false; nav.classList.remove('is-hidden'); }
    });

    function toggleMenu(force) {
      const open = typeof force === 'boolean' ? force : !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    burger && burger.addEventListener('click', () => toggleMenu());
    menu && $$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });
  }

  /* ---------------- scroll progress ---------------- */
  function initProgress() {
    const bar = $('.progress');
    if (!bar) return;
    let docH = 1;
    const measure = () => (docH = Math.max(1, document.documentElement.scrollHeight - innerHeight));
    measure();
    LTV.onLayout(measure);
    let last = -1;
    LTV.tick(s => {
      const p = clamp(s.y / docH);
      if (Math.abs(p - last) > 0.0005) { last = p; bar.style.setProperty('--sp', p.toFixed(4)); }
    });
  }

  /* ---------------- reveal ---------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
      if (e.target.matches('[data-count]') || e.target.querySelector('[data-count]')) countUp(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  LTV.observeReveal = els => els.forEach(el => revealIO.observe(el));

  /* ---------------- counters ---------------- */
  function countUp(root) {
    $$('[data-count]', root).concat(root.matches('[data-count]') ? [root] : []).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = 1;
      const to = parseFloat(el.dataset.count);
      const dec = +(el.dataset.decimals || 0);
      const pad = +(el.dataset.pad || 0);
      const dur = LTV.reduced ? 1 : 1700;
      const t0 = performance.now();
      const fmt = v => { let s = v.toFixed(dec); if (pad) s = s.padStart(pad, '0'); return s; };
      (function step(now) {
        const k = clamp((now - t0) / dur);
        const e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
        el.textContent = fmt(to * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------------- tilt 3D (delegated) ---------------- */
  function initTilt() {
    if (!LTV.fine || LTV.reduced) return;
    let cur = null;
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('[data-tilt]');
      if (el !== cur) {
        if (cur) { cur.classList.remove('is-tilting'); cur.style.setProperty('--rx', '0deg'); cur.style.setProperty('--ry', '0deg'); }
        cur = el;
        if (cur) cur.classList.add('is-tilting');
      }
      if (!cur) return;
      const r = cur.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const m = +(cur.dataset.tilt || 8);
      cur.style.setProperty('--rx', ((0.5 - y) * m).toFixed(2) + 'deg');
      cur.style.setProperty('--ry', ((x - 0.5) * m).toFixed(2) + 'deg');
      cur.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      cur.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (cur) { cur.style.setProperty('--rx', '0deg'); cur.style.setProperty('--ry', '0deg'); cur = null; } });
  }

  /* ---------------- magnetic buttons ---------------- */
  function initMagnetic() {
    if (!LTV.fine || LTV.reduced) return;
    let cur = null;
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.magnetic');
      if (el !== cur) {
        if (cur) cur.style.transform = '';
        cur = el;
      }
      if (!cur) return;
      const r = cur.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      cur.style.transform = `translate3d(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px, 0)`;
    }, { passive: true });
  }

  /* ---------------- cursor ---------------- */
  function initCursor() {
    if (!LTV.fine || LTV.reduced) return;
    const dot = $('.cursor');
    const ring = $('.cursor-ring');
    if (!dot || !ring) return;
    const label = $('span', ring);
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, seen = false;
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; rx = x; ry = y; document.body.classList.add('has-cursor'); }
      const t = e.target;
      const lab = t.closest && t.closest('[data-cursor-label]');
      const hov = t.closest && t.closest('a, button, [data-tilt], [data-sphere], .tab');
      ring.classList.toggle('is-label', !!lab);
      ring.classList.toggle('is-hover', !lab && !!hov);
      ring.classList.toggle('is-dark', !!(t.closest && t.closest('.sec-dark, .footer, .hero, .is-dark')));
      if (lab) label.textContent = lab.dataset.cursorLabel;
    }, { passive: true });
    let lx = -1, ly = -1, lrx = -1, lry = -1;
    LTV.tick(s => {
      if (!seen) return;
      const k = 1 - Math.exp(-s.dt * 16);
      rx += (x - rx) * k; ry += (y - ry) * k;
      if (x !== lx || y !== ly) { lx = x; ly = y; dot.style.transform = `translate3d(${x}px, ${y}px, 0)`; }
      const nrx = Math.round(rx * 10) / 10, nry = Math.round(ry * 10) / 10;
      if (nrx !== lrx || nry !== lry) { lrx = nrx; lry = nry; ring.style.transform = `translate3d(${nrx}px, ${nry}px, 0)`; }
    });
  }

  /* ---------------- copy + toast ---------------- */
  function toast(msg) {
    const t = $('.toast');
    if (!t) return;
    $('span', t).textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('is-on'), 2200);
  }
  LTV.toast = toast;
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    copyText(b.dataset.copy).then(() => toast('Đã sao chép: ' + b.dataset.copy), () => toast(b.dataset.copy));
  });

  /* ---------------- marquee (phản ứng theo tốc độ cuộn) ---------------- */
  function initMarquee() {
    $$('[data-marquee]').forEach(track => {
      const group = track.firstElementChild;
      if (!group) return;
      // nhân bản đủ dài để lặp vô tận
      for (let i = 0; i < 3; i++) track.appendChild(group.cloneNode(true));
      let x = 0, w = group.offsetWidth, dir = -1, vis = true;
      LTV.onResize(() => (w = group.offsetWidth));
      new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(track);
      LTV.tick(s => {
        if (!vis || LTV.reduced) return;
        if (Math.abs(s.vy) > 40) dir = s.vy > 0 ? -1 : 1;
        x += dir * (55 + Math.min(900, Math.abs(s.vy) * 0.35)) * s.dt;
        if (x <= -w) x += w;
        if (x > 0) x -= w;
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      });
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    applyProfile();
    initNav();
    initProgress();
    initTilt();
    initMagnetic();
    initCursor();
    initMarquee();
    LTV.observeReveal($$('.rv, [data-count]'));
    requestAnimationFrame(frame);
    // ?y=1200 : cuộn tới vị trí (dùng khi kiểm thử / chụp ảnh màn hình)
    if (LTV.params.has('y')) {
      document.documentElement.classList.remove('smooth');
      const go = () => window.scrollTo(0, +LTV.params.get('y') || 0);
      LTV.on('ready', () => requestAnimationFrame(go));
      setTimeout(go, 60);
    }
  });
})();
