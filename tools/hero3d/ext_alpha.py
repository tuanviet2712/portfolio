# Alpha người cho phần khung mở rộng: kéo thẳng đường viền người ra ngoài từ đúng chỗ người chạm mép khung
# (áo kéo xuống dưới, tóc kéo lên trên...), chỉ giữ ở điểm ảnh đủ tối (áo/tóc) của ảnh vẽ thêm.
# Không lan sang tường tối vì chỉ đi thẳng ra từ mép, không nối vùng.
import os, json
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")
E = json.load(open(os.path.join(PREP, "ext.json"))); P = E["pad"]; W, H, WE, HE = E["W"], E["H"], E["WE"], E["HE"]
t, l = P["t"], P["l"]

def smoothstep(a, b, x):
    x = np.clip((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x)

def build(i):
    al = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_alpha.png")).convert("L")).astype(np.float32) / 255
    rgb = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_rgb.png")).convert("RGB"))
    L = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0].astype(np.float32) * (100 / 255)
    A = np.zeros((HE, WE), np.float32)
    A[t:t + H, l:l + W] = al
    edge = lambda v: np.where(v > 0.35, v, 0)                  # chỉ kéo phần thực sự là người
    A[t + H:, l:l + W] = edge(al[-1])[None, :]                 # dưới
    A[:t, l:l + W] = edge(al[0])[None, :]                      # trên
    A[t:t + H, :l] = edge(al[:, 0])[:, None]                   # trái
    A[t:t + H, l + W:] = edge(al[:, -1])[:, None]              # phải
    A[t + H:, :l] = edge(al[-1, 0]); A[t + H:, l + W:] = edge(al[-1, -1])
    A[:t, :l] = edge(al[0, 0]); A[:t, l + W:] = edge(al[0, -1])
    known = np.zeros((HE, WE), bool); known[t:t + H, l:l + W] = True
    gate = smoothstep(80, 65, L)                               # dưới/hai bên: bỏ phần sáng (trời, tường nắng)
    gate[:t] = smoothstep(45, 30, L[:t])                       # trên: chỉ tóc tối, không kéo lên trời
    A = np.where(known, A, A * gate)
    # làm mềm nhẹ riêng phần mở rộng (không làm mờ đường nối với khung gốc)
    soft = cv2.GaussianBlur(A, (0, 0), 1.0)
    A = np.where(known, A, np.minimum(A, soft + 0.02))
    Image.fromarray((A * 255 + 0.5).astype(np.uint8)).save(os.path.join(PREP, f"a{i:02d}_ext_alpha.png"))
    hole = cv2.dilate(((A > 20 / 255) * 255).astype(np.uint8), np.ones((31, 31), np.uint8))
    Image.fromarray(hole).save(os.path.join(PREP, f"a{i:02d}_ext_holemask.png"))
    return A

if __name__ == "__main__":
    for i in range(1, 9):
        if os.path.exists(os.path.join(PREP, f"a{i:02d}_ext_rgb.png")):
            A = build(i)
            print("ext alpha", i, "outside-frame person px:", int((A[:t].sum() + A[t + H:].sum() + A[:, :l].sum() + A[:, l + W:].sum())))
