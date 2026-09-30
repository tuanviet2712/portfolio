"""Step 4 - write the greeting SVG into the site.

VI -> the <svg class="hello"> block inside #preloader in index.html
EN -> js/hello-en.js (i18n.js swaps it in on ?lang=en)
The ink paths are copied verbatim from the current markup (exact Playwrite VN 300 outlines);
only the pen mask, its keyframes and the i-dot animation are regenerated. The CSS that drives
them (.hello__pen / .hello__dot, --l, --anim) lives in css/style.css and css/style.min.css.
Also writes preview-<lang>.html to the work folder (open it in a browser, "replay").

Usage: python tools/hello-pen/emit.py [vi] [en]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graph import WORK  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
EASE_OUT = 'cubic-bezier(0,0,.58,1)'   # framer-motion "easeOut" (ledinhtuan.com's i-dot)
META = {
    'vi': dict(cls='hello', label='xin chào', prefix='hello', kf='hp', gx=22),
    'en': dict(cls='hello hello--en', label='Hello', prefix='hello-en', kf='hpe', gx=0),
}
# the production rules (copied into previews; keep in sync with css/style.css)
CSS = (".hello{width:min(640px,82vw);height:auto;overflow:visible}.hello__ink{fill:currentColor}"
       ".hello__pen{stroke-dasharray:var(--l) var(--l);stroke-dashoffset:var(--l);opacity:0}"
       ".hello__dot{transform-box:fill-box;transform-origin:50% 50%;transform:scale(0);opacity:0}"
       ".preloader.is-writing .hello__pen,.preloader.is-writing .hello__dot{animation:var(--anim)}"
       ".preloader.is-written .hello__pen{animation:none;stroke-dashoffset:0;opacity:1}"
       ".preloader.is-written .hello__dot{animation:none;transform:none;opacity:1}"
       ".preloader.is-written .hello__ink [mask]{mask:none}")


def num(v, nd=1):
    s = f'{v:.{nd}f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def current(lang):
    if lang == 'vi':
        return re.search(r'<svg class="hello"[\s\S]*?</svg>', open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()).group(0)
    js = open(os.path.join(ROOT, 'js/hello-en.js'), encoding='utf8').read()
    return json.loads(re.search(r'window\.LTV_HELLO_EN = (".*");', js).group(1))


def ink_paths(lang):
    """(outline path data without the i-dot, i-dot path data or None) from the current markup."""
    g = re.search(r'<g class="hello__ink"[^>]*>([\s\S]*?)</g>\s*</svg>', current(lang)).group(1)
    body, dot = [], None
    for tag in re.findall(r'<path\b[^>]*>', g):
        d = re.search(r'\sd="([^"]+)"', tag).group(1)
        # the i-dot: class hello__dot (this generator) or mask #hello-mask-2 (the previous one)
        if 'hello__dot' in tag or 'hello-mask-2)' in tag:
            dot = d
        else:
            body.append(d)
    return ''.join(body), dot


def keyframes(name, pen):
    L = pen['L'] + 1.0                  # 1 unit of slack: the dash always covers the whole path
    dur = pen['dur']
    fade = min(0.18, 0.7 * dur) if pen['first'] else 0.0      # pen-down: ink fades in, as on ledinhtuan.com
    frames = {}
    for t, s in zip(pen['tt'], pen['trav']):
        pct = round(100 * t / dur, 1)
        frames.setdefault(pct, {})['stroke-dashoffset'] = max(0.0, L - s)
        if fade and t <= fade + 1e-9:
            frames[pct]['opacity'] = 1 - (1 - t / fade) ** 2
    frames[0.0].setdefault('opacity', 0.0 if fade else 1.0)
    if fade:
        frames.setdefault(round(100 * fade / dur, 1), {})['opacity'] = 1.0
    frames[100.0] = {'stroke-dashoffset': 0.0, 'opacity': 1.0}   # every property at 100%
    body = ''.join(f'{num(p)}%{{' + ';'.join(f'{k}:{num(v, 2 if k == "opacity" else 1)}' for k, v in f.items()) + '}'
                   for p, f in sorted(frames.items()))
    return f'@keyframes {name}{{{body}}}', L


def build(lang):
    m = META[lang]
    data = json.load(open(os.path.join(WORK, f'pens-{lang}.json')))
    body, dot = ink_paths(lang)
    kfs, pens, clips, fills = [], [], [], []
    for i, pen in enumerate(data['pens']):
        name = f"{m['kf']}{i}"
        kf, L = keyframes(name, pen)
        kfs.append(kf)
        clip = ''
        if pen['clip']:
            cid = f"{m['prefix']}-c{i}"
            clips.append(f'<clipPath id="{cid}"><path clip-rule="evenodd" d="{pen["clip"]}"/></clipPath>')
            clip = f' clip-path="url(#{cid})"'
        pens.append(f'<path class="hello__pen" d="{pen["d"]}" style="--l:{num(L)};--anim:{name} '
                    f'{round(pen["dur"] * 1000)}ms linear {round(pen["t0"] * 1000)}ms forwards"{clip}/>')
    if data['patches']:
        kfs.append(f"@keyframes {m['kf']}f{{from{{opacity:0}}to{{opacity:1}}}}")
        for p in data['patches']:
            fills.append(f'<circle class="hello__pen" cx="{num(p["cx"], 2)}" cy="{num(p["cy"], 2)}" r="{num(p["r"], 2)}" '
                         f'fill="#fff" stroke="none" style="--anim:{m["kf"]}f 40ms linear {round(p["t"] * 1000)}ms forwards"/>')
    dot_el = ''
    if dot and data['dot']:
        kfs.append('@keyframes hdot{to{transform:none;opacity:1}}')
        dot_el = (f'<path class="hello__dot" d="{dot}" style="--anim:hdot {round(data["dot"]["dur"] * 1000)}ms '
                  f'{EASE_OUT} {round(data["dot"]["t0"] * 1000)}ms forwards"/>')
    total = round(data['total'] * 1000)
    tf = f' transform="translate({m["gx"]} 0)"' if m['gx'] else ''
    # fillet dots first: the LAST .hello__pen must be the last stroke (core.js waits for its animationend)
    parts = dict(
        open=(f'<svg class="{m["cls"]}" viewBox="0 -20 640 220" data-duration="{total}" role="img" '
              f'aria-label="{m["label"]}" focusable="false">'),
        note='<!-- Exact Playwrite VN 300 outlines, written by a pen mask. Generated by tools/hello-pen (README). -->',
        style=f'<style>{"".join(kfs)}</style>',
        clips=clips,
        mask=(f'<mask id="{m["prefix"]}-pen" maskUnits="userSpaceOnUse" x="-60" y="-20" width="760" height="220">'),
        group='<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">',
        pens=fills + pens,
        ink=f'<g class="hello__ink"{tf}>',
        body=f'<path d="{body}" mask="url(#{m["prefix"]}-pen)"/>',
        dot=dot_el)
    return parts, total


def compact(p):
    return (p['open'] + p['style'] + '<defs>' + ''.join(p['clips']) + p['mask'] + p['group'] + ''.join(p['pens']) +
            '</g></mask></defs>' + p['ink'] + p['body'] + p['dot'] + '</g></svg>')


def pretty(p, ind='    '):
    i1, i2, i3, i4 = ind + '  ', ind + '    ', ind + '      ', ind + '        '
    lines = [p['open'], i1 + p['note'], i1 + p['style'], i1 + '<defs>']
    lines += [i2 + c for c in p['clips']]
    lines += [i2 + p['mask'], i3 + p['group']] + [i4 + x for x in p['pens']] + [i3 + '</g>', i2 + '</mask>', i1 + '</defs>']
    lines += [i1 + p['ink'], i2 + p['body']] + ([i2 + p['dot']] if p['dot'] else []) + [i1 + '</g>', ind + '</svg>']
    return '\n'.join(lines)


def main(lang):
    if '--force' not in sys.argv:
        raise SystemExit('superseded: both greetings now use the ledinhtuan.com lettering (tools/hello-ldt); '
                         'pass --force to put the pen-mask version back')
    parts, total = build(lang)
    svg = compact(parts)
    if lang == 'vi':
        path = os.path.join(ROOT, 'index.html')
        html = open(path, encoding='utf8', newline='').read()          # keep the file's CRLF
        eol = '\r\n' if '\r\n' in html else '\n'
        new, n = re.subn(r'<svg class="hello"[\s\S]*?</svg>', lambda _: pretty(parts).replace('\n', eol), html, count=1)
        if n != 1:
            raise SystemExit('index.html: <svg class="hello"> not found')
        open(path, 'w', encoding='utf8', newline='').write(new)
    else:
        open(os.path.join(ROOT, 'js/hello-en.js'), 'w', encoding='utf8', newline='\r\n').write(
            '/* Exact Playwrite VN 300 outlines for the English preloader, written by a pen mask.\n'
            '   Generated by tools/hello-pen (README); i18n.js swaps it in on ?lang=en. */\n'
            'window.LTV_HELLO_EN = ' + json.dumps(svg, ensure_ascii=False) + ';\n')
    page = ('<!doctype html><meta charset="utf-8"><title>greeting preview</title><style>'
            'html,body{margin:0;background:#0c1428;color:#f5f8ff;font:14px system-ui}'
            '.stage{width:700px;height:260px;display:grid;place-items:center;'
            'background:radial-gradient(60% 50% at 50% 55%,#26325a,transparent 70%),#0e1830}.stage .hello{width:640px}'
            + CSS + '</style><div class="preloader stage">' + svg + '</div><p style="padding:0 16px">' + str(total) +
            ' ms <button onclick="const s=document.querySelector(\'.stage\');s.classList.remove(\'is-writing\',\'is-written\');'
            'void s.offsetWidth;s.classList.add(\'is-writing\')">replay</button></p>'
            '<script>requestAnimationFrame(()=>document.querySelector(".stage").classList.add("is-writing"))</script>')
    open(os.path.join(WORK, f'preview-{lang}.html'), 'w', encoding='utf8').write(page)
    print(f'{lang}: {len(svg) / 1024:.1f} KB, {total} ms -> {"index.html" if lang == "vi" else "js/hello-en.js"}; '
          f'preview {os.path.join(WORK, f"preview-{lang}.html")}')


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['en']:
        main(lang)
