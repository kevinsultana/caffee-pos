/**
 * src/lib/permissions.js
 * Master Permissions & Route Access Mapping untuk RBAC Schaw Cafe
 */

export const MENU_PERMISSIONS = [
  {
    code: 'MENU_DASHBOARD',
    label: 'Akses Dashboard & Ringkasan Bisnis',
    description: 'Melihat ringkasan metrik penjualan, grafik pendapatan, dan pesanan terbaru.',
    category: 'Utama',
    defaultRoute: '/dashboard',
  },
  {
    code: 'MENU_POS',
    label: 'Akses Layar Kasir (POS)',
    description: 'Membuka shift kasir, memilih produk, menerima pesanan, dan mencetak struk.',
    category: 'Utama',
    defaultRoute: '/dashboard/pos',
  },
  {
    code: 'MENU_CASH_FLOW',
    label: 'Akses Arus Kas Kasir (In/Out)',
    description: 'Mencatat kas masuk modal tambahan dan pengeluaran kas kecil kasir.',
    category: 'Utama',
    defaultRoute: '/dashboard/pos/cash',
  },
  {
    code: 'MENU_QR_TABLE',
    label: 'Akses Generate QR Meja',
    description: 'Membuat dan mencetak barcode QR meja untuk pesanan pelanggan.',
    category: 'Utama',
    defaultRoute: '/dashboard/qr',
  },
  {
    code: 'MENU_PRODUCTS',
    label: 'Akses Daftar Menu Produk',
    description: 'Melihat, menambah, mengedit menu jual, harga dasar, dan varian.',
    category: 'Master Produk & Pelanggan',
    defaultRoute: '/dashboard/products/list',
  },
  {
    code: 'MENU_CATEGORIES',
    label: 'Akses Kategori Menu',
    description: 'Mengatur kategori menu jual (Kopi, Makanan, Minuman, dll.).',
    category: 'Master Produk & Pelanggan',
    defaultRoute: '/dashboard/products/categories',
  },
  {
    code: 'MENU_PROMOTIONS',
    label: 'Akses Promosi & Diskon',
    description: 'Mengatur kode promo, potongan harga, dan program loyalitas.',
    category: 'Master Produk & Pelanggan',
    defaultRoute: '/dashboard/promotions',
  },
  {
    code: 'MENU_CUSTOMERS',
    label: 'Akses Database Pelanggan',
    description: 'Melihat daftar member, riwayat kunjungan, dan menambah pelanggan.',
    category: 'Master Produk & Pelanggan',
    defaultRoute: '/dashboard/customers',
  },
  {
    code: 'MENU_INVENTORY',
    label: 'Akses Daftar Bahan Baku',
    description: 'Melihat stok fisik bahan mentah, resep, dan batas minimum stok.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/items',
  },
  {
    code: 'MENU_PURCHASING',
    label: 'Akses Menu Pembelian (Purchasing)',
    description: 'Membuat Purchase Order ke supplier dan mencatat penerimaan barang.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/purchases',
  },
  {
    code: 'MENU_STOCK_CARD',
    label: 'Akses Kartu Stok (Mutasi)',
    description: 'Melihat rekam jejak historis pergerakan stok masuk dan keluar.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/movements',
  },
  {
    code: 'MENU_OPNAME',
    label: 'Akses Stock Opname',
    description: 'Melakukan rekonsiliasi fisik stok dan mencatat penyesuaian selisih.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/opname',
  },
  {
    code: 'MENU_SUPPLIERS',
    label: 'Akses Supplier / Vendor',
    description: 'Mengelola database kontak pemasok bahan baku.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/suppliers',
  },
  {
    code: 'MENU_INVENTORY_SETUP',
    label: 'Akses Unit & Kategori Bahan',
    description: 'Mengatur satuan ukur (gram, ml, pcs) dan kategori bahan baku.',
    category: 'Inventaris & Pengadaan',
    defaultRoute: '/dashboard/inventory/setup',
  },
  {
    code: 'MENU_USERS',
    label: 'Akses Karyawan & Hak Akses (Roles)',
    description: 'Mengelola akun staf karyawan dan membuat peran serta permissions kustom.',
    category: 'Administrasi Sistem',
    defaultRoute: '/dashboard/users',
  },
  {
    code: 'MENU_AUDIT',
    label: 'Akses Audit Log',
    description: 'Melihat jejak audit seluruh aktivitas transaksi dan mutasi data.',
    category: 'Administrasi Sistem',
    defaultRoute: '/dashboard/audit',
  },
  {
    code: 'MENU_SETTINGS',
    label: 'Akses Pengaturan Toko',
    description: 'Mengubah profil cafe, konfigurasi pajak, biaya layanan, dan printer.',
    category: 'Konfigurasi',
    defaultRoute: '/dashboard/settings',
  },
];

/**
 * Pemetaan URL Dashboard ke Kode Permissions yang Dibutuhkan
 * Diurutkan dari yang paling spesifik ke umum.
 */
export const ROUTE_PERMISSION_MAP = [
  { prefix: '/dashboard/pos/cash', permission: 'MENU_CASH_FLOW' },
  { prefix: '/dashboard/pos', permission: 'MENU_POS' },
  { prefix: '/dashboard/qr', permission: 'MENU_QR_TABLE' },
  { prefix: '/dashboard/products/categories', permission: 'MENU_CATEGORIES' },
  { prefix: '/dashboard/products', permission: 'MENU_PRODUCTS' },
  { prefix: '/dashboard/promotions', permission: 'MENU_PROMOTIONS' },
  { prefix: '/dashboard/customers', permission: 'MENU_CUSTOMERS' },
  { prefix: '/dashboard/inventory/purchases', permission: 'MENU_PURCHASING' },
  { prefix: '/dashboard/inventory/movements', permission: 'MENU_STOCK_CARD' },
  { prefix: '/dashboard/inventory/opname', permission: 'MENU_OPNAME' },
  { prefix: '/dashboard/inventory/suppliers', permission: 'MENU_SUPPLIERS' },
  { prefix: '/dashboard/inventory/setup', permission: 'MENU_INVENTORY_SETUP' },
  { prefix: '/dashboard/inventory', permission: 'MENU_INVENTORY' },
  { prefix: '/dashboard/roles', permission: 'MENU_USERS' },
  { prefix: '/dashboard/users', permission: 'MENU_USERS' },
  { prefix: '/dashboard/audit', permission: 'MENU_AUDIT' },
  { prefix: '/dashboard/settings', permission: 'MENU_SETTINGS' },
  { prefix: '/dashboard', permission: 'MENU_DASHBOARD', exact: true },
];

/**
 * Memeriksa apakah user memiliki permission tertentu.
 * Role OWNER memiliki bypass mutlak (akses penuh ke semua fitur).
 */
export function hasPermission(user, requiredPermission) {
  if (!user) return false;

  const roleName =
    typeof user.role === 'string'
      ? user.role
      : user.role?.name || '';

  if (roleName === 'OWNER') return true;
  if (!requiredPermission) return true;

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : Array.isArray(user.role?.permissions)
    ? user.role.permissions
    : [];

  return permissions.includes(requiredPermission);
}

/**
 * Mencari permission yang dibutuhkan untuk sebuah rute URL pathname.
 * Mengembalikan string permission code atau null jika tidak dibatasi.
 */
export function getRequiredPermissionForRoute(pathname) {
  for (const item of ROUTE_PERMISSION_MAP) {
    if (item.exact) {
      if (pathname === item.prefix) return item.permission;
    } else {
      if (pathname.startsWith(item.prefix)) return item.permission;
    }
  }
  return null;
}

/**
 * Menentukan rute landing page default pengguna berdasarkan peran dan hak aksesnya.
 * - OWNER atau pengguna dengan MENU_DASHBOARD -> /dashboard
 * - Pengguna tanpa MENU_DASHBOARD -> rute pertama yang diizinkan (misal Kasir -> /dashboard/pos)
 * - Fallback jika tidak ada izin -> /dashboard/pos (atau /dashboard)
 */
export function getDefaultRouteForUser(roleName, permissions = []) {
  if (roleName === 'OWNER') {
    return '/dashboard';
  }

  const userPermissions = Array.isArray(permissions) ? permissions : [];

  if (userPermissions.includes('MENU_DASHBOARD')) {
    return '/dashboard';
  }

  for (const perm of MENU_PERMISSIONS) {
    if (userPermissions.includes(perm.code) && perm.defaultRoute) {
      return perm.defaultRoute;
    }
  }

  return '/dashboard/pos';
}

