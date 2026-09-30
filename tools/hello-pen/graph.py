"""Step 2 (authoring aid) - skeleton graph of the rasterised greeting.

Run it after raster.cjs when the lettering changes: it writes graph-<lang>.png, a labelled
overview of every skeleton branch, to help write the stroke order in pen.py.
Usage: python tools/hello-pen/graph.py [vi] [en]
"""
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from skan import Skeleton, summarize

WORK = os.environ.get('HELLO_WORK') or os.path.join(tempfile.gettempdir(), 'ltv-hello-pen')
SCALE = 10          # raster px per viewBox unit (raster.cjs)
Y0 = -20            # viewBox top
SPUR = 7.0          # skeleton branches from a junction to an end shorter than this are thinning noise


def prune(sk):
    for _ in range(12):
        s = Skeleton(sk)
        df = summarize(s, separator='_')
        spurs = df[(df['branch_type'] == 1) & (df['branch_distance'] < SPUR * SCALE)]
        if spurs.empty:
            return sk
        sk = sk.copy()
        for i in spurs.index:
            coords, nodes = s.path_coordinates(i), s.path(i)
            body = coords[1:] if s.degrees[nodes[0]] > 2 else coords[:-1]
            for r, c in body:
                sk[r, c] = False
        sk = skeletonize(sk)
    return sk


def load_graph(lang):
    im = np.asarray(Image.open(os.path.join(WORK, f'ink-{lang}.png')).convert('L'))
    ink = im > 127
    s = Skeleton(prune(skeletonize(ink)))
    br = []
    for i in range(s.n_paths):
        rc = s.path_coordinates(i)
        nodes = s.path(i)
        br.append(dict(pts=np.column_stack([rc[:, 1] / SCALE, rc[:, 0] / SCALE + Y0]).astype(float),
                       da=int(s.degrees[nodes[0]]), db=int(s.degrees[nodes[-1]]), cycle=bool(nodes[0] == nodes[-1])))
    return im, ink, br


def overview(lang):
    im, ink, br = load_graph(lang)
    k = 3
    ov = Image.new('RGB', (640 * k, 220 * k), (18, 22, 36))
    ov.paste(Image.new('RGB', ov.size, (70, 74, 92)), mask=Image.fromarray(im).resize(ov.size, Image.BILINEAR))
    d = ImageDraw.Draw(ov)
    pal = [(255, 99, 71), (60, 179, 113), (65, 105, 225), (255, 215, 0), (238, 130, 238), (0, 206, 209)]
    P = lambda x, y: (x * k, (y - Y0) * k)
    for i, b in enumerate(br):
        pts = [P(x, y) for x, y in b['pts'][::3]]
        if len(pts) > 1:
            d.line(pts, fill=pal[i % len(pal)], width=4)
        mx, my = pts[len(pts) // 2]
        d.text((mx + 3, my), str(i), fill=(255, 255, 255))
        print(f"#{i:2d} {'cycle' if b['cycle'] else 'branch'} ({b['pts'][0][0]:.1f},{b['pts'][0][1]:.1f}) -> "
              f"({b['pts'][-1][0]:.1f},{b['pts'][-1][1]:.1f}) via ({b['pts'][len(b['pts']) // 2][0]:.1f},"
              f"{b['pts'][len(b['pts']) // 2][1]:.1f})")
    out = os.path.join(WORK, f'graph-{lang}.png')
    ov.save(out)
    print(out)


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['en']:
        overview(lang)
