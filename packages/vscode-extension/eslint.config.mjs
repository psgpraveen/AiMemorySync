import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "releases/**", "node_modules/**", "*.vsix"],
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {},
  },
];
