"""Build exact Playwrite VN 300 outlines with a fast handwriting reveal.

Authoring dependencies: fonttools, uharfbuzz. No runtime font request is needed.
"""
from pathlib import Path
import math
import re
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[1]
# Guides only reveal the ink; the visible letterforms come from the font file.
STROKES = [
    ('x-first', 'M50 118 C55 98 76 96 81 128 C86 160 94 158 108 158 C119 158 130 149 134 139'),
    ('x-cross', 'M113 116 C110 98 87 98 81 128 C75 158 64 164 49 149'),
    ('i', 'M134 103 L134 143 C134 155 137 158 146 158 C158 158 168 148 173 139'),
    ('i-dot', 'M134 73 L134 74'),
    ('n-stem', 'M173 103 L173 158'),
    ('n-arch', 'M173 124 C183 99 214 94 214 123 L214 146 C214 158 219 161 230 154'),
    ('c-h', 'M321 109 C306 95 282 101 280 127 C278 153 291 158 308 158 C331 158 351 129 360 103 C369 77 372 49 372 32 C372 20 368 13 361 13 C351 13 350 25 350 34'),
    ('h-down', 'M350 34 L350 158'),
    ('h-arch', 'M350 124 C361 99 391 96 391 123 L391 144 C391 155 394 158 403 158 C414 158 421 149 423 138'),
    ('a-bowl', 'M465 109 C446 95 424 105 424 131 C424 150 433 158 443 158 C453 158 461 148 466 136'),
    ('a-stem', 'M466 103 L466 144 C466 155 468 158 477 158 C489 158 496 149 498 139'),
    ('o', 'M521 103 C507 103 499 115 499 131 C499 147 507 158 521 158 C535 158 544 147 544 131 C544 115 535 103 521 103 Z'),
    ('grave', 'M435 65 L450 84'),
]


def length(path):
    """Measure cubic curves for approximately constant pen speed."""
    tokens = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', path)
    point = start = (0, 0)
    total = 0
    i = 0
    while i < len(tokens):
        command = tokens[i]
        i += 1
        if command in ('M', 'L'):
            target = tuple(map(float, tokens[i:i + 2]))
            i += 2
            if command == 'M':
                start = target
            else:
                total += math.dist(point, target)
            point = target
        elif command == 'C':
            values = list(map(float, tokens[i:i + 6]))
            i += 6
            p0, p1, p2, p3 = point, values[:2], values[2:4], values[4:]
            for step in range(1, 101):
                t = step / 100
                u = 1 - t
                target = tuple(u**3*p0[k] + 3*u*u*t*p1[k] + 3*u*t*t*p2[k] + t**3*p3[k] for k in (0, 1))
                total += math.dist(point, target)
                point = target
        elif command == 'Z':
            total += math.dist(point, start)
            point = start
    return total


source = ROOT / 'assets/lettering/playwrite-vn-300-subset.ttf'
font_file = TTFont(source)
glyphs = font_file.getGlyphSet()
buffer = hb.Buffer()
buffer.add_str('xin chào')
buffer.guess_segment_properties()
hb.shape(hb.Font(hb.Face(source.read_bytes())), buffer)
outlines = []
x = 40
for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
    pen = SVGPathPen(glyphs)
    glyphs[font_file.getGlyphOrder()[info.codepoint]].draw(TransformPen(pen,
        (.118, 0, 0, -.118, x + position.x_offset * .118, 160 - position.y_offset * .118)))
    outlines.append(re.sub(r'-?\d+\.\d+', lambda m: f'{float(m[0]):.3f}'.rstrip('0').rstrip('.'), pen.getCommands()))
    x += position.x_advance * .118
contours = [re.findall(r'M[^M]+', p) for p in outlines]

lengths = [length(path) for _, path in STROKES]
speed = sum(lengths) / 1700
delay = 80
pens = {}
for (name, path), distance in zip(STROKES, lengths):
    duration = max(35, round(distance / speed))
    pens[name] = (path, delay, duration)
    delay += duration + (0 if name == 'c-h' else 16)
duration = delay - 16

clips = {
    'x-first': 'M40 90 H83 V114 L86 129 L140 139 V180 H82 V144 L77.6 129 H40 Z',
    'n-stem': 'M167 95 H178 V166 H167 Z',
    # Partition the OVERLAPPING c connector and h stem as one region. The old
    # separate masks left the rounded c terminal protruding into the upstroke.
    # At x=345.502 (the font's stem edge), these two cubics meet the original
    # connector at y=123.428952 / 134.768449 with matching tangents. Their other
    # ends meet the actual ascender edges, also tangentially. No corners remain
    # in the exposed ribbon; the downstroke restores the complete font junction.
    'h-up': 'M0 90 H345.502 V123.428952 C347.523882 119.044807 352.228 112.918 353.644 109.378 C354.588 107.018 355.6 101 356 97 V34 H340 V0 H380 V121.65 H353.644 C350.9064 125.8036 348.024318 130.455049 345.502 134.768449 V180 H0 Z',
    'h-down': 'M344 26 H358 V166 H344 Z',
}
parts = [
    (outlines[0] + outlines[1], [('x-first', 'x-first'), ('x-cross', None)]),
    (contours[2][0] + outlines[3], [('i', None)]),
    (contours[2][1], [('i-dot', None)]),
    (outlines[4], [('n-stem', 'n-stem'), ('n-arch', None)]),
    (outlines[6] + outlines[7] + contours[8][1] + contours[8][2], [('c-h', 'h-up'), ('h-down', 'h-down')]),
    (contours[8][0] + outlines[9], [('h-arch', None)]),
    (contours[10][0], [('a-bowl', None)]),
    (contours[10][1] + outlines[11], [('a-stem', None)]),
    (outlines[13], [('o', None)]),
    (outlines[12], [('grave', None)]),
]
definitions = [f'        <clipPath id="hello-{name}"><path d="{path}"/></clipPath>' for name, path in clips.items()]
ink = []
for i, (outline, strokes) in enumerate(parts):
    paths = []
    for name, clip in strokes:
        path, start, time = pens[name]
        clip_attr = f' clip-path="url(#hello-{clip})"' if clip else ''
        paths.append(f'          <path class="hello__pen" data-stroke="{name}" pathLength="1" d="{path}"{clip_attr} style="--delay:{start}ms;--duration:{time}ms"/>')
    definitions.append(f'        <mask id="hello-mask-{i}" maskUnits="userSpaceOnUse" x="0" y="-20" width="640" height="240" style="mask-type:luminance">\n' + '\n'.join(paths) + '\n        </mask>')
    ink.append(f'        <path d="{outline}" mask="url(#hello-mask-{i})"/>')
svg = f'''    <svg class="hello" viewBox="0 -20 640 220" data-duration="{duration}" role="img" aria-label="xin chào" focusable="false">
      <!-- Exact Playwrite VN 300 outlines, shaped from the original font file. -->
      <defs>
{chr(10).join(definitions)}
      </defs>
      <g class="hello__ink" transform="translate(22 0)">
{chr(10).join(ink)}
      </g>
    </svg>'''
page = ROOT / 'index.html'
html = page.read_text(encoding='utf-8')
html = re.sub(r'    <svg class="hello"[\s\S]*?</svg>', lambda _: svg, html, count=1)
page.write_text(html, encoding='utf-8')
print(f'Generated original Playwrite VN 300 greeting, duration {duration} ms')
