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

Salin `.env.example` menjadi `.env` pada checkout baru, lalu isi `DATABASE_URL` Neon dan `OPENROUTER_API_KEY`. Kredensial hanya digunakan server. Set `SITE_URL` ke domain HTTPS produksi agar tautan canonical, sitemap, dan dokumentasi API benar. Jangan memakai prefix `NEXT_PUBLIC_` untuk secret.

Siapkan katalog sebelum membuka aplikasi:

```sh
npm run db:migrate
npm run catalog:import -- --dry-run
npm run catalog:import -- --batch-size=250
npm run catalog:pilot
npm run catalog:backfill -- --batch-size=128
npm run catalog:evaluate
npm run catalog:activate
npm run catalog:status
```

Migration memasang `pgvector` dan tabel berprefix `mh_`. Import menyimpan snapshot pending; aktivasi ditolak sampai seluruh lowongan dan embedding lengkap. Import dan backfill dapat dijalankan ulang: data yang sudah tersimpan tidak diproses ulang. Backfill berjalan satu batch pada satu waktu dan mencatat token serta perkiraan biaya. Tidak perlu mengunduh model atau menjalankan PostgreSQL di laptop.

## Fitur

- Hybrid search: PostgreSQL full-text search untuk kata kunci dan `pgvector` untuk kemiripan makna, dengan embedding `openai/text-embedding-3-small` melalui OpenRouter, 512 dimensi. Keyword tetap memakai token utuh AND dan normalisasi frontend/front-end/front end; C++ dan C# dibedakan. Mode hybrid dapat menemukan lowongan melalui sinonim dan parafrasa.
- Filter bidang dengan 22 pilihan yang dapat dicari, mencakup IT dan non-IT: kesehatan, keuangan, hukum, SDM, pendidikan, pertanian, teknik, dan lainnya. Alias seperti HR, finance, atau legal dapat dicari dalam pilihan bidang.
- Filter provinsi, kota/kabupaten, jenis penyelenggara, jenjang pendidikan, tipe wawancara, kuota minimal, dan ramah disabilitas.
- Judul persis diprioritaskan, kemudian ranking keyword dan semantic digabungkan dengan RRF. Tanpa kata kunci, urutan portal dipertahankan. Urutan portal, skor peluang, kuota, jumlah pelamar, dan nama posisi tetap dapat dipilih secara eksplisit.
- Filter kota mengikuti provinsi. Filter, kata kunci, urutan, dan halaman tersimpan dalam URL dan dapat dibagikan.
- Pagination 12 lowongan per halaman, halaman detail, salin tautan, dan tautan melamar ke portal resmi.
- Simpan hingga 200 lowongan di localStorage perangkat, tanpa akun. Tab tersimpan tetap mendukung filter dan pencarian.
- Panel filter desktop sticky dengan scroll tersendiri dan drawer mobile. Kriteria tambahan berada di "Filter lainnya" dan terbuka otomatis jika ada filter lanjutan aktif. Reset filter mempertahankan kata kunci. Hasil lama diganti skeleton ketika pencarian baru belum selesai.
- Tombol **Copy for agent** pada hero menyalin prompt untuk ditempel ke ChatGPT, Claude, atau Gemini. Prompt memakai origin situs yang sedang dibuka, mengarahkan AI membaca `/llms.txt` dan API, serta menyediakan placeholder pertanyaan. Teks tombol tetap; ikon copy menjadi centang saat berhasil. Jika clipboard ditolak, prompt tersedia untuk disalin manual.

## Data

`data-1.js` sampai `data-4.js` adalah sumber data asli: **27.667 lowongan, 38 provinsi, 460 kota/kabupaten**. Parser server membaca bagian JSON tanpa mengeksekusi JavaScript. Berkas tersebut dipertahankan, beserta `index.html` dan `app.js` versi awal.

Importer menggunakan parser snapshot bersama `src/lib/snapshot.ts`. `src/lib/jobs.ts` mempertahankan implementasi keyword snapshot sebagai referensi regresi dan sumber importer. Website, SSR, halaman detail, dan API membaca snapshot aktif dari Neon melalui layanan yang sama. Berkas data sumber tidak diperlukan pada runtime deployment setelah import. Keseluruhan snapshot tidak dikirim ke browser.

Snapshot diunduh **31 Oktober 2026**. Batas pelamaran yang tercantum dalam snapshot adalah **4 November 2026**. Aplikasi ini bukan situs resmi atau data live. Kuota, pelamar, dan ketersediaan perlu diperiksa kembali di [MagangHub Kemnaker](https://maganghub.kemnaker.go.id/). Tipe wawancara daring tidak berarti magang WFH. Deskripsi yang berupa referensi tidak terselesaikan dalam snapshot ditampilkan sebagai tidak tersedia.

Untuk memperbarui data dengan format yang sama, ganti keempat berkas data, sesuaikan tanggal snapshot di konfigurasi/UI/metadata, lalu jalankan import, backfill, evaluasi, dan aktivasi. Snapshot ID diturunkan dari hash berkas serta konfigurasi embedding. Embedding dokumen yang teksnya sama dipakai kembali. Perubahan kuota/pelamar tidak memicu embedding baru. Jangan mengubah model/dimensi/format teks tanpa migration dan pembaruan versi teks yang sesuai.

Rollback memakai `npm run catalog:activate -- --snapshot=ID_LAMA`. Snapshot lama tidak dihapus otomatis. Jalankan `npm run catalog:maintenance` secara berkala untuk membersihkan cache query kedaluwarsa dan bucket request lama. Command tidak menghapus katalog.

Bidang disimpulkan dari **judul posisi**, bukan nama perusahaan, program studi, atau klasifikasi resmi penyelenggara. Aturan di `src/lib/job-categories.ts` mendahulukan bidang spesifik dan menyimpan posisi yang belum dikenali dalam `lain`. Metadata API menyertakan `categoryVersion` dan `categorySource`. Klasifikasi ini tetap perlu ditinjau jika judul ambigu.

Untuk memperbarui kategori pada snapshot yang sudah diimpor, jalankan `npm run db:migrate`, `npm run catalog:classify -- --dry-run`, lalu `npm run catalog:classify`. Command memperbarui kategori, payload, dan facets secara atomik; embedding tidak berubah dan tidak ada panggilan OpenRouter. Sumber lokal harus sama dengan snapshot tersebut. Import baru langsung memakai kategori terbaru.

## API publik dan AI

- `GET /api/v1/jobs`: `q`, `mode=hybrid|keyword`, `category`, `province`, `city`, `organizationType`, `education`, `interview`, `minQuota`, `disability`, `sort`, `page`, `limit`.
- `GET /api/v1/jobs/{id}`: detail lowongan dan tautan sumber resmi.
- `GET /api/v1/facets`: nilai filter; identifier lokasi publik berupa slug, sedangkan adapter `/api/jobs` mempertahankan parameter URL UI lama.
- `/api-docs`, `/openapi.json`, dan `/llms.txt`: panduan manusia, kontrak API, dan panduan untuk AI. `/llm.txt` melakukan redirect.
- `/robots.txt` dan `/sitemap.xml`: halaman publik dan detail dari snapshot aktif.

Contoh: `/api/v1/jobs?q=mengolah%20data&education=sarjana&mode=hybrid&limit=12`. API tanpa login dan mendukung CORS GET/OPTIONS. Parameter salah menghasilkan 400, detail hilang 404, rate limit 429 dengan `Retry-After`, dan katalog/database tidak tersedia 503.

`meta` selalu menyatakan tanggal snapshot, sumber, `isLive=false`, dan mode yang benar-benar digunakan. Jika provider gagal, mode keyword beserta `fallbackReason` dikembalikan. Query kosong atau hanya tanda baca tidak membuat embedding. Deskripsi yang tidak tersedia adalah `null` pada detail API. Skor peluang dipisahkan sebagai `opportunityScore`; skor relevansi bukan probabilitas.

Dalam mode hybrid, `total` menghitung union seluruh kecocokan keyword dan maksimal 200 kandidat semantic yang melewati threshold. Semua filter diterapkan sebelum retrieval. Sort dan pagination diterapkan setelah deduplikasi, dengan tie-break stabil. `totalScope` menjelaskan bahwa ini bukan hitungan seluruh kemungkinan kecocokan semantic.

Cache embedding query tersimpan di Neon selama 7 hari dengan batas sekitar 10.000 entry. Pembatasan request memakai bucket atomik di Neon: 60 request/menit/client, 10 embedding query baru/menit/client, dan default 10.000 embedding query baru/hari bersama. `EMBEDDING_DAILY_LIMIT` mengatur batas harian; `SEMANTIC_MIN_SIMILARITY` mengatur ambang cosine yang harus dievaluasi ulang bila diubah.

Di Vercel, identitas client memakai header proxy platform. Pada host lain, aktifkan `TRUST_PROXY=true` hanya jika reverse proxy mengganti header forwarding dari pengunjung. Tanpa proxy tepercaya, client menggunakan bucket bersama. `RATE_LIMIT_SALT` dapat diisi untuk hashing identitas; default menggunakan secret koneksi server. Cache query menyimpan hash dan vektor, tanpa teks query. Kode layanan tidak mencetak secret atau IP mentah; log akses framework/hosting mengikuti konfigurasi lingkungan.

`llms.txt` membantu AI membaca dokumentasi. Penggunaan otomatis oleh aplikasi AI tetap bergantung pada kemampuan fetch/tool dan konfigurasi platform tersebut. Data tetap snapshot; informasi ketersediaan dan pelamaran harus dikonfirmasi pada portal resmi.

## Validasi

```sh
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Pengujian snapshot membandingkan filter dan urutan eksplisit terhadap HTML asli. Pengujian integrasi Neon membandingkan SQL keyword terhadap snapshot serta menguji filter semantic/pagination dengan vektor fixture terkontrol, penolakan aktivasi katalog belum lengkap, rate limit, dan fallback. Fixture memakai snapshot ID unik dan dibersihkan setelah pengujian; tidak mengganti pointer katalog aktif. `catalog:evaluate` mengukur relevansi 40 query Indonesia-Inggris serta query negatif pada katalog penuh dan menulis laporan ke `docs/evidence/`.

## Struktur

- `src/app/`: halaman eksplorasi, detail lowongan, API, metadata, dan status halaman.
- `src/components/ui/`: primitive shadcn yang diinstal melalui CLI resmi.
- `src/components/`: antarmuka pencarian, filter, kartu, navigasi, dan aksi pengguna.
- `src/app/globals.css`: token tema shadcn dan layout responsif.
- `src/lib/job-types.ts`: kontrak data dan serialisasi filter URL.
- `src/lib/jobs.ts`: parser snapshot, indeks, filter, dan pengurutan server.
- `src/lib/job-search.ts`: normalisasi token dan peringkat relevansi pencarian.
- `src/lib/server/`: repository Neon, engine hybrid, OpenRouter, cache, limits, dan kontrak API publik.
- `migrations/`: schema SQL berversi beserta checksum yang diverifikasi saat migration diulang.
- `scripts/`: migration, import, pilot, backfill, evaluasi, aktivasi, status, dan maintenance.
- `tests/jobs.test.ts`: pembanding perilaku HTML awal dan pengujian data.

Instalasi mengikuti [dokumentasi Next.js](https://nextjs.org/docs/app/getting-started/installation) dan [shadcn/ui](https://ui.shadcn.com/docs/installation/next).
