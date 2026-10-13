import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" throws outside a React Server Components bundle; tests run plain Node.
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"], setupFiles: ["./src/test/setup.ts"], testTimeout: 20000 },
});
