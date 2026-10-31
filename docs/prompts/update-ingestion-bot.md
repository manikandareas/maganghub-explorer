# Prompt untuk agent pengembang bot

Salin prompt berikut ke agent yang memiliki akses repository bot. Isi `MAGANGHUB_INGEST_URL` pada environment bot dengan URL deployment yang benar dan `/api/internal/jobs/ingest`. Isi `MAGANGHUB_INGEST_API_KEY` dengan nilai `INGEST_API_KEY` dari environment server. Jangan tempel secret ke percakapan.

```text
Update bot MagangHub yang sudah berjalan setiap 30 menit agar otomatis mengirim lowongan baru dan perubahan lowongan lama ke MagangHub Explorer.

Periksa struktur, stack, scraper, scheduler, dan penyimpanan state yang sudah ada. Implementasikan perubahan sampai selesai dengan mengikuti pola repository. Pertahankan jadwal 30 menit.

Konfigurasi dari environment bot:
- MAGANGHUB_INGEST_URL: URL lengkap endpoint POST /api/internal/jobs/ingest pada deployment Explorer.
- MAGANGHUB_INGEST_API_KEY: secret yang sama dengan INGEST_API_KEY pada server Explorer.
Jangan hardcode atau mencetak secret. Tambahkan placeholder pada .env.example. Bot tidak perlu DATABASE_URL atau OPENROUTER_API_KEY milik Explorer.

Kontrak request:
POST ke MAGANGHUB_INGEST_URL
Authorization: Bearer <MAGANGHUB_INGEST_API_KEY>
Content-Type: application/json
Body JSON persis berbentuk:
{
  "observedAt": "2026-10-31T01:00:00.000Z",
  "jobs": [{
    "id": "123e4567-e89b-42d3-a456-426614174000",
    "title": "Backend Developer",
    "organization": "PT Contoh Indonesia",
    "organizationType": "company",
    "province": "Sulawesi Selatan",
    "city": "Kota Makassar",
    "quota": 5,
    "applicants": 2,
    "education": ["sarjana"],
    "programs": ["Informatika"],
    "interview": ["online"],
    "days": 5,
    "disability": false,
    "description": "Mengembangkan backend TypeScript dan PostgreSQL.",
    "address": "Makassar"
  }]
}

Semua field wajib ada. Field tambahan ditolak. Gunakan UUID asli lowongan sebagai id, jangan membuat UUID baru pada setiap run. observedAt adalah waktu data batch diambil dari sumber, UTC ISO 8601 dengan Z, bukan waktu retry. Retry mempertahankan isi dan timestamp asli. Jika data diambil ulang, gunakan timestamp observasi baru. Kelompokkan record dengan waktu observasi yang sama.

Mapping:
- organizationType: company atau government.
- education: array unik diploma, sarjana, profesi.
- interview: array unik online, onsite; ini tipe wawancara, bukan WFO/WFH.
- province/city: nama resmi dari sumber, bukan indeks snapshot atau kode BPS. Pertahankan penamaan Kota/Kab./Kota Adm. secara konsisten.
- quota: integer 0..1000000; applicants: integer 0..10000000; days: integer 0..7, 0 jika tidak tercantum; disability: boolean.
- description/address boleh null atau string kosong jika tidak tersedia. Array boleh kosong jika tidak tersedia. Jangan mengarang nilai atau mengirim token referensi deskripsi yang belum terselesaikan.
- title/organization maksimal 300 karakter, province/city 200, description 20000, address 2000. programs maksimal 100 nama unik dengan 200 karakter per nama. Total teks embedding posisi+penyelenggara+lokasi+program studi+deskripsi maksimal 24000 karakter termasuk label/pemisah. Tangani data terlalu panjang secara eksplisit dan simpan alasan penyesuaian.
- Jangan kirim category, score, URL, embedding, atau field internal lain. Server menyiapkan kategori, sourceUrl, FTS dan embedding.

Implementasi pengiriman:
1. Ambil detail lengkap lowongan baru atau berubah, termasuk perubahan quota/applicants. Bandingkan konten untuk menghindari pengiriman ulang data yang tidak berubah. Simpan observation time asal.
2. Simpan batch tertunda secara durable sebelum mengirim. Gunakan penyimpanan state yang sudah ada; bila belum ada, pilih cara paling sederhana yang sesuai lingkungan deployment. Checkpoint keberhasilan hanya maju setelah HTTP 200 dan ready=true. Kegagalan proses/restart tidak boleh menghilangkan pekerjaan tertunda.
3. Mulai dengan maksimal 25 lowongan per batch, batas server 50 dan 2 MiB. Jangan kirim batch kosong. Beri timeout request 150 detik dan cegah scheduler berjalan tumpang tindih.
4. Pada sukses, baca runId, inserted, updated, unchanged, stale, embeddingDocuments, revision, ready. Jumlah inserted+updated+unchanged+stale harus sama dengan jumlah record. stale berarti observasi lama sudah diabaikan dan dapat ditandai selesai. Log ringkasan tanpa secret atau payload lengkap.
5. Retry 429, 5xx, timeout/network error, dan 409 dengan error.code=CONCURRENT_INGEST menggunakan exponential backoff + jitter; hormati Retry-After. Batasi percobaan per run dan pertahankan batch untuk run berikutnya. Setelah timeout, kirim payload asli karena request sebelumnya mungkin sudah commit.
6. Untuk 413, pecah batch tanpa mengganti observedAt. Untuk 400/415, perbaiki mapping/format dan simpan batch gagal agar dapat diperiksa. Untuk 422 EMBEDDING_INPUT_REJECTED, periksa isi atau pendekkan deskripsi/program studi; batas karakter tidak menjamin batas token provider terpenuhi, sehingga jangan retry payload identik tanpa batas. Untuk 401, laporkan konfigurasi secret. Untuk 409 OBSERVATION_CONFLICT, jangan mengubah timestamp untuk menyamarkan payload; periksa state atau ambil ulang data. Untuk CATALOG_VERSION_MISMATCH atau INGEST_NOT_CONFIGURED, laporkan kebutuhan konfigurasi server. Tidak ada batch gagal yang boleh ditandai sukses atau dibuang diam-diam.
7. Lowongan yang tidak ditemukan pada satu hasil scrape tidak boleh dianggap dihapus. Endpoint ini belum mendukung penutupan/penghapusan.

Tambahkan pengujian yang relevan untuk mapping, chunking, perubahan kuota/pelamar, checkpoint/outbox, replay setelah timeout, retry/backoff, serta penanganan error permanen. Gunakan mock HTTP untuk pengujian otomatis; jangan menambahkan lowongan palsu ke deployment. Jalankan checks repository dan jelaskan file yang berubah, konfigurasi, serta cara menjalankannya.
```
