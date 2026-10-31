import "./env";
import { argument, reportError } from "./env";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { activateCatalog } from "../src/lib/server/catalog-repository";

activateCatalog(argument("snapshot") ?? prepareCatalog().id).then(result => console.log(JSON.stringify({ event: "activated", snapshotId: result.snapshot_id }))).catch(reportError);
