export const CATEGORY_VERSION = 2;
export const CATEGORIES = [
  { value: "administrasi", label: "Administrasi & Operasional", keywords: ["admin", "office", "operations", "sekretaris"] },
  { value: "ai", label: "AI & Machine Learning", keywords: ["artificial intelligence", "kecerdasan buatan"] },
  { value: "bisnis", label: "Bisnis & Manajemen", keywords: ["business", "strategy", "project", "konsultan"] },
  { value: "data", label: "Data & Analitik", keywords: ["analyst", "analytics", "business intelligence"] },
  { value: "desain", label: "Desain & Media Kreatif", keywords: ["design", "graphic", "video", "fotografi", "UI", "UX", "content"] },
  { value: "hukum", label: "Hukum & Kepatuhan", keywords: ["legal", "law", "compliance"] },
  { value: "it", label: "IT Support & Jaringan", keywords: ["network", "helpdesk", "sysadmin"] },
  { value: "kesehatan", label: "Kesehatan & Farmasi", keywords: ["perawat", "medis", "dokter", "pharmacy", "nurse"] },
  { value: "keuangan", label: "Keuangan & Akuntansi", keywords: ["finance", "accounting", "audit", "pajak", "bank"] },
  { value: "lingkungan", label: "Lingkungan & K3", keywords: ["environment", "safety", "HSE", "EHS", "sustainability"] },
  { value: "logistik", label: "Logistik & Pengadaan", keywords: ["supply chain", "warehouse", "purchasing", "procurement", "gudang"] },
  { value: "pariwisata", label: "Pariwisata, Hotel & Kuliner", keywords: ["hospitality", "tourism", "cook", "chef", "barista"] },
  { value: "pemasaran", label: "Pemasaran, Penjualan & Komunikasi", keywords: ["marketing", "sales", "PR", "public relations", "kehumasan"] },
  { value: "pendidikan", label: "Pendidikan & Pelatihan", keywords: ["guru", "teacher", "kurikulum", "pengajar", "instruktur"] },
  { value: "pertanian", label: "Pertanian, Peternakan & Perikanan", keywords: ["agro", "agriculture", "perkebunan", "budidaya"] },
  { value: "manufaktur", label: "Produksi & Manufaktur", keywords: ["production", "manufacturing", "QC", "quality control", "operator"] },
  { value: "publik", label: "Pelayanan Publik & Sosial", keywords: ["pemerintahan", "penyuluh", "fasilitator", "masyarakat"] },
  { value: "riset", label: "Riset & Laboratorium", keywords: ["research", "periset", "peneliti", "laboratory", "laboran"] },
  { value: "sdm", label: "SDM & Rekrutmen", keywords: ["HR", "HC", "human resources", "personalia", "people", "talent"] },
  { value: "dev", label: "Software & Development", keywords: ["programmer", "developer", "aplikasi", "web"] },
  { value: "teknik", label: "Teknik & Konstruksi", keywords: ["engineering", "civil", "mechanical", "electrical", "arsitektur"] },
  { value: "lain", label: "Bidang lainnya", keywords: [] },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];

// Classify the role, not the employer or every major it accepts. Specific domains
// precede broad roles (e.g. pharmacy administration stays in healthcare).
const RULES: readonly [Category, RegExp][] = [
  ["kesehatan", /\b(perawat|keperawatan|nurse|nursing|dokter|doctor|bidan|midwife|apoteker|(?:ke)?farmasi\w*|pharma\w*|pharmacy|medis|medik|medical|biomedic\w*|kesehatan|rekam med\w*|fisioterap\w*|radiogra\w*|analis kesehatan|gizi|nutri\w*|hospital|rumah sakit|psikolog\w*|psikiater|terapis|atlm|sanitarian)\b/],
  ["hukum", /\b(hukum|legal|law|paralegal|notaris|kepatuhan|compliance|litigasi)\b/],
  ["lingkungan", /\b(k3|hse|ehs|hsse|qhse|she|safety|environment\w*|lingkungan|sustainab\w*|limbah|amdal|konservasi)\b/],
  ["pendidikan", /\b(guru|teacher|pengajar|pendidik\w*|kurikulum|curriculum|pembelajaran|tutor|dosen|instruktur|instructor|widyaiswara|education|teaching|learning (center|development)|training|pelatihan|diklat|pengembangan kompetensi|penerjemah kurikulum)\b/],
  ["sdm", /\b(hr\w*|hc|hcm|sdm|human resources?|human capital|personalia|recruit\w*|rekrut\w*|talent|people and culture|people development|people partner|hubungan industrial|sumber daya manusia|payroll)\b/],
  ["keuangan", /\b(financ\w*|keuangan|akuntan\w*|accounting|accountant|accounts? (payable|receivable)|tax\w*|pajak|perpajakan|audit\w*|treasury|perbendaharaan|anggaran|budget\w*|bank\w*|perbankan|kredit|credit|collection|asuransi|insurance|risk management|investment|investasi|pawning|gadai|aktuaria)\b/],
  ["desain", /\b(desain\w*|design\w*|graphic\w*|kreatif|creative|video\w*|editor|multimedia|fotogra\w*|photogra\w*|videogra\w*|animasi|animator|illustrator|ilustrator|content creator|konten kreator|ui\W*ux|ux|ui designer|streamer|penerjemah|translat\w*|jurnalis\w*)\b/],
  ["pemasaran", /\b(marketing|pemasaran|sales|penjualan|commercial|commerce|ecommerce|e commerce|account (executive|manager)|business development|customer|pelanggan|call center|contact center|public relations?|kehumasan|humas|hubungan masyarakat|komunikasi|communication\w*|brand\w*|social media|media sosial|media intern|copywriter|content writer|merchandis\w*|affiliate|seo)\b/],
  ["teknik", /\b(teknik sipil|civil|mechanic\w*|mekanik|mechanical|mesin|electri\w*|elektr\w*|kelistrikan|arsitek\w*|architect\w*|architech|construction|konstruksi|bangunan|gedung|survei|survey\w*|pemetaan|geodesi|geologi|geofisika|pertambangan|mining|metalurgi|otomotif|automotive|maintenance|perawatan mesin|teknisi(?! komputer| it\b)|drafter|mep|bim|instrument\w*|telekomunikasi|toolman|aircraft|aviasi|chemical)\b/],
  ["ai", /\b(ai engineer|ai specialist|machine learning|artificial intelligence|kecerdasan buatan|intelijensi artifisial|deep learning|data scientist|computer vision|nlp|programmer ai|ai\/ml|ml engineer)\b/],
  ["data", /\b(data analyst|data engineer|analis data|data analis|business intelligence|data support|pengolah data|data entry|data science|data mining|data analytics|data visualization|statisti\w*)\b/],
  ["dev", /\b(software|developer|programmer|frontend|front[ -]?end|backend|back[ -]?end|fullstack|full[ -]?stack|web|mobile|android|devops|quality assurance|tester|system analyst|sistem analis|aplikasi|perangkat lunak|database|cloud|game|programer)\b/],
  ["it", /\b(it|technical support|helpdesk|network|jaringan|teknisi komputer|sysadmin|system administrator|teknologi informasi|information technology|informatika|sistem informasi)\b/],
  ["logistik", /\b(logisti\w*|supply chain|warehouse|gudang|inventory|persediaan|purchas\w*|procurement|pengadaan|distribusi|shipping|shipment|dispatcher|fleet|armada|crewing|ekspor|impor|export|import|transportasi|stock controller)\b/],
  ["manufaktur", /\b(produksi|production|manufactur\w*|pabrik|quality control|qc|quality inspection|finishing|perakitan|assembly|operator|process engineer\w*|continuous improvement|industrial engineering|ppic|machining)\b/],
  ["teknik", /\b(engineer\w*|teknik|quantity surveyor|estimator|fit out|facility|facilities|quality engineer)\b/],
  ["pertanian", /\b(pertanian|agro\w*|agricultur\w*|perkebunan|peternak\w*|perikanan|budidaya|hortikultura|tanaman|forestry|kehutanan|agribisnis|akuakultur|aquacultur\w*)\b/],
  ["publik", /\b(pelayanan haji|pelayanan publik|layanan publik|pemerintah\w*|penyuluh|fasilit(?:it)?ator|sosial|social worker|social responsibility|csr|kemasyarakatan|pemasyarakatan|pembinaan|kependudukan|keluarga berencana|pemberdayaan|kebijakan|policy)\b/],
  ["pariwisata", /\b(pariwisata|wisata|tour\w*|hotel|hospitality|kuliner|cook|chef|barista|kitchen|restoran|restaurant|food beverage|food and beverage|pastry|baker\w*|housekeeping|front office|front desk|receptionist|waiter|waitress|dining|event executive|umrah)\b/],
  ["riset", /\b(riset|research\w*|periset|peneliti\w*|laboratorium|laboratory|laboran|lab analyst|laboratory analyst)\b/],
  ["bisnis", /\b(business|bisnis|strategy|strategic|strategi|manajemen|management|konsultan|consult\w*|project (management|controller)|performance|perencana|planning|pengembangan usaha|product (manager|management)|analis organisasi)\b/],
  ["administrasi", /\b(admin\w*|adm|operasi\w*|operation\w*|sekret\w*|secretar\w*|arsip\w*|archiv\w*|dokumen|document\w*|office|tata usaha|tata kelola|general affairs?|ga|back office|support|pelaksana|penata|pengelola|pelayanan|layanan|service delivery|staff umum|staf umum|pramubakti|ritel|retail|staf magang|magang staf|store|asisten direktur|project officer|monitoring)\b/],
];

export function categoryOf(title: string): Category {
  const normalized = title.normalize("NFKC").toLowerCase().replace(/[_/\-]+/g, " ");
  return RULES.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "lain";
}
