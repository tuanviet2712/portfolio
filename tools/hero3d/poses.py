# Ước lượng vị trí camera của 8 ảnh gốc — HAI đường camera riêng:
#   bg : camera theo nền (tường, mép giếng trời)  -> lớp nền + bầu trời
#   fg : camera theo người (thân, áo)             -> lớp người
# Lý do: ảnh gốc do AI tạo nên vị trí người so với căn phòng không nhất quán tuyệt đối giữa các ảnh;
# dùng 2 đường riêng thì cả nền lẫn người đều khớp, và người trượt nhẹ so với nền như thị sai tự nhiên.
#   - RAFT (optical flow dày, kiểm tra 2 chiều) -> cặp điểm tương ứng giữa 2 ảnh liền kề
#   - điểm 3D (MoGe, ảnh i) + toạ độ 2D (ảnh i+1) -> PnP RANSAC -> (R, t); tỉ lệ = trung vị tỉ số độ sâu
import os, json, time
import numpy as np, torch, cv2
from PIL import Image
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source-frames")
N = 8
torch.set_num_threads(os.cpu_count() or 8)
FW, FH = 1024, 576   # độ phân giải tính flow (chia hết cho 8)

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def img(i): return np.asarray(Image.open(os.path.join(SRC, f"anchor-{i:02d}.png")).convert("RGB"))
def geo(i, kind="orig"): return dict(np.load(os.path.join(PREP, f"a{i:02d}_geo_{kind}.npz")))
def alpha(i): return np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_alpha.png")).convert("L")).astype(np.float32) / 255

def Kpx(g, W, H):
    k = g["intrinsics"].astype(np.float64)
    return np.array([[k[0, 0] * W, 0, k[0, 2] * W], [0, k[1, 1] * H, k[1, 2] * H], [0, 0, 1]])

_model = None
def flow(a, b):
    global _model
    from torchvision.models.optical_flow import raft_large, Raft_Large_Weights
    if _model is None:
        _model = raft_large(weights=Raft_Large_Weights.DEFAULT).eval()
    tf = Raft_Large_Weights.DEFAULT.transforms()
    ta = torch.from_numpy(np.ascontiguousarray(a)).permute(2, 0, 1)[None].float() / 255
    tb = torch.from_numpy(np.ascontiguousarray(b)).permute(2, 0, 1)[None].float() / 255
    ta = F.interpolate(ta, (FH, FW), mode="bilinear", align_corners=False)
    tb = F.interpolate(tb, (FH, FW), mode="bilinear", align_corners=False)
    ta, tb = tf(ta, tb)
    with torch.inference_mode():
        return _model(ta, tb, num_flow_updates=24)[-1][0].permute(1, 2, 0).numpy()

def flows(i):
    p = os.path.join(PREP, f"flow_{i}.npz")
    if os.path.exists(p):
        d = np.load(p); return d["f_ab"], d["f_ba"]
    t0 = time.time()
    A, B = img(i), img(i + 1)
    f_ab, f_ba = flow(A, B), flow(B, A)
    np.savez_compressed(p, f_ab=f_ab, f_ba=f_ba)
    log(f"flow {i}->{i+1} {time.time() - t0:.1f}s")
    return f_ab, f_ba

def sample(arr, x, y):
    """lấy mẫu gần nhất arr[y, x]; x,y theo quy ước cạnh pixel (tâm pixel j nằm ở j + 0.5)."""
    H, W = arr.shape[:2]
    xi = np.clip(np.floor(x).astype(int), 0, W - 1); yi = np.clip(np.floor(y).astype(int), 0, H - 1)
    return arr[yi, xi]

def correspondences(i):
    A = img(i); H, W = A.shape[:2]
    f_ab, f_ba = flows(i)
    gA, gB = geo(i), geo(i + 1)
    sx, sy = W / FW, H / FH
    gy, gx = np.mgrid[1:FH:3, 1:FW:3]
    fx, fy = f_ab[gy.ravel(), gx.ravel()].T
    gx = gx.ravel().astype(np.float64) + 0.5; gy = gy.ravel().astype(np.float64) + 0.5
    bx, by = gx + fx, gy + fy
    back = sample(f_ba, bx, by)
    err = np.hypot(bx + back[:, 0] - gx, by + back[:, 1] - gy)
    ok = (err < 0.8) & (bx >= 0) & (bx < FW) & (by >= 0) & (by < FH)
    ax, ay, px, py = gx * sx, gy * sy, bx * sx, by * sy
    ok &= sample(gA["mask"].astype(bool), ax, ay) & sample(gB["mask"].astype(bool), px, py)
    P3 = sample(gA["points"], ax, ay).astype(np.float64)
    ok &= np.all(np.isfinite(P3), axis=1)
    aA, aB = alpha(i), alpha(i + 1)
    person = (sample(aA, ax, ay) > .5) & (sample(aB, px, py) > .5)
    backgr = (sample(aA, ax, ay) < .02) & (sample(aB, px, py) < .02)
    dB = sample(gB["depth"], px, py).astype(np.float64)
    return dict(P3=P3, uv=np.stack([px, py], 1), dB=dB, ok=ok, person=person, bg=backgr, K=Kpx(gB, W, H))

def solve(c, sel, thr, name):
    obj, uv, K = c["P3"][sel], c["uv"][sel], c["K"]
    succ, rvec, tvec, inl = cv2.solvePnPRansac(obj, uv, K, None, reprojectionError=thr, iterationsCount=8000,
                                               confidence=0.9995, flags=cv2.SOLVEPNP_EPNP)
    inl = inl.ravel()
    rvec, tvec = cv2.solvePnPRefineLM(obj[inl], uv[inl], K, None, rvec, tvec)
    R, _ = cv2.Rodrigues(rvec); t = tvec.ravel()
    proj, _ = cv2.projectPoints(obj, rvec, tvec, K, None)
    e = np.linalg.norm(proj[:, 0] - uv, axis=1)
    good = e < thr
    Xb = obj[good] @ R.T + t
    dB = c["dB"][sel][good]
    m = np.isfinite(dB) & (dB > 0)
    s = float(np.median(Xb[m, 2] / dB[m]))
    log(f"  {name}: pts {sel.sum()} inl {good.sum()} ({good.mean() * 100:.0f}%) err {np.median(e[good]):.2f}px "
        f"rot {np.degrees(np.linalg.norm(rvec)):.2f}deg t {t.round(3)} scale {s:.4f}")
    return R, t, s

def solve_t(c, sel, R, thr, name, iters=600, seed=0):
    """giữ nguyên phép xoay R (của nền), chỉ giải tịnh tiến t cho người: tuyến tính + RANSAC.
    Tránh nhập nhằng xoay/tịnh tiến khi vật thể gần như phẳng (người)."""
    obj, uv, K = c["P3"][sel], c["uv"][sel], c["K"]
    x = (uv[:, 0] - K[0, 2]) / K[0, 0]; y = (uv[:, 1] - K[1, 2]) / K[1, 1]
    RX = obj @ R.T
    # t_x - x t_z = x (RX)_z - (RX)_x ;  t_y - y t_z = y (RX)_z - (RX)_y
    n = len(x)
    Am = np.zeros((2 * n, 3)); b = np.zeros(2 * n)
    Am[0::2, 0] = 1; Am[0::2, 2] = -x; b[0::2] = x * RX[:, 2] - RX[:, 0]
    Am[1::2, 1] = 1; Am[1::2, 2] = -y; b[1::2] = y * RX[:, 2] - RX[:, 1]
    def reproj(t):
        Y = RX + t
        return np.hypot(K[0, 0] * Y[:, 0] / Y[:, 2] + K[0, 2] - uv[:, 0], K[1, 1] * Y[:, 1] / Y[:, 2] + K[1, 2] - uv[:, 1])
    rng = np.random.default_rng(seed)
    best, best_n = None, -1
    for _ in range(iters):
        idx = rng.choice(n, 3, replace=False)
        rows = np.concatenate([2 * idx, 2 * idx + 1])
        t, *_ = np.linalg.lstsq(Am[rows], b[rows], rcond=None)
        k = (reproj(t) < thr).sum()
        if k > best_n: best, best_n = t, k
    for _ in range(3):                       # tinh chỉnh bằng bình phương tối thiểu trên inlier
        m = reproj(best) < thr
        rows = np.concatenate([2 * np.where(m)[0], 2 * np.where(m)[0] + 1])
        best, *_ = np.linalg.lstsq(Am[rows], b[rows], rcond=None)
    e = reproj(best); good = e < thr
    Xb = RX[good] + best; dB = c["dB"][sel][good]
    mm = np.isfinite(dB) & (dB > 0)
    s = float(np.median(Xb[mm, 2] / dB[mm]))
    log(f"  {name}: pts {n} inl {good.sum()} ({good.mean() * 100:.0f}%) err {np.median(e[good]):.2f}px t {best.round(3)} scale {s:.4f}")
    return R, best, s

def chain(rel):
    Rw = [np.eye(3)]; tw = [np.zeros(3)]; S = [1.0]
    for R, t, s in rel:
        Rc = R.T; tc = -R.T @ t          # camera i+1 trong hệ camera i (đơn vị ảnh i)
        tw.append(tw[-1] + S[-1] * (Rw[-1] @ tc))
        Rw.append(Rw[-1] @ Rc)
        S.append(S[-1] * s)
    return Rw, tw, S

def person_affine(c, rb):
    """người của ảnh i, chiếu bằng camera nền của ảnh i+1, lệch với người thật ở ảnh i+1 một phép affine 2D.
    Trả về T (2x3, pixel ảnh gốc): vị trí dự đoán -> vị trí thật."""
    R, t, _ = rb
    sel = c["ok"] & c["person"]
    obj, uv, K = c["P3"][sel], c["uv"][sel], c["K"]
    Y = obj @ R.T + t
    q = np.stack([K[0, 0] * Y[:, 0] / Y[:, 2] + K[0, 2], K[1, 1] * Y[:, 1] / Y[:, 2] + K[1, 2]], 1)
    T, inl = cv2.estimateAffine2D(q.astype(np.float32), uv.astype(np.float32), method=cv2.RANSAC,
                                  ransacReprojThreshold=4.0, maxIters=6000, confidence=0.999, refineIters=20)
    inl = inl.ravel().astype(bool)
    pred = q @ T[:, :2].T + T[:, 2]
    e = np.linalg.norm(pred - uv, axis=1)
    raw = np.linalg.norm(q - uv, axis=1)
    sc = np.sqrt(abs(np.linalg.det(T[:, :2])))
    log(f"  person affine: pts {sel.sum()} inl {inl.mean() * 100:.0f}% err {np.median(e[inl]):.2f}px (before {np.median(raw):.1f}px) "
        f"shift {T[:, 2].round(1)} scale {sc:.3f} rot {np.degrees(np.arctan2(T[1, 0], T[0, 0])):.2f}deg")
    return T

if __name__ == "__main__":
    H, W = img(1).shape[:2]
    rel_bg, aff = [], []
    for i in range(1, N):
        log(f"pair {i}->{i+1}")
        c = correspondences(i)
        rb = solve(c, c["ok"] & c["bg"], 2.5, "bg")
        rel_bg.append(rb)
        aff.append(person_affine(c, rb).tolist())
    cb = chain(rel_bg)
    cams = []
    for k in range(N):
        g = geo(k + 1)
        cams.append(dict(K=g["intrinsics"].tolist(), fovx=float(np.degrees(2 * np.arctan(0.5 / g["intrinsics"][0, 0]))),
                         R=cb[0][k].tolist(), t=cb[1][k].tolist(), scale=cb[2][k]))
        log(f"cam {k+1}: pos {np.round(cb[1][k], 3)} s {cb[2][k]:.3f} fov {cams[-1]['fovx']:.1f}")
    json.dump(dict(W=W, H=H, cams=cams, person_affine=aff), open(os.path.join(PREP, "poses.json"), "w"), indent=1)
