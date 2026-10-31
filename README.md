# MagangHub Explorer

Aplikasi Next.js untuk menjelajahi snapshot Program Magang Nasional Batch 3, Angkatan II 2026. Menggunakan React, TypeScript, Tailwind CSS v4, serta tema **shadcn/ui Nova Neutral** dan primitive Radix.

## Menjalankan

Memerlukan Node.js 20.9+ dan npm.

```sh
npm ci
npm run dev
```

Buka http://localhost:3000. Untuk produksi:

```sh
npm run build
npm start
```

Tidak memerlukan database, API key, atau environment variable.

## Fitur

- Pencarian kata utuh pada posisi, penyelenggara, deskripsi, program studi, dan lokasi dengan logika AND. Singkatan seperti AI/IT/UI tidak cocok dengan potongan kata lain. Penulisan frontend/front-end/front end dinormalisasi.
- Filter kategori, provinsi, kota/kabupaten, jenis penyelenggara, jenjang pendidikan, tipe wawancara, kuota minimal, dan ramah disabilitas.
- Urutan awal pencarian berdasarkan relevansi: judul persis, frasa pada judul, semua kata pada judul, kemudian kecocokan di bagian lain. Tanpa kata kunci, urutan portal dipertahankan. Urutan portal, skor peluang, kuota, jumlah pelamar, dan nama posisi tetap dapat dipilih secara eksplisit.
- Filter kota mengikuti provinsi. Filter, kata kunci, urutan, dan halaman tersimpan dalam URL dan dapat dibagikan.
- Pagination 12 lowongan per halaman, halaman detail, salin tautan, dan tautan melamar ke portal resmi.
- Simpan hingga 200 lowongan di localStorage perangkat, tanpa akun. Tab tersimpan tetap mendukung filter dan pencarian.
- Panel filter desktop sticky dengan scroll tersendiri dan drawer mobile. Kriteria tambahan berada di "Filter lainnya" dan terbuka otomatis jika ada filter lanjutan aktif. Reset filter mempertahankan kata kunci. Hasil lama diganti skeleton ketika pencarian baru belum selesai.

## Data

`data-1.js` sampai `data-4.js` adalah sumber data asli: **27.667 lowongan, 38 provinsi, 460 kota/kabupaten**. Parser server membaca bagian JSON tanpa mengeksekusi JavaScript. Berkas tersebut dipertahankan, beserta `index.html` dan `app.js` versi awal.

`src/lib/jobs.ts` membuat indeks pencarian sekali per proses server. `/api/jobs` mengirimkan satu halaman hasil; keseluruhan snapshot sekitar 16 MB tidak dikirim ke browser. Konfigurasi output tracing menyertakan berkas snapshot dalam deployment Next.js. Jika menjalankan hasil build secara manual, pertahankan keempat berkas data di root direktori kerja.

Snapshot diunduh **31 Oktober 2026**. Batas pelamaran yang tercantum dalam snapshot adalah **4 November 2026**. Aplikasi ini bukan situs resmi atau data live. Kuota, pelamar, dan ketersediaan perlu diperiksa kembali di [MagangHub Kemnaker](https://maganghub.kemnaker.go.id/). Tipe wawancara daring tidak berarti magang WFH. Deskripsi yang berupa referensi tidak terselesaikan dalam snapshot ditampilkan sebagai tidak tersedia.

Untuk memperbarui data dengan format yang sama, ganti keempat berkas data dan restart server; sesuaikan keterangan tanggal snapshot di UI dan metadata.

## Validasi

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Pengujian membandingkan filter terstruktur dan urutan eksplisit terhadap HTML asli. Pencarian mempunyai regresi tersendiri untuk kasus AI Engineer, batas token, normalisasi, relevansi judul, field lain, dan kombinasi filter; perilaku substring HTML lama sengaja diganti. Pengujian juga mencakup bitmask pendidikan/wawancara, pagination, bookmark, validasi URL, dan detail lowongan.

## Struktur

- `src/app/`: halaman eksplorasi, detail lowongan, API, metadata, dan status halaman.
- `src/components/ui/`: primitive shadcn yang diinstal melalui CLI resmi.
- `src/components/`: antarmuka pencarian, filter, kartu, navigasi, dan aksi pengguna.
- `src/app/globals.css`: token tema shadcn dan layout responsif.
- `src/lib/job-types.ts`: kontrak data dan serialisasi filter URL.
- `src/lib/jobs.ts`: parser snapshot, indeks, filter, dan pengurutan server.
- `src/lib/job-search.ts`: normalisasi token dan peringkat relevansi pencarian.
- `tests/jobs.test.ts`: pembanding perilaku HTML awal dan pengujian data.

Instalasi mengikuti [dokumentasi Next.js](https://nextjs.org/docs/app/getting-started/installation) dan [shadcn/ui](https://ui.shadcn.com/docs/installation/next).
