/**
 * Small display helpers shared by the dashboard, documents and profile pages.
 *
 * Kept in one place so dates and file sizes are formatted identically
 * everywhere rather than being re-derived per page.
 */

/** "12 Mar 2026" — unambiguous and short enough for a list row. */
export function formatDate(value) {
  if (!value) return 'Unknown date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "12 Mar 2026 at 14:05" for places with room for the time. */
export function formatDateTime(value) {
  if (!value) return 'Unknown date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return `${formatDate(value)} at ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Bytes as KB/MB. The backend stores the real size, so this never guesses. */
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;

  return `${(kb / 1024).toFixed(1)} MB`;
}
