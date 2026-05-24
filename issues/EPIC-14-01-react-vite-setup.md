# [Epic-14] Setup React + Vite + TypeScript

**Labels**: `epic-14`, `good-first-issue`, `area-frontend`
**Estimate**: 1 jam
**Depends on**: #1

## Context

Frontend dashboard pakai Vite + React + TypeScript.

## Acceptance Criteria

- [ ] `packages/web/package.json`
- [ ] `vite.config.ts`
- [ ] `tsconfig.json`
- [ ] `src/main.tsx` + `src/App.tsx` skeleton
- [ ] Run `pnpm dev` jalan di port 5173
- [ ] Build `pnpm build` produce `dist/`

## Implementation Hints

```bash
pnpm -F @flowforge/web add react react-dom
pnpm -F @flowforge/web add -D vite @vitejs/plugin-react @types/react @types/react-dom
```

`packages/web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
```

`packages/web/index.html`:

```html
<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8" /><title>FlowForge</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/web/src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(<App />);
```

`packages/web/src/App.tsx`:

```tsx
export function App() {
  return <h1>FlowForge Dashboard</h1>;
}
```

`packages/web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Files Involved

- `packages/web/package.json`
- `packages/web/vite.config.ts`
- `packages/web/index.html`
- `packages/web/src/main.tsx`
- `packages/web/src/App.tsx`

## How to Verify

```bash
pnpm -F @flowforge/web dev
# Buka http://localhost:5173 → "FlowForge Dashboard"
```
