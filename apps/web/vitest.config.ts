import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@specs": path.resolve(__dirname, "../../specs")
    }
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"]
  }
});
