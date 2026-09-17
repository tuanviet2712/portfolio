# Xuất "thế giới 3D" từ MỘT ảnh gốc cho hero WebGL (js/hero.js):
#   sky.webp    lớp trời (vô cực)               bg.webp   lớp tường (đã xoá người, LaMa)
#   fg.webp     lớp người (ảnh gốc mở rộng)     masks.webp R = alpha tường (không phải trời), G = alpha người
#   depth.png   độ sâu 16-bit (nghịch đảo) 2 lớp xếp dọc: nửa trên = tường, nửa dưới = người (R = byte cao, G = byte thấp)
#   scene.js    thông số camera gốc, lưới, dải độ sâu, vị trí khuôn mặt (window.HERO_SCENE)
# Dữ liệu vào: thư mục prep của tools/hero3d (prep.py → ext.py → ext_alpha.py → layers.py → sky.py đã chạy).
import os, sys, json, argparse, time
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("--anchor", type=int, default=8)
ap.add_argument("--prep", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "work", "prep"))
ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "hero", "a08"))
ap.add_argument("--step", type=int, default=4, help="bước lưới độ sâu (px khung mở rộng)")
ap.add_argument("--q", type=int, default=88, help="chất lượng WebP")
ap.add_argument("--eyex", type=float, default=None, help="x tâm hai mắt (px, khung gốc)")
ap.add_argument("--eyey", type=float, default=None, help="y tâm hai mắt (px, khung gốc)")
args = ap.parse_args()

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def imread(p, mode="RGB"): return np.asarray(Image.open(p).convert(mode))
def save_webp(arr, path, q, lossless=False):
    im = Image.fromarray(arr)
    if lossless: im.save(path, "WEBP", lossless=True, quality=100, method=6)
    else: im.save(path, "WEBP", quality=q, method=6)
    return os.path.getsize(path)

def pushpull(val, w, levels=9):
    """lấp giá trị ở nơi w == 0 bằng kim tự tháp chuẩn hoá (mượt, không tạo bậc)."""
    pv, pw = [val * w], [w.astype(np.float32)]
    for _ in range(levels):
        pv.append(cv2.pyrDown(pv[-1])); pw.append(cv2.pyrDown(pw[-1]))
    fv = pv[-1] / np.maximum(pw[-1], 1e-8)
    for l in range(levels - 1, -1, -1):
        up = cv2.pyrUp(fv, dstsize=(pv[l].shape[1], pv[l].shape[0]))
        a = np.clip(pw[l] * 4.0, 0, 1)
        fv = (pv[l] / np.maximum(pw[l], 1e-8)) * a + up * (1 - a)
    return fv

P, i = args.prep, args.anchor
E = json.load(open(os.path.join(P, "ext.json"))); PAD = E["pad"]; W, H, WE, HE = E["W"], E["H"], E["WE"], E["HE"]
rgb = imread(os.path.join(P, f"a{i:02d}_ext_rgb.png"))
bg = imread(os.path.join(P, f"a{i:02d}_ext_bg.png")).astype(np.float32)
sky_img = imread(os.path.join(P, f"a{i:02d}_ext_sky.png")).astype(np.float32)
al = imread(os.path.join(P, f"a{i:02d}_ext_alpha.png"), "L").astype(np.float32) / 255
L = np.load(os.path.join(P, f"a{i:02d}_layers_ext.npz"))
S, d_bg, d_fg, K = L["sky"].astype(bool), L["d_bg"].astype(np.float32), L["d_fg"].astype(np.float32), L["K"]
fx, fy, cx, cy = float(K[0, 0]), float(K[1, 1]), float(K[0, 2]), float(K[1, 2])
os.makedirs(args.out, exist_ok=True)
log(f"anchor {i}: ext {WE}x{HE}, pad {PAD}, K fx={fx:.4f} fy={fy:.4f}")

# ---------- 1. Sửa vùng trời sau lưng người: LaMa vẽ "đốm tối" ở chỗ đầu che trời -> thay bằng trời lấp mượt
Hm = ndimage.binary_dilation(al > 0.02, iterations=8)          # vùng sau lưng người
R = ndimage.binary_dilation(Hm, iterations=12) & S             # phần trời của vùng đó (nới thêm để trùm hết đốm)
known = (S & ~ndimage.binary_dilation(Hm, iterations=12)).astype(np.float32)
fill = np.dstack([pushpull(sky_img[..., c], known) for c in range(3)])
wR = np.clip(ndimage.distance_transform_edt(R) / 6.0, 0, 1)[..., None] * R[..., None]
sky_img = sky_img * (1 - wR) + fill * wR
bg = bg * (1 - wR) + fill * wR
log(f"sky fix: {int(R.sum())} px thay bằng trời lấp mượt")

# ---------- 2. Alpha lớp tường (không phải trời), mép mềm ~1.5 px
A_bg = np.clip(1.0 - cv2.GaussianBlur(S.astype(np.float32), (0, 0), 0.7), 0, 1)

# ---------- 3. Độ sâu 16-bit (trên nghịch đảo độ sâu) ở lưới thưa
v_bg = np.isfinite(d_bg) & (d_bg > 0)
disp_bg = np.where(v_bg, 1.0 / np.where(v_bg, d_bg, 1), 0).astype(np.float32)
disp_bg = pushpull(disp_bg, v_bg.astype(np.float32))            # lấp phần trời => lưới tường liên tục tới mép trời
disp_fg = (1.0 / np.maximum(d_fg, 1e-3)).astype(np.float32)
N, M = int(np.ceil(WE / args.step)), int(np.ceil(HE / args.step))
def down(x): return cv2.resize(x, (N, M), interpolation=cv2.INTER_AREA)
def enc16(x):
    lo, hi = float(x.min()), float(x.max())
    e = np.round((x - lo) / max(hi - lo, 1e-9) * 65535).astype(np.uint32)
    return np.dstack([(e >> 8).astype(np.uint8), (e & 255).astype(np.uint8), np.zeros(x.shape, np.uint8)]), [lo, hi]
db, rb = enc16(down(disp_bg)); df, rf = enc16(down(disp_fg))
depth_png = np.vstack([db, df])
Image.fromarray(depth_png).save(os.path.join(args.out, "depth.png"), optimize=True)
log(f"depth grid {N}x{M} (step {args.step}); disp bg {rb[0]:.3f}..{rb[1]:.3f} (d {1/rb[1]:.2f}..{1/rb[0]:.2f}) fg {rf[0]:.3f}..{rf[1]:.3f} (d {1/rf[1]:.2f}..{1/rf[0]:.2f})")

# ---------- 4. Hộp bao người trên lưới (để chỉ vẽ tam giác quanh người)
ys, xs = np.where(al > 0.004)
box = [max(0, int(xs.min() // args.step) - 3), max(0, int(ys.min() // args.step) - 3),
       min(N - 1, int(xs.max() // args.step) + 3), min(M - 1, int(ys.max() // args.step) + 3)]

# ---------- 5. Khuôn mặt: ước lượng từ alpha (đỉnh đầu + bề rộng đầu) trong khung gốc, hoặc --eyex/--eyey
a0 = al[PAD["t"]:PAD["t"] + H, PAD["l"]:PAD["l"] + W]
rows = np.where((a0 > 0.5).sum(1) > 8)[0]
top = int(rows.min())
cols = np.where(a0[min(H - 1, top + 70)] > 0.5)[0]
head_w = float(cols.max() - cols.min() + 1) if len(cols) else 300.0
ex = args.eyex if args.eyex is not None else float(cols.mean()) if len(cols) else W / 2
ey = args.eyey if args.eyey is not None else top + 0.42 * 1.3 * head_w
u, v = ex / W, ey / H
gy, gx = int(round(ey)) + PAD["t"], int(round(ex)) + PAD["l"]
dface = float(np.median(d_fg[gy - 12:gy + 13, gx - 12:gx + 13]))
face = dict(u=u, v=v, d=dface, x=(u - cx) / fx * dface, y=(v - cy) / fy * dface, z=dface, px=ex, py=ey)
log(f"face: eye ({ex:.0f},{ey:.0f}) px, head width {head_w:.0f}, depth {dface:.2f} m -> X ({face['x']:.3f},{face['y']:.3f},{face['z']:.3f})")

# ---------- 6. Texture màu + mặt nạ (bộ đủ + bộ 1/2 cỡ cho điện thoại)
bg_u8 = np.clip(bg + 0.5, 0, 255).astype(np.uint8)
sky_u8 = np.clip(sky_img + 0.5, 0, 255).astype(np.uint8)
masks = np.dstack([(A_bg * 255 + 0.5).astype(np.uint8), (al * 255 + 0.5).astype(np.uint8), np.zeros((HE, WE), np.uint8)])
def save_set(suffix, scale):
    sz, files = {}, {}
    def small(a): return a if scale == 1 else cv2.resize(a, (int(round(WE * scale)), int(round(HE * scale))), interpolation=cv2.INTER_AREA)
    for name, arr, q, lossless in (("fg", rgb, args.q, False), ("bg", bg_u8, args.q, False), ("sky", sky_u8, max(60, args.q - 8), False), ("masks", masks, 100, True)):
        files[name] = f"{name}{suffix}.webp"
        sz[name] = save_webp(small(arr), os.path.join(args.out, files[name]), q, lossless)
    files["depth"] = "depth.png"; sz["depth"] = os.path.getsize(os.path.join(args.out, "depth.png"))
    return files, sz
files, sz = save_set("", 1.0)
files_m, sz_m = save_set("_m", 0.5)

# ---------- 7. scene.js (+ bundle.js: dữ liệu base64 để mở trực tiếp file:// vẫn dựng được WebGL)
scene = dict(anchor=i, W=W, H=H, WE=WE, HE=HE, pad=PAD, K=[fx, fy, cx, cy], grid=[N, M], step=args.step,
             disp=dict(bg=rb, fg=rf), fgBox=box, face=face, skyDepth=400.0,
             depth=dict(bg=[float(np.nanpercentile(d_bg, 1)), float(np.nanpercentile(d_bg, 99))], fg=[float(d_fg.min()), float(d_fg.max())]),
             files=files, bytes=sz, filesSmall=files_m, bytesSmall=sz_m, bundle="bundle.js")
with open(os.path.join(args.out, "scene.js"), "w", encoding="utf-8") as f:
    f.write("// Sinh tự động bởi tools/hero3d/export_web.py — thông số thế giới 3D của hero\n")
    f.write("window.HERO_SCENE = " + json.dumps(scene, ensure_ascii=False, indent=1) + ";\n")
import base64
with open(os.path.join(args.out, "bundle.js"), "w", encoding="utf-8") as f:
    f.write("// Sinh tự động — texture mã hoá base64, chỉ dùng khi mở trực tiếp file:// (trình duyệt chặn WebGL đọc ảnh file://)\n")
    f.write("window.HERO_DATA = {\n")
    for name, fn in files.items():
        mime = "image/png" if fn.endswith(".png") else "image/webp"
        with open(os.path.join(args.out, fn), "rb") as g:
            f.write(f' {name}: "data:{mime};base64,{base64.b64encode(g.read()).decode("ascii")}",\n')
    f.write("};\n")
sz["bundle"] = os.path.getsize(os.path.join(args.out, "bundle.js"))

# ---------- 8. Ảnh kiểm tra: ghép 3 lớp + đánh dấu mặt
comp = sky_img * (1 - A_bg[..., None]) + bg * A_bg[..., None]
comp = comp * (1 - al[..., None]) + rgb.astype(np.float32) * al[..., None]
comp = np.clip(comp + 0.5, 0, 255).astype(np.uint8).copy()
cv2.circle(comp, (gx, gy), 14, (255, 255, 0), 3)
cv2.rectangle(comp, (PAD["l"], PAD["t"]), (PAD["l"] + W, PAD["t"] + H), (0, 255, 255), 2)
Image.fromarray(comp).resize((WE // 2, HE // 2), Image.LANCZOS).save(os.path.join(args.out, "_preview.jpg"), quality=85)
total = sum(v for k, v in sz.items() if k != "bundle")
log(f"xong -> {args.out}: " + ", ".join(f"{k} {v / 1024:.0f} KB" for k, v in sz.items()) + f"; bộ đủ {total / 1024 / 1024:.2f} MB, bộ điện thoại {sum(sz_m.values()) / 1024 / 1024:.2f} MB")
