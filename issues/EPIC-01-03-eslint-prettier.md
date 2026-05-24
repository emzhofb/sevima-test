# [Epic-01] Setup ESLint + Prettier

**Labels**: `epic-01`, `good-first-issue`, `area-tooling`
**Estimate**: 1.5 jam
**Depends on**: #2 (typescript config)

## Context

Linter + formatter untuk konsistensi style. Pakai ESLint flat config (modern) + Prettier.

## Acceptance Criteria

- [ ] `eslint.config.js` di root dengan rule TypeScript
- [ ] `.prettierrc.json` dengan setting konsisten
- [ ] Script `pnpm lint` dan `pnpm format` jalan
- [ ] Tidak ada error pada codebase awal

## Implementation Hints

Install:

```bash
pnpm add -Dw eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

`eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  }
);
```

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Scripts di root `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

## Files Involved

- `eslint.config.js`
- `.prettierrc.json`
- `.prettierignore`
- Update `package.json`

## How to Verify

```bash
pnpm lint
pnpm format:check
```
