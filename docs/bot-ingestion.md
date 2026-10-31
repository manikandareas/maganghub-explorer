# Integrasi bot lowongan

`POST /api/internal/jobs/ingest` menerima lowongan baru dan pembaruan lowongan yang sudah ada. Endpoint berjalan synchronous: HTTP 200 dengan `ready: true` berarti data, full-text search, embedding, facets, dan metadata sudah di-commit. GET pencarian/detail/facets memakai `Cache-Control: private, no-store` sehingga request berikutnya membaca hasil commit. Halaman browser yang sudah terbuka perlu memuat ulang data.

## Konfigurasi

Server membaca `INGEST_API_KEY` dari environment Next.js, termasuk `.env`. Gunakan secret acak minimal 32 karakter, terpisah dari `OPENROUTER_API_KEY`. Jangan memakai prefix `NEXT_PUBLIC_`. Bot memakai secret yang sama. Restart server setelah mengganti `.env`; pada hosting, pasang secret pada environment deployment juga. Jalankan `npm run db:migrate` sebelum menjalankan versi ini. Katalog awal harus sudah diimpor, di-backfill, dan diaktifkan.

```http
POST /api/internal/jobs/ingest
Authorization: Bearer <INGEST_API_KEY>
Content-Type: application/json
```

Gunakan HTTPS pada deployment. API key tidak boleh berada di URL, payload, repository, atau log. Endpoint ini tidak membuka CORS untuk browser. GET publik tetap tanpa autentikasi.

## Payload

Maksimal **50 lowongan dan 2 MiB per request**. Semua field di bawah wajib ada; field tambahan ditolak. `description` dan `address` boleh `null` atau string kosong. Array boleh kosong jika sumber tidak menyediakan nilainya. `days=0` berarti tidak tercantum.

```json
{
  "observedAt": "2026-10-31T01:00:00.000Z",
  "jobs": [
    {
      "id": "123e4567-e89b-42d3-a456-426614174000",
      "title": "Backend Developer",
      "organization": "PT Contoh Indonesia",
      "organizationType": "company",
      "province": "Sulawesi Selatan",
      "city": "Kota Makassar",
      "quota": 5,
      "applicants": 2,
      "education": ["sarjana"],
      "programs": ["Informatika", "Sistem Informasi"],
      "interview": ["online"],
      "days": 5,
      "disability": false,
      "description": "Mengembangkan backend dengan TypeScript dan PostgreSQL.",
      "address": "Makassar"
    }
  ]
}
```

- `id`: UUID asli lowongan MagangHub, tetap sama sepanjang umur lowongan. Tidak boleh berulang dalam satu batch.
- `observedAt`: waktu data dalam batch diambil dari sumber, format ISO 8601 UTC dengan `Z`. Maksimal 5 menit di masa depan. Saat retry, pertahankan **timestamp dan isi yang sama**. Jika data diambil ulang, gunakan waktu observasi yang baru. Kelompokkan data dengan waktu observasi yang sama ke batch yang sama.
- `organizationType`: `company` atau `government`.
- `province`, `city`: nama lokasi dari sumber resmi, bukan nomor indeks snapshot atau kode BPS. Gunakan ejaan sumber secara konsisten, termasuk `Kota`, `Kab.`, atau `Kota Adm.`. Lokasi baru ditambahkan otomatis. Perbedaan kapitalisasi dicocokkan ke label katalog yang sudah ada.
- `education`: kombinasi unik `diploma`, `sarjana`, `profesi`.
- `interview`: kombinasi unik `online`, `onsite`. Ini tipe wawancara, bukan sistem kerja.
- `programs`: maksimal 100 nama program studi, masing-masing maksimal 200 karakter, tanpa duplikat.
- `quota`: integer 0–1.000.000; `applicants`: integer 0–10.000.000; `days`: integer 0–7; `disability`: boolean.
- `title` dan `organization`: maksimal 300 karakter; `province` dan `city`: maksimal 200; `description`: maksimal 20.000; `address`: maksimal 2.000. Total teks embedding maksimal 24.000 karakter; pendekkan deskripsi/program studi bila batas gabungan terlampaui.

Server menghitung kategori dari judul, tautan resmi dari judul/UUID, indeks pencarian, dan embedding `openai/text-embedding-3-small` dengan 512 dimensi. Skor peluang dihitung sebagai `(quota-applicants)/max(applicants,1)`, dibulatkan dua desimal; bukan probabilitas diterima. Bot tidak mengirim kategori, skor, vektor, atau key OpenRouter. Perubahan kuota/pelamar tidak memicu embedding baru. Perubahan judul, penyelenggara, lokasi, program studi, atau deskripsi menggunakan hash teks untuk memakai ulang/generate embedding yang sesuai.

Pembulatan skor mengikuti snapshot awal, termasuk pembulatan setengah menjauhi nol pada nilai negatif. Urutan A–Z tetap memakai pembanding bahasa Indonesia seperti importer; rank disimpan dan diperbarui dalam transaksi yang sama ketika ada judul baru/berubah. Data yang lebih tua dari tanggal snapshot awal tidak dapat menimpa lowongan snapshot yang belum memiliki `observedAt`.

Batas karakter tidak menjamin batas token provider terpenuhi. `text-embedding-3-small` menerima maksimal 8.192 token per teks ([dokumentasi model](https://developers.openai.com/api/docs/guides/embeddings#embedding-models)). Jika provider menolak teks, endpoint mengembalikan 422 agar bot memperbaiki/menyingkat input, tanpa menulis sebagian batch.

## Respons dan retry

Contoh sukses:

```json
{
  "runId": "9daa81dc-911c-4fce-a7ab-fb9d31cf1120",
  "snapshotId": "catalog-id",
  "observedAt": "2026-10-31T01:00:00.000Z",
  "inserted": 1,
  "updated": 0,
  "unchanged": 0,
  "stale": 0,
  "embeddingDocuments": 1,
  "embeddingTokens": 42,
  "ready": true,
  "revision": 1,
  "lastIngestedAt": "2026-10-31T01:00:02.000Z"
}
```

Jumlah `inserted + updated + unchanged + stale` sama dengan jumlah lowongan yang dikirim. `stale` berarti data tersebut lebih lama daripada observasi yang sudah tersimpan dan diabaikan. Isi sama dengan observasi lebih baru tetap memperbarui timestamp agar kiriman lama berikutnya tidak menimpanya. Data sama dengan timestamp sama aman dikirim ulang. Isi berbeda dengan ID dan timestamp sama menghasilkan 409 `OBSERVATION_CONFLICT`.

Error memakai bentuk `{"error":{"code":"...","message":"..."}}`:

| Status | Tindakan bot |
| --- | --- |
| 200 + `ready=true` | Tandai batch berhasil di penyimpanan bot. Simpan ringkasan hitungan/runId. |
| 400 `INVALID_INGEST` / `INVALID_JSON` | Perbaiki payload; simpan batch gagal untuk diperiksa. Seluruh batch belum ditulis. |
| 401 `UNAUTHORIZED` | Periksa secret; hentikan retry cepat. |
| 409 `CONCURRENT_INGEST` | Retry payload asli dengan backoff; katalog berubah selama pemrosesan. |
| 409 `OBSERVATION_CONFLICT` | Jangan retry isi berbeda dengan timestamp yang sama; periksa checkpoint atau ambil ulang data. |
| 409 `CATALOG_VERSION_MISMATCH` | Perlu pembaruan klasifikasi katalog oleh pengelola server. |
| 413 | Pecah batch, pertahankan waktu observasi tiap data. |
| 415 | Gunakan JSON dan header Content-Type yang benar. |
| 422 `EMBEDDING_INPUT_REJECTED` | Periksa isi atau pendekkan teks; simpan batch untuk diperbaiki. Jangan retry payload identik tanpa batas. |
| 429 | Maksimal 60 request ingest/menit bersama. Ikuti `Retry-After`. |
| 503 / 5xx / timeout jaringan | Retry payload asli dengan exponential backoff dan jitter. Ikuti `Retry-After` bila ada. `INGEST_NOT_CONFIGURED` memerlukan konfigurasi server. |

Timeout bot yang disarankan **150 detik**; route meminta budget hosting 120 detik. Pastikan paket hosting mendukung durasi tersebut; jika lebih pendek, kecilkan batch dan naikkan timeout bot melebihi budget server. Pemrosesan ditunggu di dalam request. Request yang terputus dapat sudah di-commit; kirim ulang payload asli untuk memastikan hasil.

Bot harus menyimpan batch tertunda secara durable sebelum mengirim. Jangan memajukan checkpoint hanya karena data sudah di-scrape. Setelah percobaan terbatas gagal, pertahankan batch untuk percobaan run berikutnya. Jadwal 30 menit tetap berjalan, dengan perlindungan agar dua proses tidak mengirim pekerjaan yang sama secara bersamaan. Kirim juga perubahan lowongan lama, terutama kuota/pelamar; jangan mengandalkan ID baru saja.

## Katalog dan waktu data

Ingest mengubah katalog aktif secara incremental. `snapshotId` mengidentifikasi katalog dasar, sedangkan `meta.revision` berubah tiap batch yang berhasil. `snapshotDate` tetap tanggal snapshot awal. `meta.dataMode=incremental` dan `meta.lastIngestedAt` menyatakan ada batch baru, bukan seluruh lowongan sudah diperbarui. Setiap hasil pencarian/detail memiliki `observedAt`; `null` berarti masih data snapshot awal. `isLive=false` tetap dipertahankan karena data berasal dari pengambilan berkala dan ketersediaan perlu dikonfirmasi di portal resmi.

Lowongan yang tidak ada dalam payload tidak dihapus atau dianggap tutup. Endpoint belum menerima status penutupan/penghapusan. Aktivasi ulang snapshot yang sama tidak mengembalikan isi sebelum ingest. Snapshot lain tetap dapat diaktifkan melalui command yang sudah ada. Import/klasifikasi dari berkas lokal tidak boleh menimpa katalog yang sudah menerima pembaruan incremental.

Prompt penyesuaian bot tersedia di [prompts/update-ingestion-bot.md](prompts/update-ingestion-bot.md).

Urutan deployment dan rollback tersedia di [production-deployment.md](production-deployment.md).
