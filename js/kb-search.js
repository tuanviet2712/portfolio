/* ==========================================================================
   GÓC KIẾN THỨC — tìm kiếm bài viết ngay trên trình duyệt (không cần máy chủ)
   Chỉ mục goc-kien-thuc/search.json do tools/kb/build-kb.cjs tạo, chỉ tải khi người đọc bắt đầu tìm.
   - Ô tìm kiếm ở đầu trang tổng / trang chủ đề: kết quả hiện ngay bên dưới khi gõ.
   - Nút kính lúp trên menu (hoặc phím "/", Ctrl/⌘ + K) mở hộp tìm kiếm ở mọi trang.
   - Gõ không dấu vẫn tìm được ("ke hoach" khớp "Kế hoạch"), từ khớp được tô sáng.
   - ↑ ↓ chọn kết quả, Enter mở, Esc đóng. Địa chỉ ?q=… mở sẵn kết quả.
   ========================================================================== */
(() => {
  'use strict';
  const forms = Array.from(document.querySelectorAll('form[data-kb-search]'));
  if (!forms.length) return;
  const dlg = document.getElementById('kb-search');
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------- Chỉ mục ---------------- */
  let DATA = null, pending = null;
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Từ phổ biến không bắt buộc phải khớp ("kế hoạch marketing là gì" vẫn ra bài không có chữ "là gì")
  const STOP = new Set(['la', 'gi', 'va', 'cua', 'cho', 'cac', 'nhung', 'mot', 'voi', 'trong', 'the', 'nao', 'co', 'khong', 'de', 'khi', 'nhu', 've', 'o', 'tai', 'thi', 'se', 'da', 'duoc', 'hay', 'hoac', 'tu', 'den', 'nay', 'do', 'sao', 'vi', 'bang', 'cach']);

  function load(src) {
    if (DATA) return Promise.resolve(DATA);
    if (!pending) {
      pending = fetch(src, { credentials: 'same-origin' })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(j => (DATA = prep(j)))
        .catch(err => { pending = null; throw err; });
    }
    return pending;
  }
  function prep(j) {
    j.posts = j.posts || [];
    j.pillars = j.pillars || [];
    j.posts.forEach(p => {
      p._t = fold(p.t);
      p._k = fold((p.k || []).join(' | '));
      p._c = fold(p.c);
      p._h = fold((p.h || []).join(' | '));
      p._x = fold([p.e].concat(p.x || []).join(' | '));
      p.b = p.b || '';
      p._b = fold(p.b);
      p._lines = (p.h || []).concat(p.x || []);
    });
    j.pillars.forEach(p => { p._t = fold(p.n); p._x = fold([p.s].concat(p.tp || []).join(' | ')); });
    j.latest = j.posts.slice().sort((a, b) => String(b.d).localeCompare(String(a.d)));
    return j;
  }

  /* ---------------- Tìm ---------------- */
  function parse(q) {
    const f = fold(q).replace(/\s+/g, ' ').trim();
    const toks = Array.from(new Set(f.split(/[^a-z0-9]+/).filter(Boolean))).slice(0, 8);
    const need = toks.filter(t => !STOP.has(t));
    return { f, toks, need: need.length ? need : toks, res: toks.map(t => ({ t, re: new RegExp('(?:^|[^a-z0-9])' + reEsc(t)) })) };
  }
  function scorePost(p, Q) {
    let score = 0, hit = 0;
    Q.res.forEach(({ t, re }) => {
      const s = (re.test(p._t) ? 10 : 0) + (re.test(p._k) ? 6 : 0) + (re.test(p._c) ? 4 : 0) + (re.test(p._h) ? 3 : 0) + (re.test(p._x) ? 1 : 0) + (re.test(p._b) ? 1 : 0);
      if (!s) return;
      score += s;
      if (Q.need.includes(t)) hit++;
    });
    if (Q.f.length > 2 && p._t.includes(Q.f)) score += 20;
    return { score, hit };
  }
  function search(q) {
    const Q = parse(q);
    if (!Q.toks.length) return null;
    const scored = DATA.posts.map(p => ({ p, ...scorePost(p, Q) }));
    let posts = scored.filter(x => x.hit === Q.need.length);
    let loose = false;
    if (!posts.length && Q.need.length > 1) {        // không bài nào khớp đủ: lấy bài khớp quá nửa số từ
      posts = scored.filter(x => x.hit >= Math.ceil(Q.need.length / 2));
      loose = posts.length > 0;
    }
    posts.sort((a, b) => b.score - a.score || String(b.p.d).localeCompare(String(a.p.d)));
    const pillars = DATA.pillars.filter(p => Q.need.every(t => { const re = new RegExp('(?:^|[^a-z0-9])' + reEsc(t)); return re.test(p._t) || re.test(p._x); }));
    return { Q, posts: posts.slice(0, 8).map(x => x.p), pillars, loose };
  }

  // Tô sáng: gấp từng ký tự để vị trí trên chuỗi không dấu khớp với chuỗi gốc có dấu
  function marked(text, Q) {
    const src = String(text), frag = document.createDocumentFragment();
    let f = '';
    const map = [];
    for (let i = 0; i < src.length; i++) { const c = fold(src[i]); for (let k = 0; k < c.length; k++) { f += c[k]; map.push(i); } }
    const ranges = [];
    Q.toks.forEach(t => {
      const re = new RegExp('(^|[^a-z0-9])(' + reEsc(t) + ')', 'g');
      let m;
      while ((m = re.exec(f))) { const s = m.index + m[1].length; ranges.push([s, s + t.length]); }
    });
    if (!ranges.length) { frag.append(src); return frag; }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(r => { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r.slice()); });
    let pos = 0;
    merged.forEach(([s, e]) => {
      const a = map[s], b = e < map.length ? map[e] : src.length;
      if (a > pos) frag.append(src.slice(pos, a));
      const mk = document.createElement('mark');
      mk.textContent = src.slice(a, b);
      frag.append(mk);
      pos = b;
    });
    if (pos < src.length) frag.append(src.slice(pos));
    return frag;
  }
  // Dòng gợi ý dưới tiêu đề: tiêu đề mục / ý tóm tắt / câu hỏi FAQ khớp nhiều từ nhất
  // (không có thì cắt một đoạn quanh từ khóa trong thân bài)
  function snippet(p, Q) {
    let best = null, most = 0;
    p._lines.forEach(line => {
      const f = fold(line);
      if (f === p._t) return;
      const n = Q.res.filter(({ re }) => re.test(f)).length;
      if (n > most) { most = n; best = line; }
    });
    if (most >= Q.res.length || !p.b) return best;
    // ưu tiên từ khóa chưa có trong dòng gợi ý (vd. "smart" khi dòng gợi ý chỉ chứa "kế hoạch")
    const bf = best ? fold(best) : '';
    const wordRe = t => new RegExp('(?:^|[^a-z0-9])' + reEsc(t));
    for (const t of Q.need.filter(t => !wordRe(t).test(bf))) {
      const m = wordRe(t).exec(p._b);
      if (!m) continue;
      const at = m.index, from = Math.max(0, p.b.lastIndexOf(' ', at - 40) + 1), to = Math.min(p.b.length, at + 110);
      return (from ? '… ' : '') + p.b.slice(from, to).trim() + (to < p.b.length ? ' …' : '');
    }
    return best;
  }

  /* ---------------- Vẽ kết quả ---------------- */
  const el = (tag, cls, attrs, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    if (text != null) n.textContent = text;
    return n;
  };
  const icon = id => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s; };

  function option(ui, href, build, extra) {
    const li = el('li', 'kb-sr' + (extra ? ' ' + extra : ''), { role: 'option', id: `${ui.id}-o${ui.opts.length}`, 'aria-selected': 'false' });
    const a = el('a', '', { href, tabindex: '-1' });
    build(a);
    li.appendChild(a);
    ui.opts.push(li);
    ui.list.appendChild(li);
  }
  function addPost(ui, p, Q) {
    option(ui, ui.rel + p.u, a => {
      const fig = el('span', 'kb-sr__img');
      fig.appendChild(el('img', '', { src: ui.rel + p.img, alt: '', width: '120', height: '63', loading: 'lazy', decoding: 'async' }));
      const txt = el('span', 'kb-sr__txt');
      const t = el('span', 'kb-sr__t');
      t.appendChild(Q ? marked(p.t, Q) : document.createTextNode(p.t));
      const m = el('span', 'kb-sr__m');
      m.append(el('b', '', null, p.c), el('span', '', null, `${p.r} phút đọc`));
      txt.append(t, m);
      const s = Q && snippet(p, Q);
      if (s) { const sn = el('span', 'kb-sr__s'); sn.appendChild(marked(s, Q)); txt.appendChild(sn); }
      a.append(fig, txt);
    });
  }
  function addPillar(ui, p, Q) {
    option(ui, ui.rel + p.u, a => {
      const ic = el('span', 'kb-sr__ico');
      ic.appendChild(icon(p.i));
      const txt = el('span', 'kb-sr__txt');
      const t = el('span', 'kb-sr__t');
      t.appendChild(Q ? marked(p.n, Q) : document.createTextNode(p.n));
      txt.append(t, el('span', 'kb-sr__m', null, p.s));
      a.append(ic, txt, el('span', 'kb-sr__n', null, p.c ? `${p.c} bài viết` : 'Sắp ra mắt'));
    }, 'kb-sr--topic');
  }
  const group = (ui, label) => ui.list.appendChild(el('li', 'kb-sr__g', { role: 'presentation' }, label));

  function reset(ui) {
    ui.list.textContent = '';
    ui.opts = [];
    setActive(ui, -1);
  }
  function head(ui, parts) {
    ui.head.textContent = '';
    parts.forEach(x => ui.head.append(typeof x === 'string' ? x : el('b', '', null, x.b)));
  }

  function drawResults(ui, r, q) {
    reset(ui);
    ui.empty && ui.empty.remove();
    ui.empty = null;
    const n = r.posts.length + r.pillars.length;
    if (!n) {
      head(ui, []);
      const box = el('div', 'kb-search__empty');
      box.append(el('b', '', null, `Chưa có bài viết cho “${q}”`), el('p', '', null, 'Bạn thử từ khóa ngắn hơn, hoặc nhắn cho tôi chủ đề bạn đang quan tâm'));
      if (ui.zalo) {
        const z = el('a', 'kb-search__zalo', { href: ui.zalo, target: '_blank', rel: 'noopener' }, 'Gợi ý chủ đề qua Zalo');
        z.appendChild(icon('i-arrow-up-right'));
        box.appendChild(z);
      }
      ui.list.before(box);
      ui.empty = box;
      group(ui, 'Chủ đề kiến thức');
      DATA.pillars.forEach(p => addPillar(ui, p, null));
      ui.status.textContent = `Không tìm thấy kết quả cho ${q}`;
      return;
    }
    const cnt = r.posts.length ? `${r.posts.length} bài viết` : `${r.pillars.length} chủ đề`;
    head(ui, r.loose ? ['Không có bài khớp đủ các từ, đây là ', { b: cnt }, ' gần nhất'] : [{ b: cnt }, ` phù hợp với “${q}”`]);
    if (r.posts.length) { group(ui, 'Bài viết'); r.posts.forEach(p => addPost(ui, p, r.Q)); }
    if (r.pillars.length) { group(ui, 'Chủ đề'); r.pillars.forEach(p => addPillar(ui, p, r.Q)); }
    ui.status.textContent = `${n} kết quả. Dùng phím mũi tên để chọn`;
  }
  // Hộp tìm kiếm khi chưa gõ gì: bài mới và các chủ đề
  function drawSuggest(ui) {
    reset(ui);
    ui.empty && ui.empty.remove();
    ui.empty = null;
    head(ui, []);
    if (DATA.latest.length) { group(ui, 'Bài viết mới'); DATA.latest.slice(0, 3).forEach(p => addPost(ui, p, null)); }
    group(ui, 'Chủ đề kiến thức');
    DATA.pillars.forEach(p => addPillar(ui, p, null));
    ui.status.textContent = '';
  }

  /* ---------------- Trạng thái ô tìm kiếm ---------------- */
  function setActive(ui, i) {
    ui.active = i;
    ui.opts.forEach((o, k) => o.setAttribute('aria-selected', k === i ? 'true' : 'false'));
    const o = ui.opts[i];
    if (!o) { ui.input.removeAttribute('aria-activedescendant'); return; }
    ui.input.setAttribute('aria-activedescendant', o.id);
    // cuộn trong bảng kết quả, không kéo cả trang
    const box = ui.panel, top = o.offsetTop, bottom = top + o.offsetHeight;
    if (top < box.scrollTop + 8) box.scrollTop = top - 8;
    else if (bottom > box.scrollTop + box.clientHeight - 8) box.scrollTop = bottom - box.clientHeight + 8;
  }
  function open(ui) {
    if (ui.inDialog || ui.isOpen) return;
    ui.isOpen = true;
    ui.panel.hidden = false;
    ui.input.setAttribute('aria-expanded', 'true');
  }
  function close(ui) {
    if (ui.inDialog || !ui.isOpen) return;
    ui.isOpen = false;
    ui.panel.hidden = true;
    ui.input.setAttribute('aria-expanded', 'false');
    setActive(ui, -1);
  }
  function update(ui) {
    const q = ui.input.value.replace(/\s+/g, ' ').trim();
    ui.form.classList.toggle('has-q', ui.input.value.length > 0);
    if (!q && !ui.inDialog) { close(ui); return; }
    if (!DATA) {
      head(ui, ['Đang tải dữ liệu tìm kiếm…']);
      open(ui);
      load(ui.src).then(() => update(ui), () => head(ui, ['Chưa tải được dữ liệu tìm kiếm, bạn thử lại sau nhé']));
      return;
    }
    if (!q) drawSuggest(ui);
    else drawResults(ui, search(q), q);
    open(ui);
  }
  function go(ui) {
    const o = ui.opts[ui.active >= 0 ? ui.active : (ui.input.value.trim() ? 0 : -1)];
    const a = o && o.querySelector('a');
    if (a) location.href = a.href;
  }

  const uis = forms.map(form => {
    const input = form.querySelector('input[type="search"]');
    const ui = {
      form, input, id: input.id,
      panel: form.querySelector('.kb-search__panel'),
      head: form.querySelector('.kb-search__head'),
      list: form.querySelector('.kb-search__list'),
      status: form.querySelector('[role="status"]'),
      rel: form.dataset.rel || '', src: form.dataset.kbSearch, zalo: form.dataset.zalo,
      inDialog: !!form.closest('dialog'), opts: [], active: -1, isOpen: false, timer: 0, empty: null
    };
    if (innerWidth < 480) input.placeholder = 'Tìm bài viết, chủ đề';   // câu gợi ý dài bị cắt trên điện thoại
    const warm = () => { load(ui.src).catch(() => {}); };
    input.addEventListener('focus', () => { warm(); if (input.value.trim()) update(ui); });
    input.addEventListener('pointerenter', warm, { once: true });
    input.addEventListener('input', () => { clearTimeout(ui.timer); ui.timer = setTimeout(() => update(ui), 70); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!ui.opts.length) return;
        e.preventDefault();
        open(ui);
        const n = ui.opts.length, d = e.key === 'ArrowDown' ? 1 : -1;
        setActive(ui, ui.active < 0 ? (d > 0 ? 0 : n - 1) : (ui.active + d + n) % n);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        go(ui);
      } else if (e.key === 'Escape' && ui.inDialog) {
        e.preventDefault();                           // ô search mặc định chỉ xóa chữ, ở đây Esc đóng luôn hộp
        dlg.close();
      } else if (e.key === 'Escape') {
        if (ui.isOpen) { e.preventDefault(); close(ui); }
        else if (input.value) { e.preventDefault(); input.value = ''; update(ui); }
      }
    });
    form.addEventListener('submit', e => { e.preventDefault(); go(ui); });
    const clear = form.querySelector('.kb-search__clear');
    if (clear) clear.addEventListener('click', () => { input.value = ''; update(ui); input.focus(); });
    ui.list.addEventListener('pointermove', e => {
      const li = e.target.closest && e.target.closest('.kb-sr');
      const i = li ? ui.opts.indexOf(li) : -1;
      if (i > -1 && i !== ui.active) setActive(ui, i);
    });
    if (!ui.inDialog) {
      document.addEventListener('pointerdown', e => { if (!form.contains(e.target)) close(ui); });
      form.addEventListener('focusout', e => { if (e.relatedTarget && !form.contains(e.relatedTarget)) close(ui); });
    }
    return ui;
  });

  /* ---------------- Hộp tìm kiếm (dialog) ---------------- */
  const dui = uis.find(u => u.inDialog);
  function openDialog(q) {
    if (!dlg || !dui || dlg.open) return;
    if (typeof q === 'string') dui.input.value = q;
    dlg.showModal();
    dui.input.focus();
    if (dui.input.value) dui.input.select();
    update(dui);
  }
  function openSearch() {
    // Ô tìm kiếm đầu trang đang nằm trong màn hình thì dùng luôn ô đó
    const inline = uis.find(u => !u.inDialog && (() => { const r = u.form.getBoundingClientRect(); return r.bottom > 70 && r.top < innerHeight - 80; })());
    if (inline) { inline.input.focus(); return; }
    openDialog();
  }
  if (dlg) {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-search-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('close', () => { if (dui) setActive(dui, -1); });
  }
  document.querySelectorAll('[data-search-open]').forEach(b => b.addEventListener('click', openSearch));
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing) return;
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey) { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openSearch(); }
  });

  /* ---------------- ?q=… trên địa chỉ ---------------- */
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) {
    const inline = uis.find(u => !u.inDialog);
    if (inline) { inline.input.value = q0; load(inline.src).then(() => update(inline), () => {}); }
    else openDialog(q0);
  }
})();
