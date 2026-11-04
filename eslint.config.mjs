import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // False positive on async data-fetching effects: the rule cannot tell
      // `useEffect(() => load(), [load])` (setState after await — fine) apart
      // from synchronous `useEffect(() => setX(1), [])` (cascading render — bad).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "share-extracted/**",
    "backup-*/**",
    "*.broken-*",
    "*.bak-*",
  ]),
]);

export default eslintConfig;