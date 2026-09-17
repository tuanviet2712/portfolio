# -*- coding: utf-8 -*-
"""
Dựng dữ liệu hero "video tua theo cuộn" từ MỘT clip AI (mp4):
  1. ffmpeg tách toàn bộ khung hình ra PNG (work/png), chuyển màu BT.709 chính xác
  2. đo chuyển động giữa các khung (optical flow) -> bảng map p -> thời điểm, để cuộn đều thì hình chuyển động đều
  3. ước lượng tâm khuôn mặt trên các khung mẫu (mặt nạ người rembg/BiRefNet) -> đường focus fx/fy cho từng khung
     (màn hình dọc/hẹp cắt khung quanh điểm này để khuôn mặt luôn nằm trong hình)
  4. nén WebP: bộ "full" 1920x1080 (mọi khung) + bộ "tall" cắt dọc quanh khuôn mặt cho điện thoại (nhẹ hơn ~1/2)
  5. poster.jpg (khung đầu) + scene.js (manifest: kích thước, focus, map, danh sách khung, dung lượng từng file)

Chạy:  python build_seq.py --src source.mp4 --out ../../assets/hero/seq --ffmpeg ffmpeg
Xem build-hero-video.ps1 để chạy trọn gói.
"""
import argparse, json, os, subprocess, sys, io, shutil
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def log(*a):
    print(*a, flush=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit('lỗi: ' + ' '.join(cmd) + '\n' + r.stderr[-2000:])
    return r.stdout


def probe(ffprobe, src):
    out = run([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'json', src])
    s = json.loads(out)['streams'][0]
    num, den = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(num) / float(den), int(s.get('nb_frames') or 0)


def extract(ffmpeg, src, png, expect):
    os.makedirs(png, exist_ok=True)
    have = len([f for f in os.listdir(png) if f.endswith('.png')])
    if expect and have == expect:
        log('  đã có %d khung PNG' % have); return have
    for f in os.listdir(png):
        os.remove(os.path.join(png, f))
    log('  ffmpeg tách khung ...')
    # BT.709 (chuẩn HD; clip AI thường không gắn thẻ màu) + chroma đầy đủ để mép màu không bị răng cưa
    run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an',
         '-vf', 'scale=in_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int',
         '-pix_fmt', 'rgb24', '-start_number', '0', os.path.join(png, '%03d.png')])
    return len([f for f in os.listdir(png) if f.endswith('.png')])


def load(png, i):
    return Image.open(os.path.join(png, '%03d.png' % i)).convert('RGB')


# ---------- 2. chuyển động ----------
def motion(png, n, cache):
    if os.path.exists(cache):
        return json.load(open(cache))
    import cv2
    log('  đo chuyển động (optical flow) ...')
    prev = None; med = []
    for i in range(n):
        g = np.array(load(png, i).resize((640, 360), Image.BOX).convert('L'))
        if prev is not None:
            flow = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 4, 21, 3, 5, 1.2, 0)
            med.append(float(np.median(np.hypot(flow[..., 0], flow[..., 1]))))
        prev = g
    json.dump(med, open(cache, 'w'))
    return med


def build_map(med, n, mix=0.65, samples=240):
    """map[k] (k = 0..samples) = thời điểm (khung, số thực) tại p = k/samples.
    Trộn 65 % 'đều theo chuyển động' + 35 % 'đều theo thời gian': đoạn camera chậm (đầu/cuối clip)
    chiếm ít quãng cuộn hơn, đoạn nhanh được kéo dài => tốc độ hình gần đều khi cuộn đều."""
    v = np.maximum(np.array(med, dtype=float), 1e-3)
    cum = np.concatenate([[0.0], np.cumsum(v)]); cum /= cum[-1]           # cum[i] = quãng đường tới khung i
    lin = np.arange(n) / (n - 1)
    s = mix * cum + (1 - mix) * lin                                          # s(i): tăng đơn điệu, s(0)=0, s(n-1)=1
    ps = np.arange(samples + 1) / samples
    t = np.interp(ps, s, np.arange(n, dtype=float))                          # nghịch đảo: p -> i
    return [round(float(x), 3) for x in t]


# ---------- 3. focus (khuôn mặt) ----------
def head_center(mask):
    a = mask > 128
    H, W = a.shape
    rows = np.where(a.any(axis=1))[0]
    if len(rows) == 0:
        return None
    top, bot = int(rows[0]), int(rows[-1])
    ws = np.convolve(a.sum(axis=1).astype(float), np.ones(9) / 9, mode='same')
    runmax, neck = 0.0, bot
    for y in range(top, bot):                        # cổ = hàng đầu tiên hẹp lại rõ so với đầu
        runmax = max(runmax, ws[y])
        if y > top + 60 and ws[y] < 0.74 * runmax:
            neck = y; break
    ys, xs = np.nonzero(a[top:neck])
    return float(xs.mean()) / W, float(ys.mean() + top) / H, (neck - top) / H   # tâm đầu (x, y) và chiều cao đầu, đều chuẩn hoá


def focus(png, n, cache, step=12):
    if os.path.exists(cache):
        pts = json.load(open(cache))
    else:
        from rembg import new_session, remove
        log('  ước lượng khuôn mặt (rembg birefnet-portrait, %d khung mẫu) ...' % (len(range(0, n, step)) + 1))
        sess = new_session('birefnet-portrait')
        pts = []
        for i in sorted(set(list(range(0, n, step)) + [n - 1])):
            m = remove(load(png, i), session=sess, only_mask=True)
            hc = head_center(np.array(m))
            if hc:
                pts.append(dict(i=i, hx=round(hc[0], 4), hy=round(hc[1], 4), hh=round(hc[2], 4)))
                log('    khung %3d: mặt tại (%.3f, %.3f)' % (i, hc[0], hc[1]))
        json.dump(pts, open(cache, 'w'), indent=1)
    from scipy.interpolate import PchipInterpolator
    xs = np.array([p['i'] for p in pts], dtype=float)
    fx = PchipInterpolator(xs, [p['hx'] for p in pts])(np.arange(n))
    fy = PchipInterpolator(xs, [p['hy'] for p in pts])(np.arange(n))
    fh = PchipInterpolator(xs, [p.get('hh', p.get('neck', 0) - p.get('top', 0)) for p in pts])(np.arange(n))
    return [round(float(v), 4) for v in fx], [round(float(v), 4) for v in fy], [round(float(v), 4) for v in fh]


# ---------- 4. nén ----------
def enc_one(args):
    png, i, out, box, q = args
    im = load(png, i)
    if box:
        im = im.crop(box)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6)
    data = b.getvalue()
    open(out, 'wb').write(data)
    return len(data)


def encode(png, jobs, workers):
    with ProcessPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(enc_one, jobs, chunksize=4))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, 'source.mp4'))
    ap.add_argument('--out', default=os.path.join(HERE, '..', '..', 'assets', 'hero', 'seq'))
    ap.add_argument('--work', default=os.path.join(HERE, 'work'))
    ap.add_argument('--ffmpeg', default='ffmpeg')
    ap.add_argument('--q', type=int, default=82, help='chất lượng WebP bộ full')
    ap.add_argument('--qtall', type=int, default=80, help='chất lượng WebP bộ tall (điện thoại)')
    ap.add_argument('--tall-w', type=int, default=960, help='bề rộng cắt của bộ tall (px trên khung gốc); 0 = bỏ bộ tall')
    ap.add_argument('--tall-stride', type=int, default=2, help='bộ tall lấy 1 khung mỗi N khung')
    ap.add_argument('--mix', type=float, default=0.65, help='0 = cuộn đều theo thời gian clip, 1 = đều theo chuyển động')
    ap.add_argument('--focus-step', type=int, default=12)
    ap.add_argument('--workers', type=int, default=max(2, (os.cpu_count() or 4) - 1))
    ap.add_argument('--keep-png', action='store_true', help='giữ lại work/png sau khi xong')
    a = ap.parse_args()

    ffprobe = os.path.join(os.path.dirname(a.ffmpeg), 'ffprobe' + ('.exe' if a.ffmpeg.lower().endswith('.exe') else '')) if os.path.dirname(a.ffmpeg) else 'ffprobe'
    os.makedirs(a.work, exist_ok=True)
    png = os.path.join(a.work, 'png')

    log('1/5 tách khung hình')
    W, H, fps, nb = probe(ffprobe, a.src)
    n = extract(a.ffmpeg, a.src, png, nb)
    log('  %d khung %dx%d @ %.3g fps' % (n, W, H, fps))

    log('2/5 chuyển động -> bảng map')
    med = motion(png, n, os.path.join(a.work, 'motion.json'))
    pmap = build_map(med, n, a.mix)

    log('3/5 khuôn mặt -> đường focus')
    fx, fy, fh = focus(png, n, os.path.join(a.work, 'focus.json'), a.focus_step)   # fh = chiều cao đầu (js/hero.js dùng để né khuôn mặt khi đặt thẻ chữ)

    log('4/5 nén WebP')
    for d in ('full', 'tall'):
        p = os.path.join(a.out, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
    os.makedirs(os.path.join(a.out, 'full'), exist_ok=True)
    full_frames = list(range(n))
    jobs = [(png, i, os.path.join(a.out, 'full', '%03d.webp' % i), None, a.q) for i in full_frames]
    full_bytes = encode(png, jobs, a.workers)
    log('  full : %d khung, %.1f MB' % (n, sum(full_bytes) / 1e6))

    sets = {'full': dict(dir='full/', w=W, h=H, frames=None, x0=0, bytes=full_bytes)}
    if a.tall_w > 0:
        os.makedirs(os.path.join(a.out, 'tall'), exist_ok=True)
        tall_frames = sorted(set(list(range(0, n, a.tall_stride)) + [n - 1]))
        x0s = [int(min(max(round(fx[i] * W - a.tall_w / 2), 0), W - a.tall_w)) for i in tall_frames]
        jobs = [(png, i, os.path.join(a.out, 'tall', '%03d.webp' % i), (x0, 0, x0 + a.tall_w, H), a.qtall) for i, x0 in zip(tall_frames, x0s)]
        tall_bytes = encode(png, jobs, a.workers)
        log('  tall : %d khung %dx%d, %.1f MB' % (len(tall_frames), a.tall_w, H, sum(tall_bytes) / 1e6))
        sets['tall'] = dict(dir='tall/', w=a.tall_w, h=H, frames=tall_frames, x0=x0s, bytes=tall_bytes)

    log('5/5 poster + scene.js')
    poster = load(png, 0)
    poster.save(os.path.join(a.out, 'poster.jpg'), 'JPEG', quality=82, optimize=True, progressive=True)
    scene = dict(w=W, h=H, n=n, fps=round(fps, 3), fx=fx, fy=fy, fh=fh, map=pmap, sets=sets)
    with open(os.path.join(a.out, 'scene.js'), 'w', encoding='utf-8') as f:
        f.write('/* Sinh bởi tools/hero-video/build_seq.py — KHÔNG sửa tay. */\n')
        f.write('window.HERO_SEQ = ' + json.dumps(scene, separators=(',', ':')) + ';\n')
    total = sum(full_bytes) + (sum(sets['tall']['bytes']) if 'tall' in sets else 0)
    log('Xong: %s (%.1f MB, poster %.0f KB)' % (os.path.abspath(a.out), total / 1e6, os.path.getsize(os.path.join(a.out, 'poster.jpg')) / 1e3))
    if not a.keep_png:
        shutil.rmtree(png, ignore_errors=True)


if __name__ == '__main__':
    main()
