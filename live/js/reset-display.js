const bc = new BroadcastChannel('app-reset');
bc.onmessage = (e) => {
    if (e.data === 'RESET') {
        console.log('Menerima sinyal RESET. Me-reload halaman...');
        location.reload();
    }
};