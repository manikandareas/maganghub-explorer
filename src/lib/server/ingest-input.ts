import { categoryOf } from "../job-categories";
import type { Facets, JobDetail, Option } from "../job-types";
import { SOURCE_URL } from "./config";
import { ServiceError } from "./errors";
import { jobOpportunityScore, jobSearchRecord } from "./job-record";

export const INGEST_BATCH_LIMIT = 50;
export const INGEST_BODY_LIMIT = 2 * 1024 * 1024;
const EDUCATION = { diploma: [1, "Diploma"], sarjana: [2, "Sarjana"], profesi: [4, "Profesi"] } as const;
const INTERVIEW = { online: [1, "Daring"], onsite: [2, "Tatap muka"] } as const;
const FIELDS = ["id", "title", "organization", "organizationType", "province", "city", "quota", "applicants", "education", "programs", "interview", "days", "disability", "description", "address"];

function invalid(field: string): never {
  throw new ServiceError("INVALID_INGEST", `Field ${field} tidak valid. Lihat docs/bot-ingestion.md.`, 400);
}
function object(value: unknown, fields: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(path);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(record, key))) return invalid(path);
  return record;
}
function text(value: unknown, path: string, maximum: number, allowEmpty = false): string {
  if (allowEmpty && value === null) return "";
  if (typeof value !== "string" || value.includes("\0") || value.length > maximum || (!allowEmpty && !value.trim())) return invalid(path);
  return value.trim();
}
function integer(value: unknown, path: string, maximum: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maximum) return invalid(path);
  return value;
}
function list(value: unknown, path: string, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) return invalid(path);
  const items = value.map((item, index) => text(item, `${path}[${index}]`, 200));
  if (new Set(items).size !== items.length) return invalid(path);
  return items;
}
function choices<T extends Record<string, readonly [number, string]>>(value: unknown, path: string, options: T) {
  const items = list(value, path, Object.keys(options).length);
  if (items.some(item => !Object.hasOwn(options, item))) return invalid(path);
  const selected = Object.entries(options).filter(([key]) => items.includes(key)).map(([, entry]) => entry);
  return { mask: selected.reduce((mask, [bit]) => mask | bit, 0), labels: selected.map(([, label]) => label) };
}

export function parseIngestInput(value: unknown, now = Date.now()) {
  const input = object(value, ["observedAt", "jobs"], "body");
  const observedAt = text(input.observedAt, "observedAt", 30);
  const time = Date.parse(observedAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(observedAt) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== observedAt.slice(0, 19) || time > now + 5 * 60 * 1000) invalid("observedAt");
  if (!Array.isArray(input.jobs) || input.jobs.length < 1 || input.jobs.length > INGEST_BATCH_LIMIT) invalid("jobs");
  const ids = new Set<string>();
  const jobs = input.jobs.map((value, index) => {
    const path = `jobs[${index}]`;
    const job = object(value, FIELDS, path);
    const id = text(job.id, `${path}.id`, 36).toLowerCase();
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(id) || ids.has(id)) invalid(`${path}.id`);
    ids.add(id);
    const title = text(job.title, `${path}.title`, 300);
    if (job.organizationType !== "company" && job.organizationType !== "government") invalid(`${path}.organizationType`);
    if (typeof job.disability !== "boolean") invalid(`${path}.disability`);
    const education = choices(job.education, `${path}.education`, EDUCATION);
    const interview = choices(job.interview, `${path}.interview`, INTERVIEW);
    const quota = integer(job.quota, `${path}.quota`, 1000000);
    const applicants = integer(job.applicants, `${path}.applicants`, 10000000);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const payload: JobDetail = {
      id, title, organization: text(job.organization, `${path}.organization`, 300), organizationType: job.organizationType === "company" ? 0 : 1,
      province: text(job.province, `${path}.province`, 200), city: text(job.city, `${path}.city`, 200), quota, applicants,
      education: education.labels, programs: list(job.programs, `${path}.programs`, 100), interview: interview.labels,
      days: integer(job.days, `${path}.days`, 7), disability: job.disability, category: categoryOf(title),
      score: jobOpportunityScore(quota, applicants),
      url: `${SOURCE_URL}magang-nasional/lowongan/${slug}-${id}`,
      description: text(job.description, `${path}.description`, 20000, true), address: text(job.address, `${path}.address`, 2000, true),
    };
    if (/^\$[a-z\d]+$/i.test(payload.description)) payload.description = "";
    if (jobSearchRecord(payload).embedding_text.length > 24000) invalid(`${path}.description/programs`);
    return { payload, educationMask: education.mask, interviewMask: interview.mask };
  });
  return { observedAt: new Date(time).toISOString(), jobs };
}
export type IngestInput = ReturnType<typeof parseIngestInput>;

// Location identifiers are internal, stable numeric codes. New labels extend the
// catalog's registry; callers never need to know codes from the original files.
const locationKey = (label: string) => label.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function location(options: Option[], label: string, province?: string) {
  const match = options.find(option => locationKey(option.label) === locationKey(label) && (province === undefined || option.province === province));
  if (match) return match;
  const next = { value: String(Math.max(-1, ...options.map(option => Number(option.value))) + 1), label, ...(province !== undefined ? { province } : {}) };
  options.push(next);
  return next;
}
export function prepareIngestRecords(input: IngestInput, facets: Facets) {
  const provinces = facets.provinces.map(option => ({ ...option }));
  const cities = facets.cities.map(option => ({ ...option }));
  const records = input.jobs.map(({ payload: source, educationMask, interviewMask }) => {
    if (!locationKey(source.province) || !locationKey(source.city)) invalid("province/city");
    const province = location(provinces, source.province);
    const city = location(cities, source.city, province.value);
    const payload = { ...source, province: province.label, city: city.label };
    const search = jobSearchRecord(payload);
    if (search.embedding_text.length > 24000) invalid("description/programs");
    return {
      id: payload.id, payload, az_order: 0, province_code: Number(province.value), city_code: Number(city.value), category: payload.category,
      organization_type: payload.organizationType, education_mask: educationMask, interview_mask: interviewMask,
      disability: payload.disability, quota: payload.quota, applicants: payload.applicants, opportunity_score: payload.score,
      ...search,
    };
  });
  return { records, provinces, cities };
}
export type IngestRecord = ReturnType<typeof prepareIngestRecords>["records"][number];
