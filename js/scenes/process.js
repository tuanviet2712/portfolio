/* ==========================================================================
   CẢNH ⑤ — QUY TRÌNH TRIỂN KHAI: PHIM 3D TUA THEO CUỘN (Desktop WebCodecs + Mobile WebP 3D Seq)
   - Máy tính (>= 1025px): Phim 1920x1080 643 khung (WebCodecs + WebGL2 Lanczos-2)
   - Điện thoại / Tablet (<= 1024px): Chuỗi 300 khung WebP 3D cắt dọc (assets/process/seq/tall/ 960x1080)
     siêu nhẹ (~40KB/khung), tải theo cửa sổ trượt quanh vị trí cuộn, 60fps mượt mà không nóng máy.
   - Toàn bộ giao diện (tiêu đề 1 dòng, bộ đếm 01/06, thẻ kính mờ căn đều 2 bên, thanh tiến trình 6 bước)
     đồng bộ 100% cho cả tiếng Việt (index.html) và tiếng Anh (?lang=en).
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const S = L && L.stage;
  if (!S || S.off) return;
  const { $, $$, clamp } = L;
  const { ease } = S;

  const N = 6;
  const DAMP_T = 20.0;
  const VMAX = 450;

  const isDesktop = () => matchMedia('(min-width: 1025px)').matches;
  const CFG = {
    len: isDesktop() ? 8.0 : 5.2,
    pad: 0.032
  };

  function stepPos(p) {
    const c = clamp(p);
    if (c <= CFG.pad) return 0;
    if (c >= 1 - CFG.pad) return N - 1;
    return ((c - CFG.pad) / (1 - 2 * CFG.pad)) * (N - 1);
  }

  function holdP(i) {
    if (i <= 0) return CFG.pad * 0.45;
    if (i >= N - 1) return 1 - CFG.pad * 0.45;
    return CFG.pad + (i / (N - 1)) * (1 - 2 * CFG.pad);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!isDesktop()) return;
    const el = $('#quy-trinh');
    if (!el) return;
    const sticky = $('.process__sticky', el);
    if (!sticky) return;

    el.classList.add('pfx', 'st-gl-on');

    const ui = initUI(el);
    const onSync = (sRender, sPos, eRaw, dt) => {
      sc.s = sRender;
      ui.set(sRender, sPos, eRaw, dt);
    };
    const player = createFilmPlayer(el, sticky, onSync);

    const sc = S.add({
      el,
      len: CFG.len,
      sticky,
      s: 0,
      init() {
        player.mount();
        player.preload();
      },
      measure() {
        ui.measure();
        player.measure();
      },
      onEnter(sc) {
        ui.onEnter(sc.p, sc.e);
        player.wake(sc.e, sc.p);
      },
      onLeave() {
        ui.onLeave();
        player.sleep();
      },
      update(sc, st) {
        const goalP = L.lenis ? clamp((L.lenis.targetScroll - sc.top) / sc.span) : null;
        player.step(sc.p, st, sc.e, goalP);
      }
    });

    player.mount();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ui.measure());
    }
    const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1800 }) : setTimeout(fn, 120));
    L.on('ready', () => idle(() => player.preload()));

    ui.bind(i => {
      const dist = Math.abs(i - Math.round(sc.s || 0));
      S.scrollTo(sc.top + holdP(i) * sc.span, { duration: Math.min(2.1, 0.9 + dist * 0.25) });
    });
  });

  /* ==========================================================================
     PHẦN GIAO DIỆN HTML/CSS ĐỒNG BỘ THEO TIẾN ĐỘ CUỘN s (0..5)
     ========================================================================== */
  function initUI(el) {
    const steps = $$('.pstep', el);
    const nodes = $$('.pnode', el);
    const count = $('[data-step-count]', el);
    const line = $('.pflow__line', el);
    const title = $('#process-title', el);

    if (title && isDesktop()) {
      title.removeAttribute('data-fit');
      title.style.fontSize = '';
    }

    let countTrack = null;
    if (count) {
      count.classList.add('process__count-reel');
      countTrack = document.createElement('span');
      countTrack.className = 'process__count-track';
      for (let i = 0; i < N; i++) {
        const item = document.createElement('b');
        item.textContent = String(i + 1).padStart(2, '0');
        countTrack.appendChild(item);
      }
      count.textContent = '';
      count.appendChild(countTrack);
    }

    function splitStepOuts() {
      steps.forEach(st => {
        const oldK = $('.pstep__k', st);
        if (oldK) oldK.remove();
        const stTitle = $('.pstep__title', st);
        if (stTitle) stTitle.setAttribute('data-fit', '');
        const out = $('.pstep__out', st);
        if (out && !$('.pstep__out-k', out)) {
          const txt = out.textContent || '';
          const j = txt.indexOf(':');
          if (j > 0) {
            const a = document.createElement('span');
            const b = document.createElement('span');
            a.className = 'pstep__out-k';
            a.textContent = txt.slice(0, j).trim();
            b.className = 'pstep__out-v';
            b.textContent = txt.slice(j + 1).trim();
            out.textContent = '';
            out.append(a, b);
          }
        }
      });
    }
    splitStepOuts();

    const GRAD_STOPS = [
      [0.00, 168, 208, 255],
      [0.48,  91, 156, 255],
      [1.00,  27,  92, 242]
    ];
    let chars = [];
    let wantTitle = false;
    let titleDir = -1;
    let waveTimer = 99;
    let titleSettled = false;

    function sampleGradRGB(t) {
      const x = clamp(t, 0, 1);
      const s0 = x <= 0.48 ? GRAD_STOPS[0] : GRAD_STOPS[1];
      const s1 = x <= 0.48 ? GRAD_STOPS[1] : GRAD_STOPS[2];
      const u = clamp((x - s0[0]) / (s1[0] - s0[0]));
      const e = u * u * (3 - 2 * u);
      return [
        Math.round(s0[1] + (s1[1] - s0[1]) * e),
        Math.round(s0[2] + (s1[2] - s0[2]) * e),
        Math.round(s0[3] + (s1[3] - s0[3]) * e)
      ];
    }

    function mixSheen(rgb, sheen) {
      if (sheen <= 0.005) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      const r = Math.round(rgb[0] + (250 - rgb[0]) * sheen);
      const g = Math.round(rgb[1] + (253 - rgb[1]) * sheen);
      const b = Math.round(rgb[2] + (255 - rgb[2]) * sheen);
      return `rgb(${r},${g},${b})`;
    }

    function splitGraphemes(str) {
      const s = str.normalize('NFC');
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(s), x => x.segment);
      }
      return Array.from(s);
    }

    function setupTitleChars() {
      if (!title || !isDesktop()) return;
      const wordList = [];
      const existingW = $$('.w__in', title);
      if (existingW.length) {
        existingW.forEach(w => {
          const t = (w.textContent || '').trim();
          if (t) wordList.push({ text: t, grad: w.classList.contains('grad') });
        });
      } else {
        const walk = (node, g) => {
          Array.from(node.childNodes).forEach(ch => {
            if (ch.nodeType === 3) {
              (ch.textContent || '').trim().split(/\s+/).filter(Boolean).forEach(t => wordList.push({ text: t, grad: g }));
            } else if (ch.nodeType === 1) {
              walk(ch, g || ch.classList.contains('grad'));
            }
          });
        };
        walk(title, false);
      }
      if (!wordList.length) return;

      title.setAttribute('aria-label', wordList.map(w => w.text).join(' '));
      title.removeAttribute('data-split');
      title.classList.remove('split', 'is-in');
      title.classList.add('ptitle-chars');
      title.textContent = '';
      chars = [];

      wordList.forEach((w, wi) => {
        if (wi > 0) title.appendChild(document.createTextNode(' '));
        const wSpan = document.createElement('span');
        wSpan.className = 'pword';
        wSpan.setAttribute('aria-hidden', 'true');
        splitGraphemes(w.text).forEach(ch => {
          const cSpan = document.createElement('span');
          cSpan.className = 'pchar__in' + (w.grad ? ' grad' : '');
          cSpan.textContent = ch;
          wSpan.appendChild(cSpan);
          chars.push({ el: cSpan, grad: w.grad, nx: 0, u: 0, u0: 0, rgb0: null, rgb1: null, baseGrad: '' });
        });
        title.appendChild(wSpan);
      });

      measureTitleChars();
      applyCharPose(0, 1, true);
    }

    function measureTitleChars() {
      if (L.fit) L.fit(el);
      if (!chars.length) return;
      const n = chars.length;
      const minX = chars[0].el.offsetLeft;
      const lastEl = chars[n - 1].el;
      const maxX = lastEl.offsetLeft + lastEl.offsetWidth;
      const spanX = Math.max(1, maxX - minX);

      chars.forEach((c, i) => {
        const cx = c.el.offsetLeft + c.el.offsetWidth * 0.5;
        const phys = clamp((cx - minX) / spanX);
        const idx = n > 1 ? i / (n - 1) : 0;
        c.nx = 0.60 * phys + 0.40 * idx;
      });

      const gradChars = chars.filter(c => c.grad);
      if (gradChars.length) {
        const gMin = gradChars[0].el.offsetLeft;
        const gLast = gradChars[gradChars.length - 1].el;
        const gSpan = Math.max(1, (gLast.offsetLeft + gLast.offsetWidth) - gMin);
        gradChars.forEach(c => {
          const t0 = clamp((c.el.offsetLeft - gMin) / gSpan);
          const t1 = clamp((c.el.offsetLeft + c.el.offsetWidth - gMin) / gSpan);
          c.rgb0 = sampleGradRGB(t0);
          c.rgb1 = sampleGradRGB(t1);
          c.baseGrad = `linear-gradient(92deg, ${mixSheen(c.rgb0, 0)} 0%, ${mixSheen(c.rgb1, 0)} 100%)`;
          c.el.style.backgroundImage = c.baseGrad;
        });
      }
      titleSettled = false;
    }

    function applyCharPose(timer, dir, forceHidden = false) {
      if (!chars.length) return;
      const stagger = dir > 0 ? 0.32 : 0.24;
      const dur = dir > 0 ? 0.66 : 0.48;
      let allDone = true;

      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const localT = forceHidden ? 0 : clamp((timer - c.nx * stagger) / dur);
        if (localT < 0.999) allDone = false;

        if (dir > 0) {
          const u = forceHidden ? 0 : (c.u0 + (1 - c.u0) * localT);
          c.u = u;
          if (u >= 0.999) {
            if (c.el.style.transform) c.el.style.transform = '';
            if (c.el.style.opacity) c.el.style.opacity = '';
            if (c.lastBlur !== 0) { c.el.style.filter = ''; c.lastBlur = 0; }
            continue;
          }
          const inv = 1 - u;
          const easeOut = 1 - Math.pow(inv, 4.4);
          const ty = (1 - easeOut) * 42;
          const sc = 0.94 + 0.06 * easeOut;
          const op = 1 - Math.pow(inv, 2.8);
          const qBlur = Math.round(Math.pow(1 - easeOut, 1.85) * 8.0 * 2) * 0.5;

          c.el.style.transform = `translate3d(0, ${ty.toFixed(1)}%, 0) scale(${sc.toFixed(3)})`;
          c.el.style.opacity = op.toFixed(2);
          if (c.lastBlur !== qBlur) {
            c.lastBlur = qBlur;
            c.el.style.filter = qBlur > 0.2 ? `blur(${qBlur}px)` : '';
          }
        } else {
          const u = c.u0 * (1 - localT);
          c.u = u;
          if (u <= 0.001) {
            c.el.style.transform = 'translate3d(0, -44%, 0) scale(0.95)';
            c.el.style.opacity = '0';
            if (c.lastBlur !== 0) { c.el.style.filter = ''; c.lastBlur = 0; }
            continue;
          }
          const w = 1 - u;
          const easeInOut = w < 0.5 ? 4 * w * w * w : 1 - Math.pow(-2 * w + 2, 3) / 2;
          const ty = -easeInOut * 44;
          const sc = 1 - easeInOut * 0.05;
          const op = Math.pow(1 - w, 1.9);
          const qBlur = Math.round(Math.pow(w, 1.5) * 7.0 * 2) * 0.5;

          c.el.style.transform = `translate3d(0, ${ty.toFixed(1)}%, 0) scale(${sc.toFixed(3)})`;
          c.el.style.opacity = op.toFixed(2);
          if (c.lastBlur !== qBlur) {
            c.lastBlur = qBlur;
            c.el.style.filter = qBlur > 0.2 ? `blur(${qBlur}px)` : '';
          }
        }
      }

      if (allDone && !forceHidden) {
        titleSettled = true;
      }
    }

    function triggerTitle(show) {
      if (show === wantTitle) return;
      wantTitle = show;
      titleDir = show ? 1 : -1;
      waveTimer = 0;
      titleSettled = false;
      for (let i = 0; i < chars.length; i++) {
        chars[i].u0 = show ? 0 : chars[i].u;
      }
      if (title) title.style.pointerEvents = show ? '' : 'none';
    }

    setupTitleChars();

    function stepTitle(sPos, eRaw, dt) {
      if (!chars.length) return;
      const inView = eRaw == null || eRaw > 0.16;
      const atEnds = sPos < 0.14 || sPos > N - 1 - 0.18;
      const shouldShow = inView && atEnds;

      if (shouldShow !== wantTitle) {
        triggerTitle(shouldShow);
      }

      if (!titleSettled) {
        waveTimer += L.reduced ? 10 : dt;
        applyCharPose(waveTimer, titleDir, false);
      }
    }

    function onEnter(pRaw, eRaw) {
      if (!chars.length) return;
      if ((pRaw == null || pRaw < 0.03) && (eRaw == null || eRaw < 0.45)) {
        wantTitle = false;
        titleDir = -1;
        titleSettled = false;
        for (let i = 0; i < chars.length; i++) {
          chars[i].u = 0;
          chars[i].u0 = 0;
        }
        applyCharPose(0, 1, true);
      }
    }

    function onLeave() {
      if (!chars.length) return;
      wantTitle = false;
      titleDir = -1;
      titleSettled = false;
      for (let i = 0; i < chars.length; i++) {
        chars[i].u = 0;
        chars[i].u0 = 0;
      }
      applyCharPose(0, 1, true);
    }

    let lastCur = -1, lastPP = -1, lastReel = -1;
    const lastO = steps.map(() => -1);

    function set(s, sPos = s, eRaw = 1, dt = 0.016) {
      stepTitle(sPos, eRaw, dt);
      const cur = Math.min(N - 1, Math.round(s));
      if (cur !== lastCur) {
        lastCur = cur;
        steps.forEach((st, i) => st.classList.toggle('is-current', i === cur));
        nodes.forEach((nd, i) => {
          nd.classList.toggle('is-on', i <= cur);
          nd.classList.toggle('is-current', i === cur);
          nd.setAttribute('aria-selected', String(i === cur));
        });
      }

      if (countTrack && cur !== lastReel) {
        lastReel = cur;
        countTrack.style.transform = `translate3d(0, ${(-cur * (100 / N)).toFixed(3)}%, 0)`;
      }

      const pp = Math.round((s / (N - 1)) * 1e4) / 1e4;
      if (pp !== lastPP && line) {
        lastPP = pp;
        line.style.setProperty('--pp', pp);
      }

      steps.forEach((st, i) => {
        const d = s - i;
        const o = Math.round(ease.out(clamp(1 - Math.abs(d) / 0.52)) * 1000) / 1000;
        if (o === lastO[i]) return;
        lastO[i] = o;
        st.style.opacity = o;
        if (o >= 0.998) {
          st.style.transform = 'none';
        } else {
          const ty = ((d < 0 ? 1 : -1) * 16 * (1 - o)).toFixed(2);
          st.style.transform = `translate3d(0, ${ty}px, 0)`;
        }
        st.style.visibility = o <= 0.002 ? 'hidden' : '';
      });
    }

    function bind(go) {
      nodes.forEach((b, i) => b.addEventListener('click', () => go(i)));
    }

    L.processRefreshLang = () => {
      splitStepOuts();
      setupTitleChars();
    };

    return { set, bind, measure: measureTitleChars, onEnter, onLeave };
  }

  /* ==========================================================================
     BỘ PHÁT CHUỖI KHUNG WEBP 3D SIÊU NHẸ CHO ĐIỆN THOẠI & TABLET (<= 1024px)
     Sử dụng assets/process/seq/scene.js + assets/process/seq/tall/*.webp (960x1080)
     ========================================================================== */
  function createMobileSeqPlayer(secEl, sticky, onSync) {
    const BASE = 'assets/process/seq/';
    const LEVELS = [8, 4, 2, 1];
    const PAR = 3;
    const MAX_DEC = 2;
    const KEEP = 26;
    const TALL_NUM_CX = 515; // tâm ngang khối số 3D trong khung tall 960x1080 (x0=60)
    const TALL_NUM_CY = 510; // tâm dọc khối số 3D trong khung 1080

    let host = null, canvas = null, ctx = null, visible = false;
    let W = 1, H = 1, cw = 1, ch = 1, dpr = 1;
    let seq = null, frames = [], stops = [0, 143, 280, 369, 458, 594];
    let started = false, inflight = 0, inflightDec = 0, decoded = [];
    let curT = 0, prevT = 0, dir = 1, snap = true, dirty = true, lastShownIdx = -1;
    let bgGrad = null;

    const pad3 = i => String(i).padStart(3, '0');

    function mount() {
      if (host) return;
      host = document.createElement('div');
      host.className = 'pfx-gl pfx-film pfx-film--mobile';
      host.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'pfx-canvas';
      canvas.style.opacity = '0';
      host.appendChild(canvas);
      sticky.insertBefore(host, sticky.firstChild);
      ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d', { alpha: false });
      host.style.backgroundImage = `url("${BASE}poster.webp"), linear-gradient(180deg, #01132E 0%, #010D22 52%, #020816 100%)`;
      host.style.backgroundSize = 'cover, 100% 100%';
      host.style.backgroundPosition = '50% 18%, 0 0';
      host.style.backgroundRepeat = 'no-repeat';
      measure();
    }

    function measure() {
      if (!canvas || !host) return;
      const r = host.getBoundingClientRect();
      W = Math.max(1, r.width || innerWidth);
      H = Math.max(1, r.height || innerHeight);
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.2));
      cw = Math.round(W * dpr);
      ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        bgGrad = null;
      }
      dirty = true;
      if (lastShownIdx >= 0 && frames[lastShownIdx] && frames[lastShownIdx].bmp) {
        drawFrame(frames[lastShownIdx]);
      }
    }

    function lowerBound(arr, t) {
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (arr[m].i < t) lo = m + 1;
        else hi = m;
      }
      return lo;
    }

    let manifestP = null;
    function loadManifest() {
      if (manifestP) return manifestP;
      manifestP = new Promise((res, rej) => {
        if (window.PROCESS_SEQ) return res(window.PROCESS_SEQ);
        const sc = document.createElement('script');
        sc.src = BASE + 'scene.js';
        sc.async = true;
        sc.onload = () => (window.PROCESS_SEQ ? res(window.PROCESS_SEQ) : rej(new Error('PROCESS_SEQ')));
        sc.onerror = () => rej(new Error('process scene.js'));
        document.head.appendChild(sc);
      }).then(s => {
        seq = s;
        stops = s.stops || stops;
        const def = (s.sets && s.sets.tall) || (s.sets && s.sets.full);
        const idx = def.frames || Array.from({ length: s.n }, (_, i) => i);
        const stopSet = new Set(stops);
        frames = idx.map((i, k) => ({
          i, k,
          url: BASE + def.dir + pad3(i) + '.webp',
          // Ưu tiên tải 6 khung trạm dừng (01..06) đầu tiên (rank = -1)
          rank: stopSet.has(i) ? -1 : Math.max(0, LEVELS.findIndex(lv => i % lv === 0)),
          src: null, bmp: null, busy: null, loaded: false, queued: false, wanted: stopSet.has(i), failed: false
        }));
        markWindow(curT, 16, 6);
        pumpFetch();
        return s;
      });
      manifestP.catch(e => console.warn('Process mobile seq:', e && e.message));
      return manifestP;
    }

    function loadImg(url) {
      return new Promise((res, rej) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => res(im);
        im.onerror = () => rej(new Error(url));
        im.src = url;
      });
    }

    function fetchOne(f) {
      if (location.protocol === 'file:' || typeof fetch !== 'function') return loadImg(f.url);
      return fetch(f.url).then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).catch(() => loadImg(f.url));
    }

    function decodeOne(f) {
      if (f.bmp) return Promise.resolve(f.bmp);
      if (f.busy) return f.busy;
      if (!f.loaded || !f.src) return Promise.reject();
      inflightDec++;
      const done = bmp => {
        f.bmp = bmp;
        f.busy = null;
        inflightDec = Math.max(0, inflightDec - 1);
        decoded.push(f);
        dirty = true;
        return bmp;
      };
      const fail = () => {
        f.busy = null;
        inflightDec = Math.max(0, inflightDec - 1);
        f.failed = true;
      };
      let p;
      if (typeof createImageBitmap === 'function' && !(f.src instanceof HTMLImageElement)) {
        p = createImageBitmap(f.src).then(done, fail);
      } else if (f.src instanceof HTMLImageElement) {
        p = Promise.resolve(done(f.src));
      } else {
        const u = URL.createObjectURL(f.src);
        p = loadImg(u).then(im => { URL.revokeObjectURL(u); return done(im); }, () => { URL.revokeObjectURL(u); fail(); });
      }
      f.busy = p;
      return p;
    }

    function markWindow(t, ahead, behind) {
      if (!frames.length) return;
      const hi = Math.min(frames.length - 1, lowerBound(frames, t));
      const lo = Math.max(0, hi - behind);
      const end = Math.min(frames.length - 1, hi + ahead);
      for (let k = lo; k <= end; k++) frames[k].wanted = true;
    }

    function pumpFetch() {
      if (!frames.length) return;
      while (inflight < PAR) {
        let best = null, bs = Infinity;
        for (let k = 0; k < frames.length; k++) {
          const f = frames[k];
          if (f.queued || !f.wanted || f.failed) continue;
          const score = (f.rank + 1) * 180 + Math.abs(f.i - curT);
          if (score < bs) { bs = score; best = f; }
        }
        if (!best) break;
        best.queued = true;
        inflight++;
        fetchOne(best).then(obj => {
          best.src = obj;
          best.loaded = true;
          return decodeOne(best);
        }, () => { best.failed = true; }).then(() => {
          inflight = Math.max(0, inflight - 1);
          dirty = true;
          pumpFetch();
        });
      }
    }

    function schedule(t, d) {
      if (!frames.length) return;
      markWindow(t, d >= 0 ? 18 : 8, d >= 0 ? 6 : 16);
      pumpFetch();
      const hi = Math.min(frames.length - 1, lowerBound(frames, t));
      const cands = [];
      for (let k = Math.max(0, hi - 6); k <= Math.min(frames.length - 1, hi + 10); k++) {
        const f = frames[k];
        if (f.loaded && !f.bmp && !f.busy) cands.push(f);
      }
      cands.sort((a, b) => Math.abs(a.i - t) - Math.abs(b.i - t));
      for (let c = 0; c < cands.length && inflightDec < MAX_DEC; c++) {
        decodeOne(cands[c]);
      }
      const stopSet = new Set(stops);
      for (let k = decoded.length - 1; k >= 0; k--) {
        const f = decoded[k];
        if (!stopSet.has(f.i) && Math.abs(f.k - hi) > KEEP) {
          if (f.bmp && typeof f.bmp.close === 'function') f.bmp.close();
          f.bmp = null;
          decoded.splice(k, 1);
        }
      }
    }

    function findBestFrame(t) {
      if (!frames.length) return null;
      const hi = Math.min(frames.length - 1, lowerBound(frames, t));
      let best = null, bd = Infinity;
      for (let r = 0; r < 60; r++) {
        const i1 = hi - r, i2 = hi + r;
        if (i1 >= 0 && frames[i1].bmp) {
          const d = Math.abs(frames[i1].i - t);
          if (d < bd) { bd = d; best = frames[i1]; }
        }
        if (i2 < frames.length && frames[i2].bmp) {
          const d = Math.abs(frames[i2].i - t);
          if (d < bd) { bd = d; best = frames[i2]; }
        }
        if (best && bd <= 8) break;
      }
      return best;
    }

    function drawFrame(f) {
      if (!ctx || !f || !f.bmp) return false;
      if (!bgGrad) {
        bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
        bgGrad.addColorStop(0, '#011534');
        bgGrad.addColorStop(0.55, '#010E25');
        bgGrad.addColorStop(1, '#020612');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      const sw = f.bmp.width || 960;
      const sh = f.bmp.height || 1080;
      // Đặt khối số 3D (tâm tại TALL_NUM_CX, TALL_NUM_CY) nằm nổi bật ở vùng trung tâm phía trên thẻ kính
      const scale = Math.max(W / sw, (H * 0.62) / sh);
      const dw = Math.round(sw * scale * dpr);
      const dh = Math.round(sh * scale * dpr);
      const targetX = W * 0.50;
      const targetY = H * 0.31;
      const dx = Math.round((targetX - TALL_NUM_CX * scale) * dpr);
      const dy = Math.round((targetY - TALL_NUM_CY * scale) * dpr);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(f.bmp, 0, 0, sw, sh, dx, dy, dw, dh);

      // Mép dưới khung ảnh 3D hoà mượt vào nền tối phía dưới thẻ kính
      const fadeTop = Math.max(0, dy + dh * 0.68);
      const fadeBot = Math.min(ch, dy + dh + 4);
      if (fadeBot > fadeTop) {
        const fg = ctx.createLinearGradient(0, fadeTop, 0, fadeBot);
        fg.addColorStop(0, 'rgba(2, 6, 18, 0)');
        fg.addColorStop(0.7, 'rgba(2, 6, 18, 0.78)');
        fg.addColorStop(1, '#020612');
        ctx.fillStyle = fg;
        ctx.fillRect(0, fadeTop, cw, ch - fadeTop);
      }

      if (!visible) {
        visible = true;
        canvas.style.opacity = '1';
      }
      lastShownIdx = f.k;
      return true;
    }

    function timeOfS(sPos) {
      const c = clamp(sPos, 0, N - 1);
      const k = Math.min(N - 2, Math.floor(c));
      return stops[k] + (stops[k + 1] - stops[k]) * (c - k);
    }

    function sOfT(t) {
      if (t <= stops[0]) return 0;
      if (t >= stops[N - 1]) return N - 1;
      let k = 0;
      while (k < N - 2 && t > stops[k + 1]) k++;
      return k + (t - stops[k]) / Math.max(1, stops[k + 1] - stops[k]);
    }

    function preload() {
      return loadManifest();
    }

    function wake() {
      snap = true;
      loadManifest().then(() => {
        measure();
        pumpFetch();
      }, () => {});
    }

    function sleep() {}

    function step(pRaw, st, eRaw) {
      const dt = Math.min(0.05, Math.max(0.001, (st && st.dt) || 0.016));
      const sPos = stepPos(clamp(pRaw));
      if (!seq) {
        preload();
        if (onSync) onSync(sPos, sPos, eRaw, dt);
        return;
      }
      const tT = timeOfS(sPos);
      if (snap || L.reduced) {
        curT = prevT = tT;
        snap = false;
      } else {
        const d = (tT - curT) * (1 - Math.exp(-dt * 16.0));
        curT += d;
        if (Math.abs(tT - curT) < 0.05) curT = tT;
      }
      if (curT > prevT + 0.05) dir = 1;
      else if (curT < prevT - 0.05) dir = -1;
      prevT = curT;

      if (onSync) onSync(clamp(sOfT(curT), 0, N - 1), sPos, eRaw, dt);
      schedule(curT, dir);
      const best = findBestFrame(curT);
      if (best && (best.k !== lastShownIdx || dirty)) {
        if (drawFrame(best)) dirty = false;
      }
    }

    return { mount, measure, preload, wake, sleep, step };
  }

  /* ==========================================================================
     PHIM 3D TUA THEO CUỘN (MÁY TÍNH) — WebCodecs + WebGL2 (lọc Lanczos)
     ========================================================================== */
  function createFilmPlayer(secEl, sticky, onSync) {
    const DIR = 'assets/process/film/';
    const VER = '?v=916';
    const POOL = 24;
    const AHEAD = 10;
    const QIN = 10;
    const NUM_CX = 692;
    const EXT_FADE = 200;
    const MAX_DEV_H = 2160;

    let host = null, canvas = null, R = null, visible = false;
    let lvl = Math.min(2, Math.max(0, +L.params.get('pfxlvl') || 0)), slowEma = 0, warm = 0, isMoving = false, hqShown = false;
    let W = 1, H = 1, cw = 1, ch = 1;
    const lay = { ox: 0, dx: 0, dw: 1, dh: 1, gap: 0, fade: 1 };
    let film = null, manifest = null, fetching = false, abort = null;
    let buf = null, have = 0, availN = 0;
    let isKey = null, keyOf = null, nextKeyOf = null, isRef = null, nextRefOf = null, prevRefOf = null, frameUs = 41667, fstep = 1, hasB = false;
    let dec = null, mode = '', errs = 0;
    let decRef = -1, inflight = 0, sentAt = 0, lastOut = 0, goal = 0, spd = 0;
    const keep = new Set();
    let want = 0, shown = -1, curT = 0, prevT = 0, lastTT = -1, dir = 1, snap = true, dirty = true;
    let video = null, vTarget = -1, vBusy = false;
    let posterTag = '';
    const farOf = j => Math.abs(j - want) * ((j - want) * dir < 0 ? 1.5 : 1);

    function edgeRows(n) {
      const e = (film && film.edge) || [[1, 19, 47]];
      const out = new Uint8Array(n * 4);
      for (let y = 0; y < n; y++) {
        const t = (y + 0.5) / n * (e.length - 1), k = Math.min(e.length - 2, Math.floor(t)), f = e.length > 1 ? t - k : 0;
        const a = e[k], b = e[Math.min(e.length - 1, k + 1)];
        for (let c = 0; c < 3; c++) out[y * 4 + c] = Math.round(a[c] + (b[c] - a[c]) * f);
        out[y * 4 + 3] = 255;
      }
      return out;
    }

    function createGL(cv) {
      const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
      if (!gl) return null;
      const VS = '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
      const TAPS = 'vec4 a=texelFetch(w,ivec2(i,0),0);vec4 b=texelFetch(w,ivec2(i,1),0);int s=int(b.z);';
      const ER = 'float er(float u){return u<0.35?0.16*u/0.35:(u<0.7?0.16+0.44*(u-0.35)/0.35:0.6+0.4*(u-0.7)/0.3);}';
      const FV = '#version 300 es\nprecision highp float;uniform highp sampler2D t;uniform highp sampler2D w;uniform int lim;out vec4 o;' +
        'vec3 f(int x,int y){return texelFetch(t,ivec2(x,clamp(y,0,lim)),0).rgb;}' +
        'void main(){int x=int(gl_FragCoord.x);int i=int(gl_FragCoord.y);' + TAPS +
        'vec3 c=a.x*f(x,s)+a.y*f(x,s+1)+a.z*f(x,s+2)+a.w*f(x,s+3)+b.x*f(x,s+4)+b.y*f(x,s+5);o=vec4(clamp(c,0.0,1.0),1.0);}';
      const FH = '#version 300 es\nprecision highp float;uniform highp sampler2D t;uniform highp sampler2D w;uniform highp sampler2D g;uniform int lim,rows;out vec4 o;' +
        'vec3 f(int x,int y){return texelFetch(t,ivec2(clamp(x,0,lim),y),0).rgb;}' +
        'void main(){int i=int(gl_FragCoord.x);int y=rows-1-int(gl_FragCoord.y);' + TAPS +
        'vec3 c=a.x*f(s,y)+a.y*f(s+1,y)+a.z*f(s+2,y)+a.w*f(s+3,y)+b.x*f(s+4,y)+b.y*f(s+5,y);' +
        'o=vec4(mix(texelFetch(g,ivec2(0,y),0).rgb,clamp(c,0.0,1.0),b.w),1.0);}';
      const FF = '#version 300 es\nprecision highp float;uniform highp sampler2D t;uniform highp sampler2D g;uniform float sc,off,scy,e,f;uniform int rows;out vec4 o;' + ER +
        'void main(){int y=rows-1-int(gl_FragCoord.y);float sx=(gl_FragCoord.x-off)*sc;float al=1.0;' +
        'if(gl_FragCoord.x>e){if(sx>1920.0)sx=3840.0-sx;al=1.0-er(clamp((gl_FragCoord.x-e)/f,0.0,1.0));}' +
        'vec3 c=texture(t,vec2(sx/1920.0,(float(y)+0.5)*scy/1080.0)).rgb;o=vec4(mix(texelFetch(g,ivec2(0,y),0).rgb,c,al),1.0);}';
      const prog = fs => {
        const p = gl.createProgram();
        [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(([ty, src]) => {
          const sh = gl.createShader(ty);
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
          gl.attachShader(p, sh);
        });
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {};
        ['t', 'w', 'g', 'lim', 'rows', 'sc', 'off', 'scy', 'e', 'f'].forEach(n => { u[n] = gl.getUniformLocation(p, n); });
        return { p, u };
      };
      let pv, ph, pf;
      try { pv = prog(FV); ph = prog(FH); pf = prog(FF); } catch (err) { console.warn('Process film GL:', err && err.message); return null; }
      const vao = gl.createVertexArray();
      const mkTex = (w, h, fmt, filt) => {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texStorage2D(gl.TEXTURE_2D, 1, fmt || gl.RGBA8, w, h);
        [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, filt || gl.NEAREST));
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
        return tx;
      };
      const SW = 1920, SH = 1080;
      const slots = [];
      const free = [];
      for (let k = 0; k < POOL; k++) { slots.push(mkTex(SW, SH, gl.RGBA8, gl.LINEAR)); free.push(k); }
      const pool = new Map();
      let tmp = null, wV = null, wH = null, eg = null, key = '', srcTex = null;
      const fb = gl.createFramebuffer();

      const lz = x => { x = Math.abs(x); if (x < 1e-6) return 1; if (x >= 2) return 0; const p = Math.PI * x; return 2 * Math.sin(p) * Math.sin(p / 2) / (p * p); };
      function weights(nOut, nSrc, sc, off, ks, ext) {
        const d = new Float32Array(nOut * 8);
        const last = nSrc - 1;
        for (let o = 0; o < nOut; o++) {
          let sx = (o + 0.5 - off) * sc - 0.5;
          let al = 1;
          if (ext && o + 0.5 > ext.e) {
            if (sx > last) sx = 2 * last - sx;
            const u = Math.min(1, (o + 0.5 - ext.e) / ext.f);
            al = 1 - (u < 0.35 ? 0.16 * u / 0.35 : u < 0.7 ? 0.16 + 0.44 * (u - 0.35) / 0.35 : 0.6 + 0.4 * (u - 0.7) / 0.3);
          }
          const s = Math.floor(sx) - 2;
          const w = [0, 0, 0, 0, 0, 0];
          let sum = 0;
          for (let k = 0; k < 6; k++) { w[k] = lz((s + k - sx) * ks); sum += w[k]; }
          for (let k = 0; k < 6; k++) w[k] /= sum;
          d.set([w[0], w[1], w[2], w[3]], o * 4);
          d.set([w[4], w[5], s, al], (nOut + o) * 4);
        }
        return d;
      }
      function layoutTex(nOut, data, old) {
        if (old) gl.deleteTexture(old);
        const tx = mkTex(nOut, 2, gl.RGBA32F);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nOut, 2, gl.RGBA, gl.FLOAT, data);
        return tx;
      }
      function prepare() {
        const k = [cw, ch, lay.dx, lay.dw, lay.gap, lay.fade, film ? 1 : 0].join(':');
        if (k === key) return;
        key = k;
        if (eg) gl.deleteTexture(eg);
        eg = mkTex(1, ch);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, ch, gl.RGBA, gl.UNSIGNED_BYTE, edgeRows(ch));
        if (tmp) gl.deleteTexture(tmp);
        tmp = mkTex(SW, ch);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tmp, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        wV = layoutTex(ch, weights(ch, SH, SH / lay.dh, 0, Math.max(2 / 3, Math.min(1, lay.dh / SH)), null), wV);
        const ext = lay.gap > 0 ? { e: lay.dx + lay.dw, f: Math.max(1, lay.fade) } : null;
        wH = layoutTex(cw, weights(cw, SW, SW / lay.dw, lay.dx, Math.max(2 / 3, Math.min(1, lay.dw / SW)), ext), wH);
      }
      function upload(tex, src) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      }
      function render(tex, hq) {
        prepare();
        gl.bindVertexArray(vao);
        gl.disable(gl.BLEND);
        if (lvl > 0 || !hq) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, cw, ch);
          gl.useProgram(pf.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, eg);
          gl.uniform1i(pf.u.t, 0); gl.uniform1i(pf.u.g, 1); gl.uniform1i(pf.u.rows, ch);
          gl.uniform1f(pf.u.sc, SW / lay.dw); gl.uniform1f(pf.u.off, lay.dx); gl.uniform1f(pf.u.scy, SH / lay.dh);
          gl.uniform1f(pf.u.e, lay.gap > 0 ? lay.dx + lay.dw : 1e9); gl.uniform1f(pf.u.f, Math.max(1, lay.fade));
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.activeTexture(gl.TEXTURE0);
          return;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, SW, ch);
        gl.useProgram(pv.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, wV);
        gl.uniform1i(pv.u.t, 0); gl.uniform1i(pv.u.w, 1); gl.uniform1i(pv.u.lim, SH - 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);
        gl.useProgram(ph.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tmp);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, wH);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, eg);
        gl.uniform1i(ph.u.t, 0); gl.uniform1i(ph.u.w, 1); gl.uniform1i(ph.u.g, 2); gl.uniform1i(ph.u.lim, SW - 1); gl.uniform1i(ph.u.rows, ch);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      }
      return {
        gl: true, pool,
        has: i => pool.has(i),
        store(i, frame, protect) {
          if (pool.has(i)) { frame.close(); return; }
          let k = free.pop();
          if (k === undefined) {
            let far = -1, fd = -1;
            for (const j of pool.keys()) { const d = farOf(j); if (j !== protect && d > fd) { fd = d; far = j; } }
            if (far < 0) { frame.close(); return; }
            k = pool.get(far); pool.delete(far);
          }
          try { upload(slots[k], frame); pool.set(i, k); } catch (_) { free.push(k); }
          frame.close();
        },
        draw(i, hq) { render(slots[pool.get(i)], hq); },
        drawSource(src, hq) { if (!srcTex) srcTex = mkTex(SW, SH, gl.RGBA8, gl.LINEAR); upload(srcTex, src); render(srcTex, hq); },
        trim(protect) { for (const [j, k] of pool) if (j !== protect) { pool.delete(j); free.push(k); } },
        resize() { key = ''; }
      };
    }

    function create2D(cv) {
      const ctx = cv.getContext('2d', { alpha: false });
      if (!ctx) return null;
      const pool = new Map();
      let over = null, overKey = '';
      function overlay() {
        const k = [lay.gap, ch, lay.fade, film ? 1 : 0].join(':');
        if (k === overKey && over) return over;
        overKey = k;
        over = document.createElement('canvas');
        over.width = Math.max(1, lay.gap);
        over.height = ch;
        const o = over.getContext('2d');
        const rows = edgeRows(ch), img = o.createImageData(1, ch);
        img.data.set(rows);
        o.putImageData(img, 0, 0);
        o.imageSmoothingEnabled = false;
        o.drawImage(over, 0, 0, 1, ch, 0, 0, over.width, ch);
        const g = o.createLinearGradient(0, 0, Math.max(1, lay.fade), 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.35, 'rgba(0,0,0,.16)');
        g.addColorStop(0.7, 'rgba(0,0,0,.6)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        o.globalCompositeOperation = 'destination-in';
        o.fillStyle = g;
        o.fillRect(0, 0, over.width, ch);
        return over;
      }
      function paint(src, sw, sh, hq) {
        const { dx, dw, dh, gap } = lay;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = lvl > 0 || !hq ? 'low' : 'high';
        ctx.drawImage(src, 0, 0, sw, sh, dx, 0, dw, dh);
        if (gap > 0) {
          const e = dx + dw, gs = Math.min(sw, gap * sw / dw);
          ctx.save();
          ctx.setTransform(-1, 0, 0, 1, 2 * e, 0);
          ctx.drawImage(src, sw - gs, 0, gs, sh, e - gap, 0, gap, dh);
          ctx.restore();
          ctx.drawImage(overlay(), e, 0);
        }
      }
      return {
        gl: false, pool,
        has: i => pool.has(i) && pool.get(i) !== null,
        store(i, frame, protect) {
          if (pool.has(i) || typeof createImageBitmap !== 'function') { frame.close(); return; }
          pool.set(i, null);
          createImageBitmap(frame).then(b => {
            frame.close();
            if (!pool.has(i)) { b.close(); return; }
            pool.set(i, b);
            while (pool.size > POOL) {
              let far = -1, fd = -1;
              for (const j of pool.keys()) { const d = farOf(j); if (j !== protect && j !== shown && d > fd) { fd = d; far = j; } }
              if (far < 0) break;
              const old = pool.get(far); if (old) old.close(); pool.delete(far);
            }
          }, () => { frame.close(); pool.delete(i); });
        },
        draw(i, hq) { const b = pool.get(i); paint(b, b.width, b.height, hq); },
        drawSource(src, hq) { paint(src, src.videoWidth || src.width, src.videoHeight || src.height, hq); },
        trim(protect) { for (const [j, b] of pool) if (j !== protect) { if (b) b.close(); pool.delete(j); } },
        resize() { overKey = ''; }
      };
    }

    function mount() {
      if (host) return;
      host = document.createElement('div');
      host.className = 'pfx-gl pfx-film';
      host.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'pfx-canvas';
      canvas.style.opacity = '0';
      host.appendChild(canvas);
      sticky.insertBefore(host, sticky.firstChild);
      R = (L.params.has('pfx2d') ? null : createGL(canvas)) || create2D(canvas);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (R) R.pool.clear(); shown = -1; });
      canvas.addEventListener('webglcontextrestored', () => { R = createGL(canvas); shown = -1; dirty = true; });
      measure();
    }

    function measure() {
      if (!canvas) return;
      const r = host.getBoundingClientRect();
      W = Math.max(1, r.width || innerWidth);
      H = Math.max(1, r.height || innerHeight);
      const dpr = lvl >= 2 ? 1 : Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DEV_H / H));
      cw = Math.round(W * dpr);
      ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

      const k = H / (film ? film.h : 1080);
      const vw = (film ? film.w : 1920) * k;
      let ox = 0;
      if (vw > W) {
        const cont = $('.process__sticky > .container', secEl), card = $('.pflow__stage', secEl);
        const cx = cont && card ? (cont.getBoundingClientRect().left + card.getBoundingClientRect().left) / 2 - r.left : W * 0.3;
        ox = clamp(cx - NUM_CX * k, W - vw, 0);
      }
      lay.ox = ox;
      lay.dx = Math.round(ox * dpr);
      lay.dw = Math.round(vw * dpr);
      lay.dh = ch;
      lay.gap = Math.max(0, cw - lay.dx - lay.dw);
      lay.fade = Math.min(lay.gap, EXT_FADE * dpr);
      host.style.backgroundPosition = ox.toFixed(1) + 'px 0, 0 0';
      if (R) R.resize();
      dirty = true;
      repaint();
    }

    function repaint() {
      if (!R || !dirty) return;
      if (mode === 'video' && video && video.readyState >= 2) { R.drawSource(video, true); dirty = false; show(); }
      else if (shown >= 0 && R.has(shown)) { R.draw(shown, true); hqShown = true; dirty = false; show(); }
    }

    function show() {
      if (!visible) { visible = true; canvas.style.opacity = '1'; }
    }

    function b64(s) {
      const bin = atob(s), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }

    function loadManifest() {
      if (manifest) return manifest;
      manifest = new Promise((res, rej) => {
        if (window.PROCESS_FILM) return res(window.PROCESS_FILM);
        const sc = document.createElement('script');
        sc.src = DIR + 'film.js' + VER;
        sc.async = true;
        sc.onload = () => (window.PROCESS_FILM ? res(window.PROCESS_FILM) : rej(new Error('PROCESS_FILM')));
        sc.onerror = () => rej(new Error('film.js'));
        document.head.appendChild(sc);
      }).then(f => {
        film = f;
        frameUs = 1e6 / f.fps;
        fstep = f.step || 1;
        isKey = new Uint8Array(f.n);
        f.key.forEach(i => { isKey[i] = 1; });
        keyOf = new Int32Array(f.n);
        for (let i = 0, k = 0; i < f.n; i++) { if (isKey[i]) k = i; keyOf[i] = k; }
        nextKeyOf = new Int32Array(f.n);
        for (let i = f.n - 1, k = -1; i >= 0; i--) { if (isKey[i]) k = i; nextKeyOf[i] = k; }
        isRef = new Uint8Array(f.n).fill(1);
        (f.b || []).forEach(i => { isRef[i] = 0; });
        hasB = (f.b || []).length > 0;
        nextRefOf = new Int32Array(f.n);
        prevRefOf = new Int32Array(f.n);
        for (let i = f.n - 1, x = -1; i >= 0; i--) { nextRefOf[i] = x; if (isRef[i]) x = i; }
        for (let i = 0, x = -1; i < f.n; i++) { prevRefOf[i] = x; if (isRef[i]) x = i; }
        measure();
        setPoster('01');
        return f;
      });
      manifest.catch(e => console.warn('Process film:', e && e.message));
      return manifest;
    }

    function setPoster(tag) {
      if (!film || !host || tag === posterTag) return;
      posterTag = tag;
      const e = film.edge || [];
      const grad = e.length > 1
        ? 'linear-gradient(to bottom,' + e.map((c, i) => `rgb(${c[0]},${c[1]},${c[2]}) ${(i / (e.length - 1) * 100).toFixed(2)}%`).join(',') + ')'
        : 'none';
      host.style.backgroundImage = `url("${DIR}poster-${tag}.webp${VER}"), ${grad}`;
      host.style.backgroundSize = 'auto 100%, 100% 100%';
      host.style.backgroundRepeat = 'no-repeat';
      host.style.backgroundPosition = lay.ox.toFixed(1) + 'px 0, 0 0';
    }

    function startFetch() {
      if (fetching || !film) return;
      fetching = true;
      if (location.protocol === 'file:' || typeof fetch !== 'function' || typeof window.VideoDecoder !== 'function') {
        useVideo();
        return;
      }
      buf = new Uint8Array(film.bytes);
      abort = typeof AbortController === 'function' ? new AbortController() : null;
      fetch(DIR + 'film.mp4' + VER, { priority: 'low', signal: abort ? abort.signal : undefined }).then(async res => {
        if (!res.ok) throw new Error('film.mp4 ' + res.status);
        if (!res.body || !res.body.getReader) {
          buf = new Uint8Array(await res.arrayBuffer());
          have = buf.length;
          return arrived();
        }
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          if (have + value.length > buf.length) {
            const nb = new Uint8Array(Math.ceil((have + value.length) * 1.1));
            nb.set(buf.subarray(0, have));
            buf = nb;
          }
          buf.set(value, have);
          have += value.length;
          arrived();
        }
      }).catch(e => {
        if (mode === 'video') return;
        console.warn('Process film:', e && e.message);
        if (!availN) useVideo();
      });
    }

    function arrived() {
      const n = film.n, pos = film.pos, size = film.size;
      while (availN < n && pos[availN] + size[availN] <= have) availN++;
    }

    function startDecoder() {
      if (mode || !film || typeof window.VideoDecoder !== 'function') return;
      mode = 'wait';
      const cfg = { codec: film.codec, description: b64(film.avcc), codedWidth: film.w, codedHeight: film.h, optimizeForLatency: true };
      VideoDecoder.isConfigSupported(cfg).then(sup => {
        if (!sup || !sup.supported) throw new Error('VideoDecoder: ' + film.codec);
        dec = new VideoDecoder({ output: onFrame, error: onError });
        dec.configure(cfg);
        mode = 'wc';
        decRef = -1; inflight = 0;
        pump();
      }).catch(e => {
        console.warn('Process film:', e && e.message);
        useVideo();
      });
    }

    function restart() {
      try { if (dec && dec.state !== 'closed') dec.close(); } catch (_) {}
      dec = null;
      inflight = 0; decRef = -1;
      keep.clear();
      mode = '';
      if (++errs > 3) useVideo(); else startDecoder();
    }

    function onError(e) {
      console.warn('Process film decoder:', e && e.message);
      restart();
    }

    function onFrame(frame) {
      if (inflight > 0) inflight--;
      lastOut = performance.now();
      const i = Math.round(frame.timestamp / frameUs);
      if (keep.delete(i) && R) R.store(i, frame, shown);
      else frame.close();
      if (inflight < QIN - 3) pump();
    }

    const ready = i => R.has(i) || keep.has(i);
    const waiting = () => keep.size - (hasB && decRef >= 0 && keep.has(decRef) ? 1 : 0);

    function chunk(i, wanted) {
      if (wanted && !ready(i)) keep.add(i);
      dec.decode(new EncodedVideoChunk({
        type: isKey[i] ? 'key' : 'delta',
        timestamp: Math.round(i * frameUs),
        data: buf.subarray(film.pos[i], film.pos[i] + film.size[i])
      }));
      inflight++;
    }

    function walk(s, until, lo, hi, withB, budget) {
      let p = isKey[s] ? -1 : decRef;
      let r = s, n = 0;
      try {
        while (r >= 0 && n < budget) {
          chunk(r, r >= lo && r <= hi);
          n++;
          if (withB && p >= 0) {
            for (let b = p + 1; b < r; b++) if (!isRef[b] && b >= lo && b <= hi && !ready(b)) { chunk(b, true); n++; }
          }
          decRef = p = r;
          if (r > until || (r === until && !hasB)) break;
          if (nextRefOf[r] < 0) { dec.flush().catch(() => {}); decRef = -1; break; }
          r = nextRefOf[r];
        }
      } catch (e) {
        onError(e);
        return;
      }
      sentAt = performance.now();
    }

    function startFor(m) {
      const need = isRef[m] ? m : nextRefOf[m];
      if (decRef >= 0 && decRef >= keyOf[m] && decRef < need && (isRef[m] || decRef <= prevRefOf[m])) return nextRefOf[decRef];
      return keyOf[m];
    }

    const passed = i => !isRef[i] && decRef >= 0 && decRef >= nextRefOf[i];

    function pump() {
      if (mode !== 'wc' || !dec || dec.state !== 'configured' || !R) return;
      if (waiting() > 0 && performance.now() - Math.max(sentAt, lastOut) > 800) { restart(); return; }
      const last = availN - 1;
      if (last < 0) return;
      const T = Math.min(want, last);
      const fast = spd > 1.1 * fstep;
      if (hasB && T === decRef && keep.has(T) && nextRefOf[T] >= 0) { walk(nextRefOf[T], T, T - 2, T + AHEAD, !fast, 2); return; }
      const g = Math.min(last, Math.round(goal));
      const way = g > T ? 1 : g < T ? -1 : dir;
      const ahead = clamp(Math.abs(g - T) + 4, AHEAD, way >= 0 ? POOL - 4 : POOL - 10);
      if (spd > 3 * fstep) {
        if (way >= 0 ? inflight >= QIN : waiting() > 0) return;
        const lo = way >= 0 ? T : Math.max(0, T - 48), hi = way >= 0 ? Math.min(last, T + 48) : T;
        let k = way >= 0 ? nextKeyOf[T] : keyOf[T], n = 0;
        try {
          while (k >= 0 && k >= lo && k <= hi && n < 3) {
            if (!ready(k)) { chunk(k, true); decRef = k; n++; }
            k = way >= 0 ? (k + 1 < film.n ? nextKeyOf[k + 1] : -1) : (k > 0 ? keyOf[k - 1] : -1);
          }
        } catch (e) { onError(e); return; }
        if (n) sentAt = performance.now();
        return;
      }
      const need = i => !ready(i) && (isRef[i] || (!fast && !passed(i)));
      if (way >= 0) {
        if (inflight >= QIN) return;
        const E = Math.min(last, T + ahead);
        let m = T;
        while (m <= E && !need(m)) m++;
        if (m > E) return;
        walk(startFor(m), E, T - 2, E, !fast, QIN - inflight);
      } else {
        if (inflight >= QIN) return;
        const L = Math.max(0, T - ahead);
        let m = T;
        while (m >= L && (ready(m) || (!isRef[m] && fast))) m--;
        if (m >= L) walk(startFor(m), m, keyOf[m], m, !fast, 64);
      }
    }

    function useVideo() {
      if (mode === 'video' || !film) return;
      if (dec) { try { dec.close(); } catch (_) {} dec = null; }
      if (abort) { abort.abort(); abort = null; }
      mode = 'video';
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      video.addEventListener('loadeddata', vPump);
      video.addEventListener('seeked', () => {
        vBusy = false;
        if (video.readyState >= 2 && R) { R.drawSource(video, true); shown = vTarget; show(); }
        vPump();
      });
      host.appendChild(video);
      video.src = DIR + 'film.mp4' + VER;
    }

    function vPump() {
      if (!video || vBusy || video.readyState < 1 || want === shown) return;
      vBusy = true;
      vTarget = want;
      video.currentTime = (want + 0.5) / film.fps;
    }

    function present() {
      if (!R) return;
      if (mode === 'video') { vPump(); return; }
      const T = Math.min(want, availN - 1);
      let k = -1;
      if (T >= 0 && R.has(T)) k = T;
      else if (T >= 0 && shown >= 0) {
        let best = Infinity;
        for (const j of R.pool.keys()) {
          if (!R.has(j)) continue;
          const between = shown <= T ? j > shown && j < T : j < shown && j > T;
          if (between && Math.abs(T - j) < best) { best = Math.abs(T - j); k = j; }
        }
      }
      if (k >= 0 && (k !== shown || dirty)) { R.draw(k, !isMoving); hqShown = !isMoving; shown = k; dirty = false; show(); }
      else if (!isMoving && !hqShown && shown >= 0 && R.has(shown)) { R.draw(shown, true); hqShown = true; }
      else repaint();
      if (shown < 0 && film) setPoster(want > film.stops[N - 1] / 2 ? '06' : '01');
    }

    function timeOfS(sPos) {
      const st = film.stops, c = clamp(sPos, 0, N - 1);
      const k = Math.min(N - 2, Math.floor(c));
      return st[k] + (st[k + 1] - st[k]) * (c - k);
    }

    function sOfT(t) {
      const st = film.stops;
      if (t <= st[0]) return 0;
      if (t >= st[N - 1]) return N - 1;
      let k = 0;
      while (k < N - 2 && t > st[k + 1]) k++;
      return k + (t - st[k]) / Math.max(1, st[k + 1] - st[k]);
    }

    let preloading = null;
    function preload() {
      return preloading || (preloading = loadManifest().then(startFetch, () => {}));
    }

    function wake() {
      snap = true;
      warm = 0;
      loadManifest().then(() => {
        startFetch();
        startDecoder();
        measure();
      }, () => {});
    }

    function sleep() {
      if (R) R.trim(shown);
    }

    function step(pRaw, st, eRaw, pGoal) {
      const dt = Math.min(0.05, Math.max(0.001, (st && st.dt) || 0.016));
      const sPos = stepPos(clamp(pRaw));
      if (!film) {
        preload();
        if (onSync) onSync(sPos, sPos, eRaw, dt);
        return;
      }
      const tT = timeOfS(sPos);
      if (snap || L.reduced) {
        curT = prevT = tT;
        snap = false;
      } else {
        let d = (tT - curT) * (1 - Math.exp(-dt * DAMP_T));
        const cap = VMAX * fstep * dt;
        if (d > cap) d = cap;
        else if (d < -cap) d = -cap;
        curT += d;
        if (Math.abs(tT - curT) < 0.002) curT = tT;
      }
      if (onSync) onSync(clamp(sOfT(curT), 0, N - 1), sPos, eRaw, dt);
      if (curT > prevT + 1e-3) dir = 1;
      else if (curT < prevT - 1e-3) dir = -1;
      spd += (Math.abs(curT - prevT) - spd) * 0.3;
      prevT = curT;
      goal = pGoal == null ? tT : timeOfS(stepPos(clamp(pGoal)));
      const moving = Math.abs(tT - lastTT) > 1e-4 || Math.abs(tT - curT) > 0.02;
      lastTT = tT;
      isMoving = moving;
      want = moving ? Math.round(curT) : Math.round(curT / fstep) * fstep;
      if (moving && lvl < 2 && R) {
        if (++warm > 45) {
          slowEma += ((dt > 0.021 ? 1 : 0) - slowEma) * 0.06;
          if (slowEma > (lvl ? 0.65 : 0.5)) { lvl++; slowEma = 0; warm = 0; dirty = true; measure(); }
        }
      }
      present();
      pump();
    }

    if (S.debug) window.__pfxFilm = () => ({ mode, gl: !!(R && R.gl), want, shown, availN, inflight, cache: R ? R.pool.size : 0, decRef, spd: +spd.toFixed(2), errs, lvl, goal: +goal.toFixed(1), dir });

    return { mount, measure, preload, wake, sleep, step };
  }
})();
