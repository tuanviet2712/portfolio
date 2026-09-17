# Tách 3 lớp độ sâu cho từng ảnh gốc TRÊN KHUNG MỞ RỘNG (ext.py) — dùng chung cho sky.py và render.py:
#   sky  : mặt nạ trời (MoGe) — vùng sau lưng người và phần mở rộng: phân loại theo màu (kNN học từ ảnh)
#   d_bg : độ sâu lớp nền; vùng khuất/mở rộng lấp mượt từ tường xung quanh
#          (lấp trên nghịch đảo độ sâu: mặt phẳng => hàm tuyến tính => lấp gần như chính xác)
#   d_fg : độ sâu lớp người; dải viền tóc/áo và phần áo mở rộng lấy độ sâu phần lõi gần nhất
import os, json
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")

def ext_info():
    return json.load(open(os.path.join(PREP, "ext.json")))

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

def build(i, force=False):
    cache = os.path.join(PREP, f"a{i:02d}_layers_ext.npz")
    if os.path.exists(cache) and not force:
        return dict(np.load(cache))
    E = ext_info(); P = E["pad"]; W, H, WE, HE = E["W"], E["H"], E["WE"], E["HE"]
    def canvas(a, fill):
        c = np.full((HE, WE), fill, a.dtype); c[P["t"]:P["t"] + H, P["l"]:P["l"] + W] = a; return c
    g = np.load(os.path.join(PREP, f"a{i:02d}_geo_orig.npz"))
    d0 = g["depth"].astype(np.float32)
    v0 = g["mask"].astype(bool) & np.isfinite(d0) & (d0 > 0)
    d = canvas(np.where(v0, d0, np.nan).astype(np.float32), np.float32(np.nan))
    known = canvas(np.ones((H, W), bool), False)
    valid = canvas(v0, False)
    al = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_alpha.png")).convert("L")).astype(np.float32) / 255
    hole = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_holemask.png")).convert("L")) > 127
    hole |= ndimage.binary_dilation(al > 0.02, iterations=4)
    unknown = hole | ~known
    # --- trời: vùng biết chắc = ngoài người, trong khung gốc; còn lại phân loại màu trên ảnh nền mở rộng
    from scipy.spatial import cKDTree
    bg = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_bg.png")).convert("RGB"))
    lab = cv2.cvtColor(bg, cv2.COLOR_RGB2LAB).astype(np.float32)
    yy, xx = np.mgrid[0:HE, 0:WE].astype(np.float32)
    feat = np.dstack([lab[..., 0] * 0.6, lab[..., 1], lab[..., 2] * 1.4, yy / HE * 90, xx / WE * 30])
    sky = known & ~valid
    tr = (~unknown) & (((yy.astype(int) + xx.astype(int)) % 5) == 0)
    tree = cKDTree(feat[tr]); lab_tr = sky[tr]
    q = np.where(unknown)
    _, nn = tree.query(feat[q], k=9, workers=-1)
    sky_u = sky.copy(); sky_u[q] = lab_tr[nn].mean(1) > 0.5
    sky_u = ndimage.median_filter(sky_u.astype(np.uint8), 9).astype(bool)
    sky = np.where(unknown, sky_u, sky)
    sky = ndimage.binary_opening(sky, iterations=2)
    # --- độ sâu nền
    src = valid & ~hole & ~sky
    disp = np.where(src, 1.0 / np.where(src, d, 1), 0).astype(np.float32)
    fill = pushpull(disp, src.astype(np.float32))
    d_bg = np.where(src, d, 1.0 / np.maximum(fill, 1e-4)).astype(np.float32)
    d_bg[sky] = np.nan
    # --- độ sâu người (lõi = alpha cao trong khung gốc)
    core = ndimage.binary_erosion((al > 0.85) & valid, iterations=3)
    _, (cy, cx) = ndimage.distance_transform_edt(~core, return_indices=True)
    dd = np.where(np.isfinite(d), d, 0)
    d_fg = np.where(core, dd, dd[cy, cx]).astype(np.float32)
    d_fg = ndimage.median_filter(d_fg, 3)
    out = dict(sky=sky, d_bg=d_bg, d_fg=d_fg, K=g["intrinsics"].astype(np.float32))
    np.savez_compressed(cache, **out)
    return out

if __name__ == "__main__":
    import sys
    for i in range(1, 9):
        if os.path.exists(os.path.join(PREP, f"a{i:02d}_ext_bg.png")):
            o = build(i, force="--force" in sys.argv)
            print("layers", i, "sky %.1f%%" % (o["sky"].mean() * 100), "bg depth", np.nanpercentile(o["d_bg"], [2, 50, 98]).round(2), flush=True)
