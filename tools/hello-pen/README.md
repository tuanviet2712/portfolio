# Preloader greeting — pen animation ("xin chào" / "Hello")

> **Superseded (2026-09-28).** Neither greeting comes from this pipeline any more.
> - VI: `index.html` uses ledinhtuan.com's own "xin chào" lettering, used with permission.
> - EN: `js/hello-en.js` uses a "hello" built from those same strokes by
>   `tools/hello-ldt/build-hello-en.cjs`.
>
> This pen-mask pipeline for the Playwrite VN font is kept for reference only. `emit.py`
> stops unless you pass `--force`, which would put the old version back.

The greeting letters are the exact **Playwrite VN 300** outlines and are never redrawn.
A luminance mask made of pen strokes reveals them the way ledinhtuan.com writes its intro:
each stroke draws from pen-down to pen-up, fades in as the pen touches the paper, the
i-dot pops in (scale 0 → 1), and the Vietnamese grave accent is a slow final flourish.

What makes it smooth and even:

- **Pens follow the real centre-line of each stroke.** It is computed from the font's own ink
  (skeleton of a 10× raster), not drawn by hand, and joined through crossings with smooth
  bridges.
- **Pen speed follows the 2/3 power law of handwriting.** The pen is slower in tight turns
  (loop tops, the bottoms of stems), faster on straight runs, and eased at pen-down and
  pen-up. The average speed is 620 units/s, which puts "xin chào" (2.7 s) at
  ledinhtuan.com's 1.1–1.25 word-widths per second. "Hello" uses the same hand speed
  (2.6 s). Each pen carries its own keyframes, so the speed profile is exact and needs no
  JavaScript.
- **Each pen reveals only its own ink.** Where a pen would touch ink that belongs to a later
  stroke (a crossing, a stroke that joins another), it is clipped. Later pens may paint over
  earlier regions, so no seam can show. The small fillet where two strokes join appears when
  the later stroke arrives.
- **The final frame equals the font.** `check.cjs` compares it with the unmasked outlines; a
  3-pixel difference at 3× is the expected result. `.is-written` also drops the mask
  (`mask: none`).

Runtime contract (unchanged): `js/core.js` adds `.is-writing`, waits for the `animationend`
of the **last** `.hello__pen`, then adds `.is-written`. `data-duration` is the fallback.
The CSS is in `css/style.css` and `css/style.min.css`, under `.hello__pen`, `.hello__dot`
and `--l` / `--anim`.

## Re-running

```bash
# 1. a headless Chrome for rasterising and checking
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9223 about:blank &

# 2. Python env (numpy, scipy, scikit-image, pillow, skan)
uv venv .venv-hello && uv pip install --python .venv-hello/Scripts/python.exe -r tools/hello-pen/requirements.txt

# 3. pipeline (intermediates go to %TEMP%/ltv-hello-pen, or $HELLO_WORK)
node tools/hello-pen/raster.cjs                    # exact outlines -> 10x PNG (reads index.html / js/hello-en.js)
.venv-hello/Scripts/python tools/hello-pen/pen.py  # pens, speed, ownership -> pens-<lang>.json (+ pens-<lang>.png debug)
.venv-hello/Scripts/python tools/hello-pen/emit.py # writes index.html (VI) and js/hello-en.js (EN), preview-<lang>.html
node tools/hello-pen/check.cjs                     # last frame == outlines, filmstrip film-<lang>-*.png
```

Pass `vi` or `en` to any step to do one language. Tuning knobs are at the top of `pen.py`:
`PACE_U` (hand speed), `MAX_PEN`, `R_PEN`, `K0`, and `min_dur` per stroke.

To change the lettering (other words or another font), regenerate the outlines first. Then
run `raster.cjs` and `graph.py`. `graph.py` writes a labelled overview of the skeleton
branches. Rewrite the stroke order in `CFG` in `pen.py`: branches are referenced by their
end points and a point along them, in SVG root coordinates.
