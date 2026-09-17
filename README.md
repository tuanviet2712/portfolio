# Portfolio — Lê Tuấn Việt

Website portfolio 1 trang, hero là **video AI tua theo cuộn**: một cú máy 10 giây (toàn thân góc thấp → cận mặt) được tách thành 240 khung, người xem cuộn tới đâu camera chạy tới đó, không cuộn thì đứng hình. Cuộn được làm mượt bằng giảm chấn hai tầng (học từ getlayers.ai), giữa hai khung có hoà trộn nên không nhìn thấy "bậc" khung hình. Viết bằng HTML/CSS/JS thuần, không cần cài đặt hay build.

## 1. Mở website

- **Nhanh nhất:** nháy đúp `index.html` để mở bằng Chrome, Edge, Firefox hoặc Safari.
- **Như khi đã đưa lên mạng** (khuyên dùng khi kiểm tra): mở PowerShell trong thư mục này rồi chạy một trong hai lệnh:
  ```powershell
  python -m http.server 8080        # nếu có Python
  npx serve .                       # nếu có Node.js
  ```
  Sau đó vào `http://localhost:8080`.

## 2. Cấu trúc thư mục

```
Portfolio/
├── index.html              Trang chính (11 section)
├── css/style.css           Toàn bộ giao diện (Be Vietnam Pro + bảng màu luxury)
├── css/showcase.css        Section "Dự án đã triển khai": bức tường dự án + thẻ mô phỏng
├── js/
│   ├── data.js             ★ DỮ LIỆU: dự án, đối tác, feedback, liên hệ
│   ├── core.js             Preloader "xin chào", nav, con trỏ, hiệu ứng chung
│   ├── hero.js             Hero: video tua theo cuộn (240 khung WebP, giảm chấn 2 tầng, hoà trộn giữa 2 khung)
│   ├── hero-3d.js          Bản hero cũ (WebGL "ảnh 3D" từ một ảnh gốc) — chỉ chạy khi mở ?hero=3d
│   ├── sections.js         Timeline, quy trình, đối tác, feedback, quả cầu công cụ
│   └── showcase.js         Dự án đã triển khai: bức tường nghiêng 3D, hàng trượt ngang theo cuộn, bấm ô mở Google Drive
├── assets/
│   ├── hero/seq/           ★ Khung hình hero: full/ (240 khung 1920×1080, 14,9 MB) · tall/ (121 khung cắt dọc cho điện thoại, 5 MB) · poster.jpg · scene.js
│   ├── hero/a08/           Dữ liệu hero 3D cũ (~0,8 MB) cho ?hero=3d (a07/ = bản dùng ảnh gốc 7)
│   ├── frames/             8 khung gốc JPEG (dự phòng + ảnh chia sẻ mạng xã hội)
│   ├── img/                logo.svg (logo LTV), icon, ảnh chân dung cho Giới thiệu / Liên hệ
│   ├── video/              portrait.mp4 — video chạy liên tục trong ô chân dung (Giới thiệu) + ảnh poster
│   └── cv/                 CV-Le-Tuan-Viet.pdf (nút "Tải CV")
├── tools/                  (không cần đưa lên host)
│   ├── hero3d/                 ★ Tách lớp 3D từ ảnh gốc + xuất dữ liệu hero (build-hero3d.ps1 → export_web.py)
│   ├── build-sequence.ps1      Quy trình cũ (nội suy AI RIFE giữa 8 ảnh gốc) — chỉ để tham khảo
│   ├── interpolate_frames.py   Quy trình cũ hơn (optical flow trong Blender) — chỉ để tham khảo
│   ├── rife/                   AI nội suy khung hình rife-ncnn-vulkan (chỉ dùng cho quy trình chuỗi ảnh cũ, -Sequence)
│   ├── serve.ps1               Máy chủ localhost có live reload (chỉ theo dõi html/css/js ở gốc, css/, js/)
│   └── source-frames/          8 ảnh PNG gốc
├── NGHIEN-CUU-KY-THUAT.md  Báo cáo nghiên cứu kỹ thuật
└── README.md
```

## 3. Cập nhật nội dung

### Nguồn nội dung
Toàn bộ nội dung lấy **duy nhất** từ `CV_Marketing Leader_Lê Tuấn Việt.pdf` (TAKI Group, PITO, các dự án TOMEC · FungHa Dimsum · Uyên Uyên Mart). Nút "Tải CV" cũng tải đúng file CV này. Không dùng số liệu từ các CV cũ. Khi bổ sung số liệu mới, nên giữ nguyên tắc này.

### Việc cần làm
1. **LinkedIn**: dán link thật vào `linkedin: ''` trong `js/data.js`. Khi còn trống, nút sẽ mở trang tìm kiếm LinkedIn.
2. **Dự án đã triển khai** (section 7) — khối `showcase` trong `js/data.js`:
   - 4 hạng mục, mỗi hạng mục là một "bức tường" chạy theo cuộn giống section "Dự án thành công" của ledinhtuan.com (mới vào thì nghiêng 3D và mờ, cuộn tới thì dựng thẳng, hàng chẵn trượt phải, hàng lẻ trượt trái): **01 Plan & Campaign** 3 hàng · **02 Website & CRM** 2 hàng · **03 Kênh & Content** 2 hàng (trên: *Thương hiệu cá nhân*, dưới: *Thương hiệu doanh nghiệp*) · **04 Hạng mục khác** 2 hàng.
   - **Mỗi hàng 4 ô, mỗi ô là một đối tác khác nhau.** Máy tính thấy rõ 3 ô, ô thứ 4 ló ở mép và trượt vào khi cuộn (tablet 2 ô, điện thoại 1 ô). Việc xếp đối tác vào ô hiện chỉ là tạm — sửa trong `rows`. Plan & Campaign có 12 ô nhưng mới có 10 đối tác nên 2 ô cuối là `''` (ô trống "Đối tác mới").
   - **Bấm ô mở link Google Drive** của ô đó ở tab mới (không có trang chi tiết). Dán link vào `link: ''` của từng ô, ví dụ `{ partner: 'tomec', link: 'https://drive.google.com/drive/folders/…' }`. Trên Drive nhớ chia sẻ **"Bất kỳ ai có đường liên kết"**, nếu không người xem sẽ bị hỏi quyền truy cập. Ô chưa có link thì không bấm được.
   - Ảnh bìa cho ô (không bắt buộc): thêm `shot: 'assets/projects/plan-tomec.jpg'` — ảnh ngang 16:9, khoảng 1280×720 px, WebP/JPG. Chưa có ảnh thì hiện **thẻ mô phỏng** vẽ bằng CSS theo từng hạng mục. Lĩnh vực (`field`) của 7 đối tác mới đang để trống — điền trong `partners`.
3. **Feedback**: 3 thẻ đầu là danh hiệu có trong CV. Thẻ cuối là **mẫu**: thay bằng nhận xét thật rồi đặt `draft: false`, hoặc xoá khối đó đi.
4. **Đối tác**: 2 hàng logo trắng chạy ngược chiều (kiểu ledinhtuan.com). Logo là PNG trắng nền trong suốt, đã cắt sát viền, đặt trong `assets/img/partners/white/` rồi khai báo `logo: 'assets/img/partners/white/ten.png'` trong `partners`. Logo trông to/nhỏ hơn các logo khác thì chỉnh `scale` (vd. `scale: 1.1` to thêm 10%). Thư mục `tiles/` (bản màu trên thẻ trắng) hiện không dùng.

### Quy tắc chữ (giữ khi sửa nội dung)
- **Tiêu đề luôn 1 dòng**: phần tử có thuộc tính `data-fit` sẽ tự co cỡ chữ cho vừa 1 dòng trên mọi màn hình. Tiêu đề mới cũng nên thêm `data-fit`. Nếu chữ quá dài, cỡ chữ sẽ nhỏ đi — nên viết tiêu đề ngắn.
- **Mô tả**: dùng class `desc` — chữ nhỏ, căn đều 2 bên, tối đa 4 dòng (phần dư bị ẩn). Nên giữ mỗi mô tả dưới ~170 ký tự. Thêm `data-more` để hiện nút "Xem thêm" khi dài.
- **Chữ trồi lên theo từ**: thêm `data-split` vào tiêu đề section.

### Tính năng động có sẵn
Chữ tiêu đề trồi lên theo từng từ · nhãn section "giải mã" chữ · ánh sáng theo chuột trên thẻ (class `spot`) · gợn sóng khi bấm nút · danh sách Giá trị mở/đóng · Quy trình dạng sân khấu theo cuộn (bấm từng mốc để nhảy tới) · feedback tự chạy 6 giây (dừng khi rê chuột, hỗ trợ phím ← →) · ảnh lộ dần + parallax · nút về đầu trang có vòng tiến trình · chuyển trang có màn trượt · đồng hồ Hà Nội trực tiếp · menu thu gọn khi cuộn · lần vào lại trong cùng phiên bỏ qua màn "xin chào".

## 4. Tham số hỗ trợ kiểm tra
| URL | Tác dụng |
|---|---|
| `index.html?skip` | Bỏ qua màn chào "xin chào" |
| `index.html?skip&p=0.5` | Nhảy tới 50% chuyển động hero |
| `index.html?skip&y=8000` | Cuộn tới vị trí 8000px |
| `index.html?skip&nofx` | Tắt các hiệu ứng động (dùng khi so sánh hiệu năng) |
| `index.html?skip&nofloat` | Hero: tắt parallax theo chuột (chụp ảnh so sánh) |
| `index.html?skip&src=seq2` | Hero: dùng bộ khung khác trong `assets/hero/` (thư mục do `build-hero-video.ps1 -Out` tạo) |
| `index.html?skip&herodebug` | Hero: bật `LTV.heroDebug` trong Console — `state()` (khung đã tải/giải mã, số lần thiếu khung), `whenLoaded()`, `drawAt(120.5)` (soi hoà trộn giữa 2 khung), `trace` |
| `index.html?skip&hero=3d` | Hero bản cũ (WebGL "ảnh 3D" từ một ảnh gốc, `js/hero-3d.js`) — để so sánh; thêm `&nogl` xem bản dự phòng ảnh tĩnh |

## 5. Hero — video tua theo cuộn: cách hoạt động và cách thay clip

### Cách hoạt động
1. **Nguồn là một clip AI** (`tools/hero-video/source.mp4`: 10 s, 24 fps, 1920×1080, một cú máy liên tục từ toàn thân góc thấp lên cận mặt). Clip được tách thành 240 khung WebP trong `assets/hero/seq/full/`; điện thoại dọc dùng bộ `tall/` (121 khung cắt 960×1080 quanh khuôn mặt).
2. **Không tự phát.** Vị trí cuộn quyết định thời điểm trong clip: cuộn tới đâu camera chạy tới đó, dừng cuộn là đứng hình. Hero cao 820vh (~7 màn hình) cho 240 khung.
3. **Cuộn chỉ là đích** (nguyên lý getlayers.ai/ascend): tiến trình cuộn được giảm chấn 4,5/s, rồi thời điểm hiển thị lại giảm chấn 3,2/s → lăn chuột theo nấc vẫn ra chuyển động trơn. Giữa hai khung liền nhau có **hoà trộn** theo phần lẻ nên không thấy "bậc" khung hình; khi dừng hẳn thì **khoá vào đúng một khung** nên hình luôn sắc. Vuốt mạnh cũng không tua quá 120 khung/s (5× tốc độ clip) để hình liền mạch.
4. **Cuộn đều = hình chuyển động đều:** lúc dựng, script đo chuyển động thật giữa các khung (optical flow) và tạo bảng map cuộn → thời điểm, nên đoạn camera chậm ở đầu/cuối clip chiếm ít quãng cuộn hơn.
5. **Nhẹ bộ nhớ, mở trang nhanh:** chỉ giải mã ~14 khung quanh vị trí đang xem (ImageBitmap, ngoài luồng chính); tải theo thứ tự thô → mịn (mỗi 8 khung trước, rồi 4, 2, 1) và ưu tiên khung gần vị trí đang xem; trang mở khi 30 khung đầu (~1,8 MB) sẵn sàng, phần còn lại (tổng 14,9 MB máy tính / 5 MB điện thoại) tải ngầm. Mở trực tiếp `index.html` (file://) vẫn chạy.
6. **Khuôn mặt luôn trong hình:** mỗi khung có toạ độ khuôn mặt (`fx/fy` trong `scene.js`, ước lượng bằng AI tách người lúc dựng); màn hình hẹp hơn 16:9 cắt khung quanh điểm đó.

### Chỉnh cảm giác cuộn (đầu `js/hero.js`)
- `DAMP_P`, `DAMP_T`: giảm chấn hai tầng — tăng để dừng nhanh hơn, giảm để "trôi" hơn. `DAMP_REST`/`REST_EPS`: tốc độ và ngưỡng khoá vào đúng một khung khi dừng.
- `VMAX`: tốc độ tua tối đa (khung/s). `MOUSE`: parallax theo chuột (tắt bằng `?nofloat`). `TALL_ASPECT`: tỉ lệ khung nhìn chuyển sang bộ khung dọc.
- Chương nội dung (khối chữ, **không hộp nền**): chữ trắng đặt thẳng lên video, độ tương phản do **tấm phủ tối chuyển sắc** `.hero__scrim` lo — chỉ đậm ở phía đang có chữ (trái/phải trên máy tính, dưới trên điện thoại) và tan hết trước khi tới khuôn mặt; độ đậm `--sl/--sr/--sb` do `js/hero.js` đặt theo tiến trình của chương nên không có chữ thì video sạch hoàn toàn. Tiêu đề và số liệu hiện lần lượt từng ký tự, mô tả và mốc thời gian từng từ theo tiến trình cuộn (`splitUnits` trong `js/hero.js`, lớp `.u--c/.u--w`). Gradient tiêu đề chạy ngang cả dòng: `js/hero.js` tô **màu riêng cho từng ký tự** (`paintTitleGradient`) — trắng ở đầu, ngả cyan từ khoảng giữa rồi đậm dần về cuối. Không dùng `background-clip: text` cho tiêu đề hero vì mỗi ký tự có transform/blur riêng, và cũng không gắn gradient cho riêng một chữ (chữ đó sẽ trông như miếng dán, còn `filter` của nó bị `.hn { overflow: hidden }` cắt thành ô chữ nhật). Mốc vào/ra vẫn là `data-in`/`data-out` trên các `.ch` trong `index.html`.

### Thay clip (dựng lại dữ liệu)
1. Tạo clip mới bằng công cụ image-to-video (Kling, Runway, Veo, Hailuo…): **16:9, 1080p, 24–30 fps, 8–10 giây, MỘT cú máy liên tục, không cắt cảnh, không chữ/watermark**, chuyển động trải đều suốt clip. Nên xuất một lần 10 s thay vì nối hai đoạn 5 s.
2. Chạy (PowerShell, trong thư mục Portfolio; cần ffmpeg + ffprobe, Python 3.10+):
   ```powershell
   .\tools\hero-video\build-hero-video.ps1 -Src "C:\duong-dan\clip.mp4" -Ffmpeg "C:\ffmpeg\bin\ffmpeg.exe"
   ```
   Lần đầu tự tạo môi trường Python (dùng chung `tools\hero3d\.venv`, tải model tách người ~1 GB); mỗi lần dựng ~3–5 phút trên CPU. Kết quả ghi vào `assets/hero/seq/` (đổi bằng `-Out`, chọn bộ khác trên trang bằng `?src=`). Tuỳ chọn: `-Q 82`/`-QTall 80` (chất lượng WebP), `-Mix 0.65` (0 = cuộn đều theo thời gian clip, 1 = đều hoàn toàn theo chuyển động), `-Clean` (đo lại chuyển động + khuôn mặt).
3. Kiểm tra: mở `index.html?skip&herodebug`, cuộn thử, gõ `LTV.heroDebug.state()` trong Console — `misses` (số lần vẽ thiếu khung) nên ≈ 0, `failed` = 0.

### Bản hero cũ (WebGL "ảnh 3D")
Vẫn xem được bằng `index.html?hero=3d` (`js/hero-3d.js`, dữ liệu `assets/hero/a08/`, dựng lại bằng `tools\hero3d\build-hero3d.ps1 -Anchor 8 -EyeX 538 -EyeY 364`). Cách làm và giới hạn của bản này được ghi trong `NGHIEN-CUU-KY-THUAT.md` §5.

## 6. Đưa website lên mạng (miễn phí)
- **Netlify Drop**: kéo cả thư mục `Portfolio` (có thể bỏ `tools/`) vào https://app.netlify.com/drop.
- **GitHub Pages** hoặc **Vercel**: đẩy thư mục lên một repository rồi bật Pages hoặc Import vào Vercel.
- Sau khi có tên miền, sửa `og:image` trong `index.html` thành đường dẫn tuyệt đối (`https://…/assets/frames/frame-08.jpg`) để ảnh hiện đúng khi chia sẻ link.

## 7. Logo, font & màu
- **Logo:** `assets/img/logo.svg` (chữ LTV, gradient cyan → xanh hoàng gia → navy). Dùng ở thanh menu, footer, màn chào, màn chuyển trang và biểu tượng tab (favicon). `assets/img/apple-touch-icon.png` là biểu tượng khi lưu ra màn hình iPhone. Có file logo gốc (SVG/PNG) thì thay đè `logo.svg`, giữ nguyên tên.
- **Font:** Be Vietnam Pro, dùng cho toàn bộ trang. Riêng chữ "xin chào" trên màn chào dùng Playwrite VN (chữ viết tay) để giống ledinhtuan.com.
- **Màu (Sky Luxury):** navy sâu `#0A0D1C` → navy `#233A69` → xanh trời `#A2C4FE`, điểm nhấn xanh logo `#1B5CF2` và cyan `#14D8E6`; khớp với bầu trời trong hero. Nền sáng `#F5F8FF`, chữ navy `#0C1633`, section tối dùng gradient navy. Toàn bộ biến màu nằm ở đầu `css/style.css` (`:root`); các độ trong suốt dùng bộ ba RGB (`--ink-rgb`, `--blue-rgb`…), đổi 1 chỗ là cả trang đổi theo.
