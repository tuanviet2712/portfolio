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

  LTV.reduced = new URLSearchParams(location.search).has('nomotion');
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
    if (LTV.lenis) LTV.lenis.raf(now); // cuộn mượt (js/stage.js) chạy trước mọi tick để cả trang đọc cùng một vị trí
    st.y = window.scrollY;
    st.vy = lerp(st.vy, (st.y - lastY) / dt, 1 - Math.exp(-dt * 8));
    lastY = st.y;
    st.dt = dt;
    st.t = now / 1000;
    for (let i = 0; i < tickers.length; i++) tickers[i](st);
    requestAnimationFrame(frame);
  }
  let rq = 0;
  let lastResizeW = innerWidth, lastResizeH = innerHeight;
  const runResize = (force) => {
    const nw = innerWidth, nh = innerHeight;
    const wChanged = Math.abs(nw - lastResizeW) > 1;
    const hChangedBig = Math.abs(nh - lastResizeH) > 140;
    // Trên điện thoại/tablet: khi thanh địa chỉ trình duyệt ẩn/hiện lúc đang cuộn (bề ngang giữ nguyên,
    // chiều cao chỉ xê dịch < 140px), KHÔNG chạy lại toàn bộ resizers & runLayout để tránh giật khung hình.
    if (!force && !LTV.fine && !wChanged && !hChangedBig) {
      return;
    }
    lastResizeW = nw;
    lastResizeH = nh;
    st.vh = nh;
    st.vw = nw;
    resizers.forEach(f => f(st));
    runLayout();
  };
  addEventListener('resize', () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => runResize(false)); }, { passive: true });
  addEventListener('orientationchange', () => { setTimeout(() => runResize(true), 150); }, { passive: true });
  addEventListener('load', () => runResize(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => runResize(true));
  LTV.refresh = () => runResize(true);

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
    if (!pre || LTV.params.has('skip') || window.__ltvLangSwitch || document.documentElement.classList.contains('is-pt-in')) {
      if (pre) pre.remove();
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
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
      // Start writing once the page's start-up work (deferred scripts, fonts, layout passes) has settled:
      // a stroke drawn across a long frame would jump. Needs 150 ms of smooth frames; waits 1.6 s at most.
      const whenQuiet = go => {
        if (LTV.reduced) return requestAnimationFrame(go);
        const t0 = performance.now();
        let last = t0, calm = t0;
        const check = now => {
          if (now - last > 34 || document.readyState !== 'complete') calm = now;
          last = now;
          if (now - calm >= 150 || now - t0 >= 1600) go(); else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      };
      const writeSvg = () => {
        if (lastPen) lastPen.addEventListener('animationend', completeWriting, { once: true });
        whenQuiet(() => {
          pre.classList.add('is-writing');
          if (LTV.reduced || !lastPen) completeWriting();
          else {
            const duration = Number($('.hello', pre).dataset.duration) || 3600;
            setTimeout(completeWriting, duration + 500); // CSS animation fallback
          }
        });
      };
      // js/hello.js đã cho chữ viết bằng ảnh động (compositor chạy, không phụ thuộc luồng chính) => chỉ chờ nó xong.
      // Không có / lỗi => viết bằng SVG như cũ; gán false để hello.js chạy muộn không viết chồng lên.
      const anim = window.LTV_HELLO_ANIM;
      if (anim) anim.wait(completeWriting, writeSvg);
      else { window.LTV_HELLO_ANIM = false; writeSvg(); }
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

  /* ---------------- cursor (Bàn tay thương hiệu LTV + 5 hiệu ứng chạm) ---------------- */
  function initCursor() {
    if (!LTV.fine || LTV.reduced) return;
    const oldRing = $('.cursor-ring');
    if (oldRing) oldRing.remove();
    let dot = $('.cursor');
    if (!dot) {
      dot = document.createElement('div');
      dot.className = 'cursor';
      dot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dot);
    }
    const handFillPath = 'M 17.5 27.0 L 17.5 14.5 A 2.5 2.5 0 0 1 22.5 14.5 L 22.5 20.8 A 2.25 2.25 0 0 1 27.0 20.8 L 27.0 22.2 A 2.25 2.25 0 0 1 31.5 22.2 L 31.5 23.8 A 2.0 2.0 0 0 1 35.5 23.8 L 35.5 30.8 C 35.5 37.2, 30.5 41.5, 24.0 41.5 C 18.8 41.5, 15.5 39.1, 13.2 34.8 L 10.4 29.5 C 9.3 27.3, 10.3 24.6, 12.7 24.6 C 14.4 24.6, 16.1 25.5, 17.5 27.0 Z';
    const handStrokePath = 'M 17.5 29.0 L 17.5 14.5 A 2.5 2.5 0 0 1 22.5 14.5 L 22.5 26.2 M 22.5 20.8 A 2.25 2.25 0 0 1 27.0 20.8 L 27.0 26.6 M 27.0 22.2 A 2.25 2.25 0 0 1 31.5 22.2 L 31.5 27.2 M 31.5 23.8 A 2.0 2.0 0 0 1 35.5 23.8 L 35.5 30.8 C 35.5 37.2, 30.5 41.5, 24.0 41.5 C 18.8 41.5, 15.5 39.1, 13.2 34.8 L 10.4 29.5 C 9.3 27.3, 10.3 24.6, 12.7 24.6 C 14.4 24.6, 16.1 25.5, 17.5 27.0';
    dot.innerHTML = `<svg class="cursor__svg" width="48" height="48" viewBox="0 0 48 48" fill="none" shape-rendering="geometricPrecision" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ltv-cur-stroke" gradientUnits="userSpaceOnUse" x1="10" y1="6" x2="36" y2="42">
          <stop offset="0%" stop-color="#0CF2DF"/>
          <stop offset="28%" stop-color="#17C4FA"/>
          <stop offset="56%" stop-color="#1482FF"/>
          <stop offset="82%" stop-color="#1B5CF2"/>
          <stop offset="100%" stop-color="#14267E"/>
        </linearGradient>
        <linearGradient id="ltv-cur-fx" gradientUnits="userSpaceOnUse" x1="9" y1="5" x2="31" y2="20">
          <stop offset="0%" stop-color="#0CF2DF"/>
          <stop offset="40%" stop-color="#17C4FA"/>
          <stop offset="78%" stop-color="#1B5CF2"/>
          <stop offset="100%" stop-color="#152E92"/>
        </linearGradient>
        <linearGradient id="ltv-cur-palm" gradientUnits="userSpaceOnUse" x1="14" y1="12" x2="34" y2="42">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="55%" stop-color="#F5FAFF"/>
          <stop offset="100%" stop-color="#E2F0FF"/>
        </linearGradient>
      </defs>
      <g class="cursor__fx cursor__fx--rays" stroke="url(#ltv-cur-fx)" stroke-width="1.35" stroke-linecap="round">
        <path d="M 14.5 14.5 L 11.0 14.5 M 16.11 10.61 L 13.64 8.14 M 20.0 9.0 L 20.0 5.5 M 23.89 10.61 L 26.36 8.14 M 25.5 14.5 L 29.0 14.5"/>
        <circle class="cursor__spark" cx="11.5" cy="6.2" r="0.75" fill="url(#ltv-cur-fx)" stroke="none"/>
        <circle class="cursor__spark" cx="31.0" cy="14.5" r="0.75" fill="url(#ltv-cur-fx)" stroke="none"/>
      </g>
      <g class="cursor__fx cursor__fx--ripples" stroke="url(#ltv-cur-fx)" stroke-width="1.3" stroke-linecap="round">
        <path d="M 15.50 17.65 A 5.5 5.5 0 1 1 24.50 17.65"/>
        <path d="M 12.79 19.00 A 8.5 8.5 0 1 1 27.21 19.00"/>
      </g>
      <g class="cursor__fx cursor__fx--dots" fill="url(#ltv-cur-fx)">
        <circle cx="14.69" cy="15.92" r="0.7"/><circle cx="15.02" cy="12.62" r="0.7"/><circle cx="17.08" cy="9.84" r="0.7"/><circle cx="20.00" cy="9.00" r="0.7"/><circle cx="22.92" cy="9.84" r="0.7"/><circle cx="24.98" cy="12.62" r="0.7"/><circle cx="25.31" cy="15.92" r="0.7"/>
        <circle cx="11.79" cy="16.70" r="0.95"/><circle cx="12.30" cy="11.59" r="0.95"/><circle cx="15.50" cy="7.29" r="0.95"/><circle cx="20.00" cy="6.00" r="0.95"/><circle cx="24.50" cy="7.29" r="0.95"/><circle cx="27.70" cy="11.59" r="0.95"/><circle cx="28.21" cy="16.70" r="0.95"/>
      </g>
      <g class="cursor__fx cursor__fx--waves" stroke="url(#ltv-cur-fx)" stroke-width="1.3" stroke-linecap="round">
        <path d="M 16.65 10.78 A 5.0 5.0 0 0 1 23.35 10.78"/>
        <path d="M 14.78 8.70 A 7.8 7.8 0 0 1 25.22 8.70"/>
        <path d="M 12.91 6.62 A 10.6 10.6 0 0 1 27.09 6.62"/>
      </g>
      <g class="cursor__fx cursor__fx--burst" stroke="url(#ltv-cur-fx)" stroke-width="1.05" stroke-linecap="round">
        <path d="M 15.17 15.79 L 13.82 16.16 M 15.07 14.50 L 13.69 14.50 M 15.30 13.23 L 13.99 12.88 M 15.86 12.06 L 14.70 11.39 M 16.72 11.09 L 15.80 10.14 M 17.80 10.39 L 17.18 9.24 M 19.03 10.00 L 18.76 8.74 M 20.00 9.90 L 20.00 8.50 M 20.97 10.00 L 21.24 8.74 M 22.20 10.39 L 22.82 9.24 M 23.28 11.09 L 24.20 10.14 M 24.14 12.06 L 25.30 11.39 M 24.70 13.23 L 26.01 12.88 M 24.93 14.50 L 26.31 14.50 M 24.83 15.79 L 26.18 16.16"/>
        <path d="M 12.66 16.47 L 11.02 16.91 M 12.50 14.50 L 10.80 14.50 M 12.85 12.56 L 11.21 12.12 M 13.68 10.75 L 12.21 9.90 M 14.95 9.23 L 13.75 8.03 M 16.57 8.11 L 15.72 6.64 M 18.43 7.45 L 17.99 5.81 M 20.00 7.30 L 20.00 5.60 M 21.57 7.45 L 22.01 5.81 M 23.43 8.11 L 24.28 6.64 M 25.05 9.23 L 26.25 8.03 M 26.32 10.75 L 27.79 9.90 M 27.15 12.56 L 28.79 12.12 M 27.50 14.50 L 29.20 14.50 M 27.34 16.47 L 28.98 16.91"/>
      </g>
      <g class="cursor__hand">
        <path d="${handFillPath}" transform="translate(0, 1.2)" fill="rgba(10, 22, 54, 0.14)" stroke="none"/>
        <path d="${handFillPath}" fill="url(#ltv-cur-palm)" stroke="none"/>
        <path d="${handStrokePath}" fill="none" stroke="url(#ltv-cur-stroke)" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round"/>
        <path class="cursor__wrist" d="M 19.5 38.0 L 27.5 38.0 M 29.8 38.0 L 31.0 38.0" stroke="url(#ltv-cur-stroke)" stroke-width="1.25" stroke-linecap="round"/>
      </g>
    </svg>`;

    function detectFx(t) {
      if (!t || !t.closest) return '';
      if (t.closest('[data-cursor-label], [data-sphere], .sphere, [data-partners], .logos, [data-fb-viewport], .fb__viewport, [data-more-viewport], .cmar')) return 'dots';
      if (t.closest('.skx-tab, .pnode, .tab, .pw-nav__a, .vrow__head, .skill__head, summary, .lang-float__option, .menu-kb__btn, input, select, textarea')) return 'burst';
      if (t.closest('.btn, .logos-cta, .totop, .kbdd__all, .more-btn, [data-copy], .nav__brand, .nav__burger, .nav__search, .lb__btn, [data-more-nav], [data-search-open], [data-search-close], [data-sheet-open], [data-sheet-close], [data-share-copy]')) return 'rays';
      if (t.closest('.vcard:not(.is-active), .pw-card, [data-view], .kbh-pillar, .kb-post, .lb__bg')) return 'ripples';
      if (t.closest('a[href], button.bio__link')) return 'waves';
      if (t.closest('.vcard, [data-tilt], .spot, .kbh-post')) return 'ripples';
      if (t.closest('button, [role="button"]')) return 'rays';
      return '';
    }

    let seen = false, lastFx = '', downTimer = 0;
    addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const x = Math.round(e.clientX), y = Math.round(e.clientY);
      if (!seen) { seen = true; document.body.classList.add('has-cursor'); }
      dot.classList.remove('is-out');
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const t = e.target;
      const dlg = t && t.closest && t.closest('dialog[open]');
      const host = dlg || document.body;
      if (dot.parentElement !== host) host.appendChild(dot);
      const fx = detectFx(t);
      if (fx !== lastFx) {
        lastFx = fx;
        if (fx) dot.setAttribute('data-fx', fx);
        else dot.removeAttribute('data-fx');
      }
      dot.classList.toggle('is-dark', !!(t && t.closest && t.closest('.sec-dark, .footer, .hero, .is-dark, .pfx, .kbx, .lb')));
    }, { passive: true });

    addEventListener('pointerdown', e => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      if (!seen) { seen = true; document.body.classList.add('has-cursor'); }
      dot.classList.remove('is-out');
      dot.style.transform = `translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
      clearTimeout(downTimer);
      dot.classList.add('is-down');
    }, { passive: true });

    const releaseDown = () => {
      clearTimeout(downTimer);
      downTimer = setTimeout(() => dot.classList.remove('is-down'), 190);
    };
    addEventListener('pointerup', releaseDown, { passive: true });
    addEventListener('pointercancel', releaseDown, { passive: true });
    addEventListener('blur', () => dot.classList.remove('is-down'));
    document.documentElement.addEventListener('mouseleave', () => dot.classList.add('is-out'));
    document.documentElement.addEventListener('mouseenter', () => dot.classList.remove('is-out'));
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
