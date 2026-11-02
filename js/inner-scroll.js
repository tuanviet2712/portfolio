/* ==========================================================================
   Android & Mobile Viewport Stabilizer
   --------------------------------------------------------------------------
   Khoá chiều cao khung nhìn ổn định (--svh / --vh) theo bề ngang màn hình để
   thanh địa chỉ trình duyệt di động ẩn/hiện không làm nhảy bố cục hay kích hoạt
   đo lại canvas/sticky giữa lúc đang vuốt cuộn.
   ========================================================================== */
(function () {
  'use strict';
  if (/[?&]diag(?:=|&|$)/.test(window.location.search)) {
    var diag = function () {
      var box = document.createElement('pre');
      box.style.cssText = 'position:fixed;left:6px;right:6px;bottom:6px;z-index:2147483647;margin:0;padding:8px 10px;font:11px/1.35 monospace;white-space:pre-wrap;word-break:break-all;color:#fff;background:rgba(0,0,0,.78);border-radius:8px;pointer-events:none';
      document.body.appendChild(box);
      var minH = 1e9, maxH = 0, changes = 0, lastH = window.innerHeight;
      var heroInfo = function () {
        try {
          var s = JSON.parse(window.LTV.heroDebug.state());
          var n = s[s.set] || {};
          return '\nKHUNG VIDEO ' + Math.round(s.curT * 10) / 10 + ' | tien do ' + Math.round(s.curP * 1000) / 10 + '% | bo anh ' + s.set + ' (da tai ' + n.loaded + ', da giai ma ' + n.decoded + ')';
        } catch (e) { return ''; }
      };
      var ver = function (k) { var s = document.querySelector('script[src*="' + k + '"]'); return s ? (s.getAttribute('src').split('v=')[1] || '-') : 'none'; };
      setInterval(function () {
        var ih = window.innerHeight, st = document.querySelector('.hero__sticky');
        if (ih !== lastH) { changes++; lastH = ih; }
        minH = Math.min(minH, ih); maxH = Math.max(maxH, ih);
        box.textContent = 'UA: ' + navigator.userAgent +
          '\ninner-scroll: ' + document.documentElement.classList.contains('inner-scroll') + ' | hero.min ' + ver('hero.min.js') + ' | inner-scroll ' + ver('inner-scroll.js') +
          '\ninnerHeight ' + ih + ' (min ' + minH + ', max ' + maxH + ', doi ' + changes + ' lan) | visualViewport ' + (window.visualViewport ? Math.round(window.visualViewport.height) : '-') +
          ' | screen ' + screen.width + 'x' + screen.height + ' @' + window.devicePixelRatio +
          '\nhero --hh ' + (document.getElementById('trang-chu') ? document.getElementById('trang-chu').style.getPropertyValue('--hh') : '-') + ' | khung hero ' + (st ? Math.round(st.getBoundingClientRect().height) : '-') +
          ' | scrollY ' + Math.round(window.scrollY) + heroInfo();
      }, 250);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', diag); else diag();
  }
  try {
    var w = window, d = document, de = d.documentElement, q = w.location.search;
    var lastW = 0;
    var syncStableViewport = function () {
      var cw = w.innerWidth || de.clientWidth || 0;
      if (Math.abs(cw - lastW) > 2) {
        lastW = cw;
        var ih = w.innerHeight || de.clientHeight || 0;
        if (ih > 0) {
          de.style.setProperty('--svh', ih + 'px');
          de.style.setProperty('--vh', (ih * 0.01).toFixed(2) + 'px');
        }
      }
    };
    syncStableViewport();
    w.addEventListener('resize', syncStableViewport, { passive: true });
    w.addEventListener('orientationchange', function () {
      lastW = 0;
      setTimeout(syncStableViewport, 120);
    }, { passive: true });

    if (/[?&]inner=0(?:&|$)/.test(q)) return;
    var forced = /[?&]inner=1(?:&|$)/.test(q);
    if (!forced) return;
  } catch (e) { /* giữ nguyên cách cuộn thường */ }
})();
