// The step-down suite owns its request-log runtime data: config/constants.ts
// bakes DATADIR (request-logs.sqlite, the raw-trace spool, and the admission
// DB) at module load, so this module must be the first import of the suite —
// it swaps CCR_INTERNAL_USER_DATA_DIR for a per-process temp home before any
// @ccr/core module is bundled. Without it the compiled suite shares the test
// runner's home with other suites (e.g. the integration wire tests) that write
// the same request-logs.sqlite in parallel processes. The suite removes the
// home in its after() hook.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const requestLogHome = mkdtempSync(path.join(tmpdir(), "ccr-step-down-request-log-home-"));
process.env.CCR_INTERNAL_USER_DATA_DIR = requestLogHome;
