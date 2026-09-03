import { PrismaClient } from '@prisma/client';

/**
 * Konfigurasi Prisma Client untuk Environment Serverless / Next.js
 *
 * PENTING untuk Supabase Connection Pooler (PgBouncer / Transaction Mode Port 6543):
 * Pastikan URL DATABASE_URL di file .env WAJIB memiliki akhiran:
 * ?pgbouncer=true&connection_limit=1
 *
 * Contoh format URL Supabase Pooler:
 * DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
 * DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
 *
 * Konfigurasi ini krusial untuk:
 * 1. Mencegah Connection Starvation / Pool Exhaustion pada Supabase (PostgreSQL max connections limit).
 * 2. Mencegah kebocoran memori koneksi pada Next.js Server Actions dan Serverless Lambdas.
 * 3. Menjamin latensi rendah (<100ms) dengan penggunaan connection pooler Supabase (Singapore region).
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
};

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
