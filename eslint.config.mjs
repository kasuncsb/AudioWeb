import { dirname } from "path";
import { fileURLToPath } from "url";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react": reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      
      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // Disable rules that conflict with Next.js patterns
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  // TypeScript specific config
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...config.rules,
      // Allow unused vars with underscore prefix
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
      }],
    },
  })),
);
