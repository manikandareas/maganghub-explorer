import { randomUUID } from "node:crypto";

export function ingestFixture(patch: Record<string, unknown> = {}) {
  return { id: randomUUID(), title: "Backend Developer", organization: "Fixture Ingest", organizationType: "company",
    province: "Sulawesi Selatan", city: "Kota Makassar", quota: 5, applicants: 2, education: ["sarjana"],
    programs: ["Informatika"], interview: ["online"], days: 5, disability: false,
    description: "Mengembangkan backend TypeScript dan PostgreSQL.", address: "Makassar", ...patch };
}
export const fixtureTime = "2026-10-31T00:00:00.000Z";
