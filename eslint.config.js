import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize FlatCompat to use legacy configs
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  // Global ignores
  {
    ignores: ["**/node_modules/**", "**/dist/**", "lib/lib/**", "**/.next/**"]
  },
  
  // Base configuration for all files
  js.configs.recommended,
  
  // TypeScript configuration
  ...tseslint.configs.recommended,
  
  // React configuration using FlatCompat for legacy configs
  ...compat.extends(
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "prettier"
  ),
  
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    
    plugins: {
      react
    },
    
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: "latest",
      sourceType: "module",
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
      "react/display-name": "off",
    },
  }
];