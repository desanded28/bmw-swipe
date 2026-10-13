import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow omitting fields with `const { secret, ...rest } = obj`.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    },
  },
  {
    // Async server components render once per request, so reading the clock is fine there.
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
