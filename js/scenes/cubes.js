/* ==========================================================================
   CẢNH ② — BĂNG CHỮ KỸ NĂNG → "THẾ GIỚI KHỐI CHỮ 3D" (học từ santalarch.com, cảnh "Perception")
   1. Băng chữ chạy như cũ trên nền sáng; một dải sáng quét ngang, phía sau dải là không gian navy
   2. Kim tự tháp khối lập phương mọc lên, 6 cụm chữ của băng (Master Plan, IMC, Performance Marketing,
      Content & SEO, E-commerce, AI & Vibe Coding) in trên mặt khối; các tầng trượt như thang cuốn
   3. Máy quay vòng lên nhìn thẳng từ trên xuống, rồi lao vào mặt trên một khối: mặt khối sáng dần
      thành nền của section "Giá trị tôi mang lại" → cảnh sau bắt đầu ngay bên trong khối
   Toàn bộ khối, cạnh, chữ được đặt vị trí trong shader (3 lần vẽ cho ~270 khối), chuyển động chỉ là uniform.
   Rê chuột: vệt sáng chạy dọc các cạnh gần con trỏ, cả cảnh nghiêng nhẹ theo chuột.
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const S = L && L.stage;
  if (!S || S.off) return;
  const { $, clamp } = L;
  const { r, ease, mix } = S;

  const WORDS = ['Master Plan', 'IMC', 'Performance Marketing', 'Content & SEO', 'E-commerce', 'AI & Vibe Coding'];

  document.addEventListener('DOMContentLoaded', () => {
    const el = $('.marquee');
    if (!el) return;
    if (!el.id) el.id = 'bang-ky-nang';
    S.add({
      el, len: 3.0,
      snaps: null,
      init(sc) {
        el.classList.add('cw');
        const st = sc.sticky;
        st.insertAdjacentHTML('beforeend',
          '<div class="cw-dark" aria-hidden="true"><div class="cw-gl"></div><div class="cw-vig"></div></div>' +
          '<div class="cw-band" aria-hidden="true"></div><div class="cw-portal" aria-hidden="true"></div>');
        sc.dark = $('.cw-dark', st); sc.band = $('.cw-band', st); sc.portal = $('.cw-portal', st); sc.vig = $('.cw-vig', st);
        sc.gl.host = $('.cw-gl', st);
        sc.lw = -1; sc.lpo = -1;
        st.addEventListener('pointermove', e => {
          sc.tmx = (e.clientX / innerWidth) * 2 - 1;
          sc.tmy = -((e.clientY / innerHeight) * 2 - 1);
          sc.hover = true;
        }, { passive: true });
        st.addEventListener('pointerleave', () => (sc.hover = false));
        sc.tmx = 0; sc.tmy = 0; sc.mx = 0; sc.my = 0; sc.hk = 0;
      },
      update(sc) {
        // dải sáng quét ngang (p 0.02 → 0.17): bên trái dải đã là không gian navy
        const w = ease.inOut(r(sc.p, 0.02, 0.17));
        if (Math.abs(w - sc.lw) > 0.0004) {
          sc.lw = w;
          sc.dark.style.clipPath = w >= 1 ? 'none' : `inset(0 ${((1 - w) * 100).toFixed(2)}% 0 0)`;
          sc.band.style.transform = `translate3d(${(w * 100).toFixed(2)}vw,0,0)`;
          sc.band.style.opacity = w > 0 && w < 1 ? '1' : '0';
        }
        // cổng cuối: mặt khối phủ kín màn hình bằng màu nền của section sau
        const po = r(sc.p, 0.955, 0.99);
        if (Math.abs(po - sc.lpo) > 0.002) { sc.lpo = po; sc.portal.style.opacity = po.toFixed(3); }
      },
      gl: { host: null, init: glInit, render: glRender, when: sc => sc.p > 0.015 && sc.p < 0.995 }
    });
  });

  /* ---------------- chữ: atlas canvas (font Be Vietnam Pro của trang) ---------------- */
  // mặt trước: ô vuông 512×512 = đúng một mặt khối, chữ tối đa 2 dòng neo góc dưới trái (không tràn sang khối bên
  // cạnh, nên không bị khối gần hơn che mất); mặt bên: ô 512×128, chữ nhỏ một dòng
  const LINES = [['Master', 'Plan'], ['IMC'], ['Performance', 'Marketing'], ['Content &', 'SEO'], ['E-commerce'], ['AI & Vibe', 'Coding']];
  function buildAtlas(THREE) {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const font = (w, px) => `${w} ${px}px "Be Vietnam Pro", system-ui, sans-serif`;
    const ls = px => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-0.035 * px).toFixed(1)}px`; };
    const cells = [];
    LINES.forEach((lines, i) => {
      const x = (i % 4) * 512, y = Math.floor(i / 4) * 512;
      let px = 132;
      ctx.font = font(500, px); ls(px);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      if (widest > 430) { px = Math.floor((px * 430) / widest); ctx.font = font(500, px); ls(px); }
      const lh = px * 1.02;
      lines.forEach((l, k) => ctx.fillText(l, x + 44, y + 512 - 52 - (lines.length - 1 - k) * lh));
      cells.push({ u: x / 2048, v: y / 1024, uw: 512 / 2048, vh: 512 / 1024, aspect: 1 });
    });
    WORDS.forEach((word, i) => {
      const x = (2 + (i % 2)) * 512, y = 512 + Math.floor(i / 2) * 128;
      let px = 60;
      ctx.font = font(500, px); ls(px);
      const tw = ctx.measureText(word).width;
      if (tw > 470) { px = Math.floor((px * 470) / tw); ctx.font = font(500, px); ls(px); }
      ctx.fillText(word, x + 20, y + 86);
      cells.push({ u: x / 2048, v: y / 1024, uw: 512 / 2048, vh: 128 / 1024, aspect: 4 });
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    tex.flipY = false;
    return { tex, cells };
  }

  /* ---------------- shader dùng chung: vị trí khối theo uniform ---------------- */
  // aCube = (cột, hàng, chiều sâu, ngẫu nhiên). Thang cuốn: hàng trượt lên uShift, quay vòng trong [-R, R]
  // uFlat: bậc thang đổ xuống thành mặt sàn bàn cờ (hàng → chiều sâu z, lớp sau chìm xuống dưới sàn)
  const PLACE = `
    uniform float uShift, uRows, uReveal, uTime, uFlat;
    float stepBack(float a) { return -(0.25 * min(a, 1.0) + 0.5 * clamp(a - 1.0, 0.0, 1.0) + 1.0 * max(a - 2.0, 0.0)); }
    vec3 cubeCenter(vec4 c, out float fade, out float layer) {
      float hr = uRows * 0.5;   // ("half" là từ khóa dành riêng của GLSL ES 3.0)
      float y = mod(c.y + uShift + hr, uRows) - hr;
      float ay = abs(y);
      fade = smoothstep(hr, hr - 0.9, ay);
      layer = ay;
      vec3 stair = vec3(c.x, y, -c.z + stepBack(ay) - 0.045 * c.x * c.x);
      vec3 floorP = vec3(c.x, -c.z, -y);
      fade = mix(fade, 1.0, uFlat * step(c.z, 0.5));
      layer = mix(layer, 0.0, uFlat);
      return mix(stair, floorP, uFlat);
    }
    float revealOf(vec4 c) {
      // mọc từ hàng giữa ra ngoài, từ trước ra sau
      float d = abs(c.y) * 0.16 + c.z * 0.22 + abs(c.x) * 0.025 + c.w * 0.08;
      return smoothstep(d, d + 0.25, uReveal * 1.6);
    }`;

  const FACE_V = PLACE + `
    attribute vec4 aCube;
    varying vec3 vN;
    varying float vA, vTop, vPortal;
    uniform float uPortal;
    uniform vec4 uPortalCube;
    void main() {
      float fade, layer;
      vec3 c = cubeCenter(aCube, fade, layer);
      float rv = revealOf(aCube);
      vec3 p = position * (0.985 * (0.6 + 0.4 * rv)) + c;
      vA = fade * rv;
      vN = normal;
      vTop = step(0.5, normal.y);
      vPortal = (all(lessThan(abs(aCube.xyz - uPortalCube.xyz), vec3(0.01))) ? 1.0 : 0.0) * uPortal * vTop;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const FACE_F = `
    varying vec3 vN;
    varying float vA, vTop, vPortal;
    uniform vec3 uBg;
    void main() {
      vec3 front = vec3(0.043, 0.067, 0.145), side = vec3(0.035, 0.055, 0.12), top = vec3(0.075, 0.11, 0.22);
      vec3 col = vN.z > 0.5 ? front : (vN.y > 0.5 ? top : side);
      col = mix(uBg, col, vA);
      col = mix(col, vec3(0.961, 0.973, 1.0), vPortal);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const EDGE_V = PLACE + `
    attribute vec4 aCube;
    uniform vec2 uMouse;
    uniform float uHover;
    varying float vA;
    void main() {
      float fade, layer;
      vec3 c = cubeCenter(aCube, fade, layer);
      float rv = revealOf(aCube);
      vec3 p = position * (0.6 + 0.4 * rv) + c;
      vec4 cp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_Position = cp;
      vec2 ndc = cp.xy / cp.w;
      float near = smoothstep(0.32, 0.0, length((ndc - uMouse) * vec2(1.6, 1.0)));
      float base = mix(0.5, 0.12, clamp(aCube.z / 2.0 + layer * 0.12, 0.0, 1.0));
      vA = fade * rv * (base + uHover * near * 0.9 * (0.6 + 0.4 * sin(uTime * 3.0 + aCube.w * 6.28)));
    }`;
  const EDGE_F = `
    varying float vA;
    void main() { gl_FragColor = vec4(mix(vec3(0.635, 0.769, 0.996), vec3(0.078, 0.847, 0.902), 0.25), vA); }`;

  const TEXT_V = PLACE + `
    attribute vec4 aCube;
    attribute vec4 aUv;      // (u, v, du, dv) trong atlas
    attribute vec3 aGeo;     // (rộng, cao, mặt: 0 trước / 1 bên)
    varying vec2 vUv;
    varying float vA;
    uniform float uWordK;
    void main() {
      float fade, layer;
      vec3 c = cubeCenter(aCube, fade, layer);
      float rv = revealOf(aCube);
      vec3 q = vec3(position.x * aGeo.x, position.y * aGeo.y, 0.0);
      vec3 p;
      if (aGeo.z < 0.5) {
        // mặt trước; khi bậc thang đổ thành sàn, chữ lật nằm ra mặt trên (quay quanh trục x)
        float a = uFlat * 1.5708;
        p = c + vec3(q.x, q.y * cos(a) + 0.505 * sin(a), 0.505 * cos(a) - q.y * sin(a));
      } else p = c + vec3(0.505, q.y, -q.x - aGeo.x * 0.5 + 0.44);
      vUv = aUv.xy + (position.xy + 0.5) * aUv.zw;
      vUv.y = aUv.y + (0.5 - position.y) * aUv.w;
      float front = aGeo.z < 0.5 ? 1.0 : 0.55;
      vA = fade * smoothstep(0.55, 1.0, rv) * front * mix(1.0, 0.42, clamp(layer * 0.45 + aCube.z * 0.5, 0.0, 1.0)) * uWordK;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const TEXT_F = `
    uniform sampler2D uAtlas;
    varying vec2 vUv;
    varying float vA;
    void main() {
      float a = texture2D(uAtlas, vUv).a;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vec3(0.961, 0.973, 1.0), a * vA);
    }`;

  function glInit(g, sc) {
    const { THREE } = g;
    const mob = matchMedia('(max-width: 760px)').matches;
    const COLS = mob ? 4 : 7, ROWS = mob ? 7 : 7, DEPTH = 3;   // cột: -COLS..COLS
    const cubes = [];
    const rnd = (() => { let s = 99991; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let row = -(ROWS - 1) / 2; row <= (ROWS - 1) / 2; row++)
      for (let c = -COLS; c <= COLS; c++)
        for (let d = 0; d < DEPTH; d++) cubes.push([c, row, d, rnd()]);
    const N = cubes.length;
    const aCube = new Float32Array(N * 4);
    cubes.forEach((q, i) => aCube.set(q, i * 4));

    // mặt khối: hộp đơn vị, nhân bản theo instance
    const box = new THREE.BoxGeometry(1, 1, 1);
    const fg = new THREE.InstancedBufferGeometry();
    fg.index = box.index;
    fg.setAttribute('position', box.getAttribute('position'));
    fg.setAttribute('normal', box.getAttribute('normal'));
    fg.setAttribute('aCube', new THREE.InstancedBufferAttribute(aCube, 4));
    fg.instanceCount = N;
    const uni = {
      uShift: { value: 0 }, uRows: { value: ROWS }, uReveal: { value: 0 }, uTime: { value: 0 },
      uBg: { value: new THREE.Color(0.04, 0.06, 0.13) }, uPortal: { value: 0 }, uPortalCube: { value: new THREE.Vector4(0, -2, 0, 0) }, uFlat: { value: 0 },
      uMouse: { value: new THREE.Vector2(9, 9) }, uHover: { value: 0 }, uWordK: { value: 1 }
    };
    const faceMat = new THREE.ShaderMaterial({ vertexShader: FACE_V, fragmentShader: FACE_F, uniforms: uni });
    const faces = new THREE.Mesh(fg, faceMat);
    faces.frustumCulled = false;

    // cạnh: 12 cạnh × 2 đỉnh cho mỗi khối, gộp một hình
    const E = [[-1, -1, -1, 1, -1, -1], [1, -1, -1, 1, 1, -1], [1, 1, -1, -1, 1, -1], [-1, 1, -1, -1, -1, -1],
      [-1, -1, 1, 1, -1, 1], [1, -1, 1, 1, 1, 1], [1, 1, 1, -1, 1, 1], [-1, 1, 1, -1, -1, 1],
      [-1, -1, -1, -1, -1, 1], [1, -1, -1, 1, -1, 1], [1, 1, -1, 1, 1, 1], [-1, 1, -1, -1, 1, 1]];
    const ep = new Float32Array(N * 24 * 3), ec = new Float32Array(N * 24 * 4);
    for (let i = 0; i < N; i++) {
      for (let e = 0; e < 12; e++) for (let k = 0; k < 2; k++) {
        const v = (i * 24 + e * 2 + k);
        ep[v * 3] = E[e][k * 3] * 0.5; ep[v * 3 + 1] = E[e][k * 3 + 1] * 0.5; ep[v * 3 + 2] = E[e][k * 3 + 2] * 0.5;
        ec.set(cubes[i], v * 4);
      }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    eg.setAttribute('aCube', new THREE.BufferAttribute(ec, 4));
    const edgeMat = new THREE.ShaderMaterial({ vertexShader: EDGE_V, fragmentShader: EDGE_F, uniforms: uni, transparent: true, depthWrite: false });
    const edges = new THREE.LineSegments(eg, edgeMat);
    edges.frustumCulled = false;

    // chữ: mặt trước của khối hàng đầu (cách một khối một chữ), mặt bên chữ nhỏ
    const { tex, cells } = buildAtlas(THREE);
    g.renderer.initTexture(tex);
    const tCube = [], tUv = [], tGeo = [];
    cubes.forEach(([c, row, d, rr]) => {
      const ri = Math.round(row + 10);
      if (d === 0 && (c + ri) % 2 === 0) {
        // ô có chữ cách nhau một khối (c + hàng chẵn) → chia đôi trước khi lấy dư để đủ cả 6 cụm chữ
        const w = ((((c + ri) / 2) + ri * 5) % 6 + 6) % 6, cell = cells[w];
        tCube.push(c, row, d, rr); tUv.push(cell.u, cell.v, cell.uw, cell.vh); tGeo.push(0.96, 0.96, 0);
      }
      if (d === 0 && c > 0 && (c + ri) % 3 === 1) {
        const w = ((c * 5 + ri) % 6 + 6) % 6, cell = cells[6 + w];
        tCube.push(c, row, d, rr); tUv.push(cell.u, cell.v, cell.uw, cell.vh); tGeo.push(0.92, 0.23, 1);
      }
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    const tg = new THREE.InstancedBufferGeometry();
    tg.index = quad.index;
    tg.setAttribute('position', quad.getAttribute('position'));
    tg.setAttribute('aCube', new THREE.InstancedBufferAttribute(new Float32Array(tCube), 4));
    tg.setAttribute('aUv', new THREE.InstancedBufferAttribute(new Float32Array(tUv), 4));
    tg.setAttribute('aGeo', new THREE.InstancedBufferAttribute(new Float32Array(tGeo), 3));
    tg.instanceCount = tCube.length / 4;
    const textMat = new THREE.ShaderMaterial({ vertexShader: TEXT_V, fragmentShader: TEXT_F, uniforms: Object.assign({ uAtlas: { value: tex } }, uni), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const words = new THREE.Mesh(tg, textMat);
    words.frustumCulled = false;
    words.renderOrder = 2;

    const scene = new THREE.Scene();
    const world = new THREE.Group();
    world.add(faces, edges, words);
    scene.add(world);
    const cam = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    sc.three = { scene, world, cam, uni, look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), tmp: new THREE.Vector3() };
    // khối "cổng" = khối nằm giữa mặt sàn sau khi thang cuốn trượt đủ 2 bậc (hàng gốc -2)
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.load('500 64px "Be Vietnam Pro"').then(() => {
        const a = buildAtlas(THREE);
        g.renderer.initTexture(a.tex);
        textMat.uniforms.uAtlas.value = a.tex;
        tex.dispose();
      }).catch(() => {});
    }
  }

  function glRender(g, sc, st) {
    const t = sc.three;
    if (!t) return;
    const { cam, uni } = t;
    const asp = g.w / Math.max(1, g.h);
    if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    const p = sc.p;
    uni.uTime.value = st.t;
    uni.uReveal.value = ease.out(r(p, 0.04, 0.34));
    uni.uShift.value = ease.inOut(r(p, 0.2, 0.58)) * 2;
    uni.uFlat.value = ease.inOut(r(p, 0.56, 0.76));
    uni.uWordK.value = 1 - r(p, 0.84, 0.93);
    // máy quay: góc 3/4 (thấy mặt trên + mặt bên của khối) → vòng lên nhìn từ trên → lao xuống mặt khối giữa
    const narrow = asp < 1;
    const arc = ease.inOut(r(p, 0.5, 0.78));
    const dive = ease.inOut(r(p, 0.78, 0.985));
    const el = mix(0.2, 1.5, arc) + Math.sin(st.t * 0.3) * 0.01 * (1 - arc);   // góc nâng (rad)
    const az = mix(-0.34, 0, arc) + ease.inOut(r(p, 0.1, 0.5)) * 0.14 * (1 - arc); // góc phương vị: lệch phải nhìn chéo
    const rad = mix(narrow ? 14 : 10, narrow ? 15 : 11.2, arc) - ease.out(r(p, 0.1, 0.5)) * 1.4 * (1 - arc);
    const tz = mix(-0.8, -0.05, arc);
    const horiz = Math.cos(el) * rad;
    const cx = Math.sin(-az) * horiz, cy = Math.sin(el) * rad, cz = Math.cos(az) * horiz + tz;
    // lao xuống: từ trên cao về sát mặt trên của khối giữa (y = 0.5)
    const fx = mix(cx, 0, dive), fy = mix(cy, 0.62, dive), fz = mix(cz, 0.02, dive);
    sc.mx += (sc.tmx - sc.mx) * (1 - Math.exp(-st.dt * 3));
    sc.my += (sc.tmy - sc.my) * (1 - Math.exp(-st.dt * 3));
    sc.hk += ((sc.hover ? 1 : 0) - sc.hk) * (1 - Math.exp(-st.dt * 4));
    const tilt = 1 - dive;
    cam.position.set(fx + sc.mx * 0.6 * tilt, fy + sc.my * 0.35 * tilt, fz);
    t.look.set(mix(0.3, 0, arc), mix(0.15, 0, arc), mix(tz, 0, dive));
    if (sc.vig) sc.vig.style.opacity = (1 - dive).toFixed(3);
    // nhìn từ trên xuống: trục "lên" chuyển dần sang -z để không lật màn hình
    t.up.set(0, Math.cos(el), -Math.sin(el)).normalize();
    cam.up.copy(t.up);
    cam.lookAt(t.look);
    cam.fov = mix(38, 30, dive);
    cam.updateProjectionMatrix();
    uni.uPortal.value = ease.inOut(r(p, 0.86, 0.96));
    uni.uMouse.value.set(sc.tmx, sc.tmy);
    uni.uHover.value = sc.hk * (1 - arc);
    g.renderer.render(t.scene, cam);
  }
})();
