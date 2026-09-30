// Chuyển hướng 301 về tên miền chính https://letuanviet.com, giữ nguyên đường dẫn và tham số.
// Gắn vào: tên miền cũ letuanviet.digital (cả www) và www.letuanviet.com. Xem wrangler.toml.
export default {
  fetch(request) {
    const target = new URL(request.url);
    target.protocol = 'https:';
    target.hostname = 'letuanviet.com';
    target.port = '';
    return Response.redirect(target.toString(), 301);
  }
};
