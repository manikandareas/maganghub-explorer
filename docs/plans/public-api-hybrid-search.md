# Rencana final: API publik dan hybrid search

Tanggal: 31 Oktober 2026. Status: sudah diimplementasikan dan diverifikasi secara lokal dengan Neon; seluruh 27.667 lowongan selesai di-backfill dan katalog aktif. Lihat [laporan implementasi](../implementation-report.md) untuk hasil, biaya, perluasan kategori, dan batas verifikasi. Bagian preflight dan estimasi di bawah dipertahankan sebagai catatan sebelum implementasi.

## Hasil yang dituju

Website dan konsumen eksternal menggunakan satu layanan pencarian berbasis Neon PostgreSQL. Pencarian menggabungkan kecocokan kata dengan kemiripan makna. API publik, dokumentasi OpenAPI, dan `/llms.txt` menjelaskan cara menggunakan data beserta tanggal snapshot dan keterbatasannya.

## Preflight sebelum implementasi

- `.env` menyediakan `DATABASE_URL` dan `OPENROUTER_API_KEY`; nilainya tidak disalin ke dokumen.
- Koneksi PostgreSQL berhasil, versi 18.6. Transaksi inspeksi menggunakan `transaction_read_only=on` dan hanya membaca metadata.
- Tidak terlihat tabel aplikasi pada database yang diakses. Ukuran database awal sekitar 7,7 MB.
- Extension `vector` 0.8.6 dan `pg_trgm` 1.6 tersedia, tetapi belum terpasang. Role koneksi memiliki izin membuat objek pada schema `public`; pemasangan extension belum dicoba.
- Pemeriksaan autentikasi OpenRouter mengembalikan HTTP 200. Ini belum membuktikan saldo mencukupi atau inferensi model berhasil.
- Snapshot berisi 27.667 ID unik; 2.343 deskripsi berisi referensi yang belum terselesaikan.
- Audit sebelumnya menjalankan 41 tes yang semuanya lulus. Tes belum dijalankan ulang untuk perubahan dokumentasi ini.

## Keputusan teknis

| Bagian | Pilihan |
| --- | --- |
| Database | Neon PostgreSQL melalui `DATABASE_URL` |
| Akses database aplikasi | `@neondatabase/serverless`, query SQL berparameter, migration SQL berversi |
| Embedding | `openai/text-embedding-3-small` melalui OpenRouter |
| Dimensi awal | 512; lolos uji relevansi sebelum backfill penuh |
| Keyword | PostgreSQL full-text search, konfigurasi `simple`, bobot judul dan field |
| Semantic | `pgvector`, cosine distance |
| Penggabungan peringkat | Weighted Reciprocal Rank Fusion, dengan prioritas judul persis |
| Cache dan pembatasan lintas instance | Tabel internal Neon dengan TTL dan ukuran terbatas |

OpenAI Docs menjelaskan bahwa model ini memiliki 1.536 dimensi secara default dan menyediakan parameter `dimensions` untuk memperkecil output. OpenRouter mendokumentasikan parameter tersebut pada endpoint embedding. Pemilihan 512 adalah keputusan efisiensi proyek, bukan klaim bahwa kualitasnya setara pada dataset ini. Bandingkan 512 dengan 1.536 pada pilot, lalu kunci dimensi sebelum backfill. [OpenAI Docs](https://developers.openai.com/api/docs/guides/embeddings#how-to-get-embeddings), [OpenRouter embeddings API](https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request)

## 1. Schema, import, dan pembaruan data

- Buat migration untuk extension `vector`, tabel versi snapshot, lowongan, pilihan filter, cache embedding query, dan bucket pembatasan request.
- Simpan ID sumber, urutan portal, field lowongan, bitmask pendidikan/wawancara, kode lokasi asal, dan URL resmi. Pilihan lokasi publik mendapat identifier yang stabil; adapter UI mempertahankan URL filter yang sudah ada.
- Simpan metadata tanggal snapshot, tanggal import, hash sumber, status import, serta versi teks embedding.
- Pisahkan parser snapshot dari repository database. Berkas sumber dibaca sebagai JSON tanpa mengeksekusi JavaScript.
- Import harus memiliki dry-run, idempotensi, validasi ID/count/relasi, dan ringkasan hasil. Snapshot baru disiapkan sebagai versi terpisah; aktifkan setelah data dan embedding lengkap sehingga katalog setengah selesai tidak menjadi hasil publik.
- Referensi deskripsi yang belum terselesaikan menjadi deskripsi tidak tersedia. Jangan memasukkan kode referensi itu ke FTS atau embedding.
- Pembaruan snapshot dilakukan melalui command; versi sebelumnya dipertahankan sementara untuk rollback. Pembersihan versi lama harus eksplisit.

## 2. Pipeline embedding

- Bentuk satu teks per lowongan: judul, penyelenggara, lokasi, program studi, dan deskripsi yang tersedia. Kuota/jumlah pelamar tetap menjadi data terstruktur dan tidak memicu embedding ulang ketika berubah.
- Simpan model, dimensi, versi format teks, dan hash teks bersama embedding. Jangan mencampur hasil model/dimensi berbeda.
- Jalankan pilot kecil, verifikasi respons OpenRouter dan relevansi Indonesia-Inggris, kemudian backfill seluruh lowongan dalam batch terbatas.
- Validasi jumlah output, urutan/index, panjang vektor, dan nilai numeriknya. Simpan progress sehingga proses dapat dilanjutkan setelah gagal.
- Lakukan panggilan provider di luar transaksi database. Sebelum menyimpan hasil, periksa hash teks agar embedding lama tidak menimpa revisi baru.
- Retry terbatas untuk timeout/rate limit; hentikan atau laporkan kegagalan autentikasi/saldo. Cetak progress, token terpakai, biaya perkiraan, dan jumlah berhasil/gagal tanpa menampilkan secret.
- Embedding dokumen dibuat pada proses import/update, bukan setiap pencarian pengguna.

## 3. Perilaku hybrid search

1. Validasi input dan terapkan filter terstruktur yang sama pada kedua jalur retrieval.
2. Jalankan keyword search dengan bobot judul, penyelenggara, lokasi, program studi, dan deskripsi. Pertahankan whole-token AND, normalisasi frontend/backend/fullstack, serta perbedaan C++ dan C#; jangan bergantung pada tokenisasi default SQL untuk kasus ini.
3. Ambil embedding query dari cache atau OpenRouter. Query kosong atau hanya tanda baca tidak memanggil provider.
4. Ambil maksimal 200 kandidat semantic setelah filter dan batas relevansi yang dikalibrasi. Awali dengan exact vector search; tambahkan HNSW hanya bila benchmark memerlukannya, lalu uji recall filter terhadap hasil exact.
5. Gabungkan seluruh kecocokan keyword dengan kandidat semantic menggunakan RRF. Tambahkan prioritas judul persis dan tie-break berdasarkan urutan portal/ID.
6. Terapkan sort pilihan pengguna dan pagination pada himpunan hasil yang sudah digabungkan, bukan sebelum penggabungan.

Mode publik: `mode=hybrid` sebagai default untuk query, dan `mode=keyword` untuk pencarian deterministik tanpa provider. Tanpa query, kembalikan katalog terfilter dengan urutan portal atau sort eksplisit.

`total` pada mode hybrid menghitung union hasil keyword dan kandidat semantic yang diterima, bukan seluruh tetangga vektor dalam database. Respons menyertakan `totalScope`, batas kandidat semantic, dan identitas snapshot. Urutan harus stabil untuk query/filter/snapshot yang sama. Skor peluang yang sudah ada tetap terpisah dari skor relevansi pencarian.

Jika provider semantic timeout, limit habis, atau kredit tidak tersedia, kembalikan hasil keyword dengan metadata fallback. Jika database gagal, kembalikan error layanan yang jelas. Jangan menyatakan hasil fallback sebagai hasil hybrid penuh.

## 4. API publik

| Route | Hasil |
| --- | --- |
| `GET /api/v1/jobs` | Pencarian hybrid/keyword, filter, sort, pagination |
| `GET /api/v1/jobs/{id}` | Detail lowongan, deskripsi yang tersedia, tautan detail dan sumber resmi |
| `GET /api/v1/facets` | Nilai filter yang valid dan hubungan kota-provinsi |
| `GET /openapi.json` | Kontrak endpoint, parameter, respons, dan error |

- Endpoint data dapat digunakan tanpa login. Kredensial provider/database hanya digunakan pada server.
- Parameter publik mencakup `q`, `mode`, kategori, provinsi/kota dari facets, jenis penyelenggara, pendidikan, wawancara, kuota minimal, disabilitas, sort, page, dan limit.
- Batas awal: query 250 karakter, default 12 hasil per halaman, maksimal 50 hasil. Parameter salah menghasilkan error 400 yang menjelaskan field terkait.
- Metadata menyertakan tanggal snapshot, `isLive=false`, sumber resmi, mode yang benar-benar digunakan, dan cakupan total. Skor ranking tidak dinyatakan sebagai probabilitas kecocokan.
- Sediakan CORS untuk GET/OPTIONS tanpa kredensial browser; respons 404, 429 dengan `Retry-After`, dan 503 terdokumentasi.
- Rate limit awal 60 request/menit per client yang identitasnya berasal dari proxy tepercaya; batasi juga pembuatan embedding baru, concurrency provider, dan kuota global harian. SSR harus melewati guard provider yang sama.
- Gunakan rate-limit bucket atomik di database, bukan hanya memori satu proses. Cache embedding query selama maksimal 7 hari, maksimal 10.000 entry, dengan key model/dimensi/hash teks. Expired cache dan bucket dibersihkan secara terbatas oleh proses maintenance.
- Cache hasil publik mengikuti versi snapshot. Request bookmark/daftar ID milik UI tidak masuk shared cache.
- API tidak menyediakan operasi perubahan lowongan. Cache dan penghitung pembatasan adalah data operasional internal.

## 5. Integrasi website dan akses AI

- Homepage SSR, fetch client, halaman detail, dan metadata memakai repository/search service yang sama. Pertahankan route `/api/jobs` sebagai adapter kompatibilitas bagi UI saat ini.
- Pertahankan bookmark lokal, filter URL, sort eksplisit, pagination, dan hubungan kota-provinsi. Sesuaikan petunjuk pencarian agar pengguna tahu dapat mencari berdasarkan minat/keahlian dengan bahasa biasa.
- Tambahkan `/api-docs` berisi panduan dan contoh request/response; `/llms.txt` merujuk ke panduan, OpenAPI, dan batasan data. `/llm.txt` diarahkan ke `/llms.txt`.
- Tambahkan robots dan sitemap untuk halaman yang dapat diakses publik. Gunakan `SITE_URL` sebagai origin canonical saat deployment.
- Panduan AI menyebut bahwa aplikasi adalah explorer snapshot, bukan portal resmi atau data live; wawancara daring tidak berarti pekerjaan remote/WFH; informasi/deskripsi yang tidak tersedia tidak boleh dikarang.
- `/llms.txt` membantu konsumsi dokumentasi; integrasi otomatis pada setiap aplikasi GPT/Claude/Gemini tetap bergantung pada platform dan tidak menjadi klaim hasil implementasi. [Konvensi llms.txt](https://llmstxt.org/)

## 6. Verifikasi dan kriteria selesai

- Import menghasilkan 27.667 ID unik dengan lokasi, pendidikan, wawancara, urutan portal, dan tautan sumber yang konsisten; seluruh ID memiliki embedding dengan model/dimensi/hash yang sesuai sebelum aktivasi.
- Seluruh regresi keyword dan filter tetap lolos. Perubahan recall pada mode hybrid diuji terpisah.
- Siapkan 30-50 query Indonesia-Inggris dengan penilaian relevansi; pisahkan query kalibrasi dan query evaluasi. Target awal untuk query evaluasi dengan jawaban yang diketahui: minimal 80% mempunyai hasil relevan di top 5, judul persis berada pada tier pertama, dan kasus tanpa jawaban tidak selalu menghasilkan kandidat semantic.
- Uji pagination tanpa duplikasi, sort eksplisit, filter gabungan, C++/C#, AI/IT/UI, deskripsi tidak tersedia, query kosong, cache, pembatasan request, dan fallback provider.
- Ukur p50/p95, ukuran tabel/index/database, token/biaya, dan perilaku cold start secara terpisah. HNSW hanya diterapkan bila hasil pengukuran membenarkannya.
- Jalankan `npm test`, `npm run typecheck`, `npm run lint`, dan `npm run build`, ditambah pengujian integrasi pada schema pengujian yang terisolasi dan pengecekan browser desktop/mobile.
- Verifikasi API tanpa sesi login, CORS lintas origin, MIME type dokumentasi teks, dan kesesuaian contoh dengan OpenAPI.
- Sediakan README, contoh konfigurasi tanpa secret, command migration/import/backfill/evaluation, laporan hasil, serta langkah rollback versi snapshot. Secret dan log sensitif tidak dimasukkan Git.

## Urutan dan effort

1. Schema dan importer; dry-run serta pilot embedding/dimensi.
2. Keyword SQL, backfill embedding, hybrid ranking, dan definisi pagination.
3. API publik, cache, pembatasan request, dan fallback.
4. Integrasi SSR/UI, dokumentasi AI, robots, dan sitemap.
5. Evaluasi relevansi, pengujian integrasi/browser, pengukuran ukuran/performa, dan dokumentasi operasi.

Estimasi tetap **5-8 hari kerja untuk satu engineer**, mencakup pengujian dan tuning. Koneksi yang siap mengurangi ketidakpastian setup, tetapi kualitas ranking dan pengujian integrasi masih perlu dikerjakan.

Hitungan token lokal sebelumnya adalah 4.665.296 token untuk teks usulan. Pada harga US$0,02/juta token, satu backfill sekitar **US$0,0933**, sebelum pilot/pengulangan, query, fee pembelian kredit, pajak, dan biaya Neon. Pada 512 dimensi, payload vektor awal sekitar **56,9 MB**, belum termasuk tabel/index/cache. Ukuran database aktual akan diukur setelah import. [Harga model OpenRouter](https://openrouter.ai/openai/text-embedding-3-small), [format penyimpanan pgvector](https://github.com/pgvector/pgvector#vector-type)

Scope tahap ini memakai snapshot yang ada dan pembaruan manual melalui command. Sinkronisasi live portal Kemnaker, parser filter bahasa alami, chatbot, MCP server khusus, konfigurasi tool pada tiap aplikasi AI, dan publikasi deployment tidak termasuk rencana ini.

## Referensi implementasi

- [Neon pgvector](https://neon.com/docs/extensions/pgvector)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- Guide Next.js lokal: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` dan `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`.
