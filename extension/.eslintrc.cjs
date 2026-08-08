/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, webextensions: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", "*.config.ts", "vite.config.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
};
