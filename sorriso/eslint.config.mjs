import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Server-side modules client components must never import (data access, secrets, all-locale dictionaries). */
const SERVER_ONLY_IMPORTS = [
  { name: "@/db", message: "Client components can't touch the database." },
  { name: "server-only", message: "Not in client components." },
  { name: "@/i18n/server", message: "Use useT() / <ClientMessages> in client components." },
  { name: "@/i18n/t", message: "Bundles every locale: use useT() in client components." },
  { name: "@/i18n/registry", message: "Bundles every locale: use useT() in client components." },
  { name: "@/i18n/messages", message: "Bundles every locale: use useT() in client components." },
  { name: "@/lib/crypto", message: "Server-only." },
  { name: "@/lib/audit", message: "Server-only." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow omitting fields with `const { secret, ...rest } = obj`.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
      // Logs must go through src/lib/log.ts (redacts phones/emails).
      "no-console": "error",
    },
  },
  {
    files: ["src/lib/log.ts", "scripts/**", "public/**"],
    rules: { "no-console": "off" },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            ...SERVER_ONLY_IMPORTS,
            { name: "@/db/schema", allowTypeImports: true, message: "Import values from @/db/enums in client code." },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "navigator", property: "language", message: "Use useLocale(): the page locale decides the language." },
        { object: "navigator", property: "languages", message: "Use useLocale(): the page locale decides the language." },
      ],
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
