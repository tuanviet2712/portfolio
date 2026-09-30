/* ==========================================================================
   GÓC KIẾN THỨC — cấu hình chung
   Dữ kiện về tác giả CHỈ lấy từ CV (assets/cv/CV-Le-Tuan-Viet.pdf, bản 09/2026).
   Không thêm số liệu mới ở đây nếu CV chưa có.
   Chuẩn SEO (tài liệu "Đào tạo về SEO và GEO"): title 50–60 ký tự, meta description 150–160 ký tự.
   ========================================================================== */
module.exports = {
  origin: 'https://letuanviet.com',
  siteName: 'Portfolio Lê Tuấn Việt',
  locale: 'vi_VN',
  lang: 'vi-VN',

  hub: {
    path: 'goc-kien-thuc',
    name: 'Góc kiến thức',
    title: 'Góc kiến thức Marketing cho doanh nghiệp SME | Lê Tuấn Việt',
    h1Html: 'Góc chia sẻ <span class="grad">kiến thức</span>',
    description: 'Góc kiến thức Marketing của Lê Tuấn Việt: chiến lược, kế hoạch, ứng dụng AI, quản trị Marketing và bài học từ dự án thực tế cho doanh nghiệp SME tại Việt Nam.',
    lead: 'Kiến thức Marketing, cách ứng dụng AI và bài học từ các dự án tôi đã triển khai cho doanh nghiệp SME',
    en: {
      name: 'Knowledge Hub',
      lead: 'Practical marketing knowledge, applied AI and lessons that turn strategy into a growth system.'
    }
  },

  author: {
    slug: 'le-tuan-viet',                       // không có trang tác giả riêng: mọi liên kết tác giả trỏ về trang chủ portfolio (url)
    name: 'Lê Tuấn Việt',
    alternateName: 'Le Tuan Viet',
    jobTitle: 'Marketing Leader',
    slogan: 'Biến chiến lược thành hệ thống. Biến hệ thống thành tăng trưởng.',
    role: 'Marketing Leader tại TAKI Group',
    url: 'https://letuanviet.com/',
    image: 'assets/img/portrait.jpg',            // cùng ảnh với schema Person ở trang chủ (nhất quán thực thể)
    photo: 'assets/kb/le-tuan-viet-photo.webp',  // ảnh chân dung hiển thị trên Góc kiến thức (portfolio dùng ảnh riêng)
    avatar: 'assets/kb/le-tuan-viet',            // .webp 320×320 (tools/kb/render-assets.cjs)
    email: 'tuanviet.2712@gmail.com',
    phone: '0935 702 321',
    phoneRaw: '0935702321',
    zalo: 'https://zalo.me/0935702321',
    cv: 'assets/cv/CV-Le-Tuan-Viet.pdf',
    locality: 'Hà Đông',
    region: 'Hà Nội',
    worksFor: { name: 'TAKI Group', alternateName: 'TAKI', url: 'https://taki.vn' },
    alumniOf: { name: 'Đại học Công Thương TP.HCM', alternateName: 'HUIT' },
    description: 'Marketing Leader với hơn 4 năm kinh nghiệm tư vấn chiến lược và triển khai Marketing cho doanh nghiệp SME.',
    knowsAbout: ['Marketing Strategy', 'Marketing Planning', 'Kế hoạch Marketing', 'AI Marketing', 'Quản trị Marketing', 'Growth Marketing', 'Performance Marketing', 'Digital Marketing', 'SEO', 'Content Marketing', 'Marketing Team Leadership'],
    sameAs: ['https://zalo.me/0935702321', 'https://github.com/tuanviet2712'],

    // Hộp tác giả cuối bài (ngôi thứ ba để máy tìm kiếm nhận diện thực thể rõ hơn)
    bio: 'Lê Tuấn Việt có hơn 4 năm kinh nghiệm trong Marketing, từng tư vấn chiến lược cho hơn 200 doanh nghiệp SME. Anh bắt đầu từ bài toán kinh doanh, chuyển mục tiêu thành kế hoạch, quy trình triển khai và hệ thống KPI rõ ràng. Từ đó, các hoạt động Marketing được phối hợp, đo lường và tối ưu để tạo ra tăng trưởng bền vững.',
    credentials: ['Hơn 4 năm kinh nghiệm', '200+ doanh nghiệp SME', '20+ chương trình đào tạo', 'Tốt nghiệp loại Giỏi HUIT'],
    short: ['Hơn 4 năm làm Marketing', 'Cố vấn cho 200+ doanh nghiệp SME'],

    // Hồ sơ tác giả (mọi dòng đều có trong CV). intro, experience, awards, education, page: dữ liệu của trang tác giả cũ, hiện không dùng
    intro: 'Tôi có hơn bốn năm kinh nghiệm Marketing, gồm hai năm trực tiếp triển khai các hoạt động Marketing và hai năm cố vấn chiến lược Marketing tổng thể cho hơn 200 doanh nghiệp SME tại TAKI Group. Thế mạnh của tôi là nghiên cứu thị trường, hoạch định chiến lược và truyền thông đa kênh, từ xây dựng thương hiệu đến Performance Marketing.',
    stats: [
      ['4+', 'năm kinh nghiệm Marketing'],
      ['200+', 'doanh nghiệp SME được cố vấn'],
      ['70%', 'khách hàng đạt mục tiêu theo từng giai đoạn'],
      ['20+', 'chương trình đào tạo Marketing']
    ],
    experience: [
      {
        org: 'TAKI Group', place: 'Hà Nội', time: '08/2024 đến nay',
        roles: ['Marketing Consulting Team Leader, 02/2026 đến nay', 'Marketing Planner, 09/2024 đến 02/2026'],
        points: [
          'Tư vấn và đồng hành cùng hơn 200 khách hàng doanh nghiệp: nghiên cứu mô hình kinh doanh, phân tích thị trường và xác định điểm nghẽn trong hệ thống Marketing.',
          'Xây dựng và tư vấn triển khai kế hoạch Master Plan, IMC, Digital, Content và SEO; góp phần giúp 70% khách hàng đạt mục tiêu theo từng giai đoạn.',
          'Quản lý 5 nhân sự, triển khai cho trung bình 30 khách hàng doanh nghiệp mỗi tháng với tỷ lệ hoàn thành đúng hạn 95%.',
          'Xây dựng và trực tiếp triển khai hơn 20 chương trình đào tạo về Content Marketing, Performance Ads, SEO, E-commerce, Branding và ứng dụng AI.'
        ]
      },
      {
        org: 'PITO', place: 'TP. Hồ Chí Minh', time: '11/2022 đến 08/2024',
        roles: ['Growth Marketing Executive', 'Kiêm nhiệm Trưởng nhóm Partner Support, dự án PITO Xpress'],
        points: [
          'Triển khai chiến lược Marketing B2B, tiếp cận hơn 300 đối tác tiềm năng và ký kết 36 đối tác trong một tháng.',
          'Lập kế hoạch và triển khai trung bình 60 bài viết chuẩn SEO mỗi tháng theo hệ thống Content Pillar và Topic Cluster, đạt trung bình 7.200 lượt truy cập tự nhiên mỗi tháng.',
          'Chuyển đổi hơn 113 đối tác sang sản phẩm PITO Xpress trong một tháng, tương đương 42% tổng số đối tác mục tiêu.'
        ]
      }
    ],
    results: [
      ['TOMEC', 'Hệ thống Y đa khoa', 'Tăng 40% khách hàng tiềm năng, giảm 54% CPL từ 1,2 triệu xuống 550.000 đồng và ghi nhận hơn 3,2 tỷ đồng doanh thu từ quảng cáo trong tháng 4.'],
      ['Uyên Uyên Mart', 'Chuỗi siêu thị gia dụng', 'Doanh thu toàn hệ thống tăng từ 3 lên 6 tỷ đồng mỗi tháng, lượt khách đến cửa hàng tăng 45%, tỷ lệ thất thoát giảm từ 7% xuống 1,3%.'],
      ['FungHa Dimsum', 'Chuỗi nhà hàng', 'Hoàn thiện hệ sinh thái Marketing đa kênh gồm Website và Zalo, tạo nền tảng phát triển chuỗi từ 5 lên 7 chi nhánh.']
    ],
    awards: [
      ['Nhân viên xuất sắc nhất năm 2025', 'Do Ban lãnh đạo TAKI Group bình chọn', 'assets/img/partners/taki.png'],
      ['Nhân viên xuất sắc nhất năm 2024', 'Do hơn 400 đối tác của PITO bình chọn', 'assets/img/partners/pito.png'],
      ['Giải Khuyến khích cuộc thi Đổi mới sáng tạo khởi nghiệp cấp khoa năm 2022', 'Đại học Công Thương TP.HCM', 'assets/img/partners/huit.png']
    ],
    education: { school: 'Đại học Công Thương TP.HCM', major: 'Quản trị Nhà hàng và Dịch vụ Ăn uống', time: '10/2020 đến 03/2024', note: 'GPA 3.26/4.0, tốt nghiệp loại Giỏi' },
    page: {
      title: 'Lê Tuấn Việt, Marketing Leader | Tác giả Góc kiến thức',
      description: 'Lê Tuấn Việt là Marketing Leader tại TAKI Group, hơn 4 năm kinh nghiệm, cố vấn chiến lược Marketing cho hơn 200 doanh nghiệp SME. Xem hồ sơ và bài viết.'
    }
  },

  /* 4 chủ đề lớn (pillar). Thứ tự = thứ tự trên menu. */
  pillars: [
    {
      slug: 'marketing',
      name: 'Marketing',
      icon: 'i-target',
      short: 'Chiến lược, kế hoạch và triển khai đa kênh',
      h1Html: 'Kiến thức <span class="grad">Marketing</span>',
      title: 'Kiến thức Marketing cho doanh nghiệp SME | Lê Tuấn Việt',
      description: 'Kiến thức Marketing thực tế cho doanh nghiệp SME: chiến lược, kế hoạch, thương hiệu, nội dung và quảng cáo, được chia sẻ bởi Marketing Leader Lê Tuấn Việt.',
      intro: 'Chiến lược, kế hoạch và cách triển khai Marketing đa kênh để doanh nghiệp SME biến mục tiêu kinh doanh thành kết quả đo được',
      topics: [
        ['Chiến lược Marketing', 'Nghiên cứu thị trường, khách hàng mục tiêu và định vị phù hợp với nguồn lực doanh nghiệp.'],
        ['Kế hoạch Marketing', 'Chuyển mục tiêu kinh doanh thành kế hoạch kênh, ngân sách, KPI và lộ trình triển khai.'],
        ['Thương hiệu và truyền thông', 'Thông điệp, câu chuyện thương hiệu và kế hoạch truyền thông tích hợp.'],
        ['Content, SEO và quảng cáo', 'Nội dung, tìm kiếm tự nhiên và quảng cáo hiệu suất trên các nền tảng phổ biến.']
      ],
      en: { name: 'Marketing', short: 'Strategy, planning and multichannel marketing for SMEs' }
    },
    {
      slug: 'ai-marketing',
      name: 'AI Marketing',
      icon: 'i-spark',
      short: 'AI cho nghiên cứu, nội dung và tối ưu hiệu suất',
      h1Html: 'Kiến thức <span class="grad">AI Marketing</span>',
      title: 'AI Marketing: ứng dụng AI vào Marketing | Lê Tuấn Việt',
      description: 'Cách ứng dụng AI vào nghiên cứu thị trường, sáng tạo nội dung, tự động hóa quy trình và tối ưu hiệu suất Marketing cho doanh nghiệp SME, bởi Lê Tuấn Việt.',
      intro: 'Cách đưa AI vào nghiên cứu, sáng tạo nội dung, tự động hóa quy trình và phân tích dữ liệu trong công việc Marketing hằng ngày',
      topics: [
        ['Công cụ AI cho Marketing', 'Chọn và kết hợp công cụ AI phù hợp cho nghiên cứu, nội dung và báo cáo.'],
        ['Viết prompt hiệu quả', 'Cách giao việc cho AI để nhận kết quả sát yêu cầu và ít phải sửa.'],
        ['Sản xuất nội dung bằng AI', 'Quy trình làm hình ảnh, video và bài viết có sự hỗ trợ của AI.'],
        ['Tự động hóa quy trình', 'Chuẩn hóa và tự động hóa các đầu việc lặp lại trong bộ phận Marketing.']
      ],
      en: { name: 'AI Marketing', short: 'Using AI for research, content and campaign performance' }
    },
    {
      slug: 'quan-tri-marketing',
      name: 'Quản trị Marketing',
      icon: 'i-kanban',
      short: 'Đội ngũ, ngân sách, KPI và vận hành Marketing',
      h1Html: 'Kiến thức <span class="grad">Quản trị Marketing</span>',
      title: 'Quản trị Marketing: đội ngũ, KPI, ngân sách | Lê Tuấn Việt',
      description: 'Kiến thức quản trị Marketing cho doanh nghiệp SME: xây dựng đội ngũ, thiết lập KPI, quản lý ngân sách và vận hành bộ phận Marketing, chia sẻ bởi Lê Tuấn Việt.',
      intro: 'Thiết lập KPI, phân bổ ngân sách, xây dựng quy trình và dẫn dắt đội ngũ để bộ phận Marketing chạy đúng tiến độ, đúng chất lượng',
      topics: [
        ['KPI và OKR', 'Thiết lập chỉ số và mục tiêu cho bộ phận Marketing gắn với doanh thu.'],
        ['Ngân sách Marketing', 'Lập, phân bổ và kiểm soát ngân sách theo kênh và giai đoạn.'],
        ['Quản lý đội ngũ', 'Phân công, đào tạo và theo dõi hiệu suất của đội ngũ Marketing.'],
        ['Quy trình và SOP', 'Chuẩn hóa quy trình để giảm sai sót và tiết kiệm nguồn lực.']
      ],
      en: { name: 'Marketing Management', short: 'Managing teams, budgets, KPIs and marketing operations' }
    },
    {
      slug: 'du-an-va-bai-hoc',
      name: 'Case Marketing',
      icon: 'i-flag',
      short: 'Phân tích case, triển khai, đo lường và bài học ứng dụng',
      h1Html: 'Case <span class="grad">Marketing</span>',
      title: 'Case Marketing: phân tích, triển khai và bài học | Lê Tuấn Việt',
      description: 'Case Marketing cho doanh nghiệp SME: phân tích bối cảnh, thực tiễn triển khai, đo lường và tối ưu, cùng những bài học có thể ứng dụng từ dự án thực tế.',
      intro: 'Phân tích Case Marketing từ bối cảnh và thực tiễn triển khai đến đo lường, tối ưu và bài học có thể ứng dụng cho doanh nghiệp SME',
      topics: [
        ['Phân tích Case Marketing', 'Bối cảnh, mục tiêu và cách tiếp cận của từng case.'],
        ['Thực tiễn triển khai', 'Quy trình, lựa chọn và vấn đề phát sinh khi thực hiện.'],
        ['Đo lường và tối ưu', 'Chỉ số, kết quả và cách điều chỉnh sau triển khai.'],
        ['Bài học và ứng dụng', 'Kinh nghiệm rút ra và cách áp dụng vào tình huống tương tự.']
      ],
      en: { name: 'Case Marketing', short: 'Marketing case analysis, execution, measurement and lessons' }
    }
  ]
};
