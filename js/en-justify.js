/* ==========================================================================
   EN only — optimal line breaking for justified paragraphs
   English words are longer than Vietnamese syllables, so the browser's greedy
   line breaker leaves some justified lines with only a few words and very
   wide gaps. This script keeps the same number of lines the browser would
   use, then chooses the break points that spread the spare space evenly
   (a small Knuth–Plass pass), never leaves one or two words alone on the
   last line, and lets a line absorb a hair of letter-spacing before its word
   gaps have to stretch. Each line becomes a block span justified on its own.
   The Vietnamese page never loads this logic (it returns immediately).
   ========================================================================== */
(function () {
  'use strict';
  if (document.documentElement.dataset.lang !== 'en' || !window.ResizeObserver) return;

  const SEL = '.desc, .ch__text, .hero-pos, .ch-stat > span, .vrow__proof, .quote__text, .kbh-pillar__txt small';
  const MAX_LS = 0.02;        // letter-spacing a line may absorb, in em
  const MIN_LS = 0.008;       // letter-spacing a tight line may give up, in em
  const MIN_SPACE = 0.16;     // narrowest word space on a tight line, in em
  const MIN_LAST = 3;         // fewest words a last line may hold …
  const LAST_FILL = 0.42;     // … unless it already fills this much of the column
  const ctx = document.createElement('canvas').getContext('2d');
  const state = new WeakMap(); // el -> { host, text, width }
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* The element whose text is rewritten: the paragraph itself, or — for the
     "Results" box, whose label is a sibling grid item — a wrapper around the text. */
  function hostOf(el) {
    if (!el.classList.contains('vrow__proof')) {
      for (const n of el.childNodes) if (n.nodeType === 1 && !n.classList.contains('jl')) return null;
      return el;
    }
    let host = el.querySelector(':scope > .jt');
    if (host) return host;
    const texts = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!texts.length) return null;
    host = document.createElement('span');
    host.className = 'jt';
    texts[0].before(host);
    texts.forEach(n => host.append(n));
    return host;
  }

  function breakLines(words, widths, space, W, fs) {
    const n = words.length;
    const nat = (i, j) => { let s = (j - i - 1) * space; for (let k = i; k < j; k++) s += widths[k]; return s; };
    const shrink = (i, j) => { let c = 0; for (let k = i; k < j; k++) c += words[k].length; return c * MIN_LS * fs + (j - i - 1) * Math.max(0, space - MIN_SPACE * fs); };
    // greedy pass = the line count the browser itself would produce
    let lines = 0;
    for (let i = 0; i < n;) {
      let j = i + 1;
      while (j < n && nat(i, j + 1) <= W) j++;
      i = j; lines++;
    }
    if (lines < 2) return null;
    const minLast = Math.min(MIN_LAST, Math.max(1, n - lines + 1));
    // cost[k][j]: best cost of setting words[0..j) on k lines
    const INF = 1e18;
    const cost = Array.from({ length: lines + 1 }, () => new Float64Array(n + 1).fill(INF));
    const from = Array.from({ length: lines + 1 }, () => new Int32Array(n + 1));
    cost[0][0] = 0;
    for (let k = 1; k <= lines; k++) {
      const last = k === lines;
      for (let j = 1; j <= n; j++) {
        if (last && j !== n) continue;
        for (let i = j - 1; i >= 0; i--) {
          const w = nat(i, j);
          if (w > W + (last ? 0 : shrink(i, j))) break;
          if (cost[k - 1][i] >= INF) continue;
          let c;
          // A two-word ending is fine once it fills a good part of the measure
          // ("… & management systems."); a single word is always an orphan.
          if (last) c = (j - i >= minLast || (j - i === 2 && w >= LAST_FILL * W)) ? 0 : 1e6;
          else {
            const gaps = j - i - 1, slack = (W - w) / fs;
            if (slack < 0) c = Math.pow(-slack / gaps * 2.5, 3) * 100;   // a tightened line
            else c = gaps ? Math.pow(slack / gaps, 3) * 100 : slack * slack * 1e3;
          }
          if (cost[k - 1][i] + c < cost[k][j]) { cost[k][j] = cost[k - 1][i] + c; from[k][j] = i; }
        }
      }
    }
    if (cost[lines][n] >= INF) return null;
    const out = [];
    for (let k = lines, j = n; k > 0; k--) { const i = from[k][j]; out.unshift([i, j]); j = i; }
    return out;
  }

  /* Reads layout only and returns the DOM write, so a batch of paragraphs costs one reflow */
  function measure(el) {
    const st = state.get(el);
    if (!st) return null;
    const { host, text } = st;
    const cs = getComputedStyle(host);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const W = host.clientWidth - pad - 1;
    st.width = host.clientWidth;
    const plain = () => { if (host.firstElementChild || host.textContent !== text) host.textContent = text; };
    if (getComputedStyle(el).textAlign !== 'justify' || W < 60) return plain;
    const fs = parseFloat(cs.fontSize);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const words = text.split(' ');
    const widths = words.map(w => ctx.measureText(w).width);
    const ws = parseFloat(cs.wordSpacing) || 0;
    const space = ctx.measureText(' ').width + ws;
    const plan = breakLines(words, widths, space, W, fs);
    if (!plan) return plain;
    const html = plan.map(([i, j], k) => {
      const line = words.slice(i, j).join(' ');
      if (k === plan.length - 1) return `<span class="jl jl--last">${esc(line)}</span>`;
      const gaps = j - i - 1, chars = line.length - gaps;
      let w = gaps * space; for (let m = i; m < j; m++) w += widths[m];
      let css = '';
      if (w <= W) {
        const ls = Math.min(MAX_LS * fs, (W - w) * 0.6 / chars);
        if (ls > 0.05) css = `letter-spacing:${ls.toFixed(2)}px`;
      } else {
        // too long by a hair: tighten letters first, then word spaces
        const over = w - W + 0.5;
        const ls = Math.min(MIN_LS * fs, over / chars);
        css = `letter-spacing:${(-ls).toFixed(2)}px`;
        const rest = over - ls * chars;
        if (rest > 0 && gaps) css += `;word-spacing:${(ws - rest / gaps).toFixed(2)}px`;
      }
      return `<span class="jl"${css ? ` style="${css}"` : ''}>${esc(line)}</span>`;
    }).join(' ');
    return () => { host.innerHTML = html; };
  }

  function layoutAll(els) {
    els.map(measure).forEach(write => write && write());
  }

  const ro = new ResizeObserver(entries => {
    layoutAll(entries.map(e => e.target).filter(el => {
      const st = state.get(el);
      return st && Math.abs(st.host.clientWidth - st.width) > 0.5;
    }));
  });

  function scan(root) {
    const list = root.matches && root.matches(SEL) ? [root] : [];
    list.push(...(root.querySelectorAll ? root.querySelectorAll(SEL) : []));
    const fresh = [];
    for (const el of list) {
      const st = state.get(el);
      if (st && el.contains(st.host)) continue;
      const host = hostOf(el);
      if (!host) continue;
      const text = host.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      state.set(el, { host, text, width: -1 });
      fresh.push(el);
    }
    layoutAll(fresh);
    fresh.forEach(el => ro.observe(el));
  }

  function start() {
    scan(document.body);
    let pending = [], queued = false;
    new MutationObserver(records => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.classList.contains('jl')) pending.push(n);
      if (!pending.length || queued) return;
      queued = true;
      requestAnimationFrame(() => { const p = pending; pending = []; queued = false; p.forEach(n => n.isConnected && scan(n)); });
    }).observe(document.body, { childList: true, subtree: true });
    // webfonts change every width: re-set everything once they are in
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayoutAll);
  }

  function relayoutAll() {
    layoutAll([...document.querySelectorAll(SEL)].filter(el => state.has(el)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.LTV_JUSTIFY = {
    relayout: relayoutAll,
    // replace a registered paragraph's text and set it again
    set(el, text) { const st = state.get(el); if (st) { st.text = text; layoutAll([el]); } }
  };
})();
