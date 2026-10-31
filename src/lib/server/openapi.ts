import { PUBLIC_PARAMETERS } from "./public-api";
import { siteUrl } from "./config";

export function openApiDocument() {
  const errorResponses = Object.fromEntries([400, 404, 429, 503].map(status => [status, { description: ({ 400: "Parameter tidak valid", 404: "Lowongan tidak ditemukan", 429: "Rate limit, lihat Retry-After", 503: "Katalog/database tidak tersedia" })[status as 400], content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }]));
  const metadata = { type: "object", required: ["snapshotId", "snapshotDate", "isLive", "sourceUrl", "categoryVersion", "categorySource"], properties: {
    snapshotId: { type: "string" }, snapshotDate: { type: "string", format: "date" }, isLive: { type: "boolean", const: false }, sourceUrl: { type: "string", format: "uri" },
    categoryVersion: { type: "integer" }, categorySource: { type: "string", const: "inferred_from_position_title", description: "Bidang diperkirakan dari judul posisi; bukan klasifikasi resmi penyelenggara." },
    requestedMode: { type: "string", enum: ["hybrid", "keyword"] }, mode: { type: "string", enum: ["hybrid", "keyword"] }, fallbackReason: { type: "string" },
    totalScope: { type: "string", enum: ["keyword_matches", "keyword_plus_semantic_candidates"] }, semanticCandidateLimit: { type: "integer" },
  } };
  const job = { type: "object", required: ["id", "title", "organization", "city", "province", "quota", "sourceUrl", "detailUrl", "opportunityScore"], properties: {
    id: { type: "string", format: "uuid" }, title: { type: "string" }, organization: { type: "string" }, organizationType: { type: "integer", enum: [0, 1] },
    city: { type: "string" }, province: { type: "string" }, quota: { type: "integer" }, applicants: { type: "integer" },
    education: { type: "array", items: { type: "string" } }, programs: { type: "array", items: { type: "string" } }, interview: { type: "array", items: { type: "string" } },
    days: { type: "integer" }, disability: { type: "boolean" }, category: { type: "string" }, opportunityScore: { type: "number", description: "Skor peluang dari snapshot; bukan peluang diterima atau skor relevansi." },
    relevanceScore: { type: "number", description: "Skor ranking internal, bukan probabilitas." }, sourceUrl: { type: "string", format: "uri" }, detailUrl: { type: "string", format: "uri" },
    description: { type: ["string", "null"] }, descriptionAvailable: { type: "boolean" }, address: { type: "string" },
  } };
  const option = { type: "object", required: ["value", "label"], properties: { value: { type: "string" }, label: { type: "string" }, count: { type: "integer" }, province: { type: "string" } } };
  const json = (schema: object) => ({ "application/json": { schema } });
  return {
    openapi: "3.1.0", info: { title: "MagangHub Explorer API", version: "1.0.0", description: "API publik snapshot lowongan 31 Oktober 2026. Bukan API resmi Kemnaker atau data live. Online interview tidak berarti kerja remote. Informasi yang tidak tersedia tidak boleh dikarang." },
    servers: [{ url: siteUrl() }], security: [],
    paths: {
      "/api/v1/jobs": { get: { operationId: "searchJobs", summary: "Cari lowongan magang", description: "Default hybrid. Filter selalu wajib dipenuhi. total menghitung seluruh hasil keyword ditambah maksimal 200 kandidat semantic yang melewati threshold, bukan seluruh kemungkinan kecocokan semantic. Query kosong memakai urutan portal. Provider gagal menghasilkan mode keyword dan fallbackReason. Maksimal 60 request/menit/client; pembuatan embedding baru dibatasi terpisah.",
        parameters: PUBLIC_PARAMETERS.map(rule => ({ name: rule.name, in: "query", required: false, description: rule.description, schema: { type: rule.type, ...("values" in rule ? { enum: rule.values } : {}), ...(rule.name === "q" ? { maxLength: 250 } : {}), ...(rule.name === "limit" ? { minimum: 1, maximum: 50, default: 12 } : {}), ...(rule.name === "page" ? { minimum: 1, maximum: 100000, default: 1 } : {}), ...(rule.name === "minQuota" ? { minimum: 0, maximum: 1000000 } : {}) } })),
        responses: { "200": { description: "Hasil pencarian", content: json({ type: "object", required: ["jobs", "total", "page", "pages", "pageSize", "meta"], properties: { jobs: { type: "array", items: { $ref: "#/components/schemas/Job" } }, total: { type: "integer" }, page: { type: "integer" }, pages: { type: "integer" }, pageSize: { type: "integer" }, meta: { $ref: "#/components/schemas/Metadata" } } }) }, ...errorResponses },
      } },
      "/api/v1/jobs/{id}": { get: { operationId: "getJob", summary: "Baca detail lowongan", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Detail beserta metadata snapshot", content: json({ type: "object", required: ["job", "meta"], properties: { job: { $ref: "#/components/schemas/Job" }, meta: { $ref: "#/components/schemas/Metadata" } } }) }, ...errorResponses } } },
      "/api/v1/facets": { get: { operationId: "getFacets", summary: "Nilai filter dan hubungan kota-provinsi", responses: { "200": { description: "Gunakan value, bukan label, sebagai parameter filter", content: json({ type: "object", properties: { total: { type: "integer" }, provinces: { type: "array", items: option }, cities: { type: "array", items: option }, categories: { type: "array", items: option }, organizations: { type: "integer" }, education: { type: "array", items: { type: "string" } }, interview: { type: "array", items: { type: "string" } }, organizationTypes: { type: "array", items: { type: "string" } }, meta: { $ref: "#/components/schemas/Metadata" } } }) }, ...errorResponses } } },
    },
    components: { schemas: { Job: job, Metadata: metadata, Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } } } } },
  };
}
