# Review kesiapan production — 31 Oktober 2026

Cakupan: perubahan lokal tracked dan untracked terhadap `HEAD` `d3885cd198fefdcd91eff766934eb131ec37f0ef`. Acuan kebutuhan adalah endpoint ingest bot setiap 30 menit, autentikasi environment, incremental upsert beserta embedding, dan kompatibilitas aplikasi sebelumnya. Standar repository: `AGENTS.md` dan panduan Next.js yang terpasang. Review mencakup dua pemeriksaan independen, lalu perbaikan serta verifikasi runtime.

## Standards

Tidak ditemukan pelanggaran standar repository yang terpisah dari masalah perilaku berikut. Empat temuan pada implementasi awal sudah diperbaiki:

1. **Urutan A–Z berubah setelah ingest pertama.** Penggantian ke SQL `lower(title)` mengubah 21.419 posisi dari 27.667 baris, termasuk pada batch tanpa perubahan. `ingest-order.ts` sekarang memakai pembanding bahasa Indonesia yang sama dengan importer dan memperbarui `az_order` secara atomik. Pembaca versi sebelumnya tetap dapat memakai kolom rank tersebut.
2. **Kiriman lama dapat menimpa snapshot awal.** `observed_at=NULL` sebelumnya dianggap tidak memiliki batas waktu. Baris snapshot sekarang memakai awal `snapshotDate` UTC sebagai batas minimal; kiriman lebih lama diabaikan sebelum lokasi/embedding disiapkan. Timestamp publik tetap null untuk baris snapshot yang belum diperbarui.
3. **Pembulatan skor berubah.** `Math.round` mengubah 146 skor negatif ketika quota/applicants tetap sama. Helper pembulatan simetris sekarang cocok dengan seluruh 27.667 skor awal.
4. **Error input embedding permanen dianggap retryable.** Penolakan input sekarang menjadi 422 `EMBEDDING_INPUT_REJECTED`, sehingga bot dapat memperbaiki payload. Error kredensial/provider tetap ditangani sebagai masalah server. Prompt bot telah diperbarui.

Review ulang menemukan tidak ada blocker correctness/security yang masih terbukti pada perubahan yang telah diperbaiki.

## Spec

Dua temuan kompatibilitas terhadap kebutuhan pengguna adalah perubahan urutan A–Z dan kelemahan proteksi snapshot terhadap data lama. Keduanya sudah ditutup dengan perbaikan di atas dan pengujian regresi.

Endpoint, API key dari environment, batch incremental, pemakaian ulang embedding, publikasi atomik, dan prompt penyesuaian bot memenuhi cakupan yang diminta. Kontrak GET publik tetap tanpa autentikasi dan field lama dipertahankan. Field metadata/observedAt bersifat tambahan. Perubahan cache GET menjadi `private, no-store` disengaja untuk pembacaan setelah commit dan dapat meningkatkan query database.

## Verifikasi

- Node.js **22.23.4**: `node --import tsx --test tests/*.test.ts tests/integration/*.test.ts` — **117 passed, 0 failed, 0 skipped**. Runtime Node.js 25.8.0 juga digunakan pada pemeriksaan awal.
- `npm run typecheck`, `npm run lint`, dan build production Next.js dengan Node.js 22 — lulus.
- `npm audit --omit=dev --audit-level=high` — **0 vulnerabilities** pada dependency production.
- Migration 004 diuji dari schema sebelumnya dan diterapkan dua kali pada fixture: additive, repeatable, query reader/writer legacy tetap bekerja. Migration runner pada database terkonfigurasi juga memverifikasi semua checksum sebagai already applied.
- Fixture katalog penuh **27.667 lowongan** memverifikasi seluruh rank awal pada Node.js 22, tidak berubah setelah batch tanpa perubahan, dan tetap konsisten setelah insert serta perubahan judul. Proteksi kiriman lama juga memverifikasi payload dan facets tidak berubah.
- Pengujian mencakup request bersamaan, retry revision, pemakaian ulang embedding untuk perubahan counter, penolakan timestamp konflik, rollback saat embedding tidak lengkap, serta provider embedding asli dengan vector 512 dimensi.
- Seluruh fixture menggunakan schema/katalog terisolasi dan dibersihkan. Pointer, jumlah lowongan, dan revision katalog aktif asli tetap sama.

Pengukuran terakhir pada fixture penuh di database terkonfigurasi:

| Operasi | Durasi |
| --- | ---: |
| Batch tanpa perubahan | 380 ms |
| Insert satu lowongan | 4.467 ms |
| Perubahan judul | 2.214 ms |

Pengukuran tersebut menggunakan embedding fixture untuk memisahkan biaya database/pengurutan dari latency provider; bukan benchmark atau jaminan latency production. Agregasi facets telah diubah menjadi GROUP BY agar tidak menghitung ulang seluruh katalog untuk setiap lokasi.

Smoke test hasil build production melalui HTTP pada Node.js 22:

| Pemeriksaan | Hasil |
| --- | --- |
| POST ingest tanpa bearer | 401 |
| POST bearer benar, body `{}` | 400 `INVALID_INGEST` |
| GET ke route ingest | 405 |
| Search A–Z, detail, facets | 200 |
| Halaman utama dan detail | 200 |
| OpenAPI dan kontrak GET tanpa login | 200 |
| Cache response katalog | `private, no-store` |
| Katalog aktif setelah pengujian | 27.667 baris, revision 0 |

## Batas verifikasi dan rilis

Belum ada deployment atau pengujian endpoint hosting production pada review ini. Secret hosting, koneksi database production, origin HTTPS, dan budget request 120 detik harus sesuai [urutan deployment](production-deployment.md). Migration harus berjalan sebelum trafik aplikasi baru. Rollback build tidak mengembalikan isi data sebelum ingest; biarkan schema additive tetap terpasang dan hentikan bot selama rollback.

Standards: 4 temuan ditutup, 0 terbuka. Spec: 2 temuan ditutup, 0 terbuka. Tidak ada blocker tersisa dalam pemeriksaan ini.
