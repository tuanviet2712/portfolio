/* ==========================================================================
   SECTIONS — timeline, giá trị, quy trình, dự án, đối tác, feedback, quả cầu
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const { $, $$, clamp } = L;
  const DATA = window.SITE_DATA || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  document.addEventListener('DOMContentLoaded', () => {
    initTimeline();
    initValues();
    initProcess();
    renderPartners();
    renderFeedback();
    initLazyVideo();
    initSphere();
    initCasual();
    initSkills();
  });

  /* Video nằm sau hero 820vh: chỉ nạp khi người dùng sắp cuộn tới, giữ nguyên poster/autoplay. */
  function initLazyVideo() {
    const videos = $$('video[data-src]');
    if (!videos.length) return;
    const load = video => {
      if (video.src) return;
      video.src = video.dataset.src;
      video.removeAttribute('data-src');
      video.load();
      const play = () => video.play().catch(() => {});
      video.addEventListener('canplay', play, { once: true });
    };
    if (!('IntersectionObserver' in window)) { videos.forEach(load); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        load(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '700px 0px' });
    videos.forEach(video => io.observe(video));
  }

  /* ---------------- Năng lực: điện thoại thu 6 thẻ giữa thành hàng bấm mở ----------------
     Thẻ đầu (Marketing Strategy) và thẻ cuối (Công cụ, dữ liệu & AI) luôn mở như cũ.
     DOM được bọc lại MỘT LẦN cho cả hai khổ màn hình; máy tính đặt các lớp bọc về display: contents
     nên bố cục lưới giữ nguyên y như trước, chỉ điện thoại mới co lại (CSS .skill--acc). */
  function initSkills() {
    const cards = $$('.skills .skill').filter(c => !c.classList.contains('skill--feat') && !c.classList.contains('skill--tools'));
    if (!cards.length) return;
    const narrow = matchMedia('(max-width: 760px)');
    const heads = [];
    cards.forEach(card => {
      const list = $('.checks', card);
      const top = $('.skill__top', card), title = $('.skill__title', card), sub = $('.skill__sub', card);
      if (!list || !top || !title) return;
      card.classList.add('skill--acc');
      // hàng thu gọn hẹp hơn thẻ, cho phép co cỡ chữ sâu hơn mức mặc định 13px để tiêu đề dài vẫn 1 dòng
      if (!title.dataset.fitMin) title.dataset.fitMin = '12';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'skill__head';
      head.setAttribute('aria-expanded', 'false');
      card.insertBefore(head, top);
      [top, title, sub].forEach(el => el && head.appendChild(el));
      head.insertAdjacentHTML('beforeend', '<span class="skill__toggle" aria-hidden="true">' + icon('i-plus') + '</span>');
      const body = document.createElement('div');
      body.className = 'skill__body';
      const inner = document.createElement('div');
      inner.className = 'skill__inner';
      card.insertBefore(body, list);
      body.appendChild(inner);
      inner.appendChild(list);
      const id = 'skill-' + heads.length;
      inner.id = id;
      head.setAttribute('aria-controls', id);
      head.addEventListener('click', () => {
        if (!narrow.matches) return;
        const on = !card.classList.contains('is-open');
        card.classList.toggle('is-open', on);
        head.setAttribute('aria-expanded', String(on));
      });
      heads.push(head);
    });
    // máy tính: nút không nằm trong luồng tab (hộp của nó bị display: contents làm biến mất, focus sẽ không thấy gì)
    const sync = () => heads.forEach(h => { h.tabIndex = narrow.matches ? 0 : -1; });
    sync();
    narrow.addEventListener('change', sync);
    // đo lại cỡ chữ tiêu đề SAU khi trình duyệt dựng xong lưới mới (fitOne cần bề rộng thật)
    if (L.fit) requestAnimationFrame(() => L.fit($('.skills')));
  }

  /* ---------------- Timeline dọc: đường kẻ vẽ theo cuộn ---------------- */
  function initTimeline() {
    const list = $('.tl-list');
    if (!list) return;
    const line = $('.tl-list__line', list);
    const items = $$('.tl', list);
    let last = -1, top = 0, h = 1, mids = [];
    const measure = () => { top = L.docTop(list); h = Math.max(1, list.offsetHeight); mids = items.map(el => (el.offsetTop + 22) / h); last = -1; };
    measure();
    L.onLayout(measure);
    L.tick(s => {
      const rt = top - s.y;
      if (rt + h < 0 || rt > s.vh) return;
      const p = clamp((s.vh * 0.78 - rt) / h);
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      line.style.setProperty('--tl', p.toFixed(3));
      items.forEach((el, i) => el.classList.toggle('is-lit', p >= mids[i]));
    });
  }

  /* ---------------- Giá trị: danh sách mở/đóng ---------------- */
  /* Máy tính (có chuột, ≥ 1025px): rê chuột / focus / bấm vào một dòng → bảng chi tiết bên phải (.vpanel) đổi nội dung
     (nội dung lấy từ chính .vrow__body của dòng đó nên chỉ cần sửa HTML một chỗ). Danh sách không nhảy vì phần mở
     nằm ở bảng bên cạnh. Màn cảm ứng / hẹp: bấm để mở nội dung ngay dưới dòng như accordion. */
  function initValues() {
    const list = $('[data-vlist]');
    if (!list) return;
    const rows = $$('.vrow', list);
    const panel = $('[data-vpanel]');
    const desk = matchMedia('(min-width: 1025px) and (hover: hover)');
    let cur = rows.find(r => r.classList.contains('is-open')) || rows[0];
    const setState = row => rows.forEach(r => {
      const on = r === row;
      r.classList.toggle('is-open', on);
      $('.vrow__head', r).setAttribute('aria-expanded', String(on));
    });
    rows.forEach(r => $('.vrow__head', r).insertAdjacentHTML('beforeend', '<span class="vrow__go" aria-hidden="true"><svg><use href="#i-arrow"/></svg></span>'));
    let swapT = 0;
    const fill = (row, animate) => {
      if (!panel || !row) return;
      const use = $('.vrow__icon use', row);
      // số nền: chữ rỗng, viền gradient xanh (SVG vì CSS không vẽ được viền gradient)
      const html = `<svg class="vpanel__num" aria-hidden="true"><defs><linearGradient id="vnum-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14D8E6"/><stop offset=".5" stop-color="#1B5CF2"/><stop offset="1" stop-color="#1C2E94"/></linearGradient></defs><text x="100%" y=".76em" text-anchor="end">${$('.vrow__num', row).textContent}</text></svg>
        <div class="vpanel__in"><span class="vpanel__icon"><svg><use href="${use ? use.getAttribute('href') : '#i-spark'}"/></svg></span>
        <h3 class="vpanel__title" data-fit data-fit-min="20">${esc($('.vrow__title', row).dataset.short || '') || $('.vrow__title', row).innerHTML}</h3>${$('.vrow__content', row).innerHTML}</div>`;
      // bảng dùng tiêu đề ngắn (data-short trên .vrow__title) để luôn nằm trên 1 dòng; danh sách bên trái giữ tiêu đề đầy đủ
      const put = () => { panel.innerHTML = html; if (L.fit) L.fit(panel); };
      clearTimeout(swapT);
      if (!animate || L.reduced) { panel.classList.remove('is-swap'); put(); return; }
      panel.classList.add('is-swap');
      swapT = setTimeout(() => { put(); requestAnimationFrame(() => panel.classList.remove('is-swap')); }, 200);
    };
    const activate = row => { if (row === cur) return; cur = row; setState(row); fill(row, true); };
    setState(cur); fill(cur, false);
    let hoverT = 0;
    rows.forEach(r => {
      const head = $('.vrow__head', r);
      head.addEventListener('click', () => {
        if (desk.matches) { activate(r); return; }
        const on = r.classList.contains('is-open');
        cur = on ? null : r;
        setState(cur);
      });
      // rê chuột: chờ 70ms để lướt nhanh qua các dòng không làm bảng đổi liên tục
      head.addEventListener('pointerenter', e => {
        if (!desk.matches || e.pointerType !== 'mouse') return;
        clearTimeout(hoverT);
        hoverT = setTimeout(() => activate(r), 70);
      });
      head.addEventListener('focus', () => { if (desk.matches) activate(r); });
    });
    list.addEventListener('pointerleave', () => clearTimeout(hoverT));
    desk.addEventListener('change', () => { if (!cur) cur = rows[0]; setState(cur); fill(cur, false); });
  }

  /* ---------------- Quy trình: sân khấu theo cuộn ---------------- */
  function initProcess() {
    const sec = $('#quy-trinh');
    if (!sec) return;
    const pin = $('.process__pin', sec);
    const line = $('.pflow__line', sec);
    const nodes = $$('.pnode', sec);
    const steps = $$('.pstep', sec);
    const count = $('[data-step-count]', sec);
    const wide = matchMedia('(min-width: 1025px)');
    const n = steps.length;
    let last = -1, lastCur = -1;

    function setCur(cur) {
      if (cur === lastCur) return;
      lastCur = cur;
      steps.forEach((el, i) => el.classList.toggle('is-current', i === cur));
      nodes.forEach((el, i) => {
        el.classList.toggle('is-on', i <= cur);
        el.classList.toggle('is-current', i === cur);
        el.setAttribute('aria-selected', String(i === cur));
      });
      if (count) count.textContent = String(cur + 1).padStart(2, '0');
    }
    setCur(0);

    let pinTop = 0, pinH = 1;
    const measure = () => { pinTop = L.docTop(pin); pinH = pin.offsetHeight; last = -1; };
    measure();
    L.onLayout(measure);

    L.tick(s => {
      if (!wide.matches) { if (lastCur !== -2) { lastCur = -2; steps.forEach(el => el.classList.add('is-current')); } return; }
      const rt = pinTop - s.y;
      if (rt + pinH < -50 || rt > s.vh + 50) return;
      const p = clamp(-rt / Math.max(1, pinH - s.vh));
      if (Math.abs(p - last) < 0.0008) return;
      last = p;
      line.style.setProperty('--pp', clamp((p * n - 0.5) / (n - 1)).toFixed(4));
      if (lastCur === -2) { steps.forEach(el => el.classList.remove('is-current')); lastCur = -1; }
      setCur(Math.min(n - 1, Math.floor(p * n)));
    });

    nodes.forEach((b, i) => b.addEventListener('click', () => {
      const top = L.docTop(pin) + ((i + 0.5) / n) * (pin.offsetHeight - innerHeight);
      window.scrollTo({ top, behavior: L.reduced ? 'auto' : 'smooth' });
    }));
  }

  /* Dự án: xem js/showcase.js (các bức tường dự án chạy theo cuộn) */

  /* ---------------- Đối tác: 2 hàng logo chạy ngược chiều (kiểu ledinhtuan.com) ---------------- */
  function renderPartners() {
    const box = $('[data-partners]');
    const list = DATA.partners || [];
    if (!box || !list.length) return;
    // chưa có file logo => chữ: phần đầu to, chữ cuối nhỏ bên dưới ("FungHa" / "DIMSUM")
    const word = name => {
      const w = String(name).trim().split(/\s+/);
      return w.length > 1 ? `${esc(w.slice(0, -1).join(' '))}<small>${esc(w[w.length - 1])}</small>` : esc(name);
    };
    // logo trắng (assets/img/partners/white/) trong ô cùng cỡ; JS đặt cỡ từng logo để tất cả trông nặng ngang nhau
    const cell = p => `<li class="logos__item"><span class="logos__box" title="${esc(p.name)}">${p.logo
      ? `<img src="${esc(p.logo)}" alt="" loading="lazy" draggable="false" decoding="async" data-scale="${+p.scale || 1}">`
      : `<span class="logos__word">${word(p.name)}</span>`}</span></li>`;
    // Chia đôi danh sách: mỗi đối tác chỉ nằm ở 1 hàng, không lặp giữa hàng trên/dưới
    const half = Math.ceil(list.length / 2);
    const rows = [list.slice(0, half), list.slice(half)];
    // 1 nhóm phải rộng hơn màn hình (bước ô tối thiểu ~160px trên điện thoại); track = 2 nhóm giống hệt để lặp liền mạch
    const repsFor = r => Math.max(1, Math.ceil(Math.max(screen.width || 0, innerWidth) / (r.length * 160)));
    box.innerHTML = rows.map((r, i) => {
      const group = Array(repsFor(r)).fill(r.map(cell).join('')).join('');
      return `<div class="logos__row rv" style="--d:${i + 1}" aria-hidden="true"><ul class="logos__track">${group}${group}</ul></div>`;
    }).join('') + `<ul class="sr-only">${list.map(p => `<li>${esc(p.name)} — ${esc(p.note)}, ${esc(p.period)}</li>`).join('')}</ul>`;

    // Cân cỡ thị giác (đơn vị: px ở máy tính; CSS nhân với --u theo màn hình). Ảnh đã cắt sát viền nên tỉ lệ khung là thật:
    // logo dài thì thấp lại, logo gọn thì cao lên (h ~ ar^-0.45), giới hạn 26–56px, rồi nhân scale (bù độ đậm), trần 62px, rộng ≤ 180px
    const H0 = 42, AR0 = 3.5, HMIN = 26, HMAX = 56, HCAP = 62, WMAX = 180;
    $$('img', box).forEach(img => {
      const fit = () => {
        if (!img.naturalWidth) return;
        const k = +img.dataset.scale || 1;
        const ar = img.naturalWidth / img.naturalHeight;
        let h = Math.min(HCAP, Math.min(HMAX, Math.max(HMIN, H0 * Math.pow(AR0 / ar, 0.45))) * k);
        let w = h * ar;
        if (w > WMAX) { w = WMAX; h = w / ar; }
        img.style.setProperty('--w', w.toFixed(1));
        img.style.setProperty('--h', h.toFixed(1));
      };
      img.complete ? fit() : img.addEventListener('load', fit, { once: true });
    });
    $$('.logos__track', box).forEach((t, i) => logoRow(t, i ? 1 : -1, i ? 50 : 60));
    L.observeReveal($$('.rv', box));
  }

  // Một hàng logo: chạy đều theo hướng dir (px/giây), chậm dần rồi dừng khi di chuột, kéo/vuốt để tua (có quán tính)
  function logoRow(track, dir, speed) {
    const row = track.parentElement;
    let w = track.offsetWidth / 2, x = 0, v = 0, cur = speed, hover = false, drag = null, vis = false;
    L.onResize(() => (w = track.offsetWidth / 2));
    new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(row);
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    row.addEventListener('pointerleave', () => (hover = false));
    row.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, t: performance.now() }; v = 0;
      row.setPointerCapture(e.pointerId);
      row.classList.add('is-drag');
    });
    row.addEventListener('pointermove', e => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - drag.x;
      x += dx;
      v = dx / Math.max(8, now - drag.t) * 1000;
      drag = { x: e.clientX, t: now };
    });
    const release = () => { drag = null; row.classList.remove('is-drag'); };
    row.addEventListener('pointerup', release);
    row.addEventListener('pointercancel', release);
    L.tick(s => {
      if (!vis || !w) return;
      const target = hover || drag || L.reduced ? 0 : speed + Math.min(240, Math.abs(s.vy) * 0.12);   // cuộn nhanh => chạy nhanh hơn chút
      cur += (target - cur) * (1 - Math.exp(-s.dt * 5));
      if (!drag) { x += (dir * cur + v) * s.dt; v *= Math.exp(-s.dt * 3); }
      x %= w;
      if (x > 0) x -= w;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }

  /* ---------------- Feedback: trôi liên tục chậm rãi, kéo để lướt, phím mũi tên ---------------- */
  function renderFeedback() {
    const track = $('[data-feedbacks]');
    const vp = $('[data-fb-viewport]');
    if (!track || !vp) return;
    const list = DATA.feedbacks || [];
    if (!list.length) return;
    const card = f => {
      const proof = f.type === 'proof';
      const initials = String(f.name || '?').trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase();
      // logo (ô ghi nhận): hình tròn trắng, logo thu gọn giữ nguyên tỉ lệ; có logo thì ẩn tên đơn vị (tên chỉ còn ở alt).
      // avatar: ảnh tròn; còn lại: tick hoặc chữ cái đầu
      const av = f.logo ? `<img src="${esc(f.logo)}" alt="${esc(f.name)}" loading="lazy" draggable="false" decoding="async">`
        : f.avatar ? `<img src="${esc(f.avatar)}" alt="${esc(f.name)}" loading="lazy" draggable="false" decoding="async">` : proof ? icon('i-verified') : esc(initials);
      return `<figure class="quote spot${proof ? ' quote--proof is-dark' : ''}${f.draft ? ' is-draft' : ''}">
        <span class="quote__badge">${proof ? 'Ghi nhận chính thức' : esc(f.badge || 'Khách hàng nhận xét')}</span>
        <blockquote class="quote__text desc">${proof ? '' : '“'}${esc(f.text)}${proof ? '' : '”'}</blockquote>
        <figcaption class="quote__who"><span class="quote__av${f.logo ? ' quote__av--logo' : ''}">${av}</span>${f.logo ? '' : `<b class="quote__name">${esc(f.name)}</b>`}<small class="quote__role">${esc(f.role)}</small></figcaption>
      </figure>`;
    };
    // 2 bản sao nối liền để track cuộn vòng lặp mượt (giống hàng logo đối tác)
    track.innerHTML = list.map(card).join('') + list.map(card).join('');
    $$('.quote__av svg', track).forEach(s => { s.style.width = '22px'; s.style.height = '22px'; s.style.color = 'var(--blue)'; });
    L.enhance(track);

    const SPEED = 22; // px/giây — chậm, kiểu casual
    let w = track.scrollWidth / 2, x = 0, v = 0, cur = SPEED, hover = false, drag = null, vis = false, inView = false;
    const setW = () => (w = track.scrollWidth / 2);
    L.onResize(setW);
    setW();
    new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(vp);
    new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.35 }).observe(vp);
    vp.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    vp.addEventListener('pointerleave', () => (hover = false));
    vp.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, t: performance.now() };
      v = 0;
      vp.setPointerCapture(e.pointerId);
      vp.classList.add('is-drag');
    });
    vp.addEventListener('pointermove', e => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - drag.x;
      x += dx;
      v = dx / Math.max(8, now - drag.t) * 1000;
      drag = { x: e.clientX, t: now };
    });
    const release = () => { drag = null; vp.classList.remove('is-drag'); };
    vp.addEventListener('pointerup', release);
    vp.addEventListener('pointercancel', release);

    const stepW = () => { const c = $('.quote', track); return c ? c.offsetWidth + 18 : 400; };
    let kick = 0; // nút/phím mũi tên cộng thêm một nhịp trôi, không cắt animation
    const go = dir => (kick -= dir * stepW());
    $$('[data-fb]').forEach(b => b.addEventListener('click', () => go(+b.dataset.fb)));

    L.tick(s => {
      if (!vis || !w) return;
      const target = hover || drag || L.reduced ? 0 : SPEED;
      cur += (target - cur) * (1 - Math.exp(-s.dt * 5));
      if (!drag) {
        x += (-cur + v) * s.dt;
        v *= Math.exp(-s.dt * 3);
        if (kick) { const k = kick * Math.min(1, s.dt * 6); x += k; kick -= k; }
      }
      x %= w;
      if (x > 0) x -= w;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });

    // phím mũi tên khi section đang hiển thị
    addEventListener('keydown', e => {
      if (!inView || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    });
  }

  /* ---------------- Hàng thẻ "trôi liên tục" trên điện thoại (dùng chung) ----------------
     Gắn data-casual="mobile" lên khối chứa các thẻ (ví dụ .pflow__stage của Quy trình). Dưới 1025px, các thẻ con
     được gom vào một hàng ngang trôi chậm như hàng nhận xét: tự chạy, chạm kéo để lướt, thả ra lại trôi tiếp.
     Máy tính giữ nguyên bố cục cũ. Nếu khối nằm trong section có [data-step-count], số thứ tự cập nhật theo thẻ đang ở giữa. */
  function initCasual() {
    if (matchMedia('(min-width: 1025px)').matches) return;
    $$('[data-casual="mobile"]').forEach(box => {
      const items = Array.from(box.children);
      if (items.length < 2) return;
      const vp = document.createElement('div'); vp.className = 'cmar';
      const track = document.createElement('div'); track.className = 'cmar__track';
      items.forEach(el => { el.classList.add('is-current'); track.appendChild(el); });
      items.forEach(el => { const c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); }); // bản sao để trôi vòng lặp
      vp.appendChild(track); box.appendChild(vp); box.classList.add('is-casual');
      if (L.fit) L.fit(vp);

      const sec = box.closest('section');
      const count = sec ? $('[data-step-count]', sec) : null;
      const n = items.length;
      const SPEED = 20; // px/giây
      let w = track.scrollWidth / 2, x = 0, v = 0, cur = SPEED, drag = null, vis = false, lastIdx = -1;
      const setW = () => (w = track.scrollWidth / 2);
      L.onResize(setW);
      new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(vp);
      vp.addEventListener('pointerdown', e => {
        drag = { x: e.clientX, t: performance.now() }; v = 0;
        vp.setPointerCapture(e.pointerId); vp.classList.add('is-drag');
      });
      vp.addEventListener('pointermove', e => {
        if (!drag) return;
        const now = performance.now(), dx = e.clientX - drag.x;
        x += dx; v = dx / Math.max(8, now - drag.t) * 1000;
        drag = { x: e.clientX, t: now };
      });
      const release = () => { drag = null; vp.classList.remove('is-drag'); };
      vp.addEventListener('pointerup', release);
      vp.addEventListener('pointercancel', release);

      L.tick(s => {
        if (!vis || !w) return;
        const target = drag || L.reduced ? 0 : SPEED;
        cur += (target - cur) * (1 - Math.exp(-s.dt * 5));
        if (!drag) { x += (-cur + v) * s.dt; v *= Math.exp(-s.dt * 3); }
        x %= w;
        if (x > 0) x -= w;
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
        if (count) {
          const idx = Math.floor((-x + vp.clientWidth * 0.35) / (w / n)) % n;
          if (idx !== lastIdx) { lastIdx = idx; count.textContent = String(idx + 1).padStart(2, '0'); }
        }
      });
    });
  }

  /* ---------------- Quả cầu công cụ 3D (kéo để xoay) ---------------- */
  function initSphere() {
    const el = $('[data-sphere]');
    if (!el) return;
    const tags = $$('span', el);
    const n = tags.length;
    const pts = tags.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    let ax = 0.35, ay = 0, vx = 0, vy = 0.35, RX = 100, RY = 100, visible = false, drag = false, px = 0, py = 0;
    const size = () => { RX = el.clientWidth * 0.38; RY = el.clientHeight * 0.4; };
    size();
    L.onResize(size);
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(el);
    el.addEventListener('pointerdown', e => { drag = true; px = e.clientX; py = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      vy = (e.clientX - px) * 0.9; vx = -(e.clientY - py) * 0.9;
      px = e.clientX; py = e.clientY;
    });
    const up = () => (drag = false);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    L.tick(s => {
      if (!visible) return;
      const dt = s.dt;
      if (!drag) { vx += (0 - vx) * (1 - Math.exp(-dt * 2)); vy += ((L.reduced ? 0.05 : 0.35) - vy) * (1 - Math.exp(-dt * 1.5)); }
      ax += vx * dt; ay += vy * dt;
      if (drag) { vx *= 0.8; vy *= 0.8; }
      const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = pts[i];
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const sc = 0.62 + (z2 + 1) * 0.28;
        const t = tags[i];
        t.style.transform = `translate(-50%, -50%) translate3d(${(x1 * RX).toFixed(1)}px, ${(y2 * RY).toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
        t.style.opacity = (0.22 + (z2 + 1) * 0.39).toFixed(3);
        t.style.zIndex = String(Math.round((z2 + 1) * 50));
      }
    });
  }
})();
