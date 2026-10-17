import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, updateDoc,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbucBF9fmOx4I4mHeN7QY-5kHGi8D4DmM",
  authDomain: "wahyu-store-subang-4e51e.firebaseapp.com",
  projectId: "wahyu-store-subang-4e51e",
  storageBucket: "wahyu-store-subang-4e51e.firebasestorage.app",
  messagingSenderId: "288139477735",
  appId: "1:288139477735:web:203a0c5a7ad2382f3ad842",
  measurementId: "G-SNGVX5PMH8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_PASSWORD = "admin123";
const ADMIN_KEY = "galeri_testimoni_admin_session";
const MAX_IMAGE_SIZE_KB = 700;
const REACTION_EMOJIS = ["👍", "❤️", "🔥", "😍", "😂"];
const TIKTOK_URL = "https://www.tiktok.com/@wahyustoresubang";

/* ============ KONFIGURASI TELEGRAM ============ */
const TELEGRAM_BOT_TOKEN = "8511547210:AAHPb-3cTjB5M2nRwFcLqQVFizgoQ7yKo_U";
const TELEGRAM_CHAT_ID = "8249918491";
const TELEGRAM_ENABLED = true;

let isAdmin = sessionStorage.getItem(ADMIN_KEY) === "true";
let testimonials = [];
let antrianOrders = [];
let currentOrder = { paket: "", harga: 0 };
let pendingOrderData = { nama: "", wa: "", catatan: "" };

/* ============ UTILITY ============ */
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast " + type;
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function formatDate(timestamp) {
  if (!timestamp) return "Baru saja";
  let d;
  if (timestamp.toDate) d = timestamp.toDate();
  else d = new Date(timestamp);
  const opts = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  return d.toLocaleDateString("id-ID", opts);
}

function formatRupiah(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function getUserId() {
  let uid = localStorage.getItem("testimoni_user_id");
  if (!uid) {
    uid = "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 8);
    localStorage.setItem("testimoni_user_id", uid);
  }
  return uid;
}
const USER_ID = getUserId();

/* ============ KOMPRES FOTO ============ */
function compressImage(file, maxSizeKB = MAX_IMAGE_SIZE_KB) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 900;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ REACTION ============ */
function getReactionCount(item, emoji) {
  if (!item.reactions) return 0;
  return (item.reactions[emoji] || []).length;
}
function hasUserReacted(item, emoji) {
  if (!item.reactions) return false;
  return (item.reactions[emoji] || []).includes(USER_ID);
}
async function toggleReaction(itemId, emoji) {
  const item = testimonials.find(t => t.id === itemId);
  if (!item) return;
  const alreadyReacted = hasUserReacted(item, emoji);
  const docRef = doc(db, "testimonials", itemId);
  try {
    await updateDoc(docRef, {
      [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(USER_ID) : arrayUnion(USER_ID)
    });
  } catch (err) {
    console.error("Reaction error:", err);
    showToast("❌ Gagal menyimpan reaksi: " + err.message, "error");
  }
}

/* ============ RENDER GALERI ============ */
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  const empty = document.getElementById("emptyState");
  const loading = document.getElementById("loadingState");
  const count = document.getElementById("itemCount");

  loading.style.display = "none";
  count.textContent = testimonials.length + " testimoni";

  if (testimonials.length === 0) {
    grid.style.display = "none";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  grid.style.display = "grid";

  const sorted = [...testimonials].sort((a, b) => (a.order || 0) - (b.order || 0));

  grid.innerHTML = sorted.map(item => {
    const reactionHTML = REACTION_EMOJIS.map(emoji => {
      const cnt = getReactionCount(item, emoji);
      const active = hasUserReacted(item, emoji) ? "active" : "";
      return `
        <button type="button" class="reaction-btn ${active}" 
                data-reaction-item="${item.id}" 
                data-reaction-emoji="${emoji}">
          <span>${emoji}</span>
          <span class="count">${cnt}</span>
        </button>
      `;
    }).join("");

    return `
      <div class="gallery-item ${isAdmin ? 'is-admin' : ''}" data-id="${item.id}">
        <div class="image-wrapper">
          <span class="order-badge">#${item.order}</span>
          <button type="button" class="delete-btn" data-delete="${item.id}" data-order="${item.order}" title="Hapus">✕</button>
          <img src="${item.foto}" alt="${escapeHTML(item.nama)}" 
               onclick="openLightbox('${item.id}')" style="cursor:pointer;" loading="lazy">
        </div>
        <div class="caption-box">
          <h3>${escapeHTML(item.nama)}</h3>
          <p>${escapeHTML(item.caption)}</p>
          <span class="date">📅 ${formatDate(item.createdAt)}</span>
        </div>
        <div class="reaction-bar">${reactionHTML}</div>
      </div>
    `;
  }).join("");
}

/* ============ REALTIME TESTIMONI ============ */
function startRealtimeListener() {
  const loading = document.getElementById("loadingState");
  loading.style.display = "block";
  const q = query(collection(db, "testimonials"), orderBy("order", "asc"));
  onSnapshot(q, (snapshot) => {
    testimonials = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGallery();
  }, (error) => {
    console.error("Error loading data:", error);
    loading.style.display = "none";
    document.getElementById("emptyState").style.display = "block";
    showToast("❌ Gagal memuat: " + error.message, "error");
  });
}

/* ============ ADD / DELETE TESTIMONI ============ */
async function addTestimonial(nama, caption, base64Image) {
  const btnSubmit = document.getElementById("btnSubmitForm");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "⏳ Menyimpan...";
  try {
    const maxOrder = testimonials.length > 0
      ? Math.max(...testimonials.map(t => t.order || 0))
      : 0;
    const newOrder = maxOrder + 1;
    await addDoc(collection(db, "testimonials"), {
      order: newOrder, nama, caption,
      foto: base64Image, reactions: {}, createdAt: serverTimestamp()
    });
    showToast(`✅ Testimoni #${newOrder} berhasil disimpan!`, "success");
    return true;
  } catch (err) {
    console.error("Save error:", err);
    showToast("❌ Gagal: " + err.message, "error");
    return false;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "🚀 Simpan Testimoni";
  }
}

async function deleteTestimonial(id) {
  const item = testimonials.find(t => t.id === id);
  if (!item) return;
  try {
    await deleteDoc(doc(db, "testimonials", id));
    showToast(`🗑️ Testimoni #${item.order} dihapus`, "success");
    setTimeout(reorderTestimonials, 500);
  } catch (err) {
    console.error("Delete error:", err);
    showToast("❌ Gagal hapus: " + err.message, "error");
  }
}

async function reorderTestimonials() {
  const q = query(collection(db, "testimonials"), orderBy("order", "asc"));
  const snapshot = await getDocs(q);
  let counter = 1;
  const promises = [];
  snapshot.forEach(d => {
    if (d.data().order !== counter) {
      promises.push(updateDoc(doc(db, "testimonials", d.id), { order: counter }));
    }
    counter++;
  });
  await Promise.all(promises);
}

/* ============ ANTRIAN ORDER ============ */
function extractNamaStore(catatan) {
  if (!catatan) return "";
  const match = catatan.match(/SV\s*;\s*(.+)/i);
  return match ? match[1].trim() : "";
}

function updateNavBadge() {
  const badgeAntrian = document.getElementById("menuBadgeAntrian");
  const pendingCount = antrianOrders.filter(o => o.status === "pending").length;
  if (badgeAntrian) {
    if (pendingCount > 0) {
      badgeAntrian.textContent = pendingCount;
      badgeAntrian.style.display = "inline-block";
    } else {
      badgeAntrian.style.display = "none";
    }
  }

  const badgeProses = document.getElementById("menuBadgeProses");
  if (badgeProses) {
    const doneCount = antrianOrders.filter(o => o.status === "done").length;
    if (doneCount > 0 && isAdmin) {
      badgeProses.textContent = doneCount;
      badgeProses.style.display = "inline-block";
    } else {
      badgeProses.style.display = "none";
    }
  }
}

function renderAntrian() {
  const list = document.getElementById("antrianList");
  const empty = document.getElementById("antrianEmpty");
  const count = document.getElementById("antrianCount");

  const pendingOrders = antrianOrders.filter(o => o.status === "pending");
  count.textContent = pendingOrders.length + " antrian";

  updateNavBadge();

  if (pendingOrders.length === 0) {
    list.innerHTML = "";
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  list.style.display = "flex";

  const sorted = [...pendingOrders].sort((a, b) => {
    const ta = a.createdAt?.toDate?.() || new Date(0);
    const tb = b.createdAt?.toDate?.() || new Date(0);
    return ta - tb;
  });

  list.innerHTML = sorted.map((o, idx) => {
    const namaStore = extractNamaStore(o.catatan) || o.nama;
    const waBersih = (o.wa || "").replace(/[^0-9]/g, "");
    const waFormat = waBersih.startsWith("0") ? "62" + waBersih.slice(1) : waBersih;

    return `
      <div class="antrian-item" data-antrian-id="${o.id}">
        <div class="antrian-num">#${idx + 1}</div>
        <div class="info">
          <div class="nama-store">
            🏪 ${escapeHTML(namaStore)}
            <span class="badge-paket">${escapeHTML(o.paket || "-")}</span>
          </div>
          <div class="detail">
            👤 ${escapeHTML(o.nama || "-")} • 
            <a href="https://wa.me/${waFormat}" target="_blank" class="wa-link">
              📱 ${escapeHTML(o.wa || "-")}
            </a>
          </div>
          <div class="harga">💰 ${formatRupiah(o.harga || 0)}</div>
        </div>
        <div class="antrian-actions">
          <span class="status-tag">⏳ PENDING</span>
          ${isAdmin ? `
            <button type="button" class="btn-proses" data-proses="${o.id}" data-nama="${escapeHTML(namaStore)}">✅ Proses</button>
            <button type="button" class="btn-hapus" data-hapus="${o.id}" data-nama="${escapeHTML(namaStore)}" title="Hapus">✕</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

/* ============ RENDER PROSES ============ */
function renderProses() {
  if (!isAdmin) {
    const listEl = document.getElementById("prosesList");
    if (listEl) listEl.innerHTML = "";
    return;
  }

  const list = document.getElementById("prosesList");
  const empty = document.getElementById("prosesEmpty");
  const count = document.getElementById("prosesCount");

  if (!list) return;

  const doneOrders = antrianOrders.filter(o => o.status === "done");
  count.textContent = doneOrders.length + " pesanan";

  if (doneOrders.length === 0) {
    list.innerHTML = "";
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  list.style.display = "flex";

  const sorted = [...doneOrders].sort((a, b) => {
    const ta = a.processedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
    const tb = b.processedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
    return tb - ta;
  });

  list.innerHTML = sorted.map((o, idx) => {
    const namaStore = extractNamaStore(o.catatan) || o.nama;
    const waBersih = (o.wa || "").replace(/[^0-9]/g, "");
    const waFormat = waBersih.startsWith("0") ? "62" + waBersih.slice(1) : waBersih;
    const waktu = o.processedAt ? formatDate(o.processedAt) : formatDate(o.createdAt);

    return `
      <div class="antrian-item proses-item" data-proses-id="${o.id}" data-copy-order="${o.id}" title="Klik untuk lihat & salin format push kontak">
        <div class="antrian-num">#${idx + 1}</div>
        <div class="info">
          <div class="nama-store">
            🏪 ${escapeHTML(namaStore)}
            <span class="badge-paket">${escapeHTML(o.paket || "-")}</span>
          </div>
          <div class="detail">
            👤 ${escapeHTML(o.nama || "-")} • 
            <a href="https://wa.me/${waFormat}" target="_blank" class="wa-link">
              📱 ${escapeHTML(o.wa || "-")}
            </a>
          </div>
          <div class="harga">💰 ${formatRupiah(o.harga || 0)}</div>
          <div class="detail" style="margin-top:4px;">🕒 Diproses: ${waktu}</div>
          <div class="detail" style="margin-top:6px; color:#4FA8D8; font-weight:700;">📋 Klik untuk lihat Push Kontak</div>
        </div>
        <div class="antrian-actions">
          <span class="status-tag">⚙️ DIPROSES</span>
          <button type="button" class="btn-selesai" data-selesai-proses="${o.id}" data-nama="${escapeHTML(namaStore)}">✅ Selesai</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ============ NOTIFIKASI TELEGRAM ============ */
async function kirimNotifTelegram(pesan) {
  if (!TELEGRAM_ENABLED) return;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️ Token/Chat ID Telegram belum diisi");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: pesan,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.warn("⚠️ Telegram error:", result.description);
    } else {
      console.log("✅ Notif Telegram terkirim");
    }
  } catch (err) {
    console.warn("⚠️ Gagal kirim notif Telegram:", err);
  }
}

function notifOrderBaru(order) {
  const namaStore = extractNamaStore(order.catatan) || order.nama;
  const waBersih = (order.wa || "").replace(/[^0-9]/g, "");
  const waFormat = waBersih.startsWith("0") ? "62" + waBersih.slice(1) : waBersih;

  const pesan = 
`🔔 <b>ORDER BARU MASUK!</b>
━━━━━━━━━━━━━━━━━━
🏪 <b>Nama Store:</b> ${namaStore}
👤 <b>Nama:</b> ${order.nama}
📱 <b>WA:</b> ${order.wa}
🎮 <b>Paket:</b> ${order.paket}
💰 <b>Harga:</b> ${formatRupiah(order.harga)}
💳 <b>Pembayaran:</b> QRIS
━━━━━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString("id-ID")}

✅ <b>Pelanggan sudah konfirmasi bayar!</b>
📋 Buka website → klik "Daftar Proses" untuk kelola order.

📲 <a href="https://wa.me/${waFormat}">Chat Pelanggan via WA</a>`;

  kirimNotifTelegram(pesan);
}

/* ============ PROSES & SELESAI & HAPUS ============ */
async function prosesOrder(id) {
  console.log("🔵 prosesOrder dipanggil, id:", id, "isAdmin:", isAdmin);
  try {
    await updateDoc(doc(db, "orders", id), {
      status: "done",
      processedAt: serverTimestamp()
    });
    console.log("✅ prosesOrder sukses");
    showToast("✅ Pesanan dipindah ke Daftar Proses", "success");

    /* 🔔 Notif Telegram saat diproses */
    const order = antrianOrders.find(o => o.id === id);
    if (order) {
      const namaStore = extractNamaStore(order.catatan) || order.nama;
      kirimNotifTelegram(
        `⚙️ <b>PESANAN DIPROSES</b>\n\n` +
        `🏪 ${namaStore}\n` +
        `🎮 ${order.paket}\n` +
        `⏰ ${new Date().toLocaleString("id-ID")}`
      );
    }
  } catch (err) {
    console.error("❌ prosesOrder error:", err);
    showToast("❌ Gagal proses: " + err.message, "error");
    renderAntrian();
  }
}

async function selesaiOrder(id, nama) {
  console.log("🟢 selesaiOrder dipanggil, id:", id, "nama:", nama, "isAdmin:", isAdmin);
  if (!isAdmin) {
    showToast("🔒 Hanya admin yang bisa menyelesaikan", "error");
    return;
  }
  try {
    /* 1. Hapus dari database */
    await deleteDoc(doc(db, "orders", id));
    console.log("✅ Order dihapus dari database");

    /* 2. Kirim notifikasi ke Telegram */
    kirimNotifTelegram(
      `✅ <b>PESANAN SELESAI</b>\n\n` +
      `🏪 Store: <b>${nama}</b>\n` +
      `⏰ Waktu: ${new Date().toLocaleString("id-ID")}\n\n` +
      `🗑️ Data pesanan telah dihapus dari sistem.`
    );

    showToast(`✅ Pesanan "${nama}" telah selesai & dihapus`, "success");
  } catch (err) {
    console.error("❌ selesaiOrder error:", err);
    showToast("❌ Gagal menyelesaikan pesanan: " + err.message, "error");
    renderProses();
  }
}

async function hapusOrder(id, nama) {
  console.log("🔴 hapusOrder dipanggil, id:", id, "nama:", nama, "isAdmin:", isAdmin);
  if (!isAdmin) {
    showToast("🔒 Hanya admin yang bisa hapus", "error");
    return;
  }
  try {
    await deleteDoc(doc(db, "orders", id));
    console.log("✅ hapusOrder sukses");
    showToast(`🗑️ Pesanan "${nama}" berhasil dihapus`, "success");
  } catch (err) {
    console.error("❌ hapusOrder error:", err);
    showToast("❌ Gagal hapus: " + err.message, "error");
    renderAntrian();
    renderProses();
  }
}

function startAntrianListener() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    antrianOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAntrian();
    renderProses();
  }, (error) => {
    console.error("Antrian listener error:", error);
  });
}

/* ============ UI ADMIN ============ */
function updateAdminUI() {
  if (isAdmin) {
    document.body.classList.add("is-admin-logged");
    document.getElementById("uploadCard").classList.add("show");
  } else {
    document.body.classList.remove("is-admin-logged");
    document.getElementById("uploadCard").classList.remove("show");

    const pageProses = document.getElementById("pageProses");
    if (pageProses && pageProses.classList.contains("active")) {
      switchPage("antrian");
    }
  }
  renderGallery();
  renderAntrian();
  renderProses();
}

/* ============ LOGIN ============ */
const loginModal = document.getElementById("loginModal");
const adminPassword = document.getElementById("adminPassword");
const loginError = document.getElementById("loginError");

function openLoginModal() {
  loginModal.classList.add("show");
  adminPassword.value = "";
  loginError.style.display = "none";
  setTimeout(() => adminPassword.focus(), 100);
}
function closeLoginModal() { loginModal.classList.remove("show"); }

function doLogin() {
  if (adminPassword.value === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem(ADMIN_KEY, "true");
    closeLoginModal();
    updateAdminUI();
    showToast("✅ Login berhasil!", "success");
  } else {
    loginError.style.display = "block";
    adminPassword.value = "";
    adminPassword.focus();
  }
}

/* ============ PREVIEW FOTO ============ */
const fotoInput = document.getElementById("foto");
const preview = document.getElementById("preview");
const sizeInfo = document.getElementById("sizeInfo");
let compressedBase64 = null;

fotoInput.addEventListener("change", async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("⚠️ File harus berupa gambar", "error");
    this.value = "";
    return;
  }
  sizeInfo.style.display = "block";
  sizeInfo.textContent = `⏳ Mengompres... (${(file.size/1024).toFixed(0)} KB)`;
  try {
    compressedBase64 = await compressImage(file);
    preview.src = compressedBase64;
    preview.style.display = "block";
    const finalKB = (compressedBase64.length * 0.75 / 1024).toFixed(0);
    sizeInfo.textContent = `✅ Terkompres: ${(file.size/1024).toFixed(0)} KB → ${finalKB} KB`;
  } catch (err) {
    console.error(err);
    showToast("❌ Gagal memproses gambar", "error");
    compressedBase64 = null;
    preview.style.display = "none";
    sizeInfo.style.display = "none";
  }
});

document.getElementById("uploadForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("❌ Hanya admin yang bisa upload", "error"); return; }
  const nama = document.getElementById("nama").value.trim();
  const caption = document.getElementById("caption").value.trim();
  if (!nama || !caption) { showToast("⚠️ Mohon lengkapi nama & caption", "error"); return; }
  if (!compressedBase64) { showToast("⚠️ Pilih foto terlebih dahulu", "error"); return; }
  const ok = await addTestimonial(nama, caption, compressedBase64);
  if (ok) {
    this.reset();
    preview.style.display = "none";
    preview.src = "";
    sizeInfo.style.display = "none";
    compressedBase64 = null;
  }
});

/* ============ LIGHTBOX ============ */
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxReactions = document.getElementById("lightboxReactions");

window.openLightbox = function(id) {
  const item = testimonials.find(t => t.id === id);
  if (!item) return;
  lightboxImg.src = item.foto;
  lightboxCaption.innerHTML = `<strong>#${item.order} - ${escapeHTML(item.nama)}</strong><br>${escapeHTML(item.caption)}`;
  lightboxReactions.innerHTML = REACTION_EMOJIS.map(emoji => {
    const cnt = getReactionCount(item, emoji);
    const active = hasUserReacted(item, emoji) ? "active" : "";
    return `<button type="button" class="reaction-btn ${active}" data-lightbox-reaction="${emoji}" data-lightbox-item="${id}">
      <span>${emoji}</span><span class="count">${cnt}</span></button>`;
  }).join("");
  lightbox.classList.add("show");
};

function refreshLightboxReactions() {
  if (!lightbox.classList.contains("show")) return;
  const currentSrc = lightboxImg.src;
  const item = testimonials.find(t => t.foto === currentSrc);
  if (!item) return;
  lightboxReactions.innerHTML = REACTION_EMOJIS.map(emoji => {
    const cnt = getReactionCount(item, emoji);
    const active = hasUserReacted(item, emoji) ? "active" : "";
    return `<button type="button" class="reaction-btn ${active}" data-lightbox-reaction="${emoji}" data-lightbox-item="${item.id}">
      <span>${emoji}</span><span class="count">${cnt}</span></button>`;
  }).join("");
}

const _originalRender = renderGallery;
renderGallery = function() {
  _originalRender();
  refreshLightboxReactions();
};

document.getElementById("lightboxClose").addEventListener("click", () => lightbox.classList.remove("show"));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.classList.remove("show"); });

/* ============ SIDE MENU ============ */
const hamburgerBtn = document.getElementById("hamburgerBtn");
const sideMenu = document.getElementById("sideMenu");
const sideMenuOverlay = document.getElementById("sideMenuOverlay");

function openSideMenu() {
  sideMenu.classList.add("show");
  sideMenuOverlay.classList.add("show");
  hamburgerBtn.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSideMenu() {
  sideMenu.classList.remove("show");
  sideMenuOverlay.classList.remove("show");
  hamburgerBtn.classList.remove("open");
  document.body.style.overflow = "";
}

function toggleSideMenu() {
  if (sideMenu.classList.contains("show")) closeSideMenu();
  else openSideMenu();
}

hamburgerBtn.addEventListener("click", toggleSideMenu);
sideMenuOverlay.addEventListener("click", closeSideMenu);

document.getElementById("menuCekPesanan").addEventListener("click", () => {
  switchPage("antrian");
  closeSideMenu();
});

document.getElementById("menuDaftarProses").addEventListener("click", () => {
  if (!isAdmin) {
    showToast("🔒 Menu ini hanya untuk admin", "error");
    return;
  }
  switchPage("proses");
  closeSideMenu();
});

document.getElementById("menuAdminLogin").addEventListener("click", () => {
  closeSideMenu();
  setTimeout(() => openLoginModal(), 300);
});

/* ============ NAVIGASI ============ */
function switchPage(page) {
  if (page === "proses" && !isAdmin) {
    showToast("🔒 Halaman Proses hanya untuk admin", "error");
    return;
  }

  const pages = ["testimoni", "joki", "antrian", "proses"];
  pages.forEach(p => {
    const pageEl = document.getElementById("page" + p.charAt(0).toUpperCase() + p.slice(1));
    const navEl = document.getElementById("nav" + p.charAt(0).toUpperCase() + p.slice(1));
    if (pageEl) pageEl.classList.remove("active");
    if (navEl) navEl.classList.remove("active");
  });
  const targetPage = document.getElementById("page" + page.charAt(0).toUpperCase() + page.slice(1));
  const targetNav = document.getElementById("nav" + page.charAt(0).toUpperCase() + page.slice(1));
  if (targetPage) targetPage.classList.add("active");
  if (targetNav) targetNav.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSideMenu();
}

document.getElementById("navTestimoni").addEventListener("click", () => switchPage("testimoni"));
document.getElementById("navJoki").addEventListener("click", () => switchPage("joki"));
document.getElementById("ctaLihatAntrian").addEventListener("click", () => switchPage("antrian"));

/* ============ FORM ORDER ============ */
const orderOverlay = document.getElementById("orderModalOverlay");
const paymentOverlay = document.getElementById("paymentModalOverlay");
const orderNama = document.getElementById("orderNama");
const orderWa = document.getElementById("orderWa");
const orderCatatan = document.getElementById("orderCatatan");
const orderTotal = document.getElementById("orderTotal");

function autoFillCatatan() {
  const nama = orderNama.value.trim();
  const wa = orderWa.value.trim();

  let nomorBersih = wa.replace(/[^0-9]/g, "");
  if (nomorBersih.startsWith("0")) {
    nomorBersih = "62" + nomorBersih.slice(1);
  } else if (nomorBersih.startsWith("8")) {
    nomorBersih = "62" + nomorBersih;
  }

  if (!nama && !nomorBersih) {
    orderCatatan.value = "";
    return;
  }

  const teks = `SV ; ${nama || "[Nama Store/JB]"}
Wa.me/${nomorBersih || "[Nomor WhatsApp]"}

#NAMBAH VIEW SW + KONTAK + SELLER + BUYER + DLL 🌟🌈`;

  orderCatatan.value = teks;
}

orderNama.addEventListener("input", autoFillCatatan);
orderWa.addEventListener("input", autoFillCatatan);

document.querySelectorAll("[data-order-paket]").forEach(btn => {
  btn.addEventListener("click", () => {
    currentOrder.paket = btn.dataset.orderPaket;
    currentOrder.harga = parseInt(btn.dataset.orderHarga);

    orderTotal.textContent = formatRupiah(currentOrder.harga);
    orderNama.value = "";
    orderWa.value = "";
    orderCatatan.value = "";

    orderOverlay.classList.add("show");
    setTimeout(() => orderNama.focus(), 150);
  });
});

document.getElementById("btnCancelOrder").addEventListener("click", () => {
  orderOverlay.classList.remove("show");
});
orderOverlay.addEventListener("click", (e) => {
  if (e.target === orderOverlay) orderOverlay.classList.remove("show");
});

document.getElementById("btnConfirmOrder").addEventListener("click", () => {
  const nama = orderNama.value.trim();
  const wa = orderWa.value.trim();
  const catatan = orderCatatan.value.trim();

  if (!nama) { showToast("⚠️ Isi nama dulu ya", "error"); orderNama.focus(); return; }
  if (!wa) { showToast("⚠️ Isi nomor WhatsApp dulu ya", "error"); orderWa.focus(); return; }

  pendingOrderData.nama = nama;
  pendingOrderData.wa = wa;
  pendingOrderData.catatan = catatan;

  document.getElementById("paymentAmount").textContent = formatRupiah(currentOrder.harga);
  document.getElementById("paymentPaket").textContent = currentOrder.paket;
  document.getElementById("paymentNama").textContent = nama;
  document.getElementById("paymentWa").textContent = wa;

  orderOverlay.classList.remove("show");
  paymentOverlay.classList.add("show");
});

document.getElementById("btnBackToOrder").addEventListener("click", () => {
  paymentOverlay.classList.remove("show");
  orderOverlay.classList.add("show");
});

document.getElementById("btnSudahBayar").addEventListener("click", async () => {
  const nama = pendingOrderData.nama;
  const wa = pendingOrderData.wa;
  const catatan = pendingOrderData.catatan;

  if (!nama || !wa) {
    showToast("⚠️ Data pesanan tidak lengkap, ulangi order", "error");
    paymentOverlay.classList.remove("show");
    orderOverlay.classList.add("show");
    return;
  }

  const btn = document.getElementById("btnSudahBayar");
  btn.disabled = true;
  btn.textContent = "⏳ Mengirim...";

  try {
    const maxOrderSnap = await getDocs(collection(db, "orders"));
    const newOrderNum = maxOrderSnap.size + 1;

    await addDoc(collection(db, "orders"), {
      orderNumber: newOrderNum,
      paket: currentOrder.paket,
      harga: currentOrder.harga,
      payment: "qris",
      nama: nama,
      wa: wa,
      catatan: catatan,
      status: "pending",
      createdAt: serverTimestamp()
    });

    /* 🔔 Kirim notifikasi ke Telegram admin */
    notifOrderBaru({
      nama: nama,
      wa: wa,
      catatan: catatan,
      paket: currentOrder.paket,
      harga: currentOrder.harga
    });

    showToast(`✅ Pesanan #${newOrderNum} berhasil! Cek di menu Cek Pesanan 🎉`, "success");

    pendingOrderData = { nama: "", wa: "", catatan: "" };

    paymentOverlay.classList.remove("show");
    switchPage("antrian");

  } catch (err) {
    console.error("Order error:", err);
    showToast("❌ Gagal kirim pesanan: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Sudah Bayar / Konfirmasi";
  }
});

/* ============ POPUP COPY PUSH KONTAK (ADMIN) ============ */
const copyModalOverlay = document.getElementById("copyModalOverlay");
const copyTextarea = document.getElementById("copyTextarea");

function openCopyModal(order) {
  if (!isAdmin) {
    showToast("🔒 Hanya admin yang bisa lihat", "error");
    return;
  }

  const namaStore = extractNamaStore(order.catatan) || order.nama;
  const waBersih = (order.wa || "").replace(/[^0-9]/g, "");
  const waFormat = waBersih.startsWith("0") 
    ? "62" + waBersih.slice(1) 
    : (waBersih.startsWith("62") ? waBersih : "62" + waBersih);

  document.getElementById("copyInfoNama").textContent = namaStore;
  document.getElementById("copyInfoWa").textContent = order.wa || "-";
  document.getElementById("copyInfoPaket").textContent = order.paket || "-";

  const teksPushKontak = `SV ; ${namaStore}
Wa.me/${waFormat}

#NAMBAH VIEW SW + KONTAK + SELLER + BUYER + DLL 🌟🌈`;

  copyTextarea.value = teksPushKontak;

  const btnCopy = document.getElementById("btnCopyText");
  btnCopy.classList.remove("copied");
  btnCopy.innerHTML = "📋 Salin Teks";

  copyModalOverlay.classList.add("show");
}

function closeCopyModal() {
  copyModalOverlay.classList.remove("show");
}

document.getElementById("btnCloseCopy").addEventListener("click", closeCopyModal);
copyModalOverlay.addEventListener("click", (e) => {
  if (e.target === copyModalOverlay) closeCopyModal();
});

document.getElementById("btnCopyText").addEventListener("click", async () => {
  const btnCopy = document.getElementById("btnCopyText");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(copyTextarea.value);
    } else {
      copyTextarea.select();
      document.execCommand("copy");
      window.getSelection().removeAllRanges();
    }

    btnCopy.classList.add("copied");
    btnCopy.innerHTML = "✅ Tersalin!";
    showToast("✅ Teks push kontak berhasil disalin!", "success");

    setTimeout(() => {
      btnCopy.classList.remove("copied");
      btnCopy.innerHTML = "📋 Salin Teks";
    }, 2000);
  } catch (err) {
    console.error("Copy error:", err);
    copyTextarea.select();
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    btnCopy.classList.add("copied");
    btnCopy.innerHTML = "✅ Tersalin!";
    showToast("✅ Teks disalin!", "success");
    setTimeout(() => {
      btnCopy.classList.remove("copied");
      btnCopy.innerHTML = "📋 Salin Teks";
    }, 2000);
  }
});

/* ============ POPUP PROMO TIKTOK ============ */
const promoOverlay = document.getElementById("promoPopupOverlay");
const promoClose = document.getElementById("promoClose");
const promoImage = document.getElementById("promoImage");

function showPromoPopup() {
  setTimeout(() => {
    promoOverlay.classList.add("show");
  }, 800);
}

function closePromoPopup() {
  promoOverlay.classList.remove("show");
}

function goToTikTok() {
  window.open(TIKTOK_URL, "_blank");
  closePromoPopup();
}

promoClose.addEventListener("click", (e) => {
  e.stopPropagation();
  closePromoPopup();
});

promoImage.addEventListener("click", () => {
  goToTikTok();
});

promoOverlay.addEventListener("click", (e) => {
  if (e.target === promoOverlay) closePromoPopup();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && promoOverlay.classList.contains("show")) {
    closePromoPopup();
  }
});

/* ============ LOGIKA DOWNLOAD APK ============ */
document.getElementById('btnDownloadApp').addEventListener('click', () => {
  closeSideMenu(); 
  
  // ==========================================
  // GANTI LINK DI BAWAH INI DENGAN LINK APK ANDA
  // ==========================================
  const LINK_DOWNLOAD_APK = "https://link-download-apk-anda-disini.com/wahyu-store.apk";
  
  // Buka link download
  window.location.href = LINK_DOWNLOAD_APK; 
  
  showToast("⏳ Memulai download aplikasi...", "info");
});

/* ============ EVENT DELEGATION ============ */
document.addEventListener("click", async (e) => {
  /* Tombol Proses */
  const btnProses = e.target.closest("[data-proses]");
  if (btnProses) {
    e.preventDefault();
    e.stopPropagation();

    const id = btnProses.dataset.proses;
    const nama = btnProses.dataset.nama || "pesanan ini";

    if (!isAdmin) {
      showToast("🔒 Hanya admin yang bisa memproses", "error");
      return;
    }

    if (!confirm(`Proses pesanan "${nama}"?\n\nPesanan akan pindah ke Daftar Proses.`)) return;

    btnProses.disabled = true;
    btnProses.textContent = "⏳...";
    await prosesOrder(id);
    return;
  }

  /* Tombol Hapus dari Antrian */
  const btnHapus = e.target.closest("[data-hapus]");
  if (btnHapus) {
    e.preventDefault();
    e.stopPropagation();

    const id = btnHapus.dataset.hapus;
    const nama = btnHapus.dataset.nama || "pesanan ini";

    if (!isAdmin) {
      showToast("🔒 Hanya admin yang bisa hapus", "error");
      return;
    }

    if (!confirm(`⚠️ Hapus permanen pesanan "${nama}"?\n\nData akan hilang dari database.`)) return;

    btnHapus.disabled = true;
    btnHapus.textContent = "⏳";
    await hapusOrder(id, nama);
    return;
  }

  /* Tombol Selesai dari Proses */
  const btnSelesaiProses = e.target.closest("[data-selesai-proses]");
  if (btnSelesaiProses) {
    e.preventDefault();
    e.stopPropagation();

    const id = btnSelesaiProses.dataset.selesaiProses;
    const nama = btnSelesaiProses.dataset.nama || "pesanan ini";

    if (!isAdmin) {
      showToast("🔒 Hanya admin yang bisa menyelesaikan", "error");
      return;
    }

    if (!confirm(`Selesaikan pesanan "${nama}"?\n\n✅ Pesanan akan dihapus dari daftar proses.\n📩 Bot Telegram akan mengirim notifikasi.`)) return;

    btnSelesaiProses.disabled = true;
    btnSelesaiProses.textContent = "⏳...";
    await selesaiOrder(id, nama);
    return;
  }

  /* Klik item di daftar Proses → buka popup copy */
  const itemProses = e.target.closest("[data-copy-order]");
  if (itemProses && !e.target.closest("[data-selesai-proses]") && !e.target.closest("a")) {
    e.preventDefault();
    e.stopPropagation();
    const orderId = itemProses.dataset.copyOrder;
    const order = antrianOrders.find(o => o.id === orderId);
    if (order) openCopyModal(order);
    return;
  }

  /* Reaction */
  const btnReaction = e.target.closest("[data-reaction-item]");
  if (btnReaction) {
    e.preventDefault();
    e.stopPropagation();
    btnReaction.classList.add("pop");
    setTimeout(() => btnReaction.classList.remove("pop"), 300);
    toggleReaction(btnReaction.dataset.reactionItem, btnReaction.dataset.reactionEmoji);
    return;
  }

  const btnLightbox = e.target.closest("[data-lightbox-reaction]");
  if (btnLightbox) {
    e.preventDefault();
    e.stopPropagation();
    btnLightbox.classList.add("pop");
    setTimeout(() => btnLightbox.classList.remove("pop"), 300);
    toggleReaction(btnLightbox.dataset.lightboxItem, btnLightbox.dataset.lightboxReaction);
    return;
  }

  /* Delete testimoni */
  const btnDelete = e.target.closest("[data-delete]");
  if (btnDelete) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Yakin ingin menghapus testimoni #${btnDelete.dataset.order}?`)) {
      deleteTestimonial(btnDelete.dataset.delete);
    }
    return;
  }
});

/* ============ EVENT LISTENERS LAIN ============ */
document.getElementById("btnCancelLogin").addEventListener("click", closeLoginModal);
document.getElementById("btnSubmitLogin").addEventListener("click", doLogin);
adminPassword.addEventListener("keypress", (e) => { if (e.key === "Enter") doLogin(); });
loginModal.addEventListener("click", (e) => { if (e.target === loginModal) closeLoginModal(); });
document.getElementById("btnUpload").addEventListener("click", () => {
  document.getElementById("uploadCard").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("btnLogout").addEventListener("click", () => {
  if (!confirm("Yakin ingin logout?")) return;
  isAdmin = false;
  sessionStorage.removeItem(ADMIN_KEY);
  updateAdminUI();
  showToast("🚪 Logout berhasil", "success");
});

/* ============ INIT ============ */
updateAdminUI();
startRealtimeListener();
startAntrianListener();
showPromoPopup();