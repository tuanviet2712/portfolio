/* ==========================================================================
   CẢNH ③ — GIÁ TRỊ TÔI MANG LẠI: 5 Thẻ Pha Lê 3D Tương Tác (Bento Accordion)
   - Bám chuẩn 100% nội dung mặc định từ #gia-tri trong index.html (letuanviet.com)
   - Máy tính: rê chuột (hover) / focus / click -> bung mượt khung đó ra tương ứng
   - Điện thoại / Tablet: sân khấu ghim cuộn 3D tự động chuyển mượt qua 5 thẻ pha lê (01 -> 05)
     theo nhịp cuộn, đồng thời hỗ trợ chạm (tap) để mở bất kỳ thẻ nào ngay lập tức
   - Tiêu đề luôn 1 dòng (white-space: nowrap), nội dung căn đều 2 bên (justify) không giãn chữ
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const S = L && L.stage;
  if (!S || S.off) return;
  const { $, $$, clamp } = L;
  const { r, ease } = S;

  const ART = [
    {
      src: 'assets/values/v1.webp',
      alt: 'La bàn thủy tinh chiến lược',
      openY: '48%', openS: 1.02, openTY: '0px',
      colS: 0.78, colX: '0%', colY: '76px',
      viBreak: ['Tư duy chiến lược và', 'nghiên cứu thị trường'],
      enBreak: ['Strategic thinking and', 'market research']
    },
    {
      src: 'assets/values/v2.webp',
      alt: 'Mô hình hoạch định bằng kính xanh',
      openY: '48%', openS: 1.02, openTY: '0px',
      colS: 0.80, colX: '0%', colY: '70px',
      viBreak: ['Hoạch định và quản trị', 'Marketing tổng thể'],
      enBreak: ['Marketing planning and', 'management']
    },
    {
      src: 'assets/values/v3.webp',
      alt: 'Tăng trưởng dữ liệu bằng pha lê',
      openY: '46%', openS: 1.02, openTY: '0px',
      colS: 0.80, colX: '-1%', colY: '72px',
      viBreak: ['Tăng trưởng dựa trên', 'dữ liệu triển khai'],
      enBreak: ['Driving growth through', 'performance data']
    },
    {
      src: 'assets/values/v4.webp',
      alt: 'Thủ lĩnh thủy tinh và đội ngũ',
      openY: '46%', openS: 1.02, openTY: '0px',
      colS: 0.82, colX: '0%', colY: '76px',
      viBreak: ['Tăng trưởng và dẫn dắt', 'cả đội ngũ'],
      enBreak: ['Growing and leading', 'marketing teams']
    },
    {
      src: 'assets/values/v5.webp',
      alt: 'Ba vòng kính đan xen trên bệ',
      openY: '48%', openS: 1.02, openTY: '0px',
      colS: 0.80, colX: '-2%', colY: '74px',
      viBreak: ['Chuẩn hóa vận hành và', 'ứng dụng công nghệ'],
      enBreak: ['Better operations and', 'technology']
    }
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function cleanText(el) {
    return el ? el.textContent.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim() : '';
  }

  function extractProof(row) {
    const p = $('.vrow__proof', row);
    const isEn = document.documentElement.dataset.lang === 'en' || document.documentElement.lang === 'en';
    const defLabel = isEn ? 'OUTCOME' : 'KẾT QUẢ';
    if (!p) return { label: defLabel, text: '' };
    const badge = $('span', p);
    const label = badge ? cleanText(badge) : defLabel;
    const clone = p.cloneNode(true);
    const bClone = $('span', clone);
    if (bClone) bClone.remove();
    return { label, text: cleanText(clone) };
  }

  function formatTwoLineTitle(rawTitle, idx) {
    const isEn = document.documentElement.dataset.lang === 'en' || document.documentElement.lang === 'en';
    const preset = ART[idx] && (isEn ? ART[idx].enBreak : ART[idx].viBreak);
    if (preset && preset.length === 2) {
      return `<span>${esc(preset[0])}</span><span>${esc(preset[1])}</span>`;
    }
    const words = rawTitle.split(/\s+/);
    const mid = Math.ceil(words.length / 2);
    return `<span>${esc(words.slice(0, mid).join(' '))}</span><span>${esc(words.slice(mid).join(' '))}</span>`;
  }

  const measureCtx = document.createElement('canvas').getContext('2d');

  function fitSingleLineTitle(el, minFs, maxFs) {
    if (!el) return;
    const text = cleanText(el);
    if (!text) return;
    el.style.fontSize = '';
    const W = el.clientWidth;
    if (W < 80) return;

    const cs = getComputedStyle(el);
    const family = cs.fontFamily || 'sans-serif';
    const weight = cs.fontWeight || '800';
    const style = cs.fontStyle || 'normal';

    let chosen = minFs;
    for (let fs = maxFs; fs >= minFs - 0.001; fs -= 0.1) {
      measureCtx.font = `${style} ${weight} ${fs.toFixed(2)}px ${family}`;
      const w = measureCtx.measureText(text).width * 0.975;
      if (w <= W - 2) {
        chosen = fs;
        break;
      }
    }
    el.style.fontSize = chosen.toFixed(2) + 'px';
    let guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && chosen > minFs && guard++ < 25) {
      chosen = Math.max(minFs, +(chosen - 0.25).toFixed(2));
      el.style.fontSize = chosen.toFixed(2) + 'px';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sec = $('#gia-tri');
    const list = sec && $('[data-vlist]', sec);
    if (!sec || !list) return;
    const rows = $$('.vrow', list);
    if (!rows.length) return;

    const container = $('.container', sec);
    if (!container) return;

    sec.classList.add('vsc');

    const deck = document.createElement('div');
    deck.className = 'vcards';
    deck.setAttribute('role', 'region');
    deck.setAttribute('aria-label', cleanText($('#values-title', sec)) || 'Giá trị tôi mang lại');

    const cards = rows.map((row, i) => {
      const cfg = ART[i] || ART[0];
      const num = cleanText($('.vrow__num', row)) || String(i + 1).padStart(2, '0');
      const rawTitle = cleanText($('.vrow__title', row));
      const desc = cleanText($('.vrow__content .desc', row));
      const proof = extractProof(row);
      const twoLineHTML = formatTwoLineTitle(rawTitle, i);

      // div, không phải article: role="button" không hợp lệ trên <article> (cây accessibility hỏng với trình đọc màn hình và AI agent)
      const card = document.createElement('div');
      card.className = 'vcard' + (i === 0 ? ' is-active' : '');
      card.dataset.vcard = String(i);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
      card.setAttribute('aria-label', `${num} — ${rawTitle}`);
      card.style.setProperty('--i', String(i));
      card.style.setProperty('--vy-open', cfg.openY);
      card.style.setProperty('--vs-open', String(cfg.openS));
      card.style.setProperty('--oy', cfg.openTY || '4px');
      card.style.setProperty('--cs', String(cfg.colS));
      card.style.setProperty('--cx', cfg.colX || '0%');
      card.style.setProperty('--cy', cfg.colY || '24px');

      card.innerHTML = `
        <div class="vcard__inner">
          <div class="vcard__sky" aria-hidden="true"></div>
          <div class="vcard__stage" aria-hidden="true">
            <div class="vcard__art">
              <img class="vcard__img vcard__img--top" src="${esc(cfg.src)}" alt="" width="1448" height="1086" loading="lazy" decoding="async" draggable="false">
              <img class="vcard__img vcard__img--main" src="${esc(cfg.src)}" alt="${esc(cfg.alt)}" width="1448" height="1086" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" draggable="false">
              <img class="vcard__img vcard__img--refl" src="${esc(cfg.src)}" alt="" width="1448" height="1086" loading="lazy" decoding="async" draggable="false">
              <span class="vcard__glare"></span>
            </div>
          </div>
          <div class="vcard__shade" aria-hidden="true"></div>

          <span class="vcard__num" aria-hidden="true">${esc(num)}</span>

          <div class="vcard__collapsed" aria-hidden="${i === 0 ? 'true' : 'false'}">
            <h3 class="vcard__vtitle">${twoLineHTML}</h3>
          </div>

          <div class="vcard__body">
            <div class="vcard__panel">
              <h3 class="vcard__title">${esc(rawTitle)}</h3>
              <p class="vcard__desc">${esc(desc)}</p>
              <div class="vcard__divider" aria-hidden="true"></div>
              <div class="vcard__proof">
                <span class="vcard__badge">${esc(proof.label)}</span>
                <p class="vcard__proof-txt">${esc(proof.text)}</p>
              </div>
            </div>
          </div>
        </div>
      `;
      deck.appendChild(card);
      return card;
    });

    container.appendChild(deck);

    const warmImages = () => {
      ART.forEach(a => {
        const im = new Image();
        im.decoding = 'async';
        im.src = a.src;
      });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warmImages, { timeout: 2000 });
    else setTimeout(warmImages, 600);

    const FLEX_OPEN = 3.45;
    const FLEX_COL = 1;
    const desktopMQ = matchMedia('(min-width: 1025px)');

    function updatePanelWidths() {
      const deckW = deck.clientWidth;
      if (!deckW) return;
      const isDesk = desktopMQ.matches;
      if (isDesk) {
        const cs = getComputedStyle(deck);
        const gap = parseFloat(cs.columnGap || cs.gap) || 16;
        const avail = Math.max(320, deckW - gap * (cards.length - 1));
        const openW = Math.round((avail * FLEX_OPEN) / (FLEX_OPEN + (cards.length - 1) * FLEX_COL));
        const colW = Math.round((avail * FLEX_COL) / (FLEX_OPEN + (cards.length - 1) * FLEX_COL));
        deck.style.setProperty('--vc-open-w', openW + 'px');
        deck.style.setProperty('--vc-col-w', colW + 'px');
      } else {
        deck.style.setProperty('--vc-open-w', deckW + 'px');
      }
      cards.forEach(c => {
        const vt = $('.vcard__vtitle', c);
        if (vt) {
          if (!isDesk) fitSingleLineTitle(vt, 10.5, 14.8);
          else vt.style.fontSize = '';
        }
      });
      fitTitles(isDesk);
    }
    // Tiêu đề 5 thẻ dùng chung một cỡ: cỡ nhỏ nhất để tiêu đề dài nhất vẫn vừa 1 dòng.
    // Cỡ chữ mô tả và dòng Kết quả do CSS quy định (css/d-type.css, css/m-type.css)
    function fitTitles(isDesk) {
      const els = cards.map(c => $('.vcard__title', c)).filter(el => el && el.clientWidth >= 80);
      els.forEach(el => fitSingleLineTitle(el, isDesk ? 14.5 : 10.5, isDesk ? 22.8 : 17.5));
      const min = Math.min(...els.map(el => parseFloat(el.style.fontSize) || Infinity));
      if (isFinite(min)) els.forEach(el => { el.style.fontSize = min.toFixed(2) + 'px'; });
    }
    updatePanelWidths();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updatePanelWidths).catch(() => {});
    }
    L.onLayout(updatePanelWidths);
    L.onResize(updatePanelWidths);
    L.valuesRefreshLang = () => {
      deck.setAttribute('aria-label', cleanText($('#values-title', sec)) || 'Giá trị tôi mang lại');
      cards.forEach((card, i) => {
        const row = rows[i];
        if (!row) return;
        const num = cleanText($('.vrow__num', row)) || String(i + 1).padStart(2, '0');
        const rawTitle = cleanText($('.vrow__title', row));
        const desc = cleanText($('.vrow__content .desc', row));
        const proof = extractProof(row);
        const vt = $('.vcard__vtitle', card);
        if (vt) vt.innerHTML = formatTwoLineTitle(rawTitle, i);
        const tEl = $('.vcard__title', card);
        if (tEl) tEl.textContent = rawTitle;
        const dEl = $('.vcard__desc', card);
        if (dEl) dEl.textContent = desc;
        const bEl = $('.vcard__badge', card);
        if (bEl) bEl.textContent = proof.label;
        const pEl = $('.vcard__proof-txt', card);
        if (pEl) pEl.textContent = proof.text;
        card.setAttribute('aria-label', `${num} — ${rawTitle}`);
      });
      updatePanelWidths();
    };

    let activeIdx = 0;
    let hoverTimer = 0;
    let manualUntil = 0;

    function activate(idx, isManual) {
      if (isManual) manualUntil = performance.now() + 3200;
      if (idx === activeIdx || idx < 0 || idx >= cards.length) return;
      activeIdx = idx;
      cards.forEach((c, k) => {
        const on = k === idx;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-expanded', on ? 'true' : 'false');
        const colEl = $('.vcard__collapsed', c);
        if (colEl) colEl.setAttribute('aria-hidden', on ? 'true' : 'false');
      });
      fitTitles(desktopMQ.matches);
      requestAnimationFrame(() => fitTitles(desktopMQ.matches));
    }

    const n = cards.length;
    const tmx = new Float32Array(n);
    const tmy = new Float32Array(n);
    const mx = new Float32Array(n);
    const my = new Float32Array(n);
    const hovered = new Uint8Array(n);
    const hk = new Float32Array(n);

    cards.forEach((card, i) => {
      card.addEventListener('pointerenter', e => {
        hovered[i] = 1;
        if (e.pointerType === 'mouse' || e.pointerType === 'pen' || !e.pointerType) {
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => activate(i, true), 24);
        }
      });

      card.addEventListener('pointermove', e => {
        const rc = card.getBoundingClientRect();
        if (rc.width > 0 && rc.height > 0) {
          tmx[i] = clamp(((e.clientX - rc.left) / rc.width) * 2 - 1, -1, 1);
          tmy[i] = clamp(((e.clientY - rc.top) / rc.height) * 2 - 1, -1, 1);
        }
        hovered[i] = 1;
        if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && activeIdx !== i) {
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => activate(i, true), 24);
        }
      }, { passive: true });

      card.addEventListener('pointerleave', () => {
        hovered[i] = 0;
        tmx[i] = 0;
        tmy[i] = 0;
        clearTimeout(hoverTimer);
      });

      card.addEventListener('click', () => {
        clearTimeout(hoverTimer);
        activate(i, true);
      });

      card.addEventListener('focus', () => {
        activate(i, true);
      });

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(i, true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = (i + 1) % n;
          activate(next, true);
          cards[next].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = (i - 1 + n) % n;
          activate(prev, true);
          cards[prev].focus();
        }
      });
    });

    let inView = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { rootMargin: '250px 0px' }).observe(sec);
    }

    S.track(sec, q => {
      const enter = ease.out(r(q, 0.0, 0.18));
      deck.style.setProperty('--vc-enter', enter.toFixed(4));
      deck.classList.toggle('is-entered', enter >= 0.995);
    });

    L.tick(st => {
      if (!inView || L.reduced) return;
      const dt = Math.min(0.05, st.dt || 0.016);
      const follow = 1 - Math.exp(-dt * 8.5);
      const hFollow = 1 - Math.exp(-dt * 6.5);
      const t = st.t || 0;

      for (let i = 0; i < n; i++) {
        mx[i] += (tmx[i] - mx[i]) * follow;
        my[i] += (tmy[i] - my[i]) * follow;
        hk[i] += ((hovered[i] ? 1 : 0) - hk[i]) * hFollow;

        const isAct = i === activeIdx;
        const phase = i * 1.25;
        const floatY = Math.sin(t * 1.55 + phase) * (isAct ? 5.5 : 3.2);
        const floatR = Math.cos(t * 1.15 + phase) * (isAct ? 1.1 : 0.55);

        const c = cards[i];
        c.style.setProperty('--mx', mx[i].toFixed(3));
        c.style.setProperty('--my', my[i].toFixed(3));
        c.style.setProperty('--hk', hk[i].toFixed(3));
        c.style.setProperty('--fy', floatY.toFixed(2) + 'px');
        c.style.setProperty('--fr', floatR.toFixed(2) + 'deg');
      }
    });
  });
})();
