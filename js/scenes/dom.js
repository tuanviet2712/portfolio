/* ==========================================================================
   CÁC CẢNH DỰNG BẰNG CHỮ / ẢNH THẬT (CSS 3D, không cần WebGL)
   ① Đôi nét về tôi: dải sáng quét tiêu đề · khung chân dung mở như màn trập · lưới kẻ tự vẽ · 5 khối bay từ chiều sâu
   ④ Năng lực: tên 7 năng lực thành chữ khổng lồ trượt vào (kiểu "WE / HEAR TOUCH FEEL") → tiêu đề từng thẻ thu về đúng chỗ
   ⑦ Đối tác: logo xếp trên quỹ đạo quanh logo LTV, đường sáng nối tâm → thu về 2 hàng logo như cũ
   ⑧ Thành tựu: thẻ nhô lên theo chiều sâu, xoay kiểu cover flow theo vị trí trên hàng
   ⑨ Góc kiến thức: bìa bài nổi bật mở như cuốn sách, trang lật, 4 chủ đề bay ra đúng hàng
   ⑩ Liên hệ: đi xuyên qua logo LTV (lỗ hình logo phóng to phủ màn hình) · chân trang: "Le Tuan Viet" dựng lên theo cuộn
   Khung cuối của mọi cảnh = bố cục hiện tại (chữ, cỡ chữ, căn đều giữ nguyên).
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  const S = L && L.stage;
  if (!S || S.off) return;
  const { $, $$, clamp } = L;
  const { r, ease, mix } = S;
  const wide = matchMedia('(min-width: 1025px)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setVar = (el, k, v, d = 4) => { const s = v.toFixed(d); if (el['_' + k] !== s) { el['_' + k] = s; el.style.setProperty(k, s); } };

  document.addEventListener('DOMContentLoaded', () => {
    about(); skills(); partners(); feedback(); kb(); contact(); footer();
  });

  /* ---------------- ① ĐÔI NÉT VỀ TÔI: giữ nguyên trạng thái gốc như letuanviet.com ---------------- */
  function about() {}

  /* ---------------- ④ NĂNG LỰC CHUYÊN MÔN: Sân khấu Cờ Vua Pha Lê 3D & 7 Năng Lực (Luxury Crystal Stage) ---------------- */
  function skills() {
    const sec = $('#nang-luc');
    if (!sec) return;
    const pin = $('[data-skx-pin]', sec);
    const stageEl = $('[data-skx-stage]', sec);
    const arts = $$('[data-skx-art]', sec);
    const panels = $$('[data-skx-panel]', sec);
    const tabsWrap = $('[data-skx-tabs]', sec);
    const tabs = $$('[data-skx-tab]', sec);
    const pill = $('[data-skx-pill]', sec);
    const countEl = $('[data-skx-count]', sec);
    const stepBtns = $$('[data-skx-step]', sec);
    const head = $('.sec-head', sec);
    const N = arts.length;
    if (!pin || !N || panels.length !== N) return;

    if (head) head.classList.add('is-in');
    const titleEl = $('#skills-title', sec);
    if (titleEl) titleEl.classList.add('is-in');

    // 1. Dựng guồng số trượt dọc 01..07 kiểu đồng hồ cơ cao cấp
    let countTrack = null;
    if (countEl) {
      countEl.classList.add('skx__counter-reel');
      countTrack = document.createElement('span');
      countTrack.className = 'skx__counter-track';
      for (let i = 0; i < N; i++) {
        const b = document.createElement('b');
        b.textContent = String(i + 1).padStart(2, '0');
        countTrack.appendChild(b);
      }
      countEl.textContent = '';
      countEl.appendChild(countTrack);
    }

    // 2. Bộ đệm tham chiếu từng lớp DOM của 7 năng lực để nội suy 60fps không cần truy vấn lại DOM
    const artNodes = arts.map(art => ({
      el: art
    }));

    const panelNodes = panels.map(panel => ({
      el: panel,
      idx: $('.skx-panel__idx', panel),
      title: $('.skx-panel__title', panel),
      sub: $('.skx-panel__sub', panel),
      desc: $('.skx-panel__desc', panel),
      div: $('.skx-panel__div', panel),
      checks: $$('.skx-checks li', panel)
    }));

    // 3. Nạp trước toàn bộ 7 ảnh quân cờ pha lê để chuyển cảnh 0 độ trễ
    const warmImages = () => {
      $$('img[loading="lazy"]', stageEl).forEach(img => {
        img.loading = 'eager';
        if (img.decode) img.decode().catch(() => {});
      });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warmImages, { timeout: 1500 });
    else setTimeout(warmImages, 350);

    // 4. Đo & đồng bộ viên thuốc (pill) trượt mượt dưới thanh 7 tab
    function syncPill(idx) {
      if (!pill || !tabsWrap || !tabs[idx]) return;
      const tab = tabs[idx];
      const x = tab.offsetLeft;
      const w = tab.offsetWidth;
      if (w > 0) {
        pill.style.width = `${w}px`;
        pill.style.transform = `translate3d(${x}px, 0, 0)`;
        pill.classList.add('is-ready');
      }
      // Cuộn thanh tab ngang trên màn hẹp để tab đang chọn luôn nằm gọn trong tầm nhìn
      if (tabsWrap.scrollWidth > tabsWrap.clientWidth + 4) {
        const targetScroll = x - (tabsWrap.clientWidth - w) * 0.5;
        tabsWrap.scrollTo({ left: Math.max(0, targetScroll), behavior: L.reduced ? 'auto' : 'smooth' });
      }
    }

    // 5. Trạng thái chuyển cảnh tinh tế (ảnh quân cờ đứng yên tuyệt đối, chuyển mượt tại chỗ)
    let curIdx = 0;
    let prevIdx = -1;
    let transT = 1;            // 0..1 tiến độ chuyển cảnh giữa prevIdx -> curIdx
    let transDir = 1;          // +1 = tiến (01->07), -1 = lùi (07->01)
    const TRANS_DUR = 0.56;    // thời lượng chuyển cảnh mượt (giây)
    let navLockUntil = 0;      // khoá tạm đồng bộ cuộn khi người dùng bấm trực tiếp vào tab xa (vd 01 -> 07)
    let inView = true;

    function resetArtNode(n, visible) {
      n.el.style.opacity = visible ? '1' : '0';
      n.el.style.visibility = visible ? 'visible' : 'hidden';
    }

    function resetPanelNode(p, visible) {
      p.el.style.opacity = visible ? '1' : '0';
      p.el.style.visibility = visible ? 'visible' : 'hidden';
      p.el.style.pointerEvents = visible ? 'auto' : 'none';
      p.el.style.transform = '';
      [p.idx, p.title, p.sub, p.desc, p.div].forEach(el => {
        if (!el) return;
        el.style.transform = '';
        el.style.opacity = '';
      });
      p.checks.forEach(li => {
        li.style.transform = '';
        li.style.opacity = '';
      });
    }

    function setTabState(idx) {
      tabs.forEach((t, i) => {
        const on = i === idx;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      if (countTrack) {
        countTrack.style.transform = `translate3d(0, ${(-idx * (100 / N)).toFixed(3)}%, 0)`;
      }
      syncPill(idx);
    }

    function activate(nextIdx, dirHint) {
      const idx = clamp(nextIdx, 0, N - 1);
      if (idx === curIdx) return;

      // Nếu đang dở chuyển cảnh cũ thì dọn sạch các thẻ trung gian trước khi chuyển sang đích mới
      for (let i = 0; i < N; i++) {
        if (i !== curIdx && i !== idx) {
          arts[i].classList.remove('is-active');
          panels[i].classList.remove('is-active');
          resetArtNode(artNodes[i], false);
          resetPanelNode(panelNodes[i], false);
        }
      }

      transDir = dirHint != null ? (dirHint >= 0 ? 1 : -1) : (idx > curIdx ? 1 : -1);
      prevIdx = curIdx;
      curIdx = idx;
      transT = L.reduced ? 1 : 0;

      arts.forEach((a, i) => a.classList.toggle('is-active', i === curIdx));
      panels.forEach((p, i) => p.classList.toggle('is-active', i === curIdx));
      setTabState(curIdx);

      if (L.reduced) {
        resetArtNode(artNodes[prevIdx], false);
        resetPanelNode(panelNodes[prevIdx], false);
        resetArtNode(artNodes[curIdx], true);
        resetPanelNode(panelNodes[curIdx], true);
        prevIdx = -1;
      } else {
        artNodes[prevIdx].el.style.visibility = 'visible';
        artNodes[curIdx].el.style.visibility = 'visible';
        panelNodes[prevIdx].el.style.visibility = 'visible';
        panelNodes[curIdx].el.style.visibility = 'visible';
        panelNodes[prevIdx].el.style.pointerEvents = 'none';
        panelNodes[curIdx].el.style.pointerEvents = 'auto';
        renderTransition(0);
      }
      if (L.fit) L.fit(panelNodes[curIdx].el);
      if (L.fitJustify) L.fitJustify(panelNodes[curIdx].el);
    }

    // 6. Hàm nội suy chuyển cảnh: Ảnh quân cờ đứng yên tại chỗ chuyển mờ êm (crossfade), nội dung chữ & dấu tích trượt phân tầng
    function renderTransition(t) {
      const dir = transDir;
      const eFade = t * t * (3 - 2 * t);

      // --- A. CẢNH RỜI ĐI (prevIdx) ---
      if (prevIdx >= 0 && prevIdx !== curIdx) {
        const outArt = artNodes[prevIdx];
        const outPanel = panelNodes[prevIdx];

        const opArtOut = 1 - eFade;
        if (opArtOut <= 0.002) {
          resetArtNode(outArt, false);
        } else {
          outArt.el.style.opacity = opArtOut.toFixed(3);
          outArt.el.style.visibility = 'visible';
        }

        // Bảng thông tin cũ trượt êm và nhường chỗ
        const uPanelOut = clamp(t / 0.42);
        if (uPanelOut >= 0.999) {
          resetPanelNode(outPanel, false);
        } else {
          const opP = Math.pow(1 - uPanelOut, 1.8);
          const txP = (-dir * 14 * uPanelOut).toFixed(2);
          const tyP = (-5 * uPanelOut).toFixed(2);
          outPanel.el.style.opacity = opP.toFixed(3);
          outPanel.el.style.transform = `translate3d(${txP}px, ${tyP}px, 0)`;
        }
      }

      // --- B. CẢNH TIẾN VÀO (curIdx) ---
      const inArt = artNodes[curIdx];
      const inPanel = panelNodes[curIdx];
      inArt.el.style.opacity = eFade.toFixed(3);
      inArt.el.style.visibility = 'visible';

      // Bảng thông tin & 4 dấu tích xanh trượt vào theo nhịp phân tầng Editorial
      inPanel.el.style.opacity = '1';
      inPanel.el.style.visibility = 'visible';
      inPanel.el.style.transform = '';

      const infoItems = [inPanel.title, inPanel.desc, inPanel.div];
      for (let k = 0; k < infoItems.length; k++) {
        const el = infoItems[k];
        if (!el) continue;
        const uI = clamp((t - (0.14 + k * 0.045)) / 0.66);
        const eI = 1 - Math.pow(1 - uI, 3.6);
        const opI = 1 - Math.pow(1 - uI, 2.4);
        const tyI = (12 * (1 - eI)).toFixed(2);
        const txI = (dir * 8 * (1 - eI)).toFixed(2);
        el.style.opacity = opI.toFixed(3);
        el.style.transform = uI >= 0.998 ? '' : `translate3d(${txI}px, ${tyI}px, 0)`;
      }

      for (let k = 0; k < inPanel.checks.length; k++) {
        const li = inPanel.checks[k];
        const uC = clamp((t - (0.20 + k * 0.05)) / 0.62);
        const eC = 1 - Math.pow(1 - uC, 3.6);
        const opC = 1 - Math.pow(1 - uC, 2.4);
        const tyC = (10 * (1 - eC)).toFixed(2);
        const txC = (dir * 12 * (1 - eC)).toFixed(2);
        li.style.opacity = opC.toFixed(3);
        li.style.transform = uC >= 0.998 ? '' : `translate3d(${txC}px, ${tyC}px, 0)`;
      }
    }

    // 7. Khung ghim cuộn trên máy tính (≥ 1025px) kết hợp điều hướng nút bấm / tab / phím mũi tên
    const PAD = 0.045;
    let scRef = null;
    let synced = false;

    function stepPosFromP(p) {
      const c = clamp(p);
      if (c <= PAD) return 0;
      if (c >= 1 - PAD) return N - 1;
      return ((c - PAD) / (1 - 2 * PAD)) * (N - 1);
    }

    function holdPForIdx(i) {
      if (i <= 0) return PAD * 0.4;
      if (i >= N - 1) return 1 - PAD * 0.4;
      return PAD + (i / (N - 1)) * (1 - 2 * PAD);
    }

    if (wide) {
      scRef = S.add({
        el: pin,
        len: 5.2,
        measure() {
          syncPill(curIdx);
          if (L.fit) L.fit(sec);
          if (L.fitJustify) L.fitJustify(sec);
        },
        onEnter() {
          inView = true;
          syncPill(curIdx);
        },
        onLeave() {
          inView = false;
        },
        update(sc) {
          inView = true;
          const sPos = stepPosFromP(sc.p);
          const now = performance.now();

          if (!synced) {
            synced = true;
            const want = clamp(Math.round(sPos), 0, N - 1);
            if (want !== curIdx) {
              resetArtNode(artNodes[curIdx], false);
              resetPanelNode(panelNodes[curIdx], false);
              curIdx = want;
              prevIdx = -1;
              transT = 1;
              arts.forEach((a, i) => a.classList.toggle('is-active', i === curIdx));
              panels.forEach((p, i) => p.classList.toggle('is-active', i === curIdx));
              resetArtNode(artNodes[curIdx], true);
              resetPanelNode(panelNodes[curIdx], true);
              setTabState(curIdx);
            }
          } else if (now >= navLockUntil) {
            const want = clamp(Math.round(sPos), 0, N - 1);
            if (want !== curIdx) {
              activate(want, want > curIdx ? 1 : -1);
            }
          }

          // Thanh tiến trình mảnh dưới viên thuốc tab
          if (pill) {
            const localP = clamp(sPos - curIdx + 0.5, 0.08, 1);
            setVar(pill, '--tab-p', localP, 3);
          }
        }
      });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
      }, { rootMargin: '150px 0px' }).observe(sec);
    } else {
      inView = true;
    }

    // Hàm điều hướng chung khi bấm vào Tab 01..07 hoặc nút ← / →
    function goTo(targetIdx) {
      const next = (targetIdx + N) % N;
      if (next === curIdx) return;
      const dir = targetIdx > curIdx ? 1 : -1;
      const dist = Math.abs(next - curIdx);
      activate(next, dir);

      if (scRef && !S.off) {
        const dur = wide ? Math.min(1.35, 0.68 + dist * 0.11) : Math.min(0.85, 0.42 + dist * 0.08);
        navLockUntil = performance.now() + dur * 1000 + 120;
        S.scrollTo(scRef.top + holdPForIdx(next) * scRef.span, { duration: dur });
      }
    }

    tabs.forEach((btn, i) => {
      btn.addEventListener('click', () => goTo(i));
    });

    stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.skxStep || '1', 10) || 1;
        goTo(curIdx + delta);
      });
    });

    // Hỗ trợ vuốt ngang trên màn hình cảm ứng
    let touchStartX = 0, touchStartY = 0, touching = false;
    sec.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('button, a, .sphere')) return;
      touching = true;
      touchStartX = e.clientX;
      touchStartY = e.clientY;
    }, { passive: true });

    sec.addEventListener('pointerup', e => {
      if (!touching) return;
      touching = false;
      const dx = e.clientX - touchStartX;
      const dy = e.clientY - touchStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        goTo(curIdx + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });

    // Phím mũi tên Trái / Phải khi đang xem section Năng lực
    addEventListener('keydown', e => {
      if (!inView || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
      const rSec = pin.getBoundingClientRect();
      if (rSec.bottom < innerHeight * 0.25 || rSec.top > innerHeight * 0.75) return;
      if (e.key === 'ArrowRight') {
        goTo(curIdx + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        goTo(curIdx - 1);
        e.preventDefault();
      }
    });

    // Vòng lặp 60fps: cập nhật tiến trình chuyển cảnh
    L.tick(st => {
      if (!inView || transT >= 1) return;
      const dt = Math.min(0.05, (st && st.dt) || 0.016);
      transT = Math.min(1, transT + dt / TRANS_DUR);
      if (transT >= 1) {
        if (prevIdx >= 0 && prevIdx !== curIdx) {
          resetArtNode(artNodes[prevIdx], false);
          resetPanelNode(panelNodes[prevIdx], false);
        }
        prevIdx = -1;
        resetArtNode(artNodes[curIdx], true);
        resetPanelNode(panelNodes[curIdx], true);
      } else {
        renderTransition(transT);
      }
    });

    // Khởi tạo trạng thái ban đầu
    setTabState(0);
    L.onResize(() => syncPill(curIdx));
    L.onLayout(() => syncPill(curIdx));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        syncPill(curIdx);
        if (L.fit) L.fit(sec);
      });
    }
  }

  /* ---------------- ⑦ ĐỐI TÁC: giữ nguyên trạng thái gốc như letuanviet.com ---------------- */
  function partners() {}

  /* ---------------- ⑧ THÀNH TỰU: giữ nguyên 100% UI, ghim cuộn bắt buộc ngắn (6–8 đánh giá) + tự trôi liên tục ---------------- */
  function feedback() {
    if (!wide) return;
    const sec = $('#feedback');
    const track = $('[data-feedbacks]', sec);
    if (!sec || !track) return;
    const head = $('.sec-head', sec);
    if (head) head.classList.add('is-in');
    const title = $('#fb-title', sec);
    if (title) title.classList.add('is-in');

    const CARDS_PER_PIN = 7; // cuộn bắt buộc ngắn qua ~7 đánh giá (trong khoảng 6 - 8 đánh giá) rồi cuộn xuống section dưới luôn
    const stepW = () => {
      const c = $('.quote', track);
      return c ? c.offsetWidth + 18 : 438;
    };

    let curP = 0, prevP = 0, synced = false;

    S.add({
      el: sec,
      len: 1.45,
      onEnter(sc) {
        curP = prevP = sc.p;
        synced = true;
      },
      update(sc, st) {
        if (!synced) {
          curP = prevP = sc.p;
          synced = true;
        }
        const dt = (st && st.dt) || 0.016;
        curP += (sc.p - curP) * (1 - Math.exp(-dt * 22));
        const dp = curP - prevP;
        prevP = curP;
        if (Math.abs(dp) > 1e-6) {
          track.__scrollDx = (track.__scrollDx || 0) - dp * CARDS_PER_PIN * stepW();
        }
      }
    });
  }

  /* ---------------- ⑨ GÓC KIẾN THỨC: sách 3D lật trang theo cuộn (191 khung WebP + Lenis) ---------------- */
  function kb() {
    const sec = $('#kien-thuc');
    if (!sec) return;
    const cards = $$('.kbh-pillar', sec);
    const items = $$('.kbh-pillars > li', sec);
    if (!cards.length) return;

    sec.classList.add('kbx');
    items.forEach(li => li.classList.add('is-done'));
    cards.forEach(c => c.classList.remove('rv'));
    const head = $('.sec-head', sec);
    if (head) head.classList.add('is-in');

    const SEQ_N = 172;
    const KB_VER = '802';
    const LEVELS = [8, 4, 2, 1];
    const PAR_ACTIVE = wide ? 6 : 4, PAR_IDLE = wide ? 4 : 2;
    const AHEAD = wide ? 36 : 18, BEHIND = wide ? 18 : 10, KEEP = wide ? 180 : 48, MAXQ = wide ? 6 : 3;
    const DAMP_P = 11.0, DAMP_T = 14.0, DAMP_REST = 20.0, VMAX = 145;
    const PAD = 0.032;
    const TALL_ASPECT = 0.85;
    const BG = '#030A1E';
    const pad3 = i => String(i).padStart(3, '0');
    const isFile = location.protocol === 'file:';

    // Video mới 1920x1080 (camera tĩnh) được nới thành nền lụa xanh đen liền mạch 2400x1416 (plate = poster.webp);
    // mỗi khung chỉ chứa vùng sách lật trang (tile 1120x810 đã hoà viền trực tiếp vào plate) đặt tại tile.x/y.
    // act = hộp bao sách + đỉnh trang lật cao nhất + dải ruy-băng; book = hộp bao thân sách mở.
    const SCENE_DEF = {
      w: 2400,
      h: 1416,
      n: SEQ_N,
      plate: 'assets/kb/seq/poster.webp',
      tile: { x: 240, y: 258, w: 1120, h: 810 },
      act: [300, 315, 1235, 988],
      book: [308, 452, 1225, 983],
      sets: {
        full: { dir: 'assets/kb/seq/full', w: 1120, h: 810, stride: wide ? 1 : 2, ext: 'webp' }
      }
    };

    let host = null, canvas = null, ctx = null, plate = null, plateP = null;
    let W = 1, H = 1, dpr = 1, dirty = true, shown = false;
    // bố cục cố định theo kích thước màn hình (chỉ tính lại khi đổi kích thước → sách không tự phóng/thu khi cuộn)
    const lay = { k: 1, px: 0, py: 0, pw: 1, ph: 1, key: '' };
    let scene = null, sets = {}, active = null, fallbackSet = null, loadingManifest = null;
    let targetT = 0, curP = 0, curT = 0, prevT = 0, prevU = 0, vel = 0, dir = 1, lastDrawT = -1;
    let lastSchedT = -999, lastSchedDir = 0;
    let lastDrawnFrame = null;
    let inflightDecode = 0, lastAct = -1, isNearOrVis = false, synced = false;
    const decodedList = [];

    function mount(sticky) {
      if (host || !sticky) return;
      host = document.createElement('div');
      host.className = 'kbx-stage';
      host.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'kbx-canvas';
      canvas.style.opacity = '0';
      host.appendChild(canvas);
      sticky.insertBefore(host, sticky.firstChild);
      ctx = canvas.getContext('2d', { alpha: false });
      measure();
    }

    function measure() {
      if (!canvas || !host) return;
      const rect = host.getBoundingClientRect();
      W = Math.max(1, rect.width || innerWidth);
      H = Math.max(1, rect.height || innerHeight);
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, W <= 1024 ? 1.15 : 1.35, 1920 / W));
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        lastDrawnFrame = null;
      }
      dirty = true;
      lastDrawnFrame = null;
      if (scene) {
        layout();
        pickSet();
        if (active) renderNow(curT);
      }
      if (L.fit) L.fit(sec);
      if (L.fitJustify) L.fitJustify(sec);
    }

    // Đặt quyển sách 3D vào không gian mở bên trái (trên desktop) hoặc căn giữa phía trên lưới chủ đề (trên mobile/tablet)
    function layout() {
      const hr = host.getBoundingClientRect();
      const cont = $('.st-sticky > .container', sec);
      const headEl = $('.sec-head', sec);
      const gridEl = $('.kbh-pillars', sec);

      const [, ay0, , ay1] = scene.act;
      const [bx0, by0, bx1, by1] = scene.book;
      const bw = bx1 - bx0;
      const actH = Math.max(by1, ay1) - ay0;

      let s, tx, ty;
      if (W <= 1024) {
        let headBot = headEl ? (headEl.getBoundingClientRect().bottom - hr.top) : H * 0.20;
        if (headBot < 68 || headBot > H * 0.42) headBot = H * 0.20;
        const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
        let gridTop = gridRect ? (gridRect.top - hr.top) : H * 0.56;
        if (gridTop <= headBot + 110 || gridTop > H * 0.85) gridTop = H * 0.56;

        const availW = Math.max(220, W * 0.94);
        const availH = Math.max(120, gridTop - headBot - 4);
        s = clamp(0.98 * Math.min(availW / bw, availH / actH), 0.24, 0.78);
        const bookCx = W * 0.5;
        tx = bookCx - (bx0 + bw * 0.5) * s;
        const bookMid = (ay0 + Math.max(by1, ay1)) * 0.5;
        const stageMidY = (headBot + gridTop) * 0.5;
        ty = stageMidY - bookMid * s;
      } else {
        const padL = cont ? (parseFloat(getComputedStyle(cont).paddingLeft) || 28) : 28;
        const leftX = cont ? Math.max(24, cont.getBoundingClientRect().left - hr.left + padL) : W * 0.06;
        const colGap = clamp(W * 0.032, 34, 62);
        const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
        let rightX = gridRect ? (gridRect.left - hr.left - colGap) : W * 0.52;
        if (rightX - leftX < 260) rightX = W * 0.51;

        let headBot = headEl ? (headEl.getBoundingClientRect().bottom - hr.top) : H * 0.25;
        if (headBot < 90 || headBot > H * 0.46) headBot = H * 0.25;
        const peakTop = headBot + clamp(H * 0.008, 4, 12);
        // Chừa khoảng lụa xanh đen thoáng ở đáy và tránh hoàn toàn cụm nút EN|VI góc trái dưới
        const botY = H - clamp(H * 0.078, 56, 84);

        const availW = Math.max(240, rightX - leftX);
        const availH = Math.max(220, botY - peakTop);

        // Thu phóng sách lớn hơn ~10% (~99% hộp trống bên trái), cân đối với khối 2×2 thẻ bên phải
        s = clamp(0.99 * Math.min(availW / bw, availH / actH), 0.38, 1.08);

        // Căn giữa sách theo chiều ngang trong cột trái; chiều dọc nằm đúng tâm trục ngang của khối 2×2 thẻ bên phải
        const bookCx = (leftX + rightX) * 0.5;
        tx = bookCx - (bx0 + bw * 0.5) * s;
        const bookMid = (by0 + by1) * 0.5;
        const gridMidY = gridRect ? ((gridRect.top + gridRect.bottom) * 0.5 - hr.top) : (peakTop + botY) * 0.5;
        ty = gridMidY - bookMid * s;
      }

      lay.px = Math.round(tx * dpr);
      lay.py = Math.round(ty * dpr);
      lay.pw = Math.round(scene.w * s * dpr);
      lay.ph = Math.round(scene.h * s * dpr);
      lay.k = lay.pw / scene.w;
      // poster CSS trùng khít vị trí plate trên canvas → không nhảy hình khi canvas hiện lên
      host.style.backgroundSize = `${(lay.pw / dpr).toFixed(2)}px ${(lay.ph / dpr).toFixed(2)}px`;
      host.style.backgroundPosition = `${(lay.px / dpr).toFixed(2)}px ${(lay.py / dpr).toFixed(2)}px`;
      lay.key = '';
    }

    function loadPlate() {
      if (plateP || !scene.plate) return plateP;
      const url = `${scene.plate}?v=${KB_VER}`;
      plateP = loadImgEl(url)
        .then(im => (typeof createImageBitmap === 'function' ? createImageBitmap(im).catch(() => im) : im))
        .then(b => { plate = b; dirty = true; lay.key = ''; }, () => {});
      return plateP;
    }

    function lowerBound(fr, t) {
      let lo = 0, hi = fr.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (fr[m].i < t) lo = m + 1; else hi = m;
      }
      return lo;
    }

    function makeSet(name) {
      const def = scene.sets[name];
      const stride = def.stride || 1;
      const idx = [];
      for (let i = 0; i < scene.n; i += stride) idx.push(i);
      if (idx[idx.length - 1] !== scene.n - 1) idx.push(scene.n - 1);
      const set = {
        name, def, w: def.w, h: def.h,
        frames: null, started: false, inflight: 0, pending: idx.length
      };
      set.frames = idx.map((i, k) => ({
        i, k, set,
        url: `${def.dir}/${pad3(i)}.${def.ext || 'webp'}?v=${KB_VER}`,
        rank: Math.max(0, LEVELS.findIndex(s => i % s === 0)),
        src: null, bmp: null, busy: null,
        loaded: false, queued: false, wanted: false, failed: false
      }));
      return set;
    }

    function pickSet() {
      if (!scene) return;
      const want = (sets.tall && W / H < TALL_ASPECT) ? sets.tall : sets.full;
      if (want === active) return;
      if (active) fallbackSet = active;
      active = want;
      if (wide) {
        active.frames.forEach(f => { f.wanted = true; });
      } else {
        markWindow(active, curT, 12, 4);
      }
      startLoading(active);
      dirty = true;
      lastDrawnFrame = null;
    }

    function loadImgEl(url) {
      return new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error(url));
        im.src = url;
      });
    }

    function fetchFrame(f) {
      if (isFile || typeof fetch !== 'function') return loadImgEl(f.url);
      return fetch(f.url)
        .then(res => { if (!res.ok) throw new Error(res.status + ' ' + f.url); return res.blob(); })
        .catch(() => loadImgEl(f.url));
    }

    function markWindow(set, t, ahead = 28, behind = 14) {
      if (!set || !set.frames.length) return;
      const hi = Math.min(set.frames.length - 1, lowerBound(set.frames, t));
      const lo = Math.max(0, hi - behind), end = Math.min(set.frames.length - 1, hi + ahead);
      for (let k = lo; k <= end; k++) set.frames[k].wanted = true;
      set.frames[hi].wanted = true;
    }

    function startLoading(set) {
      if (!set.started) set.started = true;
      pump(set);
    }

    function pumpDecode() {
      if (!active || inflightDecode >= MAXQ) return;
      const fr = active.frames;
      while (inflightDecode < MAXQ) {
        let best = null, bs = Infinity;
        for (let k = 0; k < fr.length; k++) {
          const f = fr[k];
          if (!f.loaded || f.bmp || f.busy) continue;
          const diff = f.i - curT;
          const dist = Math.abs(diff);
          // Ưu tiên tuyệt đối các khung hình quanh curT theo hướng cuộn, sau đó giải mã sẵn toàn bộ 172 khung vào GPU
          const dirBias = (dir >= 0 ? (diff >= -2 ? 0 : 18) : (diff <= 2 ? 0 : 18));
          const s = dist <= 32 ? (dist + dirBias) : (1000 + f.rank * 260 + dist);
          if (s < bs) { bs = s; best = f; }
        }
        if (!best) break;
        decode(best);
      }
    }

    function pump(set) {
      const maxPar = isNearOrVis ? PAR_ACTIVE : PAR_IDLE;
      while (set.inflight < maxPar && set.pending > 0) {
        let best = null, bs = Infinity;
        for (const f of set.frames) {
          if (f.queued || !f.wanted) continue;
          const dist = Math.abs(f.i - curT);
          const s = (dist <= 28 ? dist : 1000 + f.rank * 320 + dist);
          if (s < bs) { bs = s; best = f; }
        }
        if (!best) break;
        best.queued = true;
        set.inflight++;
        set.pending--;
        fetchFrame(best)
          .then(obj => { best.src = obj; best.loaded = true; }, () => { best.failed = true; })
          .then(() => {
            set.inflight--;
            if (best.loaded) pumpDecode();
            else dirty = true;
            pump(set);
          });
      }
    }

    function decode(f) {
      if (f.bmp) return Promise.resolve(f.bmp);
      if (f.busy) return f.busy;
      if (!f.loaded) return Promise.reject(new Error('not-loaded'));
      inflightDecode++;
      const done = bmp => {
        f.bmp = bmp;
        f.busy = null;
        inflightDecode--;
        decodedList.push(f);
        dirty = true;
        pumpDecode();
        return bmp;
      };
      const fail = () => {
        f.busy = null;
        inflightDecode--;
        f.failed = true;
        f.loaded = false;
        pumpDecode();
      };
      let p;
      if (typeof createImageBitmap === 'function') {
        p = createImageBitmap(f.src).then(done, () => (f.src instanceof HTMLImageElement ? done(f.src) : fail()));
      } else if (f.src instanceof HTMLImageElement) {
        p = Promise.resolve(done(f.src));
      } else {
        const url = URL.createObjectURL(f.src);
        p = loadImgEl(url).then(im => { URL.revokeObjectURL(url); return done(im); }, () => { URL.revokeObjectURL(url); fail(); });
      }
      f.busy = p;
      return p;
    }

    function release(f) {
      if (f.bmp && typeof f.bmp.close === 'function') f.bmp.close();
      f.bmp = null;
      if (lastDrawnFrame === f) lastDrawnFrame = null;
      const k = decodedList.indexOf(f);
      if (k >= 0) decodedList.splice(k, 1);
    }

    function releaseSet(set) {
      for (let k = decodedList.length - 1; k >= 0; k--) {
        if (decodedList[k].set === set) release(decodedList[k]);
      }
    }

    function schedule(t, d, v) {
      if (!active) return;
      lastSchedT = t;
      lastSchedDir = d;
      const fr = active.frames, hi = lowerBound(fr, t);
      markWindow(active, t, d >= 0 ? AHEAD : BEHIND, d >= 0 ? BEHIND : AHEAD);
      pump(active);
      pumpDecode();
      for (let k = decodedList.length - 1; k >= 0; k--) {
        const f = decodedList[k];
        if (f.set === active && Math.abs(f.k - hi) > KEEP && f !== lastDrawnFrame) {
          release(f);
        }
      }
    }

    function sleep() {
      // Giữ nguyên các ImageBitmap đã giải mã trong GPU để khi cuộn lên/xuống lại mượt tức thì 0 độ trễ
      if (fallbackSet) { releaseSet(fallbackSet); fallbackSet = null; }
    }

    function neighbors(set, t) {
      const fr = set.frames, hi = lowerBound(fr, t);
      let a = null, b = null;
      for (let k = hi - 1, g = 0; k >= 0 && g < 191; k--, g++) if (fr[k].bmp) { a = fr[k]; break; }
      for (let k = hi, g = 0; k < fr.length && g < 191; k++, g++) if (fr[k].bmp) { b = fr[k]; break; }
      return [a, b];
    }

    function draw(t) {
      if (!ctx || !scene || !active) return false;
      let set = active, [a, b] = neighbors(set, t);
      if (!a && !b && fallbackSet) { set = fallbackSet; [a, b] = neighbors(set, t); }
      if (!a && !b) return false;

      const A = a || b, B = b || a;
      // Chọn khung hình gốc gần nhất để vẽ trực tiếp 1 lần sắc nét, không pha trộn 2 khung và không đổi zoom khi dừng
      const P = (A !== B && (t - A.i) >= (B.i - t)) ? B : A;
      if (!plate) return false;

      // Bỏ qua vẽ lại nếu vẫn là cùng một khung hình P và cùng bố cục -> tiết kiệm ~80% tải GPU
      const key = `${lay.px},${lay.py},${lay.pw},${canvas.width},${canvas.height}`;
      if (P === lastDrawnFrame && key === lay.key) return true;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.globalAlpha = 1;
      const k = lay.k, tl = scene.tile;
      const dx = Math.round(lay.px + tl.x * k), dy = Math.round(lay.py + tl.y * k);
      const dw = Math.round(tl.w * k), dh = Math.round(tl.h * k);
      if (key !== lay.key) {
        // vẽ lại toàn bộ: nền → plate (mép đã hoà về màu nền nên phần ngoài plate liền mạch)
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(plate, lay.px, lay.py, lay.pw, lay.ph);
        lay.key = key;
      }
      // tile đã được hoà viền trực tiếp vào plate nên chỉ cần 1 lệnh drawImage duy nhất mỗi khi đổi khung
      ctx.drawImage(P.bmp, dx, dy, dw, dh);

      lastDrawnFrame = P;

      if (set === active && fallbackSet) { releaseSet(fallbackSet); fallbackSet = null; }
      return true;
    }

    function renderNow(t) {
      if (draw(t)) {
        dirty = false;
        lastDrawT = t;
        if (!shown && canvas) { shown = true; canvas.style.opacity = '1'; }
      }
    }

    function preload() {
      if (loadingManifest) return loadingManifest;
      scene = window.KB_SEQ || SCENE_DEF;
      loadPlate();
      if (host) layout();
      sets.full = makeSet('full');
      if (scene.sets.tall) sets.tall = makeSet('tall');
      pickSet();
      schedule(curT, 1, 0);
      loadingManifest = Promise.resolve(scene);
      return loadingManifest;
    }

    function syncCards(p) {
      const idx = p < 0.25 ? 0 : (p < 0.50 ? 1 : (p < 0.75 ? 2 : 3));
      if (idx !== lastAct) {
        lastAct = idx;
        cards.forEach((c, i) => c.classList.toggle('is-active', i === idx));
      }
    }

    const sc = S.add({
      el: sec,
      len: wide ? 4.0 : 2.6,
      init(sc) {
        isNearOrVis = true;
        mount(sc.sticky);
        preload();
      },
      measure() {
        measure();
      },
      onEnter() {
        isNearOrVis = true;
        preload();
        dirty = true;
        lastDrawnFrame = null;
        if (active) schedule(curT, dir, vel);
      },
      onLeave() {
        isNearOrVis = false;
        sleep();
      },
      update(sc, st) {
        isNearOrVis = true;
        const p = sc.p;
        if (!scene) preload();
        const dt = Math.min(0.05, Math.max(0.001, (st && st.dt) || 0.016));
        const maxIdx = (scene.n || SEQ_N) - 1;
        const u = clamp((p - PAD) / (1 - 2 * PAD));
        targetT = u * maxIdx;

        if (!synced) {
          synced = true;
          curP = prevU = u;
          curT = prevT = targetT;
        } else if (L.reduced) {
          curP = u;
          curT = targetT;
        } else {
          // Bộ lọc mượt 2 tầng (curP -> curT) triệt tiêu độ gắt của từng nấc lăn chuột, giúp lật từng trang liên tiếp êm mượt
          const scrolling = Math.abs(u - prevU) > 0.00015 || Math.abs(st ? st.v : 0) > 12;
          curP += (u - curP) * (1 - Math.exp(-dt * DAMP_P));
          if (Math.abs(u - curP) < 0.0001) curP = u;

          const smoothTargetT = curP * maxIdx;
          const damp = scrolling ? DAMP_T : DAMP_REST;
          let delta = (smoothTargetT - curT) * (1 - Math.exp(-dt * damp));
          const cap = VMAX * dt;
          if (delta > cap) delta = cap;
          else if (delta < -cap) delta = -cap;
          curT += delta;
          if (Math.abs(targetT - curT) < 0.002 && Math.abs(u - curP) < 0.0002) curT = targetT;
        }
        prevU = u;
        syncCards(maxIdx > 0 ? (curT / maxIdx) : p);

        if (Math.abs(targetT - curT) > 0.01) dir = targetT >= curT ? 1 : -1;
        vel += ((curT - prevT) / dt - vel) * (1 - Math.exp(-dt * 10));
        prevT = curT;

        const moving = Math.abs(curT - lastDrawT) > 0.0005;

        if (active && (dirty || moving)) {
          if (dirty || Math.abs(curT - lastSchedT) >= 0.75 || dir !== lastSchedDir || !lastDrawnFrame) {
            schedule(curT, dir, vel);
          }
          renderNow(curT);
        }
      }
    });

    mount(sc.sticky);
    syncCards(0);
    const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2200 }) : setTimeout(fn, 150));
    L.on('ready', () => idle(() => preload()));
    // phông chữ tải xong có thể đổi chiều cao thanh tiêu đề → đặt lại vị trí sách một lần
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure());
  }

  /* ---------------- ⑩ LIÊN HỆ & CHÂN TRANG: giữ nguyên trạng thái gốc + chuyển cảnh Portal từ Footer về Hero ---------------- */
  function contact() {}

  function footer() {
    const foot = $('.footer');
    const hero = $('#trang-chu');
    if (!foot || !hero) return;

    const html = document.documentElement;
    const nav = $('#nav');
    const progBar = $('.progress');
    const smooth = L.smooth || ((a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); });

    // 1. Bọc toàn bộ nội dung gốc của .footer vào .footer__sticky và thêm đường băng cuộn .footer__runway
    const stickyWrap = document.createElement('div');
    stickyWrap.className = 'footer__sticky';
    while (foot.firstChild) stickyWrap.appendChild(foot.firstChild);
    const runway = document.createElement('div');
    runway.className = 'footer__runway';
    runway.setAttribute('aria-hidden', 'true');
    foot.appendChild(stickyWrap);
    foot.appendChild(runway);
    foot.classList.add('footer--portal');

    // 2. Dữ liệu 3 nét chuẩn của Logo LTV (assets/img/logo.svg, viewBox="186 186 918 888", tâm (645, 630))
    const LTV_PATHS = [
      'M436.0 351.0 C429.7 350.2 409.0 349.5 398.0 346.0 C387.0 342.5 376.3 337.3 370.0 330.0 C363.7 322.7 359.7 311.7 360.0 302.0 C360.3 292.3 364.7 281.3 372.0 272.0 C379.3 262.7 387.7 254.3 404.0 246.0 C420.3 237.7 444.0 228.7 470.0 222.0 C496.0 215.3 533.0 209.5 560.0 206.0 C587.0 202.5 607.8 201.2 632.0 201.0 C656.2 200.8 678.7 202.0 705.0 205.0 C731.3 208.0 763.8 212.2 790.0 219.0 C816.2 225.8 843.7 236.5 862.0 246.0 C880.3 255.5 892.5 266.3 900.0 276.0 C907.5 285.7 908.3 294.8 907.0 304.0 C905.7 313.2 899.5 324.0 892.0 331.0 C884.5 338.0 872.7 342.7 862.0 346.0 C851.3 349.3 833.7 350.2 828.0 351.0 L752.0 351.0 C747.0 352.2 729.7 353.2 722.0 358.0 C714.3 362.8 709.2 372.2 706.0 380.0 C702.8 387.8 703.5 400.8 703.0 405.0 L703.0 596.0 C696.2 594.7 676.2 588.3 662.0 588.0 C647.8 587.7 631.0 590.7 618.0 594.0 C605.0 597.3 594.2 602.5 584.0 608.0 C573.8 613.5 561.5 623.8 557.0 627.0 L557.0 405.0 C556.3 400.5 556.3 385.8 553.0 378.0 C549.7 370.2 544.2 362.5 537.0 358.0 C529.8 353.5 514.5 352.2 510.0 351.0 L436.0 351.0 Z',
      'M242.0 395.0 C245.3 390.3 254.0 374.2 262.0 367.0 C270.0 359.8 280.7 354.5 290.0 352.0 C299.3 349.5 308.3 349.7 318.0 352.0 C327.7 354.3 339.0 359.0 348.0 366.0 C357.0 373.0 366.0 383.0 372.0 394.0 C378.0 405.0 382.0 425.7 384.0 432.0 L388.0 722.0 C389.0 728.0 389.3 748.0 394.0 758.0 C398.7 768.0 406.3 776.3 416.0 782.0 C425.7 787.7 428.0 790.0 452.0 792.0 C476.0 794.0 532.3 792.5 560.0 794.0 C587.7 795.5 601.3 796.0 618.0 801.0 C634.7 806.0 648.0 813.5 660.0 824.0 C672.0 834.5 682.3 848.7 690.0 864.0 C697.7 879.3 703.0 898.7 706.0 916.0 C709.0 933.3 710.0 952.3 708.0 968.0 C706.0 983.7 701.7 998.0 694.0 1010.0 C686.3 1022.0 676.0 1032.5 662.0 1040.0 C648.0 1047.5 629.0 1052.0 610.0 1055.0 C591.0 1058.0 570.3 1058.8 548.0 1058.0 C525.7 1057.2 499.0 1055.5 476.0 1050.0 C453.0 1044.5 429.7 1035.3 410.0 1025.0 C390.3 1014.7 372.0 1001.5 358.0 988.0 C344.0 974.5 331.3 951.3 326.0 944.0 C337.0 946.3 368.0 954.7 392.0 958.0 C416.0 961.3 444.0 963.3 470.0 964.0 C496.0 964.7 530.0 963.3 548.0 962.0 C566.0 960.7 571.0 959.7 578.0 956.0 C585.0 952.3 589.7 945.2 590.0 940.0 C590.3 934.8 585.7 928.3 580.0 925.0 C574.3 921.7 560.0 920.8 556.0 920.0 C536.7 919.8 471.0 920.7 440.0 919.0 C409.0 917.3 391.7 915.0 370.0 910.0 C348.3 905.0 328.0 898.7 310.0 889.0 C292.0 879.3 275.7 867.5 262.0 852.0 C248.3 836.5 237.0 818.0 228.0 796.0 C219.0 774.0 212.5 747.7 208.0 720.0 C203.5 692.3 201.3 661.7 201.0 630.0 C200.7 598.3 202.7 559.7 206.0 530.0 C209.3 500.3 215.0 474.5 221.0 452.0 C227.0 429.5 238.5 404.5 242.0 395.0 Z',
      'M478.0 761.0 C481.3 752.8 488.7 727.8 498.0 712.0 C507.3 696.2 520.0 679.3 534.0 666.0 C548.0 652.7 565.7 641.0 582.0 632.0 C598.3 623.0 617.0 616.0 632.0 612.0 C647.0 608.0 658.0 607.3 672.0 608.0 C686.0 608.7 702.0 611.0 716.0 616.0 C730.0 621.0 743.3 628.0 756.0 638.0 C768.7 648.0 780.0 660.0 792.0 676.0 C804.0 692.0 815.5 708.8 828.0 734.0 C840.5 759.2 860.5 811.5 867.0 827.0 C873.2 816.8 893.2 786.8 904.0 766.0 C914.8 745.2 925.3 723.0 932.0 702.0 C938.7 681.0 942.7 660.7 944.0 640.0 C945.3 619.3 942.8 598.0 940.0 578.0 C937.2 558.0 930.3 535.3 927.0 520.0 C923.7 504.7 919.8 496.8 920.0 486.0 C920.2 475.2 922.7 463.2 928.0 455.0 C933.3 446.8 943.0 440.8 952.0 437.0 C961.0 433.2 972.0 431.5 982.0 432.0 C992.0 432.5 1002.3 434.3 1012.0 440.0 C1021.7 445.7 1031.3 454.0 1040.0 466.0 C1048.7 478.0 1057.0 494.0 1064.0 512.0 C1071.0 530.0 1077.8 552.7 1082.0 574.0 C1086.2 595.3 1089.0 616.3 1089.0 640.0 C1089.0 663.7 1087.2 690.0 1082.0 716.0 C1076.8 742.0 1068.7 769.3 1058.0 796.0 C1047.3 822.7 1033.7 851.0 1018.0 876.0 C1002.3 901.0 982.3 925.7 964.0 946.0 C945.7 966.3 923.3 986.3 908.0 998.0 C892.7 1009.7 883.3 1012.5 872.0 1016.0 C860.7 1019.5 849.7 1020.3 840.0 1019.0 C830.3 1017.7 821.3 1013.2 814.0 1008.0 C806.7 1002.8 799.0 991.3 796.0 988.0 C792.0 981.0 781.0 963.7 772.0 946.0 C763.0 928.3 752.0 903.3 742.0 882.0 C732.0 860.7 721.0 836.3 712.0 818.0 C703.0 799.7 696.7 785.0 688.0 772.0 C679.3 759.0 671.0 748.3 660.0 740.0 C649.0 731.7 635.0 725.5 622.0 722.0 C609.0 718.5 595.7 718.0 582.0 719.0 C568.3 720.0 552.8 723.8 540.0 728.0 C527.2 732.2 515.3 738.5 505.0 744.0 C494.7 749.5 482.5 758.2 478.0 761.0 Z'
    ];
    const p2d = typeof Path2D === 'function' ? LTV_PATHS.map(d => new Path2D(d)) : null;

    // 3. Khởi tạo lớp phủ Portal cố định (.fportal): Canvas hạt chấm xanh Antigravity + Logo LTV xanh gradient ở tâm
    const portal = document.createElement('div');
    portal.className = 'fportal';
    portal.setAttribute('aria-hidden', 'true');
    portal.innerHTML =
      '<canvas class="fportal__canvas"></canvas>' +
      '<div class="fportal__center">' +
        '<div class="fportal__logo-wrap">' +
          '<svg class="fportal__logo" viewBox="186 186 918 888" role="img" aria-label="LTV">' +
            '<defs>' +
              '<linearGradient id="fportalLtvG" gradientUnits="userSpaceOnUse" x1="250" y1="300" x2="1030" y2="960">' +
                '<stop offset="0" stop-color="#0CF2DF"/>' +
                '<stop offset=".2" stop-color="#17C4FA"/>' +
                '<stop offset=".42" stop-color="#1482FF"/>' +
                '<stop offset=".62" stop-color="#1356F2"/>' +
                '<stop offset=".8" stop-color="#1A36B0"/>' +
                '<stop offset="1" stop-color="#10114A"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<g fill="url(#fportalLtvG)">' +
              LTV_PATHS.map(d => `<path d="${d}"/>`).join('') +
            '</g>' +
          '</svg>' +
        '</div>' +
      '</div>';
    document.body.appendChild(portal);

    let canvas = $('.fportal__canvas', portal);
    const logoWrap = $('.fportal__logo-wrap', portal);

    // 4. Trường hạt chép nguyên từ hero của antigravity.google (MainParticlesComponent, theme light:
    //    ring-width 0.006, ring-width2 0.107, ring-displacement 0.62, density 230, particles-scale 0.59,
    //    camera fov 40 / z 3.1 / mesh scale 5, màu #2c64ed → #f84242 → #ffcf03 nhân vận tốc).
    //    Khác bản gốc đúng một điểm: vòng sáng ghim quanh tâm logo, chuột chỉ kéo lệch nhẹ (LEAN) thay vì
    //    kéo cả vòng theo. Mô phỏng gốc chạy qua texture ping-pong; ở đây dùng trạng thái ổn định của
    //    chính phương trình đó nên tính thẳng trong vertex shader.
    const LEAN = 0.12;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = innerWidth, H = innerHeight, dpr = 1;
    let footTop = 0, stickyH = 1, footH = 1, startY = 0, span = 1;
    let logoBoxSize = 116, maxRadius = 900, minRadius = 58, clearR = 66;
    let unit = 1994, pScale = 0.42;
    let wasActive = false;

    const PT_VS = `
precision highp float;
attribute vec4 aP;
uniform vec2 uRes, uRing;
uniform float uDpr, uTime, uUnit, uPs, uLogoR, uHole, uCut;
varying vec3 vCol;
varying float vA;
varying float vRot;
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 nm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= nm.x; p1 *= nm.y; p2 *= nm.z; p3 *= nm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// smoothstep cho phép edge0 > edge1 như shader gốc (GLSL không định nghĩa trường hợp này)
float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void main() {
  // --- shader mô phỏng gốc (toạ độ y hướng lên, đơn vị = refPos) ---
  vec2 c = aP.xy;
  float time = uTime * 0.5;
  float R = 0.175 + sin(uTime) * 0.03 + cos(uTime * 3.0) * 0.02;
  float dist = distance(c, uRing);
  float noise0 = snoise(vec3(c * 0.2 + vec2(18.4924, 72.9744), time * 0.5));
  float dist1 = distance(c + noise0 * 0.005, uRing);
  float t = ss(R - 0.012, R, dist) - ss(R, R + 0.006, dist1);
  float t2 = ss(R - 0.214, R, dist) - ss(R, R + 0.107, dist1);
  float t3 = ss(R + 0.107, R, dist);
  t = t * t;
  t2 = t2 * t2 * t2;
  t += t2 * 3.0;
  t += t3 * 0.4;
  t += snoise(vec3(c * 30.0 + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;
  float nS = (snoise(vec3(c * 2.0 + vec2(18.4924, 72.9744), time * 0.5)) + 1.5) * 0.5;
  t += nS * nS * 0.6;
  float noise1 = snoise(vec3(c * 4.0 + vec2(88.494, 32.4397), time * 0.35));
  float noise2 = snoise(vec3(c * 4.0 + vec2(50.904, 120.947), time * 0.35));
  float noise3 = snoise(vec3(c * 20.0 + vec2(18.4924, 72.9744), time * 0.5));
  float noise4 = snoise(vec3(c * 20.0 + vec2(50.904, 120.947), time * 0.5));
  vec2 disp = vec2(noise1, noise2) * 0.03 + vec2(noise3, noise4) * 0.005;
  disp.x += sin(c.x * 20.0 + time * 4.0) * 0.02 * clamp(dist, 0.0, 1.0);
  disp.y += cos(c.y * 20.0 + time * 3.0) * 0.02 * clamp(dist, 0.0, 1.0);
  // gốc: pos = 0.8·pos_trước − (ring − (refPos + disp))·pow(t2, .75)·0.62; final = refPos + disp + 0.25·pos
  // → điểm cân bằng: final = (refPos + disp)(1.25 + 0.3125k) − 0.3125k·ring; vận tốc cân bằng = 0.5·scale
  float k = pow(max(t2, 0.0), 0.75) * 0.62;
  vec2 F = (c + disp) * (1.25 + 0.3125 * k) - 0.3125 * k * uRing;
  float vel = t * 0.5;

  // --- shader vẽ gốc ---
  float noiseAngle = snoise(vec3(F * 10.0 + vec2(18.4924, 72.9744), uTime * 0.85));
  float noiseColor = (snoise(vec3(F * 2.0 + vec2(74.664, 91.556), uTime * 0.5)) + 1.0) * 0.5;
  vRot = -atan(F.y - uRing.y, F.x - uRing.x) + noiseAngle * 0.5;
  float progress = smoothstep(0.0, 0.75, noiseColor * noiseColor);
  vec3 c1 = vec3(0.173, 0.392, 0.929), c2 = vec3(0.973, 0.259, 0.259), c3 = vec3(1.0, 0.812, 0.012);
  vec3 col = progress < 0.8 ? mix(c1, c2, progress / 0.8) : mix(c2, c3, (progress - 0.8) / 0.2);
  vCol = clamp(col, 0.0, 1.0) * clamp(vel, 0.0, 1.0);

  // chừa chỗ cho logo ở tâm và cổng tròn đang đóng / mở
  vec2 px = F * uUnit;
  float dc = length(px);
  float m = ss(uLogoR, uLogoR + 30.0, dc);
  if (uCut > 0.5) m *= ss(uHole + 4.0, uHole + 12.0, dc);
  vA = ss(0.1, 0.2, t) * m;

  gl_PointSize = t * 7.0 * (uDpr * 0.5) * uPs;
  gl_Position = vA > 0.01 ? vec4(px / (uRes * 0.5), 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
    const PT_FS = `
precision mediump float;
varying vec3 vCol;
varying float vA;
varying float vRot;
float sdRoundBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  uv.y *= -1.0;
  float s = sin(vRot), c = cos(vRot);
  uv = mat2(c, s, -s, c) * uv;
  float a = vA * (1.0 - smoothstep(0.0, 0.1, sdRoundBox(uv, vec2(0.5, 0.2), vec4(0.25))));
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;
    const BG_VS = 'attribute vec2 aQ; void main() { gl_Position = vec4(aQ, 0.0, 1.0); }';
    // nền trắng như bản gốc; trong cổng tròn trong suốt, viền mảnh khi cổng đang đóng / mở
    const BG_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uC;
uniform float uDpr, uHole, uCut, uRim;
void main() {
  float d = length(gl_FragCoord.xy - uC) / uDpr;
  vec3 col = vec3(1.0);
  float a = 1.0;
  if (uCut > 0.5) {
    a = smoothstep(uHole - 0.8, uHole + 0.8, d);
    col = mix(col, vec3(0.078, 0.510, 1.0), uRim * (1.0 - smoothstep(0.0, 1.4, abs(d - uHole - 1.0))));
  }
  gl_FragColor = vec4(col * a, a);
}`;

    let gl = null, ctx = null, glLost = false, ptP = null, bgP = null, ptBuf = null, triBuf = null;
    let ptCount = 0, geoDirty = true, fieldT = 0;
    const ring = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0, on: false };

    function glInit() {
      const make = (vs, fs, attr, names) => {
        const p = gl.createProgram();
        [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
          const sh = gl.createShader(type);
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
          gl.attachShader(p, sh);
        });
        gl.bindAttribLocation(p, 0, attr);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = { p };
        names.forEach(n => (u[n] = gl.getUniformLocation(p, n)));
        return u;
      };
      ptP = make(PT_VS, PT_FS, 'aP', ['uRes', 'uRing', 'uDpr', 'uTime', 'uUnit', 'uPs', 'uLogoR', 'uHole', 'uCut']);
      bgP = make(BG_VS, BG_FS, 'aQ', ['uC', 'uDpr', 'uHole', 'uCut', 'uRim']);
      triBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      ptBuf = gl.createBuffer();
      gl.enableVertexAttribArray(0);
      geoDirty = true;
    }

    function ensureField() {
      if (gl || ctx) return;
      try {
        gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false });
        if (gl) glInit();
      } catch (err) {
        gl = null;
      }
      if (gl) {
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; });
        canvas.addEventListener('webglcontextrestored', () => { glInit(); glLost = false; });
        return;
      }
      // không có WebGL: canvas mới cho 2D (canvas đã xin webgl không trả về 2D) — chỉ nền trắng + cổng tròn
      const c2 = document.createElement('canvas');
      c2.className = canvas.className;
      canvas.replaceWith(c2);
      canvas = c2;
      ctx = canvas.getContext('2d');
      measure();
    }

    // Poisson-disk như bản gốc (density 230 → khoảng cách 3,867–4,867 trên lưới 500, tries 20), chỉ rải
    // trong phần nhìn thấy: điểm hiện ra ở 1,25 × refPos
    function buildGeo() {
      const k = 1.25 * unit;
      const halfW = W * 0.5 / k + 0.06, halfH = H * 0.5 / k + 0.06;
      const minDist = 3.867 / 250, maxDist = 4.867 / 250;
      const cell = minDist / Math.SQRT2;
      const cols = Math.ceil(halfW * 2 / cell), rows = Math.ceil(halfH * 2 / cell);
      const grid = new Int32Array(cols * rows).fill(-1);
      const xs = [], ys = [], active = [];
      let seed = 48271;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const add = (x, y) => {
        grid[Math.floor((y + halfH) / cell) * cols + Math.floor((x + halfW) / cell)] = xs.length;
        active.push(xs.length);
        xs.push(x);
        ys.push(y);
      };
      add(0, 0);
      const md2 = minDist * minDist;
      while (active.length) {
        const ai = Math.floor(rnd() * active.length), b = active[ai];
        let found = false;
        for (let t = 0; t < 20 && !found; t++) {
          const an = rnd() * Math.PI * 2, rr = minDist + rnd() * (maxDist - minDist);
          const nx = xs[b] + Math.cos(an) * rr, ny = ys[b] + Math.sin(an) * rr;
          if (nx < -halfW || nx >= halfW || ny < -halfH || ny >= halfH) continue;
          const gx = Math.floor((nx + halfW) / cell), gy = Math.floor((ny + halfH) / cell);
          let ok = true;
          for (let yy = Math.max(0, gy - 2); yy <= Math.min(rows - 1, gy + 2) && ok; yy++) {
            for (let xx = Math.max(0, gx - 2); xx <= Math.min(cols - 1, gx + 2); xx++) {
              const g = grid[yy * cols + xx];
              if (g !== -1 && (xs[g] - nx) ** 2 + (ys[g] - ny) ** 2 < md2) { ok = false; break; }
            }
          }
          if (ok) { add(nx, ny); found = true; }
        }
        if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
      }
      const out = new Float32Array(xs.length * 4);
      for (let i = 0; i < xs.length; i++) { out[i * 4] = xs[i]; out[i * 4 + 1] = ys[i]; }
      return out;
    }

    function draw2d(holeR, cut, rim) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      if (cut > 0.01 && holeR > 0.5) {
        if (rim > 0) {
          ctx.strokeStyle = `rgba(20,130,255,${rim.toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(W * 0.5, H * 0.5, holeR + 0.75, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.5, holeR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // nhiễu 1 chiều mượt cho vòng "thở" lệch nhẹ khi đứng yên (gốc: noise.getVal(time·0.66 + 94.234))
    const wob = x => Math.sin(x * 1.7) * 0.55 + Math.sin(x * 0.83 + 1.9) * 0.3 + Math.sin(x * 2.9 + 4.1) * 0.15;

    function drawField(holeR, cut, rim, dt) {
      if (!calm) fieldT += Math.min(dt, 0.05);
      if (ctx) { draw2d(holeR, cut, rim); return; }
      if (!gl || glLost) return;
      if (geoDirty) {
        const data = buildGeo();
        ptCount = data.length / 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        geoDirty = false;
      }
      // vòng sáng: gốc bám theo chuột (0,875 × vị trí chuột, hệ số 0,02 / khung); ở đây chỉ lệch LEAN phần đó
      if (!calm) {
        const n = wob(fieldT * 0.66 + 94.234), q = wob(fieldT * 0.75 + 21.028);
        const tx = mouse.on ? ((mouse.x - W * 0.5) / unit) * 0.875 + n * 0.1 : n * 0.2;
        const ty = mouse.on ? (-(mouse.y - H * 0.5) / unit) * 0.875 + q * 0.1 : q * 0.1;
        const kk = 1 - Math.pow(mouse.on ? 0.98 : 0.99, Math.min(dt, 0.05) * 60);
        ring.x += (tx * LEAN - ring.x) * kk;
        ring.y += (ty * LEAN - ring.y) * kk;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(bgP.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(bgP.uC, canvas.width * 0.5, canvas.height * 0.5);
      gl.uniform1f(bgP.uDpr, canvas.width / W);
      gl.uniform1f(bgP.uHole, holeR);
      gl.uniform1f(bgP.uCut, cut > 0.01 ? 1 : 0);
      gl.uniform1f(bgP.uRim, rim);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(ptP.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(ptP.uRes, W, H);
      gl.uniform2f(ptP.uRing, ring.x, ring.y);
      gl.uniform1f(ptP.uDpr, canvas.width / W);
      gl.uniform1f(ptP.uTime, fieldT);
      gl.uniform1f(ptP.uUnit, unit);
      gl.uniform1f(ptP.uPs, pScale);
      gl.uniform1f(ptP.uLogoR, clearR);
      gl.uniform1f(ptP.uHole, holeR);
      gl.uniform1f(ptP.uCut, cut > 0.01 ? 1 : 0);
      gl.drawArrays(gl.POINTS, 0, ptCount);
    }

    function measure() {
      W = innerWidth;
      H = innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        geoDirty = true;
      }
      logoBoxSize = clamp(W * 0.088, 92, 128);
      minRadius = logoBoxSize * 0.48;
      clearR = logoBoxSize * 0.5 + 8;
      maxRadius = Math.hypot(W * 0.5, H * 0.5) * 1.04;
      // camera gốc: fov 40°, z 3.1, mesh × 5 → 1 đơn vị = H / (2 · tan20° · 3.1 / 5) px; màn dọc lấy theo bề ngang
      // để vòng sáng vẫn ôm quanh logo. Cỡ hạt gốc = bề ngang / 2000 × 0.59 (điện thoại giữ tối thiểu 0.4)
      unit = Math.min(H, W * 1.25) / 0.451326;
      pScale = Math.max(W / 2000, 0.4) * 0.59;

      // Đo chiều cao tự nhiên của phần nội dung footer để ghim đúng lúc chữ "Le Tuan Viet" chạm đáy màn hình
      stickyWrap.style.minHeight = '0px';
      const natH = stickyWrap.offsetHeight || H;
      stickyWrap.style.minHeight = '';
      foot.style.setProperty('--fh', Math.max(H, natH) + 'px');

      stickyH = stickyWrap.offsetHeight || Math.max(H, natH);
      footTop = L.offTop(foot);
      footH = foot.offsetHeight || (stickyH + H * 2.65);
      startY = footTop + Math.max(0, stickyH - H);
      span = Math.max(1, footTop + footH - H - startY);
    }
    measure();
    L.onResize(measure);
    L.onLayout(measure);

    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.on = true;
    }, { passive: true });
    html.addEventListener('mouseleave', () => { mouse.on = false; });

    let heroPreviewOn = false;
    function setHeroPreview(on) {
      if (heroPreviewOn === on) return;
      heroPreviewOn = on;
      html.classList.toggle('is-fportal-hero', on);
      if (L.heroPortal) L.heroPortal.setPreview(on);
      if (on && nav) {
        nav.classList.remove('is-hidden', 'is-scrolled');
        const homeLink = $('.nav__links a[data-nav="trang-chu"]', nav);
        if (homeLink) {
          $$('.nav__links a', nav).forEach(a => a.classList.toggle('is-active', a === homeLink));
          const pill = $('.nav__pill', nav);
          if (pill) {
            pill.style.width = homeLink.offsetWidth + 'px';
            pill.style.transform = `translateX(${homeLink.offsetLeft}px)`;
            pill.style.opacity = '1';
          }
        }
      }
    }

    let warmed = false, cooldownUntil = 0, lastPortalP = 0;

    function closePortal() {
      wasActive = false;
      portal.classList.remove('is-active');
      html.classList.remove('is-fportal-on');
      html.style.removeProperty('--fp-hide-ui');
      html.style.removeProperty('--fp-hero-scale');
      stickyWrap.style.transform = '';
      logoWrap.style.opacity = '0';
      logoWrap.style.transform = 'scale(1)';
      setHeroPreview(false);
    }

    L.tick(st => {
      if (st.t < cooldownUntil) return;

      // Đồng bộ vị trí thật của footer phòng trường hợp CSS tải trễ (như showcase.min.css) làm thay đổi chiều cao trang
      const curFootTop = foot.offsetTop;
      if (curFootTop > 0 && Math.abs(curFootTop - footTop) > 2) {
        footTop = curFootTop;
        footH = foot.offsetHeight || (stickyH + H * 2.65);
        startY = footTop + Math.max(0, stickyH - H);
        span = Math.max(1, footTop + footH - H - startY);
        return;
      }

      // Làm ấm trước (dịch shader, khung 0 của Hero) ngay khi người dùng cuộn xuống gần Footer
      if (!warmed && st.y > footTop - H * 1.8) {
        warmed = true;
        ensureField();
        if (L.heroPortal) L.heroPortal.warm();
      }

      const rel = st.y - startY;
      if (rel <= 0.5) {
        lastPortalP = 0;
        if (wasActive) closePortal();
        return;
      }

      const p = clamp(rel / span, 0, 1);

      // Khi cổng mở hoàn toàn sang Hero section (p >= 0.988): nhảy tức thì và liền mạch về đầu trang (#trang-chu)
      if (p >= 0.988 && wasActive && lastPortalP > 0.35) {
        cooldownUntil = st.t + 0.42;
        lastPortalP = 0;
        closePortal();
        if (progBar) progBar.style.setProperty('--sp', '0');
        if (L.lenis) L.lenis.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
        st.y = 0;
        return;
      }
      lastPortalP = p;

      if (!wasActive) {
        wasActive = true;
        ensureField();
        portal.classList.add('is-active');
        html.classList.add('is-fportal-on');
        if (L.heroPortal) L.heroPortal.warm();
      }

      // Ẩn dần nút về đầu trang & chuyển ngôn ngữ khi màn đóng lại
      const hideUi = smooth(0.04, 0.28, p);
      html.style.setProperty('--fp-hide-ui', hideUi.toFixed(3));

      // Tính toán 3 pha với khung tròn đồng tâm (Circular Iris) + Logo LTV giữ nguyên tỉ lệ chuẩn:
      // Pha 1 (0.00 -> 0.42): Khung tròn thu mượt từ 4 góc màn hình về đúng tâm Logo LTV xanh gradient
      // Pha 2 (0.42 -> 0.56): Màn trắng với trường hạt toả ra từ Logo LTV ở tâm
      // Pha 3 (0.56 -> 0.988): Khung tròn mở bung từ tâm Logo LTV ra toàn màn hình, lộ diện Hero section (#trang-chu)
      let holeRadius = 0, cutoutAlpha = 0, logoAlpha = 1, logoScale = 1;

      if (p < 0.42) {
        setHeroPreview(false);
        const tc = ease.inOut(r(p, 0.0, 0.34));
        // Thu bán kính khung tròn đồng tâm mượt từ maxRadius về 0, sau đó Logo LTV bung nhẹ trên nền trắng tinh khiết
        holeRadius = maxRadius * (1 - tc);
        cutoutAlpha = p < 0.34 ? 1 : 0;
        logoAlpha = smooth(0.33, 0.41, p);
        logoScale = mix(0.86, 1.0, smooth(0.33, 0.42, p));
        const fScale = 1 - tc * 0.04;
        stickyWrap.style.transform = `scale(${fScale.toFixed(4)})`;
      } else if (p <= 0.56) {
        // Khi màn trắng đã đóng kín hoàn toàn (p >= 0.47), chuyển lớp nền phía sau từ Footer sang Hero section (#trang-chu)
        setHeroPreview(p >= 0.47);
        const th = r(p, 0.42, 0.56);
        holeRadius = 0;
        cutoutAlpha = 0;
        logoAlpha = 1;
        logoScale = 1 + 0.035 * Math.sin(th * Math.PI);
        stickyWrap.style.transform = '';
        html.style.setProperty('--fp-hero-scale', '1.04');
      } else {
        setHeroPreview(true);
        const to = ease.inOut(r(p, 0.60, 0.985));
        holeRadius = maxRadius * to;
        cutoutAlpha = p > 0.60 ? 1 : 0;
        logoAlpha = 1 - smooth(0.56, 0.61, p);
        logoScale = mix(1.0, 1.14, smooth(0.56, 0.61, p));
        const hScale = 1 + 0.04 * (1 - ease.out(r(p, 0.60, 0.96)));
        html.style.setProperty('--fp-hero-scale', hScale.toFixed(4));
        if (progBar) progBar.style.setProperty('--sp', (1 - ease.out(r(p, 0.60, 0.96))).toFixed(4));
      }

      logoWrap.style.opacity = logoAlpha.toFixed(4);
      logoWrap.style.transform = `scale(${logoScale.toFixed(4)})`;

      // Viền mảnh bo quanh khung tròn khi đang thu / mở
      const rim = cutoutAlpha > 0.002 && holeRadius > minRadius * 1.02 && holeRadius < maxRadius * 0.96 ? cutoutAlpha * 0.16 : 0;
      drawField(holeRadius, cutoutAlpha, rim, st.dt);
    });
  }
})();
