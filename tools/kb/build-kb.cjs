#!/usr/bin/env node
/* ==========================================================================
   GÓC KIẾN THỨC — trình tạo trang tĩnh (Node 18+, không cần cài thư viện)

   Chạy:   node tools/kb/build-kb.cjs          (hoặc bấm TAO-GOC-KIEN-THUC.bat)
   Đọc:    tools/kb/site.cjs                   cấu hình, tác giả, 4 chủ đề
           tools/kb/articles/*.html            mỗi file một bài (metadata JSON + thân bài)
   Ghi:    goc-kien-thuc/index.html            trang tổng
           goc-kien-thuc/<chủ-đề>/index.html   4 trang chủ đề
           goc-kien-thuc/<chủ-đề>/<bài>/index.html
           goc-kien-thuc/feed.xml              RSS
           goc-kien-thuc/search.json           chỉ mục cho ô tìm kiếm (js/kb-search.js)
           sitemap.xml                         vùng <!-- KB:SITEMAP -->
           index.html                          vùng <!-- KB:DROPDOWN -->, <!-- KB:MENU -->, <!-- KB:SECTION -->
   Cuối cùng in báo cáo SEO của từng bài theo checklist trong tài liệu SEO.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = require('./site.cjs');
const { LEGAL_PAGES } = require('./legal-data.cjs');
const ORIGIN = SITE.origin;
const HUB = SITE.hub.path;
const A = SITE.author;
const ART_DIR = path.join(__dirname, 'articles');
const WPM = 230;                                    // tốc độ đọc (từ/phút)
const FEATURED_MAX = 4;                             // "Bài viết nổi bật" trên trang chủ đề: tối đa 4 bài
const LATEST_PER_PAGE = 9;                          // "Bài viết mới nhất": tối đa 9 bài/trang, còn lại sang trang sau (kiểu SEODO)

/* ----------------------------------------------------------------------------
   Tiện ích
---------------------------------------------------------------------------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = s => String(s).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = html => decode(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const countWords = html => (plain(html).match(/\S+/g) || []).length;
const slugify = s => plain(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const vnDate = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const day = iso => String(iso).slice(0, 10);
const abs = p => ORIGIN + '/' + String(p).replace(/^\//, '');
const relRoot = pagePath => '../'.repeat(pagePath.split('/').filter(Boolean).length);
const json = obj => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
const plural = (n, one, many) => n === 1 ? one : many;

const hubPath = `${HUB}/`;
const pillarPath = p => `${HUB}/${p.slug}/`;
const pillarPageN = (p, n) => n <= 1 ? pillarPath(p) : `${HUB}/${p.slug}/trang/${n}/`;   // phân trang "Bài viết mới nhất"
// urlDir: thư mục trên URL khi khác chuyên mục (bài của chuyên mục đã gộp giữ URL cũ, xem site.cjs › retiredPillars)
const articlePath = a => `${HUB}/${a.urlDir || a.pillar}/${a.slug}/`;
const pillarBySlug = slug => SITE.pillars.find(p => p.slug === slug);
const RETIRED = SITE.retiredPillars || [];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const enDate = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${MONTHS[+m - 1]} ${+d}, ${y}`; };
const PAGES = [];                                   // mọi trang đã tạo, để kiểm tra title/meta ở báo cáo cuối

/* Ảnh bài viết trên R2 (giai đoạn 2 của kế hoạch mở rộng; KHÔNG bài nào đổi cho tới khi có bài khai "img_base").
   meta "img_base": "kb/<slug>/<rev>/" (rev: 6–12 ký tự a-z0-9). Có img_base thì MỌI ảnh của bài lấy từ
   IMG_ORIGIN + img_base + đúng tên tệp đứng sau "assets/kb/" như cách cũ:
     ảnh bìa  assets/kb/<cover.base>-320.webp  → https://img.letuanviet.com/kb/<slug>/<rev>/<cover.base>-320.webp
     (cùng cách cho .webp, -640.webp, -1600.webp, .jpg)
     hình     /assets/kb/<slug>/01-<slug>.webp → https://img.letuanviet.com/kb/<slug>/<rev>/<slug>/01-<slug>.webp
   Không có img_base: giữ nguyên assets/kb. Trang nào có ảnh R2 thì thêm preconnect tới IMG_ORIGIN (page()). */
const IMG_ORIGIN = 'https://img.letuanviet.com';
const kbImg = (a, name, rel = '') => a.img_base ? `${IMG_ORIGIN}/${a.img_base}${name}` : `${rel}assets/kb/${name}`;
const kbImgAbs = (a, name) => a.img_base ? `${IMG_ORIGIN}/${a.img_base}${name}` : abs(`assets/kb/${name}`);

function writeFile(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}
// Thư mục chỉ chứa tệp do bản dựng sinh ra (phần lưu trữ, mảnh chỉ mục): xoá tệp không còn dùng, thư mục rỗng thì xoá luôn
function sweepDir(rel, keepNames) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && !keepNames.has(d.name)).forEach(d => {
    fs.rmSync(path.join(dir, d.name), { force: true });
    console.log(`  – Đã xoá tệp cũ ${path.relative(ROOT, path.join(dir, d.name))}`);
  });
  if (!fs.readdirSync(dir).length) fs.rmSync(dir, { recursive: true, force: true });
}

/* ----------------------------------------------------------------------------
   Đọc bài viết
---------------------------------------------------------------------------- */
function loadArticles() {
  if (!fs.existsSync(ART_DIR)) return [];
  return fs.readdirSync(ART_DIR)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'))
    .map(f => {
      const src = fs.readFileSync(path.join(ART_DIR, f), 'utf8');
      const m = src.match(/<script type="application\/json" data-meta>([\s\S]*?)<\/script>/);
      if (!m) throw new Error(`${f}: thiếu khối <script type="application/json" data-meta>`);
      let meta;
      try { meta = JSON.parse(m[1]); } catch (e) { throw new Error(`${f}: metadata JSON lỗi: ${e.message}`); }
      const need = ['slug', 'pillar', 'title', 'description', 'sapo', 'published'];
      need.forEach(k => { if (!meta[k]) throw new Error(`${f}: thiếu "${k}"`); });
      // Chuyên mục đã gộp: bài vẫn khai slug cũ thì xếp vào chuyên mục mới; bài thuộc keepUrls (hoặc khai slug cũ) giữ URL thư mục cũ
      if (meta.urlDir !== undefined) throw new Error(`${f}: không khai "urlDir" trong bài, URL cũ được giữ qua site.cjs › retiredPillars.keepUrls`);
      const oldDir = RETIRED.find(r => r.slug === meta.pillar);
      if (oldDir) {
        meta.pillar = oldDir.mergedInto;
        if (!oldDir.keepUrls.includes(meta.slug)) console.warn(`  ! ${f}: còn khai chuyên mục cũ "${oldDir.slug}", đã xếp vào "${oldDir.mergedInto}", URL giữ thư mục cũ. Thêm slug vào site.cjs › retiredPillars.keepUrls hoặc đổi "pillar" trong bài.`);
        meta.urlDir = oldDir.slug;
      }
      const keepDir = RETIRED.find(r => r.keepUrls.includes(meta.slug));
      if (keepDir) meta.urlDir = keepDir.slug;
      if (!pillarBySlug(meta.pillar)) throw new Error(`${f}: chủ đề "${meta.pillar}" không có trong site.cjs`);
      if (meta.img_base !== undefined && !(typeof meta.img_base === 'string' && new RegExp(`^kb/${meta.slug}/[a-z0-9]{6,12}/$`).test(meta.img_base)))
        throw new Error(`${f}: "img_base" phải có dạng "kb/${meta.slug}/<6–12 ký tự a-z0-9>/"`);
      meta.modified = meta.modified || meta.published;
      meta.source = f;
      meta.raw = src.slice(m.index + m[0].length);
      // Bài xuất từ công cụ khác đôi khi bọc cả file trong <article>…</article>: thẻ mở nằm trước khối metadata (bị bỏ),
      // thẻ đóng còn lại trong thân bài sẽ đóng sớm khung bài viết và đẩy cột phải xuống cuối trang.
      const opens = (meta.raw.match(/<article[\s>]/gi) || []).length;
      const closes = (meta.raw.match(/<\/article>/gi) || []).length;
      if (closes > opens) meta.raw = meta.raw.replace(/(\s*<\/article>)+\s*$/i, '\n');
      // Bỏ nhãn nhỏ đầu khung tình huống ("Ví dụ biên tập…", "Hồ sơ dữ kiện…"): trên điện thoại nhãn dài bị tràn, đè chữ
      meta.raw = meta.raw.replace(/[ \t]*<p class="kb-case__k">[\s\S]*?<\/p>[ \t]*\r?\n?/g, '');
      return meta;
    })
    .sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

/* ----------------------------------------------------------------------------
   Icon (bộ SVG sprite dùng trên các trang Góc kiến thức)
---------------------------------------------------------------------------- */
const ICONS = {
  'i-arrow': '<symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m0 0-7-7m7 7-7 7"/></symbol>',
  'i-arrow-up-right': '<symbol id="i-arrow-up-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7m0 0H7m10 0v10"/></symbol>',
  'i-up': '<symbol id="i-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0-7 7m7-7 7 7"/></symbol>',
  'i-chev': '<symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></symbol>',
  'i-chev-r': '<symbol id="i-chev-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></symbol>',
  'i-search': '<symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></symbol>',
  'i-download': '<symbol id="i-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v1.2c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 21 17.88 21 16.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V15m14-5-5 5m0 0-5-5m5 5V3"/></symbol>',
  'i-mail': '<symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 8.165 5.715c.661.463.992.695 1.351.784a2 2 0 0 0 .968 0c.36-.09.69-.32 1.351-.784L22 7M6.8 20h10.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C22 17.72 22 16.88 22 15.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C19.72 4 18.88 4 17.2 4H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 6.28 2 7.12 2 8.8v6.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 20 5.12 20 6.8 20Z"/></symbol>',
  'i-phone': '<symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.38 8.853a14.603 14.603 0 0 0 2.847 4.01 14.603 14.603 0 0 0 4.01 2.847c.124.06.187.09.265.112.28.082.625.023.862-.147.067-.048.124-.105.239-.219.35-.35.524-.524.7-.639a2 2 0 0 1 2.18 0c.176.115.35.29.7.64l.195.194c.532.531.797.797.942 1.082a2 2 0 0 1 0 1.806c-.145.285-.41.551-.942 1.082l-.157.158c-.53.53-.795.794-1.155.997-.4.224-1.02.386-1.478.384-.413-.001-.695-.081-1.26-.241a19.038 19.038 0 0 1-8.283-4.874A19.039 19.039 0 0 1 3.17 7.761c-.16-.564-.24-.846-.241-1.26a3.377 3.377 0 0 1 .384-1.477c.202-.36.467-.625.997-1.155l.157-.158c.532-.53.798-.797 1.083-.941a2 2 0 0 1 1.805 0c.286.144.551.41 1.083.942l.195.194c.35.35.524.525.638.7a2 2 0 0 1 0 2.18c-.114.177-.289.352-.638.701a2.037 2.037 0 0 0-.22.238 1.05 1.05 0 0 0-.147.862c.023.08.053.142.113.266Z"/></symbol>',
  'i-zalo': '<symbol id="i-zalo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-11.555 7.934c-.174-.066-.26-.1-.33-.116a.901.901 0 0 0-.186-.024 2.314 2.314 0 0 0-.303.021l-5.12.53c-.49.05-.733.075-.877-.013a.5.5 0 0 1-.234-.35c-.026-.166.09-.382.324-.814l1.636-3.027c.134-.25.202-.374.232-.494a.899.899 0 0 0 .028-.326c-.01-.123-.064-.283-.172-.604A8.5 8.5 0 1 1 21 11.5Z"/></symbol>',
  'i-pin': '<symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M12 22c4-4 8-7.582 8-12a8 8 0 1 0-16 0c0 4.418 4 8 8 12Z"/></symbol>',
  'i-clock': '<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2m6-2c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Z"/></symbol>',
  'i-check': '<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></symbol>',
  'i-verified': '<symbol id="i-verified" viewBox="0 0 24 24" fill="currentColor"><path d="M16.901 3.099a2.03 2.03 0 0 0 1.1 1.1l1.744.723a2.033 2.033 0 0 1 1.1 2.656l-.722 1.744a2.03 2.03 0 0 0 0 1.556l.722 1.744a2.033 2.033 0 0 1-1.1 2.656L19 17.901A2.033 2.033 0 0 0 17.9 19l-.723 1.745a2.032 2.032 0 0 1-2.656 1.1l-1.744-.722a2.032 2.032 0 0 0-1.555 0l-1.745.723a2.033 2.033 0 0 1-2.654-1.1L6.1 19.001A2.033 2.033 0 0 0 5 17.9l-1.744-.723a2.033 2.033 0 0 1-1.1-2.654l.721-1.744a2.033 2.033 0 0 0 0-1.556l-.722-1.746a2.033 2.033 0 0 1 1.1-2.657L5 6.098A2.03 2.03 0 0 0 6.1 5l.723-1.745a2.033 2.033 0 0 1 2.656-1.1l1.744.722a2.033 2.033 0 0 0 1.555-.001l1.746-.72a2.032 2.032 0 0 1 2.655 1.1l.723 1.746v-.003Z"/><path d="m9 12 2 2 4.5-4.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>',
  'i-spark': '<symbol id="i-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 22v-5m0-10V2M2 4.5h5m-5 15h5M13 3l-1.734 4.509c-.282.733-.423 1.1-.643 1.408a3 3 0 0 1-.706.707c-.308.219-.675.36-1.408.642L4 12l4.509 1.734c.733.282 1.1.423 1.408.643.273.194.512.433.707.706.219.308.36.675.642 1.408L13 21l1.734-4.509c.282-.733.423-1.1.643-1.408.194-.273.433-.512.706-.707.308-.219.675-.36 1.408-.642L22 12l-4.509-1.734c-.733-.282-1.1-.423-1.408-.642a3 3 0 0 1-.706-.707c-.22-.308-.36-.675-.643-1.408L13 3Z"/></symbol>',
  'i-target': '<symbol id="i-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8V5l3-3 1 2 2 1-3 3h-3Zm0 0-4 4m10 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m5 10a5 5 0 1 1-5-5"/></symbol>',
  'i-kanban': '<symbol id="i-kanban" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v18m6-18v18M7.8 3h8.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C21 5.28 21 6.12 21 7.8v8.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C18.72 21 17.88 21 16.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3Z"/></symbol>',
  'i-kb-mkt': '<symbol id="i-kb-mkt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8V5l3-3 1 2 2 1-3 3h-3Zm0 0-4 4m10 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m5 10a5 5 0 1 1-5-5"/></symbol>',
  'i-kb-ai': '<symbol id="i-kb-ai" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v2m6-2v2M9 20v2m6-2v2m5-13h2m-2 5h2M2 9h2m-2 5h2m4.8 6h6.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C20 17.72 20 16.88 20 15.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C17.72 4 16.88 4 15.2 4H8.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C4 6.28 4 7.12 4 8.8v6.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C6.28 20 7.12 20 8.8 20Zm1.8-5h2.8c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C15 14.24 15 13.96 15 13.4v-2.8c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C14.24 9 13.96 9 13.4 9h-2.8c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C9 9.76 9 10.04 9 10.6v2.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C9.76 15 10.04 15 10.6 15Z"/></symbol>',
  'i-kb-mgmt': '<symbol id="i-kb-mgmt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h12m0 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-6 8h12M9 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></symbol>',
  'i-kb-case': '<symbol id="i-kb-case" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 15v2m4-6v6m4-10v10m-8.2 4h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 18.72 21 17.88 21 16.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 3 17.88 3 16.2 3H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 5.28 3 6.12 3 7.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 21 6.12 21 7.8 21Z"/></symbol>',
  'i-flag': '<symbol id="i-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1m0 18V2"/></symbol>',
  'i-layers': '<symbol id="i-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m2 12 9.642 4.821c.131.066.197.099.266.111.06.012.123.012.184 0 .069-.012.135-.045.266-.11L22 12M2 17l9.642 4.821c.131.066.197.099.266.111.06.012.123.012.184 0 .069-.012.135-.045.266-.11L22 17M2 7l9.642-4.821c.131-.066.197-.098.266-.111a.5.5 0 0 1 .184 0c.069.013.135.045.266.11L22 7l-9.642 4.821a1.028 1.028 0 0 1-.266.111.501.501 0 0 1-.184 0c-.069-.012-.135-.045-.266-.11L2 7Z"/></symbol>',
  'i-list': '<symbol id="i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H9m12-6H9m12 12H9m-4-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></symbol>',
  'i-link': '<symbol id="i-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12.708 18.364-1.415 1.414a5 5 0 1 1-7.07-7.07l1.413-1.415m12.728 1.414 1.415-1.414a5 5 0 0 0-7.071-7.071l-1.415 1.414M8.5 15.5l7-7"/></symbol>',
  'i-facebook': '<symbol id="i-facebook" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21z"/></symbol>',
  'i-linkedin': '<symbol id="i-linkedin" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M3 9.75h4v11H3zm6.5 0h3.8v1.6h.06c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.79 2.66 4.79 6.12v5.34h-4v-4.73c0-1.13-.02-2.58-1.57-2.58-1.58 0-1.82 1.23-1.82 2.5v4.81h-4z"/></symbol>',
  'i-tiktok': '<symbol id="i-tiktok" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></symbol>',
  'i-zalo-logo': '<symbol id="i-zalo-logo" viewBox="0 0 24 24" fill="currentColor"><path d="M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 01-.5763-.5729l-.0006.0005a3.273 3.273 0 01-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 011.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 01-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 01-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9436 0 1.0746.8697 1.9453 1.945 1.9453z"/></symbol>',
  'i-x': '<symbol id="i-x" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></symbol>',
  'i-calendar': '<symbol id="i-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H3m13-8v4M8 2v4m-.2 16h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 19.72 21 18.88 21 17.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 4 17.88 4 16.2 4H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 6.28 3 7.12 3 8.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 22 6.12 22 7.8 22Z"/></symbol>',
  'i-refresh': '<symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10s-2.005-2.732-3.634-4.362a9 9 0 1 0 2.282 8.862M21 10V4m0 6h-6"/></symbol>',
  'i-home': '<symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 17h8M11.018 2.764 4.235 8.039c-.453.353-.68.53-.843.75a2 2 0 0 0-.318.65C3 9.704 3 9.991 3 10.565V17.8c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-7.235c0-.574 0-.861-.074-1.126a2.002 2.002 0 0 0-.318-.65c-.163-.22-.39-.397-.843-.75l-6.783-5.275c-.351-.273-.527-.41-.72-.462a1 1 0 0 0-.523 0c-.194.052-.37.189-.721.462Z"/></symbol>',
  'i-close': '<symbol id="i-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></symbol>',
  'i-notes': '<symbol id="i-notes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 11H8m2 4H8m8-8H8m12-.2v10.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C17.72 22 16.88 22 15.2 22H8.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C4 19.72 4 18.88 4 17.2V6.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C6.28 2 7.12 2 8.8 2h6.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C20 4.28 20 5.12 20 6.8Z"/></symbol>',
  'i-book': '<symbol id="i-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 21-.1-.15c-.695-1.042-1.042-1.563-1.5-1.94a4 4 0 0 0-1.378-.737C8.453 18 7.827 18 6.575 18H5.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C2 16.48 2 15.92 2 14.8V6.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C3.52 3 4.08 3 5.2 3h.4c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C12 6.04 12 7.16 12 9.4M12 21V9.4M12 21l.1-.15c.695-1.042 1.042-1.563 1.5-1.94a3.999 3.999 0 0 1 1.378-.737C15.547 18 16.173 18 17.425 18H18.8c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C22 16.48 22 15.92 22 14.8V6.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C20.48 3 19.92 3 18.8 3h-.4c-2.24 0-3.36 0-4.216.436a4 4 0 0 0-1.748 1.748C12 6.04 12 7.16 12 9.4"/></symbol>',
  'i-shield': '<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11.5 2 2L15.5 9m4.5 3c0 4.908-5.354 8.478-7.302 9.615-.221.129-.332.194-.488.227a1.137 1.137 0 0 1-.42 0c-.156-.034-.267-.098-.488-.227C9.354 20.478 4 16.908 4 12V7.217c0-.799 0-1.199.13-1.542a2 2 0 0 1 .548-.79c.276-.243.65-.383 1.398-.664l5.362-2.01c.208-.078.312-.117.419-.133a1 1 0 0 1 .286 0c.107.016.21.055.419.133l5.362 2.01c.748.28 1.123.421 1.398.664a2 2 0 0 1 .547.79c.131.343.131.743.131 1.542V12Z"/></symbol>',
  'i-globe': '<symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10m0-20a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10m0-20C6.477 2 2 6.477 2 12s4.477 10 10 10m0-20c5.523 0 10 4.477 10 10s-4.477 10-10 10M2.5 9h19m-19 6h19"/></symbol>'
};
const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>\n      ${Object.values(ICONS).join('\n      ')}\n    </defs></svg>`;
const ico = (id, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#${id}"/></svg>`;

// Hàng biểu tượng mạng xã hội ở chân trang (site.cjs › author.social); mạng chưa có link vẫn hiện biểu tượng nhưng không bấm được
function footerSocial() {
  const S = A.social;
  const item = (url, label, icon, extra = '') => url
    ? `<li><a href="${url}" target="_blank" rel="noopener${label === 'Zalo' ? '' : ' me'}" aria-label="${label}"${extra}>${icon}</a></li>`
    : `<li><a data-social="${label.toLowerCase()}">${icon}</a></li>`;
  return `<ul class="footer__social">${[
    item(S.linkedin, 'LinkedIn', ico('i-linkedin')),
    item(S.facebook, 'Facebook', ico('i-facebook', 'footer__social-fb')),
    item(S.tiktok, 'TikTok', ico('i-tiktok')),
    item(A.zalo, 'Zalo', ico('i-zalo-logo', 'footer__social-zalo'), ' data-zalo')
  ].join('')}</ul>`;
}

/* ----------------------------------------------------------------------------
   Thành phần dùng chung: menu, menu thả xuống, footer
   rel = đường dẫn tương đối về gốc website ('' ở trang chủ, '../../' ở trang con…)
---------------------------------------------------------------------------- */
function cover(a, rel, { sizes = '100vw', lazy = true, alt = '', priority = false } = {}) {
  const b = kbImg(a, a.cover.base, rel);
  return `<picture><source type="image/webp" srcset="${b}-320.webp 320w, ${b}-640.webp 640w, ${b}.webp 1200w, ${b}-1600.webp 1600w" sizes="${sizes}"><img src="${b}.jpg" alt="${esc(alt)}" width="1200" height="630"${lazy ? ' loading="lazy"' : ''} decoding="async"${priority ? ' fetchpriority="high"' : ''}></picture>`;
}

function countLabel(n) {
  return n ? { vi: `${n} bài viết`, en: `${n} ${plural(n, 'article', 'articles')}` } : { vi: 'Sắp ra mắt', en: 'Coming soon' };
}

function dropdown(rel, lang = 'vi') {
  const isEn = lang === 'en';
  const suf = isEn ? '?lang=en' : '';
  const items = SITE.pillars.map(p => {
    return `<li><a class="kbdd__item" href="${rel}${pillarPath(p)}${suf}"><span class="kbdd__ico">${ico(p.icon)}</span><span class="kbdd__txt"><b data-en="${esc(p.en.name)}">${esc(isEn ? p.en.name : p.name)}</b><small data-en="${esc(p.en.short)}">${esc(isEn ? p.en.short : p.short)}</small></span>${ico('i-arrow', 'kbdd__go')}</a></li>`;
  }).join('\n            ');
  return `
        <div class="kbdd" id="kb-dd" role="region" aria-label="${isEn ? esc(SITE.hub.en.name) : 'Góc kiến thức'}" data-en-label="${esc(SITE.hub.en.name)}">
          <div class="kbdd__intro">
            <p class="kbdd__title" data-en="${esc(SITE.hub.en.name)}">${isEn ? esc(SITE.hub.en.name) : 'Góc kiến thức'}</p>
            <p class="kbdd__desc" data-en="${esc(SITE.hub.en.lead)}">${isEn ? esc(SITE.hub.en.lead) : 'Góc nhìn Marketing, ứng dụng AI và bài học thực chiến giúp biến chiến lược thành hệ thống tăng trưởng.'}</p>
            <div class="kbdd__by"><img src="${rel}${A.avatar}.webp" alt="" width="38" height="38" loading="lazy" decoding="async"><span><b>${A.name}</b><small>${A.jobTitle}</small></span></div>
            <a class="kbdd__all" href="${rel}${hubPath}${suf}"><span data-en="View all articles">${isEn ? 'View all articles' : 'Xem tất cả bài viết'}</span>${ico('i-arrow')}</a>
          </div>
          <div class="kbdd__main">
            <ul class="kbdd__list">
            ${items}
            </ul>
          </div>
        </div>`;
}

function trigger(href, lang = 'vi') {
  const isEn = lang === 'en';
  return `<a class="nav__kb" href="${href}" data-nav="kien-thuc" role="button" aria-haspopup="true" aria-expanded="false" aria-controls="kb-dd"><span data-en="${esc(SITE.hub.en.name)}">${isEn ? esc(SITE.hub.en.name) : 'Góc kiến thức'}</span><svg class="nav__chev" aria-hidden="true"><use href="#i-chev"/></svg></a>`;
}

function menuKb(rel, num, open, lang = 'vi') {
  const isEn = lang === 'en';
  const suf = isEn ? '?lang=en' : '';
  const items = SITE.pillars.map(p => `<a href="${rel}${pillarPath(p)}${suf}"><span class="menu-kb__ico">${ico(p.icon)}</span><span data-en="${esc(p.en.name)}">${esc(isEn ? p.en.name : p.name)}</span></a>`).join('\n            ');
  return `<div class="menu-kb${open ? ' is-open' : ''}">
        <button class="menu-kb__btn" type="button" aria-expanded="${open ? 'true' : 'false'}" aria-controls="menu-kb-list"><small>${num}</small><span data-en="${esc(SITE.hub.en.name)}">${isEn ? esc(SITE.hub.en.name) : 'Góc kiến thức'}</span><svg class="menu-kb__chev" aria-hidden="true"><use href="#i-chev"/></svg></button>
        <div class="menu-kb__panel" id="menu-kb-list">
          <div class="menu-kb__inner">
            ${items}
            <a class="menu-kb__all" href="${rel}${hubPath}${suf}"><span data-en="View all articles">${isEn ? 'View all articles' : 'Tất cả bài viết'}</span>${ico('i-arrow')}</a>
          </div>
        </div>
      </div>`;
}

function navBar(rel, articles, lang = 'vi') {
  const isEn = lang === 'en';
  const h = hash => isEn ? `${rel}?lang=en${hash}` : `${rel}${hash}`;
  const kbSuf = isEn ? '?lang=en' : '';
  return `<header class="nav" id="nav">
    <div class="nav__inner">
      <a class="nav__brand" href="${h('')}" aria-label="${isEn ? 'Lê Tuấn Việt, back to home' : 'Lê Tuấn Việt, về trang chủ'}">
        <span class="nav__logo"><img src="${rel}assets/img/logo.svg" alt="" width="28" height="28"></span><span class="nav__name">Lê Tuấn Việt</span><span class="nav__badge">${A.jobTitle}</span>
      </a>
      <nav class="nav__links" aria-label="${isEn ? 'Main navigation' : 'Điều hướng chính'}" data-en-label="Main navigation">
        <span class="nav__pill" aria-hidden="true"></span>
        <a href="${h('')}" data-nav="trang-chu" data-en="Home">${isEn ? 'Home' : 'Trang chủ'}</a>
        <a href="${h('#gioi-thieu')}" data-nav="gioi-thieu" data-en="About">${isEn ? 'About' : 'Giới thiệu'}</a>
        <a href="${h('#nang-luc')}" data-nav="nang-luc" data-en="Expertise">${isEn ? 'Expertise' : 'Năng lực'}</a>
        <a href="${h('#du-an')}" data-nav="du-an" data-en="Projects">${isEn ? 'Projects' : 'Dự án'}</a>
        <a href="${h('#doi-tac')}" data-nav="doi-tac" data-en="Partners">${isEn ? 'Partners' : 'Đối tác'}</a>
        <a href="${h('#feedback')}" data-nav="feedback">Feedback</a>
        ${trigger(`${rel}${hubPath}${kbSuf}`, lang)}${dropdown(rel, lang)}
        <a href="${h('#lien-he')}" data-nav="lien-he" data-en="Contact">${isEn ? 'Contact' : 'Liên hệ'}</a>
      </nav>
      <div class="nav__actions">
        <button class="nav__search" type="button" data-search-open aria-haspopup="dialog" aria-controls="kb-search" aria-label="${isEn ? 'Search articles' : 'Tìm kiếm bài viết'}" title="${isEn ? 'Search articles (press /)' : 'Tìm kiếm bài viết (phím /)'}">${ico('i-search')}</button>
        <a class="btn btn--dark btn--sm magnetic" href="${rel}${A.cv}" download="CV_Marketing Leader_Lê Tuấn Việt.pdf" data-cv><span data-en="Download CV">${isEn ? 'Download CV' : 'Tải CV'}</span> ${ico('i-download', 'ico ico--down')}</a>
        <button class="nav__burger" type="button" aria-label="${isEn ? 'Open menu' : 'Mở menu'}" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
      </div>
    </div>
  </header>

  <div class="menu" id="menu" aria-hidden="true">
    <nav class="menu__links" aria-label="${isEn ? 'Mobile menu' : 'Menu di động'}">
      <a href="${h('')}"><small>01</small><span data-en="Home">${isEn ? 'Home' : 'Trang chủ'}</span></a>
      <a href="${h('#gioi-thieu')}"><small>02</small><span data-en="About">${isEn ? 'About' : 'Giới thiệu'}</span></a>
      <a href="${h('#nang-luc')}"><small>03</small><span data-en="Expertise">${isEn ? 'Expertise' : 'Năng lực'}</span></a>
      <a href="${h('#du-an')}"><small>04</small><span data-en="Projects">${isEn ? 'Projects' : 'Dự án'}</span></a>
      <a href="${h('#doi-tac')}"><small>05</small><span data-en="Partners">${isEn ? 'Partners' : 'Đối tác'}</span></a>
      <a href="${h('#feedback')}"><small>06</small>Feedback</a>
      ${menuKb(rel, '07', true, lang)}
      <a href="${rel}${A.cv}" download="CV_Marketing Leader_Lê Tuấn Việt.pdf" data-cv><small>08</small><span data-en="Download CV">${isEn ? 'Download CV' : 'Tải CV'}</span></a>
      <a href="${h('#lien-he')}"><small>09</small><span data-en="Contact">${isEn ? 'Contact' : 'Liên hệ'}</span></a>
    </nav>
    <div class="menu__foot">
      <a class="menu__contact" href="mailto:${A.email}">${ico('i-mail')}<span>${A.email}</span></a>
      <a class="menu__contact" href="tel:+84${A.phone.replace(/\D/g, '').replace(/^0/, '')}">${ico('i-phone')}<span>${A.phone}</span></a>
    </div>
  </div>`;
}

function footer(rel, lang = 'vi') {
  const isEn = lang === 'en';
  const h = hash => isEn ? `${rel}?lang=en${hash}` : `${rel}${hash}`;
  const kbSuf = isEn ? '?lang=en' : '';
  const privHref = `${rel}${isEn ? 'en/privacy-policy/' : 'chinh-sach-bao-mat/'}`;
  const termsHref = `${rel}${isEn ? 'en/terms-of-use/' : 'dieu-khoan-su-dung/'}`;
  const pillars = SITE.pillars.map(p => `<li><a href="${rel}${pillarPath(p)}${kbSuf}" data-en="${esc(p.en.name)}">${esc(isEn ? p.en.name : p.name)}</a></li>`).join('');
  return `<footer class="footer">
    <div class="container">
      <div class="footer__grid footer__grid--kb">
        <div class="footer__brand">
          <div class="footer__id"><span class="footer__logo"><img src="${rel}assets/img/logo.svg" alt="" width="30" height="30" loading="lazy" decoding="async"></span><b>Lê Tuấn Việt</b></div>
          <span class="footer__role">${esc(A.positioning)}</span>
          <p class="desc" data-en="I believe effective marketing is not defined by a good idea alone, but by the ability to turn strategy into tangible results.">${isEn ? 'I believe effective marketing is not defined by a good idea alone, but by the ability to turn strategy into tangible results.' : 'Tôi tin rằng Marketing hiệu quả không dừng ở một ý tưởng hay, mà nằm ở khả năng biến chiến lược thành kết quả thực tế.'}</p>
          ${footerSocial()}
        </div>
        <div>
          <p class="footer__h" data-en="Quick links">${isEn ? 'Quick links' : 'Menu nhanh'}</p>
          <ul class="footer__list footer__list--2">
            <li><a href="${h('')}" data-en="Home">${isEn ? 'Home' : 'Trang chủ'}</a></li><li><a href="${h('#gioi-thieu')}" data-en="About">${isEn ? 'About' : 'Giới thiệu'}</a></li>
            <li><a href="${h('#nang-luc')}" data-en="Expertise">${isEn ? 'Expertise' : 'Năng lực'}</a></li><li><a href="${h('#du-an')}" data-en="Projects">${isEn ? 'Projects' : 'Dự án'}</a></li>
            <li><a href="${h('#doi-tac')}" data-en="Partners">${isEn ? 'Partners' : 'Đối tác'}</a></li><li><a href="${h('#feedback')}">Feedback</a></li>
            <li><a href="${rel}${hubPath}${kbSuf}" data-en="Knowledge Hub">${isEn ? 'Knowledge Hub' : 'Góc kiến thức'}</a></li><li><a href="${h('#lien-he')}" data-en="Contact">${isEn ? 'Contact' : 'Liên hệ'}</a></li>
            <li><a href="${privHref}" data-en="Privacy Policy" data-en-href="${rel}en/privacy-policy/">${isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}</a></li><li><a href="${termsHref}" data-en="Terms of Use" data-en-href="${rel}en/terms-of-use/">${isEn ? 'Terms of Use' : 'Điều khoản sử dụng'}</a></li>
          </ul>
        </div>
        <div>
          <p class="footer__h" data-en="Knowledge Hub">${isEn ? 'Knowledge Hub' : 'Góc kiến thức'}</p>
          <ul class="footer__list footer__list--kb-topics">
            <li><a href="${rel}${hubPath}${kbSuf}" data-en="All articles">${isEn ? 'All articles' : 'Tất cả bài viết'}</a></li>${pillars}
          </ul>
        </div>
        <div class="footer__cv">
          <p class="footer__h" data-en="Contact">${isEn ? 'Contact' : 'Liên hệ'}</p>
          <ul class="footer__list">
            <li><a href="mailto:${A.email}" data-mailto><svg width="16" height="16" aria-hidden="true"><use href="#i-mail"/></svg>${A.email}</a></li>
            <li><a href="tel:${A.phoneRaw}"><svg width="16" height="16" aria-hidden="true"><use href="#i-phone"/></svg>${A.phone}</a></li>
            <li><span class="footer__clock"><svg width="16" height="16" aria-hidden="true"><use href="#i-clock"/></svg><span data-en="Hanoi ·">${isEn ? 'Hanoi ·' : 'Hà Nội ·'}</span> <b data-clock>--:--</b></span></li>
          </ul>
          <a class="btn btn--light btn--sm magnetic" href="${rel}${A.cv}" download="CV_Marketing Leader_Lê Tuấn Việt.pdf" data-cv style="justify-self:start; margin-top:6px"><span data-en="Download CV (PDF)">${isEn ? 'Download CV (PDF)' : 'Tải CV (PDF)'}</span> ${ico('i-download', 'ico ico--down')}</a>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© <time datetime="2026">2026</time> Lê Tuấn Việt · ${A.jobTitle}</span>
        <a class="footer__top" href="#noi-dung"><span data-en="Back to top">${isEn ? 'Back to top' : 'Về đầu trang'}</span> ${ico('i-up')}</a>
      </div>
    </div>
    <div class="footer__mark" aria-hidden="true"><span data-split>Le Tuan Viet</span></div>
  </footer>`;
}

function crumbs(rel, items, lang = 'vi') {
  // items: [{name, href}] — phần tử cuối là trang hiện tại (không có link)
  const li = items.map((it, i) => {
    const last = i === items.length - 1;
    const home = i === 0 ? ico('i-home') : '';
    return last
      ? `<li aria-current="page"><span>${esc(it.name)}</span></li>`
      : `<li><a href="${it.href}">${home}${esc(it.name)}</a></li>`;
  }).join('');
  return `<nav class="kb-crumbs" aria-label="${lang === 'en' ? 'Breadcrumb' : 'Đường dẫn'}"><ol>${li}</ol></nav>`;
}

/* Khối "Kết nối với tôi" giống trang chủ (dùng ở trang tổng và trang chủ đề) */
function ctaPanel(rel, headingTag = 'h2') {
  return `<section class="section kb-sec kb-sec--cta" aria-labelledby="kb-cta-title">
      <div class="container">
        <div class="cta__panel rv">
          <div class="cta__main">
            <${headingTag} class="cta__title" id="kb-cta-title" data-fit data-split>Kết nối <span class="grad">với tôi</span></${headingTag}>
            <p class="desc desc--lg">Tôi sẵn sàng trao đổi về dự án Marketing và các cơ hội hợp tác phù hợp. Hãy nhắn tin hoặc gửi email để chúng ta bắt đầu cuộc trao đổi</p>
            <div class="btn-row">
              <a class="btn btn--dark magnetic" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>Nhắn Zalo ${ico('i-arrow-up-right', 'ico ico--arrow')}</a>
              <a class="btn btn--light magnetic" href="mailto:${A.email}" data-mailto>Gửi email ${ico('i-arrow', 'ico ico--arrow')}</a>
              <a class="btn btn--ghost magnetic" href="${rel}${A.cv}" download="CV_Marketing Leader_Lê Tuấn Việt.pdf" data-cv>Tải CV ${ico('i-download', 'ico ico--down')}</a>
            </div>
          </div>
          <div class="cta__side">
            <div class="bio tilt" data-tilt="6">
              <div class="bio__photo reveal-img"><img src="${rel}${A.photo}" alt="${A.name}, ${esc(A.role)}" loading="lazy" decoding="async" width="760" height="760"></div>
              <div class="bio__body">
                <div class="bio__sig"><img src="${rel}assets/img/signature.png" alt="Chữ ký ${A.name}" width="984" height="346" loading="lazy" decoding="async"></div>
                <div class="bio__links">
                  <button class="bio__link" type="button" data-copy="${A.email}"><span>${ico('i-mail')}<em>${A.email}</em></span><small>Sao chép</small></button>
                  <a class="bio__link" href="tel:${A.phoneRaw}"><span>${ico('i-phone')}<em>${A.phone}</em></span><small>Gọi</small></a>
                  <a class="bio__link" href="${A.zalo}" target="_blank" rel="noopener" data-zalo><span>${ico('i-zalo')}<em>Zalo I Tuấn Việt</em></span><small>Mở</small></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

/* ----------------------------------------------------------------------------
   Dữ liệu có cấu trúc (JSON-LD)
   Cùng một @id "#person" với trang chủ để Google gộp về một thực thể.
   Thông tin đầy đủ về tác giả nằm ở trang chủ portfolio (không có trang tác giả riêng).
---------------------------------------------------------------------------- */
// lang 'en': các trang /en/ dùng bản tiếng Anh trong SITE.author.en
function personLd(lang = 'vi') {
  const E = lang === 'en' ? A.en : {};
  return {
    '@type': 'Person',
    '@id': `${ORIGIN}/#person`,
    name: A.name,
    alternateName: A.alternateName,
    givenName: A.givenName,
    familyName: A.familyName,
    identifier: A.identifier,
    url: A.url,
    mainEntityOfPage: `${ORIGIN}/`,
    image: { '@type': 'ImageObject', url: abs(A.image), width: 680, height: 941 },
    jobTitle: A.jobTitle,
    hasOccupation: { '@type': 'Occupation', name: A.jobTitle, occupationLocation: { '@type': 'City', name: E.region || A.region } },
    disambiguatingDescription: A.positioning,
    description: E.description || A.description,
    email: `mailto:${A.email}`,
    telephone: '+84' + A.phoneRaw.replace(/^0/, ''),
    address: { '@type': 'PostalAddress', addressLocality: E.locality || A.locality, addressRegion: E.region || A.region, addressCountry: 'VN' },
    worksFor: orgLd(lang),
    alumniOf: { '@type': 'CollegeOrUniversity', name: (E.alumniOf || A.alumniOf).name, alternateName: A.alumniOf.alternateName, url: A.alumniOf.url },
    knowsAbout: E.knowsAbout || A.knowsAbout,
    // Cả ba danh hiệu đều hiển thị trên trang chủ (thẻ minh chứng trong js/data.js)
    award: E.awards || A.awards.map(([name, by]) => `${name} (${by.replace(/^Do /, '')})`),
    sameAs: A.sameAs
  };
}
// Nơi làm việc: một @id chung cho mọi trang (trang chủ khai báo y hệt) để Google gộp thành một thực thể
const orgLd = (lang = 'vi') => ({
  '@type': 'Organization', '@id': `${ORIGIN}/#taki-group`, name: A.worksFor.name, alternateName: A.worksFor.alternateName,
  legalName: lang === 'en' ? A.en.worksFor.legalName : A.worksFor.legalName, url: A.worksFor.site,
  description: lang === 'en' ? A.en.worksFor.description : A.worksFor.description
});
const websiteLd = () => ({
  '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: SITE.siteName,
  alternateName: [A.alternateName, 'Portfolio Lê Tuấn Việt'], inLanguage: SITE.lang, publisher: { '@id': `${ORIGIN}/#person` }
});
function breadcrumbLd(url, items) {
  return {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url }))
  };
}

/* ----------------------------------------------------------------------------
   Khung trang
---------------------------------------------------------------------------- */
function page({ rel, pagePath, title, description, draft = false, robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', ogType = 'website', ogTitle, image, imageAlt, imageWidth = 1200, imageHeight = 630, articleMeta = '', preload = '', ld, bodyClass, main, after = '', articles, flexTitle = false, css = "", lang = 'vi', locale, hreflangs = null, navActive = 'kien-thuc' }) {
  const isEn = lang === 'en';
  const ogLocale = locale || (isEn ? 'en_US' : SITE.locale);
  const url = abs(pagePath);
  const indexable = robots.startsWith('index');
  // flexTitle: trang phân trang (ví dụ "… (Trang 2)") — độ dài title không bắt buộc theo chuẩn 50–60 như trang gốc
  PAGES.push({ path: pagePath, title, description, indexable, flexTitle, draft, h1: (main.match(/<h1[\s>]/g) || []).length });
  const altLinks = hreflangs
    ? Object.entries(hreflangs).map(([k, v]) => `  <link rel="alternate" hreflang="${k}" href="${v}">`).join('\n')
    : `  <link rel="alternate" hreflang="vi" href="${url}">\n  <link rel="alternate" hreflang="x-default" href="${url}">`;
  return `<!DOCTYPE html>
<html lang="${lang}"${isEn ? ' data-lang="en"' : ''} class="smooth">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <!-- Chuyển cảnh vào trang: đặt sớm nhất có thể để màn phủ có ngay từ khung hình đầu tiên -->
  <script src="${rel}js/pt.js?v=972"></script>
  <!-- Google tag (gtag.js). ga4.js để defer: không chặn hiển thị, gtag.js vẫn đọc dataLayer khi nó được đẩy vào -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-J9FR8F25SP"></script>
  <script src="/js/ga4.js" defer></script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${A.name}">
  <meta name="robots" content="${robots}">${indexable ? `\n  <meta name="googlebot" content="${robots}">` : ''}
  <link rel="canonical" href="${url}">
${altLinks}
  <link rel="alternate" type="application/rss+xml" title="${isEn ? 'Knowledge Hub' : 'Góc kiến thức'} | ${A.name}" href="${abs(HUB + '/feed.xml')}">
  <meta name="theme-color" content="#F5F8FF">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta property="og:type" content="${ogType}">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:site_name" content="${SITE.siteName}">
  <meta property="og:title" content="${esc(ogTitle || title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="${imageWidth}">
  <meta property="og:image:height" content="${imageHeight}">
  <meta property="og:image:alt" content="${esc(imageAlt)}">${articleMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle || title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${esc(imageAlt)}">
  <link rel="icon" type="image/svg+xml" href="${rel}assets/img/logo.svg">
  <link rel="apple-touch-icon" href="${rel}assets/img/apple-touch-icon.png">
  <link rel="manifest" href="${rel}manifest.json">
  <link rel="preload" href="${rel}assets/fonts/be-vietnam-pro/QdVPSTAyLFyeg_IDWvOJmVES_Hw3BXo.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${rel}assets/fonts/be-vietnam-pro/QdVPSTAyLFyeg_IDWvOJmVES_Hw4BXoKZA.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${rel}assets/fonts/be-vietnam-pro/QdVMSTAyLFyeg_IDWvOJmVES_HSQI281Rb0.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${rel}assets/fonts/be-vietnam-pro/QdVMSTAyLFyeg_IDWvOJmVES_HSQI286Rb0bcw.woff2" as="font" type="font/woff2" crossorigin>${(main + preload).includes(IMG_ORIGIN + '/') ? `
  <link rel="preconnect" href="${IMG_ORIGIN}">` : ''}${preload}
  <link rel="stylesheet" href="${rel}css/style.min.css?v=972">
  <link rel="stylesheet" href="${rel}css/kb-core.css?v=972">
  <link rel="stylesheet" href="${rel}css/kb.css?v=972">${css ? `
  <link rel="stylesheet" href="${rel}css/${css}.css?v=972">` : ""}
  <link rel="stylesheet" href="${rel}css/stage.css?v=972">
  <script type="application/ld+json">
${json({ '@context': 'https://schema.org', '@graph': ld })}
  </script>
</head>
<body class="kb ${bodyClass}"${navActive ? ` data-nav-active="${navActive}"` : ''}>
<!--email_off--><!-- Cloudflare không mã hóa email trong vùng này: bot không chạy JavaScript (GPTBot, ClaudeBot…) đọc được đúng địa chỉ liên hệ -->
  <a class="skip-link" href="#noi-dung">${isEn ? 'Skip to main content' : 'Bỏ qua phần điều hướng'}</a>
  ${sprite()}
  <div class="pt" aria-hidden="true"><span class="pt__mark"><img src="${rel}assets/img/logo.svg" alt="" width="40" height="40">Lê Tuấn Việt</span></div>
  <div class="progress" aria-hidden="true"></div>

  ${navBar(rel, articles, lang)}

  <main id="noi-dung" tabindex="-1">
${main}
  </main>

  ${footer(rel, lang)}
${after}
  <dialog class="kb-sd" id="kb-search" aria-label="${isEn ? 'Search in Knowledge Hub' : 'Tìm kiếm trong Góc kiến thức'}">
    ${searchBox(rel, { id: 'kb-dq', dialog: true, lang })}
  </dialog>
  <div class="toast" role="status" aria-live="polite"><svg width="18" height="18" aria-hidden="true"><use href="#i-check"/></svg><span>${isEn ? 'Copied' : 'Đã sao chép'}</span></div>

  <script src="${rel}js/core.min.js?v=972" defer></script>
  <script src="${rel}js/vendor/lenis.min.js" defer></script>
  <script src="${rel}js/stage.js?v=972" defer></script>
  <script src="${rel}js/fx.js?v=972" defer></script>
  <script src="${rel}js/kb-nav.js" defer></script>
  <script src="${rel}js/kb.js" defer></script>
  <script src="${rel}js/kb-search.js" defer></script>
  <script src="${rel}js/scenes/kb-pages.js" defer></script>
<!--/email_off-->
</body>
</html>
`;
}

/* ----------------------------------------------------------------------------
   Thẻ bài viết
---------------------------------------------------------------------------- */
/* Bố cục danh sách học từ Góc kiến thức SEODO:
   feature = 1 bài, thẻ lớn nằm ngang · main = bài lớn bên trái · row = bài nhỏ bên phải (ảnh + tiêu đề)
   grid = lưới 3 cột, ngày đăng nằm trên ảnh. Tiêu đề là liên kết phủ cả thẻ (a::after). */
const COVER_SIZES = {
  feature: '(min-width: 1025px) 720px, 100vw',
  main: '(min-width: 1025px) 700px, 100vw',
  row: '(min-width: 1025px) 270px, 40vw',
  slide: '(min-width: 1025px) 280px, 250px',
  grid: '(min-width: 1025px) 400px, (min-width: 761px) 50vw, 100vw'
};
/* Tiêu đề hiển thị trên thẻ: lấy từ titleHtml để giữ &nbsp; chống rớt chữ ("có thể&nbsp;sai?"), bỏ span màu gradient của H1. */
const cardTitle = a => a.titleHtml ? a.titleHtml.replace(/<\/?span[^>]*>/g, '') : esc(a.title);
function postCard(a, rel, { variant = 'grid', headingTag = 'h3' } = {}) {
  const href = `${rel}${articlePath(a)}`;
  const [y, m, d] = day(a.published).split('-');
  const badge = variant === 'grid' || variant === 'main' || variant === 'slide';
  const foot = variant === 'feature' ? `
            <div class="kb-post__foot">
              <span class="kb-post__by"><img src="${rel}${A.avatar}.webp" alt="" width="44" height="44" loading="lazy" decoding="async"><span><b>${A.name}</b><small>${esc(A.role)}</small></span></span>
              <span class="kb-post__go" aria-hidden="true">${ico('i-arrow')}</span>
            </div>` : '';
  // Bài không khai "cover": thẻ không có khung ảnh, ngày đăng chuyển xuống dòng thông tin
  const hasCover = !!(a.cover && a.cover.base);
  const fig = hasCover
    ? `<div class="kb-post__fig">${cover(a, rel, { sizes: COVER_SIZES[variant] || COVER_SIZES.grid })}${badge ? `<time class="kb-post__date" datetime="${day(a.published)}"><b>${d}</b> <span>${m}/${y}</span></time>` : ''}</div>`
    : '';
  // Thẻ bài viết không hiện tên chủ đề và thời gian đọc phía trên tiêu đề (bỏ 29/09/2026).
  // Ngày đăng vẫn giữ: thẻ nào có huy hiệu ngày trên ảnh thì thôi, còn lại hiện ở dòng này.
  const metaDate = badge && hasCover ? '' : `<p class="kb-post__meta"><time datetime="${day(a.published)}">${vnDate(a.published)}</time></p>`;
  return `<article class="kb-post kb-post--${variant}${hasCover ? '' : ' kb-post--noimg'}">
          ${fig}
          <div class="kb-post__body">
            ${metaDate}
            <${headingTag} class="kb-post__t"><a href="${href}">${cardTitle(a)}</a></${headingTag}>
            <p class="kb-post__x">${esc(a.excerpt || a.description)}</p>${foot}
          </div>
        </article>`;
}

/* 1 bài → thẻ lớn; 2 bài → 2 cột; 3+ bài → 1 bài lớn + tối đa 3 bài nhỏ, phần còn lại xuống lưới 3 cột */
function postList(list, rel, headingTag = 'h3') {
  if (!list.length) return '';
  if (list.length === 1) return postCard(list[0], rel, { variant: 'feature', headingTag });
  if (list.length === 2) return `<div class="kb-grid kb-grid--2">${list.map(a => postCard(a, rel, { headingTag })).join('')}</div>`;
  const [first, ...more] = list;
  const rest = more.slice(3);
  return `<div class="kb-mag">
          ${postCard(first, rel, { variant: 'main', headingTag })}
          <div class="kb-mag__side">${more.slice(0, 3).map(a => postCard(a, rel, { variant: 'row', headingTag })).join('')}</div>
        </div>${rest.length ? `
        <div class="kb-grid">${rest.map(a => postCard(a, rel, { headingTag })).join('')}</div>` : ''}`;
}

/* Bài viết liên quan: cùng chủ đề được ưu tiên, rồi đến số từ khóa chung (keywords), hòa điểm thì bài mới hơn (tối đa 9 bài trên 1 thanh trượt) */
const RELATED_MAX = 9;
// Từ phổ biến: không tính là "liên quan" (so sánh sau khi bỏ dấu)
const STOP_WORDS = new Set('la gi va cua cho cac nhung mot voi trong the nao co khong de khi nhu ve o tai thi se da duoc hay hoac tu den nay do sao vi bang cach nen hon rat cung nhat theo khi'.split(' '));
function relatedPosts(a, all, n = RELATED_MAX) {
  const fold = s => plain(String(s)).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const tokens = s => new Set(fold(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !STOP_WORDS.has(w)));
  const kwOf = x => tokens((x.keywords || [x.keyword || '']).join(' '));
  const myKw = kwOf(a), myTitle = tokens(a.title);
  return all.filter(x => x.slug !== a.slug)
    .map(x => {
      let s = x.pillar === a.pillar ? 100 : 1;
      kwOf(x).forEach(w => { if (myKw.has(w)) s += 4; });                       // trùng từ khóa: tín hiệu chính
      tokens(x.title).forEach(w => { if (myKw.has(w) || myTitle.has(w)) s += 1; });   // trùng chữ trong tiêu đề: tín hiệu phụ
      return { x, s };
    })
    .filter(r => r.s > 0)
    .sort((p, q) => q.s - p.s || String(q.x.published).localeCompare(String(p.x.published)))
    .slice(0, n).map(r => r.x);
}

/* Phân trang "Bài viết mới nhất" của trang chủ đề, kiểu SEODO: 1 2 3 … N, mũi tên trước/sau.
   total <= 7: hiện đủ số trang. Nhiều hơn: luôn hiện 1, 2, 3, trang cuối và 1 trang liền kề hiện tại, còn lại rút gọn bằng "…" */
function pagerNumbers(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, total, cur - 1, cur, cur + 1]);
  const nums = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  nums.forEach(n => { if (prev && n - prev > 1) out.push(0); out.push(n); prev = n; });   // 0 = dấu "…"
  return out;
}
function pager(p, rel, cur, total) {
  const href = n => `${rel}${pillarPageN(p, n)}`;
  const items = pagerNumbers(cur, total).map(n => n === 0
    ? `<li class="kb-pager__dots" aria-hidden="true">…</li>`
    : `<li>${n === cur ? `<span aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`}</li>`
  ).join('');
  const nav = (dir, n, label) => n
    ? `<a class="kb-pager__nav" href="${href(n)}" aria-label="${label}">${ico('i-chev-r', dir === 'prev' ? 'kb-pager__prev' : '')}</a>`
    : `<span class="kb-pager__nav is-off" aria-hidden="true">${ico('i-chev-r', dir === 'prev' ? 'kb-pager__prev' : '')}</span>`;
  return `<nav class="kb-pager" aria-label="Phân trang">
          ${nav('prev', cur > 1 ? cur - 1 : 0, 'Trang trước')}
          <ol class="kb-pager__list">${items}</ol>
          ${nav('next', cur < total ? cur + 1 : 0, 'Trang sau')}
        </nav>`;
}

/* Thẻ chủ đề: icon, tên, số bài, 4 mảng nội dung (giống khối chuyên mục của SEODO) */
/* Mảng nội dung đã có bài (từ khóa chính hoặc tiêu đề bài chứa tên mảng) thành link xanh dẫn tới bài, như SEODO */
let ALL = [];
function topicPost(p, name) {
  const k = name.toLowerCase();
  return ALL.find(a => a.pillar === p.slug && [a.keyword, a.title].some(s => String(s || '').toLowerCase().includes(k)));
}
function catCard(p, n, rel, headingTag = 'h2') {
  const topics = (p.topics || []).slice(0, 6).map(t => {
    const a = topicPost(p, t[0]);
    return `<li>${ico('i-chev-r')}${a ? `<a href="${rel}${articlePath(a)}">${esc(t[0])}</a>` : `<span>${esc(t[0])}</span>`}</li>`;
  }).join('');
  return `<article class="kb-cat">
            <span class="kb-cat__ico">${ico(p.icon)}</span>
            <span class="kb-cat__go" aria-hidden="true">${ico('i-chev-r')}</span>
            <${headingTag} class="kb-cat__name"><a href="${rel}${pillarPath(p)}">${esc(p.name)}</a></${headingTag}>
            <p class="kb-cat__n${n ? '' : ' is-soon'}">${countLabel(n).vi}</p>
            <ul class="kb-cat__list">${topics}</ul>
          </article>`;
}

/* Ô tìm kiếm: ở đầu trang tổng / trang chủ đề (hiện kết quả ngay bên dưới) và trong hộp tìm kiếm (dialog).
   Không có JavaScript thì form gửi ?q= về trang tổng. Chỉ mục: goc-kien-thuc/search.json */
function searchBox(rel, { id, dialog = false, side = false, lang = 'vi' }) {
  const isEn = lang === 'en';
  // side: ô gọn ở cột phải trang bài viết (không có kính lúp bên trái, nút tìm chỉ có biểu tượng)
  const ph = isEn
    ? (side ? 'Search articles' : 'Search articles, e.g. Marketing plan')
    : (side ? 'Tìm kiếm bài viết' : 'Tìm bài viết, ví dụ: kế hoạch Marketing');
  return `<form class="kb-search${dialog ? ' kb-search--dlg' : ''}${side ? ' kb-search--side' : ''}" role="search" action="${rel}${hubPath}" method="get" data-kb-search="${rel}${HUB}/search.json" data-rel="${rel}" data-zalo="${A.zalo}">
      <div class="kb-search__box">
        ${side ? '' : ico('i-search', 'kb-search__ico')}
        <label class="sr-only" for="${id}">${isEn ? 'Search articles in Knowledge Hub' : 'Tìm kiếm bài viết trong Góc kiến thức'}</label>
        <input id="${id}" name="q" type="search" placeholder="${ph}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list">
        <button class="kb-search__clear" type="button" aria-label="${isEn ? 'Clear search query' : 'Xóa từ khóa'}">${ico('i-close')}</button>
        ${dialog ? `<button class="kb-sd__close" type="button" data-search-close>${isEn ? 'Close' : 'Đóng'}</button>` : `<button class="kb-search__btn" type="submit">${ico('i-search')}<span>${isEn ? 'Search' : 'Tìm kiếm'}</span></button>`}
      </div>
      <div class="kb-search__panel"${dialog ? '' : ' hidden'}>
        <p class="kb-search__head" aria-hidden="true"></p>
        <ul class="kb-search__list" id="${id}-list" role="listbox" aria-label="${isEn ? 'Search results' : 'Kết quả tìm kiếm'}"></ul>
      </div>
      <p class="sr-only" role="status" aria-live="polite"></p>
    </form>`;
}

/* Đầu trang tổng / trang chủ đề: nền tối căn giữa, đường dẫn, H1, một dòng mô tả, ô tìm kiếm */
function topHero(rel, crumbItems, { h1Html, lead, hub = false }) {
  return `<section class="kb-top is-dark${hub ? ' kb-top--hub' : ''}" aria-labelledby="kb-top-title">
      <div class="container kb-top__in">
        ${crumbs(rel, crumbItems)}
        <h1 class="kb-top__h1" id="kb-top-title" data-fit data-fit-min="26">${h1Html}</h1>
        <p class="kb-top__lead">${esc(lead)}</p>
        ${searchBox(rel, { id: 'kb-q' })}
      </div>
    </section>`;
}

/* ----------------------------------------------------------------------------
   Xử lý thân bài
---------------------------------------------------------------------------- */
/* Chú thích nguồn. Trang bài viết KHÔNG còn mục "Nguồn tham khảo" ở cuối (bỏ 2026-09-29),
   nên số [n] trỏ thẳng tới tài liệu gốc, mở tab mới, tên nguồn nằm ở title khi rê chuột.
   "references" trong metadata vẫn giữ nguyên: nó là dữ liệu cho "citation" trong JSON-LD. */
function footnoter(refs) {
  const seen = {};
  return html => html.replace(/\[\[(\d+)\]\]/g, (_, n) => {
    n = +n;
    const r = refs[n - 1];
    if (!r) throw new Error(`chú thích [[${n}]] không có trong "references"`);
    seen[n] = (seen[n] || 0) + 1;
    const id = seen[n] === 1 ? `trich-${n}` : `trich-${n}-${seen[n]}`;
    const name = esc(plain(r.text));
    if (!r.url) return `<sup class="kb-fn" id="${id}" title="${name}">[${n}]</sup>`;
    const ext = !r.url.startsWith(ORIGIN);
    return `<sup class="kb-fn"><a href="${esc(r.url)}" id="${id}" title="${name}" aria-label="Nguồn tham khảo ${n}: ${name}"`
      + `${ext ? ` target="_blank" rel="noopener${r.nofollow ? ' nofollow' : ''}"` : ''}>[${n}]</a></sup>`;
  });
}

/* Khối kêu gọi trong bài (giao diện ở css/kb-article.css): gọn, một hàng, một câu hỏi + một dòng mô tả + một nút.
   mid  (~40% bài): mời trao đổi trực tiếp qua Zalo
   late (~75% bài): dẫn tới phần Dự án trên trang hồ sơ (tên khách hàng làm minh chứng)
   Chữ lấy từ "ctaMid" / "ctaLate" của bài; nên giữ tiêu đề dưới 45 ký tự, mô tả dưới 70 ký tự. */
function ctaBlock(kind, a, rel) {
  const trim = s => String(s).replace(/\.\s*$/, '');                // câu mô tả trong khối giao diện: không chấm cuối
  if (kind === 'mid') {
    const c = a.ctaMid || { title: 'Bạn cần trao đổi về Marketing?', text: 'Nhắn cho tôi để trao đổi về mục tiêu và nguồn lực của doanh nghiệp' };
    return `<aside class="kb-cta kb-cta--mid" aria-label="Trao đổi với ${A.name}">
  <img class="kb-cta__ava" src="${rel}${A.avatar}.webp" alt="" width="52" height="52" loading="lazy" decoding="async">
  <div class="kb-cta__txt">
    <p class="kb-cta__t">${esc(c.title)}</p>
    <p class="kb-cta__d">${esc(trim(c.text))}</p>
  </div>
  <a class="kb-btn kb-btn--primary" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>${ico('i-zalo')}Nhắn Zalo</a>
</aside>`;
  }
  if (kind === 'late') {
    const names = A.results.map(r => r[0]);
    const c = a.ctaLate || { title: 'Xem các dự án tôi đã triển khai', text: `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}` };
    return `<aside class="kb-cta kb-cta--late" aria-label="Dự án đã triển khai">
  <span class="kb-cta__ico" aria-hidden="true">${ico('i-layers')}</span>
  <div class="kb-cta__txt">
    <p class="kb-cta__t">${esc(c.title)}</p>
    <p class="kb-cta__d">${esc(trim(c.text))}</p>
  </div>
  <a class="kb-btn kb-btn--ghost" href="${rel}#du-an">Xem dự án ${ico('i-arrow')}</a>
</aside>`;
  }
  return '';
}

/* Nút kêu gọi gọn nằm trong thân bài: CHỈ một câu và một nút, không ảnh, không dòng mô tả
   (yêu cầu 29/09/2026). Đặt <!-- cta:nut --> ở chỗ muốn hiện; chữ lấy lần lượt theo thứ tự
   từ mảng "ctaButtons" trong metadata của bài:
     { "text": "câu dẫn", "label": "chữ trên nút", "href": "zalo" | "/#du-an" | "https://…",
       "style": "ghost" }        style bỏ trống = nút xanh đậm
   Câu dẫn nên dưới 52 ký tự để nằm gọn MỘT dòng bên cạnh nút (cột chữ rộng khoảng 480px trên máy tính);
   dài hơn sẽ xuống dòng, và trình dựng sẽ in cảnh báo khi build.
   Khối liên hệ cuối bài (offerBlock) đã bỏ: nó nằm sát hộp tác giả nên nhìn bị lặp. */
function ctaButton(c, rel) {
  if ([...String(c.text)].length > 55) console.warn(`  ! Nút CTA "${c.text}" dài ${[...String(c.text)].length} ký tự, sẽ xuống dòng: rút xuống dưới 52 ký tự`);
  const zalo = c.href === 'zalo';
  const raw = zalo ? A.zalo : String(c.href || '');
  const ext = /^https?:/.test(raw);
  const href = ext ? raw : rel + raw.replace(/^\//, '');
  const ghost = c.style === 'ghost';
  return `<aside class="kb-cta kb-cta--nut">
  <p class="kb-cta__t">${esc(c.text)}</p>
  <a class="kb-btn ${ghost ? 'kb-btn--ghost' : 'kb-btn--primary'}" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}${zalo ? ' data-zalo' : ''}>${zalo ? ico('i-zalo') : ''}${esc(c.label)}${ghost ? ' ' + ico('i-arrow') : ''}</a>
</aside>`;
}

function faqBlock(a) {
  if (!a.faq || !a.faq.length) return '';
  const items = a.faq.map((f, i) => `<details class="kb-faq__item"${i === 0 ? ' open' : ''}>
    <summary><h3 class="kb-faq__q">${esc(f.q)}</h3><span class="kb-faq__ico" aria-hidden="true"></span></summary>
    <div class="kb-faq__a"><p>${esc(f.a)}</p></div>
  </details>`).join('\n  ');
  return `<h2 id="${slugify(a.faqTitle || 'cau-hoi-thuong-gap')}">${esc(a.faqTitle || 'Câu hỏi thường gặp')}</h2>
<div class="kb-faq">
  ${items}
</div>`;
}

function processArticle(a) {
  const rel = relRoot(articlePath(a));
  const refs = a.references || [];
  const fn = footnoter(refs);

  // 1. Vị trí khối CTA (tính theo số từ trước khi chèn) + đếm từ
  let body = a.raw.replace(/^\s+|\s+$/g, '');
  const bodyNoMarkers = body.replace(/<!--[\s\S]*?-->/g, '');
  const faqHtml = faqBlock(a);
  const totalWordsBody = countWords(bodyNoMarkers) + countWords(faqHtml);
  const sapoWords = countWords(a.sapo.replace(/\[\[\d+\]\]/g, ''));
  const total = sapoWords + totalWordsBody;
  const ctaPos = {};
  ['mid', 'late'].forEach(k => {
    const i = body.indexOf(`<!-- cta:${k} -->`);
    if (i < 0) return;
    let before = body.slice(0, i).replace(/<!--[\s\S]*?-->/g, '');
    if (body.indexOf('<!-- faq -->') > -1 && body.indexOf('<!-- faq -->') < i) before += faqHtml;
    ctaPos[k] = (sapoWords + countWords(before)) / total;
  });

  // 2. Chèn FAQ, CTA. Các nút <!-- cta:nut --> lấy chữ lần lượt theo thứ tự trong "ctaButtons".
  let nut = 0;
  body = body.replace('<!-- faq -->', faqHtml)
    .replace('<!-- cta:mid -->', ctaBlock('mid', a, rel))
    .replace('<!-- cta:late -->', ctaBlock('late', a, rel))
    .replace(/<!-- cta:nut -->/g, () => {
      const c = (a.ctaButtons || [])[nut++];
      if (!c) throw new Error(`${a.source}: thiếu mục thứ ${nut} trong "ctaButtons" cho <!-- cta:nut -->`);
      return ctaButton(c, rel);
    })
    .replace(/<!--[\s\S]*?-->/g, '');

  // 3. Chú thích nguồn (sapo trước, thân bài sau để đánh số liên tục)
  //    Tên tác giả trong sapo trỏ về trang hồ sơ: neo chữ là tên thật thay vì một con số
  //    chú thích, đúng như ô "Về tác giả" vẫn làm với đoạn giới thiệu.
  const sapoHtml = fn(esc(a.sapo).replace(A.name, `<a href="${rel}">${A.name}</a>`));
  body = fn(body);

  // 4. Tiêu đề: gắn id + mục lục
  const toc = [];
  const used = new Set();
  body = body.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (all, lvl, attrs, inner) => {
    if (/class="kb-faq__q"/.test(attrs)) return all;                  // câu hỏi FAQ không vào mục lục
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) {
      id = slugify(inner) || 'muc';
      let k = id, n = 2;
      while (used.has(k)) k = `${id}-${n++}`;
      id = k;
      attrs += ` id="${id}"`;
    }
    used.add(id);
    toc.push({ level: +lvl, id, text: plain(inner) });
    // H3 "Bước n: …" → đường kẻ tách từng bước (số bước đã nằm trong chữ của tiêu đề)
    const step = lvl === '3' && /^Bước \d+:/.test(plain(inner));
    if (step && !/class=/.test(attrs)) attrs += ' class="kb-h3-step"';
    return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
  });

  // 4b. Các bước "Bước n: …" (H3) cho schema HowTo: tên bước + đoạn văn đầu tiên ngay sau tiêu đề
  const steps = [];
  body.replace(/<h3[^>]*\sid="([^"]+)"[^>]*>\s*Bước \d+:\s*([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g, (all, id, name, p1) => {
    steps.push({ id, name: plain(name), text: plain(p1).replace(/\s*\[\d+\]/g, '').trim() });
    return all;
  });

  // 5. Bảng: khung cuộn ngang có nhãn
  body = body.replace(/<table>([\s\S]*?)<\/table>/g, (all, inner) => {
    const cap = plain((inner.match(/<caption>([\s\S]*?)<\/caption>/) || [])[1] || 'Bảng');
    // Nhãn cột cho từng ô (điện thoại hiển thị mỗi hàng thành một thẻ: nhãn ở trên, nội dung bên dưới)
    const heads = [...inner.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => plain(m[1]));
    inner = inner.replace(/<tbody>([\s\S]*?)<\/tbody>/, (a, tb) => '<tbody>' + tb.replace(/<tr>([\s\S]*?)<\/tr>/g, (b, row) => {
      let i = 0;
      return '<tr>' + row.replace(/<td>/g, () => `<td data-label="${esc(heads[i++] || '')}">`) + '</tr>';
    }) + '</tbody>');
    return `<div class="kb-table" role="region" aria-label="${esc(cap)}" tabindex="0"><table>${inner}</table></div>`;
  });

  // 5b. Ảnh trên R2 (meta img_base): mọi đường dẫn /assets/kb/<slug>/… trong src, srcset, href → IMG_ORIGIN + img_base + <slug>/…
  if (a.img_base) body = body.replace(new RegExp(`(["\\s,])/assets/kb/${a.slug}/`, 'g'), `$1${IMG_ORIGIN}/${a.img_base}${a.slug}/`);

  // 6. Liên kết: đường dẫn gốc → tương đối; liên kết ngoài mở tab mới
  body = body.replace(/href="\/([^"]*)"/g, (_, p) => `href="${rel}${p}"`)
    .replace(/src="\/([^"]*)"/g, (_, p) => `src="${rel}${p}"`)
    .replace(/srcset="([^"]*)"/g, (_, s) => `srcset="${s.replace(/(^|,\s*)\/([^\s,]+)/g, (_2, sep, p) => `${sep}${rel}${p}`)}"`)
    .replace(/<a href="(https?:\/\/[^"]+)"(?![^>]*target=)/g, (all, u) => u.startsWith(ORIGIN) ? all : `<a href="${u}" target="_blank" rel="noopener"`)
    .replace(/<img(?![^>]*loading=)/g, '<img loading="lazy" decoding="async"');

  const readMin = Math.max(1, Math.round(total / WPM));
  return { ...a, rel, bodyHtml: body, sapoHtml, toc, total, readMin, ctaPos, steps };
}

/* ----------------------------------------------------------------------------
   Trang bài viết
---------------------------------------------------------------------------- */
function tocList(toc, cls) {
  let h2 = 0, out = '', open = false;
  toc.forEach(t => {
    if (t.level === 2) {
      if (open) { out += '</ol></li>'; open = false; }
      h2++;
      out += `${out ? '</li>' : ''}<li><a href="#${t.id}"><span class="kb-toc__n">${h2}</span>${esc(t.text)}</a>`;
    } else {
      if (!open) { out += '<ol>'; open = true; }
      out += `<li><a href="#${t.id}">${esc(t.text)}</a></li>`;
    }
  });
  if (open) out += '</ol>';
  if (out) out += '</li>';
  return `<ol class="${cls}">${out}</ol>`;
}

function shareLinks(url, title, cls, lang = 'vi') {
  const isEn = lang === 'en';
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  return `<div class="kb-share ${cls}">
          <span class="kb-share__label">${isEn ? 'Share' : 'Chia sẻ'}</span>
          <a class="kb-share__btn" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="${isEn ? 'Share on Facebook' : 'Chia sẻ lên Facebook'}">${ico('i-facebook')}</a>
          <a class="kb-share__btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener" aria-label="${isEn ? 'Share on LinkedIn' : 'Chia sẻ lên LinkedIn'}">${ico('i-linkedin')}</a>
          <a class="kb-share__btn" href="https://twitter.com/intent/tweet?url=${u}&amp;text=${t}" target="_blank" rel="noopener" aria-label="${isEn ? 'Share on X' : 'Chia sẻ lên X'}">${ico('i-x')}</a>
          <button class="kb-share__btn" type="button" data-share-copy="${esc(url)}" aria-label="${isEn ? 'Copy link' : 'Sao chép liên kết bài viết'}">${ico('i-link')}</button>
        </div>`;
}

/* Cột phải trang bài viết (máy tính, từ 1280px): tìm kiếm → chuyên mục (danh sách chữ, số bài khi có bài) → kiến thức mới
   → ô liên hệ (cấu trúc thẻ .bio "Kết nối với tôi" ở trang chủ + nút "Nhận tư vấn Marketing").
   Ô liên hệ dính ở mép trên khi cuộn qua ba khối đầu. Mục lục nằm trong bài (hộp gập), không đặt ở đây.
   Kiến thức mới: 5 bài mới nhất, trừ bài đang đọc; khi Góc kiến thức mới có một bài thì hiện chính bài đó ("Bạn đang đọc"). */
/* llms.txt (GEO): bản đồ ngắn cho công cụ AI biết site là gì, ai viết, bài nào nói về gì. Tự sinh từ bài đã đăng nên luôn khớp sitemap.
   Chỉ dùng dữ kiện đã có trong site.cjs và meta bài viết. */
function llmsTxt(all) {
  const byPillar = SITE.pillars.map(p => ({ p, list: all.filter(a => a.pillar === p.slug) })).filter(x => x.list.length);
  const lines = [
    `# ${SITE.siteName}`,
    '',
    `> Portfolio và Góc kiến thức của ${A.name}, ${A.role}, Hà Nội. Nội dung tiếng Việt về Marketing cho doanh nghiệp SME: chiến lược, kế hoạch, ứng dụng AI và bài học từ dự án thực tế.`,
    '',
    `Tác giả: ${A.name} (${A.jobTitle}). Mọi bài viết do tác giả này biên soạn; trang chủ ${abs('')} là hồ sơ năng lực chính thức.`,
    '',
    '## Trang chính',
    '',
    `- [Trang chủ và portfolio](${abs('')}): hồ sơ, năng lực, dự án và đối tác`,
    `- [${SITE.hub.name}](${abs(HUB + '/')}): danh sách toàn bộ bài viết`,
    `- [RSS](${abs(HUB + '/feed.xml')}): nguồn cấp bài mới`,
    `- [Chính sách bảo mật](${abs('chinh-sach-bao-mat/')}): quy định thu thập, sử dụng và bảo vệ dữ liệu cá nhân (tiếng Việt)`,
    `- [Điều khoản sử dụng](${abs('dieu-khoan-su-dung/')}): quy định sử dụng nội dung và giới hạn trách nhiệm (tiếng Việt)`,
    `- [Privacy Policy](${abs('en/privacy-policy/')}): personal data protection policy (English)`,
    `- [Terms of Use](${abs('en/terms-of-use/')}): website terms of use and intellectual property rights (English)`,
    // Hồ sơ ngắn để công cụ AI trả lời đúng câu "Lê Tuấn Việt là ai". Mọi dòng lấy từ site.cjs (dữ kiện trong CV).
    '',
    `## Về ${A.name}`,
    '',
    `- ${A.name} (${A.alternateName}) là ${A.jobTitle} tại ${A.worksFor.name} (${A.worksFor.legalName}), làm việc tại ${A.locality}, ${A.region}.`,
    `- Định vị thương hiệu cá nhân: ${A.positioning}. Chức danh chính thức vẫn là ${A.jobTitle}.`,
    `- ${A.description}`,
    ...A.experience.map(e => `- ${e.org}, ${e.place}, ${e.time}: ${e.roles.join('; ')}.`),
    `- Số liệu nổi bật theo CV: ${A.stats.map(([n, t]) => `${n} ${t}`).join('; ')}.`,
    ...A.results.map(([org, kind, text]) => `- Dự án ${org} (${kind.toLowerCase()}): ${text}`),
    `- Danh hiệu: ${A.awards.map(([name, by]) => `${name} (${by.replace(/^Do /, '')})`).join('; ')}.`,
    `- Học vấn: ${A.education.school}, ngành ${A.education.major}, ${A.education.time}, ${A.education.note}.`,
    `- Chuyên môn: ${A.knowsAbout.join(', ')}.`,
    `- Liên hệ: ${A.email}, điện thoại ${A.phone}, Zalo ${A.zalo}, LinkedIn ${A.social.linkedin}. CV: ${abs(A.cv)}`
  ];
  for (const { p, list } of byPillar) {
    lines.push('', `## ${p.name}`, '');
    for (const a of list) lines.push(`- [${a.title}](${abs(articlePath(a))}): ${String(a.description || a.excerpt).replace(/\s+/g, ' ').trim()}`);
  }
  lines.push('', '## Lưu ý khi trích dẫn', '', '- Ví dụ về cửa hàng, doanh nghiệp và nhân vật trong bài được ghi rõ là giả định biên tập, không phải kết quả khách hàng thật.', '- Số liệu từ nguồn ngoài luôn kèm nguồn và phạm vi đo; phần pháp lý chỉ để định hướng, không phải tư vấn pháp lý.', '');
  lines.push(`Toàn văn mọi bài viết ở dạng văn bản thuần: ${abs('llms-full.txt')}`, '');
  return lines.join('\n');
}

/* llms-full.txt: toàn văn bài viết ở dạng Markdown thuần cho công cụ AI không chạy JavaScript.
   Gắn X-Robots-Tag: noindex trong _headers để Google không xem là bản trùng của các bài viết.
   Cloudflare Pages chặn tệp trên 25 MiB, nên llms-full.txt chỉ giữ các bài mới nhất (≈ LLMS_WINDOW byte);
   bài cũ hơn nằm ở goc-kien-thuc/llms-full/phan-<n>.txt, mỗi phần ≤ LLMS_PART byte, ĐÁNH SỐ TỪ BÀI CŨ NHẤT:
   phần đã đầy không đổi khi đăng bài mới, chỉ phần cuối nhận thêm bài trượt ra khỏi llms-full.txt.
   Chưa có phần lưu trữ nào thì llms-full.txt giữ nguyên dạng cũ (không thêm dòng nào). */
const LLMS_WINDOW = 3 * 1024 * 1024;
const LLMS_PART = 4 * 1024 * 1024;
const LLMS_DIR = `${HUB}/llms-full`;
function bodyToText(html) {
  return decode(String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<aside class="kb-cta[\s\S]*?<\/aside>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<figure[\s\S]*?<\/figure>/g, f => { const c = f.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/); return c ? `\n\n[Hình: ${plain(c[1])}]\n\n` : '\n\n'; })
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, t) => `\n\n### ${plain(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, t) => `\n\n#### ${plain(t)}\n\n`)
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/g, (_, r) => `\n| ${[...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => plain(c[1])).join(' | ')} |`)
    .replace(/<li[^>]*>/g, '\n- ')
    .replace(/<\/(p|div|section|ul|ol|table|dl|dd|dt|blockquote|caption|li)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function llmsArticle(a) {
  const p = pillarBySlug(a.pillar);
  const out = ['---', '', `## ${a.title}`, '',
    `- URL: ${abs(articlePath(a))}`, `- Chủ đề: ${p.name}`, `- Tác giả: ${A.name}`,
    `- Xuất bản: ${day(a.published)}; cập nhật: ${day(a.modified)}`, `- Tóm tắt: ${String(a.description).replace(/\s+/g, ' ').trim()}`, ''];
  if (a.sapo) out.push(plain(a.sapo), '');
  if ((a.takeaways || []).length) out.push('### Tóm tắt nhanh', '', ...a.takeaways.map(t => `- ${plain(t)}`), '');
  out.push(bodyToText(a.bodyHtml), '');
  if ((a.faq || []).length) out.push('### Câu hỏi thường gặp', '', ...a.faq.flatMap(f => [`**${plain(f.q)}**`, plain(f.a), '']));
  if ((a.references || []).length) out.push('### Nguồn tham khảo', '', ...a.references.map(r => `- ${r.text || r.name || ''}${r.url ? ` ${r.url}` : ''}`), '');
  return out.join('\n');
}
/* Trả về { main, parts: [{ n, path, text }] }. all xếp mới → cũ. */
function llmsFull(all) {
  const blocks = all.map(a => ({ a, text: llmsArticle(a) }));
  const bytes = b => Buffer.byteLength(b.text, 'utf8') + 1;            // + 1 ký tự xuống dòng nối giữa các khối
  let k = 0, size = 0;                                                  // cửa sổ bài mới nhất, luôn có ít nhất 1 bài
  while (k < blocks.length && (k === 0 || size + bytes(blocks[k]) <= LLMS_WINDOW)) size += bytes(blocks[k++]);
  const groups = [];                                                    // phần lưu trữ: gom từ bài cũ nhất
  let cur = [], curSize = 0;
  for (const b of blocks.slice(k).reverse()) {
    if (cur.length && curSize + bytes(b) > LLMS_PART) { groups.push(cur); cur = []; curSize = 0; }
    cur.push(b); curSize += bytes(b);
  }
  if (cur.length) groups.push(cur);
  const parts = groups.map((g, i) => {
    const n = i + 1, list = g.slice().reverse();                        // trong mỗi phần vẫn xếp mới → cũ như tệp chính
    const from = vnDate(g[0].a.published), to = vnDate(g[g.length - 1].a.published);
    const head = [`# ${SITE.siteName}: toàn văn Góc kiến thức, phần lưu trữ ${n}`, '',
      `> Bài đăng từ ${from} đến ${to} (${g.length} bài) của ${A.name}, ${A.role}. Mỗi bài ghi rõ địa chỉ gốc; khi trích dẫn, hãy dẫn về địa chỉ đó. Bài mới hơn: ${abs('llms-full.txt')}. Hồ sơ tác giả: ${abs('llms.txt')}`, ''];
    return { n, from, to, count: g.length, path: `${LLMS_DIR}/phan-${n}.txt`, text: head.concat(list.map(b => b.text)).join('\n') };
  });
  const head = [`# ${SITE.siteName}: toàn văn Góc kiến thức`, '',
    `> Toàn văn các bài viết của ${A.name}, ${A.role}. Mỗi bài ghi rõ địa chỉ gốc; khi trích dẫn, hãy dẫn về địa chỉ đó. Hồ sơ tác giả: ${abs('llms.txt')}`, ''];
  if (parts.length) head.push(`Tệp này chứa ${k} bài mới nhất. Bài cũ hơn nằm ở các phần lưu trữ (đánh số từ bài cũ nhất):`, '',
    ...parts.map(p => `- [Phần ${p.n}: ${p.from} đến ${p.to}, ${p.count} bài](${abs(p.path)})`), '');
  return { main: head.concat(blocks.slice(0, k).map(b => b.text)).join('\n'), parts };
}

const SIDE_POSTS = 5;
/* Tiêu đề trong "Kiến thức mới": luôn đúng 2 dòng, ngắt theo ý thay vì để trình duyệt ngắt giữa cụm từ.
   Thứ tự ưu tiên: sau "?" hoặc "," giữa câu → trước chữ "khác" → chỗ trống gần giữa nhất. Mỗi nửa ≤ SIDE_LINE ký tự
   (12.5px trong cột chữ 210px chứa khoảng 36 ký tự). Bài có thể tự chọn chỗ ngắt bằng "sideTitle": "Dòng một|Dòng hai".
   Mỗi dòng không xuống hàng (CSS), dòng quá dài bị cắt bằng dấu "…" nên không bao giờ thành 3 dòng. */
const SIDE_LINE = 36;
function sideTitleLines(x) {
  if (x.sideTitle) return x.sideTitle.split('|').map(s => s.trim());
  const t = x.title, ok = i => i > 0 && i < t.length && t.slice(0, i).trim().length <= SIDE_LINE && t.slice(i).trim().length <= SIDE_LINE;
  const cuts = [];
  for (const re of [/[?,] /g, / khác /g]) for (const m of t.matchAll(re)) cuts.push(re.source === ' khác ' ? m.index : m.index + 1);
  let cut = cuts.find(ok);
  if (cut == null) {
    const spaces = [...t.matchAll(/ /g)].map(m => m.index).filter(ok).sort((p, q) => Math.abs(p - t.length / 2) - Math.abs(q - t.length / 2));
    cut = spaces[0];
  }
  return cut == null ? [t] : [t.slice(0, cut).trim(), t.slice(cut).trim()];
}
/* Cột phải ĐÓNG BĂNG theo thời điểm đăng bài: số bài từng chuyên mục và "Kiến thức mới" chỉ tính các bài đăng
   không muộn hơn bài đang dựng, nên đăng bài mới không phải viết lại trang cũ. Trình duyệt (js/kb.js mục 7) đọc
   goc-kien-thuc/recent.json để cập nhật hai khối này theo hiện tại, cùng cấu trúc thẻ nên không xô lệch bố cục;
   phần đóng băng là bản dự phòng khi không chạy JavaScript. Trang chính sách đóng băng theo ngày cập nhật của chính nó. */
const RECENT = `${HUB}/recent.json`;
const publishedBy = (all, iso) => all.filter(x => String(x.published) <= String(iso));
/* recent.json: số bài từng chuyên mục + SIDE_POSTS + 1 bài mới nhất (bỏ bài đang đọc vẫn còn đủ SIDE_POSTS bài).
   Mỗi bài mang đúng dữ liệu một dòng "Kiến thức mới" cần: u, t (tiêu đề), l (2 dòng tiêu đề), d (ngày), img (ảnh 320px nếu có). */
function recentJson(all) {
  return JSON.stringify({
    n: pillarCounts(all),
    posts: all.slice(0, SIDE_POSTS + 1).map(x => ({
      u: articlePath(x), t: x.title, l: sideTitleLines(x), d: day(x.published),
      ...(x.cover && x.cover.base ? { img: kbImg(x, `${x.cover.base}-320.webp`) } : {})
    }))
  });
}
function articleSide(a, allNow, rel) {
  const all = publishedBy(allNow, a.published);                        // đóng băng tại thời điểm đăng bài
  const counts = pillarCounts(all);
  const cats = SITE.pillars.map(p => {
    const n = counts[p.slug];
    return `<li><a class="kb-side__cat${p.slug === a.pillar ? ' is-current' : ''}" href="${rel}${pillarPath(p)}">${ico('i-chev-r')}<span class="kb-side__cname">${esc(p.name)}</span>${n ? `<span class="kb-side__n">${n}</span>` : ''}</a></li>`;
  }).join('\n                ');
  let others = all.filter(x => x.slug !== a.slug).slice(0, SIDE_POSTS);
  // Bài đăng sớm (lúc đăng chưa có đủ SIDE_POSTS bài cũ hơn): lấy các bài cũ nhất của cả kho cho đủ dòng. Tập này không đổi
  // khi đăng thêm bài, và danh sách luôn đủ dòng thì lúc trình duyệt thay bằng bài mới nhất, cột phải không cao thêm.
  if (others.length < SIDE_POSTS) others = allNow.slice(-(SIDE_POSTS + 1)).filter(x => x.slug !== a.slug).slice(0, SIDE_POSTS);
  const posts = (others.length ? others : [a]).map(x => {
    const self = x.slug === a.slug;
    return `<li><a class="kb-side__post" href="${rel}${articlePath(x)}"${self ? ' aria-current="page"' : ''}>${x.cover && x.cover.base ? `<span class="kb-side__img"><img src="${kbImg(x, `${x.cover.base}-320.webp`, rel)}" alt="" width="320" height="168" loading="lazy" decoding="async"></span>` : ''}<span class="kb-side__txt"><b title="${esc(x.title)}">${sideTitleLines(x).map(l => `<span>${esc(l)}</span>`).join(' ')}</b><small>${self ? 'Bạn đang đọc' : `<time datetime="${day(x.published)}">${vnDate(x.published)}</time>`}</small></span></a></li>`;
  }).join('\n                ');
  return `<aside class="kb-art__aside" aria-label="Tìm kiếm, chuyên mục và bài viết mới">
            <div class="kb-side" data-kb-recent="${rel}${RECENT}" data-kb-self="${articlePath(a)}">
              ${searchBox(rel, { id: 'kb-sq', side: true })}
              <nav class="kb-side__box" aria-labelledby="kb-side-cat">
                <p class="kb-side__t" id="kb-side-cat">Chuyên mục</p>
                <ul class="kb-side__cats">
                ${cats}
                </ul>
              </nav>
              <section class="kb-side__box" aria-labelledby="kb-side-new">
                <p class="kb-side__t" id="kb-side-new">Kiến thức mới</p>
                <ul class="kb-side__posts">
                ${posts}
                </ul>
              </section>
            </div>
            <div class="kb-side__cta bio">
              <div class="bio__photo"><img src="${rel}${A.photo}" alt="${A.name}, ${esc(A.role)}" loading="lazy" decoding="async" width="760" height="760"></div>
              <div class="bio__body">
                <div class="bio__sig"><img src="${rel}assets/img/signature.png" alt="Chữ ký ${A.name}" width="984" height="346" loading="lazy" decoding="async"></div>
                <div class="bio__links">
                  <button class="bio__link" type="button" data-copy="${A.email}"><span>${ico('i-mail')}<em>${A.email}</em></span><small>Sao chép</small></button>
                  <a class="bio__link" href="tel:${A.phoneRaw}"><span>${ico('i-phone')}<em>${A.phone}</em></span><small>Gọi</small></a>
                  <a class="bio__link" href="${A.zalo}" target="_blank" rel="noopener" data-zalo><span>${ico('i-zalo')}<em>Zalo I Tuấn Việt</em></span><small>Mở</small></a>
                </div>
                <a class="kb-btn kb-btn--primary kb-btn--block kb-side__go" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>Nhận tư vấn Marketing ${ico('i-arrow')}</a>
              </div>
            </div>
          </aside>`;
}

function articlePage(a, all) {
  const p = pillarBySlug(a.pillar);
  const rel = a.rel;
  const pPath = articlePath(a);
  const url = abs(pPath);
  const hasCover = !!(a.cover && a.cover.base);                       // bài không có ảnh bìa: bỏ hẳn khối ảnh
  const img = hasCover ? kbImgAbs(a, `${a.cover.base}.jpg`) : abs('assets/kb/goc-kien-thuc.jpg');
  const crumbItems = [
    { name: 'Trang chủ', href: rel, url: `${ORIGIN}/` },
    { name: SITE.hub.name, href: `${rel}${hubPath}`, url: abs(hubPath) },
    { name: p.name, href: `${rel}${pillarPath(p)}`, url: abs(pillarPath(p)) },
    { name: a.title, url }
  ];

  const takeaways = (a.takeaways || []).map(t => `<li>${esc(t)}</li>`).join('');

  // Bài viết có liên quan (tối đa RELATED_MAX = 9, hiển thị trên 1 thanh trượt ngang tự chạy chậm kiểu casual).
  const related = relatedPosts(a, all);
  const relatedHtml = `<div class="kb-more__viewport" data-more-viewport>
          <div class="kb-more__track" data-more-track>${related.map(r => postCard(r, rel, { variant: 'slide' })).join('')}</div>
        </div>`;

  const h2count = a.toc.filter(t => t.level === 2).length;
  const COVER_ART = '(min-width: 840px) 760px, 100vw';               // ảnh bìa nằm trong cột nội dung 760px

  const main = `
    <article class="kb-art">
      <div class="container">
        <div class="kb-art__grid">
          <div class="kb-art__main">
            <header class="kb-art__head">
              ${crumbs(rel, crumbItems)}
              <h1 class="kb-art__h1" data-fit data-fit-min="20">${a.titleHtml || esc(a.title)}</h1>
              <p class="kb-art__sapo">${a.sapoHtml}</p>
              <div class="kb-art__by">
                <a class="kb-art__who" href="${rel}" rel="author"><img src="${rel}${A.avatar}.webp" alt="Ảnh đại diện ${A.name}" width="48" height="48"><span><b>${A.name} ${ico('i-verified')}</b><small>${esc(A.role)}</small></span></a>
                <ul class="kb-art__dates">
                  <li>${ico('i-calendar')}<span>Đăng ngày <time datetime="${a.published}">${vnDate(a.published)}</time></span></li>
                  <li>${ico('i-refresh')}<span>Cập nhật <time datetime="${a.modified}">${vnDate(a.modified)}</time></span></li>
                </ul>
              </div>
            </header>

${hasCover ? `<figure class="kb-art__cover">
              ${cover(a, rel, { sizes: COVER_ART, lazy: false, alt: a.cover.alt, priority: true })}
              <figcaption>${esc(a.cover.caption)}</figcaption>
            </figure>` : ''}

            <section class="kb-sum" aria-labelledby="tom-tat">
              <p class="kb-sum__t" id="tom-tat">${ico('i-notes')}Tóm tắt nhanh</p>
              <ul>${takeaways}</ul>
            </section>

            <details class="kb-toc2">
              <summary><span class="kb-toc2__t">${ico('i-list')}Mục lục bài viết</span><span class="kb-toc2__n">${h2count} phần</span><span class="kb-toc2__ico" aria-hidden="true"></span></summary>
              <nav aria-label="Mục lục">${tocList(a.toc, 'kb-toc__list')}</nav>
            </details>

            <div class="kb-prose">
${a.bodyHtml}
            </div>

            <section class="kb-authorbox" aria-label="Về tác giả">
              <img class="kb-authorbox__photo" src="${rel}${A.avatar}.webp" alt="${A.name}, ${esc(A.role)}" width="96" height="96" loading="lazy" decoding="async">
              <div class="kb-authorbox__body">
                <p class="kb-authorbox__name">${A.name} ${ico('i-verified')}</p>
                <p class="kb-authorbox__role">${esc(A.jobTitle)} tại <a href="${A.worksFor.url}" target="_blank" rel="noopener">${esc(A.worksFor.name)}</a></p>
                <p class="kb-authorbox__slogan"><b class="kb-authorbox__pos">${esc(A.positioning)}</b>${esc(A.slogan)}</p>
                <p class="kb-authorbox__bio">${esc(A.bio).replace(A.name, `<a href="${rel}">${A.name}</a>`)}</p>
                <div class="kb-authorbox__links">
                  <a href="${rel}" rel="author">Xem Portfolio ${ico('i-arrow')}</a>
                  <a href="${rel}#du-an">Dự án đã triển khai ${ico('i-arrow')}</a>
                  <a href="${rel}#lien-he">Liên hệ ${ico('i-arrow')}</a>
                </div>
              </div>
            </section>

            <div class="kb-art__end">
              ${shareLinks(url, a.title, 'kb-share--end')}
            </div>
          </div>

          ${articleSide(a, all, rel)}
        </div>
      </div>
    </article>

${related.length ? `
    <section class="kb-more" aria-labelledby="kb-more-title">
      <div class="container">
        <header class="kb-head">
          <h2 class="kb-head__t" id="kb-more-title" data-fit data-split>Bài viết có <span class="grad">liên quan</span></h2>
          <div class="kb-more__actions">
            <div class="kb-more__nav" aria-label="Điều hướng bài viết liên quan">
              <button class="round kb-more__btn" type="button" data-more-nav="-1" aria-label="Bài trước">${ico('i-chev-r', 'kb-pager__prev')}</button>
              <button class="round kb-more__btn" type="button" data-more-nav="1" aria-label="Bài tiếp">${ico('i-chev-r')}</button>
            </div>
            <a class="btn btn--dark btn--sm magnetic" href="${rel}${hubPath}">Tất cả bài viết ${ico('i-arrow', 'ico ico--arrow')}</a>
          </div>
        </header>
        ${relatedHtml}
      </div>
    </section>` : ''}`;

  const after = `
  <div class="kb-bar" aria-hidden="true">
    <button class="kb-bar__toc" type="button" data-sheet-open aria-controls="kb-sheet">${ico('i-list')}<span>Mục lục</span></button>
    <a class="kb-bar__main" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>${ico('i-zalo')}<span>Nhắn Zalo cho tôi</span></a>
    <a class="kb-bar__call" href="tel:${A.phoneRaw}" aria-label="Gọi ${A.phone}">${ico('i-phone')}</a>
  </div>
  <dialog class="kb-sheet" id="kb-sheet" aria-labelledby="kb-sheet-t">
    <div class="kb-sheet__head"><p id="kb-sheet-t">${ico('i-list')}Mục lục bài viết</p><button type="button" data-sheet-close aria-label="Đóng mục lục">${ico('i-close')}</button></div>
    <nav class="kb-sheet__body" aria-label="Mục lục">${tocList(a.toc, 'kb-toc__list')}</nav>
  </dialog>`;

  const faqLd = (a.faq && a.faq.length) ? [{
    '@type': 'FAQPage', '@id': `${url}#faq`, isPartOf: { '@id': `${url}#webpage` }, inLanguage: SITE.lang,
    mainEntity: a.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  }] : [];

  // HowTo: các H3 "Bước n: …" hiển thị trên trang (schema khớp nội dung nhìn thấy)
  const howtoLd = (a.howto && a.steps.length) ? [{
    '@type': 'HowTo', '@id': `${url}#howto`, name: a.howto.name, description: a.howto.description, inLanguage: SITE.lang,
    isPartOf: { '@id': `${url}#webpage` }, image: { '@id': `${url}#primaryimage` },
    step: a.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${url}#${s.id}` }))
  }] : [];

  const ld = [
    websiteLd(),
    personLd(),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: a.seoTitle || a.title, description: a.description,
      isPartOf: [{ '@id': `${ORIGIN}/#website` }, { '@id': `${abs(pillarPath(pillarBySlug(a.pillar)))}#webpage` }], primaryImageOfPage: { '@id': `${url}#primaryimage` },
      breadcrumb: { '@id': `${url}#breadcrumb` }, inLanguage: SITE.lang, datePublished: a.published, dateModified: a.modified,
      author: { '@id': `${ORIGIN}/#person` },
      ...(related.length ? { relatedLink: related.map(r => abs(articlePath(r))) } : {})
    },
    { '@type': 'ImageObject', '@id': `${url}#primaryimage`, url: img, contentUrl: img, width: 1200, height: 630, caption: hasCover ? a.cover.caption : a.title, inLanguage: SITE.lang },
    {
      '@type': 'BlogPosting', '@id': `${url}#article`, isPartOf: { '@id': `${url}#webpage` }, mainEntityOfPage: { '@id': `${url}#webpage` },
      headline: a.title, description: a.description, image: { '@id': `${url}#primaryimage` },
      author: { '@type': 'Person', '@id': `${ORIGIN}/#person`, name: A.name, url: A.url, jobTitle: A.jobTitle },
      publisher: { '@id': `${ORIGIN}/#person` },
      datePublished: a.published, dateModified: a.modified, inLanguage: SITE.lang,
      articleSection: p.name, keywords: (a.keywords || []).join(', '), wordCount: a.total, timeRequired: `PT${a.readMin}M`,
      about: (a.about || []).map(x => ({ '@type': 'Thing', name: x.name, sameAs: x.sameAs })),
      // Nơi làm việc của tác giả được trỏ về đúng thực thể đã khai báo trong Person.worksFor
      mentions: (a.mentions || []).map(x => x.name === A.worksFor.name ? { '@id': `${ORIGIN}/#taki-group` }
        : ({ '@type': x.type || 'Thing', name: x.name, ...(x.url ? { url: x.url } : {}), ...(x.sameAs ? { sameAs: x.sameAs } : {}) })),
      citation: (a.references || []).filter(r => !String(r.url || '').startsWith(ORIGIN)).map(r => ({ '@type': 'CreativeWork', name: r.text, ...(r.url ? { url: r.url } : {}) }))
    },
    breadcrumbLd(url, crumbItems),
    ...howtoLd,
    ...faqLd
  ];

  return page({
    rel, pagePath: pPath, articles: all,
    title: a.seoTitle || a.title,
    ogTitle: a.title,
    description: a.description,
    ogType: 'article',
    image: img, imageAlt: hasCover ? a.cover.alt : a.title,
    articleMeta: `
  <meta property="article:published_time" content="${a.published}">
  <meta property="article:modified_time" content="${a.modified}">
  <meta property="article:author" content="${A.url}">
  <meta property="article:section" content="${esc(p.name)}">${(a.keywords || []).map(k => `\n  <meta property="article:tag" content="${esc(k)}">`).join('')}`,
    preload: !hasCover ? '' : `\n  <link rel="preload" as="image" href="${kbImg(a, `${a.cover.base}.webp`, rel)}" imagesrcset="${kbImg(a, `${a.cover.base}-320.webp`, rel)} 320w, ${kbImg(a, `${a.cover.base}-640.webp`, rel)} 640w, ${kbImg(a, `${a.cover.base}.webp`, rel)} 1200w, ${kbImg(a, `${a.cover.base}-1600.webp`, rel)} 1600w" imagesizes="(min-width: 840px) 760px, 100vw" type="image/webp" fetchpriority="high">`,
    ld, bodyClass: 'kb--article', main, after, css: 'kb-article',
    ...(a.draft ? { robots: 'noindex, nofollow', draft: true } : {})
  });
}

/* ----------------------------------------------------------------------------
   Trang Chính sách bảo mật & Điều khoản sử dụng (VI + EN)
---------------------------------------------------------------------------- */
function legalSide(doc, all, rel) {
  const isEn = doc.lang === 'en';
  const counts = pillarCounts(all.filter(x => day(x.published) <= doc.updatedIso));   // đóng băng theo ngày cập nhật của trang
  const privacyPath = isEn ? 'en/privacy-policy/' : 'chinh-sach-bao-mat/';
  const termsPath = isEn ? 'en/terms-of-use/' : 'dieu-khoan-su-dung/';
  const cats = SITE.pillars.map(p => {
    const n = counts[p.slug];
    const name = isEn && p.en ? p.en.name : p.name;
    return `<li><a class="kb-side__cat" href="${rel}${pillarPath(p)}">${ico('i-chev-r')}<span class="kb-side__cname">${esc(name)}</span>${n ? `<span class="kb-side__n">${n}</span>` : ''}</a></li>`;
  }).join('\n                ');
  return `<aside class="kb-art__aside" aria-label="${isEn ? 'Legal navigation, categories and contact' : 'Tài liệu pháp lý, chuyên mục và liên hệ'}">
            <div class="kb-side" data-kb-recent="${rel}${RECENT}">
              ${searchBox(rel, { id: 'kb-sq', side: true, lang: doc.lang })}
              <nav class="kb-side__box" aria-labelledby="kb-side-legal">
                <p class="kb-side__t" id="kb-side-legal">${isEn ? 'Policies & Terms' : 'Chính sách & Điều khoản'}</p>
                <ul class="kb-side__cats">
                  <li><a class="kb-side__cat${doc.key === 'privacy' ? ' is-current' : ''}" href="${rel}${privacyPath}"${doc.key === 'privacy' ? ' aria-current="page"' : ''}>${ico('i-chev-r')}<span class="kb-side__cname">${isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}</span></a></li>
                  <li><a class="kb-side__cat${doc.key === 'terms' ? ' is-current' : ''}" href="${rel}${termsPath}"${doc.key === 'terms' ? ' aria-current="page"' : ''}>${ico('i-chev-r')}<span class="kb-side__cname">${isEn ? 'Terms of Use' : 'Điều khoản sử dụng'}</span></a></li>
                  <li><a class="kb-side__cat" href="${rel}${doc.altPath}" hreflang="${doc.altLang}">${ico('i-globe')}<span class="kb-side__cname">${isEn ? 'Phiên bản Tiếng Việt (VI)' : 'English Version (EN)'}</span></a></li>
                </ul>
              </nav>
              <nav class="kb-side__box" aria-labelledby="kb-side-cat">
                <p class="kb-side__t" id="kb-side-cat">${isEn ? 'Knowledge Hub' : 'Chuyên mục'}</p>
                <ul class="kb-side__cats">
                ${cats}
                </ul>
              </nav>
            </div>
            <div class="kb-side__cta bio">
              <div class="bio__photo"><img src="${rel}${A.photo}" alt="${A.name}, ${esc(isEn ? A.jobTitle : A.role)}" loading="lazy" decoding="async" width="760" height="760"></div>
              <div class="bio__body">
                <div class="bio__sig"><img src="${rel}assets/img/signature.png" alt="${isEn ? `Signature of ${A.name}` : `Chữ ký ${A.name}`}" width="984" height="346" loading="lazy" decoding="async"></div>
                <div class="bio__links">
                  <button class="bio__link" type="button" data-copy="${A.email}"><span>${ico('i-mail')}<em>${A.email}</em></span><small>${isEn ? 'Copy' : 'Sao chép'}</small></button>
                  <a class="bio__link" href="tel:${A.phoneRaw}"><span>${ico('i-phone')}<em>${A.phone}</em></span><small>${isEn ? 'Call' : 'Gọi'}</small></a>
                  <a class="bio__link" href="${A.zalo}" target="_blank" rel="noopener" data-zalo><span>${ico('i-zalo')}<em>Zalo I Tuấn Việt</em></span><small>${isEn ? 'Open' : 'Mở'}</small></a>
                </div>
                <a class="kb-btn kb-btn--primary kb-btn--block kb-side__go" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>${isEn ? 'Get Marketing Consultation' : 'Nhận tư vấn Marketing'} ${ico('i-arrow')}</a>
              </div>
            </div>
          </aside>`;
}

function legalPage(doc, all) {
  const isEn = doc.lang === 'en';
  const pPath = doc.path;
  const rel = relRoot(pPath);
  const url = abs(pPath);
  const viPath = isEn ? doc.altPath : doc.path;
  const enPath = isEn ? doc.path : doc.altPath;
  const privacyPath = isEn ? 'en/privacy-policy/' : 'chinh-sach-bao-mat/';
  const termsPath = isEn ? 'en/terms-of-use/' : 'dieu-khoan-su-dung/';
  // Cùng ảnh chia sẻ với trang chủ (1672×941); assets/img/og-image.jpg chưa từng tồn tại nên trước đây ảnh xem trước bị 404
  const img = abs('assets/frames/frame-08.jpg');

  const crumbItems = [
    { name: isEn ? 'Home' : 'Trang chủ', href: isEn ? `${rel}?lang=en` : rel, url: isEn ? `${ORIGIN}/?lang=en` : `${ORIGIN}/` },
    { name: doc.title, url }
  ];

  const toc = (doc.sections || []).map(s => ({
    level: 2,
    id: s.id,
    text: s.title.replace(/^\d+\.\s*/, '')
  }));
  const h2count = toc.length;

  let body = (doc.sections || []).map(s => `<h2 id="${s.id}">${esc(s.title)}</h2>\n${s.html}`).join('\n\n');
  body = body.replace(/href="\/([^"]*)"/g, (_, p) => `href="${rel}${p}"`);

  const sapoHtml = (doc.sapo || []).map(p => `<p class="kb-art__sapo">${p}</p>`).join('\n              ');

  const authorBio = isEn
    ? `<a href="${rel}?lang=en">${A.name}</a> has over 6 years of experience leading In-house Marketing and Agency teams, advising more than 200 SMEs on brand strategy, multi-channel marketing operations, and AI-powered workflow systems.`
    : esc(A.bio).replace(A.name, `<a href="${rel}">${A.name}</a>`);
  const authorSlogan = isEn
    ? 'Right strategy – Right system – Measurable outcomes.'
    : esc(A.slogan);

  const main = `
    <article class="kb-art kb-art--legal">
      <div class="container">
        <div class="kb-art__grid">
          <div class="kb-art__main">
            <header class="kb-art__head">
              <div class="kb-legal__top">
                ${crumbs(rel, crumbItems, doc.lang)}
                <div class="kb-legal__lang" role="group" aria-label="${isEn ? 'Language switcher' : 'Chuyển ngôn ngữ'}">
                  <a href="${rel}${viPath}"${!isEn ? ' class="is-active" aria-current="page"' : ''} hreflang="vi" lang="vi">VI</a>
                  <a href="${rel}${enPath}"${isEn ? ' class="is-active" aria-current="page"' : ''} hreflang="en" lang="en">EN</a>
                </div>
              </div>
              <nav class="kb-legal__tabs" aria-label="${isEn ? 'Legal documents' : 'Văn bản pháp lý'}">
                <a class="kb-legal__tab${doc.key === 'privacy' ? ' is-active' : ''}" href="${rel}${privacyPath}"${doc.key === 'privacy' ? ' aria-current="page"' : ''}>${ico('i-shield')}<span>${isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}</span></a>
                <a class="kb-legal__tab${doc.key === 'terms' ? ' is-active' : ''}" href="${rel}${termsPath}"${doc.key === 'terms' ? ' aria-current="page"' : ''}>${ico('i-notes')}<span>${isEn ? 'Terms of Use' : 'Điều khoản sử dụng'}</span></a>
              </nav>
              <h1 class="kb-art__h1" data-fit data-fit-min="20">${esc(doc.title)}</h1>
              ${sapoHtml}
              <div class="kb-art__by">
                <a class="kb-art__who" href="${isEn ? `${rel}?lang=en` : rel}" rel="author"><img src="${rel}${A.avatar}.webp" alt="${A.name}" width="48" height="48"><span><b>${A.name} ${ico('i-verified')}</b><small>${esc(isEn ? A.jobTitle : A.role)}</small></span></a>
                <ul class="kb-art__dates">
                  <li>${ico('i-refresh')}<span>${esc(doc.updatedLabel)}: <time datetime="${doc.updatedIso}">${esc(doc.updatedText)}</time></span></li>
                </ul>
              </div>
            </header>

            <details class="kb-toc2">
              <summary><span class="kb-toc2__t">${ico('i-list')}${esc(doc.tocTitle)}</span><span class="kb-toc2__n">${h2count} ${esc(doc.tocCountUnit)}</span><span class="kb-toc2__ico" aria-hidden="true"></span></summary>
              <nav aria-label="${esc(doc.tocTitle)}">${tocList(toc, 'kb-toc__list')}</nav>
            </details>

            <div class="kb-prose">
${body}
            </div>

            <section class="kb-authorbox" aria-label="${isEn ? 'Website operator' : 'Người quản lý website'}">
              <img class="kb-authorbox__photo" src="${rel}${A.avatar}.webp" alt="${A.name}" width="96" height="96" loading="lazy" decoding="async">
              <div class="kb-authorbox__body">
                <p class="kb-authorbox__name">${A.name} ${ico('i-verified')}</p>
                <p class="kb-authorbox__role">${esc(A.jobTitle)} ${isEn ? 'at' : 'tại'} <a href="${A.worksFor.url}" target="_blank" rel="noopener">${esc(A.worksFor.name)}</a></p>
                <p class="kb-authorbox__slogan"><b class="kb-authorbox__pos">${esc(A.positioning)}</b>${authorSlogan}</p>
                <p class="kb-authorbox__bio">${authorBio}</p>
                <div class="kb-authorbox__links">
                  <a href="${isEn ? `${rel}?lang=en` : rel}" rel="author">${isEn ? 'View Portfolio' : 'Xem Portfolio'} ${ico('i-arrow')}</a>
                  <a href="${rel}${doc.siblingPath}">${esc(doc.siblingName)} ${ico('i-arrow')}</a>
                  <a href="${isEn ? `${rel}?lang=en#lien-he` : `${rel}#lien-he`}">${isEn ? 'Contact' : 'Liên hệ'} ${ico('i-arrow')}</a>
                </div>
              </div>
            </section>

            <div class="kb-art__end">
              ${shareLinks(url, doc.title, 'kb-share--end', doc.lang)}
            </div>
          </div>

          ${legalSide(doc, all, rel)}
        </div>
      </div>
    </article>`;

  const after = `
  <div class="lang-float" data-always role="group" aria-label="${isEn ? 'Switch language' : 'Chuyển đổi ngôn ngữ'}">
    <a class="lang-btn${isEn ? ' is-on' : ''}" href="${rel}${enPath}" hreflang="en" lang="en"${isEn ? ' aria-current="page"' : ''}>EN</a>
    <span class="lang-sep" aria-hidden="true">|</span>
    <a class="lang-btn${!isEn ? ' is-on' : ''}" href="${rel}${viPath}" hreflang="vi" lang="vi"${!isEn ? ' aria-current="page"' : ''}>VI</a>
  </div>
  <div class="kb-bar" aria-hidden="true">
    <button class="kb-bar__toc" type="button" data-sheet-open aria-controls="kb-sheet">${ico('i-list')}<span>${isEn ? 'Contents' : 'Mục lục'}</span></button>
    <a class="kb-bar__main" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>${ico('i-zalo')}<span>${isEn ? 'Message on Zalo' : 'Nhắn Zalo cho tôi'}</span></a>
    <a class="kb-bar__call" href="tel:${A.phoneRaw}" aria-label="${isEn ? 'Call' : 'Gọi'} ${A.phone}">${ico('i-phone')}</a>
  </div>
  <dialog class="kb-sheet" id="kb-sheet" aria-labelledby="kb-sheet-t">
    <div class="kb-sheet__head"><p id="kb-sheet-t">${ico('i-list')}${esc(doc.tocTitle)}</p><button type="button" data-sheet-close aria-label="${isEn ? 'Close table of contents' : 'Đóng mục lục'}">${ico('i-close')}</button></div>
    <nav class="kb-sheet__body" aria-label="${esc(doc.tocTitle)}">${tocList(toc, 'kb-toc__list')}</nav>
  </dialog>`;

  const ld = [
    websiteLd(),
    personLd(doc.lang),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: doc.seoTitle || doc.title, description: doc.description,
      isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#person` }, author: { '@id': `${ORIGIN}/#person` },
      breadcrumb: { '@id': `${url}#breadcrumb` }, inLanguage: isEn ? 'en-US' : SITE.lang,
      datePublished: doc.updatedIso, dateModified: doc.updatedIso
    },
    breadcrumbLd(url, crumbItems)
  ];

  return page({
    rel, pagePath: pPath, articles: all,
    title: doc.seoTitle || doc.title,
    ogTitle: doc.title,
    description: doc.description,
    image: img, imageAlt: doc.title, imageWidth: 1672, imageHeight: 941,
    ld, bodyClass: 'kb--article kb--legal', main, after, css: 'kb-article',
    lang: doc.lang, locale: doc.locale,
    hreflangs: {
      vi: abs(viPath),
      en: abs(enPath),
      'x-default': abs(viPath)
    },
    navActive: ''
  });
}

/* ----------------------------------------------------------------------------
   Trang tổng + trang chủ đề
---------------------------------------------------------------------------- */
function pillarCounts(all) {
  const c = {};
  SITE.pillars.forEach(p => { c[p.slug] = all.filter(a => a.pillar === p.slug).length; });
  return c;
}

function hubPage(all) {
  const rel = relRoot(hubPath);
  const url = abs(hubPath);
  const counts = pillarCounts(all);
  const img = abs('assets/kb/goc-kien-thuc.jpg');
  const crumbItems = [{ name: 'Trang chủ', href: rel, url: `${ORIGIN}/` }, { name: SITE.hub.name, url }];

  // Khi đã có nhiều bài (từ 5 bài): thêm một khối riêng cho từng chủ đề có bài, như SEODO
  const blocks = all.length >= 5 ? SITE.pillars.filter(p => counts[p.slug]).map((p, i) => `
    <section class="section kb-sec${i % 2 ? '' : ' kb-sec--soft'}" aria-labelledby="kb-b-${p.slug}">
      <div class="container">
        <header class="kb-head">
          <h2 class="kb-head__t" id="kb-b-${p.slug}" data-fit data-split>${p.h1Html}</h2>
          <a class="btn btn--dark btn--sm magnetic" href="${rel}${pillarPath(p)}">Xem thêm ${ico('i-arrow', 'ico ico--arrow')}</a>
        </header>
        ${postList(all.filter(a => a.pillar === p.slug).slice(0, 4), rel)}
      </div>
    </section>`).join('') : '';

  const main = `
    ${topHero(rel, crumbItems, { h1Html: SITE.hub.h1Html, lead: SITE.hub.lead, hub: true })}

    <section class="kb-cats-sec" aria-label="Chủ đề kiến thức">
      <div class="container">
        <div class="kb-cats">
          ${SITE.pillars.map(p => catCard(p, counts[p.slug], rel)).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section kb-sec kb-sec--latest" aria-labelledby="kb-latest-title">
      <div class="container">
        <header class="kb-head">
          <h2 class="kb-head__t" id="kb-latest-title" data-fit data-split>Bài viết <span class="grad">mới nhất</span></h2>
        </header>
        ${all.length ? postList(all.slice(0, 4), rel) : '<p class="kb-none">Bài viết đầu tiên đang được biên soạn</p>'}
      </div>
    </section>
${blocks}
    ${ctaPanel(rel)}`;

  const ld = [
    websiteLd(), personLd(),
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: SITE.hub.title, description: SITE.hub.description,
      isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#person` }, author: { '@id': `${ORIGIN}/#person` },
      breadcrumb: { '@id': `${url}#breadcrumb` }, inLanguage: SITE.lang,
      primaryImageOfPage: { '@type': 'ImageObject', url: img, width: 1200, height: 630 },
      mainEntity: {
        '@type': 'ItemList', name: 'Bài viết mới nhất', numberOfItems: all.length,
        itemListElement: all.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(articlePath(a)), name: a.title }))
      },
      hasPart: SITE.pillars.map(p => ({ '@type': 'CollectionPage', '@id': `${abs(pillarPath(p))}#webpage`, url: abs(pillarPath(p)), name: p.name }))
    },
    breadcrumbLd(url, crumbItems)
  ];

  return page({
    rel, pagePath: hubPath, articles: all, title: SITE.hub.title, description: SITE.hub.description,
    image: img, imageAlt: 'Góc kiến thức Marketing của Lê Tuấn Việt', ld, bodyClass: 'kb--hub', main
  });
}

/* Trang chủ đề: "Bài viết nổi bật" (tối đa 4, chỉ ở trang 1) rồi "Bài viết mới nhất" (tối đa 9/trang, phân
   trang 1 2 3 … N như seodo.vn/goc-kien-thuc/kien-thuc-seo/). pageNum > 1 → /goc-kien-thuc/<chủ đề>/trang/N/ */
function pillarPage(p, all, pageNum = 1) {
  const list = all.filter(a => a.pillar === p.slug);
  const totalPages = Math.max(1, Math.ceil(list.length / LATEST_PER_PAGE));
  pageNum = Math.min(Math.max(1, pageNum), totalPages);
  const pPath = pillarPageN(p, pageNum);
  const rel = relRoot(pPath);
  const url = abs(pPath);
  const img = abs('assets/kb/goc-kien-thuc.jpg');
  const crumbItems = [
    { name: 'Trang chủ', href: rel, url: `${ORIGIN}/` },
    { name: SITE.hub.name, href: `${rel}${hubPath}`, url: abs(hubPath) },
    { name: p.name, url: abs(pillarPath(p)) }
  ];
  const latest = all[0];
  const pageItems = list.slice((pageNum - 1) * LATEST_PER_PAGE, pageNum * LATEST_PER_PAGE);

  const body = !list.length
    ? `<section class="section kb-sec kb-sec--first" aria-labelledby="kb-list-title">
      <div class="container">
        <div class="kb-empty">
          <span class="kb-empty__ico">${ico(p.icon)}</span>
          <h2 class="kb-empty__t" id="kb-list-title">Bài viết đầu tiên đang được biên soạn</h2>
          <p class="kb-empty__d">${esc(p.empty || `Tôi đang viết những bài đầu tiên cho chủ đề ${p.name}`)}. Nếu bạn cần trao đổi ngay, hãy nhắn cho tôi qua Zalo</p>
          <div class="btn-row">
            <a class="btn btn--dark btn--sm magnetic" href="${rel}${hubPath}">Xem Góc kiến thức ${ico('i-arrow', 'ico ico--arrow')}</a>
            <a class="btn btn--ghost btn--sm magnetic" href="${A.zalo}" target="_blank" rel="noopener" data-zalo>Nhắn Zalo ${ico('i-arrow-up-right', 'ico ico--arrow')}</a>
          </div>
        </div>${latest ? `
        <header class="kb-head kb-head--gap">
          <h2 class="kb-head__t" data-fit data-split>Có thể bạn <span class="grad">quan tâm</span></h2>
        </header>
        ${postList([latest], rel)}` : ''}
      </div>
    </section>`
    : `${pageNum === 1 ? `<section class="section kb-sec kb-sec--first" aria-labelledby="kb-feat-title">
      <div class="container">
        <header class="kb-head">
          <h2 class="kb-head__t" id="kb-feat-title" data-fit data-split>Bài viết <span class="grad">nổi bật</span></h2>
        </header>
        ${postList(list.slice(0, FEATURED_MAX), rel)}
      </div>
    </section>` : ''}
    <section class="section kb-sec kb-sec--soft${pageNum === 1 ? '' : ' kb-sec--first'}" aria-labelledby="kb-list-title">
      <div class="container">
        <header class="kb-head">
          <h2 class="kb-head__t" id="kb-list-title" data-fit data-split>Bài viết <span class="grad">mới nhất</span></h2>
        </header>
        <div class="kb-grid">${pageItems.map(a => postCard(a, rel, { headingTag: 'h3' })).join('')}</div>
        ${totalPages > 1 ? pager(p, rel, pageNum, totalPages) : ''}
      </div>
    </section>`;

  const main = `
    ${topHero(rel, crumbItems, { h1Html: p.h1Html, lead: p.intro })}
    ${body}
    ${ctaPanel(rel)}`;

  const ld = [
    websiteLd(), personLd(),
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: p.title, description: p.description,
      isPartOf: { '@id': `${abs(hubPath)}#webpage` }, about: { '@type': 'Thing', name: p.name }, author: { '@id': `${ORIGIN}/#person` },
      breadcrumb: { '@id': `${url}#breadcrumb` }, inLanguage: SITE.lang,
      ...(list.length ? { mainEntity: { '@type': 'ItemList', numberOfItems: list.length, itemListElement: pageItems.map((a, i) => ({ '@type': 'ListItem', position: (pageNum - 1) * LATEST_PER_PAGE + i + 1, url: abs(articlePath(a)), name: a.title })) } } : {})
    },
    breadcrumbLd(url, crumbItems)
  ];

  return page({
    rel, pagePath: pPath, articles: all,
    title: pageNum > 1 ? `${p.title} (Trang ${pageNum})` : p.title,
    description: p.description,
    flexTitle: pageNum > 1,
    // Chủ đề chưa có bài: chưa cho Google lập chỉ mục (tránh trang mỏng), vẫn cho đi theo liên kết
    robots: list.length ? undefined : 'noindex, follow',
    image: img, imageAlt: `${p.name}, Góc kiến thức của Lê Tuấn Việt`, ld, bodyClass: 'kb--pillar', main
  });
}

/* ----------------------------------------------------------------------------
   Trang chủ: menu thả xuống, menu di động, section "Góc kiến thức"
---------------------------------------------------------------------------- */
function homeSection(all) {
  const rel = '';
  const counts = pillarCounts(all);
  const a = all[0];
  // Tiêu đề: dùng lại titleHtml (đã có &nbsp; chống rớt chữ giữa cụm từ) nhưng bỏ span màu gradient,
  // vì thẻ này nằm trên nền tối và chữ đã trắng sẵn.
  const homeTitle = a ? cardTitle(a) : '';
  const post = a ? `<article class="kbh-post spot is-dark rv">
            ${a.cover && a.cover.base ? `<a class="kbh-post__media" href="${articlePath(a)}" tabindex="-1" aria-hidden="true">${cover(a, rel, { sizes: '(min-width: 1025px) 620px, 100vw' })}</a>` : ''}
            <div class="kbh-post__body">
              <h3 class="kbh-post__title"><a href="${articlePath(a)}" data-en="${esc(a.en ? a.en.title : a.title)}">${homeTitle}</a></h3>
              <p class="kbh-post__excerpt" data-en="${esc(a.en ? a.en.excerpt : a.excerpt)}">${esc(a.excerpt || a.description)}</p>
              <div class="kbh-post__foot">
                <span class="kbh-post__by"><img src="${A.avatar}.webp" alt="" width="36" height="36" loading="lazy" decoding="async"><span><b>${A.name}</b><small>${A.jobTitle}</small></span></span>
                <a class="kbh-post__more" href="${articlePath(a)}"><span data-en="Read article">Đọc bài viết</span>${ico('i-arrow')}</a>
              </div>
            </div>
          </article>` : '';
  const pillars = SITE.pillars.map((p, i) => {
    const c = countLabel(counts[p.slug]);
    return `<li><a class="kbh-pillar spot is-dark rv" style="--d:${i}" href="${pillarPath(p)}">
              <span class="kbh-pillar__ico">${ico(p.icon)}</span>
              <span class="kbh-pillar__txt"><b data-en="${esc(p.en.name)}">${esc(p.name)}</b><small data-en="${esc(p.en.short)}">${esc(p.short)}</small></span>
              <span class="kbh-pillar__n${counts[p.slug] ? '' : ' is-soon'}" data-en="${esc(c.en)}">${c.vi}</span>
              ${ico('i-arrow-up-right', 'kbh-pillar__go')}
            </a></li>`;
  }).join('\n            ');
  return `
    <!-- ============ 10. GÓC KIẾN THỨC (tạo bởi tools/kb/build-kb.cjs, sửa trong tools/kb rồi chạy lại) ============ -->
    <section class="section sec-dark kbh" id="kien-thuc" aria-labelledby="kb-title">
      <div class="container">
        <header class="sec-head sec-head--aside">
          <div class="sec-head__top"><a class="btn btn--light btn--sm magnetic kbh__all" href="${hubPath}"><span data-en="View all">Xem tất cả</span> ${ico('i-arrow', 'ico ico--arrow')}</a></div>
          <h2 class="h2" id="kb-title" data-fit data-split><span data-en="">Góc </span><span class="grad" data-en="Knowledge Hub">kiến thức</span></h2>
          <div class="sec-head__foot"><span class="sec-head__rule"></span><p class="desc" data-en="I share marketing knowledge, practical ways to use AI and lessons I have learned from the projects I have delivered for SMEs.">Tôi chia sẻ kiến thức Marketing, cách ứng dụng AI và những bài học rút ra từ các dự án đã triển khai cho doanh nghiệp SME.</p></div>
        </header>
        <div class="kbh__grid">
          ${post}
          <ul class="kbh-pillars" aria-label="Chủ đề kiến thức" data-en-label="Knowledge hub topics">
            ${pillars}
          </ul>
        </div>
        <div class="kbh__foot">
          <p class="kbh__note" lang="en">Articles are currently published in Vietnamese.</p>
          <a class="btn btn--light magnetic kbh__all-m" href="${hubPath}"><span data-en="View all articles">Xem tất cả bài viết</span> ${ico('i-arrow', 'ico ico--arrow')}</a>
        </div>
      </div>
    </section>
    `;
}

function replaceRegion(src, name, html) {
  const re = new RegExp(`(<!-- KB:${name} -->)[\\s\\S]*?(<!-- /KB:${name} -->)`);
  if (!re.test(src)) { console.warn(`  ! Không thấy vùng <!-- KB:${name} --> trong index.html, bỏ qua`); return src; }
  return src.replace(re, (_, a, b) => `${a}${html}${b}`);
}

function updateHome(all) {
  const file = path.join(ROOT, 'index.html');
  let src = fs.readFileSync(file, 'utf8');                     // đọc ngay trước khi ghi (nhiều phiên cùng sửa)
  const before = src;
  src = replaceRegion(src, 'DROPDOWN', `${trigger(hubPath)}${dropdown('')}\n        `);
  src = replaceRegion(src, 'MENU', `\n      ${menuKb('', '07', false)}\n      `);
  src = replaceRegion(src, 'SECTION', homeSection(all));
  if (src !== before) fs.writeFileSync(file, src, 'utf8');
  return src !== before;
}

/* ----------------------------------------------------------------------------
   Sitemap + RSS
---------------------------------------------------------------------------- */
function updateSitemap(all) {
  const file = path.join(ROOT, 'sitemap.xml');
  let src = fs.readFileSync(file, 'utf8');
  const counts = pillarCounts(all);
  const newest = all.length ? day(all.map(a => a.modified).sort().pop()) : day(new Date().toISOString());
  const urls = [
    `  <url>\n    <loc>${abs(hubPath)}</loc>\n    <lastmod>${newest}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  ];
  SITE.pillars.forEach(p => {
    if (!counts[p.slug]) return;                                 // chủ đề trống đang noindex
    const mod = day(all.filter(a => a.pillar === p.slug).map(a => a.modified).sort().pop());
    urls.push(`  <url>\n    <loc>${abs(pillarPath(p))}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  });
  all.forEach(a => {
    // Ảnh bìa + mọi ảnh minh họa trong thân bài (bản lớn nhất trong src), để Google Images thấy hết sơ đồ của bài
    const pageUrl = abs(articlePath(a));
    const imgs = [kbImgAbs(a, `${a.cover.base}.jpg`)];
    for (const m of a.bodyHtml.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) {
      const u = new URL(m[1], pageUrl).href;
      if ((u.startsWith(ORIGIN + '/') || u.startsWith(IMG_ORIGIN + '/')) && !imgs.includes(u)) imgs.push(u);
    }
    const imgXml = imgs.map(u => `\n    <image:image>\n      <image:loc>${u}</image:loc>\n    </image:image>`).join('');
    urls.push(`  <url>\n    <loc>${pageUrl}</loc>\n    <lastmod>${day(a.modified)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>${imgXml}\n  </url>`);
  });
  LEGAL_PAGES.forEach(doc => {
    urls.push(`  <url>\n    <loc>${abs(doc.path)}</loc>\n    <lastmod>${doc.updatedIso}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.5</priority>\n  </url>`);
  });
  const block = `<!-- KB:SITEMAP (tạo bởi tools/kb/build-kb.cjs) -->\n${urls.join('\n')}\n  <!-- /KB:SITEMAP -->`;
  if (/<!-- KB:SITEMAP[\s\S]*?<!-- \/KB:SITEMAP -->/.test(src)) src = src.replace(/<!-- KB:SITEMAP[\s\S]*?<!-- \/KB:SITEMAP -->/, block);
  else src = src.replace('</urlset>', `  ${block}\n</urlset>`);
  fs.writeFileSync(file, src, 'utf8');
}

/* Chỉ mục tìm kiếm cho js/kb-search.js (chỉ tải khi người đọc bắt đầu tìm).
   search.json (bản gọn): mỗi bài có tiêu đề, tóm tắt, từ khóa, các tiêu đề H2/H3, ý tóm tắt, câu hỏi FAQ, thuật ngữ in đậm.
   SEO-Agent cũng đọc tệp này (mảng posts, trường u, t, e, c, d, k để chống trùng bài): giữ nguyên các trường đó.
   Chữ thuần của thân bài (b, điểm thấp nhất, dùng để trích đoạn chứa từ khóa) nằm riêng ở goc-kien-thuc/search/phan-<n>.json,
   mỗi mảnh ≤ SEARCH_PART byte, ĐÁNH SỐ TỪ BÀI CŨ NHẤT (mảnh đã đầy không đổi khi đăng bài mới); "parts" trong search.json
   liệt kê các mảnh theo thứ tự đó, đường dẫn tính từ thư mục goc-kien-thuc/. Trình duyệt tải bản gọn trước, mảnh toàn văn sau. */
const SEARCH_PART = 1024 * 1024;
const SEARCH_DIR = `${HUB}/search`;
function searchIndex(all) {
  const counts = pillarCounts(all);
  const clean = s => plain(s).replace(/\s*\[\d+\]/g, '').replace(/\s+([,.;:!?)])/g, '$1').trim();
  const bodies = all.map(a => ({ u: articlePath(a), b: clean(a.bodyHtml.replace(/<aside class="kb-cta[\s\S]*?<\/aside>/g, ' ').replace(/<(h[23])[\s>][\s\S]*?<\/\1>/g, ' ')) }));
  const groups = [];                                                    // mảnh toàn văn: gom từ bài cũ nhất
  let cur = [], curSize = 0;
  for (const x of bodies.slice().reverse()) {
    const sz = Buffer.byteLength(JSON.stringify(x), 'utf8') + 1;
    if (cur.length && curSize + sz > SEARCH_PART) { groups.push(cur); cur = []; curSize = 0; }
    cur.push(x); curSize += sz;
  }
  if (cur.length) groups.push(cur);
  const parts = groups.map((g, i) => ({ n: i + 1, name: `search/phan-${i + 1}.json`, path: `${SEARCH_DIR}/phan-${i + 1}.json`, text: JSON.stringify({ posts: g.slice().reverse() }) }));
  const slim = JSON.stringify({
    posts: all.map(a => {
      const p = pillarBySlug(a.pillar);
      const strong = [...new Set([...a.bodyHtml.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map(m => clean(m[1])))]
        .filter(s => s.length > 2 && s.length < 90).slice(0, 40);
      return {
        u: articlePath(a), t: a.title, e: a.excerpt || a.description, c: p.name, d: day(a.published), r: a.readMin,
        ...(a.cover && a.cover.base ? { img: kbImg(a, `${a.cover.base}-320.webp`) } : {}),
        k: a.keywords || [],
        h: a.toc.map(t => t.text),
        x: [...(a.takeaways || []), ...(a.faq || []).map(f => f.q), a.description, ...strong].map(clean)
      };
    }),
    pillars: SITE.pillars.map(p => ({ u: pillarPath(p), n: p.name, s: p.short, i: p.icon, c: counts[p.slug], tp: (p.topics || []).map(t => t[0]) })),
    parts: parts.map(p => p.name)
  });
  return { slim, parts };
}

function feed(all) {
  const items = all.map(a => `    <item>
      <title>${esc(a.title)}</title>
      <link>${abs(articlePath(a))}</link>
      <guid isPermaLink="true">${abs(articlePath(a))}</guid>
      <pubDate>${new Date(a.published).toUTCString()}</pubDate>
      <dc:creator>${A.name}</dc:creator>
      <category>${esc(pillarBySlug(a.pillar).name)}</category>
      <description>${esc(a.description)}</description>
${a.cover && a.cover.base ? `
      <enclosure url="${kbImgAbs(a, `${a.cover.base}.jpg`)}" type="image/jpeg" length="0"/>` : ''}
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Góc kiến thức | ${A.name}</title>
    <link>${abs(hubPath)}</link>
    <atom:link href="${abs(HUB + '/feed.xml')}" rel="self" type="application/rss+xml"/>
    <atom:link href="https://pubsubhubbub.appspot.com/" rel="hub"/>
    <description>${esc(SITE.hub.description)}</description>
    <language>vi</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ----------------------------------------------------------------------------
   Báo cáo SEO + GEO
   Checklist Onpage (Chương 25), 6 tín hiệu GEO (Chương 19) trong tài liệu "Đào tạo về SEO và GEO"
   và các quy tắc viết của skill seo-blog-workflow / taki-seo-workflow.
---------------------------------------------------------------------------- */
const mark = (cond, label, detail = '') => `  ${cond ? '✓' : '✗'} ${label}${detail ? `: ${detail}` : ''}`;
const len = s => [...String(s)].length;

function audit(a) {
  const kw = (a.keyword || '').toLowerCase();
  const bodyText = plain(a.bodyHtml.replace(/<aside class="kb-cta[\s\S]*?<\/aside>/g, '')).toLowerCase();
  const sapoText = plain(a.sapoHtml).toLowerCase();
  const all = `${sapoText} ${bodyText}`;
  const occ = kw ? all.split(kw).length - 1 : 0;
  const density = occ / (a.total / 1000);
  const h2 = a.toc.filter(t => t.level === 2), h3 = a.toc.filter(t => t.level === 3);
  const h2kw = h2.filter(t => t.text.toLowerCase().includes(kw)).length;
  const questions = a.toc.filter(t => /\?$/.test(t.text)).length + (a.faq || []).length;
  const bodyNoCta = a.bodyHtml.replace(/<aside class="kb-cta[\s\S]*?<\/aside>/g, '');       // khối kêu gọi không phải nội dung chính
  const lists = (bodyNoCta.match(/<(ul|ol)(\s|>)/g) || []).length - (bodyNoCta.match(/<ol class="kb-steps"/g) || []).length + ((a.takeaways || []).length ? 1 : 0);
  const tables = (a.bodyHtml.match(/<table>/g) || []).length;
  const internalBody = (a.raw.match(/href="\/[^"]*"/g) || []).length;
  const toPillar = a.raw.includes(`href="/${pillarPath(pillarBySlug(a.pillar))}"`);
  const external = (a.bodyHtml.match(/href="https?:\/\//g) || []).length;
  // mỗi nguồn được trích lần đầu mang id="trich-N" (lần trích sau là trich-N-2, N-3…)
  const fns = new Set((a.sapoHtml + a.bodyHtml).match(/id="trich-\d+"/g) || []);
  const imgsNoAlt = (a.bodyHtml.match(/<img(?![^>]*alt=)[^>]*>/g) || []).length;
  const first100 = all.split(/\s+/).slice(0, 100).join(' ');
  const firstSentence = sapoText.split(/(?<=[.?!])\s/)[0] || '';
  const pct = v => v == null ? 'không có' : `${Math.round(v * 100)}%`;
  const dashes = (plain(a.sapo + a.raw).match(/ [–—-] /g) || []).length;
  // Mỗi H2 mở đầu bằng một đoạn văn (Answer-First), không nhảy thẳng vào H3/bảng/danh sách
  const h2NoLead = (a.bodyHtml.match(/<\/h2>\s*<(?!p[\s>]|div class="kb-faq)[a-z]+/g) || []).length;
  // Đoạn văn quá dài (một đoạn một ý): > 90 từ
  const longParas = (a.bodyHtml.match(/<p[^>]*>[\s\S]*?<\/p>/g) || []).filter(p => countWords(p) > 90).length;
  // Thuật ngữ viết tắt được giải nghĩa ở lần đầu (dạng "ABC (…)" hoặc "…, ABC là …")
  const acronyms = ['SME', 'KPI', 'CPL', 'ROAS', 'CPA', 'SWOT', 'SMART', 'STP'];
  const undefinedTerms = acronyms.filter(t => all.includes(t.toLowerCase()) && !new RegExp(`${t}\\s*\\(|${t} là|${t}, gồm|nguyên tắc ${t}|mô hình ${t}|${t} là chi phí`, 'i').test(plain(a.sapoHtml + ' ' + a.bodyHtml)));

  console.log(`\nBÁO CÁO SEO + GEO  ${a.title}`);
  console.log(`  URL: /${articlePath(a)}`);
  console.log('  Onpage');
  console.log(mark(len(a.seoTitle || a.title) >= 50 && len(a.seoTitle || a.title) <= 60, 'Thẻ title 50–60 ký tự, từ khóa ở đầu', `${len(a.seoTitle || a.title)} ký tự`));
  console.log(mark(a.description.length >= 150 && a.description.length <= 160, 'Meta description 150–160 ký tự', `${a.description.length} ký tự`));
  console.log(mark(slugify(a.slug).includes(slugify(a.keyword)), 'URL ngắn, chứa từ khóa, không dấu', `/${a.slug}/`));
  console.log(mark(a.title.toLowerCase().includes(kw), 'H1 duy nhất chứa từ khóa chính'));
  console.log(mark(a.description.toLowerCase().includes(kw), 'Từ khóa trong meta description'));
  console.log(mark(first100.includes(kw), 'Từ khóa trong 100 từ đầu'));
  console.log(mark(h2kw >= 2, 'Từ khóa trong các H2', `${h2kw}/${h2.length} H2`));
  console.log(mark(density >= 3 && density <= 5, 'Mật độ từ khóa 3–5 lần/1.000 từ', `"${a.keyword}" ${occ} lần = ${density.toFixed(1)}/1.000 từ`));
  console.log(mark(h2.length >= 4 && h3.length >= 4, 'Cấu trúc H2/H3 logic', `${h2.length} H2, ${h3.length} H3`));
  console.log(mark(internalBody >= 3 && toPillar, 'Liên kết nội bộ ≥ 3, có link về trang chủ đề (Cluster → Pillar)', `${internalBody} link${toPillar ? ', có' : ', THIẾU'} link về /${pillarPath(pillarBySlug(a.pillar))}`));
  console.log(mark(imgsNoAlt === 0, 'Ảnh có alt, WebP, tên file có nghĩa'));
  console.log('  Nội dung (skill SEO)');
  console.log(mark(a.total >= 1800 && a.total <= 2600, 'Độ dài khoảng 1.800–2.500 từ', `${a.total} từ, ${a.readMin} phút đọc`));
  console.log(mark(sapoText.includes(A.name.toLowerCase()), 'Tên chuyên gia trong sapo'));
  console.log(mark(lists >= 2 && lists <= 4, 'Danh sách 2–4', `${lists}`));
  console.log(mark(tables >= 1, 'Có bảng', `${tables}`));
  console.log(mark(a.ctaPos.mid >= 0.3 && a.ctaPos.mid <= 0.5, 'CTA #1 khoảng 40% bài', pct(a.ctaPos.mid)));
  console.log(mark(a.ctaPos.late >= 0.65 && a.ctaPos.late <= 0.85, 'CTA #2 khoảng 75% bài', pct(a.ctaPos.late)));
  console.log(mark(dashes === 0, 'Không dùng gạch nối giữa câu', `${dashes}`));
  console.log(mark(longParas === 0, 'Mỗi đoạn một ý (không đoạn nào quá 90 từ)', `${longParas}`));
  console.log('  GEO (6 tín hiệu trước khi xuất bản)');
  console.log(mark(firstSentence.includes(kw) && / là /.test(firstSentence), '1. Answer-First: câu đầu sapo trả lời thẳng "là gì"'));
  console.log(mark(h2NoLead === 0, '2. Mỗi H2 mở đầu bằng đoạn trả lời, đi từ tổng quát đến cụ thể', h2NoLead ? `${h2NoLead} H2 thiếu đoạn mở` : ''));
  console.log(mark(questions >= 5, '3. Tiêu đề dạng câu hỏi + FAQ khớp People Also Ask', `${questions} câu hỏi`));
  console.log(mark(/class="kb-def"/.test(a.bodyHtml) && !undefinedTerms.length, '4. Khái niệm then chốt được định nghĩa', undefinedTerms.length ? `chưa giải nghĩa: ${undefinedTerms.join(', ')}` : 'có đoạn định nghĩa + thuật ngữ đã giải nghĩa'));
  console.log(mark((a.takeaways || []).length >= 3 && (a.faq || []).length >= 3, '5. Tự đủ ngữ cảnh: Tóm tắt nhanh + FAQ trả lời trọn ý', `${(a.takeaways || []).length} ý tóm tắt, ${(a.faq || []).length} câu FAQ`));
  /* Số chú thích [n] trong bài đã bỏ theo yêu cầu của chủ trang (2026-09-29), nên chỉ cần bài có
     đủ nguồn trong metadata: chúng đi vào "citation" của dữ liệu có cấu trúc. Bài nào vẫn dùng
     [[n]] thì số trích dẫn phải khớp số nguồn. */
  const refCount = (a.references || []).length;
  console.log(mark(refCount >= 3 && (fns.size === 0 || fns.size === refCount), '6. Factual Grounding: có nguồn cho số liệu',
    `${refCount} nguồn trong dữ liệu có cấu trúc${fns.size ? `, ${fns.size} chú thích trong bài` : ', không hiện số chú thích'}`));
  console.log('  Schema: WebPage, BlogPosting (author = #person), BreadcrumbList, ImageObject'
    + `${a.steps.length ? `, HowTo (${a.steps.length} bước)` : ''}${(a.faq || []).length ? `, FAQPage (${a.faq.length} câu)` : ''}`);
  console.log(`  · Liên kết ngoài: ${external}`);
  console.log(`  · Dàn ý:\n          ${a.toc.map(t => (t.level === 3 ? '    ' : '') + t.text).join('\n          ')}`);
}

function auditPages() {
  console.log('\nKIỂM TRA TẤT CẢ TRANG (title 50–60, meta 150–160, 1 thẻ H1; trang phân trang không bắt buộc title 50–60)');
  PAGES.filter(p => !p.draft).forEach(p => {
    const t = len(p.title), d = len(p.description);
    const titleOk = p.flexTitle ? t <= 70 : (t >= 50 && t <= 60);
    const good = titleOk && d >= 150 && d <= 160 && p.h1 === 1;
    console.log(`  ${good ? '✓' : '✗'} /${p.path}  title ${t}${p.flexTitle ? ' (phân trang)' : ''}, meta ${d}, H1 ${p.h1}${p.indexable ? '' : ', noindex (chủ đề chưa có bài)'}`);
  });
}

/* ----------------------------------------------------------------------------
   Chạy
---------------------------------------------------------------------------- */
function main() {
  const t0 = Date.now();
  const loaded = loadArticles().map(processArticle);
  const all = loaded.filter(a => !a.draft);          // bài đã đăng: dùng cho mọi danh sách, sitemap, RSS, tìm kiếm
  const drafts = loaded.filter(a => a.draft);        // bài nháp / bài mẫu: chỉ dựng trang riêng, noindex
  ALL = all;
  const written = [];
  written.push(writeFile(`${hubPath}index.html`, hubPage(all)));
  SITE.pillars.forEach(p => {
    const n = all.filter(a => a.pillar === p.slug).length;
    const totalPages = Math.max(1, Math.ceil(n / LATEST_PER_PAGE));
    for (let i = 1; i <= totalPages; i++) written.push(writeFile(`${pillarPageN(p, i)}index.html`, pillarPage(p, all, i)));
  });
  all.forEach(a => written.push(writeFile(`${articlePath(a)}index.html`, articlePage(a, all))));
  drafts.forEach(a => written.push(writeFile(`${articlePath(a)}index.html`, articlePage(a, all))));
  LEGAL_PAGES.forEach(doc => written.push(writeFile(`${doc.path}index.html`, legalPage(doc, all))));
  written.push(writeFile(`${HUB}/feed.xml`, feed(all)));
  written.push(writeFile(RECENT, recentJson(all)));
  const search = searchIndex(all);
  written.push(writeFile(`${HUB}/search.json`, search.slim));
  search.parts.forEach(p => written.push(writeFile(p.path, p.text)));
  sweepDir(SEARCH_DIR, new Set(search.parts.map(p => path.basename(p.path))));
  written.push(writeFile('llms.txt', llmsTxt(all)));
  const llms = llmsFull(all);
  written.push(writeFile('llms-full.txt', llms.main));
  llms.parts.forEach(p => written.push(writeFile(p.path, p.text)));
  sweepDir(LLMS_DIR, new Set(llms.parts.map(p => `phan-${p.n}.txt`)));
  updateSitemap(all);
  const homeChanged = updateHome(all);

  // Trang tác giả đã bỏ (trùng portfolio, mọi liên kết tác giả trỏ về trang chủ): xoá thư mục cũ nếu còn
  const oldAuthor = path.join(ROOT, HUB, 'tac-gia');
  if (fs.existsSync(oldAuthor)) { fs.rmSync(oldAuthor, { recursive: true, force: true }); console.log(`  – Đã xoá trang tác giả cũ ${path.relative(ROOT, oldAuthor)}`); }

  // Dọn trang bài viết cũ không còn nguồn (đổi slug / xoá bài) — bỏ qua thư mục "trang" (phân trang, dọn riêng bên dưới)
  const keep = new Set(loaded.map(a => path.join(ROOT, articlePath(a))));
  SITE.pillars.forEach(p => {
    const dir = path.join(ROOT, pillarPath(p));
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'trang').forEach(d => {
      const full = path.join(dir, d.name) + path.sep;
      if (!keep.has(full) && fs.existsSync(path.join(full, 'index.html'))) {
        fs.rmSync(full, { recursive: true, force: true });
        console.log(`  – Đã xoá trang cũ ${path.relative(ROOT, full)}`);
      }
    });
    // Dọn các trang phân trang thừa khi số bài giảm xuống (ví dụ 3 trang còn 1)
    const trangDir = path.join(dir, 'trang');
    if (!fs.existsSync(trangDir)) return;
    const totalPages = Math.max(1, Math.ceil(all.filter(a => a.pillar === p.slug).length / LATEST_PER_PAGE));
    fs.readdirSync(trangDir, { withFileTypes: true }).filter(d => d.isDirectory()).forEach(d => {
      const n = parseInt(d.name, 10);
      if (!Number.isInteger(n) || n < 2 || n > totalPages) {
        fs.rmSync(path.join(trangDir, d.name), { recursive: true, force: true });
        console.log(`  – Đã xoá trang phân trang cũ ${path.relative(ROOT, path.join(trangDir, d.name))}`);
      }
    });
    if (!fs.readdirSync(trangDir).length) fs.rmSync(trangDir, { recursive: true, force: true });
  });
  // Chuyên mục đã gộp: bỏ trang chuyên mục cũ và phân trang của nó (máy chủ chuyển hướng 301, xem _redirects),
  // giữ thư mục các bài còn dùng URL cũ, xoá bài không còn nguồn
  RETIRED.forEach(r => {
    const dir = path.join(ROOT, HUB, r.slug);
    if (!fs.existsSync(dir)) return;
    for (const x of ['index.html', 'trang']) {
      const full = path.join(dir, x);
      if (fs.existsSync(full)) { fs.rmSync(full, { recursive: true, force: true }); console.log(`  – Đã xoá trang chuyên mục cũ ${path.relative(ROOT, full)}`); }
    }
    fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).forEach(d => {
      const full = path.join(dir, d.name) + path.sep;
      if (!keep.has(full) && fs.existsSync(path.join(full, 'index.html'))) {
        fs.rmSync(full, { recursive: true, force: true });
        console.log(`  – Đã xoá trang cũ ${path.relative(ROOT, full)}`);
      }
    });
    if (!fs.readdirSync(dir).length) fs.rmSync(dir, { recursive: true, force: true });
  });

  console.log(`Góc kiến thức: ${all.length} bài, ${written.length} file${homeChanged ? ', đã cập nhật index.html' : ''} (${Date.now() - t0} ms)`);
  written.forEach(f => console.log('  + ' + path.relative(ROOT, f)));
  all.forEach(audit);
  if (drafts.length) console.log(`\nBài mẫu (không lập chỉ mục, không vào trang tổng): ${drafts.map(a => '/' + articlePath(a)).join(', ')}`);
  auditPages();
}

main();
