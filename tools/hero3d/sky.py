# Lớp bầu trời (khung mở rộng): vẽ lại toàn bộ chỉ còn trời (LaMa xoá tường), đặt ở vô cực.
# Vùng trời nhìn thấy trong ảnh gốc giữ nguyên điểm ảnh gốc (nét), phần còn lại vẽ ở 1/2 độ phân giải.
import os, time
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(os.environ.get("TEMP", "."), "nbc"))
import numpy as np, torch, cv2
from PIL import Image
from scipy import ndimage
from simple_lama_inpainting import SimpleLama
import layers

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")
lama = SimpleLama(device=torch.device("cpu"))
for i in range(1, 9):
    out = os.path.join(PREP, f"a{i:02d}_ext_sky.png")
    if os.path.exists(out):
        continue
    t = time.time()
    bg = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_bg.png")).convert("RGB"))
    HE, WE = bg.shape[:2]
    sky = layers.build(i)["sky"]
    m = cv2.dilate(((~sky) * 255).astype(np.uint8), np.ones((9, 9), np.uint8))
    sw, sh = WE // 2 // 8 * 8, HE // 2 // 8 * 8
    res = np.asarray(lama(Image.fromarray(cv2.resize(bg, (sw, sh), interpolation=cv2.INTER_AREA)),
                          Image.fromarray(cv2.resize(m, (sw, sh), interpolation=cv2.INTER_NEAREST))))
    res = cv2.resize(res[:sh, :sw], (WE, HE), interpolation=cv2.INTER_CUBIC)
    keep = ndimage.binary_erosion(sky, iterations=3)
    a = np.clip(ndimage.distance_transform_edt(keep) / 4.0, 0, 1)[..., None]
    res = (bg.astype(np.float32) * a + res.astype(np.float32) * (1 - a) + 0.5).astype(np.uint8)
    Image.fromarray(res).save(out)
    print(time.strftime("%H:%M:%S"), "sky", i, f"{time.time() - t:.1f}s", f"sky {sky.mean() * 100:.1f}%", flush=True)
