# -*- coding: utf-8 -*-
"""
Dựng dữ liệu "video 3D tua theo cuộn" cho section #quy-trinh từ 5 clip chuyển cảnh (01→02 .. 05→06):
  1. ffmpeg tách toàn bộ khung hình của từng clip ra PNG (BT.709, chroma đầy đủ)
  2. xoá UI dính cứng trong clip (nút EN/VI, "Cuộn để khám phá" + mũi tên, nút tròn ↑) bằng inpainting
     -> web đã có các nút này bằng HTML/CSS thật, khung hình chỉ còn cảnh 3D
  3. nối 5 clip thành một chuỗi liền mạch: hoà trộn XF khung tại mỗi mối nối (cuối clip k ≈ đầu clip k+1)
  4. đo chuyển động từng chặng -> bảng map s (0..5) -> thời điểm khung, mỗi trạm 01..06 rơi ĐÚNG khung mối nối
  5. nén WebP: bộ "full" 1440x1080 (cắt bỏ phần phải dành cho thẻ nội dung) + bộ "tall" 960x1080 (cửa sổ hẹp)
  6. poster.webp (khung đầu) + scene.js (manifest cho js/scenes/process.js)

Chạy:  python build_process_seq.py --src "C:/Users/ADMIN/Downloads/CODE SECTION QUY TRÌNH TRIỂN KHAI" --out ../../assets/process/seq
"""
import argparse, io, json, os, shutil, subprocess
from concurrent.futures import ProcessPoolExecutor
import numpy as np
import cv2
from PIL import Image

N = 6
# Thứ tự clip: tên file chứa "1 đến 2", "2 đến 3", ...
CLIPS = ['1 đến 2', '2 đến 3', '3 đến 4', '4 đến 5', '5 đến 6']
FULL_W, TALL_W, TALL_X0 = 1440, 960, 60
# Dải hoà mép về nền (px khung gốc). Không làm tối mép trên (EDGE_TOP = 0) để không cắt số 3D khi phóng to.
EDGE_TOP, EDGE_RIGHT, EDGE_BOT = 0, 200, 150

# Vùng UI dính cứng trong clip (toạ độ khung gốc 1920x1080, đã chừa lề vì UI hơi xê dịch giữa các clip)
UI_BOXES = [
    ('pill', 38, 962, 198, 1048, 40),      # nút EN | VI (bo tròn)
    ('text', 866, 986, 1054, 1028, 0),      # "Cuộn để khám phá" / "Hoàn tất quy trình"
    ('chev', 936, 1028, 984, 1066, 0),      # mũi tên ⌄
    ('up', 1786, 950, 1882, 1050, 48),      # nút tròn ↑
]


def log(*a):
    print(*a, flush=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit('lỗi: ' + ' '.join(cmd) + '\n' + r.stderr[-2000:])
    return r.stdout


def find_clips(src):
    files = [f for f in os.listdir(src) if f.lower().endswith('.mp4')]
    out = []
    for key in CLIPS:
        hit = [f for f in files if key in f]
        if len(hit) != 1:
            raise SystemExit('không tìm thấy đúng 1 clip cho "%s" trong %s' % (key, src))
        out.append(os.path.join(src, hit[0]))
    return out


def extract(ffmpeg, src, png):
    os.makedirs(png, exist_ok=True)
    if any(f.endswith('.png') for f in os.listdir(png)):
        return sorted(f for f in os.listdir(png) if f.endswith('.png'))
    run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an',
         '-vf', 'scale=in_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int',
         '-pix_fmt', 'rgb24', '-start_number', '0', os.path.join(png, '%03d.png')])
    return sorted(f for f in os.listdir(png) if f.endswith('.png'))


def ui_mask(h=1080, w=1920):
    m = np.zeros((h, w), np.uint8)
    for _, x0, y0, x1, y1, r in UI_BOXES:
        if r:
            cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 255, -1)
            cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), 255, -1)
            for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
                cv2.circle(m, (cx, cy), r, 255, -1)
        else:
            cv2.rectangle(m, (x0, y0), (x1, y1), 255, -1)
    return m


def clean_ui(img, mask, soft):
    """Lấp vùng UI: inpaint ở 1/2 độ phân giải (mượt, không vệt), phóng lại, rồi thêm hạt nhiễu nhẹ
    lấy từ viền xung quanh để vùng vá cùng 'chất' với nền phim. Mép vá hoà mềm (soft)."""
    h, w = mask.shape
    small = cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    msmall = cv2.resize(mask, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
    msmall = cv2.dilate(msmall, np.ones((3, 3), np.uint8))
    fill = cv2.inpaint(small, msmall, 6, cv2.INPAINT_TELEA)
    fill = cv2.GaussianBlur(fill, (0, 0), 2.2)
    fill = cv2.resize(fill, (w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    rng = np.random.default_rng(7)
    fill += rng.normal(0, 1.1, fill.shape).astype(np.float32)
    out = img.astype(np.float32) * (1 - soft) + fill * soft
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def prep_one(args):
    src, dst, = args
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    mask = ui_mask(*img.shape[:2])
    soft = cv2.GaussianBlur(cv2.dilate(mask, np.ones((9, 9), np.uint8)).astype(np.float32) / 255, (0, 0), 3)[..., None]
    cv2.imwrite(dst, clean_ui(img, mask, soft))
    return dst


def mean_flow(a, b):
    ga = cv2.cvtColor(cv2.resize(a, (640, 360), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(cv2.resize(b, (640, 360), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    f = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 3, 5, 1.2, 0)
    mag = np.hypot(f[..., 0], f[..., 1])
    # trung bình 25% điểm chuyển động mạnh nhất: bắt được cả cú bay camera lẫn vòng sáng quay quanh số
    flat = np.sort(mag.ravel())
    return float(flat[int(len(flat) * 0.75):].mean())


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def edge_alpha(box, h=1080):
    """Trọng số hoà về nền ở mép TRÊN / PHẢI / DƯỚI của khung cắt (mép trái luôn trùng mép màn hình nên giữ nguyên).
    js/scenes/process.js kéo giãn 2px mép ảnh để lấp phần canvas còn trống: nếu mép là số 3D đang bay sát camera
    thì bị kéo thành vệt sáng. Hoà mép về cùng một tấm nền trơn => phần kéo giãn chỉ còn là nền sạch."""
    x0, y0, x1, y1 = box
    w = x1 - x0
    ys = np.arange(y1 - y0, dtype=np.float32)[:, None]
    xs = np.arange(w, dtype=np.float32)[None, :]
    top = smooth((EDGE_TOP - ys) / (EDGE_TOP - 6)) if EDGE_TOP > 6 else np.zeros_like(ys)
    bot = smooth((ys - (h - EDGE_BOT)) / (EDGE_BOT - 6))
    right = smooth((xs - (w - EDGE_RIGHT)) / (EDGE_RIGHT - 6))
    a = 1 - (1 - top) * (1 - bot) * (1 - right)
    return a[..., None]


def make_plate(files, out):
    """Tấm nền trơn: trung vị theo thời gian của toàn chuỗi (số 3D/hạt sáng bị loại), làm mịn mạnh."""
    sm = np.stack([cv2.resize(cv2.imread(f), (480, 270), interpolation=cv2.INTER_AREA) for f in files[::3]])
    med = np.median(sm, axis=0).astype(np.float32)
    med = cv2.GaussianBlur(med, (0, 0), 7)
    plate = cv2.resize(med, (1920, 1080), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(out, np.clip(plate + 0.5, 0, 255).astype(np.uint8))
    return out


def enc_one(args):
    src, out, box, q, plate = args
    im = np.asarray(Image.open(src).convert('RGB').crop(box), dtype=np.float32)
    if plate is not None:
        bg = np.asarray(Image.open(plate).convert('RGB').crop(box), dtype=np.float32)
        a = edge_alpha(box)
        im = im * (1 - a) + bg * a
    im = Image.fromarray(np.clip(im + 0.5, 0, 255).astype(np.uint8))
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6)
    data = b.getvalue()
    with open(out, 'wb') as f:
        f.write(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='thư mục chứa 5 clip mp4')
    ap.add_argument('--out', required=True)
    ap.add_argument('--work', required=True)
    ap.add_argument('--ffmpeg', default='ffmpeg')
    ap.add_argument('--xf', type=int, default=6, help='số khung hoà trộn tại mỗi mối nối')
    ap.add_argument('--mix', type=float, default=0.5, help='0 = cuộn đều theo thời gian clip, 1 = đều theo chuyển động')
    ap.add_argument('--k', type=int, default=200, help='số mẫu map mỗi chặng')
    ap.add_argument('--q', type=int, default=80)
    ap.add_argument('--qtall', type=int, default=78)
    ap.add_argument('--workers', type=int, default=max(2, (os.cpu_count() or 4) - 1))
    a = ap.parse_args()

    clips = find_clips(a.src)
    os.makedirs(a.work, exist_ok=True)

    log('1/6 tách khung hình')
    raw = []
    for k, c in enumerate(clips):
        d = os.path.join(a.work, 'raw', 'v%d' % (k + 1))
        names = extract(a.ffmpeg, c, d)
        raw.append([os.path.join(d, f) for f in names])
        log('  clip %d: %d khung' % (k + 1, len(names)))

    log('2/6 xoá UI dính trong clip')
    clean = []
    jobs = []
    for k, fr in enumerate(raw):
        d = os.path.join(a.work, 'clean', 'v%d' % (k + 1))
        os.makedirs(d, exist_ok=True)
        lst = []
        for p in fr:
            q = os.path.join(d, os.path.basename(p))
            lst.append(q)
            if not os.path.exists(q):
                jobs.append((p, q))
        clean.append(lst)
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        list(ex.map(prep_one, jobs, chunksize=4))

    log('3/6 nối chuỗi + hoà trộn mối nối (%d khung)' % a.xf)
    seq = os.path.join(a.work, 'seq')
    if os.path.isdir(seq):
        shutil.rmtree(seq)
    os.makedirs(seq)
    order, stops = [], [0]          # order: danh sách (nguồn A, nguồn B|None, trọng số B)
    for k, fr in enumerate(clean):
        start = 0 if k == 0 else a.xf
        end = len(fr) - (a.xf if k < len(clean) - 1 else 0)
        for i in range(start, end):
            order.append((fr[i], None, 0.0))
        if k < len(clean) - 1:
            nxt = clean[k + 1]
            for j in range(a.xf):
                w = (j + 1) / (a.xf + 1)
                w = w * w * (3 - 2 * w)
                order.append((fr[end + j], nxt[j], w))
            stops.append(len(order))           # trạm = khung "sạch" đầu tiên của clip sau
    stops.append(len(order) - 1)
    n = len(order)
    files = []
    for i, (pa, pb, w) in enumerate(order):
        out = os.path.join(seq, '%03d.png' % i)
        if pb is None:
            shutil.copyfile(pa, out)
        else:
            A = cv2.imread(pa).astype(np.float32)
            B = cv2.imread(pb).astype(np.float32)
            cv2.imwrite(out, np.clip(A * (1 - w) + B * w + 0.5, 0, 255).astype(np.uint8))
        files.append(out)
    log('  %d khung, trạm 01..06 tại %s' % (n, stops))

    log('4/6 đo chuyển động -> map từng chặng')
    cache = os.path.join(a.work, 'motion-%d.json' % n)
    if os.path.exists(cache):
        med = json.load(open(cache))
    else:
        med, prev = [], cv2.imread(files[0])
        for i in range(1, n):
            cur = cv2.imread(files[i])
            med.append(mean_flow(prev, cur))
            prev = cur
        json.dump(med, open(cache, 'w'))
    v = np.maximum(np.array(med), 1e-3)
    pmap = []
    for s in range(N - 1):
        t0, t1 = stops[s], stops[s + 1]
        seg = v[t0:t1]
        cum = np.concatenate([[0.0], np.cumsum(seg)]); cum /= cum[-1]
        lin = np.linspace(0, 1, t1 - t0 + 1)
        sp = a.mix * cum + (1 - a.mix) * lin
        us = np.arange(a.k + (1 if s == N - 2 else 0)) / a.k
        pmap += [round(float(x), 3) for x in np.interp(us, sp, np.arange(t0, t1 + 1, dtype=float))]
    assert len(pmap) == (N - 1) * a.k + 1

    log('5/6 hoà mép về nền + nén WebP')
    plate = make_plate(files, os.path.join(a.work, 'plate.png'))
    for d in ('full', 'tall'):
        p = os.path.join(a.out, d)
        if os.path.isdir(p):
            shutil.rmtree(p)
        os.makedirs(p)
    jobs = [(f, os.path.join(a.out, 'full', '%03d.webp' % i), (0, 0, FULL_W, 1080), a.q, plate) for i, f in enumerate(files)]
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        full_bytes = list(ex.map(enc_one, jobs, chunksize=4))
    log('  full : %d khung %dx1080, %.1f MB' % (n, FULL_W, sum(full_bytes) / 1e6))
    tall_frames = sorted(set(list(range(0, n, 2)) + stops))
    jobs = [(files[i], os.path.join(a.out, 'tall', '%03d.webp' % i), (TALL_X0, 0, TALL_X0 + TALL_W, 1080), a.qtall, plate) for i in tall_frames]
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        tall_bytes = list(ex.map(enc_one, jobs, chunksize=4))
    log('  tall : %d khung %dx1080, %.1f MB' % (len(tall_frames), TALL_W, sum(tall_bytes) / 1e6))

    log('6/6 poster + scene.js')
    shutil.copyfile(os.path.join(a.out, 'full', '000.webp'), os.path.join(a.out, 'poster.webp'))   # khung đầu, đã hoà mép
    scene = dict(w=FULL_W, h=1080, n=n, fps=24, stops=stops, map=pmap, sets=dict(
        full=dict(dir='full/', w=FULL_W, h=1080, frames=None, x0=0, bytes=full_bytes),
        tall=dict(dir='tall/', w=TALL_W, h=1080, frames=tall_frames, x0=TALL_X0, bytes=tall_bytes)))
    with open(os.path.join(a.out, 'scene.js'), 'w', encoding='utf-8') as f:
        f.write('/* Sinh bởi tools/process-video/build_process_seq.py — KHÔNG sửa tay. 5 clip 3D (01→06), %d khung, trạm %s */\n' % (n, stops))
        f.write('window.PROCESS_SEQ = ' + json.dumps(scene, separators=(',', ':')) + ';\n')
    log('Xong: %s' % os.path.abspath(a.out))


if __name__ == '__main__':
    main()
