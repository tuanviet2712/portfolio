/* ==========================================================================
   STAGE — cuộn mượt (Lenis) + bộ điều khiển "cảnh" theo cuộn + khung 3D dùng chung (three.js)
   - Lenis làm êm con lăn chuột; vòng lặp duy nhất là của core.js (LTV.tick), Lenis chạy đầu mỗi khung
   - Một "cảnh" = một section được ghim (position: sticky) trong (1 + len) màn hình; cuộn = tua cảnh,
     scene.update(sc) nhận sc.p (0..1 trong quãng ghim), sc.e (đang trồi lên), sc.x (đang rời đi)
   - Chỉ MỘT canvas WebGL cho cả trang (học từ three.js webgl_multiple_elements + lenis.dev):
     canvas được chuyển vào cảnh 3D đang chiếm màn hình, cảnh khác không vẽ
   - three.js chỉ tải khi người xem đã qua hero (js/vendor/three.min.js, ~130 KB nén)
   - Tham số thử nghiệm: ?nomotion (bố cục tĩnh như cũ) · ?nolenis · ?nogl · ?stdebug
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  if (!L) return;
  const { clamp } = L;
  const P = L.params;
  const html = document.documentElement;
  const off = P.has('nomotion');
  const debug = P.has('stdebug');

  // vị trí tĩnh trong trang (bỏ qua transform) — dùng để đo phần tử đang được dịch chuyển
  L.offTop = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    expo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    sine: t => 0.5 - Math.cos(Math.PI * t) / 2
  };
  // r(p, a, b): tiến độ con trong đoạn [a, b] của p
  const r = (p, a, b) => clamp((p - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;

  const S = (L.stage = { scenes: [], ease, r, mix, off, debug, scrollTo, add, track, gl: null, three: loadThree, fine: L.fine });
  if (off) { html.classList.add('st-off'); return; }
  html.classList.add('st');

  /* ---------------- Điều hướng #hash xuyên trang & nội trang + đổi ngôn ngữ tức thì về Hero ---------------- */
  const isLangSwitch = !!window.__ltvLangSwitch;
  try {
    sessionStorage.removeItem('ltv-lang-scroll');
    sessionStorage.removeItem('ltv-lang-switch');
  } catch (_) {}

  const initHash = isLangSwitch ? '' : location.hash;
  const isPtIn = html.classList.contains('is-pt-in');
  if (isPtIn) window.__ltvPtManaged = true;
  let initHashActive = !isLangSwitch && !!(initHash && initHash.length > 1 && initHash !== '#trang-chu' && initHash !== '#top');
  let initHashUntil = performance.now() + 3200;
  const scCss = document.getElementById('showcase-css');

  if (isLangSwitch || initHashActive || isPtIn) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    html.classList.remove('smooth');
    // Kích hoạt ngay showcase.min.css để chiều cao #du-an ổn định tức thì thay vì chờ requestIdleCallback
    if (scCss && scCss.rel !== 'stylesheet') {
      scCss.rel = 'stylesheet';
      scCss.removeAttribute('as');
    }
    // Khi chuyển trang bằng màn xanh có logo (.pt / is-pt-in), đổi ngôn ngữ, hoặc nhảy thẳng tới section:
    // xoá ngay preloader "xin chào" để trang hiển thị tức thì không chờ timeout
    const pre = document.getElementById('preloader');
    if (pre) {
      if (isPtIn || isLangSwitch) {
        pre.remove();
      } else {
        pre.classList.add('is-done');
        setTimeout(() => pre.remove(), 350);
      }
    }
    if (document.body) {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
    }
    if (isLangSwitch) {
      window.scrollTo(0, 0);
    }
  }

  /* ---------------- Lenis ---------------- */
  if (!P.has('nolenis') && !html.classList.contains('inner-scroll') && window.Lenis) {
    html.classList.remove('smooth');
    const lenis = new window.Lenis({
      lerp: 0.068, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.90, touchMultiplier: 1,
      // Điều hướng #anchor được xử lý tập trung bên dưới để luôn đo đúng L.offTop sau khi ghim cảnh
      anchors: false,
      allowNestedScroll: true, autoRaf: false, stopInertiaOnNavigate: true
    });
    L.lenis = lenis;
    // menu mở / lightbox: body overflow hidden → dừng cuộn trang phía sau
    let stopped = false;
    L.tick(st => {
      if (initHashActive && st) st.vy = 0;
      const want = document.body.style.overflow === 'hidden';
      if (want !== stopped) { stopped = want; want ? lenis.stop() : lenis.start(); }
    });
  }

  function resizeLenis() {
    if (L.lenis && L.lenis.dimensions && L.lenis.dimensions.resize) {
      L.lenis.dimensions.resize();
    }
  }

  function scrollTo(y, opt = {}) {
    resizeLenis();
    if (L.lenis) L.lenis.scrollTo(y, { duration: opt.duration || 1.1, easing: opt.easing || ease.inOut, immediate: !!opt.immediate, lock: !!opt.lock, force: opt.force !== undefined ? !!opt.force : true });
    else window.scrollTo({ top: y, behavior: opt.immediate ? 'auto' : 'smooth' });
  }

  function targetYForHash(hash) {
    if (!hash || hash === '#') return null;
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) return null;
    if (id === 'trang-chu' || id === 'top') return 0;
    const el = document.getElementById(id);
    if (!el) return null;
    const offset = document.body && document.body.classList.contains('kb') ? -96 : 0;
    return Math.max(0, L.offTop(el) + offset);
  }

  function revealHashSection(hash) {
    if (!hash || hash === '#') return;
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const el = id && document.getElementById(id);
    if (!el) return;
    const sec = el.closest('section') || el;
    sec.querySelectorAll('.rv, [data-split], .sec-head, .reveal-img').forEach(node => node.classList.add('is-in'));
    sec.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
    const nav = document.getElementById('nav');
    if (nav) nav.classList.remove('is-hidden');
  }

  function revealAtScrollY(y) {
    const vh = innerHeight;
    document.querySelectorAll('section, footer').forEach(sec => {
      const top = L.offTop(sec);
      const h = sec.offsetHeight || 1;
      if (y + vh * 1.4 >= top && y - vh * 0.6 <= top + h) {
        sec.querySelectorAll('.rv, [data-split], .sec-head, .reveal-img').forEach(node => node.classList.add('is-in'));
        sec.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
      }
    });
    if (y > 40) {
      const nav = document.getElementById('nav');
      if (nav) nav.classList.remove('is-hidden');
    }
  }

  function applyInitHash() {
    if (!initHashActive) return;
    if (document.body && document.body.classList.contains('is-loading')) {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
    }
    measure();
    const y = targetYForHash(initHash);
    if (y == null) return;
    resizeLenis();
    if (L.lenis) {
      if (document.body.style.overflow !== 'hidden') L.lenis.start();
      L.lenis.scrollTo(y, { immediate: true, force: true });
    }
    window.scrollTo(0, y);
    if (L.state) {
      L.state.y = y;
      L.state.vy = 0;
    }
    revealHashSection(initHash);
  }

  // Huỷ đồng bộ #hash ban đầu ngay khi người dùng chủ động cuộn hoặc tương tác
  const cancelInitHash = () => { initHashActive = false; };
  addEventListener('wheel', cancelInitHash, { passive: true });
  addEventListener('touchstart', cancelInitHash, { passive: true });
  addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) cancelInitHash();
  }, { passive: true });

  // Bắt sự kiện click vào các liên kết #hash cùng trang (thanh menu, menu di động, footer, mục lục...)
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const rawHref = a.getAttribute('href') || '';
    let hash = '';
    if (rawHref.startsWith('#')) {
      hash = rawHref;
    } else {
      try {
        const u = new URL(a.href, location.href);
        const normP = p => (p || '').replace(/\/index\.html$/i, '/') || '/';
        if (u.origin === location.origin && normP(u.pathname) === normP(location.pathname) && u.search === location.search && u.hash) {
          hash = u.hash;
        }
      } catch (_) {}
    }
    if (!hash || hash === '#') return;
    measure();
    const y = targetYForHash(hash);
    if (y == null) return;
    e.preventDefault();
    initHashActive = false;
    if (document.body.style.overflow === 'hidden' && !document.body.classList.contains('lb-open')) {
      document.body.style.overflow = '';
    }
    if (L.lenis) L.lenis.start();
    if (history.pushState) history.pushState(null, '', hash);
    else location.hash = hash;
    scrollTo(y, { duration: 1.05, force: true });
  });

  /* ---------------- three.js (tải lười) ---------------- */
  let threeP = null;
  function loadThree() {
    if (P.has('nogl')) return Promise.reject(new Error('nogl'));
    if (threeP) return threeP;
    threeP = new Promise((res, rej) => {
      if (window.THREE) return res(window.THREE);
      const s = document.createElement('script');
      s.src = 'js/vendor/three.min.js';
      s.async = true;
      s.onload = () => (window.THREE ? res(window.THREE) : rej(new Error('three')));
      s.onerror = rej;
      document.head.appendChild(s);
    }).then(THREE => {
      const canvas = document.createElement('canvas');
      canvas.className = 'st-gl';
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch (e) { html.classList.add('st-nogl'); throw e; }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      const dprCap = matchMedia('(max-width: 760px)').matches ? 1.2 : 1.35;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      S.gl = { THREE, renderer, canvas, owner: null, w: 0, h: 0 };
      return S.gl;
    });
    threeP.catch(() => html.classList.add('st-nogl'));
    return threeP;
  }

  function sizeGL(host, cw, ch) {
    const g = S.gl;
    const w = cw || host.clientWidth || innerWidth, h = ch || host.clientHeight || innerHeight;
    if (w && h && (w !== g.w || h !== g.h)) { g.w = w; g.h = h; g.renderer.setSize(w, h, false); return true; }
    return false;
  }

  /* ---------------- Cảnh ---------------- */
  // def: { el, len (màn hình ghim thêm), init(sc), update(sc, st), gl: { host, init(gl, sc), render(gl, sc, st) }, snaps: [p] | snapTo(p), onEnter, onLeave }
  function add(def) {
    const sc = Object.assign({ p: 0, e: 0, x: 0, top: 0, h: 1, span: 0, vis: false, near: false, inited: false, glReady: false, frac: 0, snapped: true }, def);
    if (sc.len) {
      const el = sc.el;
      el.classList.add('st-pin');
      el.style.setProperty('--st-len', sc.len);
      if (!sc.sticky) {
        const sticky = document.createElement('div');
        sticky.className = 'st-sticky';
        while (el.firstChild) sticky.appendChild(el.firstChild);
        el.appendChild(sticky);
        sc.sticky = sticky;
      }
    }
    S.scenes.push(sc);
    return sc;
  }
  // bỏ ghim (vd. máy không có WebGL): trả nội dung về chỗ cũ, cảnh không còn chạy
  S.unpin = sc => {
    const el = sc.el;
    if (sc.sticky && sc.sticky.classList.contains('st-sticky')) { while (sc.sticky.firstChild) el.insertBefore(sc.sticky.firstChild, sc.sticky); sc.sticky.remove(); }
    el.classList.remove('st-pin', 'st-live');
    el.style.removeProperty('--st-len');
    const i = S.scenes.indexOf(sc);
    if (i >= 0) S.scenes.splice(i, 1);
  };

  // phần tử chạy theo cuộn (không ghim): fn(q) với q = 0 khi mép trên chạm đáy màn hình, 1 khi mép dưới chạm đỉnh
  const tracks = [];
  function track(el, fn, opt = {}) {
    const t = { el, fn, top: 0, h: 1, q: -1, inView: false, pad: opt.pad || 0 };
    tracks.push(t);
    measureTrack(t);
    return t;
  }
  function measureTrack(t) { t.top = L.offTop(t.el); t.h = t.el.offsetHeight || 1; t.q = -1; }

  function measure() {
    const vh = innerHeight;
    S.vh = vh; S.vw = innerWidth;
    S.scenes.forEach(sc => {
      sc.top = L.offTop(sc.el);
      sc.h = sc.el.offsetHeight || 1;
      sc.span = sc.len ? Math.max(1, sc.h - vh) : sc.h + vh;
      sc.lastP = -1;
      if (sc.gl && sc.gl.host) {
        sc.glW = sc.gl.host.clientWidth || innerWidth;
        sc.glH = sc.gl.host.clientHeight || vh;
      }
      if (sc.measure) sc.measure(sc);
    });
    tracks.forEach(measureTrack);
    resizeLenis();
    if (S.gl && S.gl.owner && S.gl.owner.gl.host) sizeGL(S.gl.owner.gl.host, S.gl.owner.glW, S.gl.owner.glH);
  }

  function initScene(sc) {
    sc.inited = true;
    if (sc.init) { sc.init(sc); requestAnimationFrame(measure); }
    if (sc.gl) {
      loadThree().then(g => {
        sc.gl.init(g, sc);
        sc.glReady = true;
        sc.el.classList.add('st-gl-on');
        // biên dịch shader + tải texture lên GPU ngay (song song nếu trình duyệt hỗ trợ), không đợi lần vẽ đầu
        const t = sc.three;
        if (t && t.scene && t.cam && g.renderer.compileAsync) g.renderer.compileAsync(t.scene, t.cam).catch(() => {});
      }).catch(e => {
        if (debug) console.warn('[stage] no WebGL for', sc.el.id, e);
        if (sc.glFail) { sc.glFail(sc); requestAnimationFrame(measure); }
      });
    }
  }

  let lastOwner = null, idle = 0, dbg = null;
  function frame(st) {
    if (initHashActive) {
      if (performance.now() > initHashUntil) {
        initHashActive = false;
      } else {
        const wantY = targetYForHash(initHash);
        if (wantY != null && Math.abs(window.scrollY - wantY) > 2) {
          applyInitHash();
          st.y = window.scrollY;
        }
      }
    }
    const y = st.y, vh = st.vh || innerHeight;
    let best = null, bestFrac = 0;
    for (let i = 0; i < S.scenes.length; i++) {
      const sc = S.scenes[i];
      const rel = y - sc.top;
      sc.vis = rel > -vh && rel < sc.h;
      sc.near = rel > -vh * 3 && rel < sc.h + vh;
      if (sc.near && !sc.inited) initScene(sc);
      if (!sc.inited) continue;
      sc.p = sc.len ? clamp(rel / sc.span) : clamp((rel + vh) / sc.span);
      sc.e = clamp((rel + vh) / vh);
      sc.x = sc.len ? clamp((rel - sc.span) / vh) : clamp((rel - sc.h + vh) / vh);
      // phần màn hình cảnh đang chiếm (để chọn ai giữ canvas 3D)
      sc.frac = sc.vis ? (Math.min(y + vh, sc.top + sc.h) - Math.max(y, sc.top)) / vh : 0;
      if (sc.vis !== sc.wasVis) {
        sc.wasVis = sc.vis;
        sc.el.classList.toggle('st-live', sc.vis);
        if (sc.vis && sc.onEnter) sc.onEnter(sc);
        if (!sc.vis && sc.onLeave) sc.onLeave(sc);
      }
      if (sc.vis && sc.update) sc.update(sc, st);
      if (sc.gl && sc.glReady && sc.vis && sc.frac > bestFrac && (!sc.gl.when || sc.gl.when(sc))) { best = sc; bestFrac = sc.frac; }
    }
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const q = clamp((y + vh - t.top) / (vh + t.h));
      const inView = y + vh > t.top - t.pad && y < t.top + t.h + t.pad;
      if (!inView && !t.inView) continue;
      t.inView = inView;
      if (Math.abs(q - t.q) > 0.0004) { t.q = q; t.fn(q, t); }
    }
    // canvas 3D: chuyển sang cảnh đang chiếm màn hình nhiều nhất
    const g = S.gl;
    if (g) {
      if (best !== lastOwner) {
        if (lastOwner && lastOwner.gl.leave) lastOwner.gl.leave(g, lastOwner);
        lastOwner = best;
        g.owner = best;
        g.canvas.style.opacity = '';
        if (best) {
          best.gl.host.appendChild(g.canvas);
          sizeGL(best.gl.host, best.glW, best.glH);
          best.gl.dirty = true;
          if (best.gl.enter) best.gl.enter(g, best);
        } else if (g.canvas.parentNode) g.canvas.parentNode.removeChild(g.canvas);
      }
      if (best) best.gl.render(g, best, st);
    }
    // Chỉ bật bắt dính tự động khi có ?snap trên URL để tránh giằng con lăn chuột gây cảm giác khựng như lenis.dev
    if (L.lenis && P.has('snap')) {
      if (L.lenis.isScrolling) { idle = 0; S.scenes.forEach(sc => (sc.snapped = false)); }
      else {
        idle += st.dt;
        if (idle > 0.16) S.scenes.forEach(sc => {
          if (sc.snapped || !(sc.snaps || sc.snapTo) || !sc.vis || sc.p <= 0 || sc.p >= 1) return;
          sc.snapped = true;
          let bestP = null, bd = 1e9;
          // snapTo(p): cảnh tự quyết điểm dừng (null = để yên); snaps: bắt về mốc gần nhất
          if (sc.snapTo) { bestP = sc.snapTo(sc.p); if (bestP != null) bd = Math.abs(bestP - sc.p) * sc.span; }
          else sc.snaps.forEach(s => { const d = Math.abs(s - sc.p) * sc.span; if (d < bd) { bd = d; bestP = s; } });
          if (bestP != null && bd > 2 && bd < vh * 0.42) scrollTo(sc.top + bestP * sc.span, { duration: 0.9 });
        });
      }
    }
    if (dbg) dbg.textContent = S.scenes.filter(s => s.vis).map(s => `${s.el.id} p=${s.p.toFixed(3)} e=${s.e.toFixed(2)} x=${s.x.toFixed(2)}${s === lastOwner ? ' [GL]' : ''}`).join('\n');
  }

  // Chạy đồng bộ ở pha bubble trên window ngay sau khi tất cả listener DOMContentLoaded của các cảnh (dom.js, showcase.min.js...) đã ghim xong
  addEventListener('DOMContentLoaded', () => {
    measure();
    if (initHashActive) applyInitHash();
    else if (isPtIn || isLangSwitch) {
      if (L.lenis) L.lenis.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
      if (L.state) { L.state.y = 0; L.state.vy = 0; }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    // các script cảnh (js/scenes/*.js) đăng ký trong DOMContentLoaded của chúng — đo sau đó một nhịp
    requestAnimationFrame(() => {
      measure();
      if (initHashActive) applyInitHash();
      else if (isLangSwitch) {
        if (L.lenis) L.lenis.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
        if (L.state) { L.state.y = 0; L.state.vy = 0; }
      }
      L.tick(frame);
      if (isPtIn && window.__ltvOpenPt) {
        const openAfterReady = () => {
          requestAnimationFrame(() => {
            measure();
            if (initHashActive) applyInitHash();
            setTimeout(() => {
              if (initHashActive) applyInitHash();
              if (window.__ltvOpenPt) window.__ltvOpenPt();
            }, 75);
          });
        };
        if (scCss && !scCss.sheet) {
          let opened = false;
          const go = () => { if (!opened) { opened = true; openAfterReady(); } };
          scCss.addEventListener('load', go, { once: true });
          setTimeout(go, 160);
        } else {
          openAfterReady();
        }
      }
    });
    L.onLayout(() => {
      measure();
      if (initHashActive) applyInitHash();
    });
    L.onResize(measure);
    if (scCss) scCss.addEventListener('load', () => { if (initHashActive) applyInitHash(); });
    addEventListener('load', () => {
      if (initHashActive) {
        applyInitHash();
        initHashUntil = Math.min(initHashUntil, performance.now() + 380);
      }
    });
    L.on('ready', () => { if (initHashActive) applyInitHash(); });
    if (debug) {
      dbg = document.createElement('pre'); dbg.className = 'st-dbg'; document.body.appendChild(dbg);
      // kiểm thử: nhảy thẳng tới tiến độ p của một cảnh rồi chờ (dùng trong công cụ chụp ảnh)
      S.goP = async (id, p, wait = 1200) => {
        const sc = S.scenes.find(s => s.el.id === id);
        const y = sc.top + p * (sc.len ? sc.span : sc.h);
        if (L.lenis) L.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
        const hold = () => S.scenes.forEach(s => (s.snapped = true)); // ảnh chụp đúng p, không bị bắt dính
        hold(); setTimeout(hold, 100);
        await new Promise(res => setTimeout(res, wait));
        return { y: Math.round(window.scrollY), p: +sc.p.toFixed(3), gl: sc.glReady, owner: S.gl && S.gl.owner ? S.gl.owner.el.id : null };
      };
      // nhảy tới mép trên của phần tử + k màn hình (cho các section không ghim)
      S.goEl = async (sel, k, wait = 1200) => {
        const el = document.querySelector(sel);
        const y = L.offTop(el) + k * innerHeight;
        if (L.lenis) L.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
        S.scenes.forEach(s => (s.snapped = true));
        await new Promise(res => setTimeout(res, wait));
        return { y: Math.round(window.scrollY) };
      };
    }
    // tải trước three.js khi trang đã rảnh sau màn chào (người xem còn đang ở hero), rồi dựng sẵn từng cảnh 3D
    // vào các khoảng rảnh kế tiếp — để không cảnh nào phải khởi tạo giữa lúc đang cuộn (gây khựng một nhịp)
    const idle = (fn, t) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, 60));
    L.on('ready', () => idle(() => {
      if (!S.scenes.some(sc => sc.gl)) return;
      loadThree().then(() => {
        const queue = S.scenes.filter(sc => sc.gl && !sc.inited);
        const next = () => { const sc = queue.shift(); if (!sc) return; if (!sc.inited) initScene(sc); idle(next, 1500); };
        idle(next, 1500);
      }).catch(() => {});
    }, 4000));
  });
})();
