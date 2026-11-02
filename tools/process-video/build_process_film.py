# -*- coding: utf-8 -*-
"""
Dựng "phim 3D tua theo cuộn" cho section #quy-trinh (bản 3D) từ 5 clip chuyển cảnh 01→02 .. 05→06.

  1. Tách khung từ mp4 nguồn ĐÚNG hệ màu được gắn trong file (ma trận BT.601/smpte170m, dải hạn chế 16–235)
     -> RGB khớp với Chrome phát video gốc (sai lệch đo được ~0,1/255). Bản cũ giải mã theo BT.709 nên lệch màu.
  2. Xoá UI dính cứng trong clip (EN|VI, "Cuộn để khám phá"/"Hoàn tất quy trình" + mũi tên, nút ↑):
     mặt nạ bám đúng hình dạng (viên thuốc, vòng tròn, từng nét chữ lấy từ trung vị theo thời gian),
     vá bằng inpainting + hạt nhiễu cùng độ mịn với nền. Ngoài mặt nạ: giữ nguyên 100% điểm ảnh gốc.
  3. Nối 5 clip: chèn MORPH khung chuyển tiếp ở mỗi mối nối (optical flow 2 chiều, không chồng bóng ma).
     Trạm 01..06 = khung GỐC (đầu mỗi clip / cuối clip 5), không bao giờ là khung hoà trộn.
  3b. Nội suy 1 khung giữa mỗi cặp (24 -> 48 khung/s) để cuộn chậm vẫn mượt; cặp nào luồng không tin cậy
     (số trong suốt chồng 2 lớp chuyển động, vật lao vụt qua camera) thì giữ nguyên khung gốc.
  4. Mã hoá 1 file H.264 1920x1080 (yuv420p, BT.709, GOP ngắn, không B-frame) cho WebCodecs giải mã phần cứng.
     Không cắt, không phóng, không phủ màu, không làm tối mép.
  5. film.js: chỉ mục từng khung (vị trí byte, kích thước, khoá) + avcC + trạm 01..06 cho js/scenes/process.js.
  6. poster-01.webp / poster-06.webp: khung trạm đầu & cuối (hiện trong lúc phim đang tải).

Chạy (cần ffmpeg/ffprobe trong PATH, Python có numpy + opencv-python + pillow):
  python build_process_film.py --src "C:/Users/ADMIN/Downloads/CODE SECTION QUY TRÌNH TRIỂN KHAI" \
         --out ../../assets/process/film --work <thư mục tạm>
"""
import argparse, base64, io, json, os, shutil, subprocess, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
import cv2
from PIL import Image

N = 6
CLIPS = ['1 đến 2', '2 đến 3', '3 đến 4', '4 đến 5', '5 đến 6']   # tên file chứa chuỗi này
W, H, FPS = 1920, 1080, 24

# UI dính trong clip (toạ độ khung gốc 1920x1080, đã đo trên trung vị thời gian của cả 5 clip)
PILL = (43, 967, 192, 1043, 38)        # x0 y0 x1 y1 bán kính — nút EN | VI (đã chừa lề 6px)
UP = (1834, 1001, 45)                  # tâm x, tâm y, bán kính — nút tròn ↑ (gồm quầng tối)
TXT = (862, 984, 1058, 1066)           # vùng chữ "Cuộn để khám phá" / "Hoàn tất quy trình" + mũi tên ⌄


def log(*a):
    print(*a, flush=True)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, **kw)
    if r.returncode != 0:
        err = r.stderr.decode('utf-8', 'replace') if isinstance(r.stderr, bytes) else r.stderr
        raise SystemExit('lỗi: ' + ' '.join(map(str, cmd)) + '\n' + err[-2000:])
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


def extract(ffmpeg, src, dst):
    """Tách khung -> PNG. Ma trận/dải màu đọc theo thẻ của chính file (clip AI gắn smpte170m, tv)."""
    os.makedirs(dst, exist_ok=True)
    have = sorted(f for f in os.listdir(dst) if f.endswith('.png'))
    if have:
        return have
    info = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                           'stream=color_space,color_range', '-of', 'json', src]))['streams'][0]
    mat = {'smpte170m': 'bt601', 'bt470bg': 'bt601', 'bt709': 'bt709'}.get(info.get('color_space'), 'bt601')
    rng = 'pc' if info.get('color_range') == 'pc' else 'tv'
    run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an', '-vf',
         'scale=in_color_matrix=%s:in_range=%s:out_range=pc:flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24' % (mat, rng),
         '-compression_level', '1', '-start_number', '0', os.path.join(dst, '%03d.png')])
    return sorted(f for f in os.listdir(dst) if f.endswith('.png'))


# ---------------------------------------------------------------- 2. xoá UI dính
def build_mask(raw, out):
    m = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1, r = PILL
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 255, -1)
    cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (cx, cy), r, 255, -1)
    cv2.circle(m, (UP[0], UP[1]), UP[2], 255, -1)
    # chữ: hợp các nét sáng tĩnh (trung vị từng cửa sổ 24 khung) — chữ đổi ở cuối clip 5 vẫn được bắt
    tx0, ty0, tx1, ty1 = TXT
    glyph = np.zeros((ty1 - ty0, tx1 - tx0), bool)
    for frames in raw:
        for s in range(0, len(frames), 24):
            st = np.stack([cv2.imread(p)[ty0:ty1, tx0:tx1] for p in frames[s:s + 24]]).astype(np.float32)
            med = np.median(st, 0)
            lum = med.mean(2)
            glyph |= ((lum - cv2.GaussianBlur(lum, (0, 0), 6)) > 9) & (med.min(2) > 52)
    glyph = cv2.morphologyEx(glyph.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    glyph = cv2.dilate(glyph, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))   # viền khử răng cưa + quầng tối
    m[ty0:ty1, tx0:tx1] |= glyph
    cv2.imwrite(out, m)
    return out


_MASK = None


def _mask(path):
    global _MASK
    if _MASK is None:
        core = (cv2.imread(path, 0) > 0).astype(np.uint8) * 255
        ring = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        alpha = cv2.GaussianBlur(ring.astype(np.float32) / 255, (0, 0), 1.0)
        alpha = np.maximum(alpha, core.astype(np.float32) / 255)[..., None]
        band = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))) & \
            ~cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        ys, xs = np.nonzero(ring)
        box = (max(0, xs.min() - 40), max(0, ys.min() - 40), min(W, xs.max() + 41), min(H, ys.max() + 41))
        _MASK = dict(ring=ring, alpha=alpha, band=band > 0, box=box)
    return _MASK


def clean_one(args):
    src, dst, mask_path, seed = args
    if os.path.exists(dst):
        return dst
    M = _mask(mask_path)
    img = cv2.imread(src)
    x0, y0, x1, y1 = M['box']
    sub = img[y0:y1, x0:x1]
    fill = cv2.inpaint(sub, M['ring'][y0:y1, x0:x1], 6, cv2.INPAINT_TELEA).astype(np.float32)
    fill = cv2.GaussianBlur(fill, (0, 0), 1.6)
    # hạt nhiễu: cùng năng lượng cao tần với dải nền ngay quanh UI
    f32 = sub.astype(np.float32)
    hp = f32 - cv2.GaussianBlur(f32, (0, 0), 1.6)
    band = M['band'][y0:y1, x0:x1]
    sd = float(hp[band].std()) if band.any() else 1.0
    noise = np.random.default_rng(seed).normal(0, 1, fill.shape[:2]).astype(np.float32)
    fill += (cv2.GaussianBlur(noise, (0, 0), 0.7) * (sd / 0.42) * 0.85)[..., None]
    a = M['alpha'][y0:y1, x0:x1]
    img[y0:y1, x0:x1] = np.clip(f32 * (1 - a) + fill * a + 0.5, 0, 255).astype(np.uint8)
    cv2.imwrite(dst, img, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return dst


# ---------------------------------------------------------------- 3. morph mối nối
def reliable_flow(f1, f2, g, gx, gy, sigma=5):
    """Chỉ tin luồng ở nơi 2 chiều nhất quán VÀ có cấu trúc (nét số, vòng sáng); làm mượt có trọng số.
    Hạt sáng chỉ có ở một trong hai clip => luồng ở đó sai => bị loại, chỉ tan dần thay vì bị nắn méo."""
    back = cv2.remap(f2, gx + f1[..., 0], gy + f1[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    err = np.hypot(f1[..., 0] + back[..., 0], f1[..., 1] + back[..., 1])
    tex = cv2.GaussianBlur(np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)), (0, 0), 2)
    conf = np.exp(-(err / 1.2) ** 2) * np.clip(tex / 40.0, 0, 1)
    num = cv2.GaussianBlur(f1 * conf[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(conf, (0, 0), sigma)[..., None]
    return num / (den + 1e-3)


def morph_join(args):
    a_path, b_path, outs = args
    if all(os.path.exists(o) for o in outs):
        return outs
    A = cv2.imread(a_path)
    B = cv2.imread(b_path)
    ga = cv2.GaussianBlur(cv2.cvtColor(A, cv2.COLOR_BGR2GRAY), (0, 0), 1.0)
    gb = cv2.GaussianBlur(cv2.cvtColor(B, cv2.COLOR_BGR2GRAY), (0, 0), 1.0)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f_ab = dis.calc(ga, gb, None)
    f_ba = dis.calc(gb, ga, None)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    fa = reliable_flow(f_ab, f_ba, ga, gx, gy)
    fb = reliable_flow(f_ba, f_ab, gb, gx, gy)
    Af, Bf = A.astype(np.float32), B.astype(np.float32)
    k = len(outs)
    for j, o in enumerate(outs):
        w = (j + 1) / (k + 1)
        w = w * w * (3 - 2 * w)                                    # vào/ra êm
        Aw = cv2.remap(Af, gx - w * fa[..., 0], gy - w * fa[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        Bw = cv2.remap(Bf, gx - (1 - w) * fb[..., 0], gy - (1 - w) * fb[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        cv2.imwrite(o, np.clip(Aw * (1 - w) + Bw * w + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return outs


# ---------------------------------------------------------------- 3b. nội suy khung giữa (x2) cho cuộn mượt
def interp_pair(args):
    """Khung giữa A|B theo chuyển động (optical flow 2 chiều, trọng số che khuất). Trả về độ lệch giữa
    A-nắn và B-nắn trên vùng sáng: lớn = luồng sai (vd. vật thể tiền cảnh lao vụt qua) -> dùng lại khung gốc."""
    a_path, b_path, out = args
    if os.path.exists(out) and os.path.exists(out + '.npy'):
        return interp_score(out + '.npy')
    A = cv2.imread(a_path)
    B = cv2.imread(b_path)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    ga = cv2.cvtColor(A, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(B, cv2.COLOR_BGR2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f_ab = dis.calc(ga, gb, None)
    f_ba = dis.calc(gb, ga, None)
    rm = lambda im, fx, fy, interp=cv2.INTER_LINEAR, b=cv2.BORDER_REPLICATE: cv2.remap(im, gx + fx, gy + fy, interp, borderMode=b)
    ea = np.hypot(*np.moveaxis(f_ab + rm(f_ba, f_ab[..., 0], f_ab[..., 1]), -1, 0))
    eb = np.hypot(*np.moveaxis(f_ba + rm(f_ab, f_ba[..., 0], f_ba[..., 1]), -1, 0))
    fa = rm(f_ab, -0.5 * f_ab[..., 0], -0.5 * f_ab[..., 1])          # luồng lấy mẫu tại vị trí khung giữa
    fb = rm(f_ba, -0.5 * f_ba[..., 0], -0.5 * f_ba[..., 1])
    Aw = rm(A, -0.5 * fa[..., 0], -0.5 * fa[..., 1], cv2.INTER_CUBIC, cv2.BORDER_REFLECT).astype(np.float32)
    Bw = rm(B, -0.5 * fb[..., 0], -0.5 * fb[..., 1], cv2.INTER_CUBIC, cv2.BORDER_REFLECT).astype(np.float32)
    ca = np.exp(-(rm(ea, -0.5 * fa[..., 0], -0.5 * fa[..., 1]) / 1.5) ** 2) + 1e-4
    cb = np.exp(-(rm(eb, -0.5 * fb[..., 0], -0.5 * fb[..., 1]) / 1.5) ** 2) + 1e-4
    wa = (ca / (ca + cb))[..., None]
    mid = np.clip(Aw * wa + Bw * (1 - wa) + 0.5, 0, 255).astype(np.uint8)
    la, lb = Aw.mean(2), Bw.mean(2)
    d = np.abs(la - lb) * (np.maximum(la, lb) > 45)
    np.save(out + '.npy', cv2.resize(d, (480, 270), interpolation=cv2.INTER_AREA).astype(np.float16))
    cv2.imwrite(out, mid, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return interp_score(out + '.npy')


def interp_score(npy):
    """Điểm = chỗ lệch nặng nhất của A-nắn/B-nắn sau khi làm mờ rộng (~24px khung gốc): bỏ qua hạt sáng
    li ti tự nhấp nháy, nhưng bắt được số nhỏ phía sau bị nhân đôi khi nhìn xuyên qua số trong suốt."""
    d = np.load(npy).astype(np.float32)
    return float(cv2.GaussianBlur(d, (0, 0), 6).max())


# ---------------------------------------------------------------- 5. chỉ mục cho WebCodecs
def read_avcc(mp4):
    data = open(mp4, 'rb').read()
    i = data.find(b'avcC')
    if i < 4:
        raise SystemExit('không thấy avcC trong ' + mp4)
    size = int.from_bytes(data[i - 4:i], 'big')
    rec = data[i + 4:i - 4 + size]
    codec = 'avc1.%02x%02x%02x' % (rec[1], rec[2], rec[3])
    return rec, codec


def edge_colors(order, rows=33, cols=160):
    """Dải màu nền mép phải theo chiều cao (trung vị theo thời gian của trung bình 160px mép phải).
    Màn hình rộng hơn 16:9: phần dư bên phải là dải màu này (CSS), phản chiếu mép khung tan dần vào nó."""
    acc = []
    for p in order[::2]:
        strip = cv2.imread(p)[:, W - cols:].astype(np.float32).mean(1)         # (H, 3) BGR
        acc.append(cv2.resize(strip[:, None, :], (1, rows), interpolation=cv2.INTER_AREA)[:, 0, :])
    med = np.median(np.stack(acc), 0)
    return [[int(round(c)) for c in px[::-1]] for px in med]                   # RGB


def bframes(mp4):
    """Chỉ số (theo thứ tự hiển thị) các khung B — không làm tham chiếu, bộ phát bỏ qua được."""
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pict_type', '-of', 'csv=p=0', mp4])
    types = [t.strip().strip(',') for t in out.decode('utf-8', 'replace').split() if t.strip()]
    return [i for i, t in enumerate(types) if t == 'B']


def packets(mp4):
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts,pos,size,flags',
               '-of', 'json', mp4])
    pk = json.loads(out)['packets']
    pk.sort(key=lambda p: int(p['pts']))
    return [(int(p['pos']), int(p['size']), 1 if 'K' in p['flags'] else 0) for p in pk]


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # cửa sổ lệnh Windows (cp1252) không in được tiếng Việt
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='thư mục chứa 5 clip mp4')
    ap.add_argument('--out', required=True, help='thư mục xuất (assets/process/film)')
    ap.add_argument('--work', required=True, help='thư mục tạm (PNG trung gian, ~3 GB)')
    ap.add_argument('--ffmpeg', default='ffmpeg')
    ap.add_argument('--morph', type=int, default=6, help='số khung morph chèn ở mỗi mối nối')
    ap.add_argument('--crf', type=float, default=15)
    ap.add_argument('--gop', type=int, default=16, help='khoảng khung khoá (tua lùi cần giải mã lại tối đa GOP khung)')
    ap.add_argument('--no-interp', action='store_true', help='không chèn khung nội suy (phim 24 khung/s)')
    ap.add_argument('--interp-thr', type=float, default=38, help='điểm lệch tối đa để nhận khung nội suy (lớn hơn -> giữ khung gốc)')
    ap.add_argument('--workers', type=int, default=max(2, (os.cpu_count() or 4) - 1))
    ap.add_argument('--skip-encode', action='store_true', help='giữ film.mp4 đã có, chỉ dựng lại film.js + poster')
    a = ap.parse_args()

    clips = find_clips(a.src)
    os.makedirs(a.work, exist_ok=True)

    log('1/6 tách khung (đúng hệ màu của file nguồn)')
    raw = []
    for k, c in enumerate(clips):
        d = os.path.join(a.work, 'raw', 'v%d' % (k + 1))
        names = extract(a.ffmpeg, c, d)
        raw.append([os.path.join(d, f) for f in names])
        log('  clip %d: %d khung' % (k + 1, len(names)))

    log('2/6 xoá UI dính trong clip')
    mask_path = os.path.join(a.work, 'ui_mask.png')
    if not os.path.exists(mask_path):
        build_mask(raw, mask_path)
    clean, jobs = [], []
    for k, fr in enumerate(raw):
        d = os.path.join(a.work, 'clean', 'v%d' % (k + 1))
        os.makedirs(d, exist_ok=True)
        lst = []
        for i, p in enumerate(fr):
            q = os.path.join(d, os.path.basename(p))
            lst.append(q)
            jobs.append((p, q, mask_path, (k + 1) * 1000 + i))
        clean.append(lst)
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        list(ex.map(clean_one, jobs, chunksize=4))

    log('3/6 nối clip + morph %d khung ở mỗi mối nối' % a.morph)
    order, stops, mjobs = [], [0], []
    for k, fr in enumerate(clean):
        if k > 0:
            stops.append(len(order))               # trạm = khung GỐC đầu clip
        order += fr
        if k < len(clean) - 1 and a.morph > 0:
            d = os.path.join(a.work, 'morph', 'j%d' % (k + 1))
            os.makedirs(d, exist_ok=True)
            outs = [os.path.join(d, '%02d.png' % j) for j in range(a.morph)]
            mjobs.append((fr[-1], clean[k + 1][0], outs))
            order += outs
    stops.append(len(order) - 1)
    with ProcessPoolExecutor(max_workers=min(4, a.workers)) as ex:
        list(ex.map(morph_join, mjobs))
    log('  %d khung, trạm 01..06 tại %s' % (len(order), stops))

    fps, step = FPS, 1
    if not a.no_interp:
        log('3b/6 nội suy khung giữa (x2, ngưỡng tin cậy %s)' % a.interp_thr)
        d = os.path.join(a.work, 'interp')
        os.makedirs(d, exist_ok=True)
        ij = [(order[i], order[i + 1], os.path.join(d, '%04d.png' % i)) for i in range(len(order) - 1)]
        with ProcessPoolExecutor(max_workers=min(6, a.workers)) as ex:
            score = list(ex.map(interp_pair, ij, chunksize=4))
        both = []
        for i, p in enumerate(order[:-1]):
            # cặp không tin cậy (số trong suốt chồng 2 lớp chuyển động, vật lao vụt qua): giữ khung gốc, không vá cục bộ
            both += [p, ij[i][2] if score[i] < a.interp_thr else p]
        both.append(order[-1])
        log('  nhận %d/%d khung nội suy, giữ khung gốc ở %d cặp' % (sum(s < a.interp_thr for s in score), len(score), sum(s >= a.interp_thr for s in score)))
        order, stops, fps, step = both, [s * 2 for s in stops], FPS * 2, 2
    n = len(order)

    os.makedirs(a.out, exist_ok=True)
    mp4 = os.path.join(a.out, 'film.mp4')
    if a.skip_encode and os.path.exists(mp4):
        log('4/6 bỏ qua mã hoá (--skip-encode), dùng lại %s' % mp4)
    else:
        encode(a, order, mp4, fps, step > 1)

    log('5/6 chỉ mục khung + avcC + dải màu mép phải')
    avcc, codec = read_avcc(mp4)
    pk = packets(mp4)
    if len(pk) != n:
        raise SystemExit('số gói (%d) khác số khung (%d)' % (len(pk), n))
    size = os.path.getsize(mp4)
    # step: khung gốc nằm ở chỉ số chia hết cho step (bộ phát dừng cuộn là đậu đúng khung gốc)
    film = dict(v=2, w=W, h=H, fps=fps, step=step, n=n, stops=stops, codec=codec, bytes=size,
                avcc=base64.b64encode(avcc).decode('ascii'),
                pos=[p[0] for p in pk], size=[p[1] for p in pk], key=[i for i, p in enumerate(pk) if p[2]],
                b=bframes(mp4),
                edge=edge_colors(order))
    with open(os.path.join(a.out, 'film.js'), 'w', encoding='utf-8') as f:
        f.write('/* Sinh bởi tools/process-video/build_process_film.py — KHÔNG sửa tay. '
                '%d khung 1920x1080, trạm 01..06 tại %s, film.mp4 %.1f MB */\n' % (n, stops, size / 1e6))
        f.write('window.PROCESS_FILM = ' + json.dumps(film, separators=(',', ':')) + ';\n')

    log('6/6 poster trạm 01 & 06')
    for tag, idx in (('01', stops[0]), ('06', stops[-1])):
        im = Image.open(order[idx]).convert('RGB')
        im.save(os.path.join(a.out, 'poster-%s.webp' % tag), 'WEBP', quality=92, method=6)
    log('Xong: %s  (film.mp4 %.1f MB, %d khung, %d khung khoá, codec %s)' % (os.path.abspath(a.out), size / 1e6, n, len(film['key']), codec))


def encode(a, order, mp4, fps=FPS, interp=False):
    # phim 48 khung/s: khung nội suy (chỉ số lẻ) mã hoá thành khung B KHÔNG làm tham chiếu (b-adapt=0, b-pyramid=none)
    # => bộ phát bỏ qua được khi lướt nhanh (giải mã bằng nửa), khung gốc (chẵn) là chuỗi I/P
    bf = 1 if interp else 0
    log('4/6 mã hoá H.264 1920x1080 %d khung/s (CRF %s, GOP %d, %s)' % (fps, a.crf, a.gop, 'khung lẻ = B không tham chiếu' if bf else 'không B-frame'))
    x264 = ('keyint=%d:min-keyint=%d:scenecut=0:bframes=%d:b-adapt=0:b-pyramid=none:open-gop=0:aq-mode=3:aq-strength=0.85:'
            'deblock=-1,-1:psy-rd=1.0,0.10:ref=3:rc-lookahead=%d') % (a.gop, a.gop, bf, a.gop)
    enc = subprocess.Popen([a.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                            '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '%dx%d' % (W, H), '-r', str(fps), '-i', '-',
                            # setparams: gắn thẻ màu vào từng khung (ffmpeg mới lấy thẻ từ khung, bỏ qua -color_* đầu ra)
                            # transfer sRGB như clip gốc => Safari/macOS không làm nhạt màu như với thẻ bt709
                            '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,'
                                   'setparams=range=tv:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709',
                            '-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'high', '-crf', str(a.crf),
                            '-g', str(a.gop), '-bf', str(bf), '-x264-params', x264,
                            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
                            '-movflags', '+faststart', '-an', mp4], stdin=subprocess.PIPE)
    for p in order:
        im = cv2.imread(p)
        if im is None or im.shape != (H, W, 3):
            enc.kill()
            raise SystemExit('khung lỗi: ' + p)
        enc.stdin.write(im.tobytes())
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit('ffmpeg mã hoá lỗi')


if __name__ == '__main__':
    main()
