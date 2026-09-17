"""
Optical-flow frame interpolation for the hero scroll sequence.

Chạy bằng Python tích hợp trong Blender (có sẵn numpy), không cần cài thêm gì:

    blender -b --factory-startup --python interpolate_frames.py -- <in_dir> <out_dir> <steps> [pair_index]

- <in_dir>  : chứa a01.bmp ... a08.bmp (8 khung gốc, BMP 24-bit)
- <out_dir> : nơi ghi f000.bmp, f001.bmp ... (khung gốc + khung trung gian)
- <steps>   : số bước giữa 2 khung gốc (12 => 11 khung trung gian mỗi cặp)
- pair_index: (tuỳ chọn) chỉ xử lý 1 cặp, dùng để thử nghiệm

Thuật toán:
1. Căn khớp toàn cục (similarity) theo vị trí mắt + kích thước khuôn mặt đã đo ở từng khung,
   để phần chuyển động lớn của nhân vật được xử lý bằng phép biến đổi camera.
2. Optical flow dày đặc hai chiều (Lucas-Kanade kim tự tháp, có warp lặp) cho phần dư
   (thị sai của tường bê tông, bầu trời, quần áo...).
3. Tổng hợp khung ở thời điểm t theo công thức Super SloMo + trọng số che khuất
   (kiểm tra nhất quán tiến/lùi), rồi áp phép biến đổi camera nội suy.
Mọi pixel đều lấy từ ảnh thật của bạn: không có chi tiết nào được "vẽ" thêm.
"""
import os
import sys
import time

import numpy as np

# --------------------------------------------------------------------------------------
# Dữ liệu căn khớp: tâm giữa hai mắt (px trong ảnh 1672x941) và kích thước mặt tương đối
# --------------------------------------------------------------------------------------
ANCHORS = [(1015, 212), (915, 205), (895, 175), (855, 170), (828, 168), (593, 200), (618, 265), (538, 358)]
SCALES = [1.00, 0.97, 1.10, 1.15, 1.24, 1.25, 1.60, 2.05]


# ------------------------------------ BMP I/O -----------------------------------------
def read_bmp(path):
    data = np.fromfile(path, np.uint8)
    off = int.from_bytes(data[10:14].tobytes(), "little")
    w = int.from_bytes(data[18:22].tobytes(), "little", signed=True)
    h = int.from_bytes(data[22:26].tobytes(), "little", signed=True)
    bpp = int.from_bytes(data[28:30].tobytes(), "little")
    ch = bpp // 8
    row = (w * ch + 3) // 4 * 4
    arr = data[off:off + row * abs(h)].reshape(abs(h), row)[:, : w * ch].reshape(abs(h), w, ch)
    if h > 0:
        arr = arr[::-1]
    return arr[..., [2, 1, 0]].astype(np.float32) / 255.0


def write_bmp(path, rgb):
    h, w, _ = rgb.shape
    b = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)[::-1, :, ::-1]
    row = (w * 3 + 3) // 4 * 4
    if row != w * 3:
        b = np.concatenate([b.reshape(h, w * 3), np.zeros((h, row - w * 3), np.uint8)], axis=1)
    raw = np.ascontiguousarray(b).tobytes()
    header = b"BM" + (54 + len(raw)).to_bytes(4, "little") + b"\0\0\0\0" + (54).to_bytes(4, "little")
    dib = (40).to_bytes(4, "little") + w.to_bytes(4, "little") + h.to_bytes(4, "little") + (1).to_bytes(2, "little")
    dib += (24).to_bytes(2, "little") + b"\0\0\0\0" + len(raw).to_bytes(4, "little")
    dib += (2835).to_bytes(4, "little") * 2 + b"\0" * 8
    with open(path, "wb") as f:
        f.write(header + dib + raw)


# ---------------------------------- image ops -----------------------------------------
def gkern(sigma):
    r = max(1, int(3 * sigma + 0.5))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-x * x / (2 * sigma * sigma))
    return k / k.sum()


def conv1(a, k, axis):
    r = len(k) // 2
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    p = np.pad(a, pad, mode="edge")
    n = a.shape[axis]
    out = np.zeros_like(a)
    for i, wgt in enumerate(k):
        sl = [slice(None)] * a.ndim
        sl[axis] = slice(i, i + n)
        out += wgt * p[tuple(sl)]
    return out


def box1(a, r, axis):
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = [slice(None)] * a.ndim
    lo = [slice(None)] * a.ndim
    hi[axis] = slice(2 * r + 1, 2 * r + 1 + n)
    lo[axis] = slice(0, n)
    return ((c[tuple(hi)] - c[tuple(lo)]) / (2 * r + 1)).astype(np.float32)


def blur(a, sigma):
    if sigma <= 0:
        return a
    if sigma < 3:
        k = gkern(sigma)
        return conv1(conv1(a, k, 0), k, 1)
    # 3 lần box blur ~ Gaussian, chi phí O(n) bất kể sigma
    r = max(1, int(round((np.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    for _ in range(3):
        a = box1(box1(a, r, 0), r, 1)
    return a


def sample(img, x, y):
    """Bilinear sampling. Returns (values, valid_mask)."""
    H, W = img.shape[:2]
    valid = (x >= -0.5) & (x <= W - 0.5) & (y >= -0.5) & (y <= H - 0.5)
    x = np.clip(x, 0, W - 1.001)
    y = np.clip(y, 0, H - 1.001)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    fx = (x - x0).astype(np.float32)
    fy = (y - y0).astype(np.float32)
    if img.ndim == 3:
        fx = fx[..., None]
        fy = fy[..., None]
    a = img[y0, x0]
    b = img[y0, x0 + 1]
    c = img[y0 + 1, x0]
    d = img[y0 + 1, x0 + 1]
    out = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    return out, valid


def resize(a, shape):
    h, w = shape
    H, W = a.shape[:2]
    ys = (np.arange(h, dtype=np.float32) + 0.5) * (H / h) - 0.5
    xs = (np.arange(w, dtype=np.float32) + 0.5) * (W / w) - 0.5
    xx, yy = np.meshgrid(xs, ys)
    return sample(a, xx, yy)[0]


def down(a):
    a = blur(a, 1.0)
    return a[::2, ::2]


def to_gray(rgb):
    return (rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114).astype(np.float32)


def subject_mask(rgb, seed=None, scale=1.0):
    """Mặt nạ nhân vật (0..1) theo màu: tóc/vest tối + vùng da quanh đầu. Nền là trời xanh & bê tông sáng.
    seed=(x, y): tâm mắt; chỉ giữ vùng liền mạch với điểm này => loại các mảng bê tông lẻ."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    H, W = r.shape
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = (mx - mn) / (mx + 1e-4)
    dark = lum < 0.27
    fabric = (r >= g) & (g >= b) & (sat > 0.3) & (lum < 0.42)  # vest nâu bắt nắng
    skin = (r >= g) & (g >= b * 0.92) & (sat > 0.26) & (lum > 0.18) & (lum < 0.74) & (r - b > 0.13)
    if seed is not None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        R = 165.0 * scale
        head = ((xx - seed[0]) / (0.85 * R)) ** 2 + ((yy - (seed[1] - 0.15 * R)) / (1.05 * R)) ** 2 < 1.0
        sky = (b > r + 0.08) & (b > 0.45)
        concrete = (sat < 0.25) & (lum > 0.5)
        skin = skin & head
        headish = head & ~sky & ~concrete
        m = (dark | fabric | skin | headish).astype(np.float32)
    else:
        m = (dark | skin).astype(np.float32)
    m = (blur(m, 3) > 0.5).astype(np.float32)  # bỏ nhiễu lấm tấm
    if seed is not None:
        # geodesic reconstruction ở 1/4 độ phân giải
        q = m[::4, ::4]
        sy, sx = int(seed[1] / 4), int(seed[0] / 4)
        rec = np.zeros_like(q)
        rec[max(0, sy - 3):sy + 4, max(0, sx - 3):sx + 4] = 1
        rec = np.minimum(rec, np.maximum(q, 0))
        rec[max(0, sy - 3):sy + 4, max(0, sx - 3):sx + 4] = 1
        for _ in range(400):
            grown = np.minimum((blur(rec, 1.0) > 0.05).astype(np.float32), q)
            if np.array_equal(grown, rec):
                break
            rec = grown
        m = np.minimum(m, (resize(rec, m.shape) > 0.3).astype(np.float32))
    # đóng lỗ (mắt kính, vùng sáng trên mặt) rồi làm mềm biên
    m = (blur(m, 10) > 0.3).astype(np.float32)
    m = (blur(m, 10) > 0.62).astype(np.float32)
    m = (blur(m, 4) > 0.25).astype(np.float32)
    return np.clip(blur(m, 2.0), 0, 1)


def fill_holes(img, mask):
    """Vá vùng mask~1 (nhân vật) bằng normalized convolution đa tỉ lệ ở 1/4 độ phân giải.
    Dùng để tạo 'tấm nền sạch' cho lớp background."""
    H, W = mask.shape
    h4, w4 = H // 4, W // 4
    known = 1.0 - (resize(mask, (h4, w4)) > 0.02).astype(np.float32)
    small = resize(img, (h4, w4))
    est = small.copy()
    done = known.copy()
    for sigma in (2, 4, 8, 16, 32, 64, 128):
        den = blur(known, sigma)
        num = np.stack([blur(small[..., c] * known, sigma) for c in range(3)], -1)
        cur = num / np.maximum(den, 1e-6)[..., None]
        take = (done < 0.5) & (den > 0.01)
        est[take] = cur[take]
        done[take] = 1.0
    est = np.stack([blur(est[..., c], 1.5) for c in range(3)], -1)
    up = resize(est, (H, W))
    a = np.clip(blur(mask, 2.0) * 1.5, 0, 1)[..., None]
    return img * (1 - a) + up * a


def structure(gray):
    # Bỏ bớt thành phần ánh sáng tần số thấp để flow bám vào kết cấu (tóc, vải, bê tông)
    return gray - 0.85 * blur(gray, 10)


# ------------------------------------- flow -------------------------------------------
def lk_flow(I0, I1, init_u=None, init_v=None, min_size=28, win=2.2, lam=1.5e-5):
    """Dense pyramidal Lucas-Kanade with iterative warping. I0(x) ~ I1(x + d(x))."""
    p0, p1 = [I0], [I1]
    while min(p0[-1].shape) > min_size * 2:
        p0.append(down(p0[-1]))
        p1.append(down(p1[-1]))
    L = len(p0)
    u = v = None
    for lvl in range(L - 1, -1, -1):
        J0, J1 = p0[lvl], p1[lvl]
        H, W = J0.shape
        if u is None:
            if init_u is not None:
                f = H / init_u.shape[0]
                u = resize(init_u, (H, W)) * f
                v = resize(init_v, (H, W)) * f
            else:
                u = np.zeros((H, W), np.float32)
                v = np.zeros((H, W), np.float32)
        else:
            u = resize(u, (H, W)) * 2.0
            v = resize(v, (H, W)) * 2.0
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        gy0, gx0 = np.gradient(J0)
        iters = 7 if lvl > 1 else 5
        for _ in range(iters):
            J1w, _ = sample(J1, xx + u, yy + v)
            gy1, gx1 = np.gradient(J1w)
            Ix = 0.5 * (gx0 + gx1)
            Iy = 0.5 * (gy0 + gy1)
            It = J1w - J0
            Sxx = blur(Ix * Ix, win) + lam
            Syy = blur(Iy * Iy, win) + lam
            Sxy = blur(Ix * Iy, win)
            Sxt = blur(Ix * It, win)
            Syt = blur(Iy * It, win)
            det = Sxx * Syy - Sxy * Sxy
            du = (-Syy * Sxt + Sxy * Syt) / det
            dv = (Sxy * Sxt - Sxx * Syt) / det
            u += np.clip(du, -1.5, 1.5)
            v += np.clip(dv, -1.5, 1.5)
            u = blur(u, 0.8)
            v = blur(v, 0.8)
        u = blur(u, 1.2)
        v = blur(v, 1.2)
    return u.astype(np.float32), v.astype(np.float32)


# ----------------------------------- pipeline -----------------------------------------
def similarity(a_idx, b_idx):
    """T: A-coords -> B-coords, y = cB + r (x - cA)."""
    cA = np.array(ANCHORS[a_idx], np.float32)
    cB = np.array(ANCHORS[b_idx], np.float32)
    r = SCALES[b_idx] / SCALES[a_idx]
    return cA, cB, r


def bidir_flow(I0, I1, log, tag, smooth=0.0):
    """Flow hai chiều ở nửa độ phân giải + bản đồ tin cậy (kiểm tra nhất quán tiến/lùi)."""
    t0 = time.time()
    u01, v01 = lk_flow(I0, I1)
    u10, v10 = lk_flow(I1, I0)
    if smooth > 0:
        u01, v01, u10, v10 = (blur(a, smooth) for a in (u01, v01, u10, v10))
    h2, w2 = I0.shape
    hy, hx = np.mgrid[0:h2, 0:w2].astype(np.float32)
    bu, _ = sample(u10, hx + u01, hy + v01)
    bv, _ = sample(v10, hx + u01, hy + v01)
    fu, _ = sample(u01, hx + u10, hy + v10)
    fv, _ = sample(v01, hx + u10, hy + v10)
    c0 = blur(np.exp(-(np.hypot(u01 + bu, v01 + bv) / 2.0) ** 2), 1.5)
    c1 = blur(np.exp(-(np.hypot(u10 + fu, v10 + fv) / 2.0) ** 2), 1.5)
    log(f"    {tag} flow {time.time() - t0:.1f}s  mean|d|={np.hypot(u01, v01).mean() * 2:.1f}px")
    return u01, v01, u10, v10, c0, c1


def upflow(fields, shape):
    u01, v01, u10, v10, c0, c1 = fields
    return (resize(u01, shape) * 2, resize(v01, shape) * 2, resize(u10, shape) * 2,
            resize(v10, shape) * 2, resize(c0, shape), resize(c1, shape))


def slomo(t, U01, V01, U10, V10):
    """Xấp xỉ flow từ khung t về 0 và về 1 (Super SloMo)."""
    return (-(1 - t) * t * U01 + t * t * U10, -(1 - t) * t * V01 + t * t * V10,
            (1 - t) ** 2 * U01 - t * (1 - t) * U10, (1 - t) ** 2 * V01 - t * (1 - t) * V10)


def process_pair(A, B, mA, mB, a_idx, b_idx, steps, out_paths, log):
    H, W = A.shape[:2]
    h2, w2 = H // 2, W // 2
    cA, cB, r = similarity(a_idx, b_idx)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # ---------- Lớp NỀN: tấm nền sạch (đã vá chỗ nhân vật) + flow trực tiếp ----------
    mAd = np.clip(blur(mA, 6) * 2.5, 0, 1)
    mBd = np.clip(blur(mB, 6) * 2.5, 0, 1)
    Abg = fill_holes(A, mAd)
    Bbg = fill_holes(B, mBd)
    bg = upflow(bidir_flow(structure(resize(to_gray(Abg), (h2, w2))),
                           structure(resize(to_gray(Bbg), (h2, w2))), log, "bg", smooth=6.0), (H, W))

    # ---------- Lớp NHÂN VẬT: căn theo khuôn mặt + flow phần dư ----------
    # Flow chỉ "nhìn" nhân vật: nền được thay bằng màu phẳng để không kéo lệch biên tóc/vest
    Bp, _ = sample(B, cB[0] + r * (xx - cA[0]), cB[1] + r * (yy - cA[1]))
    mBp, _ = sample(mB, cB[0] + r * (xx - cA[0]), cB[1] + r * (yy - cA[1]))
    flat = 0.62
    gA = to_gray(A) * mA + flat * (1 - mA)
    gB = to_gray(Bp) * mBp + flat * (1 - mBp)
    fg = upflow(bidir_flow(structure(resize(gA, (h2, w2))),
                           structure(resize(gB, (h2, w2))), log, "subject"), (H, W))

    bU01, bV01, bU10, bV10, bC0, bC1 = bg
    sU01, sV01, sU10, sV10, sC0, sC1 = fg

    for k, path in enumerate(out_paths, start=1):
        t = k / steps

        # ---- nền: camera không đổi, chỉ dùng flow ----
        f0x, f0y, f1x, f1y = slomo(t, bU01, bV01, bU10, bV10)
        b0, bv0 = sample(Abg, xx + f0x, yy + f0y)
        b1, bv1 = sample(Bbg, xx + f1x, yy + f1y)
        q0, _ = sample(bC0, xx + f0x, yy + f0y)
        q1, _ = sample(bC1, xx + f1x, yy + f1y)
        # ưu tiên pixel nền thật (không nằm dưới nhân vật)
        o0, _ = sample(mAd, xx + f0x, yy + f0y)
        o1, _ = sample(mBd, xx + f1x, yy + f1y)
        w0 = (1 - t) * (0.1 + q0) * (0.05 + (1 - o0)) * bv0
        w1 = t * (0.1 + q1) * (0.05 + (1 - o1)) * bv1
        # cả hai nguồn đều ra ngoài biên => dùng pixel kéo dài mép (tránh viền đen)
        none = (w0 + w1) < 1e-5
        w0 = np.where(none, 1 - t, w0)
        w1 = np.where(none, t, w1)
        ws = np.maximum(w0 + w1, 1e-6)
        back = (b0 * w0[..., None] + b1 * w1[..., None]) / ws[..., None]

        # ---- nhân vật: camera nội suy (similarity) + flow dư ----
        ct = cA + (cB - cA) * t
        rt = r ** t
        px = cA[0] + (xx - ct[0]) / rt
        py = cA[1] + (yy - ct[1]) / rt
        g0x, g0y, g1x, g1y = slomo(t, sU01, sV01, sU10, sV10)
        d0x, _ = sample(g0x, px, py)
        d0y, _ = sample(g0y, px, py)
        d1x, _ = sample(g1x, px, py)
        d1y, _ = sample(g1y, px, py)
        s0x, s0y = px + d0x, py + d0y
        s1x, s1y = px + d1x, py + d1y
        bx, by = cB[0] + r * (s1x - cA[0]), cB[1] + r * (s1y - cA[1])
        # lớp nhân vật dùng edge-extension (không cắt ở mép ảnh)
        p0, _ = sample(A, s0x, s0y)
        p1, _ = sample(B, bx, by)
        a0, _ = sample(mA, s0x, s0y)
        a1, _ = sample(mB, bx, by)
        k0, _ = sample(sC0, s0x, s0y)
        k1, _ = sample(sC1, s1x, s1y)
        w0 = (1 - t) * (a0 + 1e-3) * (0.1 + k0)
        w1 = t * (a1 + 1e-3) * (0.1 + k1)
        ws = w0 + w1
        subj = (p0 * w0[..., None] + p1 * w1[..., None]) / np.maximum(ws, 1e-6)[..., None]
        # alpha dạng hợp (union) ở giữa chuyển động, khớp đúng mặt nạ gốc ở hai đầu
        alpha = np.maximum(a0 * min(1.0, 2 * (1 - t)), a1 * min(1.0, 2 * t))
        alpha = np.clip((alpha - 0.06) / 0.88, 0, 1)[..., None]

        out = subj * alpha + back * (1 - alpha)
        write_bmp(path, out)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    in_dir, out_dir, steps = argv[0], argv[1], int(argv[2])
    only = {int(x) for x in argv[3].split(",")} if len(argv) > 3 else None
    os.makedirs(out_dir, exist_ok=True)
    n = len(ANCHORS)
    log = lambda m: print(m, flush=True)
    frames = [None] * n
    masks = [None] * n

    def load(i):
        if frames[i] is None:
            frames[i] = read_bmp(os.path.join(in_dir, f"a{i + 1:02d}.bmp"))
            masks[i] = subject_mask(frames[i], ANCHORS[i], SCALES[i])
        return frames[i]

    t_all = time.time()
    for i in range(n - 1):
        if only is not None and i not in only:
            continue
        A, B = load(i), load(i + 1)
        mA, mB = masks[i], masks[i + 1]
        base = i * steps
        write_bmp(os.path.join(out_dir, f"f{base:03d}.bmp"), A)
        if i == n - 2 or only is not None:
            write_bmp(os.path.join(out_dir, f"f{base + steps:03d}.bmp"), B)
        outs = [os.path.join(out_dir, f"f{base + k:03d}.bmp") for k in range(1, steps)]
        log(f"pair {i + 1}->{i + 2}: {len(outs)} in-betweens")
        t0 = time.time()
        process_pair(A, B, mA, mB, i, i + 1, steps, outs, log)
        log(f"    done {time.time() - t0:.1f}s")
    log(f"ALL DONE {time.time() - t_all:.1f}s")


main()
