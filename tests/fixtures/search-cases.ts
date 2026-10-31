export type RelevanceCase = { query: string; title: string; split: "calibration" | "evaluation" };
const roles = [
  ["AI Engineer", "membangun model kecerdasan buatan dan machine learning", "ai engineer|machine learning|artificial intelligence|data scientist|computer vision|nlp"],
  ["Data Analyst", "mengolah angka dan membuat dashboard analisis data", "data analyst|analis data|data analis|business intelligence|data science"],
  ["Backend Developer", "building backend services and application APIs", "backend|back.end|software|programmer|developer"],
  ["Frontend Developer", "membuat tampilan website dengan React dan JavaScript", "frontend|front.end|web developer|software|programmer"],
  ["Quality Assurance", "testing software applications and reporting bugs", "quality assurance|tester|software test|qa engineer"],
  ["IT Support", "membantu pengguna memperbaiki komputer dan jaringan kantor", "it support|technical support|helpdesk|jaringan|network"],
  ["Perawat", "mendampingi pasien dan membantu pelayanan keperawatan", "perawat|keperawatan|nurse"],
  ["Akuntansi", "mencatat transaksi dan menyusun laporan keuangan", "akuntan|account|keuangan|finance"],
  ["Human Resources", "mengelola data karyawan dan proses rekrutmen pegawai", "human resource|(^|[^a-z])hr([^a-z]|$)|sdm|personalia|rekrut|sumber daya manusia"],
  ["Digital Marketing", "promoting products through digital marketing campaigns", "marketing|pemasaran|digital campaign"],
  ["Desain Grafis", "mendesain materi visual poster dan konten promosi", "desain|design|graphic|kreatif"],
  ["UI UX Designer", "designing user interfaces and improving user experience", "ui.?ux|ux|ui designer|product design"],
  ["Legal", "meninjau kontrak dan membantu urusan hukum perusahaan", "legal|hukum|law"],
  ["Logistik", "mengatur persediaan barang di gudang dan distribusi", "logisti|warehouse|gudang|supply chain|inventory"],
  ["Customer Service", "answering customer questions and handling complaints", "customer|pelanggan|call center|contact center"],
  ["Video Editor", "mengedit video dan membuat konten audiovisual", "video|editor|multimedia|content creator"],
  ["Teknik Sipil", "assisting civil engineering and building construction projects", "sipil|civil|konstruksi|construction|arsitek"],
  ["Administrasi", "mengelola surat dokumen dan pengarsipan kantor", "admin|arsip|sekretaris|secretary"],
  ["Pertanian", "membantu budidaya tanaman dan kegiatan perkebunan", "pertanian|agro|kebun|agricultur|tanaman"],
  ["Laboratorium", "preparing laboratory samples and assisting laboratory tests", "laboratorium|laboratory|laboran|lab analyst"],
];
export const relevanceCases: RelevanceCase[] = roles.flatMap(([literal, paraphrase, title]) => [
  { query: literal, title, split: "calibration" },
  { query: paraphrase, title, split: "evaluation" },
]);
export const negativeQueries = ["zxqv984729tidakadalowongan", "merawat dinosaurus hidup di planet Mars", "pilot kapal antariksa menuju galaksi Andromeda"];
