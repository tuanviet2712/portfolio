/* ==========================================================================
   HERO — VIDEO TUA THEO CUỘN (chuỗi khung WebP, giảm chấn 2 tầng)

   - Một clip AI (một cú máy liên tục, 10 s) được tách thành 240 khung WebP
     (tools/hero-video/build_seq.py). Trang KHÔNG tự phát: vị trí cuộn quyết định
     thời điểm trong clip; không cuộn = đứng hình hoàn toàn.
   - Cuộn chỉ là ĐÍCH (học từ getlayers.ai/ascend): tiến trình p tiến tới đích với
     giảm chấn 4.5/s, rồi thời điểm t tiến tới t(p) với giảm chấn 3.2/s. Hai tầng
     lọc => vận tốc liên tục, lăn chuột theo nấc vẫn ra chuyển động trơn.
   - Giữa hai khung liền nhau: hoà trộn tuyến tính theo phần lẻ của t (giống motion
     blur của video). Khi dừng hẳn, t "đậu" đúng MỘT khung => hình sắc, không đúp bóng.
   - Bảng map p -> t (đo bằng optical flow lúc dựng) làm tốc độ hình gần đều khi cuộn đều.
   - Bộ nhớ: chỉ giải mã ~14 khung quanh vị trí hiện tại (ImageBitmap, ngoài luồng
     chính), tải thô -> mịn (mỗi 8 khung, rồi 4, 2, 1) để mở trang nhanh. Điện thoại
     dọc dùng bộ khung cắt quanh khuôn mặt (đường focus fx/fy trong scene.js).
   - Bản WebGL "ảnh 3D" cũ vẫn xem được: ?hero=3d (js/hero-3d.js, assets/hero/a08).
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const { $, $$, clamp, smooth } = L;

  const DEFAULT_SRC = 'seq';                 // assets/hero/<src>/scene.js (sinh bởi build_seq.py)
  const DAMP_P = 4.5, DAMP_T = 3.2;          // giảm chấn 2 tầng (1/s): cuộn -> p, p -> thời điểm
  const DAMP_REST = 8, REST_EPS = 0.002;     // gần đích (|đích - p| < 0.002): đậu về đúng một khung, nhanh hơn
  const VMAX = 120;                          // tốc độ tua tối đa (khung/s = 5x tốc độ clip) khi vuốt mạnh
  const LEVELS = [8, 4, 2, 1];               // thứ tự tải: mỗi 8 khung trước, rồi 4, 2, 1
  const PAR = 8;                             // số file tải song song
  const AHEAD = 8, BEHIND = 4, KEEP = 14;    // cửa sổ giải mã quanh khung hiện tại (số khung)
  const MAXQ = 6;                            // số khung giải mã cùng lúc
  const MOUSE = { x: 7, y: 5, zoom: 1.02 };  // parallax chuột: dịch (px màn hình) + phóng nhẹ để có biên
  const TALL_ASPECT = 0.85;                  // khung nhìn hẹp hơn tỉ lệ này -> bộ khung cắt dọc

  // ?hero=3d : bản WebGL cũ để so sánh
  if (L.params.get('hero') === '3d') {
    const sc = document.createElement('script'); sc.src = 'js/hero-3d.js'; document.head.appendChild(sc);
    return;
  }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const hero = $('#trang-chu');
    const canvas = $('#heroCanvas');
    if (!hero || !canvas) { L.preloader.ready(); return; }
    const stage = $('#heroStage');
    const layers = $('#heroLayers');
    const layersWrap = layers && layers.parentElement;
    const hud = $('.hud', hero);
    const rail = $('.hud__rail', hero);
    const hudScroll = $('.hud__scroll', hero);
    const hudProgress = $('.hud__progress', hero);
    const hudEls = {};
    $$('[data-hud]', hero).forEach(el => (hudEls[el.dataset.hud] = el));
    const ticks = $$('.hud__tick', hero);
    const tickKs = ticks.map(b => +b.dataset.k);

    const src = (L.params.get('src') || DEFAULT_SRC).replace(/[^a-z0-9_-]/gi, '');
    const base = `assets/hero/${src}/`;
    const snap = L.params.has('p');                              // ?p=0.5 : nhảy thẳng tới vị trí (kiểm thử / chụp ảnh)
    const noMouse = snap || L.reduced || !L.fine || L.params.has('nofloat');
    const debug = L.params.has('herodebug');
    const stats = (L.heroStats = { mode: 'seq', gl: false, frames: 0, ms: 0, blends: 0, misses: 0, decodes: 0, decodeMs: 0 });

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { L.preloader.ready(); return; }
    canvas.style.opacity = '0';                                  // poster (CSS) hiện tới khi vẽ được khung đầu

    // trạng thái dữ liệu (khai báo trước measure() vì measure gọi pickSet)
    let scene = null, sets = {}, active = null, fallbackSet = null, readyFired = false;
    let curP = 0, curT = 0;
    let face = null, gutterPx = 48;                              // mặt trên màn hình (draw() cập nhật) + lề trái của thẻ (measure() đo)

    /* ================= KÍCH THƯỚC & MỐC CUỘN ================= */
    let W = 1, H = 1, dpr = 1, heroTop = 0, heroH = 1, vh = innerHeight, animEnd = 1, coverStart = 1, dirty = true;
    function measure() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 2560 / W));
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      vh = innerHeight;
      heroTop = hero.getBoundingClientRect().top + window.scrollY;
      heroH = hero.offsetHeight;
      const intro = layers && $('.ch--intro', layers);
      if (intro && intro.offsetLeft > 0) gutterPx = intro.offsetLeft;
      const nextEl = hero.nextElementSibling;
      const nextTop = nextEl ? nextEl.getBoundingClientRect().top + window.scrollY : heroTop + heroH;
      coverStart = nextTop - vh - heroTop;             // lúc section kế tiếp bắt đầu trượt lên
      animEnd = Math.max(vh, coverStart - vh * 0.55);  // giữ khung cuối ~0.55 màn hình để đọc CTA
      dirty = true;
      if (scene) pickSet();
    }
    measure();
    L.onResize(measure);

    /* ================= PARALLAX CHUỘT (chỉ khi người dùng di chuột) ================= */
    let tmx = 0, tmy = 0, mx = 0, my = 0;
    if (!noMouse) {
      hero.addEventListener('pointermove', e => { tmx = (e.clientX / W - 0.5) * 2; tmy = (e.clientY / H - 0.5) * 2; }, { passive: true });
      hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; });
    }

    /* ================= CHƯƠNG NỘI DUNG ================= */
    const chs = $$('.ch', layers).map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, f: +(el.dataset.fade || 0.05), v: -1, side: el.classList.contains('ch--left') || el.classList.contains('ch--right'), placeKey: '' }));
    const scrim = $('#heroScrim');
    const lastS = { sl: -1, sr: -1, sb: -1 };
    // Tấm phủ tối chỉ đậm ở phía đang có chữ: trái / phải (máy tính) hoặc dưới (điện thoại, chương mở đầu)
    function setScrim(sl, sr, sb) {
      if (!scrim) return;
      const put = (k, v) => { if (Math.abs(v - lastS[k]) > 0.004) { lastS[k] = v; scrim.style.setProperty('--' + k, v.toFixed(3)); } };
      put('sl', sl); put('sr', sr); put('sb', sb);
    }

    /* Tách chữ của các chương thành ký tự (tiêu đề, số) và từ (mô tả, mốc) — mỗi đơn vị có mốc --d riêng
       để hiện lần lượt như sóng theo tiến trình --v (CSS .u--c / .u--w). */
    function textNodes(el) {
      const out = [], walk = n => { for (const ch of Array.from(n.childNodes)) { if (ch.nodeType === 3) { if (ch.nodeValue.trim()) out.push(ch); } else if (ch.nodeType === 1 && !ch.classList.contains('u')) walk(ch); } };
      walk(el); return out;
    }
    function splitUnits(el, cls, d0, span, byChar) {
      const nodes = textNodes(el), units = [];
      for (const tn of nodes) {
        const frag = document.createDocumentFragment();
        const parts = byChar ? Array.from(tn.nodeValue) : tn.nodeValue.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
          const s = document.createElement('span'); s.className = 'u ' + cls; s.textContent = part; units.push(s); frag.appendChild(s);
        }
        tn.parentNode.replaceChild(frag, tn);
      }
      const n = Math.max(1, units.length - 1);
      units.forEach((u, k) => u.style.setProperty('--d', (d0 + span * k / n).toFixed(3)));
      el.classList.remove('st');
      return units;
    }

    /* Gradient của tiêu đề: tô MÀU RIÊNG cho từng ký tự theo vị trí trong dòng — trắng ở đầu,
       bắt đầu ngả cyan từ khoảng giữa rồi đậm dần về cuối. Làm theo cách này (thay vì
       background-clip: text) vì mỗi ký tự có transform/blur riêng, nền cắt theo chữ sẽ mất. */
    const TITLE_STOPS = [[0, 255, 255, 255], [0.40, 255, 255, 255], [0.74, 127, 227, 242], [1, 62, 195, 238]];
    function titleColor(t) {
      let i = 0;
      while (i < TITLE_STOPS.length - 2 && t > TITLE_STOPS[i + 1][0]) i++;
      const a = TITLE_STOPS[i], b = TITLE_STOPS[i + 1];
      const x = clamp((t - a[0]) / (b[0] - a[0] || 1));
      const e = x * x * (3 - 2 * x);                                  // smoothstep: chuyển màu êm, không thấy mối nối
      return `rgb(${[1, 2, 3].map(k => Math.round(a[k] + (b[k] - a[k]) * e)).join(' ')})`;
    }
    function paintTitleGradient(units) {
      const n = Math.max(1, units.length - 1);
      units.forEach((u, k) => { const col = titleColor(k / n); u.style.color = col; u.style.webkitTextFillColor = col; });
    }
    // Tên ở chương mở đầu: tách sẵn thành ký tự (giữ nguyên hiệu ứng chữ trồi lên theo từ) rồi tô gradient
    function paintHeroName() {
      const name = $('.hero-name', layers);
      if (!name || name.dataset.grad) return;
      name.dataset.grad = '1';
      const chars = [];
      $$('.hn > span', name).forEach(word => {
        const text = word.textContent;
        word.textContent = '';
        for (const ch of Array.from(text)) {
          const s = document.createElement('span'); s.className = 'gc'; s.textContent = ch;
          word.appendChild(s); chars.push(s);
        }
      });
      if (chars.length) paintTitleGradient(chars);
    }
    paintHeroName();
    chs.forEach(c => {
      if (c.a < 0) return;                                         // chương mở đầu có hiệu ứng riêng
      const title = $('.ch__title', c.el);
      if (title) { paintTitleGradient(splitUnits(title, 'u--c', 0, 0.42, true)); const rule = document.createElement('i'); rule.className = 'ch__rule'; title.after(rule); }
      $$('.ch__text', c.el).forEach(t => splitUnits(t, 'u--w', 0.3, 0.36, false));
      $$('.ch-stat', c.el).forEach((s, i) => { s.classList.remove('st'); const b = $('b', s), sp = $('span', s); if (b) splitUnits(b, 'u--c', 0.28 + i * 0.13, 0.12, true); if (sp) splitUnits(sp, 'u--w', 0.36 + i * 0.13, 0.2, false); });
      $$('.chip', c.el).forEach((ch, i) => {          // tách theo TỪNG Ô của hàng, giữ nguyên lưới 3 cột
        const d0 = 0.3 + i * 0.14;
        const b = $('b', ch), role = $('.chip__role', ch), org = $('.chip__org', ch);
        if (b) splitUnits(b, 'u--c', d0, 0.06, true);
        if (role) splitUnits(role, 'u--w', d0 + 0.05, 0.12, false);
        if (org) splitUnits(org, 'u--w', d0 + 0.14, 0.04, false);
        if (!role && !org) splitUnits(ch, 'u--w', d0, 0.2, false);
        ch.classList.remove('st');
      });
    });

    // Đặt khối chữ ở phía có nhiều chỗ trống hơn so với nhân vật. Khoảng an toàn được
    // ước lượng theo cả đầu + vai, không chỉ khuôn mặt, để chữ không đè lên thân người.
    // Nhân vật nằm đâu trên khung nhìn tại thời điểm t (bỏ qua parallax chuột).
    // Tính thẳng từ dữ liệu khung hình nên kết quả luôn như nhau, không phụ thuộc khung đang vẽ.
    function faceAt(t) {
      if (!scene || !active) return face;
      const set = active, sw = scene.w, sh = scene.h;
      const ti = clamp(t, 0, scene.n - 1), i0 = Math.floor(ti), fr = ti - i0, i1 = Math.min(scene.n - 1, i0 + 1);
      const fx = scene.fx[i0] + (scene.fx[i1] - scene.fx[i0]) * fr;
      const fh = scene.fh ? scene.fh[i0] + (scene.fh[i1] - scene.fh[i0]) * fr : 0.25;
      const f = set.frames[Math.min(set.frames.length - 1, lowerBound(set.frames, ti))];
      const x0 = f ? f.x0 : 0;
      const s = Math.max(W / sw, H / sh, W / set.w) * (noMouse ? 1 : MOUSE.zoom);
      const vw = W / s;
      const sx = clamp(fx * sw, x0 + vw / 2, x0 + set.w - vw / 2) - vw / 2;
      return { x: (fx * sw - sx) / vw, hw: 0.5 * fh * sh / vw };
    }
    function placeChapter(c) {
      if (!c.side || !face || W <= 760) return;
      // chọn phía theo khung GIỮA của chương: vị trí cố định cho mỗi chương, cuộn lên hay xuống đều như nhau
      const mid = (Math.max(0, c.a) + Math.min(1, c.b)) / 2;
      const fc = faceAt(timeOf(mid));
      const bodyHalf = Math.min(0.30, Math.max(fc.hw * 2.6, fc.hw + 0.06));
      const roomL = fc.x - bodyHalf, roomR = 1 - fc.x - bodyHalf;
      // data-side="left|right": khoá bên cho chương cần nhiều bề ngang hơn ước lượng theo khuôn mặt.
      // Ước lượng thân người dựa vào đầu nên hụt ở phía nhân vật quay vai ra; chương 2 (khối số) là trường hợp đó.
      const forced = c.el.dataset.side;
      let left = forced ? forced === 'left' : roomL > roomR;
      const hadSide = c.el.classList.contains('is-left') || c.el.classList.contains('is-right');
      const wasLeft = c.el.classList.contains('is-left');
      if (!forced && hadSide && Math.abs(roomL - roomR) * W < 80) left = wasLeft; // chống nhảy bên khi nhân vật gần giữa khung
      // data-room-bonus: tỉ lệ bề rộng màn hình được lấn thêm. Chỉ dùng cho chương đã khoá bên bằng
      // data-side, khi đã chụp ảnh đo được thân người thực tế hẹp hơn ước lượng theo đầu.
      const bonus = forced ? (+c.el.dataset.roomBonus || 0) * W : 0;
      const room = (left ? roomL * W - gutterPx - 16 : roomR * W - gutterPx - 40 - 16) + bonus;   // px trống bên đó, trừ lề và khe 16 px
      const std = Math.min(560, W * 0.40);
      const low = !forced && room < 380;                            // hai bên đều hẹp (đoạn cận mặt) => hạ xuống dưới, giữ bề rộng chuẩn
      // Chương đã khoá bên thì không hạ xuống đáy: nửa dưới khung là thân người, chữ sẽ đè lên.
      const w = low ? std : Math.min(std, room);
      const fittedW = Math.max(260, Math.floor(w / 8) * 8);
      const key = `${low ? 'b' : ''}${left ? 'l' : 'r'}:${fittedW}`;
      if (c.placeKey === key) return;
      c.placeKey = key;
      c.el.classList.toggle('is-left', left);
      c.el.classList.toggle('is-right', !left);
      c.el.classList.toggle('is-low', low);
      c.el.style.setProperty('--chw', fittedW + 'px');
      if (L.fit) L.fit(c.el);                                       // tiêu đề 1 dòng co lại theo bề rộng mới
    }
    function updateChapters(p) {
      let sl = 0, sr = 0, sb = 0;
      const narrow = W <= 760;
      for (const c of chs) {
        const vin = c.a < 0 ? 1 : smooth(c.a - c.f, c.a, p);
        const v = vin * (1 - smooth(c.b, c.b + c.f, p));
        if (v > 0.002) {
          if (narrow) sb = Math.max(sb, v);                                             // điện thoại: chữ nằm dưới
          else if (!c.side) { sl = Math.max(sl, v * 0.9); sb = Math.max(sb, v * 0.95); } // chương mở đầu: góc dưới-trái
          else if (c.el.classList.contains('is-low')) { sb = Math.max(sb, v); const s = v * 0.5; if (c.el.classList.contains('is-right')) sr = Math.max(sr, s); else sl = Math.max(sl, s); }
          else if (c.el.classList.contains('is-right')) sr = Math.max(sr, v);
          else sl = Math.max(sl, v);
        }
        if (Math.abs(v - c.v) < 0.002 && !(v === 0 && c.v !== 0) && !(v === 1 && c.v !== 1)) continue;
        // Tính lại trong đoạn chuyển cảnh ở cả hai chiều cuộn. Khi đã đọc ổn định thì
        // giữ nguyên vị trí để nội dung không bị xô ngang giữa chừng.
        if (v > 0.001 && (c.v <= 0.001 || v < 0.45)) placeChapter(c);
        c.v = v;
        c.el.style.setProperty('--v', v.toFixed(3));
        c.el.classList.toggle('is-vis', v > 0.001);        c.el.classList.toggle('is-on', v > 0.6);
      }
      setScrim(sl, sr, sb);
    }
    ticks.forEach(b => b.addEventListener('click', () => {
      window.scrollTo({ top: heroTop + (+b.dataset.k) * animEnd + 2, behavior: L.reduced ? 'auto' : 'smooth' });
    }));

    /* ================= HUD (tuỳ chọn — trang hiện không còn các ô này) ================= */
    const last = {};
    const setText = (k, v) => { if (last[k] !== v && hudEls[k]) { last[k] = v; hudEls[k].textContent = v; } };
    let lastTick = -1;
    function updateHud(p, t) {
      if (scene) { setText('frame', String(Math.round(t) + 1).padStart(3, '0')); setText('total', String(scene.n).padStart(3, '0')); }
      if (hudProgress) hudProgress.style.transform = `scaleX(${p.toFixed(4)})`;
      if (hudScroll) hudScroll.style.opacity = (1 - smooth(0.004, 0.04, p)).toFixed(3);
      if (ticks.length) {
        let best = 0, bd = 9;
        tickKs.forEach((k, i) => { const d = Math.abs(k - p); if (d < bd) { bd = d; best = i; } });
        if (best !== lastTick) { lastTick = best; ticks.forEach((b, i) => b.classList.toggle('is-active', i === best)); }
      }
    }

    /* ================= DỮ LIỆU: MANIFEST + CÁC BỘ KHUNG ================= */
    const pad3 = i => String(i).padStart(3, '0');
    const isFile = location.protocol === 'file:';

    function makeSet(name) {
      const def = scene.sets[name];
      const idx = def.frames || Array.from({ length: scene.n }, (_, i) => i);
      const set = { name, def, w: def.w, h: def.h, frames: null, started: false, inflight: 0, pending: idx.length, coarseLeft: 0, coarseBytes: 0, gotBytes: 0 };
      set.frames = idx.map((i, k) => ({
        i, k, set, url: base + def.dir + pad3(i) + '.webp', bytes: (def.bytes && def.bytes[k]) || 60000,
        x0: Array.isArray(def.x0) ? def.x0[k] : (def.x0 || 0),
        rank: Math.max(0, LEVELS.findIndex(s => i % s === 0)),      // 0 = mức thô nhất (tải trước)
        src: null, bmp: null, busy: null, loaded: false, queued: false, failed: false
      }));
      set.frames.forEach(f => { if (f.rank === 0) { set.coarseLeft++; set.coarseBytes += f.bytes; } });
      return set;
    }
    function pickSet() {
      const want = (sets.tall && W / H < TALL_ASPECT) ? sets.tall : sets.full;
      if (want === active) return;
      if (active) fallbackSet = active;                      // giữ khung cũ tới khi bộ mới vẽ được
      active = want;
      startLoading(active);
      dirty = true;
    }
    // p (0..1) -> thời điểm (khung, số thực) theo bảng map (cuộn đều => hình chuyển động đều)
    function timeOf(p) {
      const m = scene.map;
      if (!m) return p * (scene.n - 1);
      const x = clamp(p) * (m.length - 1), i = Math.min(m.length - 2, Math.floor(x));
      return m[i] + (m[i + 1] - m[i]) * (x - i);
    }
    function lowerBound(fr, t) { let lo = 0, hi = fr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (fr[m].i < t) lo = m + 1; else hi = m; } return lo; }
    // khung có trong bộ gần t nhất (bộ tall chỉ có khung chẵn)
    function nearestTime(set, t) {
      const fr = set.frames, hi = Math.min(fr.length - 1, lowerBound(fr, t)), lo = Math.max(0, hi - 1);
      return Math.abs(fr[lo].i - t) <= Math.abs(fr[hi].i - t) ? fr[lo].i : fr[hi].i;
    }

    /* ---------- tải file (thô -> mịn, gần vị trí hiện tại trước) ---------- */
    function loadImgEl(url) {
      return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(url)); im.src = url; });
    }
    function fetchFrame(f) {
      // file:// : fetch bị chặn -> dùng <img> (canvas vẫn vẽ được, chỉ không đọc lại điểm ảnh — ta không cần)
      if (isFile || typeof fetch !== 'function') return loadImgEl(f.url);
      return fetch(f.url).then(r => { if (!r.ok) throw new Error(r.status + ' ' + f.url); return r.blob(); }).catch(() => loadImgEl(f.url));
    }
    function startLoading(set) { if (set.started) return; set.started = true; pump(set); }
    function pump(set) {
      while (set.inflight < PAR && set.pending > 0) {
        let best = null, bs = Infinity;
        const rankW = readyFired ? 48 : 1e6;                  // trước khi mở trang: hoàn tất mức thô; sau đó: mịn quanh vị trí hiện tại trước
        for (const f of set.frames) {
          if (f.queued) continue;
          const s = f.rank * rankW + Math.abs(f.i - curT);
          if (s < bs) { bs = s; best = f; }
        }
        if (!best) break;
        best.queued = true; set.inflight++; set.pending--;
        fetchFrame(best).then(obj => { best.src = obj; best.loaded = true; }, () => { best.failed = true; console.warn('Hero: không tải được', best.url); })
          .then(() => {
            set.inflight--; set.gotBytes += best.bytes;
            if (best.rank === 0) {
              set.coarseLeft--;
              if (!readyFired && set === active) L.preloader.set(0.05 + 0.85 * clamp(set.gotBytes / set.coarseBytes));
            }
            if (!readyFired && set === active && set.coarseLeft <= 0) becomeReady();
            dirty = true;
            pump(set);
          });
      }
    }
    function becomeReady() {
      readyFired = true;
      const go = () => { dirty = true; L.preloader.set(1); L.preloader.ready(); };
      const fr = active.frames, k = lowerBound(fr, curT);
      const f0 = [fr[k], fr[k - 1], fr[k + 1]].find(f => f && f.loaded);
      if (f0) decode(f0).then(go, go); else go();
    }

    /* ---------- giải mã (ImageBitmap, ngoài luồng chính) ---------- */
    let inflightDecode = 0;
    const decodedList = [];
    function decode(f) {
      if (f.bmp) return Promise.resolve(f.bmp);
      if (f.busy) return f.busy;
      if (!f.loaded) return Promise.reject(new Error('chưa tải'));
      inflightDecode++;
      const t0 = performance.now();
      const done = bmp => { f.bmp = bmp; f.busy = null; inflightDecode--; decodedList.push(f); stats.decodes++; stats.decodeMs += performance.now() - t0; dirty = true; return bmp; };
      const fail = () => { f.busy = null; inflightDecode--; f.failed = true; f.loaded = false; };
      let p;
      if (typeof createImageBitmap === 'function') {
        p = createImageBitmap(f.src).then(done, () => (f.src instanceof HTMLImageElement ? done(f.src) : fail()));
      } else if (f.src instanceof HTMLImageElement) {
        p = Promise.resolve(done(f.src));
      } else {
        const url = URL.createObjectURL(f.src);
        p = loadImgEl(url).then(im => { URL.revokeObjectURL(url); return done(im); }, () => { URL.revokeObjectURL(url); fail(); });
      }
      f.busy = p;
      return p;
    }
    function release(f) {
      if (f.bmp && typeof f.bmp.close === 'function') f.bmp.close();
      f.bmp = null;
      const k = decodedList.indexOf(f);
      if (k >= 0) decodedList.splice(k, 1);
    }
    function releaseSet(set) { for (let k = decodedList.length - 1; k >= 0; k--) if (decodedList[k].set === set) release(decodedList[k]); }

    // chọn khung cần giải mã quanh t (ưu tiên theo hướng cuộn), thu hồi khung ở xa
    function schedule(t, dir, vel) {
      const fr = active.frames, n = fr.length, hi = lowerBound(fr, t);
      // tốc độ cao: mỗi tick màn hình nhảy ~vel/60 khung => chỉ cần giải mã các khung cách nhau đúng bước đó
      const stride = Math.max(1, Math.min(8, Math.round(Math.abs(vel) / 60)));
      const want = [];
      let a = dir >= 0 ? hi : hi - 1, b = dir >= 0 ? hi - 1 : hi, na = 0, nb = 0, guard = 0;
      while ((na < AHEAD || nb < BEHIND) && guard++ < 400) {
        let moved = false;
        if (na < AHEAD && a >= 0 && a < n) { if (fr[a].loaded && (na === 0 || (a - hi) % stride === 0)) { want.push(fr[a]); na++; } a += dir >= 0 ? 1 : -1; moved = true; }
        if (nb < BEHIND && b >= 0 && b < n) { if (fr[b].loaded && (nb === 0 || (b - hi) % stride === 0)) { want.push(fr[b]); nb++; } b += dir >= 0 ? -1 : 1; moved = true; }
        if (!moved) break;
      }
      want.sort((x, y) => Math.abs(x.i - t) - Math.abs(y.i - t));
      for (const f of want) { if (inflightDecode >= MAXQ) break; if (!f.bmp && !f.busy) decode(f); }
      const keep = Math.max(KEEP, AHEAD * stride + 2);
      for (let k = decodedList.length - 1; k >= 0; k--) {
        const f = decodedList[k];
        if (f.set === active && Math.abs(f.k - hi) > keep) release(f);
      }
    }

    /* ================= VẼ ================= */
    // hai khung đã giải mã kề t nhất (a <= t <= b)
    function neighbors(set, t) {
      const fr = set.frames, hi = lowerBound(fr, t);
      let a = null, b = null;
      for (let k = hi - 1, g = 0; k >= 0 && g < 120; k--, g++) if (fr[k].bmp) { a = fr[k]; break; }
      for (let k = hi, g = 0; k < fr.length && g < 120; k++, g++) if (fr[k].bmp) { b = fr[k]; break; }
      return [a, b];
    }
    let lastW = 0;
    function draw(t) {
      let set = active, [a, b] = neighbors(set, t);
      if (!a && !b && fallbackSet) { set = fallbackSet; [a, b] = neighbors(set, t); }
      if (!a && !b) return false;
      let A = a || b, B = b || a, w = 0;
      if (A !== B) {
        w = (t - A.i) / (B.i - A.i);
        if (B.i - A.i > 2.01) { if (w > 0.5) A = B; w = 0; }     // hai khung cách xa (đang tải): không hoà trộn, lấy khung gần hơn
      }
      if (w < 0.004) w = 0; else if (w > 0.996) { A = B; w = 0; }
      if (Math.abs(A.i - t) > 1.001 && !(w && Math.abs(B.i - t) <= 1.001)) stats.misses++;

      // hình học: phủ kín canvas, tâm cắt bám theo khuôn mặt (focus), có biên cho parallax chuột
      const sw = scene.w, sh = scene.h;
      const ti = clamp(t, 0, scene.n - 1), i0 = Math.floor(ti), fr = ti - i0, i1 = Math.min(scene.n - 1, i0 + 1);
      const fx = scene.fx[i0] + (scene.fx[i1] - scene.fx[i0]) * fr, fy = scene.fy[i0] + (scene.fy[i1] - scene.fy[i0]) * fr;
      const x0min = Math.min(A.x0, B.x0), x0max = Math.max(A.x0, B.x0);
      const availW = set.w - (x0max - x0min);                    // phần chung của hai khung (bộ tall cắt lệch nhau vài px)
      let s = Math.max(W / sw, H / sh, W / availW) * (noMouse ? 1 : MOUSE.zoom);   // px màn hình / px nguồn
      const vw = W / s, vhh = H / s;
      const mxo = noMouse ? 0 : -mx * MOUSE.x / s, myo = noMouse ? 0 : -my * MOUSE.y / s;
      const cx = clamp(fx * sw + mxo, x0max + vw / 2, x0min + set.w - vw / 2);
      const cy = clamp(fy * sh + myo, vhh / 2, sh - vhh / 2);
      const sx = cx - vw / 2, sy = cy - vhh / 2;
      const fh = scene.fh ? scene.fh[i0] + (scene.fh[i1] - scene.fh[i0]) * fr : 0.25;                 // chiều cao đầu (phần khung gốc)
      face = { x: (fx * sw - sx) / vw, y: (fy * sh - sy) / vhh, hw: 0.5 * fh * sh / vw };            // mặt trên màn hình (0..1) + nửa bề rộng đầu
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = 1;
      ctx.drawImage(A.bmp, sx - A.x0, sy, vw, vhh, 0, 0, canvas.width, canvas.height);
      if (w > 0) {
        ctx.globalAlpha = w;
        ctx.drawImage(B.bmp, sx - B.x0, sy, vw, vhh, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        stats.blends++;
      }
      lastW = w;
      if (set === active && fallbackSet) { releaseSet(fallbackSet); fallbackSet = null; }
      return true;
    }

    /* ================= TẢI MANIFEST ================= */
    function loadScript(url, key) {
      return new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = url;
        sc.onload = () => (window[key] ? res(window[key]) : rej(new Error(url)));
        sc.onerror = () => rej(new Error('không tải được ' + url));
        document.head.appendChild(sc);
      });
    }
    loadScript(base + 'scene.js', 'HERO_SEQ').then(s => {
      scene = s;
      sets.full = makeSet('full');
      if (scene.sets.tall) sets.tall = makeSet('tall');
      curT = timeOf(curP);
      pickSet();
    }).catch(e => { console.warn('Hero: dùng ảnh tĩnh —', e && e.message); L.preloader.ready(); });

    /* ================= NHẢY TỚI VỊ TRÍ (kiểm thử) ================= */
    L.heroSet = p => { measure(); window.scrollTo(0, heroTop + clamp(p) * animEnd); };
    if (snap) {
      const target = clamp(parseFloat(L.params.get('p')) || 0);
      L.on('ready', () => requestAnimationFrame(() => L.heroSet(target)));
      setTimeout(() => L.heroSet(target), 50);
    }
    const trace = [];
    if (debug) {
      const cnt = set => set ? { loaded: set.frames.filter(f => f.loaded).length, decoded: set.frames.filter(f => f.bmp).length, pending: set.pending, inflight: set.inflight, failed: set.frames.filter(f => f.failed).length } : null;
      L.heroDebug = {
        state() { return JSON.stringify({ set: active && active.name, curP: +curP.toFixed(4), curT: +curT.toFixed(3), full: cnt(sets.full), tall: cnt(sets.tall), inflightDecode, decodedList: decodedList.length, stats, size: [canvas.width, canvas.height], css: [W, H] }); },
        // chờ bộ khung đang dùng tải xong
        whenLoaded() { return new Promise(res => { const iv = setInterval(() => { if (active && active.pending === 0 && active.inflight === 0) { clearInterval(iv); res(L.heroDebug.state()); } }, 100); }); },
        trace,                      // [thời gian, curT, trọng số hoà trộn] mỗi tick (tối đa 6000 dòng)
        clearTrace() { trace.length = 0; },
        // vẽ đúng một thời điểm lẻ (vd. 120.5) để soi chất lượng hoà trộn giữa hai khung
        drawAt(t) {
          const fr = active.frames, k = lowerBound(fr, t);
          return Promise.all([fr[Math.max(0, k - 1)], fr[Math.min(fr.length - 1, k)]].map(f => decode(f)))
            .then(() => { draw(t); dirty = false; lastDrawT = curT; return 'ok ' + t; });
        }
      };
    }

    /* ================= VÒNG LẶP ================= */
    let wasVisible = true, lastC = -1, lastMx = 9, lastMy = 9, lastP = -1, lastDrawT = -1, dir = 1, shown = false, vel = 0, prevT = 0;
    L.tick(s => {
      const y = s.y - heroTop;
      const visible = y < heroH && y > -vh;
      if (!visible) { wasVisible = false; return; }
      if (!wasVisible) { wasVisible = true; dirty = true; }

      const target = clamp(y / animEnd);
      if (snap || L.reduced) curP = target;
      else {
        curP += (target - curP) * (1 - Math.exp(-s.dt * DAMP_P));
        if (Math.abs(target - curP) < 0.00004) curP = target;
      }
      if (scene) {
        let tT = timeOf(curP);
        const atRest = Math.abs(target - curP) < REST_EPS;
        if (atRest && active) tT = nearestTime(active, timeOf(target));   // sắp dừng: đậu đúng một khung có trong bộ (hình sắc, không đúp)
        if (snap || L.reduced) curT = tT;
        else {
          let step = (tT - curT) * (1 - Math.exp(-s.dt * (atRest ? DAMP_REST : DAMP_T)));
          const cap = VMAX * s.dt;                                         // vuốt mạnh: video không tua nhanh hơn VMAX khung/s
          if (step > cap) step = cap; else if (step < -cap) step = -cap;
          curT += step;
          if (Math.abs(tT - curT) < 0.002) curT = tT;
        }
        if (Math.abs(tT - curT) > 0.01) dir = tT > curT ? 1 : -1;
        vel += ((curT - prevT) / s.dt - vel) * (1 - Math.exp(-s.dt * 10)); prevT = curT;
      }
      const k2 = 1 - Math.exp(-s.dt * 4);
      mx += (tmx - mx) * k2; my += (tmy - my) * k2;
      const moving = Math.abs(curT - lastDrawT) > 0.0005 || Math.abs(mx - lastMx) > 0.0005 || Math.abs(my - lastMy) > 0.0005;

      if (active && (dirty || moving)) {
        schedule(curT, dir, vel);
        const t0 = performance.now();
        if (draw(curT)) {
          dirty = false; lastDrawT = curT; lastMx = mx; lastMy = my;
          stats.frames++; stats.ms += performance.now() - t0;
          if (!shown) { shown = true; canvas.style.opacity = '1'; }
        }
        if (layers) layers.style.transform = `translate3d(${(mx * 10).toFixed(2)}px, ${(my * 6).toFixed(2)}px, 0) rotateY(${(mx * 2).toFixed(3)}deg) rotateX(${(-my * 1.5).toFixed(3)}deg)`;
      }
      if (debug && trace.length < 6000) trace.push([+s.t.toFixed(3), +curT.toFixed(3), +lastW.toFixed(3)]);
      if (Math.abs(curP - lastP) > 0.00002 || moving) {
        updateChapters(curP);
        updateHud(curP, curT);
        lastP = curP;
      }

      // section kế tiếp trượt lên như một tấm thẻ
      const c = clamp((y - coverStart) / vh);
      if (Math.abs(c - lastC) > 0.001) {
        lastC = c;
        stage.style.transform = c > 0 ? `scale(${(1 - c * 0.08).toFixed(4)})` : '';
        stage.style.borderRadius = c > 0 ? `${(c * 36).toFixed(1)}px` : '';
        stage.style.overflow = c > 0 ? 'hidden' : '';
        stage.style.filter = c > 0 ? `brightness(${(1 - c * 0.5).toFixed(3)})` : '';
        const o = (1 - c * 1.6).toFixed(3);
        if (layersWrap) layersWrap.style.opacity = o;
        if (hud) hud.style.opacity = o;
        if (rail) rail.style.opacity = o;
      }
    });
  }
})();
