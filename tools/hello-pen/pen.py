"""Step 3 - pen strokes for the preloader greeting ("xin chào" / "Hello").

The visible letters are the exact Playwrite VN 300 outlines and never change. A luminance
mask of pen strokes reveals them, like ledinhtuan.com's handwriting intro:

  skeleton of the ink -> strokes in writing order (graph branches, referenced by coordinates)
  -> smooth centre-lines -> cubic Bezier fit -> pen speed along each stroke (2/3 power law of
  handwriting: slower in tight turns, faster on straight runs, eased at pen-down/pen-up)
  -> ownership: each pen reveals only its own ink (clipped where it would touch a later
  stroke) -> pens-<lang>.json for emit.py.

Usage: python tools/hello-pen/pen.py [vi] [en]
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.measure import approximate_polygon, find_contours

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graph import SCALE, WORK, Y0, load_graph  # noqa: E402

R_PEN = 5.0      # pen radius (units): the mask stroke is 2*R_PEN wide
R_J = 5.0        # trim this much on each side of a junction and bridge smoothly
EXT = 2.5        # extend free stroke ends along their tangent so the cap covers square ends
PAD = 0.15       # a stroke's own ink band = its local half-width + PAD
RS = 5           # px per unit for the ownership raster
MAX_PEN = 0.42   # seconds: long strokes are cut into pens of at most this duration
K0 = 1 / 26      # curvature floor for the power law (units^-1)
PACE_U = 620     # average pen speed while drawing, units/s. ledinhtuan.com writes 1.13 word
                 # widths/s; 620 u/s is 1.25 for "xin chào". "Hello" (same font, same size)
                 # uses the same hand speed.

# Strokes in writing order. Branch references are coordinates in the SVG root space (the VI
# ink sits in translate(22 0)); they are matched to the nearest skeleton branch:
#   ('b', start, end, via)            branch from start to end, passing near via
#   ('part', start, end, via, a, b)   the same branch cut to the points nearest a / b (None = end)
#   ('cycle', junction, via)          closed loop; direction continues the incoming motion
#   ('auto', end1, end2, via)         branch whose direction is chosen the same way
#   ('pt', xy)                        a free stroke end the pruned skeleton lacks
CFG = {
    'vi': dict(gx=22, dot_xy=(156.3, 73.8), min_dur={'grave': 0.2}, strokes=[
        ('x1', [('b', (72.6, 118.9), (103.8, 119.0), (87.6, 102.5)), ('b', (103.8, 119.0), (103.5, 138.0), (103.5, 128.6)),
                ('b', (103.5, 138.0), (71.7, 149.1), (90.4, 156.9))]),
        ('x2', [('b', (134.1, 115.6), (103.8, 119.0), (119.2, 102.9)), ('b', (103.8, 119.0), (103.5, 138.0), (103.5, 128.6)),
                ('b', (103.5, 138.0), (156.0, 144.9), (127.5, 158.1))]),
        ('i', [('b', (156.3, 103.9), (156.0, 144.9), (156.3, 124.6)), ('b', (156.0, 144.9), (194.3, 145.4), (172.2, 157.8))]),
        ('n1', [('b', (194.7, 103.7), (195.1, 115.4), (194.7, 109.7)), ('b', (195.1, 115.4), (194.3, 145.4), (194.7, 130.7)),
                ('b', (194.3, 145.4), (194.7, 157.1), (194.7, 151.4))]),
        ('n2', [('b', (195.1, 115.4), (251.9, 154.6), (235.7, 120.2))]),
        ('ch', [('b', (342.2, 110.0), (370.9, 130.3), (306.1, 146.0)), ('b', (381.1, 107.3), (372.7, 114.3), (379.1, 14.0)),
                ('b', (372.7, 114.3), (370.9, 130.3), (371.5, 122.4)), ('b', (370.9, 130.3), (371.5, 157.1), (371.5, 143.7))]),
        ('h2', [('b', (381.1, 107.3), (446.0, 144.5), (412.7, 133.5))]),
        ('a1', [('part', (487.4, 145.5), (446.0, 144.5), (471.8, 102.9), (487.6, 106.9), None),
                ('b', (446.0, 144.5), (487.4, 145.5), (465.8, 157.8))]),
        ('a2', [('pt', (487.7, 103.6)), ('part', (446.0, 144.5), (487.4, 145.5), (471.8, 102.9), (487.6, 106.9), None),
                ('b', (487.4, 145.5), (521.1, 143.2), (502.3, 157.8)), ('cycle', (521.1, 143.2), (563.7, 118.3))]),
        ('grave', [('b', (458.3, 65.6), (472.0, 83.6), (465.3, 74.7))]),
    ]),
    'en': dict(gx=0, dot_xy=None, min_dur={}, strokes=[
        ('hello', [('b', (150.2, 31.5), (188.4, 100.7), (188.2, 40.9)), ('cycle', (188.1, 104.4), (170.0, 157.4)),
                   ('b', (188.4, 100.7), (252.8, 73.3), (220.4, 87.6)), ('cycle', (253.1, 68.5), (271.5, 14.6)),
                   ('b', (252.8, 73.3), (304.3, 148.6), (253.6, 134.8)), ('auto', (304.3, 148.6), (306.3, 148.6), (311.5, 102.6)),
                   ('b', (306.3, 148.6), (356.8, 139.7), (331.3, 157.2)), ('cycle', (358.5, 122.1), (370.0, 13.5)),
                   ('b', (358.5, 122.1), (356.8, 139.7), (357.2, 131.1)), ('b', (356.8, 139.7), (403.6, 140.8), (377.5, 158.0)),
                   ('cycle', (405.0, 122.1), (416.2, 13.5)), ('b', (405.0, 122.1), (403.6, 140.8), (403.7, 131.7)),
                   ('b', (403.6, 140.8), (444.9, 143.2), (422.7, 158.2)), ('cycle', (444.9, 143.2), (487.5, 118.3))]),
    ]),
}


# ------------------------------------------------------------------ geometry helpers
def arclen(p):
    return np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])


def resample(p, step):
    s = arclen(p)
    if s[-1] < 1e-9:
        return p[:1].copy()
    t = np.linspace(0, s[-1], max(2, int(round(s[-1] / step)) + 1))
    return np.column_stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])])


def unit(v):
    n = np.hypot(*v)
    return v / n if n > 1e-12 else v


def point_at(p, dist, from_end=False):
    """Point, travel tangent and index at arc distance `dist` from the start (or the end)."""
    q = p[::-1] if from_end else p
    s = arclen(q)
    dist = min(dist, s[-1])
    at = lambda v: np.array([np.interp(v, s, q[:, 0]), np.interp(v, s, q[:, 1])])
    tan = unit(at(min(s[-1], dist + 1.5)) - at(max(0, dist - 1.5)))
    idx = int(np.searchsorted(s, dist))
    return (at(dist), -tan, len(p) - 1 - idx) if from_end else (at(dist), tan, idx)


def cubic(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n)[:, None]; u = 1 - t
    return u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3


# ------------------------------------------------------------------ strokes from the graph
def find_branch(br, a, b, via, cycle=False):
    best = None
    for i, x in enumerate(br):
        if x['cycle'] != cycle:
            continue
        P = x['pts']
        dv = float(np.min(np.hypot(P[:, 0] - via[0], P[:, 1] - via[1])))
        if cycle:
            cost, rev = float(np.hypot(*(P[0] - a))) + dv, False
        else:
            e1 = np.hypot(*(P[0] - a)) + np.hypot(*(P[-1] - b))
            e2 = np.hypot(*(P[0] - b)) + np.hypot(*(P[-1] - a))
            cost, rev = float(min(e1, e2)) + dv, bool(e2 < e1)
        if best is None or cost < best[0]:
            best = (cost, i, rev)
    if best is None or best[0] > 12:
        raise SystemExit(f'no skeleton branch matches {a} -> {b} via {via}: re-author the strokes (graph.py)')
    return best[1], best[2]


def kinds(x, rev):
    da, db = (x['db'], x['da']) if rev else (x['da'], x['db'])
    return ('term' if da == 1 else 'junc'), ('term' if db == 1 else 'junc')


def resolve(br, item, cur_pt, cur_tan):
    """-> (points, start_kind, end_kind); kinds: 'term' | 'junc' | 'free'."""
    kind = item[0]
    if kind == 'pt':
        return np.array([item[1]], float), 'term', 'free'
    if kind in ('b', 'part'):
        i, rev = find_branch(br, np.array(item[1]), np.array(item[2]), item[3])
        p = br[i]['pts'][::-1] if rev else br[i]['pts']
        sk, ek = kinds(br[i], rev)
        if kind == 'part':
            frm, to = item[4], item[5]
            a0 = int(np.argmin(np.hypot(p[:, 0] - frm[0], p[:, 1] - frm[1]))) if frm else 0
            a1 = int(np.argmin(np.hypot(p[:, 0] - to[0], p[:, 1] - to[1]))) + 1 if to else len(p)
            return p[a0:a1].copy(), ('free' if frm else sk), ('free' if to else ek)
        return p.copy(), sk, ek
    if kind in ('cycle', 'auto'):
        if kind == 'cycle':
            i, _ = find_branch(br, np.array(item[1]), None, item[2], cycle=True)
        else:
            i, _ = find_branch(br, np.array(item[1]), np.array(item[2]), item[3])
        fwd = br[i]['pts']; rev = fwd[::-1]
        score = lambda q: (float(np.dot(point_at(q, R_J + 3)[1], cur_tan)) - np.hypot(*(q[0] - cur_pt)) * 0.05
                           if cur_pt is not None else 0.0)
        use_rev = score(rev) > score(fwd)
        q = rev if use_rev else fwd
        if kind == 'cycle':
            return q.copy(), 'junc', 'junc'
        sk, ek = kinds(br[i], use_rev)
        return q.copy(), sk, ek
    raise ValueError(item)


def build_stroke(br, items):
    """Concatenate the items, bridging every junction with a smooth cubic."""
    path = None; end_kind = start_kind = None; cur_pt = cur_tan = None
    for item in items:
        p, sk, ek = resolve(br, item, cur_pt, cur_tan)
        if path is None:
            path, start_kind = p, sk
        elif end_kind == 'junc' and sk == 'junc':
            # Crossing a stem (the skeleton merges the strokes there): take the tangents from
            # outside the distorted zone so the bridge follows the real diagonal.
            trim = 9.0 if np.hypot(*(p[0] - path[-1])) > 2.0 else R_J
            p0, t0, i0 = point_at(path, trim, from_end=True)
            p3, t3, i3 = point_at(p, trim)
            h = max(2.0, np.hypot(*(p3 - p0)) * 0.42)
            path = np.vstack([path[:i0 + 1], cubic(p0, p0 + t0 * h, p3 - t3 * h, p3, 40)[1:-1], p[i3:]])
        else:
            path = np.vstack([path, p])
        end_kind = ek
        cur_tan = point_at(path, 3, from_end=True)[1]
        cur_pt = path[-1]
    p = resample(path, 0.25)
    sm = np.column_stack([ndimage.gaussian_filter1d(p[:, k], 4, mode='nearest') for k in (0, 1)])
    w = np.clip(np.minimum(np.arange(len(p)), np.arange(len(p))[::-1]) / 6.0, 0, 1)[:, None]
    p = sm * w + p * (1 - w)          # smooth the pixel staircase, keep the ends in place
    if start_kind == 'term':
        p = np.vstack([p[0] - point_at(p, 2.5)[1] * EXT, p])
    if end_kind == 'term':
        p = np.vstack([p, p[-1] + point_at(p, 2.5, from_end=True)[1] * EXT])
    return resample(p, 0.5)


# ------------------------------------------------------------------ Schneider cubic fitting
def _bez(b, t):
    t = np.asarray(t)[:, None]; u = 1 - t
    return u ** 3 * b[0] + 3 * u * u * t * b[1] + 3 * u * t * t * b[2] + t ** 3 * b[3]


def _bez1(b, t):
    t = np.asarray(t)[:, None]; u = 1 - t
    return 3 * u * u * (b[1] - b[0]) + 6 * u * t * (b[2] - b[1]) + 3 * t * t * (b[3] - b[2])


def _bez2(b, t):
    t = np.asarray(t)[:, None]; u = 1 - t
    return 6 * u * (b[2] - 2 * b[1] + b[0]) + 6 * t * (b[3] - 2 * b[2] + b[1])


def _gen(d, u, t1, t2):
    p0, p3 = d[0], d[-1]
    A1 = t1[None, :] * (3 * (1 - u) ** 2 * u)[:, None]
    A2 = t2[None, :] * (3 * (1 - u) * u ** 2)[:, None]
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    tmp = d - _bez(np.array([p0, p0, p3, p3]), u)
    X = np.array([np.sum(A1 * tmp), np.sum(A2 * tmp)])
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg = np.hypot(*(p3 - p0))
    a1 = a2 = seg / 3
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    if a1 < 1e-6 * seg or a2 < 1e-6 * seg:
        a1 = a2 = seg / 3
    return np.array([p0, p0 + t1 * a1, p3 + t2 * a2, p3])


def _fit(d, t1, t2, err):
    if len(d) == 2:
        dist = np.hypot(*(d[1] - d[0])) / 3
        return [np.array([d[0], d[0] + t1 * dist, d[1] + t2 * dist, d[1]])]
    u = arclen(d); u = u / u[-1]
    b = _gen(d, u, t1, t2)
    e = np.sum((_bez(b, u) - d) ** 2, axis=1); split = int(np.argmax(e)); mx = e[split]
    if mx < err:
        return [b]
    if mx < err * 4:
        for _ in range(20):
            q = _bez(b, u) - d; q1 = _bez1(b, u); q2 = _bez2(b, u)
            num = np.sum(q * q1, axis=1); den = np.sum(q1 * q1, axis=1) + np.sum(q * q2, axis=1)
            u = np.clip(np.where(np.abs(den) > 1e-12, u - num / den, u), 0, 1)
            b = _gen(d, u, t1, t2)
            e = np.sum((_bez(b, u) - d) ** 2, axis=1); split = int(np.argmax(e)); mx = e[split]
            if mx < err:
                return [b]
    split = min(max(split, 1), len(d) - 2)
    tc = unit(d[split - 1] - d[split + 1])
    return _fit(d[:split + 1], t1, tc, err) + _fit(d[split:], -tc, t2, err)


def fit_bezier(p, tol=0.22):
    return _fit(p, unit(p[min(2, len(p) - 1)] - p[0]), unit(p[max(-3, -len(p))] - p[-1]), tol * tol)


def bez_len(segs):
    return float(sum(arclen(_bez(b, np.linspace(0, 1, 400)))[-1] for b in segs))


def bez_points(segs, step=0.1):
    return np.vstack([_bez(b, np.linspace(0, 1, max(8, int(arclen(_bez(b, np.linspace(0, 1, 50)))[-1] / step))))
                      for b in segs])


def bez_to_d(segs, dx):
    f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')
    out = f'M{f(segs[0][0][0] - dx)} {f(segs[0][0][1])}'
    for b in segs:
        out += f'C{f(b[1][0] - dx)} {f(b[1][1])} {f(b[2][0] - dx)} {f(b[2][1])} {f(b[3][0] - dx)} {f(b[3][1])}'
    return out


# ------------------------------------------------------------------ pen speed
def speed_profile(p):
    """-> (arc length, time) samples. v ~ curvature^(-1/3), eased at pen-down and pen-up."""
    s = arclen(p)
    d = np.diff(p, axis=0)
    ang = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    k = np.abs(np.gradient(ang) / np.maximum(np.hypot(*d.T), 1e-6))
    k = ndimage.gaussian_filter1d(np.concatenate([k, k[-1:]]), 5, mode='nearest')
    v = ndimage.gaussian_filter1d((k + K0) ** (-1 / 3), 6, mode='nearest')
    ss = lambda x: x * x * (3 - 2 * x)
    v *= 0.3 + 0.7 * ss(np.clip(s / 9.0, 0, 1))
    v *= 0.4 + 0.6 * ss(np.clip((s[-1] - s) / 9.0, 0, 1))
    return s, np.concatenate([[0], np.cumsum(np.diff(s) / (0.5 * (v[1:] + v[:-1])))])


# ------------------------------------------------------------------ main
def main(lang):
    cfg = CFG[lang]
    im, ink, br = load_graph(lang)
    strokes = []
    for name, items in cfg['strokes']:
        p = build_stroke(br, items)
        s, t = speed_profile(p)
        strokes.append(dict(name=name, p=p, s=s, t=t))

    # schedule: the pen covers PACE_U units/s while drawing, pen lifts are short hops,
    # no stroke shorter than 0.1 s (the final accent is a slow flourish, as on ledinhtuan.com)
    k_time = (sum(st['s'][-1] for st in strokes) / PACE_U) / sum(st['t'][-1] for st in strokes)
    clock = 0.0
    for i, st in enumerate(strokes):
        if i:
            clock += min(0.04, 0.01 + np.hypot(*(st['p'][0] - strokes[i - 1]['p'][-1])) * 0.0002)
        st['t'] = st['t'] * k_time
        want = cfg['min_dur'].get(st['name'], 0.1)
        if st['t'][-1] < want:
            st['t'] = st['t'] * (want / st['t'][-1])
        st['start'] = clock
        clock += st['t'][-1]
    total = clock
    dot = None
    if cfg['dot_xy']:
        i_end = next(st['start'] + st['t'][-1] for st in strokes if st['name'] == 'i')
        dot = dict(t0=i_end - 0.05, dur=0.14)

    # cut strokes into pens of at most MAX_PEN seconds (speed stays continuous across the cut)
    pens = []
    for st in strokes:
        T = st['t'][-1]
        n = max(1, math.ceil(T / MAX_PEN))
        cuts = np.linspace(0, T, n + 1)
        for j in range(n):
            ta, tb = cuts[j], cuts[j + 1]
            sa, sb = np.interp(ta, st['t'], st['s']), np.interp(tb, st['t'], st['s'])
            at = lambda v: [np.interp(v, st['s'], st['p'][:, 0]), np.interp(v, st['s'], st['p'][:, 1])]
            q = np.vstack([at(sa), st['p'][(st['s'] > sa) & (st['s'] < sb)], at(sb)])
            segs = fit_bezier(q)
            L = bez_len(segs)
            tt = np.linspace(ta, tb, max(9, int(round((tb - ta) / 0.022)) + 1))
            trav = (np.interp(tt, st['t'], st['s']) - sa) * (L / max(sb - sa, 1e-9))
            pens.append(dict(stroke=st['name'], first=(j == 0), segs=segs, L=L, t0=st['start'] + ta,
                             dur=tb - ta, tt=tt - ta, trav=trav, pts=bez_points(segs)))

    # ownership: which pen may reveal which ink
    H, W = ink.shape
    h5, w5 = H * RS // SCALE, W * RS // SCALE
    ink5 = np.asarray(Image.fromarray(im).resize((w5, h5), Image.BOX)) > 8
    edge = ndimage.distance_transform_edt(ink) / SCALE
    dists, bands = [], []
    for pen in pens:
        P = pen['pts']
        rr = np.clip(np.round((P[:, 1] - Y0) * SCALE).astype(int), 0, H - 1)
        cc = np.clip(np.round(P[:, 0] * SCALE).astype(int), 0, W - 1)
        # local half-width of the stroke under the pen (median over ~12 units: junction blobs
        # must not inflate it)
        hw = np.clip(ndimage.median_filter(edge[rr, cc], size=121, mode='nearest'), 2.5, 4.6)
        m = np.ones((h5, w5), bool); hwimg = np.zeros((h5, w5), np.float32)
        c = np.round(P[:, 0] * RS).astype(int); r = np.round((P[:, 1] - Y0) * RS).astype(int)
        ok = (r >= 0) & (r < h5) & (c >= 0) & (c < w5)
        m[r[ok], c[ok]] = False; hwimg[r[ok], c[ok]] = hw[ok]
        d, idx = ndimage.distance_transform_edt(m, return_indices=True)
        d = (d / RS).astype(np.float32)
        bands.append((d - (hwimg[idx[0], idx[1]] + PAD)).astype(np.float16))
        dists.append(d.astype(np.float16))
    D = np.stack(dists).astype(np.float32)
    E = np.stack(bands).astype(np.float32)
    IB = E <= 0
    # Inside some stroke's band: the earliest pen there owns it (shared ink at a crossing goes
    # to whoever arrives first). Outside every band: the fillet where a later stroke joins an
    # earlier one belongs to the later pen (the joint appears when that stroke arrives); a lone
    # anti-aliased edge goes to the pen whose band edge is nearest.
    near_band = (E <= 1.5) & (D <= R_PEN)
    latest = (len(pens) - 1) - np.argmax(near_band[::-1], axis=0)
    outside = np.where(near_band.sum(axis=0) >= 2, latest, np.argmin(E, axis=0))
    owner = np.where(IB.any(axis=0), np.argmax(IB, axis=0), outside)

    revealed = np.zeros_like(ink5)
    for k, pen in enumerate(pens):
        disc = D[k] <= R_PEN
        # A pen may reveal anything except ink owned by a LATER pen; later pens paint over
        # earlier regions freely, so every boundary is covered twice (no seam) and no sliver
        # of a later stroke shows before its pen gets there.
        forbidden = ink5 & (owner > k)
        allowed = (D[k] <= R_PEN + 1.0) & ~forbidden
        pen['bleed'] = int((disc & forbidden).sum())
        pen['clip'] = ''
        if pen['bleed'] > 2:
            parts = []
            for cnt in find_contours(np.pad(ndimage.gaussian_filter(allowed.astype(np.float32), 0.8), 1), 0.5):
                poly = approximate_polygon(cnt - 1, tolerance=0.3 * RS)
                if len(poly) >= 3:
                    parts.append('M' + ' '.join(f'{cc_ / RS - cfg["gx"]:.1f} {rr_ / RS + Y0:.1f}' for rr_, cc_ in poly[:-1]) + 'Z')
            pen['clip'] = ''.join(parts)
        revealed |= disc & (allowed if pen['clip'] else True)

    uncovered = ink5 & ~revealed
    if cfg['dot_xy']:                                  # the i-dot is animated on its own
        yy, xx = np.mgrid[0:h5, 0:w5]
        uncovered &= np.hypot(xx / RS - cfg['dot_xy'][0], yy / RS + Y0 - cfg['dot_xy'][1]) > 8
    # junction fillets out of every pen's reach: a small mask dot fills each one when the later
    # of the strokes meeting there arrives
    lab, nlab = ndimage.label(uncovered)
    patches = []
    for n_lab, sl in enumerate(ndimage.find_objects(lab), 1):
        rr_, cc_ = np.nonzero(lab[sl] == n_lab)
        ys = (rr_ + sl[0].start) / RS + Y0; xs = (cc_ + sl[1].start) / RS
        cx, cy = float(xs.mean()), float(ys.mean())
        r0, c0 = int(round((cy - Y0) * RS)), int(round(cx * RS))
        near = [k for k in range(len(pens)) if D[k][r0, c0] <= R_PEN + 3]
        if not near:
            continue
        k = max(near)
        P = pens[k]['pts']
        sp = arclen(P) * (pens[k]['L'] / max(arclen(P)[-1], 1e-9))
        j = int(np.argmin(np.hypot(P[:, 0] - cx, P[:, 1] - cy)))
        t_hit = float(np.interp(min(sp[j] + R_PEN * 0.5, pens[k]['L']), pens[k]['trav'], pens[k]['tt'])) + pens[k]['t0']
        patches.append(dict(cx=cx - cfg['gx'], cy=cy, r=float(np.max(np.hypot(xs - cx, ys - cy))) + 0.7, t=t_hit))

    print(f'{lang}: {len(strokes)} strokes, {len(pens)} pens, {total * 1000:.0f} ms, '
          f'{sum(1 for p in pens if p["clip"])} clipped, {len(patches)} fillet dots, '
          f'unrevealed before fillets {int(uncovered.sum())} of {int(ink5.sum())} px')
    for pen in pens:
        print(f"   {pen['stroke']:6s} {pen['t0'] * 1000:5.0f} ms +{pen['dur'] * 1000:3.0f}  {pen['L']:6.1f} u  "
              f"{len(pen['segs']):2d} curves  bleed {pen['bleed']:4d}")

    # debug overlay: ownership colours, pen centre-lines, unrevealed ink in red
    k = 3
    arr = np.full((220 * k, 640 * k, 3), (14, 18, 30), np.uint8)
    inkk = np.asarray(Image.fromarray(im).resize((640 * k, 220 * k), Image.BILINEAR)) > 127
    ownk = np.asarray(Image.fromarray(owner.astype(np.uint8)).resize((640 * k, 220 * k), Image.NEAREST))
    pal = np.array([(255, 99, 71), (60, 179, 113), (65, 105, 225), (255, 215, 0), (238, 130, 238), (0, 206, 209),
                    (255, 140, 0), (154, 205, 50), (199, 21, 133), (135, 206, 250), (244, 164, 96), (127, 255, 212)])
    for i in range(len(pens)):
        arr[(ownk == i) & inkk] = (pal[i % len(pal)] * 0.45).astype(np.uint8)
    arr[np.asarray(Image.fromarray((uncovered * 255).astype(np.uint8)).resize((640 * k, 220 * k), Image.NEAREST)) > 0] = (255, 0, 0)
    ov = Image.fromarray(arr); dr = ImageDraw.Draw(ov)
    for i, pen in enumerate(pens):
        pts = [(x * k, (y - Y0) * k) for x, y in pen['pts'][::4]]
        dr.line(pts, fill=tuple(int(c) for c in pal[i % len(pal)]), width=2)
        dr.text((pts[0][0] + 5, pts[0][1] - 14), str(i), fill=(255, 255, 255))
    ov.save(os.path.join(WORK, f'pens-{lang}.png'))

    json.dump(dict(total=total, dot=dot, patches=patches, pens=[
        dict(stroke=p['stroke'], first=p['first'], L=p['L'], t0=p['t0'], dur=p['dur'], tt=p['tt'].tolist(),
             trav=p['trav'].tolist(), clip=p['clip'], d=bez_to_d(p['segs'], cfg['gx'])) for p in pens]),
        open(os.path.join(WORK, f'pens-{lang}.json'), 'w'))


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['en']:
        main(lang)
