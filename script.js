// ============================================================
// FIREBASE SDK (v10 Modular)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
    getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
    onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
    getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ============================================================
// FIREBASE CONFIG — Wahyu Store Subang
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAbucBF9fmOx4I4mHeN7QY-5kHGi8D4DmM",
    authDomain: "wahyu-store-subang-4e51e.firebaseapp.com",
    projectId: "wahyu-store-subang-4e51e",
    storageBucket: "wahyu-store-subang-4e51e.firebasestorage.app",
    messagingSenderId: "288139477735",
    appId: "1:288139477735:web:203a0c5a7ad2382f3ad842",
    measurementId: "G-SNGVX5PMH8"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
// KONFIGURASI
// ============================================================
const ADMIN_PASSWORD = 'wahyu123'; // ← Ganti dengan password rahasia kamu
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200 MB
const REVIEWS_PER_PAGE = 5; // 5 ulasan dulu, sisanya di arsip

// ============================================================
// STATE
// ============================================================
let reviews = [];
let testimonials = [];
let isAdmin = sessionStorage.getItem('wahyuAdmin') === 'true';
let selectedRating = 0;
let reviewsExpanded = false;
let pendingFiles = [];

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
const seeMoreBtn = document.getElementById('seeMoreBtn');

const previewContainer = document.getElementById('previewContainer');
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
        pendingFiles = [];
        renderPreview();
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
// SUBMIT ULASAN
// ============================================================
submitReviewBtn.addEventListener('click', async () => {
    const name = reviewerName.value.trim();
    const comment = reviewComment.value.trim();

    if (selectedRating === 0) { showToast('⚠️ Pilih rating bintang dulu!', true); return; }
    if (name.length < 2) { showToast('⚠️ Nama minimal 2 karakter', true); reviewerName.focus(); return; }
    if (comment.length < 5) { showToast('⚠️ Ulasan minimal 5 karakter', true); reviewComment.focus(); return; }

    submitReviewBtn.disabled = true;
    submitReviewBtn.innerHTML = '⏳ Mengirim...';

    try {
        await addDoc(collection(db, 'reviews'), {
            name: name,
            comment: comment,
            rating: selectedRating,
            createdAt: serverTimestamp()
        });

        selectedRating = 0;
        stars.forEach(s => s.classList.remove('active', 'hovered'));
        ratingText.textContent = 'Pilih bintang untuk memberi rating';
        ratingText.style.color = '#8aa3be';
        reviewerName.value = '';
        reviewComment.value = '';

        showToast('🎉 Terima kasih! Ulasan Anda sudah terkirim.');
    } catch (err) {
        console.error('Gagal kirim ulasan:', err);
        showToast('❌ Gagal mengirim ulasan. Cek koneksi.', true);
    } finally {
        submitReviewBtn.disabled = false;
        submitReviewBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Kirim Ulasan
        `;
    }
});

// ============================================================
// UTILITY
// ============================================================
function formatDate(dateObj) {
    if (!dateObj) return 'Baru saja';
    const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
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

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ============================================================
// RENDER ULASAN + ARSIP
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
        if (seeMoreBtn) seeMoreBtn.style.display = 'none';
        return;
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / total).toFixed(1);
    avgText.textContent = avg + ' / 5';
    const fullStars = Math.round(avg);
    avgStars.textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

    const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, REVIEWS_PER_PAGE);

    reviewsList.innerHTML = '';
    visibleReviews.forEach(r => {
        reviewsList.appendChild(createReviewElement(r));
    });

    if (seeMoreBtn) {
        if (total > REVIEWS_PER_PAGE) {
            seeMoreBtn.style.display = 'flex';
            if (reviewsExpanded) {
                seeMoreBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                    Sembunyikan
                `;
            } else {
                seeMoreBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    Lihat Selengkapnya (${total - REVIEWS_PER_PAGE} ulasan lagi)
                `;
            }
        } else {
            seeMoreBtn.style.display = 'none';
        }
    }
}

function createReviewElement(r) {
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
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Hapus ulasan dari "${r.name}"?`)) {
                try {
                    await deleteDoc(doc(db, 'reviews', r.id));
                    showToast('🗑️ Ulasan dihapus');
                } catch (err) {
                    console.error(err);
                    showToast('❌ Gagal menghapus', true);
                }
            }
        });
        div.appendChild(delBtn);
    }

    return div;
}

if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', () => {
        reviewsExpanded = !reviewsExpanded;
        renderReviews();
        const reviewsSection = document.querySelector('.reviews-section');
        if (reviewsSection) {
            reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

// ============================================================
// RENDER GALERI (nomor urut + caption)
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
    testimonials.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';

        const nomor = index + 1;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'gallery-img-wrap';

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.caption || 'Testimoni Wahyu Store Subang';
        img.loading = 'lazy';

        const badge = document.createElement('div');
        badge.className = 'gallery-number';
        badge.textContent = '#' + nomor;

        imgWrap.appendChild(img);
        imgWrap.appendChild(badge);
        div.appendChild(imgWrap);

        if (item.caption) {
            const caption = document.createElement('div');
            caption.className = 'gallery-caption';
            caption.textContent = item.caption;
            div.appendChild(caption);
        }

        if (isAdmin) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Hapus foto ini';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Hapus foto testimoni ini?')) {
                    try {
                        const fileRef = storageRef(storage, item.storagePath);
                        await deleteObject(fileRef);
                        await deleteDoc(doc(db, 'testimonials', item.id));
                        showToast('🗑️ Foto dihapus');
                    } catch (err) {
                        console.error(err);
                        showToast('❌ Gagal hapus foto', true);
                    }
                }
            });
            div.appendChild(delBtn);

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-caption-btn';
            editBtn.innerHTML = '✎';
            editBtn.title = 'Edit caption';
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newCaption = prompt('Edit caption untuk foto ini:', item.caption || '');
                if (newCaption === null) return;
                try {
                    await updateDoc(doc(db, 'testimonials', item.id), {
                        caption: newCaption.trim()
                    });
                    showToast('✏️ Caption diperbarui');
                } catch (err) {
                    console.error(err);
                    showToast('❌ Gagal update caption', true);
                }
            });
            div.appendChild(editBtn);
        }

        galleryGrid.appendChild(div);
    });
}

// ============================================================
// FILE INPUT → PENDING
// ============================================================
fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast(`⚠️ "${file.name}" bukan gambar, diabaikan`, true);
            return;
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            showToast(`⚠️ "${file.name}" terlalu besar (maks 200MB)`, true);
            return;
        }

        pendingFiles.push({ file: file, caption: '' });
    });

    fileInput.value = '';
    renderPreview();
    uploadBtn.disabled = pendingFiles.length === 0;
});

// ============================================================
// RENDER PREVIEW
// ============================================================
function renderPreview() {
    if (!previewContainer) return;

    if (pendingFiles.length === 0) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
        return;
    }

    previewContainer.style.display = 'block';
    previewContainer.innerHTML = `
        <div class="preview-header">
            <strong>📋 ${pendingFiles.length} foto siap diupload</strong>
            <small>Isi caption (opsional) lalu klik Upload Semua</small>
        </div>
    `;

    const list = document.createElement('div');
    list.className = 'preview-list';

    pendingFiles.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'preview-item';

        const thumb = document.createElement('img');
        thumb.className = 'preview-thumb';
        thumb.src = URL.createObjectURL(item.file);
        thumb.onload = () => URL.revokeObjectURL(thumb.src);

        const info = document.createElement('div');
        info.className = 'preview-info';
        info.innerHTML = `
            <div class="preview-name">${escapeHtml(item.file.name)}</div>
            <div class="preview-size">${formatSize(item.file.size)}</div>
        `;

        const captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.className = 'preview-caption';
        captionInput.placeholder = 'Tulis caption (opsional)...';
        captionInput.maxLength = 100;
        captionInput.value = item.caption;
        captionInput.addEventListener('input', (e) => {
            pendingFiles[index].caption = e.target.value;
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'preview-remove';
        removeBtn.innerHTML = '✕';
        removeBtn.title = 'Hapus dari daftar';
        removeBtn.addEventListener('click', () => {
            pendingFiles.splice(index, 1);
            renderPreview();
            uploadBtn.disabled = pendingFiles.length === 0;
        });

        row.appendChild(thumb);
        row.appendChild(info);
        row.appendChild(captionInput);
        row.appendChild(removeBtn);
        list.appendChild(row);
    });

    previewContainer.appendChild(list);
}

// ============================================================
// UPLOAD SEMUA
// ============================================================
async function handleUpload() {
    if (!isAdmin) return;
    if (pendingFiles.length === 0) return;

    uploadBtn.disabled = true;
    const totalFiles = pendingFiles.length;
    let success = 0;
    let failed = 0;

    const filesToUpload = [...pendingFiles];

    for (let i = 0; i < filesToUpload.length; i++) {
        const item = filesToUpload[i];
        const file = item.file;
        const caption = (item.caption || '').trim();

        uploadBtn.innerHTML = `⏳ Upload ${i + 1}/${totalFiles}...`;

        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `testimonials/${Date.now()}_${safeName}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            await addDoc(collection(db, 'testimonials'), {
                url: url,
                storagePath: path,
                name: file.name,
                caption: caption,
                createdAt: serverTimestamp()
            });
            success++;
        } catch (err) {
            console.error('Gagal upload:', file.name, err);
            failed++;
        }
    }

    pendingFiles = [];
    renderPreview();
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload Semua
    `;

    if (success > 0) showToast(`📸 ${success} foto berhasil diupload!`);
    if (failed > 0) showToast(`⚠️ ${failed} foto gagal diupload`, true);
}

uploadBtn.addEventListener('click', handleUpload);

// ============================================================
// HAPUS SEMUA
// ============================================================
async function clearAll() {
    if (!isAdmin) return;
    if (testimonials.length === 0) {
        alert('Belum ada testimoni yang bisa dihapus.');
        return;
    }
    if (!confirm(`⚠️ Yakin ingin menghapus SEMUA ${testimonials.length} foto testimoni?`)) return;

    clearBtn.disabled = true;
    clearBtn.innerHTML = '⏳ Menghapus...';

    let done = 0;
    for (const item of testimonials) {
        try {
            const fileRef = storageRef(storage, item.storagePath);
            await deleteObject(fileRef).catch(() => {});
            await deleteDoc(doc(db, 'testimonials', item.id));
        } catch (err) {
            console.error('Gagal hapus:', err);
        }
        done++;
        clearBtn.innerHTML = `⏳ ${done}/${testimonials.length}...`;
    }

    clearBtn.disabled = false;
    clearBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Hapus Semua
    `;
    showToast('🗑️ Semua foto dihapus');
}

clearBtn.addEventListener('click', clearAll);

// ============================================================
// DRAG & DROP
// ============================================================
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
        Array.from(dt.files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            if (file.size > MAX_UPLOAD_SIZE) {
                showToast(`⚠️ "${file.name}" terlalu besar (maks 200MB)`, true);
                return;
            }
            pendingFiles.push({ file: file, caption: '' });
        });
        renderPreview();
        uploadBtn.disabled = pendingFiles.length === 0;
    }
});

// ============================================================
// REAL-TIME LISTENERS
// ============================================================
const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
onSnapshot(reviewsQuery, (snapshot) => {
    reviews = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        reviews.push({
            id: docSnap.id,
            name: data.name,
            comment: data.comment,
            rating: data.rating,
            createdAt: data.createdAt
        });
    });
    renderReviews();
}, (err) => {
    console.error('Firestore error:', err);
    reviewsList.innerHTML = `
        <div class="empty-reviews">
            ⚠️ Gagal memuat ulasan. Cek konfigurasi Firebase.<br>
            <small>${err.message}</small>
        </div>
    `;
});

const testiQuery = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
onSnapshot(testiQuery, (snapshot) => {
    testimonials = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        testimonials.push({
            id: docSnap.id,
            url: data.url,
            storagePath: data.storagePath,
            name: data.name,
            caption: data.caption || '',
            createdAt: data.createdAt
        });
    });
    renderGallery();
}, (err) => {
    console.error('Firestore error:', err);
    galleryGrid.innerHTML = `
        <div class="empty-state">
            ⚠️ Gagal memuat foto testimoni.<br>
            <small>${err.message}</small>
        </div>
    `;
});

// ============================================================
// INIT
// ============================================================
updateAdminUI();