# Dựng hình 3D thật cho hero (OpenGL offscreen):
#   mỗi ảnh gốc = bầu trời (vô cực) + nền (lưới độ sâu) + người (lưới độ sâu + alpha)
#   HAI đường camera C2-mượt đi qua đúng vị trí chụp của 8 ảnh: một cho nền/trời, một cho người.
# Mỗi khung: dựng lớp của ảnh gốc gần nhất; đoạn chuyển dựng cả 2 ảnh gốc từ CÙNG camera rồi trộn trên GPU,
# có tính "độ phủ" (vùng ảnh gốc thực sự có dữ liệu) để ảnh này lấp chỗ thiếu của ảnh kia.
# Vùng không ảnh nào phủ -> camera zoom nhẹ (mượt theo thời gian) để không bao giờ lộ mép.
import os, sys, json, time, math, argparse
import numpy as np, moderngl, cv2
from PIL import Image
from scipy import ndimage
from scipy.interpolate import CubicSpline, PchipInterpolator
from scipy.spatial.transform import Rotation, RotationSpline
import layers

HERE = os.path.dirname(os.path.abspath(__file__))
PREP = os.path.join(HERE, "work", "prep")
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source-frames")

ap = argparse.ArgumentParser()
ap.add_argument("--per", type=int, default=36)          # số khung mỗi đoạn giữa 2 ảnh gốc
ap.add_argument("--ss", type=float, default=2.0)        # siêu lấy mẫu
ap.add_argument("--step", type=int, default=2)          # bước lưới (pixel)
ap.add_argument("--out", default=os.path.join(HERE, "work", "frames"))
ap.add_argument("--only", default="")                   # vd "0-40" hoặc "36,54,72"
ap.add_argument("--blend", default="0.3,0.7")           # vùng trộn trong mỗi đoạn (u0,u1)
ap.add_argument("--check", action="store_true")         # kiểm tra căn chỉnh: dựng ảnh k từ camera k+1
ap.add_argument("--pairs", action="store_true")         # lưu ảnh A/B riêng cho vùng trộn (để nội suy RIFE)
ap.add_argument("--nozoom", action="store_true")
ap.add_argument("--noflow", action="store_true")           # tắt biến dạng flow (khi nội suy bằng RIFE)
args = ap.parse_args()

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
P = json.load(open(os.path.join(PREP, "poses.json")))
W, H = P["W"], P["H"]
cams = P["cams"]; N = len(cams)
EXT = layers.ext_info(); PAD = EXT["pad"]; WE, HE = EXT["WE"], EXT["HE"]   # khung mở rộng (ext.py)

# ---------------------------------------------------------------- hình học
def load_rgb(path): return np.asarray(Image.open(path).convert("RGB"))

def unproject(d, K):
    """d: độ sâu trên khung mở rộng (HE x WE); toạ độ quy về khung gốc (nội tham số K chuẩn hoá theo W, H)."""
    fx, fy, cx, cy = K[0][0], K[1][1], K[0][2], K[1][2]
    ys, xs = np.mgrid[0:HE, 0:WE].astype(np.float32)
    u = (xs - PAD["l"] + 0.5) / W; v = (ys - PAD["t"] + 0.5) / H
    return np.stack([(u - cx) / fx * d, (v - cy) / fy * d, d], -1)

def to_world(X, c):
    return (X * c["scale"]) @ np.array(c["R"]).T + np.array(c["t"])

def grid_mesh(Pw, valid, logd, alpha=None, step=2, tau=0.022):
    H, W = Pw.shape[:2]          # khung mở rộng
    ys = np.arange(0, H, step); xs = np.arange(0, W, step)
    if ys[-1] != H - 1: ys = np.append(ys, H - 1)
    if xs[-1] != W - 1: xs = np.append(xs, W - 1)
    gy, gx = np.meshgrid(ys, xs, indexing="ij")
    V = Pw[gy, gx].reshape(-1, 3)
    # UV phủ kín mép khung (điểm lưới ở mép = mép ảnh) => không hụt nửa pixel ở biên
    UV = np.stack([np.where(gx == W - 1, 1.0, np.where(gx == 0, 0.0, (gx + 0.5) / W)),
                   np.where(gy == H - 1, 1.0, np.where(gy == 0, 0.0, (gy + 0.5) / H))], -1).reshape(-1, 2)
    okv = valid[gy, gx].ravel(); ldv = logd[gy, gx].ravel()
    ny, nx = gy.shape
    idx = np.arange(ny * nx).reshape(ny, nx)
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, :-1], idx[1:, 1:]
    av = alpha[gy, gx].ravel() if alpha is not None else None
    def tri_ok(i0, i1, i2):
        m = okv[i0] & okv[i1] & okv[i2]
        e = np.maximum(np.maximum(np.abs(ldv[i0] - ldv[i1]), np.abs(ldv[i1] - ldv[i2])), np.abs(ldv[i0] - ldv[i2]))
        m &= e < tau * step * 1.5
        if av is not None:
            m &= (av[i0] + av[i1] + av[i2]) > 0.01
        return m
    t1 = np.stack([a, c, b], -1).reshape(-1, 3); t2 = np.stack([b, c, d], -1).reshape(-1, 3)
    T = np.concatenate([t1[tri_ok(*t1.T)], t2[tri_ok(*t2.T)]])
    V = np.nan_to_num(V, nan=0.0, posinf=0.0, neginf=0.0)
    return np.hstack([V, UV]).astype("f4"), T.astype("u4")

def prepare(i):
    cam = cams[i - 1]; K = cam["K"]
    lay = layers.build(i)
    al = np.asarray(Image.open(os.path.join(PREP, f"a{i:02d}_ext_alpha.png")).convert("L")).astype(np.float32) / 255
    d_bg = lay["d_bg"]; v_bg = np.isfinite(d_bg); d_bg = np.where(v_bg, d_bg, 1.0)
    d_fg = lay["d_fg"]
    reg = ndimage.binary_dilation(al > 0.004, iterations=3)
    Pbg = to_world(unproject(d_bg, K), cam)
    Pfg = to_world(unproject(d_fg, K), cam)
    lbg = np.log(d_bg).astype(np.float32); lfg = np.log(np.maximum(d_fg, 1e-6)).astype(np.float32)
    mb = grid_mesh(Pbg, v_bg, lbg, step=args.step)
    mf = grid_mesh(Pfg, reg, lfg, alpha=al, step=args.step, tau=0.05)
    # lưới phủ toàn khung theo camera người (chỉ để đo độ phủ, bước thưa)
    mc = grid_mesh(Pfg, np.ones_like(reg), np.zeros_like(lfg), step=8, tau=1e9)
    log(f"anchor {i}: bg tris {len(mb[1])} fg tris {len(mf[1])}")
    return dict(rgb=load_rgb(os.path.join(PREP, f"a{i:02d}_ext_rgb.png")),
                bg=load_rgb(os.path.join(PREP, f"a{i:02d}_ext_bg.png")),
                sky=load_rgb(os.path.join(PREP, f"a{i:02d}_ext_sky.png")),
                alpha=(al * 255).astype(np.uint8), mb=mb, mf=mf, mc=mc, cam=cam)

# ---------------------------------------------------------------- OpenGL
ctx = moderngl.create_standalone_context(require=330)

CUBIC = """
vec4 cubic(sampler2D t, vec2 uv) {
  vec2 ts = vec2(textureSize(t, 0));
  vec2 sp = uv * ts; vec2 p1 = floor(sp - 0.5) + 0.5; vec2 f = sp - p1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)); vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f)); vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2; vec2 p12 = (p1 + w2 / w12) / ts; vec2 p0 = (p1 - 1.0) / ts; vec2 p3 = (p1 + 2.0) / ts;
  vec4 r = texture(t, vec2(p0.x, p0.y)) * w0.x * w0.y + texture(t, vec2(p12.x, p0.y)) * w12.x * w0.y + texture(t, vec2(p3.x, p0.y)) * w3.x * w0.y
         + texture(t, vec2(p0.x, p12.y)) * w0.x * w12.y + texture(t, vec2(p12.x, p12.y)) * w12.x * w12.y + texture(t, vec2(p3.x, p12.y)) * w3.x * w12.y
         + texture(t, vec2(p0.x, p3.y)) * w0.x * w3.y + texture(t, vec2(p12.x, p3.y)) * w12.x * w3.y + texture(t, vec2(p3.x, p3.y)) * w3.x * w3.y;
  return clamp(r, 0.0, 1.0);
}
"""
VS = """#version 330
uniform mat3 Rt; uniform vec3 C; uniform vec4 Kn; uniform vec2 nf; uniform mat3 Aff; uniform float os;
in vec3 in_pos; in vec2 in_uv; out vec2 v_uv;
void main() {
  vec3 p = Rt * (in_pos - C); float z = p.z; float n = nf.x, f = nf.y;
  vec4 c = vec4(2.0 * Kn.x * p.x + (2.0 * Kn.z - 1.0) * z, -(2.0 * Kn.y * p.y + (2.0 * Kn.w - 1.0) * z), (z * (f + n) - 2.0 * f * n) / (f - n), z);
  // affine 2D của ảnh (ảnh-uv, y xuống) = đổi nội tham số camera => áp đúng cả phần mở rộng ngoài khung
  vec3 q = Aff * vec3(0.5 * (c.x + c.w), 0.5 * (c.w - c.y), c.w);
  gl_Position = vec4((2.0 * q.x - c.w) / os, (c.w - 2.0 * q.y) / os, c.z, c.w);
  v_uv = in_uv;
}"""
FS_BG = "#version 330\nuniform sampler2D tex; in vec2 v_uv; out vec4 o;\n" + CUBIC + "void main(){ o = vec4(cubic(tex, v_uv).rgb, 1.0); }"
FS_FG = "#version 330\nuniform sampler2D tex; uniform sampler2D alp; in vec2 v_uv; out vec4 o;\n" + CUBIC + \
        "void main(){ float a = texture(alp, v_uv).r; if (a < 0.004) discard; o = vec4(cubic(tex, v_uv).rgb * a, a); }"
FS_ONE = "#version 330\nin vec2 v_uv; out vec4 o; void main(){ o = vec4(1.0); }"
VS_Q = "#version 330\nin vec2 in_p; out vec2 v_p; void main(){ v_p = in_p; gl_Position = vec4(in_p, 0.0, 1.0); }"
FS_SKY = """#version 330
uniform sampler2D tex; uniform mat3 Rrel; uniform vec4 Ko; uniform vec4 Ka; uniform vec4 ext; in vec2 v_p; out vec4 o;
""" + CUBIC + """
void main() {
  vec2 uv = vec2(v_p.x * 0.5 + 0.5, 0.5 - v_p.y * 0.5);
  vec3 q = Rrel * vec3((uv.x - Ko.z) / Ko.x, (uv.y - Ko.w) / Ko.y, 1.0);
  vec2 st = vec2(Ka.x * q.x / q.z + Ka.z, Ka.y * q.y / q.z + Ka.w) * ext.xy + ext.zw;   // -> toạ độ khung mở rộng
  float inr = (q.z > 0.0 && all(greaterThanEqual(st, vec2(0.0))) && all(lessThanEqual(st, vec2(1.0)))) ? 1.0 : 0.0;
  o = vec4(cubic(tex, clamp(st, vec2(0.0005), vec2(0.9995))).rgb, inr);
}"""
# trộn 2 ảnh gốc theo trọng số + độ phủ; ghép người lên nền
FS_COMP = """#version 330
uniform sampler2D bgA, bgB, fgA, fgB, cvA, cvB, fAB, fBA;
uniform float w, tm, zm, os; uniform int two, roleB, useflow; in vec2 v_p; out vec4 o;
vec2 ov(vec2 uv) { return 0.5 + (uv - 0.5) / os; }
vec4 tx(sampler2D t, vec2 uv) { return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(t, uv); }
vec2 fl(sampler2D f, vec2 uv) { vec2 d = texture(f, 0.5 + (uv - 0.5) / zm).xy * zm; return vec2(d.x, -d.y); }  // flow đo ở zoom 1
void main() {
  vec2 uv = v_p * 0.5 + 0.5;
  vec2 oA = vec2(0.0), oB = vec2(0.0);
  if (useflow == 1) {                                   // Super SloMo: dòng chảy từ thời điểm tm về 2 đầu
    vec2 ab = fl(fAB, uv), ba = fl(fBA, uv);
    oA = -(1.0 - tm) * tm * ab + tm * tm * ba;
    oB = (1.0 - tm) * (1.0 - tm) * ab - tm * (1.0 - tm) * ba;
  }
  vec2 ua = ov(uv + (roleB == 1 ? oB : oA)), ub = ov(uv + oB);
  vec4 a = texture(bgA, uv), fa = tx(fgA, ua); float ca = tx(cvA, ua).r;
  if (two == 0) { o = vec4(fa.rgb + a.rgb * (1.0 - fa.a), min(a.a, ca)); return; }
  vec4 b = texture(bgB, uv), fb = tx(fgB, ub); float cb = tx(cvB, ub).r;
  float wa = (1.0 - w) * a.a, wb = w * b.a; float s = wa + wb;
  vec3 bg = s > 1e-4 ? (a.rgb * wa + b.rgb * wb) / s : mix(a.rgb, b.rgb, w);
  float ga = (1.0 - w) * ca, gb = w * cb; float g = ga + gb;
  vec4 fg = g > 1e-4 ? (fa * ga + fb * gb) / g : mix(fa, fb, w);
  // mép cắt của ảnh gốc (người chạm khung) không được lộ: độ phủ người tính theo trọng số trộn
  float cov = min(max(a.a, b.a) * step(1e-4, s), step(0.93, (1.0 - w) * ca + w * cb));
  o = vec4(fg.rgb + bg * (1.0 - fg.a), cov);
}"""
prog_bg = ctx.program(vertex_shader=VS, fragment_shader=FS_BG)
prog_fg = ctx.program(vertex_shader=VS, fragment_shader=FS_FG)
prog_one = ctx.program(vertex_shader=VS, fragment_shader=FS_ONE)
prog_sky = ctx.program(vertex_shader=VS_Q, fragment_shader=FS_SKY)
prog_comp = ctx.program(vertex_shader=VS_Q, fragment_shader=FS_COMP)
quad = ctx.buffer(np.array([-1, -1, 3, -1, -1, 3], dtype="f4"))
vao_sky = ctx.vertex_array(prog_sky, [(quad, "2f", "in_p")])
vao_comp = ctx.vertex_array(prog_comp, [(quad, "2f", "in_p")])

def tex(img, comps=3):
    t = ctx.texture((img.shape[1], img.shape[0]), comps, np.ascontiguousarray(img).tobytes())
    t.filter = (moderngl.LINEAR, moderngl.LINEAR); t.repeat_x = t.repeat_y = False
    return t

class Anchor:
    def __init__(self, i):
        d = prepare(i)
        self.i = i; self.cam = d["cam"]
        self.t_rgb, self.t_bg, self.t_sky, self.t_a = tex(d["rgb"]), tex(d["bg"]), tex(d["sky"]), tex(d["alpha"], 1)
        def vao(prog, m): return ctx.vertex_array(prog, [(ctx.buffer(m[0].tobytes()), "3f 2f", "in_pos", "in_uv")], ctx.buffer(m[1].tobytes()))
        self.vao_bg, self.vao_fg, self.vao_cov = vao(prog_bg, d["mb"]), vao(prog_fg, d["mf"]), vao(prog_one, d["mc"])

class Targets:
    """bộ đích dựng: 2 bộ lớp (A, B) + ảnh ghép. Lớp người/độ phủ dựng rộng hơn khung (os) để morph không hụt mép."""
    def __init__(self, rw, rh, os_):
        self.size = (rw, rh); self.os = os_
        fw, fh = int(round(rw * os_)), int(round(rh * os_)); self.fsize = (fw, fh)
        self.depth = ctx.depth_renderbuffer((rw, rh)); self.fdepth = ctx.depth_renderbuffer((fw, fh))
        def t4(w_, h_):
            x = ctx.texture((w_, h_), 4); x.filter = (moderngl.LINEAR, moderngl.LINEAR); x.repeat_x = x.repeat_y = False; return x
        self.L = [dict(bg=t4(rw, rh), fg=t4(fw, fh), cv=t4(fw, fh)) for _ in range(2)]
        for L_ in self.L:
            L_["fbo_bg"] = ctx.framebuffer(color_attachments=[L_["bg"]], depth_attachment=self.depth)
            for k in ("fg", "cv"):
                L_["fbo_" + k] = ctx.framebuffer(color_attachments=[L_[k]], depth_attachment=self.fdepth)
        self.out = t4(rw, rh); self.fbo_out = ctx.framebuffer(color_attachments=[self.out])
_targets = {}
def targets(rw, rh, os_=1.15):
    if (rw, rh, os_) not in _targets: _targets[(rw, rh, os_)] = Targets(rw, rh, os_)
    return _targets[(rw, rh, os_)]

def Kvec(K): return (K[0][0], K[1][1], K[0][2], K[1][2])
def set_cam(prog, Rcw, C, K, Aff=None, os_=1.0):
    prog["Rt"].write(Rcw.astype("f4").tobytes())       # GLSL (cột) nhận R^T => Rt = R^T (camera <- thế giới)
    prog["C"].value = tuple(C); prog["Kn"].value = Kvec(K); prog["nf"].value = (0.02, 5000.0)
    prog["Aff"].write((np.eye(3) if Aff is None else Aff).T.astype("f4").copy().tobytes())
    prog["os"].value = float(os_)

def render_layers(an, slot, cb, cf, K, tg, F=None):
    """dựng 3 lớp của ảnh gốc `an` vào slot (0/1). cb = cf = (R thế giới<-camera, tâm); F = affine thuận của lớp người."""
    s = tg.L[slot]
    # nền + trời (alpha = độ phủ)
    s["fbo_bg"].use(); s["fbo_bg"].clear(0, 0, 0, 0, depth=1.0)
    ctx.disable(moderngl.DEPTH_TEST | moderngl.BLEND)
    Ra = np.array(an.cam["R"])
    prog_sky["Rrel"].write(((Ra.T @ cb[0]).T).astype("f4").tobytes())
    prog_sky["Ko"].value = Kvec(K); prog_sky["Ka"].value = Kvec(an.cam["K"])
    prog_sky["ext"].value = (W / WE, H / HE, PAD["l"] / WE, PAD["t"] / HE)
    an.t_sky.use(0); prog_sky["tex"].value = 0
    vao_sky.render(moderngl.TRIANGLES)
    ctx.enable(moderngl.DEPTH_TEST)
    set_cam(prog_bg, cb[0], cb[1], K); an.t_bg.use(0); prog_bg["tex"].value = 0
    an.vao_bg.render(moderngl.TRIANGLES)
    # độ phủ khung theo camera người
    s["fbo_cv"].use(); s["fbo_cv"].clear(0, 0, 0, 0, depth=1.0)
    ctx.disable(moderngl.DEPTH_TEST)
    set_cam(prog_one, cf[0], cf[1], K, F, tg.os); an.vao_cov.render(moderngl.TRIANGLES)
    # người (alpha nhân sẵn)
    s["fbo_fg"].use(); s["fbo_fg"].clear(0, 0, 0, 0, depth=1.0)
    ctx.enable(moderngl.DEPTH_TEST | moderngl.BLEND); ctx.blend_func = moderngl.ONE, moderngl.ONE_MINUS_SRC_ALPHA
    set_cam(prog_fg, cf[0], cf[1], K, F, tg.os); an.t_rgb.use(0); an.t_a.use(1); prog_fg["tex"].value = 0; prog_fg["alp"].value = 1
    an.vao_fg.render(moderngl.TRIANGLES)
    ctx.disable(moderngl.BLEND | moderngl.DEPTH_TEST)

_zero_flow = None
def composite(tg, w, two, flow=None, tm=0.0, roleB=False, zm=1.0):
    global _zero_flow
    tg.fbo_out.use(); tg.fbo_out.clear(0, 0, 0, 0)
    prog_comp["os"].value = float(tg.os)
    if _zero_flow is None:
        _zero_flow = ctx.texture((4, 4), 2, np.zeros((4, 4, 2), "f4").tobytes(), dtype="f4")
    fab, fba = flow if flow is not None else (_zero_flow, _zero_flow)
    units = dict(bgA=tg.L[0]["bg"], fgA=tg.L[0]["fg"], cvA=tg.L[0]["cv"], bgB=tg.L[1]["bg"], fgB=tg.L[1]["fg"], cvB=tg.L[1]["cv"], fAB=fab, fBA=fba)
    for n, (k, t) in enumerate(units.items()):
        t.use(n); prog_comp[k].value = n
    prog_comp["w"].value = float(w); prog_comp["two"].value = int(two)
    prog_comp["tm"].value = float(tm); prog_comp["roleB"].value = int(roleB); prog_comp["useflow"].value = int(flow is not None); prog_comp["zm"].value = float(zm)
    vao_comp.render(moderngl.TRIANGLES)
    rw, rh = tg.size
    return np.frombuffer(tg.fbo_out.read(components=4, alignment=1), dtype=np.uint8).reshape(rh, rw, 4)[::-1]

def read_layer(tg, slot, key):
    rw, rh = tg.size if key == "bg" else tg.fsize
    return np.frombuffer(tg.L[slot]["fbo_" + key].read(components=4, alignment=1), dtype=np.uint8).reshape(rh, rw, 4)[::-1]

# ---------------------------------------------------------------- đường camera (2 đường: nền / người)
times = np.arange(N, dtype=float)
_rs = RotationSpline(times, Rotation.from_matrix(np.array([c["R"] for c in cams])))
_ps = CubicSpline(times, np.array([c["t"] for c in cams]), bc_type="natural")
def path_bg(t): return (_rs(t).as_matrix(), _ps(t))
path_fg = path_bg
k_spline = PchipInterpolator(times, np.array([Kvec(c["K"]) for c in cams]))
def K_at(t, zoom=1.0):
    k = k_spline(t)
    return [[k[0] * zoom, 0, k[2]], [0, k[1] * zoom, k[3]], [0, 0, 1]]
# affine người theo đoạn (pixel -> ảnh-uv): T_k đưa người của ảnh k (dựng ở camera k+1) về đúng vị trí ở ảnh k+1
D = np.diag([W, H, 1.0]); Di = np.linalg.inv(D)
TUV = [Di @ np.vstack([np.array(T), [0, 0, 1]]) @ D for T in P["person_affine"]]
def person_fwd(k, u, zoom=1.0):
    """affine thuận (ảnh-uv) cho lớp người của ảnh k (A) và k+1 (B) tại tiến độ u của đoạn k.
    Affine đo ở zoom 1 => khi camera zoom quanh tâm, đổi hệ: Z F Z^-1."""
    s = u * u * (3 - 2 * u)
    T = TUV[k]; I = np.eye(3)
    FA = I + s * (T - I)
    FB = I + (1 - s) * (np.linalg.inv(T) - I)
    Z = np.array([[zoom, 0, 0.5 * (1 - zoom)], [0, zoom, 0.5 * (1 - zoom)], [0, 0, 1]]); Zi = np.linalg.inv(Z)
    return Z @ FA @ Zi, Z @ FB @ Zi

def smoothstep(a, b, x):
    x = np.clip((x - a) / (b - a), 0, 1); return float(x * x * (3 - 2 * x))

per = args.per
total = (N - 1) * per + 1
u0, u1 = map(float, args.blend.split(","))
def frame_setup(f):
    t = f / per
    k = min(N - 2, int(math.floor(t))); u = t - k
    return t, k, smoothstep(u0, u1, u)

def draw_frame(f, zoom, tg, use_flow=True):
    t, k, w = frame_setup(f)
    u = t - k
    tm = u * u * (3 - 2 * u)
    cb, K = path_bg(t), K_at(t, zoom)
    FA, FB = person_fwd(k, u, zoom)
    fl = segment_flow(k) if (use_flow and not args.noflow) else None
    if w <= 0:
        render_layers(A[k], 0, cb, cb, K, tg, FA)
        return composite(tg, 0, False, fl, tm, False, zoom), None
    if w >= 1:
        render_layers(A[k + 1], 0, cb, cb, K, tg, FB)
        return composite(tg, 0, False, fl, tm, True, zoom), None
    render_layers(A[k], 0, cb, cb, K, tg, FA)
    render_layers(A[k + 1], 1, cb, cb, K, tg, FB)
    return composite(tg, w, True, fl, tm, False, zoom), (k, w)

# ---- optical flow dư giữa 2 lớp người đã căn (ở camera ảnh k+1), tính 1 lần mỗi đoạn
_flow_tex = {}
def segment_flow(k):
    if k in _flow_tex: return _flow_tex[k]
    import poses as PS
    cache = os.path.join(PREP, f"pflow_{k}.npz")
    if os.path.exists(cache):
        d = np.load(cache); fab, fba = d["fab"], d["fba"]
    else:
        # đo ở CAMERA GIỮA ĐOẠN (nơi 2 ảnh được trộn), chỉ trên LỚP NGƯỜI (đặt trên nền xám) => không bị mây/nền nhiễu
        t = k + 0.5; cb = path_bg(t); K = K_at(t, 1.0)
        FA, FB = person_fwd(k, 0.5)
        tg1 = targets(W, H, 1.0)
        def person(an, F):
            render_layers(an, 0, cb, cb, K, tg1, F)
            return read_layer(tg1, 0, "fg").astype(np.float32) / 255
        fA, fB = person(A[k], FA), person(A[k + 1], FB)
        u8 = lambda x: (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)
        imA = u8(fA[..., :3] + 0.5 * (1 - fA[..., 3:4])); imB = u8(fB[..., :3] + 0.5 * (1 - fB[..., 3:4]))
        f_ab, f_ba = PS.flow(imA, imB), PS.flow(imB, imA)
        def clean(fwd, bwd, alpha):
            gy, gx = np.mgrid[0:PS.FH, 0:PS.FW].astype(np.float32)
            back = PS.sample(bwd, gx + 0.5 + fwd[..., 0], gy + 0.5 + fwd[..., 1])
            err = np.hypot(fwd[..., 0] + back[..., 0], fwd[..., 1] + back[..., 1])
            pm = cv2.resize(alpha, (PS.FW, PS.FH), interpolation=cv2.INTER_AREA) > 0.3
            m = (pm & (err < 3.0)).astype(np.float32)
            out = np.zeros_like(fwd)
            for c_ in range(2):
                v = cv2.GaussianBlur(fwd[..., c_] * m, (0, 0), 1.2); ww = cv2.GaussianBlur(m, (0, 0), 1.2)
                sm = np.where(ww > 1e-3, v / np.maximum(ww, 1e-3), 0).astype(np.float32)
                out[..., c_] = layers.pushpull(sm, (ww > 0.3).astype(np.float32))
            return out, m.sum() / max(pm.sum(), 1)
        fab, ca = clean(f_ab, f_ba, fA[..., 3]); fba, cb_ = clean(f_ba, f_ab, fB[..., 3])
        fab[..., 0] /= PS.FW; fab[..., 1] /= PS.FH; fba[..., 0] /= PS.FW; fba[..., 1] /= PS.FH
        np.savez_compressed(cache, fab=fab, fba=fba)
        mag = np.hypot(fab[..., 0] * W, fab[..., 1] * H)[cv2.resize(fA[..., 3], (PS.FW, PS.FH)) > 0.3]
        log(f"segment {k + 1}->{k + 2}: person flow median {np.median(mag):.1f}px p99 {np.percentile(mag, 99):.1f}px consistent {ca * 100:.0f}%/{cb_ * 100:.0f}%")
        Image.fromarray(np.hstack([imA, imB])[::2, ::2]).save(os.path.join(PREP, f"mid_{k + 1}.jpg"))
    def up(a_):
        t_ = ctx.texture((a_.shape[1], a_.shape[0]), 2, np.ascontiguousarray(a_[::-1]).astype("f4").tobytes(), dtype="f4")
        t_.filter = (moderngl.LINEAR, moderngl.LINEAR); t_.repeat_x = t_.repeat_y = False
        return t_
    _flow_tex[k] = (up(fab), up(fba))
    return _flow_tex[k]

def need_zoom(cov):
    """zoom tối thiểu (quanh tâm) để khung cắt nằm trọn trong vùng có dữ liệu."""
    h, w = cov.shape
    bad = (cov < 128).astype(np.int32)
    if not bad.any(): return 1.0
    S = np.pad(bad.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    def ok(z):
        hw, hh = w / (2 * z), h / (2 * z)
        x0, x1 = int(math.floor(w / 2 - hw)), int(math.ceil(w / 2 + hw)); y0, y1 = int(math.floor(h / 2 - hh)), int(math.ceil(h / 2 + hh))
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(w, x1), min(h, y1)
        return S[y1, x1] - S[y0, x1] - S[y1, x0] + S[y0, x0] == 0
    lo, hi = 1.0, 1.6
    if not ok(hi): return hi
    for _ in range(18):
        mid = (lo + hi) / 2
        if ok(mid): hi = mid
        else: lo = mid
    return hi

# ---------------------------------------------------------------- chạy
os.makedirs(args.out, exist_ok=True)
t0 = time.time()
A = [Anchor(i) for i in range(1, N + 1)]
RW, RH = int(round(W * args.ss)), int(round(H * args.ss))
log(f"scene ready {time.time() - t0:.1f}s  render {RW}x{RH}")
def save(img, name): Image.fromarray(img).save(os.path.join(args.out, name))

if args.check:
    tg = targets(RW, RH)
    for k in range(N - 1):
        c = cams[k + 1]; cb = (np.array(c["R"]), np.array(c["t"]))
        FA, _ = person_fwd(k, 1.0)
        render_layers(A[k], 0, cb, cb, c["K"], tg, FA)
        img = cv2.resize(composite(tg, 0, False)[..., :3], (W, H), interpolation=cv2.INTER_AREA)
        ref = load_rgb(os.path.join(SRC, f"anchor-{k + 2:02d}.png"))
        mix = ((img.astype(np.float32) + ref) * 0.5).astype(np.uint8)
        diff = np.clip(np.abs(img.astype(np.int16) - ref).sum(-1) * 2, 0, 255).astype(np.uint8)
        sheet = np.vstack([np.hstack([img, ref]), np.hstack([mix, np.repeat(diff[..., None], 3, -1)])])
        save(cv2.resize(sheet, (W, H)), f"check_{k + 1}to{k + 2}.jpg")
    c = cams[0]; cb = (np.array(c["R"]), np.array(c["t"]))
    render_layers(A[0], 0, cb, cb, c["K"], tg)
    s0 = cv2.resize(composite(tg, 0, False)[..., :3], (W, H), interpolation=cv2.INTER_AREA)
    log("self-check anchor1 mean abs diff", float(np.abs(s0.astype(int) - load_rgb(os.path.join(SRC, "anchor-01.png"))).mean()))
    sys.exit()

sel = list(range(total))
if args.only:
    if "-" in args.only: a_, b_ = map(int, args.only.split("-")); sel = list(range(a_, b_ + 1))
    else: sel = [int(x) for x in args.only.split(",")]

# lượt 1 (độ phân giải thấp): đo độ phủ -> zoom cần thiết cho từng khung, làm mượt theo thời gian
zooms = np.ones(total)
if not args.nozoom:
    tq = targets(W // 4, H // 4)
    req = np.array([need_zoom(draw_frame(f, 1.0, tq)[0][..., 3]) for f in range(total)])
    z = ndimage.maximum_filter1d(req, size=int(per * 0.6) | 1)
    for _ in range(3):
        z = np.maximum(ndimage.gaussian_filter1d(z, per * 0.18), req)
    zooms = ndimage.gaussian_filter1d(z, 2.0) * 1.004
    zooms = np.maximum(zooms, req)
    np.save(os.path.join(args.out, "zooms.npy"), zooms)
    log("zoom req max %.3f  final range %.3f..%.3f" % (req.max(), zooms.min(), zooms.max()))

tg = targets(RW, RH)
for f in sel:
    img, pair = draw_frame(f, zooms[f], tg)
    out = cv2.resize(img[..., :3], (W, H), interpolation=cv2.INTER_AREA) if args.ss != 1 else img[..., :3].copy()
    save(out, f"f{f:03d}.png")
    if args.pairs and pair:
        k, w = pair
        t = f / per; cb, K = path_bg(t), K_at(t, zooms[f])
        u_ = t - k; tm_ = u_ * u_ * (3 - 2 * u_)
        FA, FB = person_fwd(k, u_, zooms[f])
        for slot, an, F in ((0, A[k], FA), (1, A[k + 1], FB)):
            render_layers(an, 0, cb, cb, K, tg, F)
            im = cv2.resize(composite(tg, 0, False, None if args.noflow else segment_flow(k), tm_, slot == 1, zooms[f])[..., :3], (W, H), interpolation=cv2.INTER_AREA)
            save(im, f"p{f:03d}_{'ab'[slot]}.png")
        open(os.path.join(args.out, f"p{f:03d}.w"), "w").write(f"{w:.5f}")
    if f % 20 == 0: log(f"frame {f}/{total - 1} zoom {zooms[f]:.3f}")
log(f"done {time.time() - t0:.1f}s")
