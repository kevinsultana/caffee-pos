/**
 * Utility functions for the POS application
 */

/**
 * Combines class names, filtering out falsy values.
 * @param {...string} classes
 * @returns {string}
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats a number as Indonesian Rupiah currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Formats a raw number into Indonesian thousand-separated string (e.g. 1500000 -> "1.500.000")
 * @param {number|string} val
 * @returns {string}
 */
export function formatThousand(val) {
  if (val === undefined || val === null || val === '') return '';
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  return Number(numStr).toLocaleString('id-ID');
}

/**
 * Parses a thousand-separated string into a pure integer/number (e.g. "1.500.000" -> 1500000)
 * @param {string|number} val
 * @returns {number}
 */
export function parseThousand(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * Formats a date to a readable Indonesian format.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formats a date to include time.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTime(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Truncates a string to a given length.
 * @param {string} str
 * @param {number} length
 * @returns {string}
 */
export function truncate(str, length = 50) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

/**
 * Generates a random order number.
 * @returns {string}
 */
export function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
}
