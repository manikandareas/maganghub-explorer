# Deployment incremental ingestion

Versi ini membutuhkan migration `004_incremental_ingest.sql`. Migration menambah kolom dan tabel tanpa menghapus/mengganti field lama. Jalankan migration **sebelum** mengalihkan trafik ke aplikasi baru. Aplikasi sebelumnya tetap dapat membaca katalog setelah migration. Jangan menjalankan DDL pada setiap request atau menaruh migration di handler ingest.

## Urutan rilis

1. Pasang environment server production: `DATABASE_URL`, `OPENROUTER_API_KEY`, `INGEST_API_KEY` acak minimal 32 karakter, dan `SITE_URL` berupa origin HTTPS production. Kredensial tetap server-only. Environment `.env` lokal tidak otomatis menjadi environment hosting. Pastikan katalog awal sudah ready/aktif.
2. Dari environment rilis yang memiliki koneksi database production, jalankan `npm ci`, lalu `npm run db:migrate`. Checksum migration diverifikasi; jangan mengubah migration yang sudah diterapkan. Jika migration gagal, hentikan rilis aplikasi baru. Migration additive dapat tetap disimpan jika rilis aplikasi dibatalkan.
3. Jalankan `npm test`, `npm run typecheck`, `npm run lint`, dan `npm run build`. `npm run test:integration` membutuhkan koneksi Neon dan membuat fixture terisolasi; salah satu test memakai embedding provider asli bila key tersedia. Gunakan environment validasi yang diotorisasi. Fixture dibersihkan dan pointer katalog publik tidak dipindahkan.
4. Deploy hasil build dengan Node.js yang memenuhi versi Next.js terpasang (minimal 20.9); validasi rilis ini juga memakai Node.js 22. Pastikan hosting mendukung route Node.js dengan budget `maxDuration=120` detik dan payload 2 MiB. Jika batas hosting lebih kecil, sesuaikan batch bot sebelum mengaktifkan pengiriman; timeout bot disarankan 150 detik.
5. Smoke test deployment: GET `/api/v1/jobs?mode=keyword&limit=1`, detail salah satu ID, dan `/api/v1/facets` harus 200, memiliki metadata lama beserta tambahan metadata ingest, dan memakai `Cache-Control: private, no-store`. POST ingest tanpa bearer harus 401. POST bearer benar dengan body `{}` harus 400 `INVALID_INGEST`; ini tidak menulis lowongan. Jangan memakai lowongan fiktif pada katalog production.
6. Aktifkan bot dengan endpoint production dan secret yang sama. Kirim satu batch kecil berisi data sumber yang benar, periksa `ready=true`, lalu periksa detail/keyword/hybrid/facets untuk data tersebut. Perhatikan `runId`, hitungan inserted/updated/unchanged/stale, revision, serta kegagalan provider. Setelah itu lanjutkan jadwal 30 menit.

API GET publik tetap tanpa autentikasi. Field response lama dipertahankan; metadata ingest dan `observedAt` ditambahkan. Respons GET tidak lagi di-cache bersama agar request sesudah commit membaca pembaruan. Browser yang sudah terbuka perlu memuat ulang data. Perubahan ini dapat meningkatkan jumlah query database dibanding versi yang memakai cache CDN.

## Rollback

Hentikan pengiriman bot selama rollback aplikasi. Kembalikan build sebelumnya dan biarkan migration additive tetap terpasang; jangan menghapus kolom/tabel pada database yang masih dipakai. Rank A–Z tetap disimpan dengan aturan importer agar pembaca versi sebelumnya dapat memakai `az_order`.

Rollback aplikasi tidak mengembalikan isi katalog sebelum ingest. `snapshotId` mengidentifikasi katalog dasar dan `revision` menyatakan perubahannya. Untuk pemulihan data, gunakan snapshot lain yang diketahui lengkap atau mekanisme restore database. Jangan menjalankan klasifikasi dari berkas snapshot lokal terhadap katalog yang sudah menerima pembaruan bot.
