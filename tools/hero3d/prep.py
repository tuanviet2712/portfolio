# Chuẩn bị dữ liệu 3D cho 8 ảnh gốc của hero:
#   1) MoGe-3: bản đồ điểm 3D + độ sâu + nội tham số camera (không méo không gian: tường phẳng vẫn phẳng)
#   2) BiRefNet: tách người (alpha mềm, giữ tóc)
#   3) LaMa: vẽ lại nền phía sau người (để khi camera di chuyển không lộ lỗ)
#   4) MoGe lần 2 trên ảnh nền đã vẽ lại -> độ sâu nền phía sau người
# Chạy lại được: bước nào đã có file thì bỏ qua.
import os, sys, json, time
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(os.environ.get("TEMP", "."), "nbc"))
import numpy as np
import torch
from PIL import Image, ImageFilter

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source-frames")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work", "prep")
os.makedirs(OUT, exist_ok=True)
torch.set_num_threads(os.cpu_count() or 8)
N = 8
stage = sys.argv[1] if len(sys.argv) > 1 else "all"

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

def p(i, name):
    return os.path.join(OUT, f"a{i:02d}_{name}")

def load(i):
    return Image.open(os.path.join(SRC, f"anchor-{i:02d}.png")).convert("RGB")

# ---------------- 1) matte ----------------
if stage in ("all", "matte"):
    from rembg import new_session, remove
    sess = None
    for i in range(1, N + 1):
        if os.path.exists(p(i, "alpha.png")):
            continue
        if sess is None:
            log("loading birefnet-portrait")
            sess = new_session("birefnet-portrait")
        t = time.time()
        m = remove(load(i), session=sess, only_mask=True)
        m.save(p(i, "alpha.png"))
        log("matte", i, f"{time.time() - t:.1f}s")

# ---------------- 2) inpaint background ----------------
if stage in ("all", "inpaint"):
    from simple_lama_inpainting import SimpleLama
    lama = None
    for i in range(1, N + 1):
        if os.path.exists(p(i, "bg.png")):
            continue
        if lama is None:
            log("loading LaMa")
            lama = SimpleLama(device=torch.device("cpu"))
        img = load(i)
        a = np.asarray(Image.open(p(i, "alpha.png")).convert("L"))
        # vùng cần vẽ lại = người + viền nở rộng (tránh sót viền tóc/áo)
        m = Image.fromarray(((a > 20) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31))
        m.save(p(i, "holemask.png"))
        t = time.time()
        res = lama(img, m)
        res = res.resize(img.size, Image.LANCZOS) if res.size != img.size else res
        res.save(p(i, "bg.png"))
        log("inpaint", i, f"{time.time() - t:.1f}s")

# ---------------- 3) geometry (MoGe) ----------------
if stage in ("all", "geo"):
    from moge.model.v2 import MoGeModel
    model = None
    for i in range(1, N + 1):
        for kind, fn in (("orig", lambda: load(i)),):
            if os.path.exists(p(i, f"geo_{kind}.npz")):
                continue
            if model is None:
                log("loading MoGe-2")
                model = MoGeModel.from_pretrained("Ruicheng/moge-2-vitl-normal").eval()
            img = np.asarray(fn(), dtype=np.float32) / 255.0
            x = torch.from_numpy(img).permute(2, 0, 1)
            t = time.time()
            with torch.inference_mode():
                o = model.infer(x, resolution_level=9, use_fp16=False)
            d = {k: (v.cpu().numpy() if isinstance(v, torch.Tensor) else v) for k, v in o.items()}
            np.savez_compressed(p(i, f"geo_{kind}.npz"), **{k: v for k, v in d.items() if isinstance(v, np.ndarray)})
            log("geo", i, kind, f"{time.time() - t:.1f}s", {k: getattr(v, "shape", v) for k, v in d.items()})
log("done", stage)
