# Git secret incident runbook

History rewrite dan rotasi berikut adalah operasi insiden terkoordinasi; jangan menjalankannya dari workstation tanpa backup yang sudah diuji.

1. Bekukan merge. Jalankan gitleaks terhadap seluruh branch dan tag, lalu inventaris setiap secret yang ditemukan tanpa menyalin nilainya ke tiket atau log.
2. Rotasi seluruh secret yang ditemukan atau mungkin identik dengan history: Cloudflare API, auth, cron, FCM, VAPID, R2/D1, provider, serta secret signing/pepper baru.
3. Setelah rotasi, hapus seluruh baris `session` dan `parent_session`. Jika pasangan VAPID berubah, hapus subscription lama agar klien mendaftar ulang.
4. Pastikan backup terenkripsi repository/D1/R2 dapat dipulihkan. Catat commit lama, checksum backup, dan pemegang kunci.
5. Gunakan `git filter-repo` satu kali untuk menghapus path sensitif yang tercatat oleh hasil scan, termasuk history `scratch/` dan arsip aplikasi. Verifikasi ulang seluruh branch/tag dengan gitleaks.
6. Force-push terkoordinasi seluruh branch/tag, minta semua kolaborator menghapus clone lama lalu reclone, dan ajukan purge cached objects ke GitHub Support.
7. Buka kembali merge hanya setelah CI security hijau dan semua secret lama terbukti tidak berlaku.

Rewrite tidak membatalkan clone/fork lama. Karena itu rotasi dan revoke wajib selesai sebelum rewrite.
