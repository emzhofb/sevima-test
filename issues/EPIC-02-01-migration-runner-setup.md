# [Epic-02] Setup migration runner with node-pg-migrate

**Labels**: `epic-02`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #5 (docker-compose), #6 (config)

## Context

Kita butuh tool migrasi schema yang bisa apply/rollback. `node-pg-migrate` adalah pilihan ringan dan sudah teruji.

## Acceptance Criteria

- [ ] `node-pg-migrate` terinstall di root atau package terpisah `packages/db`
- [ ] Folder `migrations/` ada
- [ ] Script `pnpm migrate:up` dan `pnpm migrate:down` jalan
- [ ] README di `migrations/` menjelaskan cara buat migration baru

## Implementation Hints

```bash
pnpm add -Dw node-pg-migrate pg
```

`package.json` (root) tambahkan:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create"
  }
}
```

`.env.example` sudah punya `DATABASE_URL`. `node-pg-migrate` akan baca otomatis.

`migrations/README.md`:

```markdown
# Migrations

## Buat migration baru

\`\`\`bash
pnpm migrate:create nama_migration
\`\`\`

File baru muncul di `migrations/<timestamp>_nama_migration.js`.

## Apply migrations

\`\`\`bash
pnpm migrate:up
\`\`\`

## Rollback migration terakhir

\`\`\`bash
pnpm migrate:down
\`\`\`
```

## Files Involved

- `package.json`
- `migrations/README.md`

## How to Verify

```bash
docker compose up -d
pnpm migrate:create test_migration
ls migrations/
# Ada file <timestamp>_test_migration.js
# Boleh hapus file tersebut setelah verifikasi
```
