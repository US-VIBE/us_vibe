const fs = require("fs");

const requiredFiles = ["specs/openapi/v1.yaml", "specs/api-contract.md"];
const missing = requiredFiles.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error("Missing contract files:", missing.join(", "));
  process.exit(1);
}

console.log("API contract files exist.");
