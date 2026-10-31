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

- Pencarian posisi, penyelenggara, deskripsi, program studi, dan lokasi; pencarian beberapa kata menggunakan logika AND, sama seperti HTML awal.
- Filter kategori, provinsi, kota/kabupaten, jenis penyelenggara, jenjang pendidikan, tipe wawancara, kuota minimal, dan ramah disabilitas.
- Lima urutan: urutan portal, skor peluang, kuota, jumlah pelamar, dan nama posisi.
- Filter kota mengikuti provinsi. Filter, kata kunci, urutan, dan halaman tersimpan dalam URL dan dapat dibagikan.
- Pagination 12 lowongan per halaman, halaman detail, salin tautan, dan tautan melamar ke portal resmi.
- Simpan hingga 200 lowongan di localStorage perangkat, tanpa akun. Tab tersimpan tetap mendukung filter dan pencarian.
- Panel filter desktop dan drawer mobile; akses keyboard, label formulir, reduced motion, status hasil, serta kondisi kosong/error.

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

Pengujian membandingkan hasil filter dan urutan terhadap implementasi HTML asli, serta memeriksa bitmask pendidikan/wawancara, pagination, bookmark, validasi URL, dan detail lowongan.

## Struktur

- `src/app/`: halaman eksplorasi, detail lowongan, API, metadata, dan status halaman.
- `src/components/ui/`: primitive shadcn yang diinstal melalui CLI resmi.
- `src/components/`: antarmuka pencarian, filter, kartu, navigasi, dan aksi pengguna.
- `src/app/globals.css`: token tema shadcn dan layout responsif.
- `src/lib/job-types.ts`: kontrak data dan serialisasi filter URL.
- `src/lib/jobs.ts`: parser snapshot, indeks, filter, dan pengurutan server.
- `tests/jobs.test.ts`: pembanding perilaku HTML awal dan pengujian data.

Instalasi mengikuti [dokumentasi Next.js](https://nextjs.org/docs/app/getting-started/installation) dan [shadcn/ui](https://ui.shadcn.com/docs/installation/next).
