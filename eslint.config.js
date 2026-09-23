import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Prettier owns formatting; everything here is about what the code *says*.
 *
 * The type-aware block is the important part. Every unhandled-rejection finding in the
 * audit — a button that silently did nothing because a promise rejected into the void —
 * is `no-floating-promises`, and a machine can find those faster and more reliably than
 * anyone reading the code.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules",
      "out",
      "release",
      "dist",
      ".sync",
      "tests/smoke/*.mjs",
      "scripts/*.mjs",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "@stylistic": stylistic, perfectionist },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // A promise nobody waits for and nobody catches is how a control ends up doing
      // nothing at all, in silence. `void` is NOT accepted as handling it: `void doThing()`
      // says "I know this is async", not "I know what happens when it fails". Each one has
      // to be awaited inside a try/catch, or end in a .catch that does something visible.
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
      // An async function where a void one is expected: an onClick whose rejection
      // reaches no one, a setTimeout that swallows a throw.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: true } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // ---- size, as a signal rather than a rule -----------------------------------
      // A file past this is usually several files that have not been separated yet.
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
      complexity: ["warn", 20],

      // ---- shape ------------------------------------------------------------------
      // One blank line before a block returns or a new declaration starts. Prettier has
      // no opinion about blank lines, so nothing here fights it.
      "@stylistic/padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: ["return", "function", "class", "export"] },
        { blankLine: "always", prev: ["function", "class", "interface", "type"], next: "*" },
        { blankLine: "any", prev: "export", next: "export" },
        { blankLine: "any", prev: "*", next: ["case", "default"] },
      ],
      "@stylistic/lines-between-class-members": ["warn", "always", { exceptAfterSingleLine: true }],
      // Imports read in one order everywhere: the platform, then the world, then this
      // app's own layers, then the file's neighbours.
      "perfectionist/sort-imports": [
        "warn",
        {
          type: "natural",
          newlinesBetween: "ignore",
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
            "style",
            "unknown",
          ],
          internalPattern: ["^@shared/.*", "^@main/.*", "^@/.*"],
        },
      ],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Tests are allowed to be long and to float a promise in a fixture.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "max-lines": "off",
      complexity: "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
  prettier,
);
