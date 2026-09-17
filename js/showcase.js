/* ==========================================================================
   DỰ ÁN ĐÃ TRIỂN KHAI — các "bức tường" dự án chạy theo cuộn
   Dựng lại section "Dự án thành công" của ledinhtuan.com (Hero Parallax, Framer Motion):
   - Mới vào: bức tường lệch lên 200px, nghiêng rotateX 15° · rotateZ 20°, mờ còn 30%
   - Mép trên bức tường chạm đỉnh màn hình: dựng thẳng lại và hiện rõ trong ~1/3 màn hình cuộn
   - Hàng chẵn trượt sang phải, hàng lẻ sang trái suốt chiều cao bức tường
   - Mọi giá trị đi qua lò xo stiffness 400 · damping 40 · mass 0.8 (giống useSpring)
   Mỗi hạng mục = 1 bức tường · mỗi hàng 4 ô (máy tính thấy rõ 3 ô, ô thứ 4 trượt vào khi cuộn)
   Mỗi ô = 1 ảnh chụp thật (assets/img/projects/) · bấm ô: có link → mở Drive / Facebook ở tab mới,
   không có link → mở ảnh lớn (lightbox, có mũi tên chuyển ô) · tên đối tác chỉ hiện trong nhãn nhỏ khi rê chuột
   Dữ liệu: SITE_DATA.showcase (js/data.js)
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const { $, $$, clamp } = L;
  const DATA = window.SITE_DATA || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IMG_DIR = 'assets/img/projects/';

  /* ---------------- Loại đích: nhận từ link → nhãn + biểu tượng ---------------- */
  const KINDS = {
    sheet: { label: 'Google Sheets', re: /docs\.google\.com\/spreadsheets/i },
    doc: { label: 'Google Docs', re: /docs\.google\.com\/document/i },
    slide: { label: 'Google Slides', re: /docs\.google\.com\/presentation/i },
    drive: { label: 'Google Drive', re: /drive\.google\.com/i },
    facebook: { label: 'Facebook', re: /facebook\.com|fb\.com/i },
    tiktok: { label: 'TikTok', re: /tiktok\.com/i },
    youtube: { label: 'YouTube', re: /youtu\.?be/i },
    zalo: { label: 'Zalo', re: /zalo\.me/i },
    link: { label: 'Liên kết' },
    view: { label: 'Ảnh chụp' }
  };
  const kindOf = link => {
    if (!link) return 'view';
    for (const k in KINDS) if (KINDS[k].re && KINDS[k].re.test(link)) return k;
    return 'link';
  };
  // biểu tượng nét mảnh 24×24, cùng phong cách sprite trong index.html
  const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
  const ICON = {
    sheet: S('<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M4 9.5h16M4 15h16M10 9.5v11"/>'),
    doc: S('<path d="M7 3.5h7l5 5v10a2.5 2.5 0 0 1-2.5 2.5h-9.5A2.5 2.5 0 0 1 4.5 18.5v-12.5A2.5 2.5 0 0 1 7 3.5z"/><path d="M14 3.5v5h5M8.5 12.5h7M8.5 16h7"/>'),
    slide: S('<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 20.5h8M12 17v3.5M7.5 10h6M7.5 13h4"/>'),
    drive: S('<path d="M9 4h6l6 10.5-3 5.5H6l-3-5.5z"/><path d="M9 4 3 14.5M15 4l-5.5 10.5H21M6 20l4.5-5.5"/>'),
    facebook: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.6 21v-7.2h2.5l.4-2.9h-2.9V9c0-.8.3-1.4 1.4-1.4h1.6V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8v2.9h2.5V21z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2.3 1.7 3.8 4 4v3c-1.5 0-2.9-.5-4-1.3v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3z"/></svg>`,
    youtube: S('<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10.5 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none"/>'),
    zalo: S('<path d="M5 4.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-4.5 3v-3H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/>'),
    link: S('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>'),
    view: S('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4M11 8.5v5M8.5 11h5"/>'),
    open: S('<path d="M7 17 17 7M8 7h9v9"/>'),
    close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
    prev: S('<path d="M15 5l-7 7 7 7"/>'),
    next: S('<path d="m9 5 7 7-7 7"/>')
  };

  /* ---------------- Dữ liệu: bức tường + danh sách ô phẳng ---------------- */
  // Ô: { partner | title, img, link, note } | '' (ô trống)
  // Hàng: [ô, ô, ô, ô] | { label, items: [ô, ô, ô, ô] }
  const CELLS = []; // mọi ô có ảnh, theo thứ tự trên trang — dùng cho lightbox (chuyển ô trước/sau)
  function walls() {
    const sc = DATA.showcase || {};
    const byId = {};
    (sc.partners || []).forEach(p => (byId[p.id] = p));
    return (sc.groups || []).map(g => {
      const rows = (g.rows || []).map(r => {
        const row = Array.isArray(r) ? { items: r } : (r || {});
        const items = (row.items || []).map(it => {
          const o = it && typeof it === 'object' ? it : { partner: it || '' };
          const p = o.partner ? byId[o.partner] || { id: String(o.partner), name: String(o.partner) } : null;
          const name = String(o.title || (p && p.name) || '').trim();
          if (!name) return { empty: true };
          const link = String(o.link || '').trim();
          const kind = kindOf(link);
          const img = String(o.img || '').trim();
          const cell = {
            name, link, kind,
            note: String(o.note || '').trim() || KINDS[kind].label,
            shot: img ? IMG_DIR + img + '.jpg' : '',
            shot1x: img ? IMG_DIR + img + '-1x.jpg' : '',
            full: img ? IMG_DIR + img + '-full.jpg' : '',
            group: g.name, rowLabel: row.label || '', idx: -1
          };
          if (cell.shot) { cell.idx = CELLS.length; CELLS.push(cell); }
          return cell;
        });
        return { label: row.label || '', items };
      });
      return { id: g.id, no: g.no || '', name: g.name, desc: g.desc || '', rows };
    });
  }

  function titleHTML(name) {
    // phần sau "&" (hoặc sau 2 từ đầu) tô gradient: "Plan & <Campaign>", "Hạng mục <khác>"
    const s = String(name).trim();
    let i = s.indexOf('&');
    if (i >= 0) i += 1;
    else { const w = s.split(/\s+/); i = w.length > 2 ? w.slice(0, 2).join(' ').length : w.length > 1 ? w[0].length : 0; }
    const a = s.slice(0, i).trim(), c = s.slice(i).trim();
    return c ? `${esc(a)} <span class="grad">${esc(c)}</span>` : `<span class="grad">${esc(a)}</span>`;
  }

  /* ---------------- Thẻ ---------------- */
  /* ---------------- Thẻ: chỉ là ảnh chụp trong khung trắng (như ledinhtuan.com) ----------------
     Tên đối tác + loại đích nằm trong một nhãn nhỏ góc trái dưới, chỉ hiện khi rê chuột
     (màn cảm ứng: hiện cố định, cỡ nhỏ). Không dải tối, không nút tròn. */
  function cardHTML(it) {
    if (it.empty) {
      return `<div class="pw-card pw-card--empty" aria-hidden="true"><span class="pw-card__frame"><span class="pw-ph pw-ph--empty"><b>Đang cập nhật</b></span></span></div>`;
    }
    const where = it.rowLabel ? `${it.group}, ${it.rowLabel}` : it.group;
    const media = it.shot
      ? `<img src="${esc(it.shot)}" srcset="${esc(it.shot1x)} 560w, ${esc(it.shot)} 1120w" sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 82vw" alt="" loading="lazy" decoding="async" draggable="false">`
      : `<span class="pw-ph"><b>${esc(it.name)}</b><small>${esc(it.note)}</small></span>`;
    const tag = `<span class="pw-card__tag"><i>${ICON[it.kind] || ICON.link}</i><b>${esc(it.name)}</b><small>${esc(it.note)}</small>${it.link ? `<em>${ICON.open}</em>` : ''}</span>`;
    const inner = `<span class="pw-card__frame">${media}<span class="pw-card__veil"></span>${tag}</span>`;
    const label = `${it.name}, ${where}`;
    let html;
    if (it.link) {
      html = `<a class="pw-card__hit" href="${esc(it.link)}" target="_blank" rel="noopener" data-cursor-label="Mở" aria-label="${esc(label)}: mở ${esc(KINDS[it.kind].label)} (tab mới)" draggable="false">${inner}</a>`;
    } else if (it.shot) {
      html = `<button class="pw-card__hit" type="button" data-view="${it.idx}" data-cursor-label="Xem" aria-label="Xem ảnh lớn: ${esc(label)}">${inner}</button>`;
    } else {
      html = `<div class="pw-card__hit" role="img" aria-label="${esc(label)}">${inner}</div>`;
    }
    return `<div class="pw-card${it.link ? ' pw-card--link' : ''}${it.shot ? ' pw-card--img' : ''}">${html}</div>`;
  }

  function wallHTML(w) {
    const lines = w.rows.map((r, ri) => {
      const rev = ri % 2 === 0; // hàng chẵn neo mép phải, trượt sang phải · hàng lẻ neo trái, trượt sang trái
      const cards = r.items.map(cardHTML).join('');
      return `<div class="pw__line${rev ? ' pw__line--rev' : ''}">${r.label ? `<p class="pw__label"><span>${esc(r.label)}</span></p>` : ''}<div class="pw__row${rev ? ' pw__row--rev' : ''}">${cards}</div></div>`;
    }).join('');
    return `<div class="pw" id="du-an-${esc(w.id)}" role="group" aria-labelledby="pw-${esc(w.id)}-title" data-wall="${esc(w.id)}">
      <div class="pw__fade" aria-hidden="true"></div><div class="pw__fade pw__fade--2" aria-hidden="true"></div>
      <header class="pw__head">
        <h3 class="pw__title" id="pw-${esc(w.id)}-title" data-fit data-fit-min="22" data-split>${titleHTML(w.name)}</h3>
        <p class="desc pw__desc">${esc(w.desc)}</p>
      </header>
      <div class="pw__wall">${lines}</div>
    </div>`;
  }

  const navHTML = list => list.map(w => `<a class="pw-nav__a" href="#du-an-${esc(w.id)}" data-to="${esc(w.id)}"><b>${esc(w.no)}</b>${esc(w.name)}</a>`).join('');

  /* ---------------- Dựng section + hiệu ứng ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const host = $('[data-showcase]');
    if (!host) return;
    const list = walls();
    if (!list.length) return;
    host.innerHTML = list.map(wallHTML).join('');
    const nav = $('[data-showcase-nav]');
    if (nav) nav.insertAdjacentHTML('beforeend', navHTML(list));
    L.enhance(host);
    initWalls(host, nav);
    initLightbox(host);
  });

  function initWalls(host, nav) {
    // Lò xo giống Framer Motion useSpring({ stiffness: 400, damping: 40, mass: 0.8 }) đặt trên vị trí cuộn
    const K = 400, C = 40, M = 0.8;
    let ys = window.scrollY, vs = 0;
    const spring = (target, dt) => {
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { vs += ((-K * (ys - target) - C * vs) / M) * h; ys += vs * h; }
      if (Math.abs(target - ys) < 0.05 && Math.abs(vs) < 1) { ys = target; vs = 0; }
    };

    const W = $$('.pw', host).map(el => ({
      el, id: el.dataset.wall,
      wall: $('.pw__wall', el),
      rows: $$('.pw__row', el),
      fades: $$('.pw__fade', el),
      top: 0, h: 1, tiltD: 1, travel: [], lp: -1, lt: -1, live: false
    }));
    let vh = innerHeight, mob = innerWidth <= 768;
    let navLinks = [], pill = null, cur = null, secBot = 0; // thanh hạng mục (bên dưới)

    const sec = host.closest('section') || host;
    function measure() {
      vh = innerHeight; mob = innerWidth <= 768;
      // lớp phủ mép tường vẽ lại nền section → cần biết chiều cao section và độ lệch của từng tường trong section
      const secTop = L.docTop(sec);
      sec.style.setProperty('--sec-h', sec.offsetHeight + 'px');
      W.forEach(w => {
        w.top = L.docTop(w.el);
        w.el.style.setProperty('--fade-y', (secTop - w.top).toFixed(0) + 'px');
        w.h = Math.max(1, w.el.offsetHeight);
        // ledinhtuan.com: bức tường ~1,85 màn hình, dựng thẳng trong 20% đầu => ~0,37 màn hình cuộn
        w.tiltD = 1.85 * vh;
        // mỗi hàng trượt đúng phần đang tràn khỏi khung (máy tính: 1 ô) => ô thứ 4 vào hẳn, không lộ mép trống
        w.travel = w.rows.map(row => {
          const card = row.firstElementChild;
          if (!card) return 0;
          const cs = getComputedStyle(row), n = row.children.length;
          const inner = row.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
          const over = n * card.offsetWidth + (n - 1) * (parseFloat(cs.columnGap) || 0) - inner;
          return Math.max(0, over) * (L.reduced ? 0.25 : 1);
        });
        // tâm xoay/phối cảnh ở giữa bức tường (tối đa 4 hàng đầu như bản gốc)
        const pitch = w.wall.offsetHeight / Math.max(1, w.wall.children.length);
        const oy = Math.min(w.wall.offsetHeight / 2, 2 * pitch);
        w.wall.style.transformOrigin = `50% ${oy.toFixed(0)}px`;
        w.el.style.perspectiveOrigin = `50% ${(w.wall.offsetTop + oy - 0.2 * pitch).toFixed(0)}px`;
        w.lp = w.lt = -1;
      });
      navMeasure();
    }

    const map = (t, a, b2) => a + (b2 - a) * t;
    function apply(w, y) {
      const p = clamp((y - w.top) / w.h);
      const pt = clamp((y - w.top) / w.tiltD);
      if (Math.abs(p - w.lp) < 0.00004 && Math.abs(pt - w.lt) < 0.00004) return;
      w.lp = p; w.lt = pt;
      const t20 = clamp(pt / 0.2), t15 = clamp(pt / 0.15), t25 = clamp(pt / 0.25);
      const rx = map(t20, L.reduced ? 5 : 15, 0);
      const rz = map(t20, L.reduced ? 5 : 20, 0);
      const ty = map(t20, mob ? -100 : -200, mob ? 40 : 150);
      w.wall.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      w.wall.style.opacity = map(t15, 0.3, 1).toFixed(3);
      const f = (1 - t25).toFixed(3);
      w.fades.forEach(el => (el.style.opacity = f));
      for (let i = 0; i < w.rows.length; i++) w.rows[i].style.transform = `translate3d(${((i % 2 ? -1 : 1) * w.travel[i] * p).toFixed(1)}px, 0, 0)`;
    }

    measure();
    L.onLayout(measure);
    W.forEach(w => apply(w, window.scrollY));

    L.tick(s => {
      spring(s.y, s.dt);
      for (const w of W) {
        const near = ys + vh > w.top - vh * 0.5 && ys < w.top + w.h + vh * 0.5;
        if (near !== w.live) { w.live = near; w.el.classList.toggle('is-live', near); }
        if (near) apply(w, ys);
      }
      navTick(s.y);
    });

    /* ---------- Thanh hạng mục nổi ở đáy màn hình ---------- */
    function navMeasure() {
      if (!nav) return;
      const sec = nav.closest('section') || host;
      secBot = L.docTop(sec) + sec.offsetHeight;
      if (cur) movePill(cur);
    }
    function movePill(a) {
      if (!pill || !a) return;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.height = a.offsetHeight + 'px';
      pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    }
    function setCur(id) {
      const a = navLinks.find(x => x.dataset.to === id) || null;
      if (a === cur) return;
      cur = a;
      navLinks.forEach(x => { x.classList.toggle('is-active', x === a); if (x === a) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
      nav.classList.toggle('has-active', !!a);
      if (a) {
        movePill(a);
        if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: L.reduced ? 'auto' : 'smooth' });
      }
    }
    function navTick(y) {
      if (!nav) return;
      const on = y + vh > W[0].top + vh * 0.35 && y + vh * 0.6 < secBot;
      if (on !== nav.classList.contains('is-on')) nav.classList.toggle('is-on', on);
      let id = null;
      for (const w of W) if (y + vh * 0.5 >= w.top) id = w.id;
      setCur(id);
    }
    if (nav) {
      pill = $('.pw-nav__pill', nav);
      navLinks = $$('.pw-nav__a', nav);
      L.onResize(() => cur && movePill(cur));
      navLinks.forEach(a => a.addEventListener('click', e => {
        const w = W.find(x => x.id === a.dataset.to);
        if (!w) return;
        e.preventDefault();
        window.scrollTo({ top: w.top, behavior: L.reduced ? 'auto' : 'smooth' });
        history.replaceState(null, '', '#du-an-' + w.id);
      }));
    }
  }

  /* ---------------- Lightbox: xem ảnh lớn, chuyển ô trước / sau ---------------- */
  function initLightbox(host) {
    if (!CELLS.length) return;
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Xem ảnh dự án');
    lb.innerHTML = `
      <div class="lb__bg" data-lb-close></div>
      <button class="lb__btn lb__close" type="button" data-lb-close aria-label="Đóng">${ICON.close}</button>
      <button class="lb__btn lb__nav lb__prev" type="button" data-lb-step="-1" aria-label="Ảnh trước">${ICON.prev}</button>
      <button class="lb__btn lb__nav lb__next" type="button" data-lb-step="1" aria-label="Ảnh sau">${ICON.next}</button>
      <figure class="lb__fig">
        <div class="lb__stage"><img class="lb__img" alt="" draggable="false"><span class="lb__spin" aria-hidden="true"></span></div>
        <figcaption class="lb__cap">
          <span class="lb__txt"><b class="lb__name"></b><span class="lb__sub"><i class="lb__ico"></i><span class="lb__note"></span><span class="lb__where"></span></span></span>
          <span class="lb__acts"><a class="lb__open" href="#" target="_blank" rel="noopener">Mở tài liệu ${ICON.open}</a><span class="lb__count"></span></span>
        </figcaption>
      </figure>`;
    document.body.appendChild(lb);

    const img = $('.lb__img', lb), fig = $('.lb__fig', lb), stage = $('.lb__stage', lb);
    const elName = $('.lb__name', lb), elIco = $('.lb__ico', lb), elNote = $('.lb__note', lb), elWhere = $('.lb__where', lb);
    const elOpen = $('.lb__open', lb), elCount = $('.lb__count', lb), btnClose = $('.lb__close', lb);
    let cur = -1, opener = null, loadId = 0, hideT = 0;

    function show(i, dir) {
      cur = (i + CELLS.length) % CELLS.length;
      const c = CELLS[cur];
      const id = ++loadId;
      elName.textContent = c.name;
      elIco.innerHTML = ICON[c.kind] || ICON.link;
      elNote.textContent = c.note;
      elWhere.textContent = c.rowLabel ? `${c.group} · ${c.rowLabel}` : c.group;
      elCount.textContent = `${cur + 1} / ${CELLS.length}`;
      if (c.link) { elOpen.href = c.link; elOpen.hidden = false; elOpen.setAttribute('aria-label', `Mở ${KINDS[c.kind].label}: ${c.name} (tab mới)`); }
      else { elOpen.hidden = true; elOpen.removeAttribute('href'); }
      img.alt = `${c.name}, ${c.note}`;
      // hiện thumbnail (đã tải) ngay, nạp bản lớn rồi thay
      lb.classList.add('is-loading');
      if (dir) { fig.classList.remove('slide-l', 'slide-r'); void fig.offsetWidth; fig.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }
      img.src = c.shot;
      const big = new Image();
      big.decoding = 'async';
      big.onload = () => { if (id !== loadId) return; img.src = c.full; lb.classList.remove('is-loading'); };
      big.onerror = () => { if (id === loadId) lb.classList.remove('is-loading'); };
      big.src = c.full;
      // nạp trước hai ô kề để chuyển mượt
      [1, -1].forEach(d => { const n = CELLS[(cur + d + CELLS.length) % CELLS.length]; if (n && n.full) { const p = new Image(); p.src = n.full; } });
    }
    function open(i, from) {
      opener = from || document.activeElement;
      clearTimeout(hideT);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('lb-open');
      show(i, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('is-open')));
      btnClose.focus({ preventScroll: true });
    }
    function close() {
      if (lb.hidden) return;
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      document.body.classList.remove('lb-open');
      hideT = setTimeout(() => { lb.hidden = true; img.removeAttribute('src'); }, L.reduced ? 0 : 320);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
    }

    host.addEventListener('click', e => {
      const b = e.target.closest('[data-view]');
      if (!b || !host.contains(b)) return;
      e.preventDefault();
      open(+b.dataset.view, b);
    });
    lb.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-lb-close]')) { close(); return; }
      const s = t.closest('[data-lb-step]');
      if (s) { const d = +s.dataset.lbStep || 1; show(cur + d, d); }
    });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, -1); }
      else if (e.key === 'Tab') {
        // giữ focus trong hộp thoại
        const f = $$('button, a[href]', lb).filter(el => !el.hidden && el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // vuốt ngang trên điện thoại để chuyển ảnh
    let sx = 0, sy = 0, swiping = false;
    stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; swiping = true; }, { passive: true });
    stage.addEventListener('pointerup', e => {
      if (!swiping) return; swiping = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }, { passive: true });
  }
})();
