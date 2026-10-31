# Hasil implementasi API publik, hybrid search, dan perluasan bidang

31 Oktober 2026. Kode selesai, diverifikasi pada aplikasi lokal dengan Neon dan OpenRouter sungguhan. Katalog Neon sudah aktif. Belum dipublikasikan ke hosting atau diverifikasi dari aplikasi konsumen GPT/Claude/Gemini.

## Hasil

- Website, SSR, detail, API publik, dan adapter `/api/jobs` memakai engine Neon yang sama.
- Keyword memakai PostgreSQL FTS dengan normalisasi dan ranking yang mempertahankan perilaku pencarian sebelumnya. Semantic memakai `pgvector` exact cosine search, lalu hasil digabungkan dengan weighted RRF.
- Model `openai/text-embedding-3-small` melalui OpenRouter, 512 dimensi, versi teks 1. Pilot 512 versus 1.536 dimensi dijalankan sebelum backfill penuh; keduanya mendapatkan 19/20 query evaluasi pada sampel pilot 80 dokumen. Ini bukan bukti kesetaraan umum kedua dimensi.
- API tanpa login: `/api/v1/jobs`, `/api/v1/jobs/{id}`, `/api/v1/facets`; dokumentasi `/api-docs`, `/openapi.json`, `/llms.txt`, dan redirect `/llm.txt`. CORS GET/OPTIONS, validasi, pagination, cache, rate limit, serta metadata fallback tersedia.
- Robots/sitemap tersedia. Sumber dan tanggal snapshot disertakan; data tidak diklaim live. Deskripsi yang tidak tersedia dikembalikan sebagai null.
- Filter bidang menjadi 22 pilihan yang bisa dicari, mencakup IT dan non-IT. Kategori, detail, facets, dan kontrak API diperbarui bersama.

## Backfill dan penyimpanan

Snapshot aktif: `4215bd02dba50724b46df6b5f3720fe265af008c1d2c63c93ab31a1b3e6a8793`.

| Pengukuran | Hasil |
| --- | ---: |
| Lowongan diimpor / memiliki embedding | 27.667 / 27.667 |
| Teks embedding unik | 27.605 |
| Embedding dipakai ulang oleh dokumen identik | 62 |
| Batch | 216; maksimal 128 dokumen, terakhir 85 |
| Durasi backfill penuh | 860 detik |
| Token backfill penuh | 4.654.958 |
| Estimasi biaya backfill | US$0,09309916 |
| Dokumen/token ketika backfill diulang | 0 / 0 |
| Status katalog | ready dan aktif |
| Ukuran database setelah klasifikasi | 282.624.000 byte, sekitar 282,6 MB |
| Tabel embedding beserta index/TOAST | 83.828.736 byte |
| Tabel lowongan beserta index/TOAST | 189.702.144 byte |

Biaya merupakan estimasi berdasarkan token yang dilaporkan provider dan tarif US$0,02/juta token yang digunakan script, bukan invoice. Tidak mencakup pilot, embedding query, pembelian kredit/pajak, atau Neon. Ukuran database sebelum klasifikasi sekitar 209,6 MB; pembaruan payload kategori menambah alokasi tabel PostgreSQL. Angka ini adalah ukuran fisik saat pengukuran, bukan proyeksi billing Neon atau ukuran minimal setelah pemadatan.

Pada preflight, endpoint embedding sempat memberikan HTTP 401 meskipun pemeriksaan key berhasil. Setelah pengguna meminta pengujian ulang, inferensi berhasil; penyebab perubahan tidak dapat dipastikan. Backfill penuh kemudian selesai tanpa kegagalan batch.

Bukti: [backfill](evidence/backfill.log), [uji resume](evidence/backfill-resume.json), [pilot](evidence/embedding-pilot.json), [status Neon](evidence/catalog-status.json).

## Klasifikasi bidang

Kategori disimpulkan dari judul posisi dengan aturan yang mendahulukan domain spesifik. Klasifikasi bukan label resmi penyelenggara, tidak menebak bidang dari perusahaan atau seluruh program studi yang diterima, dan belum dikurasi manual untuk setiap lowongan. `meta.categoryVersion=2` dan `categorySource=inferred_from_position_title` menjelaskan asal label.

24.217 lowongan masuk bidang spesifik; 3.450 tetap dalam Bidang lainnya. Label ambigu dapat diperbaiki dengan memperbarui aturan dan menjalankan `catalog:classify`, tanpa mengubah embedding.

| Bidang | Lowongan |
| --- | ---: |
| Administrasi & Operasional | 3.242 |
| AI & Machine Learning | 49 |
| Bisnis & Manajemen | 942 |
| Data & Analitik | 526 |
| Desain & Media Kreatif | 1.303 |
| Hukum & Kepatuhan | 601 |
| IT Support & Jaringan | 766 |
| Kesehatan & Farmasi | 2.743 |
| Keuangan & Akuntansi | 2.290 |
| Lingkungan & K3 | 500 |
| Logistik & Pengadaan | 917 |
| Pariwisata, Hotel & Kuliner | 347 |
| Pemasaran, Penjualan & Komunikasi | 2.946 |
| Pendidikan & Pelatihan | 297 |
| Pertanian, Peternakan & Perikanan | 212 |
| Produksi & Manufaktur | 924 |
| Pelayanan Publik & Sosial | 440 |
| Riset & Laboratorium | 743 |
| SDM & Rekrutmen | 1.534 |
| Software & Development | 635 |
| Teknik & Konstruksi | 2.260 |
| Bidang lainnya | 3.450 |

Klasifikasi memperbarui kategori terstruktur, payload, facets, dan versi dalam satu transaksi. Pengulangan terakhir mengubah 0 baris; cakupan embedding dan token ledger tidak berubah. [Distribusi](evidence/category-classification.json), [pengulangan](evidence/category-classification-repeat.txt).

## Relevansi dan verifikasi

- Evaluasi katalog penuh memakai 40 query Indonesia-Inggris, dibagi menjadi 20 kalibrasi dan 20 evaluasi dengan penilaian kecocokan judul, serta 3 query negatif. Pada ambang 0,5, hybrid mendapatkan hasil relevan di top 5 untuk 20/20 query evaluasi, keyword 6/20; ketiga query negatif menghasilkan 0 kandidat. Sampel ini terbatas dan bukan jaminan untuk semua query.
- Ambang awal 0,45 gagal pada query negatif; laporan gagal tetap disimpan. Default ditingkatkan menjadi 0,5 setelah kalibrasi. [Laporan awal](evidence/search-evaluation-0-45.json), [hasil akhir](evidence/search-evaluation-0-5.json).
- Pasangan query SQL keyword dan hybrid dalam evaluasi mendapatkan p50 231 ms dan p95 409 ms. Pengukuran tidak mencakup panggilan embedding atau seluruh request HTTP dan bukan SLO produksi. Exact vector search dipertahankan; HNSW belum diperlukan berdasarkan sampel ini.
- 95 unit/regression test lulus, termasuk kategori Indonesia-Inggris, prioritas domain, token AI/IT, C++/C#, filter, bookmark, dan sort. Regresi terhadap HTML awal tetap digunakan untuk perilaku yang dipertahankan; taxonomy lama sengaja diganti.
- 6 pengujian integrasi Neon lulus: kesetaraan keyword/filter termasuk non-IT, filter semantic dan pagination, penolakan aktivasi tidak lengkap, bucket rate limit, format 429/CORS, dan fallback provider. Fixture memakai ID snapshot unik dan dibersihkan; pointer katalog aktif tidak diganti. [Log](evidence/integration-checks.log).
- 23 pemeriksaan HTTP lokal lulus: endpoint publik/detail/facets, kategori non-IT, keyword/hybrid, cache, pagination, lokasi, input salah, null description, CORS, OpenAPI, llms/redirect, sitemap, robots, dan adapter lama. [Hasil](evidence/api-verification.json).
- Typecheck, lint, dan production build lulus. [Build](evidence/build.log).
- Browser desktop dan mobile 390×844 diperiksa: pencarian semantic, detail, filter pendidikan, bookmark, pencarian alias HR → SDM, serta pemilihan kesehatan melalui drawer. Tidak ditemukan horizontal overflow pada halaman yang diperiksa. Bukti gambar berada di `docs/evidence/browser-*.png` dan `fields-*.png`.

## Operasi dan batas penyelesaian

Command setup, import, backfill, klasifikasi, evaluasi, aktivasi, rollback, dan maintenance tersedia di [README](../README.md). Migration SQL berversi dan memeriksa checksum. Model, dimensi, dan versi teks harus konsisten dengan snapshot sebelum aktivasi.

Cache embedding query tersimpan 7 hari. Bucket database membatasi request dan pembuatan embedding query; provider gagal menghasilkan mode keyword dengan alasan fallback. Semua filter diterapkan ke kedua jalur retrieval. Total hybrid adalah union hasil keyword dan maksimal 200 kandidat semantic yang lolos ambang, bukan seluruh kemungkinan kecocokan makna.

Untuk deployment, isi `SITE_URL` dengan origin HTTPS produksi dan sediakan environment server. Identitas client memerlukan proxy tepercaya; tanpa itu request memakai bucket bersama. Deployment, pengujian trafik/cold start produksi, sinkronisasi live Kemnaker, serta konfigurasi tool di aplikasi GPT/Claude/Gemini belum dilakukan. `llms.txt` menyediakan panduan; setiap platform tetap menentukan cara mengakses API.
