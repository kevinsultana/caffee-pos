'use server';

import { prisma } from '@/lib/prisma';
import { verifySession } from '@/app/actions/auth';

async function getAuthenticatedOwner() {
  const user = await verifySession();
  if (!user) throw new Error('Sesi tidak valid. Silakan login kembali.');
  if (user.role?.name !== 'OWNER') {
    throw new Error('Akses ditolak. Fitur Audit Log hanya dapat diakses oleh Owner / Super Admin.');
  }
  return { user, storeId: user.storeId };
}

/**
 * Mengambil daftar catatan rekam jejak sistem (Audit Log).
 * Catatan ini bersifat kekal (Immutable) dan tidak memiliki Server Action untuk edit / delete.
 */
export async function getAuditLogs({ limit = 100, module = 'ALL' } = {}) {
  try {
    const { storeId } = await getAuthenticatedOwner();

    const whereClause = { storeId };
    if (module && module !== 'ALL') {
      whereClause.module = module;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      take: Math.min(Number(limit) || 100, 200),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    const serializedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      entityType: log.entityType,
      entityId: log.entityId,
      changeSummary: log.changeSummary,
      beforeData: log.beforeData,
      afterData: log.afterData,
      success: log.success,
      deviceId: log.deviceId,
      createdAt: log.createdAt,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            username: log.user.username,
            roleName: log.user.role?.name || 'User',
          }
        : {
            name: 'Sistem Otomatis',
            username: 'system',
            roleName: 'SYSTEM',
          },
    }));

    return { data: serializedLogs };
  } catch (error) {
    console.error('[getAuditLogs] Error:', error);
    return { error: error.message || 'Gagal memuat catatan Audit Log.' };
  }
}
