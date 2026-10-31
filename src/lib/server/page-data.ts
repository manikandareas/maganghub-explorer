import { cache } from "react";
import { headers } from "next/headers";
import { getCatalogInfo, findJob } from "./catalog-repository";
import { admitRequest, clientIdentity } from "./limits";

export const pageCatalog = cache(getCatalogInfo);
export const pageIdentity = cache(async () => {
  const identity = clientIdentity(await headers());
  await admitRequest(identity);
  return identity;
});
export const pageJob = cache(async (id: string) => {
  const [catalog] = await Promise.all([pageCatalog(), pageIdentity()]);
  return findJob(id, catalog);
});
