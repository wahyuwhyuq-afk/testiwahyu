// ============================================================
// KONFIGURASI
// ============================================================
const ADMIN_PASSWORD = 'wahyu123'; // ← Ganti dengan password rahasia kamu
const STORAGE_KEY_REVIEWS = 'wahyuStoreReviews';
const STORAGE_KEY_TESTIMONIALS = 'wahyuStoreTestimonials';
const WA_NUMBER = '62895401139306'; // Nomor WA tanpa tanda +

// ============================================================
// STATE
// ============================================================
let reviews = JSON.parse(localStorage.getItem(STORAGE_KEY_REVIEWS)) || [];
let testimonials = JSON.parse(localStorage.getItem(STORAGE_KEY_TESTIMONIALS)) || [];
let isAdmin = sessionStorage.getItem('wahyuAdmin') === 'true';
let selectedRating = 0;

// ============================================================
// DOM ELEMENTS
// ============================================================
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const galleryGrid = document.getElementById('galleryGrid');
const photoCountSpan = document.getElementById('photoCount');
const countBadge = document.getElementById('countBadge');
const uploadLabel = document.getElementById('uploadLabel');

const adminToggle = document.getElementById('adminToggle');
const loginPanel = document.getElementById('loginPanel');
const adminPassword = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const uploadCard = document.getElementById('uploadCard');
const visitorInfo = document.getElementById('visitorInfo');

const starRating = document.getElementById('starRating');
const stars = starRating.querySelectorAll('.star');
const ratingText = document.getElementById('ratingText');
const reviewerName = document.getElementById('reviewerName');
const reviewComment = document.getElementById('reviewComment');
const submitReviewBtn = document.getElementById('submitReviewBtn');

const reviewsList = document.getElementById('reviewsList');
const reviewCount = document.getElementById('reviewCount');
const avgText = document.getElementById('avgText');
const avgStars = document.getElementById('avgStars');

const toast = document.getElementById('toast');

// ============================================================
// TOAST NOTIFICATION
// ============================================================
let toastTimer;
function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.style.background = isError
        ? 'linear-gradient(135deg, #ff6b7a, #dc3545)'
        : 'linear-gradient(135deg, #7dd3fc, #38bdf8)';
    toast.style.color = isError ? '#fff' : '#0b1a2e';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ============================================================
// SAVE FUNCTIONS
// ============================================================
function saveReviews() {
    try {
        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(reviews));
    } catch (e) {
        console.warn('Gagal simpan ulasan:', e);
        showToast('⚠️ Penyimpanan penuh!', true);
    }
}

function saveTestimonials() {
    try {
        localStorage.setItem(STORAGE_KEY_TESTIMONIALS, JSON.stringify(testimonials));
    } catch (e) {
        console.warn('Gagal simpan testimoni:', e);
        showToast('⚠️ Penyimpanan penuh! Hapus foto lama.', true);
    }
}

// ============================================================
// ADMIN UI
// ============================================================
function updateAdminUI() {
    if (isAdmin) {
        adminToggle.textContent = '🔓 Logout Admin';
        adminToggle.classList.add('active');
        uploadCard.classList.add('show');
        visitorInfo.style.display = 'none';
        loginPanel.classList.remove('show');
    } else {
        adminToggle.textContent = '🔒 Login Admin';
        adminToggle.classList.remove('active');
        uploadCard.classList.remove('show');
        visitorInfo.style.display = 'flex';
    }
    renderGallery();
    renderReviews();
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
adminToggle.addEventListener('click', () => {
    if (isAdmin) {
        if (confirm('Keluar dari mode admin?')) {
            isAdmin = false;
            sessionStorage.removeItem('wahyuAdmin');
            updateAdminUI();
            adminPassword.value = '';
            loginError.textContent = '';
        }
    } else {
        loginPanel.classList.toggle('show');
        if (loginPanel.classList.contains('show')) {
            setTimeout(() => adminPassword.focus(), 100);
        }
    }
});

loginBtn.addEventListener('click', () => {
    const pass = adminPassword.value.trim();
    if (pass === ADMIN_PASSWORD) {
        isAdmin = true;
        sessionStorage.setItem('wahyuAdmin', 'true');
        loginError.textContent = '';
        adminPassword.value = '';
        updateAdminUI();
        showToast('✅ Berhasil login sebagai admin');
    } else {
        loginError.textContent = '❌ Password salah! Coba lagi.';
        adminPassword.value = '';
        adminPassword.focus();
    }
});

adminPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// ============================================================
// RATING BINTANG
// ============================================================
const ratingLabels = {
    1: '😞 Sangat Buruk',
    2: '😕 Buruk',
    3: '😐 Cukup',
    4: '😊 Bagus',
    5: '🤩 Sangat Bagus!'
};

function paintStars(value) {
    stars.forEach(s => {
        const v = parseInt(s.dataset.value);
        s.classList.toggle('active', v <= value);
    });
}

stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => {
            const v = parseInt(s.dataset.value);
            s.classList.toggle('hovered', v <= val);
        });
    });

    star.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hovered'));
    });

    star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.value);
        paintStars(selectedRating);
        ratingText.textContent = ratingLabels[selectedRating];
        ratingText.style.color = '#fbbf24';
    });
});

starRating.addEventListener('mouseleave', () => {
    if (selectedRating > 0) {
        paintStars(selectedRating);
        ratingText.textContent = ratingLabels[selectedRating];
    } else {
        stars.forEach(s => s.classList.remove('active'));
        ratingText.textContent = 'Pilih bintang untuk memberi rating';
        ratingText.style.color = '#8aa3be';
    }
});

// ============================================================
// SUBMIT ULASAN → LOCALSTORAGE
// ============================================================
submitReviewBtn.addEventListener('click', () => {
    const name = reviewerName.value.trim();
    const comment = reviewComment.value.trim();

    if (selectedRating === 0) { showToast('⚠️ Pilih rating bintang dulu!', true); return; }
    if (name.length < 2) { showToast('⚠️ Nama minimal 2 karakter', true); reviewerName.focus(); return; }
    if (comment.length < 5) { showToast('⚠️ Ulasan minimal 5 karakter', true); reviewComment.focus(); return; }

    reviews.unshift({
        id: Date.now().toString(),
        name: name,
        comment: comment,
        rating: selectedRating,
        createdAt: new Date().toISOString()
    });

    saveReviews();
    renderReviews();

    // Reset form
    selectedRating = 0;
    stars.forEach(s => s.classList.remove('active', 'hovered'));
    ratingText.textContent = 'Pilih bintang untuk memberi rating';
    ratingText.style.color = '#8aa3be';
    reviewerName.value = '';
    reviewComment.value = '';

    showToast('🎉 Terima kasih! Ulasan Anda sudah terkirim.');
});

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return 'Baru saja';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);

    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';

    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// RENDER ULASAN
// ============================================================
function renderReviews() {
    const total = reviews.length;
    reviewCount.textContent = total;

    if (total === 0) {
        avgText.textContent = '0.0 / 5';
        avgStars.textContent = '☆☆☆☆☆';
        reviewsList.innerHTML = `
            <div class="empty-reviews">
                💭 Belum ada ulasan. Jadilah yang pertama!
            </div>
        `;
        return;
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / total).toFixed(1);
    avgText.textContent = avg + ' / 5';
    const fullStars = Math.round(avg);
    avgStars.textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

    reviewsList.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.dataset.id = r.id;

        const starsHtml = '★'.repeat(r.rating) + `<span class="off">${'★'.repeat(5 - r.rating)}</span>`;

        div.innerHTML = `
            <div class="review-header">
                <div class="review-avatar">${getInitials(r.name)}</div>
                <div class="review-user-info">
                    <div class="review-name">${escapeHtml(r.name)}</div>
                    <div class="review-date">${formatDate(r.createdAt)}</div>
                </div>
            </div>
            <div class="review-stars">${starsHtml}</div>
            <div class="review-comment">${escapeHtml(r.comment)}</div>
        `;

        if (isAdmin) {
            const delBtn = document.createElement('button');
            delBtn.className = 'review-delete';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Hapus ulasan ini';
            delBtn.style.display = 'flex';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Hapus ulasan dari "${r.name}"?`)) {
                    reviews = reviews.filter(x => x.id !== r.id);
                    saveReviews();
                    renderReviews();
                    showToast('🗑️ Ulasan dihapus');
                }
            });
            div.appendChild(delBtn);
        }

        reviewsList.appendChild(div);
    });
}

// ============================================================
// RENDER GALERI
// ============================================================
function renderGallery() {
    const total = testimonials.length;
    photoCountSpan.textContent = total;
    countBadge.textContent = total + ' foto';

    if (total === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                ✨ Belum ada testimoni foto.<br>
                ${isAdmin ? 'Upload foto bukti transaksi di atas.' : 'Testimoni akan muncul di sini.'}
            </div>
        `;
        return;
    }

    galleryGrid.innerHTML = '';
    testimonials.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = item.data;
        img.alt = 'Testimoni Wahyu Store Subang';
        img.loading = 'lazy';

        div.appendChild(img);

        if (isAdmin) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Hapus foto ini';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Hapus foto testimoni ini?')) {
                    testimonials = testimonials.filter(x => x.id !== item.id);
                    saveTestimonials();
                    renderGallery();
                    showToast('🗑️ Foto dihapus');
                }
            });
            div.appendChild(delBtn);
        }

        galleryGrid.appendChild(div);
    });
}

// ============================================================
// UPLOAD FOTO → LOCALSTORAGE
// ============================================================
function handleUpload() {
    if (!isAdmin) return;
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    uploadBtn.disabled = true;
    const totalFiles = files.length;
    let processed = 0;
    let success = 0;
    let failed = 0;

    uploadBtn.innerHTML = `⏳ Memproses 0/${totalFiles}...`;

    Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) {
            failed++;
            processed++;
            checkDone();
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const dataUrl = e.target.result;

            // Batasi ukuran ~2.5MB base64 (≈ 1.8MB file)
            if (dataUrl.length > 3_500_000) {
                alert(`Foto "${file.name}" terlalu besar (maks ~2.5MB). Kompres dulu.`);
                failed++;
            } else {
                testimonials.unshift({
                    id: Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8),
                    data: dataUrl,
                    name: file.name,
                    createdAt: new Date().toISOString()
                });
                success++;
            }

            processed++;
            checkDone();
        };

        reader.onerror = () => {
            failed++;
            processed++;
            checkDone();
        };

        reader.readAsDataURL(file);
    });

    function checkDone() {
        uploadBtn.innerHTML = `⏳ Memproses ${processed}/${totalFiles}...`;
        if (processed === totalFiles) {
            saveTestimonials();
            renderGallery();
            fileInput.value = '';
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Semua
            `;

            if (success > 0) showToast(`📸 ${success} foto berhasil diupload!`);
            if (failed > 0) showToast(`⚠️ ${failed} foto gagal diupload`, true);
        }
    }
}

// ============================================================
// HAPUS SEMUA FOTO
// ============================================================
function clearAll() {
    if (!isAdmin) return;
    if (testimonials.length === 0) {
        alert('Belum ada testimoni yang bisa dihapus.');
        return;
    }
    if (!confirm(`⚠️ Yakin ingin menghapus SEMUA ${testimonials.length} foto testimoni?`)) return;

    testimonials = [];
    saveTestimonials();
    renderGallery();
    fileInput.value = '';
    showToast('🗑️ Semua foto dihapus');
}

// ============================================================
// EVENT LISTENERS
// ============================================================
fileInput.addEventListener('change', () => {
    uploadBtn.disabled = !(fileInput.files.length > 0);
});

uploadBtn.addEventListener('click', handleUpload);
clearBtn.addEventListener('click', clearAll);

uploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = '#7dd3fc';
    uploadLabel.style.background = 'rgba(125, 211, 252, 0.15)';
});

uploadLabel.addEventListener('dragleave', () => {
    uploadLabel.style.borderColor = 'rgba(125, 211, 252, 0.4)';
    uploadLabel.style.background = 'rgba(0, 0, 0, 0.3)';
});

uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = 'rgba(125, 211, 252, 0.4)';
    uploadLabel.style.background = 'rgba(0, 0, 0, 0.3)';

    if (!isAdmin) return;

    const dt = e.dataTransfer;
    if (dt.files.length > 0) {
        fileInput.files = dt.files;
        uploadBtn.disabled = false;
        handleUpload();
    }
});

// ============================================================
// INIT
// ============================================================
updateAdminUI();