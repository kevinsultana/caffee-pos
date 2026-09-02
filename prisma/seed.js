/**
 * prisma/seed.js
 * Database seeder untuk data awal proyek POS Schaw Cafe.
 * Jalankan dengan: npx prisma db seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Memulai database seed...\n');

  // ─── 1. Store ───────────────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Main Store',
      code: 'MAIN',
      settings: {
        create: {
          taxEnabled: false,
          taxRate: 0,
          taxBaseIncludesServiceCharge: false,
          serviceChargeEnabled: false,
          serviceChargeRate: 0,
          cashRoundingEnabled: false,
          cashRoundingUnit: 0,
          timezone: 'Asia/Jakarta',
        },
      },
    },
  });
  console.log(`✅ Store    : ${store.name} (code: ${store.code})`);

  // ─── 2. Roles ────────────────────────────────────────────────────────────────
  const roleNames = ['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF'];
  const roles = {};

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: {
        storeId_name: { storeId: store.id, name: roleName },
      },
      update: {},
      create: {
        storeId: store.id,
        name: roleName,
        description: `System role: ${roleName}`,
        isSystem: true,
      },
    });
    roles[roleName] = role;
    console.log(`✅ Role     : ${role.name}`);
  }

  // ─── 3. Owner User ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('owner123', 12);

  const user = await prisma.user.upsert({
    where: {
      storeId_username: { storeId: store.id, username: 'owner' },
    },
    update: {},
    create: {
      storeId: store.id,
      roleId: roles['OWNER'].id,
      username: 'owner',
      name: 'Owner',
      email: 'owner@schawcafe.com',
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log(`✅ User     : ${user.username} / ${user.name}`);

  console.log('\n🎉 Seed selesai dengan sukses!\n');
  console.log('─────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('  Username : owner');
  console.log('  Password : owner123');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
