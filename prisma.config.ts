import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    // ── Runtime queries (App) ──────────────────────────────────────────
    // Gunakan Transaction Pooler (port 6543) untuk efisiensi koneksi.
    url: env('DATABASE_URL'),

    // ── Migrations & Schema Engine ─────────────────────────────────────
    // WAJIB menggunakan Session Pooler (port 5432) atau Direct Connection.
    // Pooler transaction mode (6543) TIDAK support migrasi.
    directUrl: env('DIRECT_URL'),
  },
});
