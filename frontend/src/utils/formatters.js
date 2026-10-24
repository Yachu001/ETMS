/**
 * Short Display Name Formatter:
 * - Uses full_name up to the first two words if available.
 * - Otherwise falls back to username.
 */
export function getShortDisplayName(fullName, username) {
    if (fullName && fullName.trim().length > 0) {
      const words = fullName.trim().split(/\s+/);
      return words.slice(0, 2).join(' ');
    }
    return username || 'System';
  }
  
  /**
   * Audit Date & Time Formatter:
   * Returns { date: 'YYYY/MM/DD', time: 'HH:mm:ss' }
   */
  export function formatAuditDateTime(timestamp, formattedString) {
    if (formattedString && formattedString.includes(' -- ')) {
      const parts = formattedString.split(' -- ');
      return { date: parts[0], time: parts[1] };
    }
    if (!timestamp) return { date: '—', time: '—' };
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { date: dateStr, time: timeStr };
  }
  
  /**
   * Text Truncate with safe fallback
   */
  export function truncateText(text, maxChars = 40) {
    if (!text) return '—';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
  }