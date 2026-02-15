/**
 * Fungsi untuk menyamakan lebar semua box dengan class 'min-width'
 * di dalam sebuah container tertentu.
 * @param {HTMLElement} container - Elemen induk tempat box-box berada.
 */
function equalizeBoxWidths(container) {
    // 1. Pilih semua elemen div dengan class 'min-width' di dalam container
    const boxes = container.querySelectorAll('.autowidth');

    // 2. Cek apakah ada box yang ditemukan
    if (boxes.length > 0) {
        let maxWidth = 0; // Variabel untuk menyimpan lebar terbesar

        // 3. Looping melalui semua box untuk menemukan lebar maksimum
        boxes.forEach(box => {
            // Reset width ke 'auto' terlebih dahulu untuk mendapatkan lebar alami
            box.style.width = 'auto'; 
            const currentWidth = box.offsetWidth;
            
            // Jika lebar saat ini lebih besar dari maxWidth, update maxWidth
            if (currentWidth > maxWidth) {
                maxWidth = currentWidth;
            }
        });

        // 4. Terapkan lebar maksimum ke semua box
        boxes.forEach(box => {
            box.style.width = maxWidth + 'px';
        });

        // (Opsional) Tampilkan lebar yang disamakan di konsol untuk debugging
        console.log(`Lebar maksimum ditemukan: ${maxWidth}px. ${boxes.length} box telah disamakan.`);
    }
}

// --- EKSEKUSI UTAMA ---

// 1. Jalankan fungsi saat halaman pertama kali dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Tentukan container utama yang akan diamati. Biasanya ini adalah elemen
    // yang isinya berubah saat AJAX dipanggil.
    const mainContentArea = document.body; // atau selector yang lebih spesifik, misal: '#content-container'

    // Jalankan pertama kali untuk konten yang sudah ada
    equalizeBoxWidths(mainContentArea);

    // 2. Siapkan MutationObserver untuk mengamati perubahan
    const observer = new MutationObserver(function(mutations) {
        // Mutasi adalah array dari semua perubahan yang terjadi
        mutations.forEach(function(mutation) {
            // Jalankan fungsi equalizeBoxWidths setiap kali ada node baru ditambahkan
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                equalizeBoxWidths(mainContentArea);
            }
        });
    });

    // 3. Mulai mengamati container yang sudah ditentukan
    observer.observe(mainContentArea, {
        childList: true,  // Amati penambahan/penghapusan elemen anak
        subtree: true     // Amati juga semua turunan dari container (sangat penting!)
    });
});