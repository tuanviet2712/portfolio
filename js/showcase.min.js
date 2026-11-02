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
  const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
  const SF = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
  const ICON = {
    sheet: S('M3 9h18M9 3v18M7.8 3h8.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C21 5.28 21 6.12 21 7.8v8.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 21 18.88 21 16.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3Z'),
    doc: S('M14 2.27V6.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437c.214.11.494.11 1.054.11h4.13M16 13H8m8 4H8m2-8H8m6-7H8.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C4 4.28 4 5.12 4 6.8v10.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C6.28 22 7.12 22 8.8 22h6.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C20 19.72 20 18.88 20 17.2V8l-6-6Z'),
    slide: S('M12 16v5m0-5 6 5m-6-5-6 5M21 3v8.2c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 16 17.88 16 16.2 16H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 13.72 3 12.88 3 11.2V3m5 6v3m4-5v5m4-1v1m6-9H2'),
    drive: S('m13 7-1.116-2.231c-.32-.642-.481-.963-.72-1.198a2 2 0 0 0-.748-.462C10.1 3 9.74 3 9.022 3H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C2 4.52 2 5.08 2 6.2V7m0 0h15.2c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C22 9.28 22 10.12 22 11.8v4.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C19.72 21 18.88 21 17.2 21H6.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C2 18.72 2 17.88 2 16.2V7Z'),
    facebook: SF('M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21z'),
    tiktok: SF('M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z'),
    youtube: S('M5 4.99c0-.972 0-1.457.202-1.725a1 1 0 0 1 .738-.395c.335-.02.74.25 1.548.788l10.515 7.01c.668.446 1.002.668 1.118.949a1 1 0 0 1 0 .766c-.116.28-.45.503-1.118.948l-10.515 7.01c-.809.54-1.213.809-1.548.789a1 1 0 0 1-.738-.395C5 20.467 5 19.98 5 19.01V4.99Z'),
    zalo: S('M21 11.5a8.5 8.5 0 0 1-11.555 7.934c-.174-.066-.26-.1-.33-.116a.901.901 0 0 0-.186-.024 2.314 2.314 0 0 0-.303.021l-5.12.53c-.49.05-.733.075-.877-.013a.5.5 0 0 1-.234-.35c-.026-.166.09-.382.324-.814l1.636-3.027c.134-.25.202-.374.232-.494a.899.899 0 0 0 .028-.326c-.01-.123-.064-.283-.172-.604A8.5 8.5 0 1 1 21 11.5Z'),
    link: S('m12.708 18.364-1.415 1.414a5 5 0 1 1-7.07-7.07l1.413-1.415m12.728 1.414 1.415-1.414a5 5 0 0 0-7.071-7.071l-1.415 1.414M8.5 15.5l7-7'),
    view: S('m21 21-4.35-4.35M11 8v6m-3-3h6m5 0a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'),
    open: S('M7 17 17 7m0 0H7m10 0v10'),
    close: S('M18 6 6 18M6 6l12 12'),
    prev: S('m15 18-6-6 6-6'),
    next: S('m9 18 6-6-6-6')
  };

  const CELLS = [];
  function walls() {
    CELLS.length = 0;
    const sc = (window.SITE_DATA && window.SITE_DATA.showcase) || DATA.showcase || {};
    const byId = {};
    (sc.partners || []).forEach(p => (byId[p.id] = p));
    return (sc.groups || []).map(g => {
      let curLabel = '';
      const rows = (g.rows || []).map(r => {
        const row = Array.isArray(r) ? { items: r } : (r || {});
        if (row.label) curLabel = row.label;
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
            shot: img ? IMG_DIR + img + '.jpg?v=5' : '',
            shot1x: img ? IMG_DIR + img + '-1x.jpg?v=5' : '',
            full: img ? IMG_DIR + img + '-full.jpg?v=5' : '',
            group: g.name, rowLabel: row.label || curLabel, idx: -1
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
    const s = String(name).trim();
    let i = s.indexOf('&');
    if (i >= 0) i += 1;
    else { const w = s.split(/\s+/); i = w.length > 2 ? w.slice(0, 2).join(' ').length : w.length > 1 ? w[0].length : 0; }
    const a = s.slice(0, i).trim(), c = s.slice(i).trim();
    return c ? `${esc(a)} <span class="grad">${esc(c)}</span>` : `<span class="grad">${esc(a)}</span>`;
  }

  function cardHTML(it) {
    if (it.empty) {
      return `<div class="pw-card pw-card--empty" aria-hidden="true"><span class="pw-card__frame"><span class="pw-ph pw-ph--empty"><b>Đang cập nhật</b></span></span></div>`;
    }
    const where = it.rowLabel ? `${it.group}, ${it.rowLabel}` : it.group;
    const media = it.shot
      ? `<img src="${esc(it.shot)}" srcset="${esc(it.shot)} 1x, ${esc(it.full)} 2x" alt="" loading="lazy" decoding="async" draggable="false">`
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

  function wallHTML(w, wi) {
    const lines = w.rows.map((r, ri) => {
      const rev = (wi % 2 === 1) ? ri % 2 !== 0 : ri % 2 === 0;
      const cards = r.items.map(cardHTML).join('');
      return `<div class="pw__line${rev ? ' pw__line--rev' : ''}">${r.label ? `<p class="pw__label"><span>${esc(r.label)}</span></p>` : ''}<div class="pw__row${rev ? ' pw__row--rev' : ''}">${cards}</div></div>`;
    }).join('');
    return `<div class="pw" id="du-an-${esc(w.id)}" role="group" aria-labelledby="pw-${esc(w.id)}-title" data-wall="${esc(w.id)}">
      <header class="pw__head">
        <h3 class="pw__title" id="pw-${esc(w.id)}-title" data-fit data-fit-min="18" data-split>${titleHTML(w.name)}</h3>
        <p class="desc pw__desc">${esc(w.desc)}</p>
      </header>
      <div class="pw__wall">${lines}</div>
    </div>`;
  }

  const navHTML = list => list.map(w => `<a class="pw-nav__a" href="#du-an-${esc(w.id)}" data-to="${esc(w.id)}"><b>${esc(w.no)}</b>${esc(w.name)}</a>`).join('');

  document.addEventListener('DOMContentLoaded', () => {
    const host = $('[data-showcase]');
    if (!host) return;
    const list = walls();
    if (!list.length) return;
    host.innerHTML = list.map(wallHTML).join('');
    const nav = $('[data-showcase-nav]');
    if (nav) nav.insertAdjacentHTML('beforeend', navHTML(list));
    L.enhance(host);
    if (L.fitJustify) L.fitJustify(host);
    initWalls(host, nav);
    initLightbox(host);
    L.showcaseRefreshLang = () => {
      const updated = walls();
      const navLinks = nav ? $$('.pw-nav__a', nav) : [];
      updated.forEach((w, wi) => {
        const wallEl = document.getElementById(`du-an-${w.id}`);
        const tEl = document.getElementById(`pw-${w.id}-title`);
        if (tEl) {
          const wasIn = tEl.classList.contains('is-in');
          delete tEl.dataset.splitDone;
          tEl.innerHTML = titleHTML(w.name);
          if (L.splitWords) L.splitWords(tEl);
          if (wasIn) tEl.classList.add('is-in');
        }
        if (wallEl) {
          const dEl = $('.pw__desc', wallEl);
          if (dEl) dEl.textContent = w.desc;
          const lines = $$('.pw__line', wallEl);
          w.rows.forEach((r, ri) => {
            const lineEl = lines[ri];
            if (!lineEl) return;
            const lbl = $('.pw__label span', lineEl);
            if (lbl && r.label) lbl.textContent = r.label;
            const cardEls = $$('.pw-card', lineEl);
            r.items.forEach((it, ii) => {
              const cEl = cardEls[ii];
              if (!cEl || it.empty) return;
              const b = $('.pw-card__tag b', cEl);
              const sm = $('.pw-card__tag small', cEl);
              if (b) b.textContent = it.name;
              if (sm) sm.textContent = it.note;
              const phB = $('.pw-ph b', cEl);
              const phSm = $('.pw-ph small', cEl);
              if (phB) phB.textContent = it.name;
              if (phSm) phSm.textContent = it.note;
            });
          });
        }
        if (navLinks[wi]) {
          navLinks[wi].innerHTML = `<b>${esc(w.no)}</b>${esc(w.name)}`;
        }
      });
      if (L.fit) L.fit(host);
      if (L.fitJustify) L.fitJustify(host);
    };
  });

  function initWalls(host, nav) {
    const K = 400, C = 40, M = 0.8;
    let ys = window.scrollY, vs = 0;
    const spring = (target, dt) => {
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { vs += ((-K * (ys - target) - C * vs) / M) * h; ys += vs * h; }
      if (Math.abs(target - ys) < 0.05 && Math.abs(vs) < 1) { ys = target; vs = 0; }
    };

    const W = $$('.pw', host).map((el, wi) => ({ flip: wi % 2 === 1,
      el, id: el.dataset.wall,
      wall: $('.pw__wall', el),
      rows: $$('.pw__row', el),
      fades: $$('.pw__fade', el),
      top: 0, h: 1, tiltD: 1, travel: [], lp: -1, lt: -1, live: false
    }));
    let vh = innerHeight, mob = innerWidth <= 768;
    let navLinks = [], pill = null, cur = null, secBot = 0;

    const sec = host.closest('section') || host;
    function measure() {
      vh = innerHeight; mob = innerWidth <= 768;
      const secTop = L.docTop(sec);
      sec.style.setProperty('--sec-h', sec.offsetHeight + 'px');
      W.forEach(w => {
        w.top = L.docTop(w.el);
        w.el.style.setProperty('--fade-y', (secTop - w.top).toFixed(0) + 'px');
        w.h = Math.max(1, w.el.offsetHeight);
        w.tiltD = 1.85 * vh;
        w.travel = w.rows.map(row => {
          const card = row.firstElementChild;
          if (!card) return 0;
          const cs = getComputedStyle(row), n = row.children.length;
          const inner = row.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
          const over = n * card.offsetWidth + (n - 1) * (parseFloat(cs.columnGap) || 0) - inner;
          return Math.max(0, over) * (L.reduced ? 0.25 : 1);
        });
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
      const sign = w.flip ? -1 : 1, rz = sign * map(t20, L.reduced ? 5 : 20, 0);
      const ty = map(t20, mob ? -100 : -200, mob ? 40 : 150);
      w.wall.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      w.wall.style.opacity = map(t15, 0.3, 1).toFixed(3);
      const f = (1 - t25).toFixed(3);
      w.fades.forEach(el => (el.style.opacity = f));
      for (let i = 0; i < w.rows.length; i++) w.rows[i].style.transform = `translate3d(${(sign * (i % 2 ? -1 : 1) * w.travel[i] * p).toFixed(1)}px, 0, 0)`;
    }

    measure();
    L.onLayout(measure);
    W.forEach(w => apply(w, window.scrollY));

    L.tick(s => {
      if (sec.classList.contains('prx-on')) return;
      spring(s.y, s.dt);
      for (const w of W) {
        const near = ys + vh > w.top - vh * 0.5 && ys < w.top + w.h + vh * 0.5;
        if (near !== w.live) { w.live = near; w.el.classList.toggle('is-live', near); }
        if (near) apply(w, ys);
      }
      navTick(s.y);
    });

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
      lb.classList.add('is-loading');
      if (dir) { fig.classList.remove('slide-l', 'slide-r'); void fig.offsetWidth; fig.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }
      img.src = c.shot;
      const big = new Image();
      big.decoding = 'async';
      big.onload = () => { if (id !== loadId) return; img.src = c.full; lb.classList.remove('is-loading'); };
      big.onerror = () => { if (id === loadId) lb.classList.remove('is-loading'); };
      big.src = c.full;
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
        const f = $$('button, a[href]', lb).filter(el => !el.hidden && el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    let sx = 0, sy = 0, swiping = false;
    stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; swiping = true; }, { passive: true });
    stage.addEventListener('pointerup', e => {
      if (!swiping) return; swiping = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }, { passive: true });
  }
})();
