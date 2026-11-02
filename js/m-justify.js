/* ==========================================================================
   M-JUSTIFY — chữ đoạn văn trên điện thoại (≤ 760px), VI + EN
   - Cỡ chữ do css/m-type.css quy định theo loại chữ (mọi đoạn cùng loại cùng một cỡ),
     nên ở điện thoại không còn chỉnh cỡ chữ riêng từng đoạn như fitJustify trên máy tính.
   - Tự ngắt dòng (quy hoạch động kiểu Knuth–Plass): ưu tiên đúng số dòng của bản máy tính
     (bảng DESK, tạo bởi tools/m-justify-map.cjs), dòng nào cũng căn đều 2 bên với khoảng
     trắng đều; phần thừa được chia cho khoảng cách chữ (≤ 0,025em) trước khi giãn khoảng trắng.
   - Dòng cuối không đứng 1 chữ; đoạn căn giữa trên máy tính (.pw__desc) giữ dòng cuối căn giữa.
   - Mỗi dòng là một <span class="mj-l">; nội dung gốc được giữ lại để đổi VI ⇄ EN và đổi khổ màn hình.
   - Tiêu đề cùng loại dùng chung một cỡ (cỡ nhỏ nhất vừa 1 dòng trong nhóm).
   - Hero (#trang-chu) không xử lý, trừ đoạn giới thiệu bản điện thoại .hero-pos--m (ít dòng nhất, không tách chữ).
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LTV;
  if (!L || !L.fitJustify || !window.matchMedia) return;
  if (L.params && L.params.has('nomj')) return;

  const MQ = matchMedia('(max-width: 760px)');
  const SEL = [
    '.sec-head__foot .desc',
    '.about__block .desc',
    '.strength .desc',
    '.tl .desc',
    '.vcard__desc',
    '.vcard__proof-txt',
    '.skx-panel__desc',
    '.skill .desc',
    '.pstep .desc',
    '.pw__desc',
    '.quote__text',
    '.cta__main .desc',
    '.footer__brand .desc',
    '#heroLayers .hero-pos--m'
  ].join(', ');
  // Tiêu đề cùng vai trò → cùng một cỡ chữ (cỡ nhỏ nhất mà cả nhóm vẫn vừa 1 dòng)
  const GROUPS = [
    '.sec-head .h2, .cta__title',
    '.about__title',
    '.vcard__title, .vcard__vtitle',
    '.pw__title',
    '.pstep__title',
    '.skx-panel__title, .skill__title',
    '.tl__role',
    '#heroLayers .ch__title'   // 4 tiêu đề chương trong banner (không gồm tên "Lê Tuấn Việt")
  ];

  /* Số dòng của từng đoạn trên máy tính (1440px), theo mã băm nội dung — tools/m-justify-map.cjs */
  /*DESK*/const DESK = {"vi":{"lj00612j":2,"14xbicp3o":2,"19bm1cc2g":1,"xn1ac224":3,"bi4n1721":3,"73bmmw26":3,"iqdsfa32":2,"1jaerm12h":2,"lkboga35":2,"s33js42b":2,"1f3a8sx2x":2,"yzfo022w":1,"17ywoaa20":2,"1yd93r52p":2,"xoqa4x2p":2,"13njt4a33":2,"120v5hq2k":2,"1rjavmr2q":2,"1855y6y2m":2,"1u9yqu22m":2,"17agwau2x":2,"2sqxvq3l":2,"oscq5h4y":3,"1i8ghpv52":3,"1tb0rz458":3,"vxnzg05c":3,"xzo29d5a":3,"pdd8m853":3,"7z59ru57":3,"esg8n14e":3,"18cq4b84c":3,"18zq4224k":3,"1xmu43n3v":2,"1x4gx853p":2,"mg92fz58":3,"1q55xtd58":3,"122ow038":2,"1u10ool23":1,"1y4y38k2f":1,"172wexl2y":1,"rjyaol2v":1,"xivyzs2o":2,"1pszhsz24":2,"kmtsfd22":2,"9bxyi423":2,"2jfhe222":2,"1ov0gq45h":4,"1rogqxi64":5,"g67n5566":5,"1kar80v60":5,"6agnvy5a":4,"8ifbdw60":5,"6mp62861":5,"ynmpgo60":5,"1spnh06c":5,"oiy39q6e":5,"1rnzysx67":5,"1kh4dnh5z":5,"1gcxejg57":4,"d1k86d6g":5,"cv7yft5y":5,"mvl76i3e":2,"tjyjeh4p":3,"1aceoiu36":3},"en":{"mjy5hp2e":2,"vp73tk3b":2,"1k0p52722":1,"1stwgck22":3,"t2h1wi1x":3,"1waoviv24":3,"lagpem2y":2,"7j7or02w":2,"1c6w53a36":2,"ncoij82e":2,"162kah02x":2,"18yepht2z":20,"1qp8hcg1w":2,"19t6l9x2x":2,"18je8cl26":2,"yrms3h3b":2,"7zgqey2f":2,"99ww5m2x":2,"111vl272r":2,"17dvff22u":2,"1b45k282y":2,"1o1ov8z35":2,"1lgk9vf4r":3,"16dh0u45e":3,"1cpvxn155":3,"1kohbov4y":3,"1yqv23d55":3,"7y95lm5a":3,"1dz7dwf55":3,"1ytxh9m4a":3,"ewaj294k":3,"1dpz6fz4j":3,"13647f655":3,"wdxpbo42":2,"1ioxfra4t":3,"75imzs56":3,"1298h3u2v":2,"1xbx7rv1t":1,"1ja8hfk2b":1,"1mcevin31":1,"28ik982v":1,"u6lw1u2j":2,"u4if6i2c":2,"744wok24":2,"1rwi1my28":2,"ugeefs22":2,"wvzcld6b":5,"zgsq9w6e":5,"7zqmzw4z":4,"khb3rh64":5,"cumueq5a":4,"1p2f1d868":5,"1hyap846j":5,"54f1m463":5,"yezfpo6e":5,"2rbrbo64":5,"rdlx106a":5,"6ymtd768":5,"p8sd8l5f":4,"17p3zhr78":5,"50dsca6d":5,"1e5j0413h":2,"yzcmpc4y":3,"1ul9u1h3m":3}};/*/DESK*/

  const NBSP = '\u00A0';
  const norm = s => s.replace(/[\u00AD\u200B]/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  const hash = s => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + s.length.toString(36);
  };
  L.mjHash = t => hash(norm(t));

  const lang = () => (document.documentElement.lang || 'vi').slice(0, 2) === 'en' ? 'en' : 'vi';
  let fontEpoch = 0;
  let ctx = null;
  const measureCtx = () => ctx || (ctx = document.createElement('canvas').getContext('2d'));

  /* ---------------- Ngắt dòng ---------------- */
  // Giới hạn mặc định: khoảng cách chữ thêm [-0,03em, +0,025em]; khoảng trắng giãn tối đa +0,55em, co tối đa −0,06em.
  // Không có cách ngắt nào trong giới hạn (chữ EN dài trong khung hẹp) thì nới giới hạn và chạy lại.
  const STRICT = { trMin: -0.03, trMax: 0.025, eMax: 0.55, eMin: -0.06 };
  const RELAX = { trMin: -0.03, trMax: 0.04, eMax: 3, eMin: -0.06 };
  // Co (khoảng trắng hẹp, chữ sít) bị phạt nặng hơn giãn: chỉ dùng khi nhờ đó giữ được số dòng như máy tính
  const K_STRETCH = 0.25, K_SHRINK = 0.05, TR_REF = 0.02, W_TR = 30, W_TR_NEG = 70, LINE_PEN = 400, BIND_PEN = 80;
  const trCost = (tr, fs) => (tr < 0 ? W_TR_NEG : W_TR) * Math.pow(tr / fs / TR_REF, 2);

  // A: các chữ { w: rộng, ch: số ký tự, sw: rộng khoảng trắng đứng trước, bind: khoảng trắng trước là NBSP }
  function breakLines(A, W, fs, target, lim) {
    const m = A.length;
    const PW = new Float64Array(m + 1), PS = new Float64Array(m + 1), PC = new Float64Array(m + 1);
    for (let k = 0; k < m; k++) {
      PW[k + 1] = PW[k] + A[k].w;
      PS[k + 1] = PS[k] + A[k].sw;
      PC[k + 1] = PC[k] + A[k].ch;
    }
    const trMin = lim.trMin * fs, trMax = lim.trMax * fs;
    const memo = new Map();
    // dòng gồm các chữ [i, j)
    function line(i, j) {
      const key = i * 4096 + j;
      let r = memo.get(key);
      if (r) return r;
      const last = j === m;
      const nat = PW[j] - PW[i] + PS[j] - PS[i + 1];
      const C = PC[j] - PC[i] + (j - i - 1);
      const G = j - i - 1;
      const S = W - nat;
      let cost = 0, tr = 0, ws = 0;
      if (last) {
        if (S < 0) {
          tr = Math.max(S / C, trMin);
          const rest = S - C * tr;
          if (rest < 0) {
            if (!G || rest / G / fs < lim.eMin) cost = Infinity;
            else { ws = rest / G; cost = 100 * Math.pow(ws / fs / K_SHRINK, 2); }
          }
          cost += trCost(tr, fs);
        } else {
          const fill = nat / W;
          if (i > 0 && fill < 0.3) cost += (0.3 - fill) * 900;
          if (i > 0 && G === 0) cost += 350;          // dòng cuối chỉ 1 chữ
        }
      } else {
        const K = S >= 0 ? K_STRETCH : K_SHRINK;
        if (!G) {
          tr = S / C;
          cost = (tr < trMin || tr > trMax) ? Infinity : 250 + trCost(tr, fs);
        } else {
          const a = 100 / Math.pow(G * fs * K, 2), b = (S >= 0 ? W_TR : W_TR_NEG) / Math.pow(TR_REF * fs, 2);
          tr = Math.min(trMax, Math.max(trMin, a * C * S / (a * C * C + b)));
          const e = (S - C * tr) / G / fs;
          if (e > lim.eMax || e < lim.eMin) cost = Infinity;
          else {
            cost = 100 * Math.pow(e / K, 2) + trCost(tr, fs);
            if (e < 0) ws = e * fs;
          }
        }
        if (A[j].bind) cost += BIND_PEN;
      }
      r = { cost, tr, ws };
      memo.set(key, r);
      return r;
    }
    const maxN = Math.min(m, Math.ceil((PW[m] + PS[m]) / W) + 4);
    const INF = Infinity;
    const dp = [new Float64Array(m + 1).fill(INF)], from = [null];
    dp[0][0] = 0;
    const tooWide = (i, j) => PW[j] - PW[i] + PS[j] - PS[i + 1] - W > -lim.eMin * fs * (j - i) - trMin * (PC[j] - PC[i] + j - i) + 1;
    // n0 = số dòng ít nhất có thể. Thêm dòng so với n0: rẻ khi vẫn ≤ số dòng máy tính, đắt khi vượt
    let best = null, n0 = 0;
    for (let k = 1; k <= maxN; k++) {
      const cur = new Float64Array(m + 1).fill(INF), fr = new Int32Array(m + 1).fill(-1);
      const prev = dp[k - 1];
      for (let j = 1; j <= m; j++) {
        for (let i = j - 1; i >= 0; i--) {
          if (i < j - 1 && tooWide(i, j)) break;
          if (prev[i] === INF) continue;
          const c = prev[i] + line(i, j).cost;
          if (c < cur[j]) { cur[j] = c; fr[j] = i; }
        }
      }
      dp.push(cur); from.push(fr);
      if (cur[m] < INF) {
        if (!n0) n0 = k;
        const score = cur[m] + (k - n0) * (k <= target ? 40 : LINE_PEN);
        if (!best || score < best.score) best = { n: k, score };
        if (k >= n0 + 2) break;
      }
    }
    if (!best) return null;
    const breaks = [];
    for (let k = best.n, j = m; k > 0; k--) { const i = from[k][j]; breaks.unshift([i, j, line(i, j)]); j = i; }
    return breaks;
  }
  const layoutLines = (A, W, fs, target) => breakLines(A, W, fs, target, STRICT) || breakLines(A, W, fs, target, RELAX);

  /* ---------------- Đo & dựng dòng ---------------- */
  // Bộ nhớ đệm độ rộng chữ theo phông (xoá khi phông tải xong)
  let widthCache = new Map(), cacheEpoch = -1;
  function atomsOf(text, font, ls, wsBase) {
    const c = measureCtx();
    c.font = font;
    if (cacheEpoch !== fontEpoch) { widthCache = new Map(); cacheEpoch = fontEpoch; }
    let wc = widthCache.get(font);
    if (!wc) widthCache.set(font, wc = new Map());
    const wOf = t => { let w = wc.get(t); if (w === undefined) wc.set(t, w = c.measureText(t).width); return w; };
    const spW = wOf(' ') + ls + wsBase;
    const A = [];
    const parts = text.split(/( |\u00A0)/);
    let bind = false;
    for (const t of parts) {
      if (t === ' ' || t === NBSP) { bind = t === NBSP; continue; }
      if (!t) continue;
      A.push({ t, w: wOf(t) + t.length * ls, ch: t.length, sw: A.length ? spW : 0, bind: A.length ? bind : false });
      bind = false;
    }
    return A;
  }

  // Không ngắt giữa từ (người dùng không muốn dấu gạch nối): chỉ giữ phần dính chữ ngắn của en-justify
  // (NBSP sau "a/the/of…" và 2 chữ cuối EN), bỏ mọi điểm tách âm tiết.
  function hyphenate(text) {
    return (L.hyphText ? L.hyphText(text) : text).replace(/\u00AD/g, '');
  }

  function onRecords(records) {
    for (const r of records) {
      const el = r.target;
      if (!el.__mjOrig) continue;
      const fc = el.firstChild;
      if (fc && fc.nodeType === 1 && fc.classList.contains('mj-l')) continue;
      // nội dung bị script khác thay: lấy nội dung mới làm gốc
      el.__mjOrig = null;
      el.__mjKey = '';
      el.classList.remove('mj');
      if (MQ.matches) render(el);
    }
  }
  const mo = new MutationObserver(onRecords);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    if (!MQ.matches) return;
    const list = entries.filter(e => Math.abs((e.target.__mjW || 0) - e.contentRect.width) > 0.5).map(e => e.target);
    if (list.length) renderAll(list);
  }) : null;

  function translateOrig(el) {
    const lg = lang();
    if (el.__mjLang === lg) return;
    const T = window.LTV_I18N && window.LTV_I18N.t;
    // Đoạn có data-en (vd. mô tả Góc kiến thức do tools/kb dựng): i18n đổi cả đoạn theo data-en / data-vi, không qua từ điển
    const en = el.__mjOrig.length === 1 ? el.getAttribute('data-en') : null;
    el.__mjOrig.forEach(n => {
      if (n.nodeType !== 3) return;
      if (n.__vi === undefined) n.__vi = n.nodeValue;
      const next = en !== null ? (lg === 'en' ? en : el.getAttribute('data-vi') || n.__vi) : lg === 'en' && T ? T(n.__vi) : n.__vi;
      if (norm(next) !== norm(n.nodeValue)) n.nodeValue = next;
    });
    el.__mjLang = lg;
  }

  // Bản sao HTML của một đoạn đã dựng dòng (script khác chép innerHTML) chỉ còn các .mj-l: gộp lại thành chữ thuần
  const isLinesOnly = el => el.children.length > 0 && [...el.childNodes].every(n => n.nodeType === 1 && n.classList.contains('mj-l'));
  const flatten = el => { el.replaceChildren(document.createTextNode(norm(el.textContent))); el.classList.remove('mj'); };

  function restore(el) {
    if (!el.__mjOrig) { if (isLinesOnly(el)) flatten(el); return; }
    if (el.firstChild && el.firstChild.nodeType === 1 && el.firstChild.classList.contains('mj-l')) el.replaceChildren(...el.__mjOrig);
    el.classList.remove('mj');
    el.__mjKey = '';
  }

  // Dựng theo 3 lượt cho cả danh sách (ghi → đọc → ghi) để trình duyệt chỉ tính bố cục 1 lần, không giật khi đổi ngôn ngữ
  function prepare(el) {
    if (!el.isConnected) return false;
    if (!el.__mjOrig) {
      if (isLinesOnly(el)) flatten(el);
      if ([...el.childNodes].some(n => n.nodeType === 1)) return false;   // chỉ xử lý đoạn chữ thuần
      el.__mjOrig = [...el.childNodes];
      el.__mjLang = lang();
      mo.observe(el, { childList: true });
      if (ro) ro.observe(el);
    }
    translateOrig(el);
    return true;
  }

  function measure(el) {
    const cs = getComputedStyle(el);
    const W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    el.__mjW = el.getBoundingClientRect().width;
    if (W < 40) return null;
    const clean = norm(el.__mjOrig.map(n => n.nodeValue || '').join(''));
    if (!clean) return null;
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const lg = lang();
    const key = [lg, W.toFixed(1), font, ls, fontEpoch, clean].join('|');
    if (el.__mjKey === key) return null;
    return {
      el, W, clean, ls, font, lg, key,
      fs: parseFloat(cs.fontSize),
      wsBase: cs.wordSpacing === 'normal' ? 0 : parseFloat(cs.wordSpacing) || 0,
      center: cs.textAlignLast === 'center'
    };
  }

  function commit(job) {
    const { el, W, clean, ls, font, lg, key, fs, wsBase, center } = job;
    const A = atomsOf(hyphenate(clean), font, ls, wsBase);
    if (!A.length) return;
    const res = layoutLines(A, W - 0.75, fs, (DESK[lg] || {})[hash(clean)] || 0);
    if (!res) return;
    const lines = res.map(([i, j, info]) => {
      const s = document.createElement('span');
      s.className = 'mj-l' + (j === A.length ? ' mj-end' : '');
      let t = A[i].t;
      for (let k = i + 1; k < j; k++) t += (A[k].bind ? NBSP : ' ') + A[k].t;
      if (j < A.length) t += ' ';
      s.textContent = t;
      if (info.tr) s.style.letterSpacing = (ls + info.tr).toFixed(3) + 'px';
      if (info.ws) s.style.wordSpacing = (wsBase + info.ws - 0.2).toFixed(3) + 'px';
      if (j === A.length && center) s.style.textAlign = 'center';
      s.__c = t.length;
      return s;
    });
    el.replaceChildren(...lines);
    el.classList.add('mj');
    el.__mjKey = key;
    pending.push(el);
  }

  function renderAll(list) {
    const ok = list.filter(prepare);
    const jobs = ok.map(measure).filter(Boolean);
    jobs.forEach(commit);
    // bỏ thay đổi do chính commit gây ra, nhưng vẫn xử lý đoạn vừa bị script khác thay nội dung
    // (vd. i18n đổi data-en khi bấm EN/VI) — nếu bỏ luôn, đoạn đó bị dựng lại từ chữ cũ
    onRecords(mo.takeRecords());
    verify();
  }
  const render = el => renderAll([el]);

  // Kiểm tra sau khi dựng: dòng nào lố khung (sai số đo) thì siết khoảng cách chữ của riêng dòng đó
  let pending = [];
  function verify() {
    const list = pending; pending = [];
    const fixes = [];
    list.forEach(el => {
      for (const s of el.children) {
        const over = s.scrollWidth - s.clientWidth;
        if (over > 0.5) fixes.push([s, over]);
      }
    });
    fixes.forEach(([s, over]) => {
      const cur = parseFloat(getComputedStyle(s).letterSpacing) || 0;
      s.style.letterSpacing = (cur - (over + 0.4) / Math.max(1, s.__c)).toFixed(3) + 'px';
    });
  }

  function run(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const list = [...scope.querySelectorAll(SEL)];
    if (scope.nodeType === 1 && scope.matches(SEL)) list.unshift(scope);
    renderAll(list.filter(el => !el.closest('#trang-chu') || el.classList.contains('hero-pos--m')));
  }

  // Cỡ chung của nhóm = cỡ lớn nhất mà tiêu đề dài nhất (kể cả tiêu đề đang ẩn, đo bằng canvas) vẫn vừa 1 dòng,
  // không vượt cỡ gốc trong CSS. Ghi vào biến --mj-gN; css/m-type.css áp bằng !important khi html có lớp mj-gN
  // (các script tự co từng tiêu đề như fitOne / values.js vẫn chạy nhưng không đổi được cỡ).
  const textOf = el => {
    let s = '';
    (function walk(n) { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.nodeValue; else if (c.tagName === 'BR') s += ' '; else if (c.nodeType === 1) walk(c); } })(el);
    return norm(s);
  };
  let groupQ = 0;
  function groupFit() {
    const root = document.documentElement;
    const on = GROUPS.map((sel, gi) => root.classList.contains('mj-g' + gi));
    GROUPS.forEach((sel, gi) => root.classList.remove('mj-g' + gi));
    const c = measureCtx();
    const res = GROUPS.map(sel => {
      const parts = sel.split(',').map(s => s.trim());
      const els = [...document.querySelectorAll(sel)].filter(el => sel.includes('#heroLayers') || !el.closest('#trang-chu'));
      if (els.length < 2) return 0;
      const widthOf = {};
      const info = els.map(el => {
        const part = parts.find(p => el.matches(p));
        const prev = el.style.fontSize;
        el.style.fontSize = '';
        const cs = getComputedStyle(el);
        const base = parseFloat(cs.fontSize);
        const W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        el.style.fontSize = prev;
        if (W > 20) widthOf[part] = Math.max(widthOf[part] || 0, W);
        return { el, part, base, W, cs };
      });
      let size = Infinity;
      // Banner: mọi tiêu đề chương cũng nằm trọn 1 dòng (người dùng 2026-11-02), cỡ chung theo tiêu đề dài nhất
      info.forEach(({ el, part, base, W, cs }) => {
        const w = W > 20 ? W : widthOf[part];
        if (!w) return;
        c.font = `${cs.fontStyle} ${cs.fontWeight} 20px ${cs.fontFamily}`;
        const lsEm = cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0) / base;
        const per20 = t => c.measureText(t).width / 20 + t.length * lsEm;
        size = Math.min(size, base, w * 0.985 / per20(textOf(el)));
      });
      return isFinite(size) ? Math.floor(size * 10) / 10 : 0;
    });
    res.forEach((s, gi) => {
      if (s) { root.style.setProperty('--mj-g' + gi, s + 'px'); root.classList.add('mj-g' + gi); }
      else if (on[gi]) root.classList.add('mj-g' + gi);
    });
  }
  const scheduleGroup = () => { if (!MQ.matches || groupQ) return; groupQ = requestAnimationFrame(() => { groupQ = 0; groupFit(); }); };

  const origFJ = L.fitJustify;
  L.fitJustify = function (root) {
    const r = origFJ.apply(this, arguments);
    if (MQ.matches) run(root || document);
    return r;
  };
  const origFit = L.fit;
  if (origFit) {
    L.fit = function () {
      const r = origFit.apply(this, arguments);
      scheduleGroup();
      return r;
    };
  }
  if (L.onResize) L.onResize(scheduleGroup);

  function all() {
    if (MQ.matches) { run(document); scheduleGroup(); }
  }
  MQ.addEventListener ? MQ.addEventListener('change', () => {
    if (MQ.matches) { L.fit ? L.fit() : all(); return; }
    document.querySelectorAll('.mj').forEach(restore);
    GROUPS.forEach((sel, gi) => document.documentElement.classList.remove('mj-g' + gi));
    origFJ(document);
  }) : 0;
  if (document.fonts) {
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { fontEpoch++; all(); });
    (document.fonts.ready || Promise.resolve()).then(() => { fontEpoch++; all(); });
  } else {
    addEventListener('load', all);
  }
  new MutationObserver(() => all()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  L.mjRun = all;
  L.mjDesk = DESK;
  // gỡ lỗi / đo: số dòng của một đoạn ở bề rộng W (px) với cỡ chữ hiện tại của nó
  L.mjLines = (el, W) => {
    const cs = getComputedStyle(el);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
    const clean = norm((el.__mjOrig || [...el.childNodes]).map(n => n.nodeValue || n.textContent || '').join(''));
    const A = atomsOf(hyphenate(clean), `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, ls, 0);
    const r = layoutLines(A, W - 0.75, parseFloat(cs.fontSize), (DESK[lang()] || {})[hash(clean)] || 0);
    return r ? r.length : 0;
  };
})();
