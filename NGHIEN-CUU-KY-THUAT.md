# Nghiên cứu kỹ thuật: Website cuộn chuyển động 3D

Tài liệu này giải thích các website mẫu (SceneAI, GetLayers) tạo hiệu ứng "camera 3D chạy theo cuộn" bằng cách nào, và portfolio này được xây dựng theo cách nào.

> **Bản đang dùng: §6 — video AI tua theo cuộn** (một clip 10 s → 240 khung, cuộn tới đâu camera chạy tới đó). §2–4 là hai quy trình cũ (chuỗi ảnh từ 8 ảnh gốc), §5 là bản WebGL "ảnh 3D" (vẫn xem được bằng `?hero=3d`).

---

## 1. Các website mẫu làm như thế nào?

| Mẫu | Kỹ thuật chính | Ghi chú |
|---|---|---|
| **SceneAI** (3 link `sceneai.art/landing-pages`) | **Video AI toàn màn hình**. Một số trang tua video theo thanh cuộn (scroll-scrub). | Video được tạo bằng AI (image-to-video). Máy ảnh "bay" quanh chủ thể. Nội dung trang cuộn đè lên video đang được ghim. |
| **GetLayers – Artefakt** | **Three.js (WebGL)**: mô hình 3D `.glb` nén Draco, cộng thêm chuỗi khung hình trên canvas. Dùng Lenis cho cuộn mượt. | Có section được ghim (pinned), preloader, chữ hiện dần kiểu "giải mã", con trỏ phát sáng. |
| **GetLayers – AI Studio / Stride** | **WebGL real-time**: quả cầu hạt, nền gradient chuyển động. Một "đồng hồ" duy nhất điều khiển mọi pha. | "One clock" nghĩa là một biến tiến trình cuộn 0 → 1 điều khiển mọi animation. |

**Mẫu số chung** của cả 6 trang:

1. **Section được ghim (sticky/pinned)**: một khung cao 400–800vh, bên trong có một "sân khấu" cao 100vh giữ nguyên trên màn hình.
2. **Tiến trình cuộn 0 → 1**, sau đó áp lên:
   - chỉ số khung hình (chuỗi ảnh hoặc `video.currentTime`),
   - độ mờ, độ nhoè, vị trí của các lớp chữ theo từng "chương".
3. **Làm mượt bằng quán tính**: mỗi khung hình, giá trị hiển thị tiến dần tới giá trị đích theo `cur += (target - cur) * k`. Nhờ vậy, dù lăn chuột theo nấc, chuyển động vẫn trơn.
4. **Chi tiết giao diện**:
   - HUD kiểu máy quay: góc khung ngắm, thông số camera.
   - Chữ hiện dần kèm hiệu ứng nhoè.
   - Nút dạng viên thuốc, chỉ số dạng [01], preloader.
   - Section kế tiếp trượt lên như một tấm thẻ.

### Ba cách làm chuyển động 3D

| Cách | Ưu điểm | Nhược điểm |
|---|---|---|
| **A. Chuỗi ảnh trên `<canvas>`** (Apple, SceneAI) | Tua tới/lui chính xác từng khung, mượt nhất, chạy mọi trình duyệt | Tải nhiều ảnh (vài MB) |
| **B. Tua video** (`video.currentTime`) | 1 file nhẹ | Tua giật nếu video không mã hoá keyframe dày (`-g 4..8`); Safari/iOS kém ổn định |
| **C. WebGL / Three.js** | 3D thật, tương tác tự do | Cần mô hình 3D của nhân vật; không dùng được ảnh chụp thật |

➡ Bản đầu dùng cách A (chuỗi ảnh). **Bản hiện tại dùng cách C — WebGL thời gian thực** với một "ảnh 3D" dựng từ ảnh thật, nên vừa giữ điểm ảnh gốc vừa có 3D thật (xem mục 5).

---

## 2. Bài toán: chỉ có 8 khung gốc

8 khung ảnh chụp là 8 vị trí camera. Nếu chỉ chuyển mờ giữa chúng, mắt người sẽ thấy "chồng hình" chứ không thấy camera di chuyển.

**Phiên bản 1 (đã thay):** tự viết bộ nội suy optical flow bằng numpy, chạy trong Blender (`tools/interpolate_frames.py`, giữ lại để tham khảo). Cách này cho 85 khung nhưng ở các đoạn camera đổi góc mạnh, khung trung gian bị **bóng ma** ở mép vest, xà bê tông và mờ khuôn mặt.

**Phiên bản 2 (đã thay): AI nội suy khung hình RIFE** (`rife-ncnn-vulkan`, model v4.6), chạy trực tiếp trên GPU của máy qua Vulkan, không cần cài Python hay driver gì thêm. RIFE là mạng học sâu chuyên dùng để tạo khung trung gian cho video (tăng 24 → 60 fps), xử lý tốt che khuất và chuyển động lớn.

Quy trình (`tools/build-sequence.ps1`):

1. Với mỗi cặp khung gốc (A, B), gọi RIFE ở **23 thời điểm** t = 1/24 … 23/24. Mỗi khung trung gian được tạo **trực tiếp từ hai ảnh thật**, không nội suy chồng lên khung đã nội suy.
2. Khung gốc được sao chép nguyên bản, nên f000, f024, f048, … trùng đúng anchor-01 … 08 (đã kiểm chứng bằng PSNR = ∞).
3. Tổng cộng **169 khung** (7 × 24 + 1). Nén WebP q80 ≈ 60–75 KB/khung, khoảng 12 MB.

Lưu ý kỹ thuật: RIFE đọc tham số thời điểm theo ngôn ngữ hệ thống, máy tiếng Việt dùng dấu phẩy (`-s 0,5`). Script tự dò dấu thập phân. Chế độ thư mục `-n` của công cụ chia khung không đều giữa các cặp nên không dùng.

> Khuôn mặt, quần áo, bối cảnh đều từ ảnh gốc của bạn. AI chỉ ước lượng chuyển động giữa hai ảnh và dịch chuyển điểm ảnh theo đó.

---

## 3. Trình phát trên web (`js/hero.js`)

Vì sao bản đầu bị khựng và vỡ nét, và cách xử lý:

| Vấn đề | Nguyên nhân | Cách xử lý |
|---|---|---|
| Bóng ma, nhoè | Khung nội suy lỗi + trình phát **trộn mờ 2 khung liền kề** (hai ảnh lệch vài px chồng lên nhau) | Khung mới sạch (RIFE); trình phát chỉ **vẽ đúng 1 khung gần nhất**, không trộn |
| Khựng khi cuộn | Trình duyệt phải **giải nén lại ảnh** ngay lúc vẽ: 85–169 khung đã giải nén tốn 0,5–1 GB nên bị xoá khỏi bộ đệm liên tục | **Cửa sổ giải nén trượt**: luôn giữ sẵn ~36 khung quanh vị trí cuộn (ưu tiên hướng đang cuộn) dưới dạng `ImageBitmap`, cộng 8 khung gốc; khung ra khỏi cửa sổ được giải phóng |
| Tốn GPU trên màn Retina | Canvas vẽ ở 2× kích thước dù ảnh gốc chỉ 1672 px | Độ phân giải canvas **không vượt quá ảnh gốc** |
| Blur nền nặng | `backdrop-filter` 20 px trên các bảng kính phải tính lại mỗi khung | Giảm còn 14 px, bảng không hiển thị thì ẩn hẳn |

Các đặc điểm khác:

- **Canvas 2D** tự vừa khung (cover), giữ khuôn mặt ở giữa khi xem màn hình dọc. Vị trí mắt nội suy qua 8 khung gốc.
- **Tải tiến dần**: 8 khung gốc trước (trang dùng được ngay), rồi tinh dần 12 → 6 → 3 → 1. Điện thoại chỉ tải 1/3 số khung.
- **Quán tính**: `p += (target − p)·(1 − e^(−7·dt))`; khi camera chạy nhanh có "dolly" nhẹ.
- **Parallax theo chuột**, **5 chương nội dung**, **HUD camera** (CAM 001/169, ORBIT, PITCH, tầm máy), **chuyển giao** sang section kế tiếp như tấm thẻ.

---

## 4. Muốn mượt hơn nữa?

| Nâng cấp | Cách làm |
|---|---|
| Nhiều khung hơn | `tools/build-sequence.ps1 -Steps 32`: 225 khung (~15 MB). Đổi `SEQ.count = 225`, `SEQ.perAnchor = 32` trong `js/hero.js`. |
| Chuyển động "điện ảnh" thật (tóc, vải bay) | Dùng AI video có chế độ **khung đầu – khung cuối** (Kling, Runway, Veo, Luma…) cho từng cặp khung gốc. Xuất 24 khung/cặp bằng ffmpeg (`ffmpeg -i clip.mp4 -vf fps=24 f%03d.png`) rồi nén WebP như script. Nên bật khoá nhân vật (character reference) để giữ đúng khuôn mặt. |
| Tải nhanh hơn trên di động | Tạo thêm một bộ khung 1280px cho màn hình dưới 768px, rồi đổi `SEQ.src` theo `innerWidth`. |

> Mục 2–4 mô tả các bản cũ (chuỗi ảnh). Bản hiện tại ở mục 5.

---

## 5. Phiên bản 4 (hiện tại): học công nghệ lõi của Ascend, dựng 3D thời gian thực

### 5.1 Bóc tách prompt "Ascend — Scale Smarter" (getlayers.ai)

Trang mẫu không dùng ảnh hay video. Toàn bộ chuyển động là **một cảnh 3D thật chạy trong trình duyệt** (Three.js r143, WebGL). Những kỹ thuật quyết định độ mượt:

| # | Kỹ thuật trong prompt | Ý nghĩa | Áp dụng cho portfolio |
|---|---|---|---|
| 1 | `planet.glb` + shader tự viết, render lại **mỗi khung hình** (`requestAnimationFrame`) | Không có "khung hình có sẵn"; mỗi lần màn hình làm tươi là một ảnh mới → không bao giờ nhảy bậc, không nội suy giữa hai ảnh. | Thay chuỗi 253 ảnh bằng WebGL2 dựng 3 lớp có độ sâu từ **một** ảnh gốc, render mỗi khung (`js/hero.js`). |
| 2 | `pTarget = scrollY / (scrollHeight − innerHeight)`; `curP += (pTarget − curP) · min(1, dt·4.5)` | Cuộn chỉ là **đích**; tiến trình hiển thị đuổi theo với giảm chấn. Lăn chuột theo nấc 100 px vẫn ra đường cong trơn. | Giữ nguyên hằng số 4.5 (`DAMP_P`). |
| 3 | `curX/curY/curS` lại giảm chấn lần 2 tới `sample(STOPS, curP)` với `k = min(1, dt·3.2)` | **Giảm chấn hai tầng**: tầng 1 làm mượt tiến trình, tầng 2 làm mượt tư thế → gia tốc liên tục, cảm giác "trôi". | Tư thế camera (vị trí, vị trí mặt, roll, fov) giảm chấn tầng 2 với 3.2 (`DAMP_POSE`). |
| 4 | `STOPS_X/Y/S = [{p, v}…]` + `sample()` = smoothstep từng đoạn | Đường đi bằng **keyframe** theo tiến trình, nội suy trơn; hành trình được biên đạo (vào to ở dưới → lùi ra → lắc trái/phải → dừng). | `PATH` 5 keyframe, nội suy **PCHIP** (đạo hàm liên tục, không vượt biên — mượt hơn smoothstep từng đoạn vì không dừng ở mỗi mốc). |
| 5 | `new Lenis({ duration: 1.15, smoothWheel: true })` | Làm mượt chính thanh cuộn (quán tính). | Không cần: giảm chấn hai tầng đã xử lý; cuộn tự nhiên giữ nguyên cho phần còn lại của trang. |
| 6 | **Một quả cầu duy nhất**; chỉ `worldGroup` (vị trí + scale) và `planetGroup.rotation.y` đổi | **Môi trường không bao giờ thay đổi** — chỉ camera/đối tượng chuyển động. Đây là lý do cốt lõi bản cũ bị "đổi môi trường": 8 ảnh AI là 8 thế giới khác nhau. | Chỉ dùng một ảnh gốc → một thế giới; không còn chuyển cảnh, không còn RIFE. |
| 7 | `spin 0.03`, mây `cloudSpin`, sao nhấp nháy `starFlicker`, hạt `atmoSpeed` | Cảnh **sống** cả khi không cuộn. | Mây trôi chậm (dịch UV lớp trời), camera trôi rất nhẹ (`FLOAT`), parallax chuột (`MOUSE`). |
| 8 | `ENTRY_DUR 1.9`, `ENTRY_START_Y −6.5`, ease `1 − (1 − t)³` một lần khi tải xong | Khoảnh khắc mở màn: cảnh **trôi vào** thay vì hiện tĩnh. | `ENTRY` 2,4 s: camera lùi xa/thấp hơn một chút rồi trôi vào vị trí đầu. |
| 9 | Bloom, corner-flame, halo cộng màu (`FinalPass`) | Hậu kỳ tạo chất "premium"; không liên quan độ mượt. | Không dùng (ảnh thật không cần); giữ vignette CSS. |
| 10 | `[data-reveal]` + IntersectionObserver, stagger 60/180/300/420 ms | Chữ hiện dần theo nhịp. | Đã có sẵn (chương nội dung theo tiến trình, chữ trồi lên theo từ). |

**Bài học lõi:** độ mượt "như video AI" đến từ (a) **một thế giới nhất quán** + (b) **render lại mỗi khung theo camera** + (c) **cuộn là đích, hiển thị đuổi theo với giảm chấn hai tầng** + (d) **đường camera là keyframe trơn**. Ascend có mô hình 3D (`.glb`); portfolio chỉ có ảnh, nên phần khó là làm ra "thế giới 3D" từ một tấm ảnh.

### 5.2 Dựng "ảnh 3D" từ một ảnh gốc (`tools/hero3d`)

1. **Tách người** (BiRefNet qua `rembg`) → matte alpha. **Xoá người khỏi nền** (LaMa) để lớp tường liền mạch phía sau.
2. **Độ sâu** (MoGe-2, `Ruicheng/moge-2-vitl-normal`, chạy CPU) cho tường và người; vùng tường bị người che được lấp trên nghịch đảo độ sâu (mặt phẳng → tuyến tính → lấp gần đúng). Trời được nhận dạng (MoGe không trả độ sâu cho trời) và đặt ở vô cực.
3. **Vẽ mở rộng ra ngoài khung** (LaMa, ~38 % hai bên · 28 % trên · 32 % dưới): camera ảo xoay tới ±17° và ngẩng ~10° vẫn không lộ mép. Vùng trời sau lưng người mà LaMa vẽ tối được thay bằng trời lấp mượt (push-pull).
4. **Xuất cho web** (`export_web.py`): `fg/bg/sky.webp` (màu), `masks.webp` (alpha tường + alpha người, lossless), `depth.png` (nghịch đảo độ sâu 16-bit, lưới 1/4 độ phân giải), `scene.js` (nội tham số camera gốc, dải độ sâu, điểm mắt 3D), `bundle.js` (base64 cho file://), bộ `_m` 1/2 cỡ cho điện thoại. Tổng ~0,8 MB.

### 5.3 Trình dựng (`js/hero.js`)

- Lưới đỉnh không cần vertex buffer: `gl_VertexID` → (i, j) → đọc độ sâu bằng `texelFetch` → giải chiếu về hệ camera gốc → chiếu qua camera ảo (ma trận `R^T`, tâm `C`, nội tham số chuẩn hoá). Ba lần vẽ: trời (mái vòm rộng hơn ảnh, mép kéo dài) → tường (alpha = không phải trời, ghi depth) → người (alpha nhân sẵn, không ghi depth).
- **Look-at:** keyframe chỉ cho vị trí camera và vị trí mong muốn của khuôn mặt trên khung; yaw/pitch giải bằng 2 vòng lặp Newton nhỏ. Màn hình dọc: giới hạn góc dọc 48°, mặt đưa về giữa, camera lùi thêm 6 cm.
- **Kiểm định độ phủ:** `?herodebug` + `LTV.heroDebug.sweep()` vẽ cả hành trình (kèm 4 góc parallax chuột và cảnh mở đầu) với vành lưới kéo dài: điểm ảnh nào lấy texture ngoài biên mà mép là tường/người sẽ tô hồng → báo % hụt. Đường camera hiện tại: 0 % ở điện thoại, < 0,4 % ở trường hợp xấu nhất trên desktop (góc trên-trái, chỉ khi chuột ở góc lúc cảnh mở đầu).
- Đo trên máy phát triển (Ryzen 5 7520U, iGPU): ~0,3 ms JS/khung, 53–60 fps trong Chrome headless.

### 5.4 Giới hạn và hướng nâng cấp

| Giới hạn | Vì sao | Nâng cấp |
|---|---|---|
| Camera chỉ dịch được vài cm quanh vị trí chụp | Một ảnh chỉ có thông tin của một góc nhìn; dịch xa hơn sẽ lộ phần bị che (sau gáy, dưới cằm). | Dựng thêm lớp "sau lưng người" bằng AI (inpaint theo góc), hoặc dùng mô hình sinh góc nhìn mới (Stable Virtual Camera, ViewCrafter — cần GPU CUDA). |
| Không có chuyển động của tóc/vải/mây thật | Ảnh tĩnh. | Đưa `bg/fg.webp` vào công cụ image-to-video (Kling/Runway/Veo) tạo clip 5 s "đứng thở", rồi thay texture người bằng video texture (WebGL cho phép `texImage2D` từ `<video>`). |
| Vùng vẽ mở rộng là ảnh AI đoán | LaMa vẽ tường/trời ở ngoài khung. | Chỉ lộ khi camera ở biên hành trình; thay bằng ảnh gốc rộng hơn nếu có. |

Bản 4 mượt nhưng góc máy chỉ dịch được vài cm quanh vị trí chụp — người dùng thấy "góc máy lia thấp quá" và muốn một cú máy toàn cảnh rõ ràng như mẫu Hunsy (SceneAI). Đó là lý do chuyển sang bản 5.

---

## 6. Phiên bản 5 (hiện tại): video AI tua theo cuộn

### 6.1 Ý tưởng
Mẫu Hunsy trên SceneAI là **video image-to-video** (camera vòng quanh chủ thể ~90°), không phải cảnh 3D. Với một clip AI, cú máy có thể đi bất kỳ đâu (từ toàn thân góc thấp lên cận mặt) mà môi trường vẫn nhất quán — vì cả clip là *một* cảnh do mô hình sinh ra liền mạch. Điều còn thiếu so với Ascend là "render lại mỗi khung": video chỉ có 240 khung rời. Bản 5 giải quyết bằng cách **coi chuỗi khung như một hàm liên tục theo thời gian**: hoà trộn tuyến tính giữa hai khung kề nhau theo phần lẻ của thời điểm, và điều khiển thời điểm đó bằng giảm chấn hai tầng đúng như Ascend.

Yêu cầu riêng của người dùng: video **không tự chạy** — chỉ chuyển động khi cuộn; không cuộn thì đứng hình. Vì vậy không có "idle life" (mây trôi, thở) như bản 4; chỉ còn parallax rất nhẹ theo chuột (do người dùng điều khiển).

### 6.2 Clip nguồn
`Man_modeling_fashion_in_video_20260915215142.mp4` do người dùng tạo: 1920×1080, 24 fps, 10 s = 240 khung, H.264, không cắt cảnh (đo hiệu khung liền kề: không có đỉnh bất thường). Camera: toàn thân góc thấp, người ở bên phải → tiến lên cận mặt, người dịch sang trái. Chuyển động không đều: chậm ở đầu/cuối (~0,5 px/khung), nhanh nhất ở khung 100–150 (~3,9 px/khung, p90 ≈ 10 px) — đo bằng optical flow Farneback ở 640×360 rồi quy về 1080p.

### 6.3 Dựng dữ liệu (`tools/hero-video/build_seq.py`, gọi qua `build-hero-video.ps1`)
1. **Tách khung** bằng ffmpeg sang PNG với `scale=in_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int` — clip AI không gắn thẻ màu, nếu để ffmpeg mặc định (BT.601) màu da/xanh trời lệch nhẹ; `full_chroma_int` tránh răng cưa ở mép màu.
2. **Bảng map cuộn → thời điểm**: cộng dồn độ dời trung vị giữa các khung, trộn 65 % "đều theo chuyển động" + 35 % "đều theo thời gian" rồi nghịch đảo thành 241 mẫu `map[p]`. Kết quả: cuộn đều thì hình chuyển động gần đều; đoạn đầu/cuối gần tĩnh của clip chiếm ít quãng cuộn hơn. (`--mix 0` = tuyến tính theo thời gian clip.)
3. **Đường focus** (tâm khuôn mặt) cho từng khung: mặt nạ người bằng rembg `birefnet-portrait` trên 21 khung mẫu (mỗi 12 khung + khung cuối) → tìm cổ = hàng đầu tiên hẹp lại < 74 % bề rộng đầu → trọng tâm vùng đầu → nội suy PCHIP ra 240 khung. Màn hình hẹp hơn 16:9 cắt khung quanh điểm này nên khuôn mặt luôn nằm trong hình (điện thoại dọc chỉ thấy ~26 % bề rộng khung gốc).
4. **Nén**: bộ `full` 240 khung 1920×1080 WebP q82 (51–77 KB/khung, 14,9 MB); bộ `tall` cho khung nhìn dọc (tỉ lệ < 0,85): 121 khung (mỗi 2 khung + khung cuối) cắt 960×1080 quanh focus, q80 (5,0 MB). Đã so 1:1 q82 với ảnh gốc ở vùng tóc/da và vải tối: không thấy khối nén. `poster.jpg` = khung đầu (134 KB) làm nền CSS cho tới khi canvas vẽ được.
5. `scene.js` (`window.HERO_SEQ`): kích thước, `fx/fy[240]`, `map[241]`, mỗi bộ: thư mục, danh sách khung, độ lệch cắt `x0` từng khung, dung lượng từng file (để tính % tải).

### 6.4 Trình phát (`js/hero.js`)
| Việc | Cách làm | Vì sao |
|---|---|---|
| Cuộn → thời điểm | `curP += (đích − curP)·(1 − e^(−4.5·dt))`, rồi `curT += (t(curP) − curT)·(1 − e^(−3.2·dt))` | Hai tầng lọc bậc nhất = vận tốc liên tục; lăn chuột theo nấc 100 px vẫn ra đường cong trơn (Ascend). |
| Giữa hai khung | vẽ khung A, rồi khung B với `globalAlpha = phần lẻ` | Kết quả = (1−w)·A + w·B, giống motion blur của video; khung liền kề chỉ lệch 0,5–4 px nên không thấy đúp. |
| Khi dừng | khi \|đích − curP\| < 0,002, đích của tầng 2 đổi thành **khung có thật gần nhất** trong bộ, giảm chấn 8/s | Không bao giờ "đậu" giữa hai khung → hình luôn sắc khi đứng yên; bộ `tall` chỉ có khung chẵn nên phải chọn theo bộ. |
| Vuốt mạnh | bước của `curT` bị chặn ở 120 khung/s (5× tốc độ clip) | Bộ giải mã theo kịp, hình vẫn liền mạch; sau khi vuốt, video "đuổi theo" thêm ~1 s thay vì nhảy cóc. |
| Bộ nhớ | chỉ giữ ImageBitmap của ~14 khung quanh vị trí (8 trước theo hướng cuộn, 4 sau), giải mã tối đa 6 khung cùng lúc bằng `createImageBitmap(blob)` (ngoài luồng chính), đóng khung ở xa | 240 khung 1080p giải mã hết = ~2 GB; cửa sổ trượt chỉ ~120 MB. |
| Tốc độ cao | bước giải mã = round(vận tốc/60): ở 120 khung/s chỉ giải mã mỗi khung thứ 2 phía trước | Mỗi tick màn hình chỉ hiện được một khung; giải mã đúng khung sẽ hiện, không phí công. |
| Tải | thứ tự thô → mịn (mỗi 8 khung, rồi 4, 2, 1), 8 file song song, ưu tiên khung gần vị trí đang xem; trang mở khi mức "mỗi 8 khung" (30 khung, ~1,8 MB) tải xong; khi hai khung gần nhất còn cách nhau > 2 thì không hoà trộn, lấy khung gần hơn | Mở trang nhanh, cuộn được ngay, độ mịn tăng dần. |
| Khung nhìn | `drawImage` với vùng cắt nguồn: tỉ lệ phủ kín canvas, tâm cắt = focus(t) (kẹp trong khung), thêm 2 % phóng để có biên cho parallax chuột; bộ `tall` có `x0` riêng từng khung nên hai khung hoà trộn được căn về cùng toạ độ gốc | Điện thoại dọc vẫn thấy mặt; không lộ mép trong suốt. |
| file:// | `fetch` bị chặn → tải bằng `<img>`, canvas vẫn vẽ được (không đọc lại điểm ảnh) | Mở trực tiếp `index.html` vẫn chạy. |

### 6.5 Kiểm định (Chrome headless, `?skip&herodebug`, kịch bản cuộn mô phỏng)
| Kịch bản | Tốc độ tối đa (khung/s) | Thiếu khung khi vẽ | Trọng số hoà trộn lúc dừng | Thời gian "đậu" sau khi ngừng cuộn |
|---|---|---|---|---|
| 40 nấc lăn chuột 100 px / 60 ms | 63 | 0 | 0 | 1,9 s |
| Vuốt ngược 13 × 300 px / 30 ms | 126 (chặn) | 0 | 0 | 2,4 s |
| Vuốt xuôi 20 × 250 px / 30 ms | 127 (chặn) | 0 | 0 | 2,6 s |
| Cuộn liên tục 120 × 35 px / 16 ms | 98 | 4 / 266 lần vẽ | 0 | 2,0 s |
| Một nấc 100 px | 7 | 0 | 0 | 1,4 s |

Điện thoại 390×844 (bộ `tall`): thiếu khung 0 ở mọi kịch bản. Vẽ ~0,1 ms/khung; giải mã 18–40 ms/khung (CPU, headless). Không có tick nào > 40 ms (không giật luồng chính). "Thời gian đậu" là đuôi của giảm chấn: sau khi ngừng cuộn, hình còn trôi chậm dần ~1,5–2,5 s rồi khoá vào đúng một khung — đây là cảm giác "trôi" cố ý như Ascend; muốn dừng nhanh hơn thì tăng `DAMP_P`/`DAMP_T`.

### 6.6 Giới hạn
- Nội dung là clip AI: người trong video là nhân vật do AI dựng từ ảnh tham chiếu; muốn đổi cú máy phải tạo clip mới (yêu cầu clip: 16:9, 1080p, 24–30 fps, 8–10 s, một cú máy liên tục, không cắt cảnh, không chữ/watermark).
- 14,9 MB cho máy tính là nặng hơn bản 4 (0,8 MB) — đổi lại là cú máy tự do. Có thể giảm bằng `-Q 78` (~12,5 MB) hoặc bỏ khung ở đoạn gần tĩnh.
- Không có motion blur thật khi tua nhanh; ở 120 khung/s hình đổi ~4–8 px mỗi tick, mắt thấy là chuyển động nhanh chứ không vỡ.
