import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              importNames: ["useQuery", "useMutation"],
              message: "Use wrapper hooks from @/shared/api instead of useQuery/useMutation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/api/**"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
