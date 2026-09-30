/* ========================================================================== 
   VI / EN — content-only internationalisation
   The Vietnamese HTML remains the source of truth. English is applied before
   the existing effects initialise, so layout, animation and component logic
   remain unchanged. The base URL is always Vietnamese; ?lang=en is English.
   ========================================================================== */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'en' ? 'en' : 'vi';

  function setEnglishGreeting() {
    const greeting = document.querySelector('#preloader .hello');
    if (greeting && window.LTV_HELLO_EN) greeting.outerHTML = window.LTV_HELLO_EN;
  }

  const EN = {
    /* Navigation and shared controls */
    'Bỏ qua phần mở đầu': 'Skip to main content',
    'Lê Tuấn Việt — về đầu trang': 'Lê Tuấn Việt, back to top',
    'Điều hướng chính': 'Main navigation',
    'Trang chủ': 'Home',
    'Giới thiệu': 'About',
    'Năng lực': 'Expertise',
    'Dự án': 'Projects',
    'Đối tác': 'Partners',
    'Liên hệ': 'Contact',
    'Tải CV': 'Download CV',
    'Tải CV (PDF)': 'Download CV (PDF)',
    'Mở menu': 'Open menu',
    'Đóng menu': 'Close menu',
    'Menu di động': 'Mobile menu',
    'Chọn ngôn ngữ': 'Language selection',
    'Chuyển sang tiếng Việt': 'Switch to Vietnamese',
    'Chuyển sang tiếng Anh': 'Switch to English',
    'Về đầu trang': 'Back to top',
    'Menu nhanh': 'Quick links',
    'Đã sao chép email': 'Email copied',
    'Đã sao chép': 'Copied',
    'Sao chép': 'Copy',
    'Gọi': 'Call',
    'Mở': 'Open',
    'Xem': 'View',
    'Kéo': 'Drag',
    'Xem thêm': 'Read more',
    'Thu gọn': 'Show less',

    /* Hero */
    'xin chào': 'hello',
    'Giới thiệu mở đầu': 'Introduction',
    'Hơn 4 năm kinh nghiệm': 'More than 4 years of experience',
    'Tôi bắt đầu mỗi dự án từ bài toán kinh doanh, sau đó xây dựng chiến lược, lựa chọn kênh và trực tiếp triển khai. Mục tiêu của tôi là tạo ra những hoạt động Marketing có định hướng rõ ràng và mang lại kết quả đo lường được.': 'Every project starts with the business problem. From there, I build the strategy, choose the right channels and lead the execution myself. My goal is marketing with a clear direction and results that can be measured.',
    'Xem dự án': 'View projects',
    'Đồng hành cùng': 'Partnered with',
    '200+ SME': '200+ SMEs',
    'Tại TAKI Group, tôi trực tiếp tư vấn chiến lược Marketing tổng thể, từ nghiên cứu mô hình kinh doanh, xây dựng kế hoạch đến phát triển hệ thống đa kênh; góp phần giúp 70% khách hàng đạt mục tiêu trong từng giai đoạn.': 'At TAKI Group, I consult clients directly on their overall marketing strategy, from studying the business model and building plans to developing a multichannel system, helping 70% of clients reach their goals at each stage.',
    'Kết quả': 'Results',
    'nổi bật': 'to date',
    'dự án hoàn thành đúng hạn, với đội ngũ 5 nhân sự hỗ trợ trung bình 30 khách hàng B2B mỗi tháng': 'of projects completed on time, with a team of five supporting an average of 30 B2B clients a month',
    'chương trình đào tạo Marketing cho nội bộ và đối tác doanh nghiệp': 'marketing training sessions for our own team and partner businesses',
    'Tỷ lệ hoàn thành KPI của phòng tăng từ 60% lên 80% sau đào tạo.': 'The department’s KPI completion rate rose from 60% to 80% after training.',
    'Chặng đường': 'My journey',
    'Xin chào, tôi là': 'Hello, I’m',
    'Tôi mong muốn đồng hành cùng doanh nghiệp xây dựng hệ thống Marketing bài bản, hiệu quả và hướng đến tăng trưởng bền vững.': 'I want to work alongside businesses to build a structured, effective marketing system aimed at sustainable growth.',
    'Cuộn xuống để xem tiếp': 'Scroll to explore',

    /* About and experience */
    'Đôi nét': 'A little',
    'về tôi': 'about me',
    'Vai trò, định hướng, thế mạnh và những cột mốc chính trong hơn 4 năm làm Marketing của tôi.': 'My roles, direction, strengths and key milestones from more than 4 years in marketing.',
    'Lê Tuấn Việt ngồi làm việc với laptop bên cửa sổ hướng biển': 'Lê Tuấn Việt working on a laptop by a window overlooking the sea',
    'Tốt nghiệp loại Giỏi': 'Graduated with Distinction',
    'Marketing Leader với 4 năm kinh nghiệm': 'Marketing Leader, 4 years’ experience',
    'Tôi từng trực tiếp triển khai Growth Marketing tại PITO và có hai năm tư vấn chiến lược cho hơn 200 doanh nghiệp SME tại TAKI Group.': 'I led growth marketing directly at PITO and have spent two years advising more than 200 SMEs on strategy at TAKI Group.',
    'Định hướng': 'Professional focus',
    'Xây dựng Marketing gắn với mục tiêu kinh doanh': 'Marketing guided by business goals',
    'Tôi ưu tiên chiến lược rõ ràng, khả năng triển khai thực tế và hiệu quả có thể đo lường.': 'I prioritise strategic clarity, practical execution and measurable impact.',
    'Vai trò đã đảm nhận': 'Roles held',
    'Thế mạnh': 'Core strengths',
    'Nghiên cứu & hoạch định': 'Research and planning',
    'Nghiên cứu thị trường và xây dựng kế hoạch Marketing theo mục tiêu kinh doanh.': 'Research the market and build marketing plans that serve business goals.',
    'Triển khai đa kênh': 'Across every channel',
    'Hoạch định và điều phối Content, Digital, SEO, Booking, OOH...': 'Planning and managing content, digital, SEO, booking and OOH.',
    'Dẫn dắt & đào tạo': 'Leadership & training',
    'Quản lý đội ngũ 5 nhân sự và trực tiếp triển khai hơn 20 chương trình đào tạo.': 'Managing a team of five and delivering more than 20 training programmes.',
    'Các mốc kinh nghiệm': 'Career milestones',
    'Phát triển đối tác B2B và SEO; chuyển đổi 113 đối tác, đạt 7.200 lượt truy cập tự nhiên mỗi tháng trên Google.': 'Built B2B partnerships and SEO, winning 113 partners and reaching 7,200 organic Google visits a month.',
    'Tư vấn chiến lược Marketing tổng thể và kế hoạch triển khai đa kênh cho doanh nghiệp SME.': 'Advised SMEs on overall marketing strategy and practical plans for coordinated delivery across channels.',
    'Điều phối 5 nhân sự, phụ trách trung bình 30 khách hàng doanh nghiệp mỗi tháng và duy trì 95% công việc đúng hạn.': 'Coordinated a team of 5, managed an average of 30 business clients each month and kept 95% of all work on schedule.',
    '2–3 năm tới': 'In 2 to 3 years',
    'Mục tiêu nghề nghiệp': 'Career goal',
    'Hướng đến quản trị toàn diện chiến lược, ngân sách, đội ngũ và hiệu suất Marketing.': 'Aiming to take full ownership of marketing strategy, budget, team and results.',

    /* Value proposition */
    'Giá trị': 'The value',
    'tôi mang lại': 'I bring',
    '5 giá trị tôi có thể đóng góp cho doanh nghiệp, đi cùng những kết quả thực tế trong quá trình triển khai.': 'Five ways I add value to a business, each backed by experience and measurable results from real projects.',
    'Chiến lược và thị trường': 'Strategy and market insight',
    'Tư duy chiến lược & nghiên cứu thị trường': 'Strategic thinking & market research',
    'Phân tích mô hình kinh doanh, thị trường và khách hàng để tìm đúng điểm nghẽn rồi mới đề xuất giải pháp.': 'I analyse the business model, market and customers to find the real bottleneck before proposing a solution.',
    'Trực tiếp tư vấn chiến lược cho hơn 200 doanh nghiệp SME tại TAKI Group.': 'Provided direct strategy advice to more than 200 SMEs at TAKI Group.',
    'Hoạch định Marketing': 'Marketing planning',
    'Hoạch định & quản trị Marketing tổng thể': 'Marketing planning & management',
    'Chuyển mục tiêu kinh doanh thành kế hoạch rõ ràng về kênh, ngân sách, KPI và lộ trình triển khai.': 'I turn business goals into a clear plan covering channels, budgets, KPIs and the roadmap for delivery.',
    'Phụ trách chiến lược đa kênh cho TOMEC, FungHa Dimsum và Uyên Uyên Mart.': 'Led omnichannel strategy for TOMEC, FungHa Dimsum and Uyên Uyên Mart.',
    'Tăng trưởng theo dữ liệu': 'Growth through data',
    'Tăng trưởng dựa trên dữ liệu': 'Growth through data',
    'Theo sát dữ liệu để điều chỉnh ngân sách, nội dung và kênh, giúp Marketing bám sát mục tiêu doanh thu.': 'I follow the data closely to adjust budget, content and channels, keeping marketing on track for revenue goals.',
    'TOMEC: tăng 40% khách hàng tiềm năng, giảm 54% CPL và ghi nhận hơn 3,2 tỷ đồng doanh thu từ quảng cáo.': 'TOMEC: grew leads by 40%, cut CPL by 54% and recorded more than VND 3.2 billion in revenue from ads.',
    'Dẫn dắt đội ngũ': 'Team leadership',
    'Xây dựng & dẫn dắt đội ngũ': 'Building & leading teams',
    'Thiết lập KPI, phân công và đào tạo đội ngũ để công việc triển khai đúng tiến độ, đúng chất lượng.': 'I set KPIs, assign work and train the team to deliver every task on schedule and to a high standard.',
    'Quản lý 5 nhân sự, duy trì 95% công việc đúng hạn và nâng tỷ lệ hoàn thành KPI từ 60% lên 80%.': 'Led five staff, kept 95% of work on time and raised the team’s KPI completion rate from 60% to 80%.',
    'Vận hành và công nghệ': 'Operations and technology',
    'Chuẩn hóa vận hành & ứng dụng công nghệ': 'Better operations & technology',
    'Chuẩn hóa quy trình và ứng dụng AI để giảm sai sót, rút ngắn thời gian và tiết kiệm nguồn lực.': 'I standardise processes and use AI to cut errors, shorten turnaround and make better use of resources.',
    'Tham gia chuẩn hóa SOP cho hơn 50 doanh nghiệp, góp phần giảm 60% sai sót và triển khai 5 website, hệ thống quản trị.': 'Helped set SOPs for over 50 businesses, cut errors by 60% and built five websites and management systems.',

    /* Expertise */
    'Năng lực chuyên môn': 'Professional expertise',
    'chuyên môn': 'overview',
    'Bảy năng lực tôi vận dụng trong công việc: hoạch định chiến lược, triển khai đa kênh, tối ưu hiệu suất, quản lý dự án và đội ngũ.': 'My core skills span strategy, channel management, performance optimisation, project delivery and team leadership.',
    '01 · Trọng tâm': '01 · Core',
    'Chiến lược Marketing': 'Marketing strategy',
    'Nghiên cứu thị trường, xác định khách hàng mục tiêu và hoạch định chiến lược Marketing phù hợp với mục tiêu kinh doanh, nguồn lực và từng giai đoạn phát triển của doanh nghiệp.': 'I research the market, define the target customers and plan a marketing strategy that fits the business goals, resources and stage of growth.',
    'Thị trường & insight': 'Market & consumer insight',
    'Ngân sách & KPI': 'Budget & KPIs',
    'Thương hiệu & truyền thông': 'Brand & communications',
    'Định vị thương hiệu': 'Brand positioning',
    'Thông điệp & Brand Voice': 'Messaging & brand voice',
    'Kế hoạch truyền thông IMC': 'IMC planning',
    'Nội dung & tìm kiếm': 'Content & search',
    'Copywriting đa kênh': 'Omnichannel copywriting',
    'Quảng cáo hiệu suất': 'Performance advertising',
    'Media Plan & ngân sách': 'Media plan & budget',
    'Thiết lập chiến dịch Ads': 'Campaign setup',
    'Website, UX & chuyển đổi': 'Website, UX & conversion',
    'Sitemap & cấu trúc web': 'Sitemap & site architecture',
    'UX/UI & nội dung website': 'UX/UI & website content',
    'Tăng trưởng & đối tác': 'Growth & partnerships',
    'Quản lý đội ngũ & dự án': 'Team & Projects',
    'Lập kế hoạch & nguồn lực': 'Planning & resourcing',
    'Quản trị tiến độ dự án': 'Project delivery management',
    'KPI & hiệu suất đội ngũ': 'Team KPIs & performance',
    'Phối hợp & Đào tạo': 'Teamwork & training',
    'Công cụ, dữ liệu & AI': 'Tools, data & AI',
    'Kết hợp các nền tảng phân tích, quản trị kênh và công cụ AI để hỗ trợ nghiên cứu, triển khai, đo lường, tối ưu và mở rộng hệ thống Marketing.': 'I combine analytics, channel management and AI tools to support the research, rollout, tracking, tuning and growth of the marketing system.',
    'Công cụ: Kalodata, Semrush, Meta Business Suite, Meta Ads Manager, TikTok Business Center, TikTok Ads Manager, TikTok Seller Center, Shopee Seller Center, ChatGPT, Codex, Claude Code, NotebookLM, Google Flow, AutoVis, HeyGen, MiniMax, ElevenLabs, Excel, Word, PowerPoint, Google Workspace': 'Tools: Kalodata, Semrush, Meta Business Suite, Meta Ads Manager, TikTok Business Center, TikTok Ads Manager, TikTok Seller Center, Shopee Seller Center, ChatGPT, Codex, Claude Code, NotebookLM, Google Flow, AutoVis, HeyGen, MiniMax, ElevenLabs, Excel, Word, PowerPoint, Google Workspace',

    /* Process */
    'Quy trình': 'How I',
    'triển khai': 'work',
    'Các bước quy trình': 'Process steps',
    'Hiện trạng': 'Discovery',
    'Mục tiêu': 'Objectives',
    'Chiến lược': 'Strategy',
    'Chiến thuật': 'Tactics',
    'Hành động': 'Execution',
    'Kiểm soát': 'Optimisation',
    'Phân tích hiện trạng': 'Assess the current landscape',
    'Đánh giá mô hình kinh doanh, thị trường, khách hàng, đối thủ và hoạt động Marketing hiện tại để xác định điểm nghẽn, cơ hội cùng vấn đề cần ưu tiên.': 'Assess the business model, market, customers, competitors and current marketing activity to find bottlenecks, opportunities and what to prioritise.',
    'Đầu ra: Bức tranh hiện trạng & vấn đề trọng tâm': 'Output: Current position & key priorities',
    'Xác lập mục tiêu': 'Define the objectives',
    'Chuyển mục tiêu kinh doanh thành mục tiêu Marketing theo nguyên tắc SMART, đồng thời xác lập KPI để định hướng triển khai và đánh giá kết quả.': 'Translate business goals into SMART marketing objectives and define the KPIs needed to guide implementation and evaluate results at every stage.',
    'Đầu ra: Mục tiêu SMART & hệ thống KPI': 'Output: SMART objectives & KPI framework',
    'Xây dựng chiến lược': 'Shape the strategy',
    'Xác định phân khúc, khách hàng mục tiêu, định vị và hướng tiếp cận tổng thể để tập trung nguồn lực vào những ưu tiên có tác động lớn.': 'Define the segments, target customers, positioning and overall approach so resources go to the priorities with the biggest impact.',
    'Đầu ra: Định hướng chiến lược Marketing': 'Output: Strategic marketing direction',
    'Lựa chọn chiến thuật': 'Select the tactics',
    'Cụ thể hóa chiến lược thành kế hoạch theo từng kênh, bao gồm nội dung, quảng cáo, SEO, website, PR/KOL và các điểm chạm phù hợp.': 'Break the strategy down into a plan for each channel, including content, advertising, SEO, website, PR/KOL and the right touchpoints.',
    'Đầu ra: Kế hoạch kênh & hoạt động': 'Output: Channel & activity plan',
    'Tổ chức triển khai': 'Organise execution',
    'Cụ thể hóa kế hoạch thành từng đầu việc, xác định nhân sự, ngân sách, tiến độ và cơ chế phối hợp để triển khai đồng bộ, đúng hạn.': 'Break the plan into tasks and set the people, budget, timeline and way of working together so delivery is aligned and on time.',
    'Đầu ra: Kế hoạch hành động & phân công': 'Output: Action plan & ownership',
    'Đo lường và tối ưu': 'Measure and optimise',
    'Thiết lập KPI và nhịp báo cáo để theo dõi hiệu suất, phát hiện điểm nghẽn và điều chỉnh hoạt động dựa trên dữ liệu thực tế.': 'Set KPIs and a reporting rhythm to track performance, spot bottlenecks and adjust activities based on real data.',
    'Đầu ra: báo cáo và phương án tối ưu': 'Output: Reports & improvement plan',

    /* Projects, partners, recognition and contact */
    'Dự án đã triển khai': 'Selected projects',
    'đã triển khai': 'in action',
    'Các dự án được sắp xếp theo bốn nhóm: Plan & Campaign, Website & CRM, Kênh & Content và Dự án khác': 'Projects are grouped into four areas: Plan & Campaign, Website & CRM, Channels & Content and Other Work',
    'Hạng mục dự án': 'Project categories',
    'Doanh nghiệp': 'Brands',
    'đã đồng hành': 'I’ve worked with',
    'Những doanh nghiệp tôi đã đồng hành trong quá trình xây dựng chiến lược và triển khai Marketing.': 'Businesses I have supported in shaping strategy and bringing marketing plans to life.',
    'Bạn muốn hợp tác?': 'Interested in working together?',
    'Liên hệ với tôi': 'Reach out to me',
    'Nhận xét trước': 'Previous testimonial',
    'Nhận xét tiếp theo': 'Next testimonial',
    'Thành tựu': 'Awards',
    '& Ghi nhận': '& Feedback',
    'Các danh hiệu tôi đã nhận được và nhận xét từ những khách hàng từng hợp tác.': 'The awards I have received and the feedback from the clients I have worked with.',
    'Ghi nhận chính thức': 'Official recognition',
    'Khách hàng nhận xét': 'Client testimonial',
    'Cấp trên nhận xét': 'Manager testimonial',
    'Kết nối': 'Let’s',
    'với tôi': 'connect',
    'Tôi sẵn sàng trao đổi về các vị trí công việc, dự án Marketing và cơ hội hợp tác phù hợp. Hãy kết nối hoặc gửi lời nhắn để chúng ta có thể bắt đầu cuộc trao đổi': 'I am open to talking about suitable roles, marketing projects and ways to work together. Connect with me or send a message so we can start the conversation',
    'Nhắn Zalo': 'Message on Zalo',
    'Lê Tuấn Việt nhìn thẳng vào ống kính': 'Portrait of Lê Tuấn Việt looking at the camera',
    'Hà Đông, Hà Nội': 'Ha Dong, Hanoi',
    'Hà Nội ·': 'Hanoi ·',
    'Tôi tin rằng Marketing hiệu quả không dừng ở một ý tưởng hay, mà nằm ở khả năng biến chiến lược thành kết quả thực tế.': 'I believe effective marketing is not defined by a good idea alone, but by the ability to turn strategy into tangible results.',

    /* Showcase data */
    'Kế hoạch Marketing tổng thể và các chiến dịch truyền thông tôi đã xây dựng.': 'Overall marketing plans and communication campaigns I have built.',
    'Thương hiệu cá nhân': 'Personal brand',
    'Bác sĩ Dung': 'Dr. Dung',
    'Bác sĩ Trí': 'Dr. Trí',
    'Plan xây hệ thống kênh AI': 'AI Channel Ecosystem Plan',
    'Website thương hiệu, Zalo Mini App và hệ thống CRM đã triển khai cho từng doanh nghiệp.': 'Brand websites, Zalo Mini Apps and CRM systems delivered for individual businesses.',
    'Hệ thống CRM': 'CRM system',
    'Kênh & Content': 'Channels & Content',
    'Những dự án xây dựng kênh tiêu biểu tôi đã trực tiếp tham gia, từ định hướng nội dung và hình ảnh đến triển khai, vận hành và tối ưu hiệu quả.': 'Selected channel projects I took part in directly, from content and visual direction to execution, daily running and optimisation.',
    'Thương hiệu doanh nghiệp': 'Corporate brand',
    'Hạng mục khác': 'Other Work',
    'Tài liệu đào tạo đội ngũ, bộ chỉ số KPI, báo cáo định kỳ, bộ quy chuẩn logo và các bài viết, kịch bản mẫu tôi đã xây dựng.': 'Team training materials, KPI sets, periodic reports, logo standards, and the sample articles and scripts I have created.',
    'Tài liệu đào tạo SEO': 'SEO Training Materials',
    'Tài liệu đào tạo Content': 'Content Training Materials',
    'Tài liệu đào tạo Vibe Coding': 'Vibe Coding Training Materials',
    'Báo cáo Booking': 'Media Booking Report',
    'Báo cáo chỉ số Marketing': 'Marketing Performance Report',
    'Bộ chỉ số KPI Phòng Marketing': 'Marketing Department KPI Framework',
    'Bài viết + Kịch bản mẫu': 'Sample Articles & Scripts',
    'Đang cập nhật': 'Coming soon',
    'Liên kết': 'Link',
    'Ảnh chụp': 'Preview',
    'Xem ảnh dự án': 'View project image',
    'Đóng': 'Close',
    'Ảnh trước': 'Previous image',
    'Ảnh sau': 'Next image',
    'Mở tài liệu': 'Open document',

    /* Partner sectors */
    'Cố vấn doanh nghiệp': 'Business consulting',
    'E-commerce F&B': 'Online food retail',
    'Y đa khoa': 'Multidisciplinary healthcare',
    'Chuỗi nhà hàng': 'Restaurant chain',
    'Siêu thị gia dụng': 'Homeware retail',
    'Dược phẩm': 'Pharmaceuticals',
    'Phân bón nhập khẩu': 'Imported fertilisers',
    'Balo, túi xách': 'Backpacks & bags',
    'Phụ kiện tủ bếp, tủ áo': 'Kitchen & wardrobe fittings',
    'Chuỗi cà phê': 'Coffee chain',
    'Chăm sóc răng miệng': 'Oral care',
    'Sản phẩm tẩy rửa sinh học': 'Natural cleaning products',
    'Mẹ và bé': 'Mother & baby',
    'Sức khoẻ, thực phẩm': 'Health & food',
    'Trà, cà phê': 'Tea & coffee',
    'Nối mi': 'Eyelash extensions',
    'Cà phê': 'Coffee',
    'Cửa nhựa composite': 'Composite doors',
    'Chăm sóc sức khoẻ sinh sản': 'Reproductive healthcare',
    'Phong thuỷ': 'Feng shui',

    /* Awards and testimonials */
    'Danh hiệu năm 2025': '2025 distinction',
    'Danh hiệu năm 2024': '2024 distinction',
    'Giải thưởng năm 2022': '2022 award',
    'Được Ban lãnh đạo TAKI Group đánh giá là Nhân viên xuất sắc nhất năm 2025.': 'Named Outstanding Employee of the Year 2025 by the leadership of TAKI Group.',
    'Được hơn 400 đối tác của PITO đánh giá là Nhân viên xuất sắc nhất năm 2024.': 'Named Outstanding Employee of the Year 2024 by more than 400 of PITO’s partners.',
    'Giải Khuyến khích cuộc thi Đổi mới sáng tạo khởi nghiệp cấp khoa năm 2022.': 'Encouragement Prize in the 2022 Innovation and Startup Contest at faculty level.',
    'ĐH Công Thương TP.HCM': 'Ho Chi Minh City University of Industry and Trade',
    'Việt giúp Uyên Uyên Mart định hướng rõ cách xây dựng cả kênh doanh nghiệp và kênh cá nhân. Phần cơ chế, chính sách và KPI cũng được Việt xây dựng khá sát thực tế, giúp đội ngũ dễ hiểu và áp dụng.': 'Việt helped Uyên Uyên Mart see clearly how to build both the company channel and personal channels. The policies, incentives and KPIs he set up were realistic, which made them easy for the team to understand and use.',
    'Việt trực tiếp đào tạo và theo sát đội Marketing của Dotaka trong quá trình triển khai. Lượng tiếp cận fanpage đã tăng từ khoảng 3 triệu lên 8,3 triệu mỗi tháng; quan trọng hơn là đội ngũ đã biết cách tự làm và tối ưu.': 'Việt trained Dotaka’s marketing team himself and followed us closely during the rollout. Our fanpage reach grew from about 3 million to 8.3 million a month. More importantly, our team now knows how to run and improve it alone.',
    'Việt hỗ trợ Gerari từ đào tạo nhân sự, xây dựng cơ chế chính sách đến định hướng các kênh Marketing. Cách làm rõ ràng, sát thực tế và luôn hướng tới việc giúp đội ngũ có thể tự vận hành.': 'Việt helped Gerari train staff, develop policies and plan our marketing channels. His approach was clear and practical, with a real focus on helping the team work independently.',
    'Việt giúp CoolCoffee nhìn lại toàn bộ hoạt động Marketing, kết nối các kênh về chung một hướng và xác định rõ những chỉ số cần theo dõi. Nhờ vậy, đội ngũ biết phần nào hiệu quả và phần nào cần điều chỉnh.': 'Việt reviewed our marketing as a whole, brought the channels into a shared direction and helped us identify the metrics worth tracking. We can now see what is working, what is not and where our efforts need to improve.',
    'Điều tôi ấn tượng nhất ở Việt là sự nhiệt tình và trách nhiệm. Khi có vấn đề cần xử lý, Việt luôn phản hồi nhanh, theo sát đến cùng và hỗ trợ đội ngũ bằng thái độ rất chân thành.': 'What impressed me most in Việt is his energy and sense of duty. When an issue needs solving, he always responds fast, sees it through to the end and supports the team with genuine care.',
    'Việt đồng hành cùng FungHa từ kế hoạch Marketing tổng thể đến website và Zalo Mini App. Việt nắm khá nhanh bài toán kinh doanh, tư vấn thực tế và theo sát để từng hạng mục thực sự được triển khai.': 'Việt worked with FungHa from the overall marketing plan to the website and Zalo Mini App. He grasped our business quickly, gave practical advice and stayed close until each item was put into action.',
    'Việt giúp chúng tôi thay đổi cách nhìn về số liệu: không báo cáo cho đủ mà phải dùng dữ liệu để biết cần tối ưu ở đâu. Quy trình booking cũng được sắp xếp rõ ràng hơn, từ lựa chọn đối tác đến đánh giá hiệu quả.': 'Việt changed how we see our numbers: we no longer report just to fill a template; we use data to find where to improve. He also made our booking process much clearer, from choosing partners to measuring results.',
    'Việt giúp chúng tôi hệ thống lại hoạt động trên Google, từ lựa chọn từ khóa, theo dõi dữ liệu đến tối ưu các điểm khách hàng tìm kiếm. Cách hướng dẫn dễ hiểu, đi thẳng vào vấn đề nên đội ngũ có thể áp dụng ngay.': 'Việt helped us organise our work on Google, from keyword selection and tracking data to improving every point where customers find us. His guidance was easy to follow and direct, so our team could apply it right away.',
    'Việt luôn đặt Marketing trong mối liên hệ với mục tiêu kinh doanh. Bạn giúp Pozza Tea xây dựng hướng triển khai tổng thể, tối ưu các chỉ số và điều chỉnh hoạt động Marketing phù hợp với chiến lược phát triển nhượng quyền.': 'Việt always connects marketing work to business goals. He helped Pozza Tea build an overall plan, improve the key measures we tracked and adjust our marketing activity to support the brand’s franchise growth strategy.',
    'Việt giúp Mid Pharma nhìn lại Marketing như một hệ thống hoàn chỉnh, từ khách hàng, thông điệp đến kênh triển khai và chỉ số theo dõi. Các phương án đều rõ ràng, có thứ tự ưu tiên và phù hợp với nguồn lực thực tế.': 'Việt helped Mid Pharma look at marketing as a complete system, from customers and messages to channels and the metrics we track. Each option he proposed was clear, set in order of priority and suited to our real resources.',
    'Việt hỗ trợ chúng tôi sắp xếp lại hoạt động thương mại điện tử, từ nội dung gian hàng, chương trình bán hàng đến cách theo dõi hiệu quả. Các góp ý đều cụ thể, thực tế và đội ngũ có thể áp dụng ngay.': 'Việt helped us restructure our online store, from store content and sales campaigns to the way we track results. His advice was specific and practical, so our team could apply it right away.',
    'Việt giúp Esfy Lashies làm rõ định hướng thương hiệu, đồng thời chuẩn hóa hệ thống báo cáo và quy trình vận hành Marketing. Nhờ vậy, đội ngũ phối hợp rõ ràng hơn và người quản lý cũng dễ theo dõi công việc.': 'Việt helped Esfy Lashies sharpen our brand direction and bring order to our reporting system and marketing workflow. As a result, the team works together more clearly and managers can follow the work more easily.',
    'Việt là người nhiệt tình, trách nhiệm và không ngại việc khó. Trong vai trò trợ lý, Việt luôn chủ động theo sát học viên, tiếp nhận góp ý nghiêm túc và cố gắng xử lý công việc đến cùng.': 'Việt is enthusiastic, dependable and not afraid of difficult work. As an assistant, he always kept close track of students, took feedback seriously and worked hard to see each task through.',
    'Trong thời gian trực tiếp quản lý Việt, tôi đánh giá bạn có nền tảng chuyên môn Marketing khá toàn diện, từ lập kế hoạch, xây dựng kênh đến tối ưu hiệu quả. Việt học nhanh, chịu khó đào sâu vấn đề và tiến bộ rõ qua từng giai đoạn.': 'While managing Việt directly, I saw a fairly complete marketing skill set, from planning and building channels to optimising results. He learns quickly, is willing to dig deep into problems and improved clearly at every stage.',
    'Trong quá trình trực tiếp quản lý, tôi ghi nhận ở Việt sự trách nhiệm, chủ động và tinh thần hỗ trợ đội ngũ. Việt có chuyên môn tốt, tiếp thu phản hồi nhanh và luôn cố gắng hoàn thành công việc đến cùng.': 'As his direct manager, I saw Việt’s sense of responsibility, initiative and readiness to support the team. He is highly skilled, takes feedback on board quickly and always strives to finish the job completely.',
    'Chị Cẩm Uyên': 'Ms. Cẩm Uyên',
    'Anh Đỗ Vũ Tập': 'Mr. Đỗ Vũ Tập',
    'Chị Phương Vương': 'Ms. Phương Vương',
    'Chị Phạm Thị Tư': 'Ms. Phạm Thị Tư',
    'Chị Minh Nguyễn': 'Ms. Minh Nguyễn',
    'Anh Quốc Trung': 'Mr. Quốc Trung',
    'Chị Đan Thanh': 'Ms. Đan Thanh',
    'Chị Thanh Hương': 'Ms. Thanh Hương',
    'Chị Hoàng Hiền': 'Ms. Hoàng Hiền',
    'Chị Nguyễn Thị Nụ': 'Ms. Nguyễn Thị Nụ',
    'Chị Lê Hạ': 'Ms. Lê Hạ',
    'Chị Phương Khánh': 'Ms. Phương Khánh',
    'Thầy Nguyễn Tất Kiểm': 'Mr. Nguyễn Tất Kiểm',
    'Anh Nguyễn Tuấn Linh': 'Mr. Nguyễn Tuấn Linh',
    'Chị Lê Thị Ngân': 'Ms. Lê Thị Ngân',

    /* Metadata / structured data */
    'Portfolio Lê Tuấn Việt': 'Lê Tuấn Việt Portfolio',
    'Portfolio cá nhân của Lê Tuấn Việt, Marketing Leader tại Hà Nội.': 'The personal portfolio of Lê Tuấn Việt, a Marketing Leader based in Hanoi.',
    'Portfolio Lê Tuấn Việt — Marketing Leader': 'Lê Tuấn Việt Portfolio: Marketing Leader',
    'Portfolio của Lê Tuấn Việt, Marketing Leader tại Hà Nội với hơn 4 năm kinh nghiệm và hơn 200 doanh nghiệp SME đã được tư vấn.': 'The portfolio of Lê Tuấn Việt, a Marketing Leader in Hanoi with over four years of experience advising more than 200 SMEs.',
    'Marketing Leader với hơn 4 năm kinh nghiệm tư vấn chiến lược và triển khai Marketing cho doanh nghiệp SME.': 'Marketing Leader with more than four years of experience advising SMEs on strategy and marketing execution.',
    'Công ty tư vấn và cố vấn doanh nghiệp tại Việt Nam': 'A business consulting and advisory firm in Vietnam',
    'Đại học Công Thương TP.HCM': 'Ho Chi Minh City University of Industry and Trade',
    'Video chân dung Lê Tuấn Việt, Marketing Leader tại Hà Nội, tư vấn chiến lược và triển khai Marketing cho hơn 200 doanh nghiệp SME.': 'A portrait video of Lê Tuấn Việt, a Marketing Leader in Hanoi who has advised more than 200 SMEs.'
  };

  const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'data-short', 'data-cursor-label'];
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

  function preserveWhitespace(source, translated) {
    const lead = source.match(/^\s*/)[0];
    const tail = source.match(/\s*$/)[0];
    return lead + translated + tail;
  }

  function translate(value) {
    if (typeof value !== 'string' || !value) return value;
    const clean = value.trim();
    if (!clean) return value;
    let translated = EN[clean];

    if (!translated && clean.startsWith('“') && clean.endsWith('”')) {
      const quote = EN[clean.slice(1, -1)];
      if (quote) translated = '“' + quote + '”';
    }
    if (!translated && clean.startsWith('Đã sao chép: ')) translated = 'Copied: ' + clean.slice(13);
    if (!translated && clean.startsWith('Xem ảnh lớn: ')) translated = 'View larger image: ' + clean.slice(13);
    if (!translated && /^Mở .+ \(tab mới\)$/.test(clean)) translated = clean.replace(/^Mở /, 'Open ').replace(' (tab mới)', ' (new tab)');
    if (!translated && /: mở .+ \(tab mới\)$/.test(clean)) translated = clean.replace(': mở ', ': open ').replace(' (tab mới)', ' (new tab)');

    return translated ? preserveWhitespace(value, translated) : value;
  }

  function deepTranslate(value) {
    if (typeof value === 'string') return translate(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = deepTranslate(value[i]);
      return value;
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(key => { value[key] = deepTranslate(value[key]); });
    }
    return value;
  }

  function translateElement(el) {
    if (!el || el.nodeType !== 1 || skip.has(el.tagName)) return;
    ATTRS.forEach(attr => {
      if (!el.hasAttribute(attr)) return;
      const before = el.getAttribute(attr);
      const after = translate(before);
      if (after !== before) el.setAttribute(attr, after);
    });
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      const parent = root.parentElement;
      if (!parent || skip.has(parent.tagName)) return;
      const after = translate(root.nodeValue);
      if (after !== root.nodeValue) root.nodeValue = after;
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (skip.has(root.tagName)) return;
      translateElement(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 1) translateElement(node);
      else if (!node.parentElement || !skip.has(node.parentElement.tagName)) {
        const after = translate(node.nodeValue);
        if (after !== node.nodeValue) node.nodeValue = after;
      }
    }
  }

  function setMeta(selector, content) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  }

  function translateMetadata() {
    document.title = 'Lê Tuấn Việt | Marketing Leader Portfolio';
    setMeta('meta[name="description"]', 'Lê Tuấn Việt is a Marketing Leader at TAKI Group in Hanoi, with more than four years of experience advising over 200 SMEs on strategy and marketing execution.');
    setMeta('meta[name="keywords"]', 'Lê Tuấn Việt, TAKI Group, Marketing Leader, Portfolio, Marketing Consulting, Marketing Strategy, SME Marketing, Hanoi');
    setMeta('meta[property="og:description"]', 'Explore the experience, capabilities and marketing projects delivered by Lê Tuấn Việt, Marketing Leader at TAKI Group, for SME clients.');
    setMeta('meta[property="og:locale"]', 'en_US');
    setMeta('meta[name="twitter:description"]', 'Explore the experience, capabilities and marketing projects delivered by Lê Tuấn Việt, Marketing Leader at TAKI Group, for SME clients.');
  }

  function translateStructuredData() {
    const el = document.querySelector('script[type="application/ld+json"]');
    if (!el) return;
    try {
      const data = JSON.parse(el.textContent);
      deepTranslate(data);
      const setLanguage = value => {
        if (Array.isArray(value)) return value.forEach(setLanguage);
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach(key => {
          if (key === 'inLanguage') value[key] = 'en-US';
          else setLanguage(value[key]);
        });
      };
      setLanguage(data);
      el.textContent = JSON.stringify(data, null, 2);
    } catch (_) { /* Leave valid source markup intact if parsing ever fails. */ }
  }

  function languageUrl(next) {
    const url = new URL(location.href);
    if (next === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    return url.pathname + url.search + url.hash;
  }

  function bindSwitcher() {
    document.querySelectorAll('[data-lang]').forEach(link => {
      const code = link.dataset.lang;
      link.href = languageUrl(code);
      const active = code === lang;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  document.documentElement.lang = lang === 'en' ? 'en' : 'vi';
  document.documentElement.dataset.lang = lang;

  if (lang === 'en') {
    setEnglishGreeting();
    deepTranslate(window.SITE_DATA || {});
    translateTree(document.documentElement);
    translateMetadata();
    translateStructuredData();

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'characterData') translateTree(record.target);
        else if (record.type === 'attributes') translateElement(record.target);
        else record.addedNodes.forEach(translateTree);
      });
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  bindSwitcher();
  window.LTV_I18N = { lang, t: lang === 'en' ? translate : value => value };
})();
