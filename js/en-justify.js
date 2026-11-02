/* ==========================================================================
   EN-JUSTIFY — Căn đều 2 bên chuẩn in ấn (Knuth–Plass + tách âm tiết tự động)
   Áp dụng cho toàn bộ đoạn văn căn đều (cả EN và các thuật ngữ tiếng Anh dài trong VI)
   để tuyệt đối không bao giờ xảy ra hiện tượng dãn cách từ quá xa trên điện thoại.
   ========================================================================== */
(function () {
  'use strict';

  var lang = document.documentElement.getAttribute('lang') || '';
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) lang = q;
  } catch (e) {}

  var SHY = '\u00AD';
  var NBSP = '\u00A0';

  var SELECTORS = [
    '.sec-head__foot .desc',
    '.about__block .desc',
    '.strength .desc',
    '.tl .desc',
    '.vrow__content .desc',
    '.vrow__proof p',
    '.vpanel .desc',
    '.vpanel .vrow__proof p',
    '.vcard__desc',
    '.vcard__proof-txt',
    '.skill .desc',
    '.skx-panel__desc',
    '.pstep .desc',
    '.pfx-card__desc',
    '.pwall__desc',
    '.pw__desc',
    '.quote__text',
    '.kb-topic__desc',
    '.kbh-pillar__desc',
    '.ch__text',
    '.hero-pos',
    '.tl__desc',
    '.checks span',
    '.cta__main .desc',
    '.footer__brand .desc',
    '.legal__body p',
    '.legal__body li',
    '.legal__callout'
  ].join(', ');

  var SHORT = /^(?:a|an|as|at|be|by|do|go|he|if|in|is|it|me|my|no|of|on|or|so|to|up|us|we|and|are|but|can|for|had|has|her|him|his|how|its|let|may|new|not|now|old|one|our|out|own|put|run|say|see|she|the|too|two|use|via|was|way|who|why|yet|you|from|into|over|that|them|then|they|this|unto|upon|with|your)$/i;

  var SUFFIXES = [
    'izations', 'isation', 'ization', 'ational', 'fulness', 'ousness', 'iveness',
    'ability', 'ibility', 'istries', 'ologies', 'graphic', 'metrics',
    'ments', 'nesses', 'ations', 'itions', 'ances', 'ences', 'ables', 'ibles',
    'ings', 'tion', 'sion', 'ment', 'ness', 'able', 'ible', 'ally', 'fuls',
    'less', 'ship', 'ward', 'wise', 'ious', 'eous', 'ical', 'ance', 'ence',
    'ized', 'ised', 'izer', 'iser', 'izes', 'ises', 'ling', 'ings',
    'ing', 'ers', 'est', 'ful', 'ism', 'ist', 'ity', 'ive', 'ize', 'ise',
    'ous', 'age', 'ant', 'ent', 'ary', 'ery', 'ory', 'ate', 'ure', 'dom', 'ly'
  ];

  var PREFIXES = [
    'counter', 'inter', 'multi', 'super', 'trans', 'under', 'cross', 'hyper', 'micro', 'macro', 'infra', 'omni',
    'over', 'post', 'anti', 'auto', 'meta', 'para', 'self', 'semi', 'tele', 'thermo',
    'non', 'pre', 'pro', 'sub', 'dis', 'mis', 'out', 'uni', 'tri', 'bi', 'co', 'de', 're', 'un', 'in', 'im', 'il', 'ir', 'ex'
  ];

  function isVowel(c) {
    return 'aeiouyAEIOUY'.indexOf(c) !== -1;
  }

  function hyphenateCore(w) {
    if (w.length < 6) return w;
    var n = w.length;
    var pts = {};
    for (var i = 1; i < n - 2; i++) {
      var c0 = w[i - 1], c1 = w[i], c2 = w[i + 1], c3 = w[i + 2] || '';
      if (isVowel(c0) && !isVowel(c1) && !isVowel(c2) && isVowel(c3)) {
        var pair = (c1 + c2).toLowerCase();
        if (!/^(?:ch|sh|th|ph|wh|gh|ck|ng|qu|st|sp|sc|sk|sl|sm|sn|sw|tr|dr|pr|br|cr|fr|gr|pl|bl|cl|fl|gl|kl|tw|dw)$/.test(pair)) {
          pts[i + 1] = true;
        } else {
          pts[i] = true;
        }
      }
      if (isVowel(c0) && !isVowel(c1) && isVowel(c2)) {
        pts[i] = true;
      }
    }
    var out = '';
    var last = 0;
    for (var k = 2; k <= n - 3; k++) {
      if (pts[k] && k - last >= 2 && n - k >= 3) {
        out += w.slice(last, k) + SHY;
        last = k;
      }
    }
    out += w.slice(last);
    return out;
  }

  function hyphenateWord(word) {
    var minLen = (lang === 'en') ? 6 : 8;
    if (word.length < minLen || word.indexOf(SHY) !== -1) return word;
    if (/^[A-Z0-9]{2,}$/.test(word)) return word;
    if (/\d/.test(word) || /[@/:.]/.test(word)) return word;

    var m = word.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
    if (!m) return word;
    var lead = m[1], core = m[2], trail = m[3];
    if (core.length < minLen) return word;

    var lower = core.toLowerCase();
    var pref = '';
    for (var p = 0; p < PREFIXES.length; p++) {
      var pr = PREFIXES[p];
      if (lower.indexOf(pr) === 0 && core.length - pr.length >= 4) {
        pref = core.slice(0, pr.length);
        core = core.slice(pr.length);
        lower = core.toLowerCase();
        break;
      }
    }

    var suff = '';
    for (var s = 0; s < SUFFIXES.length; s++) {
      var sf = SUFFIXES[s];
      if (lower.length - sf.length >= 4 && lower.slice(-sf.length) === sf) {
        suff = core.slice(core.length - sf.length);
        core = core.slice(0, core.length - sf.length);
        break;
      }
    }

    var mid = core.length >= 6 ? hyphenateCore(core) : core;
    var joined = (pref ? pref + SHY : '') + mid + (suff ? SHY + suff : '');
    return lead + joined + trail;
  }

  function processText(str) {
    if (!str || !str.trim()) return str;
    var s = str.replace(/\u00AD/g, '').replace(/\u00A0/g, ' ');
    if (lang === 'en') {
      s = s.replace(/\b([A-Za-z]{1,4})\s+([A-Za-z]+)\b/g, function (full, w1, w2) {
        if (SHORT.test(w1)) return w1 + NBSP + w2;
        return full;
      });
      s = s.replace(/\s+(\S+\s+\S+)\s*$/, function (m, tail) {
        var parts = tail.split(/\s+/);
        if (parts.length === 2 && (parts[0].length + parts[1].length) <= 16) {
          return ' ' + parts[0] + NBSP + parts[1];
        }
        return m;
      });
    }
    s = s.replace(/[A-Za-z]{6,}/g, function (w) {
      return hyphenateWord(w);
    });
    return s;
  }

  function enhanceElement(el) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentNode;
      if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'CODE' || p.classList.contains('u'))) continue;
      nodes.push(n);
    }
    for (var i = 0; i < nodes.length; i++) {
      var orig = nodes[i].nodeValue;
      var next = processText(orig);
      if (next !== orig) nodes[i].nodeValue = next;
    }
  }

  function runAll(root) {
    lang = document.documentElement.dataset.lang || document.documentElement.getAttribute('lang') || 'vi';
    var scope = root && root.querySelectorAll ? root : document;
    var list = scope.querySelectorAll(SELECTORS);
    for (var i = 0; i < list.length; i++) {
      enhanceElement(list[i]);
    }
    // Cả trang: gộp với các lần căn lại khác (js/fx.js L.fitSoon); một phần tử: căn ngay
    if (scope === document && window.LTV && window.LTV.fitSoon) {
      window.LTV.fitSoon();
    } else if (window.LTV && window.LTV.fitJustify) {
      window.LTV.fitJustify(scope);
    }
  }

  window.LTV = window.LTV || {};
  window.LTV.enJustify = runAll;
  // js/m-justify.js (điện thoại) dùng lại bộ tách âm tiết này khi tự ngắt dòng
  window.LTV.hyphText = function (s) {
    lang = document.documentElement.dataset.lang || document.documentElement.getAttribute('lang') || 'vi';
    return processText(s);
  };

  function boot() {
    setTimeout(function () { runAll(document); }, 0);
    setTimeout(function () { runAll(document); }, 260);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', function () {
    runAll(document);
  });
})();
