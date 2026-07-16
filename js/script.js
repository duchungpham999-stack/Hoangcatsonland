/**
 * 1. HÀM NẠP LAYOUT DÙNG CHUNG (HEADER/FOOTER)
 */
const pageLanguageMap = {
    "index.html": "index-en.html",
    "pages/about/Gioi_thieu.html": "pages/about/about-en.html",
    "pages/sectors/Linh-vuc-hoat-dong.html": "pages/sectors/field-of-activities-en.html",
    "pages/sectors/real-estate/Bat-dong-san.html": "pages/sectors/real-estate/real-estate.html",
    "pages/sectors/industrial-infrastructure/Ha-tang-cong-nghiep.html": "pages/sectors/industrial-infrastructure/Industrial-structures.html",
    "pages/sectors/technical-transport-infrastructure/HTKY-GT.html": "pages/sectors/technical-transport-infrastructure/Technical-Structures-Transportation.html",
    "pages/sectors/import-export/Thuong-mai-XNK.html": "pages/sectors/import-export/Trade-Imports-Exports.html",
    "pages/careers/Tuyen_dung.html": "pages/careers/Tuyen_dung_en.html",
    "pages/news/Tin_tuc.html": "pages/news/News.html",
    "pages/contact/Lien_he.html": "pages/contact/Contacts.html"
};

function getSiteRootUrl() {
    const script = document.currentScript || Array.from(document.scripts).find(item => item.src.includes('/js/script.js'));
    if (!script) return new URL('./', window.location.href);
    return new URL('../', script.src);
}

const siteRootUrl = getSiteRootUrl();

function rootUrl(path) {
    return new URL(path, siteRootUrl).href;
}

function getCurrentPagePath() {
    const currentUrl = new URL(window.location.href);
    const rootPath = siteRootUrl.pathname;
    let pagePath = currentUrl.pathname;

    if (pagePath.startsWith(rootPath)) {
        pagePath = pagePath.slice(rootPath.length);
    } else {
        pagePath = pagePath.split('/').pop();
    }

    return pagePath || "index.html";
}

function getCurrentPageName() {
    return window.location.pathname.split("/").pop() || "index.html";
}

function isEnglishPage(pageName = getCurrentPagePath()) {
    const fileName = pageName.split("/").pop();
    return fileName.includes("-en.html") || Object.values(pageLanguageMap).includes(pageName);
}

function getSitePath(value) {
    try {
        const url = new URL(value, siteRootUrl);
        if (url.origin !== window.location.origin) return value;

        let sitePath = url.pathname;
        if (sitePath.startsWith(siteRootUrl.pathname)) {
            sitePath = sitePath.slice(siteRootUrl.pathname.length);
        } else {
            sitePath = sitePath.split('/').pop();
        }

        return sitePath || "index.html";
    } catch (error) {
        return value;
    }
}

function normalizeLayoutPaths() {
    const containers = [
        document.getElementById('header-placeholder'),
        document.getElementById('footer-placeholder')
    ];

    containers.forEach(container => {
        if (!container) return;

        container.querySelectorAll('[href], [src]').forEach(element => {
            ['href', 'src'].forEach(attribute => {
                const value = element.getAttribute(attribute);
                if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(value)) return;
                element.setAttribute(attribute, rootUrl(value));
            });
        });
    });
}

async function loadLayout() {
    try {
        const isEn = isEnglishPage();
        const headerFile = isEn ? 'components/Header-en.html' : 'components/Header.html';
        const footerFile = isEn ? 'components/Footer-en.html' : 'components/Footer.html';

        // Nạp Header
        const headerRes = await fetch(rootUrl(headerFile));
        if (headerRes.ok) {
            const headerData = await headerRes.text();
            document.getElementById('header-placeholder').innerHTML = headerData;
        }

        // Nạp Footer
        const footerRes = await fetch(rootUrl(footerFile));
        if (footerRes.ok) {
            const footerData = await footerRes.text();
            document.getElementById('footer-placeholder').innerHTML = footerData;
        }

        // KÍCH HOẠT CÁC TÍNH NĂNG SAU KHI NẠP XONG HTML
        normalizeLayoutPaths();
        initMenuLogic();
        initSearchLogic();
        initEmailFormLogic();
        initLangLogic();
        initMainContactForm(); 
        initNewsLogic(); 
        initJobFilterLogic();

    } catch (error) {
        console.error("Lỗi khi nạp layout:", error);
    }
}
/**
 * 2. LOGIC MENU & HEADER SCROLL (Hỗ trợ Dropdown & Trang chi tiết)
 */
function initMenuLogic() {
    const menuLinks = document.querySelectorAll('.menu a');
    const topLevelLinks = document.querySelectorAll('.menu > a, .menu > .dropdown > a');
    const currentSection = getMenuSection(getCurrentPagePath());

    menuLinks.forEach(link => link.classList.remove('active'));
    topLevelLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        if (getMenuSection(getSitePath(href)) === currentSection && currentSection) {
            link.classList.add('active');
        }
    });
    /* --- ĐOẠN CODE MỚI XỬ LÝ MENU 3 GẠCH --- */
    const menuToggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.header .menu');

    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Tránh lỗi nổi bọt sự kiện
            menu.classList.toggle('active');
            
            // Thay đổi biểu tượng từ 3 gạch (bars) thành dấu X (times) khi mở
            const icon = menuToggle.querySelector('i');
            if (menu.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });

        // Bấm ra ngoài vùng menu thì tự động đóng menu lại
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target) && !menuToggle.contains(e.target)) {
                menu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    }
}

function getMenuSection(pagePath) {
    const normalizedPath = decodeURIComponent(pagePath || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .toLowerCase();
    const fileName = normalizedPath.split('/').pop();

    if (!normalizedPath || fileName === 'index.html' || fileName === 'index-en.html') {
        return 'home';
    }

    if (
        normalizedPath.startsWith('pages/about/') ||
        fileName === 'gioi_thieu.html' ||
        fileName === 'about-en.html'
    ) {
        return 'about';
    }

    const sectorFiles = [
        'linh-vuc-hoat-dong.html',
        'field-of-activities-en.html',
        'bat-dong-san.html',
        'real-estate.html',
        'ha-tang-cong-nghiep.html',
        'industrial-structures.html',
        'htky-gt.html',
        'technical-structures-transportation.html',
        'thuong-mai-xnk.html',
        'trade-imports-exports.html',
        'gao.html',
        'nong-san.html',
        'vat-lieu-xay-dung.html'
    ];

    if (
        normalizedPath.startsWith('pages/sectors/') ||
        normalizedPath.startsWith('pages/projects/') ||
        sectorFiles.includes(fileName)
    ) {
        return 'sectors';
    }

    if (
        normalizedPath.startsWith('pages/careers/') ||
        fileName === 'tuyen_dung.html' ||
        fileName === 'tuyen_dung_en.html' ||
        fileName === 'khdt.html'
    ) {
        return 'careers';
    }

    if (normalizedPath.startsWith('pages/news/')) {
        return 'news';
    }

    if (normalizedPath.startsWith('pages/contact/')) {
        return 'contact';
    }

    return '';
}

/**
 * 3. LOGIC TÌM KIẾM
 */
function initSearchLogic() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && this.value) {
                alert("Đang tìm kiếm nội dung: " + this.value);
            }
        });
    }
}

/**
 * 4. XỬ LÝ FORM LIÊN HỆ CHÍNH (SỬA LỖI ĐỨNG FORM)
 */
function initMainContactForm() {
    const mainForm = document.getElementById('mainContactForm');
    const statusMsg = document.getElementById('contact-status');

    if (!mainForm || !statusMsg) return;

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault(); 
        
        const response = grecaptcha.getResponse();
        if (response.length === 0) {
            alert("Vui lòng xác nhận bạn không phải là người máy!");
            return;
        }
        const btn = mainForm.querySelector('button');
        const originalBtnText = btn.innerText;

        btn.innerText = "ĐANG GỬI...";
        btn.disabled = true;

        // Tạo dữ liệu từ Form
        const formData = new FormData(mainForm);

        // --- THÊM DÒNG NÀY ĐỂ LẤY URL HIỆN TẠI ---
        formData.append("pageUrl", window.location.href); 
        // ----------------------------------------

        fetch(mainForm.action, {
            method: 'POST',
            mode: 'no-cors', 
            body: new URLSearchParams(formData)
        })
        .then(() => {
            statusMsg.innerText = "Cảm ơn bạn! Yêu cầu đã được gửi thành công.";
            statusMsg.style.backgroundColor = "#d4edda";
            statusMsg.style.color = "#155724";
            statusMsg.style.border = "1px solid #c3e6cb";
            statusMsg.style.display = "block";
            
            mainForm.reset();
            grecaptcha.reset(); // Nên reset cả reCAPTCHA nữa
            btn.innerText = originalBtnText;
            btn.disabled = false;

            setTimeout(() => {
                statusMsg.style.display = "none";
            }, 5000);
        })
        .catch(error => {
            statusMsg.innerText = "Có lỗi xảy ra. Vui lòng thử lại sau!";
            statusMsg.style.backgroundColor = "#f8d7da";
            statusMsg.style.color = "#721c24";
            statusMsg.style.display = "block";
            btn.disabled = false;
            btn.innerText = originalBtnText;
        });
    });
}

/**
 * 5. LOGIC ĐĂNG KÝ EMAIL (FOOTER)
 */
function initEmailFormLogic() {
    const form = document.getElementById('emailForm');
    const messageBox = document.getElementById('form-message');

    if (!form || !messageBox) return;

    form.addEventListener('submit', e => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const emailInput = form.querySelector('input[name="email"]');
        
        btn.innerHTML = "Đang gửi...";
        btn.disabled = true;

        // --- SỬA TẠI ĐÂY ---
        fetch(form.action, {
            method: 'POST',
            mode: 'no-cors',
            body: new URLSearchParams({ 
                email: emailInput.value,
                pageUrl: window.location.href // Thêm dòng này để lấy link
            })
        })
        // -------------------
        .then(() => {
            messageBox.innerText = "Đăng ký nhận tin thành công!";
            messageBox.style.color = "#00ff00";
            messageBox.style.display = "block";
            form.reset();
            btn.innerHTML = "Đăng ký";
            btn.disabled = false;
            setTimeout(() => { messageBox.style.display = "none"; }, 5000);
        })
        .catch(() => {
            messageBox.innerText = "Lỗi. Thử lại sau!";
            messageBox.style.display = "block";
            btn.disabled = false;
            btn.innerHTML = "Đăng ký";
        });
    });
}



/**
 * 6. LOGIC CHUYỂN NGÔN NGỮ (ĐÃ SỬA LỖI ĐỊNH TUYẾN)
 */
function changeLang(lang) {
    // Lấy tên file hiện tại (ví dụ: Gioi-thieu.html hoặc about-en.html)
    const currentPage = getCurrentPagePath();

    let targetPage = "";

    if (lang === 'en') {
        // Nếu đã ở trang tiếng Anh rồi thì giữ nguyên
        if (isEnglishPage(currentPage)) {
            targetPage = currentPage;
        } else {
            // Tìm trong map, nếu có thì đi theo map, không có thì tự động replace đuôi mặc định
            targetPage = pageLanguageMap[currentPage] || currentPage.replace('.html', '-en.html');
        }
    } else {
        // Khôi phục về tiếng Việt: Tìm xem file hiện tại là giá trị tiếng Anh nào trong map
        const viPage = Object.keys(pageLanguageMap).find(key => pageLanguageMap[key] === currentPage);
        
        if (viPage) {
            targetPage = viPage;
        } else {
            // Nếu không nằm trong map thì tự động xóa đuôi '-en.html' đi
            targetPage = currentPage.replace('-en.html', '.html');
        }
    }

    window.location.href = rootUrl(targetPage);
}

function initLangLogic() {
    const currentPage = getCurrentPagePath();
    const isEn = isEnglishPage(currentPage);
    
    const viBtn = document.getElementById('lang-vi');
    const enBtn = document.getElementById('lang-en');

    if (viBtn) viBtn.classList.toggle('active', !isEn);
    if (enBtn) enBtn.classList.toggle('active', isEn);
}

/**
 * 7. LOGIC HIỂN THỊ TIN TỨC TỪ JSON (ARCHIVE)
 */
async function initNewsLogic() {
    const newsGrid = document.querySelector('.news-grid');
    
    // Kiểm tra nếu trang hiện tại có chứa khung hiển thị tin tức thì mới chạy
    if (!newsGrid) return;

    try {
        // Đường dẫn file JSON chứa danh sách bài báo
        const response = await fetch(rootUrl('data/news-data.json'));
        if (!response.ok) throw new Error("Không thể tải file dữ liệu tin tức");
        
        const newsData = await response.json();

        // Xóa nội dung cũ (nếu có) trước khi đổ dữ liệu mới
        newsGrid.innerHTML = '';

        newsData.forEach(item => {
            const newsHTML = `
                <article class="news-item">
                    <div class="news-thumb">
                        <a href="${itemLink}">
                            <img src="${itemImage}" alt="${item.title}" onerror="this.src='${fallbackImage}'">
                        </a>
                        <span class="news-category">${item.category}</span>
                    </div>
                    <div class="news-info">
                        <span class="news-date"><i class="far fa-calendar-alt"></i> ${item.date}</span>
                        <div class="news-title-wrapper">
                            <h3><a href="${itemLink}">${item.title}</a></h3>
                        </div>
                        <div class="news-excerpt-wrapper">
                            <p class="news-excerpt">${item.excerpt}</p>
                        </div>
                        <a href="${itemLink}" class="read-more-link">Xem thêm <i class="fas fa-long-arrow-alt-right"></i></a>
                    </div>
                </article>
            `;
            newsGrid.insertAdjacentHTML('beforeend', newsHTML);
        });
    } catch (error) {
        console.error("Lỗi khi nạp tin tức:", error);
        newsGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Hiện tại chưa có tin tức mới nhất.</p>';
    }
}

/**
 * 8. LOGIC LỌC TUYỂN DỤNG (THEO VỊ TRÍ & ĐỊA ĐIỂM)
 */
function initJobFilterLogic() {
    const positionFilter = document.getElementById('position-filter');
    const locationFilter = document.getElementById('location-filter');
    // Lấy tất cả hàng trong body của bảng tuyển dụng
    const tableRows = document.querySelectorAll('.recruitment-table tbody tr');

    // Nếu không tìm thấy các phần tử lọc thì thoát hàm
    if (!positionFilter || !locationFilter || tableRows.length === 0) return;

    function filterJobs() {
        const selectedPos = positionFilter.value; // Lấy giá trị từ select Vị trí
        const selectedLoc = locationFilter.value; // Lấy giá trị từ select Địa điểm

        tableRows.forEach(row => {
            const rowPos = row.getAttribute('data-position');
            const rowLoc = row.getAttribute('data-location');

            // ĐIỀU KIỆN LỌC THÔNG MINH:
            // Nếu người dùng không chọn (giá trị là "") -> Luôn đúng (True)
            // Nếu người dùng có chọn -> Phải khớp chính xác với data-attribute
            const isPosMatch = !selectedPos || rowPos === selectedPos;
            const isLocMatch = !selectedLoc || rowLoc === selectedLoc;

            // Chỉ hiển thị nếu THỎA MÃN CẢ HAI (hoặc cả hai đều không chọn)
            if (isPosMatch && isLocMatch) {
                row.style.display = ""; 
            } else {
                row.style.display = "none";
            }
        });
    }

    // Lắng nghe sự kiện thay đổi trên cả 2 ô chọn
    positionFilter.addEventListener('change', filterJobs);
    locationFilter.addEventListener('change', filterJobs);
}

// KHỞI CHẠY
document.addEventListener('DOMContentLoaded', loadLayout);
