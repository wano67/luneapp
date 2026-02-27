import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/ rules — disallow console.log in production code
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-build/**",
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/prisma/**",
    // Plain Node.js CJS scripts — not TypeScript/ESM
    "scripts/*.js",
  ]),
]);

export default eslintConfig;
