// Build the English preloader greeting "Hello" in ledinhtuan.com's hand, then write js/hello-en.js.
//
// The Vietnamese "xin chào" in index.html is ledinhtuan.com's lettering, used with permission (source:
// ledinhtuan-xin-chao.svg). It is the same Vietnamese school cursive as the Playwrite VN typeface: with
// x 1.979, an 8 deg slant and a smooth vertical remap (baseline, x-height and ascender to theirs),
// Playwrite's c and h land on their c and h. So "Hello" is the typeface's own letterforms
// (playwrite-hello-centerline.json, one continuous pen stroke) put through that same map and drawn
// with their pen: stroke 14.8883, round caps, same viewBox and size as "xin chào".
//
// The centre-line comes from a skeleton, which leaves small jogs where the stroke crosses itself; it is
// smoothed lightly (Gaussian along the arc) and refitted as cubic Beziers. The stroke is then cut into
// pen strokes at loop tops and bottoms, where a hand slows down, and timed like theirs: framer-motion
// easeInOut, durations in 1/30 s steps at their pen speed (about 1230 viewBox units/s), then played
// TEMPO times faster, like the Vietnamese greeting in index.html.
//
// usage: node tools/hello-ldt/build-hello-en.cjs [--preview]   (preview SVG goes to %TEMP%)
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '../..');

// ---- map from Playwrite coordinates to ledinhtuan's (fitted on "xin chào": c and h coincide)
const MAP = { sx: 1.979, slant: 0.14, rows: [[13, 7.6], [101.3, 96.2], [159.6, 191.5]] }; // [playwrite y, ldt y]
function mapY(y) {           // quadratic through ascender, x-height and baseline
  let r = 0;
  MAP.rows.forEach(([yi, Yi], i) => { let l = 1; MAP.rows.forEach(([yj], j) => { if (j !== i) l *= (y - yj) / (yi - yj); }); r += l * Yi; });
  return r;
}
const map = ([x, y]) => { const Y = mapY(y); return [x * MAP.sx + MAP.slant * (191.5 - Y), Y]; };

// ---- pen strokes: arc-length cut points on the Playwrite centre-line (units: Playwrite viewBox)
//   0 H hook + left stem | 200 bottom curl + crossbar + right loop | 420 right stem + e eye |
//   680 e bowl + l loop | 910 l stem + l loop | 1250 l stem to its bottom | then their o + flourish
const CUTS = [200, 420, 680, 910, 1250];
const LAST_BOTTOM = [1380, 1440];  // the second l's bottom is the lowest point in this arc range
const SMOOTH = 3;            // Gaussian sigma along the arc (Playwrite units; x-height is 58)
// the skeleton jogs where the l stems and the connectors cross each other: smooth harder there
const JOGS = [824, 1041, 1154, 1371], JOG_SMOOTH = 9, JOG_SPAN = 14;
// their o + final flourish (the end of their last stroke, after the a stem), verbatim
const O = [[[820.064, 191.513], [842.563, 191.513], [860.966, 164.721], [870.266, 138.289]],
  [[870.266, 138.289], [879.653, 111.612], [891.315, 94.9867], [915.633, 94.9867]],
  [[915.633, 94.9867], [935.732, 94.9867], [951.613, 109.875], [951.613, 137.915]],
  [[951.613, 137.915], [951.613, 168.932], [931.489, 192.257], [906.059, 192.505]],
  [[906.059, 192.505], [883.681, 192.753], [868.983, 174.639], [870.471, 147.344]],
  [[870.471, 147.344], [872.208, 117.071], [890.571, 94.9867], [914.64, 94.9867]],
  [[914.64, 94.9867], [928.536, 94.9867], [940.207, 101.164], [949.38, 107.89]],
  [[949.38, 107.89], [974.247, 126.031], [993.407, 114.82], [1000.74, 96.8832]]];
const FIT_TOL = 0.35;        // max Bezier fit error (ldt units)
const PEN_SPEED = 1230;      // their average, viewBox units per second
const TEMPO = 1.2;           // both greetings play 1.2x faster than ledinhtuan.com (owner's request); keep in step with index.html
const IO = 'cubic-bezier(.42,0,.58,1)';

// ---- geometry helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm = a => Math.hypot(a[0], a[1]), unit = a => mul(a, 1 / (norm(a) || 1));
const bez = (s, t) => [0, 1].map(k => (1 - t) ** 3 * s[0][k] + 3 * (1 - t) ** 2 * t * s[1][k] + 3 * (1 - t) * t * t * s[2][k] + t ** 3 * s[3][k]);
const bez1 = (s, t) => [0, 1].map(k => 3 * (1 - t) ** 2 * (s[1][k] - s[0][k]) + 6 * (1 - t) * t * (s[2][k] - s[1][k]) + 3 * t * t * (s[3][k] - s[2][k]));
const bez2 = (s, t) => [0, 1].map(k => 6 * (1 - t) * (s[2][k] - 2 * s[1][k] + s[0][k]) + 6 * t * (s[3][k] - 2 * s[2][k] + s[1][k]));
function parse(d) {
  const n = d.match(/-?\d*\.?\d+(?:e-?\d+)?|[MC]/g); let i = 0, cur, out = [];
  while (i < n.length) {
    const c = n[i++];
    if (c === 'M') cur = [+n[i++], +n[i++]];
    else while (i < n.length && !/[MC]/.test(n[i])) { const s = [cur, [+n[i++], +n[i++]], [+n[i++], +n[i++]], [+n[i++], +n[i++]]]; out.push(s); cur = s[3]; }
  }
  return out;
}
function resample(poly, ds) {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + norm(sub(poly[i], poly[i - 1])));
  const out = [];
  for (let s = 0, j = 0; s <= cum.at(-1) + 1e-9; s += ds) {
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push(add(poly[j], mul(sub(poly[j + 1], poly[j]), Math.min(1, t))));
  }
  return out;
}
function smooth(pts, sigmaAt) {  // Gaussian with a per-point sigma (in samples); odd reflection at the ends
  const at = i => i < 0 ? sub(mul(pts[0], 2), pts[-i]) : i >= pts.length ? sub(mul(pts.at(-1), 2), pts[2 * (pts.length - 1) - i]) : pts[i];
  return pts.map((_, i) => {
    const sg = sigmaAt(i), r = Math.ceil(sg * 3);
    let x = 0, y = 0, W = 0;
    for (let k = -r; k <= r; k++) { const w = Math.exp(-k * k / (2 * sg * sg)), p = at(i + k); x += p[0] * w; y += p[1] * w; W += w; }
    return [x / W, y / W];
  });
}
// Schneider, "An algorithm for automatically fitting digitized curves" (Graphics Gems, 1990)
function fitCurve(pts, tol) {
  const t1 = unit(sub(pts[Math.min(3, pts.length - 1)], pts[0])), t2 = unit(sub(pts[Math.max(0, pts.length - 4)], pts.at(-1)));
  return fitCubic(pts, t1, t2, tol);
}
function fitCubic(pts, t1, t2, tol) {
  if (pts.length === 2) { const d = norm(sub(pts[1], pts[0])) / 3; return [[pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]]]; }
  let u = chord(pts), b = generate(pts, u, t1, t2), [err, split] = maxError(pts, b, u);
  if (err < tol) return [b];
  if (err < tol * 16) for (let i = 0; i < 8; i++) {
    u = u.map((t, k) => newton(b, pts[k], t)); b = generate(pts, u, t1, t2); [err, split] = maxError(pts, b, u);
    if (err < tol) return [b];
  }
  const tc = unit(sub(pts[split - 1], pts[split + 1]));
  return [...fitCubic(pts.slice(0, split + 1), t1, tc, tol), ...fitCubic(pts.slice(split), mul(tc, -1), t2, tol)];
}
function chord(pts) { const u = [0]; for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + norm(sub(pts[i], pts[i - 1]))); return u.map(v => v / u.at(-1)); }
function generate(pts, u, t1, t2) {
  const p0 = pts[0], p3 = pts.at(-1); const C = [[0, 0], [0, 0]], X = [0, 0];
  u.forEach((t, i) => {
    const a1 = mul(t1, 3 * (1 - t) ** 2 * t), a2 = mul(t2, 3 * (1 - t) * t * t);
    C[0][0] += dot(a1, a1); C[0][1] += dot(a1, a2); C[1][1] += dot(a2, a2);
    const tmp = sub(pts[i], bez([p0, p0, p3, p3], t)); X[0] += dot(a1, tmp); X[1] += dot(a2, tmp);
  });
  C[1][0] = C[0][1];
  const det = C[0][0] * C[1][1] - C[0][1] * C[1][0];
  let al = det ? (X[0] * C[1][1] - X[1] * C[0][1]) / det : 0, ar = det ? (C[0][0] * X[1] - C[1][0] * X[0]) / det : 0;
  const seg = norm(sub(p3, p0)), eps = 1e-6 * seg;
  if (al < eps || ar < eps) al = ar = seg / 3;
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}
function maxError(pts, b, u) {
  let max = 0, split = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) { const d = norm(sub(bez(b, u[i]), pts[i])); if (d > max) { max = d; split = i; } }
  return [max, split];
}
function newton(b, p, t) {
  const d = sub(bez(b, t), p), q1 = bez1(b, t), q2 = bez2(b, t);
  const den = dot(q1, q1) + dot(d, q2);
  return den ? Math.min(1, Math.max(0, t - dot(d, q1) / den)) : t;
}
const len = segs => segs.reduce((a, s) => { let L = 0, q = s[0]; for (let i = 1; i <= 100; i++) { const r = bez(s, i / 100); L += norm(sub(r, q)); q = r; } return a + L; }, 0);

// ---- centre-line -> smoothed polyline (Playwrite units) -> pen strokes in ldt units
const src = JSON.parse(fs.readFileSync(path.join(__dirname, 'playwrite-hello-centerline.json'), 'utf8'));
const raw = [];
src.d.flatMap(parse).forEach((s, k) => { for (let i = k ? 1 : 0; i <= 40; i++) raw.push(bez(s, i / 40)); });
const DS = 0.5;
const sigmaAt = i => {
  const s = i * DS, k = Math.max(0, ...JOGS.map(j => Math.exp(-((s - j) ** 2) / (2 * JOG_SPAN ** 2))));
  return (SMOOTH + (JOG_SMOOTH - SMOOTH) * k) / DS;
};
const pts = smooth(resample(raw, DS), sigmaAt);
let bottom = Math.round(LAST_BOTTOM[0] / DS);
for (let i = bottom; i <= LAST_BOTTOM[1] / DS; i++) if (pts[i][1] > pts[bottom][1]) bottom = i;
const bounds = [0, ...CUTS.map(s => Math.round(s / DS)), bottom];
let strokes = bounds.slice(0, -1).map((a, i) => fitCurve(pts.slice(a, bounds[i + 1] + 1).map(map), FIT_TOL));
// the l's bottom is horizontal, like the a-stem bottom their o starts from: attach their o there
const B = map(pts[bottom]);
strokes.push(O.map(s => s.map(p => [p[0] - 820.064 + B[0], p[1] - 191.513 + B[1]])));
// centre in the same 1009-wide viewBox, so the letters render at exactly the Vietnamese greeting's size
const xs = strokes.flat(2).map(p => p[0]);
const shift = (1009 - (Math.max(...xs) - Math.min(...xs))) / 2 - Math.min(...xs);
strokes = strokes.map(segs => segs.map(s => s.map(p => [p[0] + shift, p[1]])));

let t = 0;
const timed = strokes.map(segs => {
  const L = len(segs), dur = Math.max(4, Math.round(L / PEN_SPEED * 30)) / 30 / TEMPO, o = { segs, L, dur, delay: t };
  t += dur; return o;
});
const total = Math.round(t * 1000);
const f = v => +v.toFixed(2);
const d = segs => 'M' + f(segs[0][0][0]) + ' ' + f(segs[0][0][1]) + segs.map(s => 'C' + [s[1], s[2], s[3]].map(p => f(p[0]) + ' ' + f(p[1])).join(' ')).join('');
const ms = s => +(s * 1000).toFixed(3) + 'ms';
const svg = `<svg class="hello hello--ldt hello--en" viewBox="0 0 1009 200" fill="none" stroke="currentColor" stroke-width="14.8883" stroke-linecap="round" data-duration="${total}" role="img" aria-label="Hello" focusable="false">`
  + '<style>.hello--ldt{width:min(600px,66.6667vw);height:80px}.hello--ldt .hello__pen{opacity:1;stroke-opacity:0}'
  + '.preloader.is-written .hello--ldt .hello__pen{stroke-opacity:1}@media (prefers-reduced-motion:reduce){.hello--ldt .hello__pen{stroke-opacity:1}}'
  + '@keyframes ldt-pen{from{stroke-dashoffset:1;stroke-opacity:0}to{stroke-dashoffset:0;stroke-opacity:1}}</style>'
  + timed.map(s => `<path class="hello__pen" pathLength="1" d="${d(s.segs)}" style="--l:1;--anim:ldt-pen ${ms(s.dur)} ${IO} ${ms(s.delay)} both"/>`).join('')
  + '</svg>';
const js = '/* English preloader greeting "Hello": Playwrite VN letterforms in ledinhtuan.com\'s hand (same pen, scale\r\n'
  + '   and framer-motion easing as the Vietnamese "xin chao"). Generated by tools/hello-ldt/build-hello-en.cjs;\r\n'
  + '   i18n.js swaps it in on ?lang=en. */\r\n'
  + 'window.LTV_HELLO_EN = ' + JSON.stringify(svg) + ';\r\n';
fs.writeFileSync(path.join(ROOT, 'js/hello-en.js'), js);
timed.forEach((s, i) => console.log(`stroke ${i}: ${s.segs.length} curves, len ${s.L.toFixed(0).padStart(4)}, ${ms(s.dur).padStart(9)} from ${ms(s.delay).padStart(9)}  ${(s.L / s.dur).toFixed(0)} u/s`));
console.log(`js/hello-en.js: ${total} ms, ${(svg.length / 1024).toFixed(1)} KB`);

if (process.argv.includes('--preview')) {
  const their = fs.readFileSync(path.join(__dirname, 'ledinhtuan-xin-chao.svg'), 'utf8');
  const theirs = [...their.matchAll(/<(path|circle)[^>]*>/g)].map(m => m[0].replace(/ opacity="0"| stroke-dasharray="[^"]*"| style="transform[^"]*"/g, '').replace(/>$/, '/>')).join('');
  const out = path.join(os.tmpdir(), 'ltv-hello-ldt-preview.svg');
  fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 1009 440" width="1009" height="440" style="background:#16233d;color:#f4f6fb">`
    + `<g fill="none" stroke="currentColor" stroke-width="14.8883" stroke-linecap="round">${theirs}</g>`
    + `<g transform="translate(0 220)" fill="none" stroke="currentColor" stroke-width="14.8883" stroke-linecap="round">${timed.map(s => `<path d="${d(s.segs)}"/>`).join('')}</g></svg>`);
  console.log('preview:', out);
}
