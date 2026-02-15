const bc = new BroadcastChannel('app-reset');

document.getElementById('clearAll').onclick = async () => {
    console.log('Memulai proses pembersihan data...');

    // 1. Hapus localStorage dan sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    console.log('LocalStorage dan SessionStorage telah dihapus.');

    // 2. Hapus semua database IndexedDB
    if ('indexedDB' in window) {
        try {
            // Dapatkan daftar semua nama database
            const databaseNames = await indexedDB.databases();
            const deletePromises = databaseNames.map(db => {
                console.log(`Menghapus IndexedDB: ${db.name}`);
                return indexedDB.deleteDatabase(db.name);
            });

            // Tunggu hingga semua database selesai dihapus
            await Promise.all(deletePromises);
            console.log('Semua IndexedDB telah dihapus.');

        } catch (error) {
            console.error('Gagal menghapus IndexedDB:', error);
        }
    }

    // 3. Kirim pesan ke halaman lain untuk me-reload
    console.log('Mengirim sinyal RESET ke tab lain...');
    bc.postMessage('RESET');

    // Opsional: Beri tahu pengguna di halaman ini juga
    // alert('Semua data telah dihapus. Halaman akan dimuat ulang.');
    location.reload();
};