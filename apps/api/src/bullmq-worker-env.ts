import * as path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

process.env.BULLMQ_PROCESS_ROLE = "worker";
if (!process.env.INTEGRATION_BULLMQ?.trim()) {
  process.env.INTEGRATION_BULLMQ = "1";
}
