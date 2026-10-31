import type { IngestRecord } from "./ingest-input";
import { compareJobTitles } from "./job-record";

export type AlphabeticalJob = { id: string; title: string; portalOrder: number; azOrder: number };

export function orderIngestRecords(existing: AlphabeticalJob[], records: IngestRecord[]) {
  const byId = new Map(existing.map(job => [job.id, job]));
  const maximumPortalOrder = existing.reduce((maximum, job) => Math.max(maximum, job.portalOrder), -1);
  records.forEach((record, index) => {
    byId.set(record.id, { id: record.id, title: record.payload.title, portalOrder: byId.get(record.id)?.portalOrder ?? maximumPortalOrder + index + 1, azOrder: byId.get(record.id)?.azOrder ?? -1 });
  });
  const ordered = [...byId.values()].sort((left, right) => compareJobTitles(left.title, right.title) || left.portalOrder - right.portalOrder || left.id.localeCompare(right.id));
  const ranks = ordered.flatMap((job, index) => job.azOrder !== index ? [{ id: job.id, az_order: index }] : []);
  const positions = new Map(ordered.map((job, index) => [job.id, index]));
  return { records: records.map(record => ({ ...record, az_order: positions.get(record.id)! })), ranks };
}
