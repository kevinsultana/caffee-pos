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

  const roleConfigs = [
    {
      name: 'OWNER',
      description: 'System root admin with full unrestricted access',
      permissions: [],
    },
    {
      name: 'MANAGER',
      description: 'Operations manager with operational and reporting access',
      permissions: [
        'MENU_DASHBOARD', 'MENU_POS', 'MENU_POS_HISTORY', 'MENU_CASH_FLOW', 'MENU_QR_TABLE',
        'MENU_PRODUCTS', 'MENU_CATEGORIES', 'MENU_PROMOTIONS', 'MENU_CUSTOMERS',
        'MENU_INVENTORY', 'MENU_PURCHASING', 'MENU_STOCK_CARD', 'MENU_OPNAME',
        'MENU_SUPPLIERS', 'MENU_INVENTORY_SETUP', 'MENU_ROLES', 'MENU_AUDIT'
      ],
    },
    {
      name: 'CASHIER',
      description: 'Front-desk cashier with POS and cash handling access',
      permissions: ['MENU_POS', 'MENU_POS_HISTORY', 'MENU_CASH_FLOW', 'MENU_CUSTOMERS'],
    },
    {
      name: 'INVENTORY_STAFF',
      description: 'Warehouse staff managing stock, purchasing, and opnames',
      permissions: [
        'MENU_INVENTORY', 'MENU_PURCHASING', 'MENU_STOCK_CARD',
        'MENU_OPNAME', 'MENU_SUPPLIERS', 'MENU_INVENTORY_SETUP'
      ],
    },
  ];
  const roles = {};

  for (const config of roleConfigs) {
    const role = await prisma.role.upsert({
      where: {
        storeId_name: { storeId: store.id, name: config.name },
      },
      update: {
        permissions: config.permissions,
      },
      create: {
        storeId: store.id,
        name: config.name,
        description: config.description,
        permissions: config.permissions,
        isSystem: true,
      },
    });
    roles[config.name] = role;
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
