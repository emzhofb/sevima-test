# Migrations

## Buat migration baru

```bash
pnpm migrate:create nama_migration
```

File baru akan muncul di `migrations/<timestamp>_nama_migration.js`.

## Apply migrations

```bash
pnpm migrate:up
```

## Rollback migration terakhir

```bash
pnpm migrate:down
```
