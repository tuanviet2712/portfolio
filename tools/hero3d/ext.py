# Mở rộng khung ảnh gốc ra ngoài biên (outpainting) để camera/người di chuyển không lộ mép cắt.
#   rgb_ext : ảnh gốc + phần vẽ thêm (LaMa) — áo, tường, trời kéo dài tự nhiên
#   bg_ext  : ảnh nền (đã xoá người) + phần vẽ thêm
#   sky_ext : lớp trời mở rộng (vùng trời gốc giữ nguyên độ nét)
#   alpha_ext : alpha người; phần mở rộng lấy vùng tối nối liền với người ở mép khung (áo/tóc)
# Vùng ảnh gốc giữ nguyên 100% điểm ảnh gốc. LaMa chạy ở 1/2 độ phân giải cho phần mở rộng (ngoại vi).
import os, json, time
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(os.environ.get("TEMP", "."), "nbc"))
import numpy as np, torch, cv2
from PIL import Image
from scipy import ndimage
from simple_lama_inpainting import SimpleLama

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source-frames")
W, H = 1672, 941
PAD = dict(l=640, r=640, t=260, b=300)     # ~38% hai bên, 28% trên, 32% dưới — hero WebGL cần lề rộng để camera xoay/dịch không lộ mép
WE, HE = W + PAD["l"] + PAD["r"], H + PAD["t"] + PAD["b"]
json.dump(dict(pad=PAD, W=W, H=H, WE=WE, HE=HE), open(os.path.join(PREP, "ext.json"), "w"))
lama = SimpleLama(device=torch.device("cpu"))

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def rgb(p): return np.asarray(Image.open(p).convert("RGB"))
def canvas(img, fill=0):
    c = np.full((HE, WE) + img.shape[2:], fill, img.dtype)
    c[PAD["t"]:PAD["t"] + H, PAD["l"]:PAD["l"] + W] = img
    return c
known = canvas(np.ones((H, W), bool), False)

def outpaint(cv, known_mask, scale=0.5):
    sw, sh = int(WE * scale) // 8 * 8, int(HE * scale) // 8 * 8
    small = cv2.resize(cv, (sw, sh), interpolation=cv2.INTER_AREA)
    m = cv2.resize((~known_mask).astype(np.uint8) * 255, (sw, sh), interpolation=cv2.INTER_NEAREST)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    res = np.asarray(lama(Image.fromarray(small), Image.fromarray(m)))
    res = cv2.resize(res[:sh, :sw], (WE, HE), interpolation=cv2.INTER_CUBIC)
    # ghép: giữ ảnh gốc, chuyển mềm 8px ở mép
    d = ndimage.distance_transform_edt(known_mask)
    a = np.clip(d / 8.0, 0, 1)[..., None]
    return (cv.astype(np.float32) * a + res.astype(np.float32) * (1 - a) + 0.5).astype(np.uint8)

for i in range(1, 9):
    out = os.path.join(PREP, f"a{i:02d}_ext_bg.png")
    if os.path.exists(out):
        continue
    t0 = time.time()
    # 1) ảnh gốc mở rộng
    rgb_ext = outpaint(canvas(rgb(os.path.join(SRC, f"anchor-{i:02d}.png"))), known)
    Image.fromarray(rgb_ext).save(os.path.join(PREP, f"a{i:02d}_ext_rgb.png"))
    # 2) alpha: gốc trong khung; ngoài khung = vùng tối (áo/tóc) nối với người ở mép
    al = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_alpha.png")).convert("L")).astype(np.float32) / 255
    al_c = canvas(al, 0.0)
    L = cv2.cvtColor(rgb_ext, cv2.COLOR_RGB2LAB)[..., 0].astype(np.float32)
    dark = (L < 100) & ~known
    seed = ndimage.binary_dilation(al_c > 0.5, iterations=3)
    lab_, n_ = ndimage.label(dark | (seed & ~known) | (known & (al_c > 0.5)))
    keep = np.isin(lab_, np.unique(lab_[(al_c > 0.5) & known]))
    ext_a = (keep & ~known).astype(np.float32)
    ext_a = cv2.GaussianBlur(ext_a, (0, 0), 1.2)
    alpha_ext = np.where(known, al_c, ext_a)
    Image.fromarray((alpha_ext * 255 + 0.5).astype(np.uint8)).save(os.path.join(PREP, f"a{i:02d}_ext_alpha.png"))
    hole = cv2.dilate(((alpha_ext > 20 / 255) * 255).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    Image.fromarray((hole * 255).astype(np.uint8)).save(os.path.join(PREP, f"a{i:02d}_ext_holemask.png"))
    # 3) nền mở rộng: nền gốc (đã xoá người) + vẽ thêm; vùng người ở phần mở rộng cũng xoá
    bg_c = canvas(rgb(os.path.join(PREP, f"a{i:02d}_bg.png")))
    bg_ext = outpaint(bg_c, known & ~(hole & ~known))
    Image.fromarray(bg_ext).save(os.path.join(PREP, f"a{i:02d}_ext_bg.png"))
    log(f"anchor {i}: rgb/alpha/bg ext {time.time() - t0:.1f}s")
