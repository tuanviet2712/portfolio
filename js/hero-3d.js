/* ==========================================================================
   HERO (BẢN CŨ, chỉ để so sánh: mở index.html?hero=3d) — THẾ GIỚI 3D THỜI GIAN THỰC
   (WebGL2), dựng từ MỘT ảnh gốc. Bản đang dùng là js/hero.js (video tua theo cuộn).

   Cách làm (học từ getlayers.ai/ascend — một cảnh 3D thật, camera chạy theo cuộn):
   - Không phát chuỗi ảnh nữa. Một ảnh gốc được tách thành 3 lớp có độ sâu
     (trời ở vô cực · tường · người — tools/hero3d/export_web.py) và dựng lại
     trong GPU MỖI LẦN màn hình làm tươi => chuyển động liên tục như video,
     không có "bậc" khung hình, không đổi môi trường (chỉ có MỘT thế giới).
   - Cuộn chỉ là ĐÍCH: tiến trình p tiến tới đích với giảm chấn (4.5/s), rồi tư
     thế camera lại tiến tới p với giảm chấn (3.2/s) — giảm chấn 2 tầng, đúng
     như Ascend, nên lăn chuột theo nấc vẫn ra chuyển động trơn.
   - Đường camera = keyframe nội suy PCHIP (đạo hàm liên tục, không vượt biên);
     yaw/pitch được GIẢI tự động để khuôn mặt luôn nằm đúng vị trí mong muốn
     trên khung (look-at) => bố cục chủ động, điện thoại dọc tự căn mặt.
   - "Sống": mây trôi chậm, camera trôi nhẹ khi đứng yên, parallax theo chuột,
     cảnh "trôi vào" một lần khi mở trang (như planet float-up của Ascend).
   - Dữ liệu ~0,6 MB (5 texture) thay cho 19 MB ảnh chuỗi.
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const { $, $$, clamp, lerp, smooth } = L;
  const DEG = Math.PI / 180;

  const DEFAULT_SRC = 'a08';                 // thư mục assets/hero/<src>/ (đổi ảnh gốc: chạy export_web.py --anchor N)
  const TOTAL_FRAMES = 240;                  // chỉ số "CAM" trên HUD (thẩm mỹ — camera ảo chạy liên tục)
  const FOVY_MAX = 48;                       // màn hình dọc: góc nhìn dọc tối đa (độ) để không vượt khỏi vùng ảnh
  const DAMP_P = 4.5, DAMP_POSE = 3.2;       // giảm chấn 2 tầng (1/s) — như Ascend
  const HEIGHTS = ['Thấp', 'Ngang hông', 'Ngực dưới', 'Ngực trên', 'Dưới tầm mắt', 'Ngang tầm mắt'];

  /* Đường camera theo tiến trình p. Toạ độ (mét) trong hệ camera của ảnh gốc: x phải, y XUỐNG, z tới.
     fx, fy: vị trí khuôn mặt trên khung nhìn (0..1) — yaw/pitch tự giải để mặt nằm đúng đó.
     Camera đi từ thấp-trái-xa (ngẩng nhìn) lên ngang tầm mắt, vòng sang phải, tiến lại gần (như 8 ảnh tham chiếu). */
  const PATH = [
    { p: 0.00, pos: [-0.035, 0.060, -0.050], fx: 0.52, fy: 0.35, roll: 1.2, fov: 63 },
    { p: 0.28, pos: [-0.028, 0.045, -0.035], fx: 0.51, fy: 0.35, roll: 0.9, fov: 63.5 },
    { p: 0.58, pos: [0.005, 0.015, -0.005], fx: 0.42, fy: 0.34, roll: 0.3, fov: 63 },
    { p: 0.88, pos: [0.045, -0.025, 0.018], fx: 0.35, fy: 0.36, roll: -0.3, fov: 62.2 },
    { p: 1.00, pos: [0.050, -0.030, 0.020], fx: 0.34, fy: 0.36, roll: -0.4, fov: 62 }
  ];
  const PORTRAIT = { fx: 0.50, fy: 0.40, back: 0.06 };          // màn hình dọc: mặt ở đâu trên khung, camera lùi thêm (m)
  const ENTRY = { dur: 2.4, z: -0.04, y: 0.02, fov: 1.0 };      // cảnh "trôi vào" khi mở trang
  const MOUSE = { x: 0.02, y: 0.012, yaw: 0.6, pitch: 0.4 };    // parallax chuột (mét / độ)
  const FLOAT = { x: 0.005, y: 0.0035, yaw: 0.2, pitch: 0.14 }; // camera trôi nhẹ khi đứng yên

  /* ---------------- toán ---------------- */
  // nội suy PCHIP (Fritsch–Carlson): mượt, không vượt quá keyframe
  function pchip(xs, ys) {
    const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    if (n === 2) m[0] = m[1] = d[0];
    else {
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      }
      const edge = (h0, h1, d0, d1) => {
        let t = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
        if (Math.sign(t) !== Math.sign(d0)) t = 0;
        else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(t) > 3 * Math.abs(d0)) t = 3 * d0;
        return t;
      };
      m[0] = edge(h[0], h[1], d[0], d[1]);
      m[n - 1] = edge(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (i < n - 2 && x > xs[i + 1]) i++;
      const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
    };
  }
  const KEYS = ['x', 'y', 'z', 'fx', 'fy', 'roll', 'fov'];
  const ps = PATH.map(k => k.p);
  const curves = {
    x: pchip(ps, PATH.map(k => k.pos[0])), y: pchip(ps, PATH.map(k => k.pos[1])), z: pchip(ps, PATH.map(k => k.pos[2])),
    fx: pchip(ps, PATH.map(k => k.fx)), fy: pchip(ps, PATH.map(k => k.fy)), roll: pchip(ps, PATH.map(k => k.roll)), fov: pchip(ps, PATH.map(k => k.fov))
  };
  const sampleKeys = p => { const o = {}; KEYS.forEach(k => (o[k] = curves[k](p))); return o; };

  // R = Ry(yaw)·Rx(pitch)·Rz(roll) (camera -> thế giới), trả về 9 số theo HÀNG (= R^T theo cột cho GLSL)
  function rotYXZ(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const a00 = cr, a01 = -sr, a02 = 0, a10 = cp * sr, a11 = cp * cr, a12 = -sp, a20 = sp * sr, a21 = sp * cr, a22 = cp;
    return [cy * a00 + sy * a20, cy * a01 + sy * a21, cy * a02 + sy * a22, a10, a11, a12, -sy * a00 + cy * a20, -sy * a01 + cy * a21, -sy * a02 + cy * a22];
  }
  // giải yaw/pitch để điểm F hiện đúng vị trí (tx, ty) trên khung nhìn
  function solveLook(C, F, fxn, fyn, tx, ty, roll) {
    const dx = F[0] - C[0], dy = F[1] - C[1], dz = F[2] - C[2];
    const ax = Math.atan((tx - 0.5) / fxn), ay = Math.atan((ty - 0.5) / fyn);
    let yaw = Math.atan2(dx, dz) - ax, pitch = Math.atan2(-dy, Math.hypot(dx, dz)) + ay;
    for (let it = 0; it < 2; it++) {
      const r = rotYXZ(yaw, pitch, roll);
      const px = r[0] * dx + r[3] * dy + r[6] * dz, py = r[1] * dx + r[4] * dy + r[7] * dz, pz = r[2] * dx + r[5] * dy + r[8] * dz;
      yaw += Math.atan((fxn * px / pz)) - ax;
      pitch -= Math.atan((fyn * py / pz)) - ay;
    }
    return [yaw, pitch];
  }

  /* ---------------- shader ---------------- */
  const VS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D u_depth; uniform ivec2 u_grid; uniform int u_layer; uniform vec2 u_range;
uniform vec4 u_K; uniform vec4 u_ext; uniform mat3 u_Rt; uniform vec3 u_C; uniform vec4 u_Kv; uniform vec2 u_nf;
uniform float u_skyDepth, u_skyScale; uniform int u_dbg;
out vec2 v_uv;
void main() {
  int id = gl_VertexID; int i = id % u_grid.x; int j = id / u_grid.x;
  vec2 uv = (vec2(i, j) + 0.5) / vec2(u_grid);
  if (i == 0) uv.x = 0.0; if (i == u_grid.x - 1) uv.x = 1.0;
  if (j == 0) uv.y = 0.0; if (j == u_grid.y - 1) uv.y = 1.0;
  float d; vec2 g = uv;
  if (u_layer == 2) { d = u_skyDepth; g = (uv - 0.5) * u_skyScale + 0.5; }        // trời: mái vòm rộng hơn ảnh, mép kéo dài
  else {
    vec4 t = texelFetch(u_depth, ivec2(i, j + (u_layer == 1 ? u_grid.y : 0)), 0);   // 16-bit: R byte cao, G byte thấp
    d = 1.0 / mix(u_range.x, u_range.y, (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0);
    if (u_dbg == 1) {   // kiểm thử độ phủ: kéo vành ngoài của lưới ra xa để tô hồng chỗ texture bị hụt
      if (i == 0) g.x = -0.4; if (i == u_grid.x - 1) g.x = 1.4;
      if (j == 0) g.y = -0.4; if (j == u_grid.y - 1) g.y = 1.4;
    }
  }
  float u = g.x * u_ext.x - u_ext.z, v = g.y * u_ext.y - u_ext.w;                   // toạ độ chuẩn hoá trên khung gốc
  vec3 X = vec3((u - u_K.z) / u_K.x * d, (v - u_K.w) / u_K.y * d, d);              // điểm 3D trong hệ camera gốc
  vec3 p = u_Rt * (X - u_C);                                                        // -> camera ảo
  float z = p.z, n = u_nf.x, f = u_nf.y;
  gl_Position = vec4(2.0 * u_Kv.x * p.x + (2.0 * u_Kv.z - 1.0) * z, -(2.0 * u_Kv.y * p.y + (2.0 * u_Kv.w - 1.0) * z), (z * (f + n) - 2.0 * f * n) / (f - n), z);
  v_uv = g;
}`;
  const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D u_tex, u_mask; uniform int u_layer; uniform vec2 u_skyShift; uniform int u_dbg;
in vec2 v_uv; out vec4 o;
void main() {
  if (u_dbg == 1 && u_layer != 2 && (v_uv.x < 0.0 || v_uv.x > 1.0 || v_uv.y < 0.0 || v_uv.y > 1.0)) {
    vec2 cu = clamp(v_uv, 0.0, 1.0);                       // ngoài texture: hồng nếu mép là tường/người (thiếu dữ liệu), bỏ nếu mép là trời
    float ab = (u_layer == 0) ? texture(u_mask, cu).r : texture(u_mask, cu).g;
    if (ab < 0.5) discard;
    o = vec4(1.0, 0.0, 1.0, 1.0); return;
  }
  float a = 1.0;
  if (u_layer == 0) a = texture(u_mask, v_uv).r; else if (u_layer == 1) a = texture(u_mask, v_uv).g;
  if (a < 0.004) discard;
  vec3 c = texture(u_tex, u_layer == 2 ? v_uv + u_skyShift : v_uv).rgb;
  o = vec4(c * a, a);
}`;

  // được js/hero.js chèn vào khi có ?hero=3d (có thể sau DOMContentLoaded)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

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
    if (hudEls.total) hudEls.total.textContent = String(TOTAL_FRAMES).padStart(3, '0');
    const ticks = $$('.hud__tick', hero);
    const tickKs = ticks.map(b => +b.dataset.k);

    const src = (L.params.get('src') || DEFAULT_SRC).replace(/[^a-z0-9_-]/gi, '');
    const base = `assets/hero/${src}/`;
    const snap = L.params.has('p');                 // ?p=0.5 : nhảy thẳng tới vị trí, không giảm chấn (kiểm thử / chụp ảnh)
    const noFloat = snap || L.reduced || L.params.has('nofloat');
    const debug = L.params.has('herodebug');
    const stats = (L.heroStats = { frames: 0, ms: 0, gl: false });

    /* ================= KÍCH THƯỚC & MỐC CUỘN ================= */
    let W = 1, H = 1, dpr = 1, heroTop = 0, heroH = 1, vh = innerHeight, animEnd = 1, coverStart = 1, dirty = true;
    function measure() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2, 2560 / W);   // giới hạn ~3,7 MP để GPU yếu vẫn 60 fps
      dpr = Math.max(1, dpr);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      vh = innerHeight;
      heroTop = hero.getBoundingClientRect().top + window.scrollY;
      heroH = hero.offsetHeight;
      const nextEl = hero.nextElementSibling;
      const nextTop = nextEl ? nextEl.getBoundingClientRect().top + window.scrollY : heroTop + heroH;
      coverStart = nextTop - vh - heroTop;             // lúc section kế tiếp bắt đầu trượt lên
      animEnd = Math.max(vh, coverStart - vh * 0.55);  // giữ tư thế cuối ~0.55 màn hình để đọc CTA
      dirty = true;
    }
    measure();
    L.onResize(measure);

    /* ================= PARALLAX CHUỘT ================= */
    let tmx = 0, tmy = 0, mx = 0, my = 0;
    if (L.fine && !L.reduced) {
      hero.addEventListener('pointermove', e => { tmx = (e.clientX / W - 0.5) * 2; tmy = (e.clientY / H - 0.5) * 2; }, { passive: true });
      hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0; });
    }

    /* ================= CHƯƠNG NỘI DUNG ================= */
    const chs = $$('.ch', layers).map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, f: +(el.dataset.fade || 0.05), v: -1 }));
    function updateChapters(p) {
      for (const c of chs) {
        const vin = c.a < 0 ? 1 : smooth(c.a - c.f, c.a, p);
        const v = vin * (1 - smooth(c.b, c.b + c.f, p));
        if (Math.abs(v - c.v) < 0.002 && !(v === 0 && c.v !== 0) && !(v === 1 && c.v !== 1)) continue;
        c.v = v;
        c.el.style.setProperty('--v', v.toFixed(3));
        c.el.classList.toggle('is-vis', v > 0.001);
        c.el.classList.toggle('is-on', v > 0.6);
      }
    }
    ticks.forEach(b => b.addEventListener('click', () => {
      window.scrollTo({ top: heroTop + (+b.dataset.k) * animEnd + 2, behavior: L.reduced ? 'auto' : 'smooth' });
    }));

    /* ================= HUD ================= */
    const last = {};
    const setText = (k, v) => { if (last[k] !== v && hudEls[k]) { last[k] = v; hudEls[k].textContent = v; } };
    const fmtDeg = v => (v > 0.05 ? '+' : v < -0.05 ? '−' : '±') + Math.abs(v).toFixed(1) + '°';
    let lastTick = -1;
    function updateHud(p, yawDeg, pitchDeg) {
      setText('frame', String(Math.round(p * (TOTAL_FRAMES - 1)) + 1).padStart(3, '0'));
      setText('orbit', fmtDeg(yawDeg));
      setText('pitch', fmtDeg(pitchDeg));
      setText('height', HEIGHTS[Math.min(HEIGHTS.length - 1, Math.round(p * (HEIGHTS.length - 1)))]);
      if (hudProgress) hudProgress.style.transform = `scaleX(${p.toFixed(4)})`;
      if (hudScroll) hudScroll.style.opacity = (1 - smooth(0.004, 0.04, p)).toFixed(3);
      let best = 0, bd = 9;
      tickKs.forEach((k, i) => { const d = Math.abs(k - p); if (d < bd) { bd = d; best = i; } });
      if (best !== lastTick) { lastTick = best; ticks.forEach((b, i) => b.classList.toggle('is-active', i === best)); }
    }

    /* ================= TRẠNG THÁI CAMERA ================= */
    const cur = sampleKeys(0);
    let curP = 0, kick = 0, lastP = -1, entryT0 = -1, dir = 1;
    let scene = null, draw = null;    // draw(cam, t) do WebGL hoặc dự phòng 2D cung cấp
    let camState = { yaw: 0, pitch: 0 };

    function composeCamera(p, keys, t, mxv, myv, entryForce) {
      // cảnh "trôi vào": 1 -> 0 trong ENTRY.dur giây kể từ lúc mở trang (entryForce = 1: kiểm thử trường hợp xấu nhất)
      let en = entryForce || 0;
      if (!entryForce && entryT0 >= 0) { const e = clamp((t - entryT0) / ENTRY.dur); en = Math.pow(1 - e, 3); }
      // góc nhìn: ngang theo keyframe; màn hình dọc giới hạn góc dọc và tự căn mặt
      const aspect = W / H;
      const fov = keys.fov + kick + ENTRY.fov * en;
      let fxn = 1 / (2 * Math.tan(fov * 0.5 * DEG)), fyn = fxn * aspect;
      const fynMin = 1 / (2 * Math.tan(FOVY_MAX * 0.5 * DEG));
      if (fyn < fynMin) { fyn = fynMin; fxn = fyn / aspect; }
      const portrait = clamp((1.35 - aspect) / 0.75);
      const tx = lerp(keys.fx, PORTRAIT.fx, portrait), ty = lerp(keys.fy, PORTRAIT.fy, portrait);
      // vị trí camera + cảnh trôi vào + parallax chuột + trôi nhẹ
      const fl = noFloat ? 0 : 1;
      const C = [keys.x + mxv * MOUSE.x + fl * FLOAT.x * Math.sin(t * 0.31),
        keys.y + ENTRY.y * en + myv * MOUSE.y + fl * FLOAT.y * Math.sin(t * 0.47 + 1.3),
        keys.z + ENTRY.z * en - PORTRAIT.back * portrait];
      const F = [scene.face.x, scene.face.y, scene.face.z];
      const roll = keys.roll * DEG;
      let [yaw, pitch] = solveLook(C, F, fxn, fyn, tx, ty, roll);
      yaw += (mxv * MOUSE.yaw + fl * FLOAT.yaw * Math.sin(t * 0.23 + 0.7)) * DEG;
      pitch += (-myv * MOUSE.pitch + fl * FLOAT.pitch * Math.sin(t * 0.37)) * DEG;
      camState = { yaw, pitch };
      return { R: rotYXZ(yaw, pitch, roll), C, fxn, fyn, yaw, pitch };
    }

    /* ================= WEBGL ================= */
    let gl = null, prog = null, U = {}, tex = {}, ibo = {}, nFull = 0, nFg = 0, bitmaps = {}, lost = false;
    function initGL() {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) return false;
      const sh = (type, srcCode) => {
        const s = gl.createShader(type); gl.shaderSource(s, srcCode); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
      U = {};
      ['u_depth', 'u_grid', 'u_layer', 'u_range', 'u_K', 'u_ext', 'u_Rt', 'u_C', 'u_Kv', 'u_nf', 'u_skyDepth', 'u_skyScale', 'u_tex', 'u_mask', 'u_skyShift', 'u_dbg']
        .forEach(n => (U[n] = gl.getUniformLocation(prog, n)));
      gl.useProgram(prog);
      const [N, M] = scene.grid;
      gl.uniform2i(U.u_grid, N, M);
      gl.uniform4f(U.u_K, scene.K[0], scene.K[1], scene.K[2], scene.K[3]);
      gl.uniform4f(U.u_ext, scene.WE / scene.W, scene.HE / scene.H, scene.pad.l / scene.W, scene.pad.t / scene.H);
      gl.uniform2f(U.u_nf, 0.05, 1000);
      gl.uniform1f(U.u_skyDepth, scene.skyDepth || 400);
      gl.uniform1f(U.u_skyScale, 1.6);
      gl.uniform1i(U.u_tex, 0); gl.uniform1i(U.u_mask, 1); gl.uniform1i(U.u_depth, 2);
      // chỉ số tam giác của lưới (đỉnh tính từ gl_VertexID, không cần vertex buffer)
      const grid = (i0, j0, i1, j1) => {
        const idx = new Uint32Array((i1 - i0) * (j1 - j0) * 6); let k = 0;
        for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
          const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
          idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
        }
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        return [buf, idx.length];
      };
      [ibo.full, nFull] = grid(0, 0, N - 1, M - 1);
      const bx = scene.fgBox;
      [ibo.fg, nFg] = grid(bx[0], bx[1], Math.min(N - 1, bx[2]), Math.min(M - 1, bx[3]));
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      return true;
    }
    function makeTex(img, kind) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (kind === 'depth') {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      } else {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const an = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
      return t;
    }
    function uploadAll() {
      tex = { sky: makeTex(bitmaps.sky), bg: makeTex(bitmaps.bg), fg: makeTex(bitmaps.fg), masks: makeTex(bitmaps.masks), depth: makeTex(bitmaps.depth, 'depth') };
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.masks);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex.depth);
      gl.activeTexture(gl.TEXTURE0);
    }
    let skyShift = [0, 0];
    function drawLayer(layer, t, buf, n, range) {
      gl.uniform1i(U.u_layer, layer);
      gl.uniform2f(U.u_range, range[0], range[1]);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
      gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_INT, 0);
    }
    function drawGL(cam, magenta) {
      if (lost) return false;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (magenta) gl.clearColor(1, 0, 1, 1); else gl.clearColor(0.55, 0.72, 0.95, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniformMatrix3fv(U.u_Rt, false, cam.R);
      gl.uniform3f(U.u_C, cam.C[0], cam.C[1], cam.C[2]);
      gl.uniform4f(U.u_Kv, cam.fxn, cam.fyn, 0.5, 0.5);
      gl.uniform2f(U.u_skyShift, skyShift[0], skyShift[1]);
      gl.uniform1i(U.u_dbg, magenta ? 1 : 0);
      gl.depthMask(true);
      drawLayer(2, tex.sky, ibo.full, nFull, scene.disp.bg);
      drawLayer(0, tex.bg, ibo.full, nFull, scene.disp.bg);
      gl.depthMask(false);
      drawLayer(1, tex.fg, ibo.fg, nFg, scene.disp.fg);
      gl.depthMask(true);
      return true;
    }

    /* ================= DỰ PHÒNG 2D (không có WebGL2) ================= */
    function initFallback(reason) {
      if (reason) console.warn('Hero: dùng ảnh tĩnh —', reason);
      const ctx = canvas.getContext('2d');
      const img = new Image();
      let ok = false;
      img.onload = () => { ok = true; dirty = true; L.preloader.ready(); };
      img.onerror = () => L.preloader.ready();
      img.src = `assets/frames/frame-${String((scene && scene.anchor) || 8).padStart(2, '0')}.jpg`;
      draw = (cam, _dbg, p) => {
        if (!ok || !ctx) return false;
        const zoom = 1.04 + p * 0.1;
        const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(img, clamp((W - dw) / 2 - mx * 12 + (0.5 - p) * W * 0.08, W - dw, 0), clamp((H - dh) / 2 - my * 8, H - dh, 0), dw, dh);
        return true;
      };
    }

    /* ================= TẢI DỮ LIỆU ================= */
    function loadImgEl(url) {
      return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(url)); im.src = url; });
    }
    function fetchImage(url, onBytes) {
      const decode = blob => (typeof createImageBitmap === 'function'
        ? createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).catch(() => createImageBitmap(blob))
        : Promise.reject(new Error('no ImageBitmap')));
      if (typeof fetch !== 'function') return loadImgEl(url);
      return fetch(url).then(async r => {
        if (!r.ok) throw new Error(r.status + ' ' + url);
        if (!r.body || !onBytes) return r.blob();
        const reader = r.body.getReader(); const chunks = []; let n = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; onBytes(n); }
        return new Blob(chunks);
      }).then(decode).catch(() => loadImgEl(url));
    }
    function loadScript(url, key) {
      return new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = url;
        sc.onload = () => (window[key] ? res(window[key]) : rej(new Error(url)));
        sc.onerror = () => rej(new Error('không tải được ' + url));
        document.head.appendChild(sc);
      });
    }
    const isFile = location.protocol === 'file:';
    function loadTextures() {
      const names = ['sky', 'bg', 'fg', 'masks', 'depth'];
      // điện thoại / màn nhỏ: bộ texture 1/2 cỡ (nhẹ hơn 4 lần); mở trực tiếp file:// : dữ liệu base64 trong bundle.js
      // (trình duyệt coi ảnh file:// là khác nguồn nên WebGL không được đọc; ảnh data: thì được)
      const small = scene.filesSmall && W * dpr < 1300;
      const files = small ? scene.filesSmall : scene.files;
      const bytes = (small ? scene.bytesSmall : scene.bytes) || {};
      if (isFile && scene.bundle) {
        L.preloader.set(0.15);
        return loadScript(base + scene.bundle, 'HERO_DATA').then(data => Promise.all(names.map((n, k) =>
          loadImgEl(data[n]).then(im => { bitmaps[n] = im; L.preloader.set(0.3 + 0.65 * (k + 1) / names.length); }))));
      }
      const total = names.reduce((s, n) => s + (bytes[n] || 200000), 0);
      const got = {};
      const report = () => L.preloader.set(0.05 + 0.9 * Object.values(got).reduce((a, b) => a + b, 0) / total);
      return Promise.all(names.map(n => fetchImage(base + files[n], b => { got[n] = b; report(); })
        .then(im => { bitmaps[n] = im; got[n] = bytes[n] || 200000; report(); })));
    }

    loadScript(base + 'scene.js', 'HERO_SCENE').then(s => {
      scene = s;
      Object.assign(cur, sampleKeys(0));
      let glOK = false;
      if (L.params.has('nogl')) { initFallback('?nogl'); return; }      // ?nogl : xem bản dự phòng (ảnh tĩnh)
      try { glOK = initGL(); } catch (e) { console.warn('Hero WebGL:', e.message); glOK = false; }
      if (!glOK) { initFallback('trình duyệt không hỗ trợ WebGL2'); return; }
      stats.gl = true;
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; }, false);
      canvas.addEventListener('webglcontextrestored', () => { try { initGL(); uploadAll(); lost = false; dirty = true; } catch (e) { initFallback(e.message); } }, false);
      return loadTextures().then(() => {
        uploadAll();
        draw = drawGL;
        dirty = true;
        L.preloader.set(1);
        L.preloader.ready();
      });
    }).catch(e => { initFallback(e && e.message); });

    L.on('ready', () => { if (!noFloat) entryT0 = performance.now() / 1000; dirty = true; });

    /* ================= NHẢY TỚI VỊ TRÍ (kiểm thử) ================= */
    L.heroSet = p => { measure(); window.scrollTo(0, heroTop + clamp(p) * animEnd); };
    if (snap) {
      const target = clamp(parseFloat(L.params.get('p')) || 0);
      L.on('ready', () => requestAnimationFrame(() => L.heroSet(target)));
      setTimeout(() => L.heroSet(target), 50);
    }
    if (debug) {
      // quét độ phủ: đếm điểm ảnh không được lớp nào che (tô hồng) trên toàn hành trình + 4 góc parallax chuột
      L.heroDebug = {
        // vẽ 1 khung kiểm thử (vùng hồng = thiếu texture) và giữ trên canvas để chụp ảnh
        show(p = 0, a = 0, b = 0, en = 0) {
          if (!gl || !tex.sky) return 'chưa sẵn sàng';
          drawGL(composeCamera(p, sampleKeys(p), 0, a, b, en), true);
          dirty = false; debugHold = performance.now() + 5000;   // giữ khung kiểm thử 5 s, vòng lặp không vẽ đè
          return 'ok';
        },
        sweep(steps = 41, extremes = true) {
          if (!gl || !tex.sky) return Promise.resolve('chưa sẵn sàng');
          const w = canvas.width, h = canvas.height, buf = new Uint8Array(w * h * 4), out = [];
          const combos = extremes ? [[0, 0, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0], [-1, -1, 1], [1, 1, 1]] : [[0, 0, 0]];
          for (let s = 0; s <= steps; s++) {
            const p = s / steps; let worst = 0;
            for (const [a, b, en] of combos) {
              const cam = composeCamera(p, sampleKeys(p), 0, a, b, en);
              drawGL(cam, true);
              gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
              let bad = 0;
              for (let i = 0; i < buf.length; i += 4) if (buf[i] > 250 && buf[i + 1] < 6 && buf[i + 2] > 250) bad++;
              worst = Math.max(worst, bad / (w * h));
            }
            out.push({ p: +p.toFixed(3), uncovered: +(worst * 100).toFixed(3), yaw: +(camState.yaw / DEG).toFixed(2), pitch: +(camState.pitch / DEG).toFixed(2) });
          }
          dirty = true;
          return Promise.resolve(JSON.stringify({ size: [w, h], max: Math.max(...out.map(o => o.uncovered)), rows: out }));
        }
      };
    }

    /* ================= VÒNG LẶP ================= */
    let wasVisible = true, lastC = -1, lastMx = 9, lastMy = 9, debugHold = 0;
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
      if (Math.abs(target - curP) > 0.0005) dir = target > curP ? 1 : -1;
      // tư thế camera tiến tới đường camera tại curP (tầng giảm chấn thứ 2)
      const want = sampleKeys(curP);
      const k = (snap || L.reduced) ? 1 : 1 - Math.exp(-s.dt * DAMP_POSE);
      let moving = false;
      for (const key of KEYS) { const d = want[key] - cur[key]; if (Math.abs(d) > 1e-6) moving = true; cur[key] += d * k; }
      const k2 = 1 - Math.exp(-s.dt * 4);
      mx += (tmx - mx) * k2; my += (tmy - my) * k2;
      const speed = lastP < 0 ? 0 : Math.abs(curP - lastP) / s.dt;
      kick += (Math.min(1.2, speed * 2.2) - kick) * (1 - Math.exp(-s.dt * 5));   // "dolly" nhẹ (độ) khi camera chạy nhanh
      const t = s.t;
      if (!noFloat) skyShift = [0.02 * Math.sin(t * 0.05), 0.006 * Math.sin(t * 0.037)];   // mây trôi chậm (biên độ hữu hạn)
      const entering = entryT0 >= 0 && t - entryT0 < ENTRY.dur + 0.1;

      const needDraw = dirty || moving || entering || !noFloat || Math.abs(mx - lastMx) > 0.0005 || Math.abs(my - lastMy) > 0.0005 || Math.abs(kick) > 0.01;
      if (needDraw && draw && scene && performance.now() > debugHold) {
        const t0 = performance.now();
        const cam = composeCamera(curP, cur, t, mx, my);
        if (draw(cam, false, curP)) { dirty = false; stats.frames++; stats.ms += performance.now() - t0; }
        lastMx = mx; lastMy = my;
        if (layers) layers.style.transform = `translate3d(${(mx * 10).toFixed(2)}px, ${(my * 6).toFixed(2)}px, 0) rotateY(${(mx * 2).toFixed(3)}deg) rotateX(${(-my * 1.5).toFixed(3)}deg)`;
      }
      if (Math.abs(curP - lastP) > 0.00002 || needDraw) {
        updateChapters(curP);
        updateHud(curP, camState.yaw / DEG, camState.pitch / DEG);
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
