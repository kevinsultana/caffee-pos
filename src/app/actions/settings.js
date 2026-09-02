'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';

/**
 * Baca Store & StoreSettings untuk toko utama (MAIN).
 */
export async function getStoreSettings() {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  try {
    const store = await prisma.store.findUnique({
      where: { code: 'MAIN' },
      include: { settings: true },
    });

    if (!store) return { error: 'Store tidak ditemukan.' };

    return {
      data: {
        storeName: store.name,
        storeCode: store.code,
        settings: store.settings
          ? {
              id: store.settings.id,
              storeId: store.settings.storeId,
              taxEnabled: store.settings.taxEnabled,
              taxRate: Number(store.settings.taxRate),
              taxBaseIncludesServiceCharge: store.settings.taxBaseIncludesServiceCharge,
              serviceChargeEnabled: store.settings.serviceChargeEnabled,
              serviceChargeRate: Number(store.settings.serviceChargeRate),
              cashRoundingEnabled: store.settings.cashRoundingEnabled,
              cashRoundingUnit: Number(store.settings.cashRoundingUnit),
              timezone: store.settings.timezone,
            }
          : null,
      },
    };
  } catch (error) {
    console.error('[settings/getStoreSettings]', error);
    return { error: 'Gagal memuat pengaturan.' };
  }
}

/**
 * Perbarui StoreSettings untuk toko MAIN.
 *
 * @param {{
 *   taxEnabled: boolean,
 *   taxRate: number,
 *   taxBaseIncludesServiceCharge: boolean,
 *   serviceChargeEnabled: boolean,
 *   serviceChargeRate: number,
 *   cashRoundingEnabled: boolean,
 *   cashRoundingUnit: number,
 * }} payload
 */
export async function updateStoreSettings(payload) {
  const user = await verifySession();
  if (!user) return { error: 'Sesi tidak valid. Silakan login kembali.' };

  const {
    taxEnabled,
    taxRate,
    taxBaseIncludesServiceCharge,
    serviceChargeEnabled,
    serviceChargeRate,
    cashRoundingEnabled,
    cashRoundingUnit,
  } = payload;

  // ── Validasi nilai rate ───────────────────────────────────────────────
  if (taxEnabled && (isNaN(taxRate) || taxRate < 0 || taxRate > 100)) {
    return { error: 'Tax rate harus antara 0 – 100.' };
  }
  if (
    serviceChargeEnabled &&
    (isNaN(serviceChargeRate) || serviceChargeRate < 0 || serviceChargeRate > 100)
  ) {
    return { error: 'Service charge rate harus antara 0 – 100.' };
  }

  try {
    const store = await prisma.store.findUnique({ where: { code: 'MAIN' } });
    if (!store) return { error: 'Store tidak ditemukan.' };

    await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: {
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
      },
      create: {
        storeId: store.id,
        taxEnabled,
        taxRate,
        taxBaseIncludesServiceCharge,
        serviceChargeEnabled,
        serviceChargeRate,
        cashRoundingEnabled,
        cashRoundingUnit,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[settings/updateStoreSettings]', error);
    return { error: 'Gagal menyimpan pengaturan.' };
  }
}
