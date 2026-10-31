import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/config";
import { getCatalogInfo } from "@/lib/server/catalog-repository";
import { query } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalogInfo();
  const rows = await query<{ id: string; observedAt: string | null }>("SELECT id::text,observed_at AS \"observedAt\" FROM mh_jobs WHERE snapshot_id=$1 ORDER BY portal_order", [catalog.id]);
  return [{ url: siteUrl(), lastModified: catalog.lastIngestedAt ?? catalog.snapshotDate }, { url: `${siteUrl()}/api-docs` }, ...rows.map(row => ({ url: `${siteUrl()}/lowongan/${row.id}`, lastModified: row.observedAt ?? catalog.snapshotDate }))];
}
