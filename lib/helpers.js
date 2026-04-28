// ═══════════════════════════════════════════════════════════
// ML-HUB UTILITY HELPERS
// Pure functions — no side effects, no imports needed.
// ═══════════════════════════════════════════════════════════

// ── DATE FORMATTING ────────────────────────────────────────

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "5 minutes ago", "3 days ago", "Jan 12, 2025"
 */
export function timeAgo(dateInput) {
  if (!dateInput) return '';

  const date  = new Date(dateInput);
  const now   = new Date();
  const diff  = Math.floor((now - date) / 1000); // seconds

  if (diff < 30)                    return 'just now';
  if (diff < 60)                    return `${diff} seconds ago`;
  if (diff < 3600)  {
    const m = Math.floor(diff / 60);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  }
  if (diff < 2592000) {
    const w = Math.floor(diff / 604800);
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  }

  // Older than ~30 days: show full date
  return formatDate(date);
}

/**
 * Formats a date as "Jan 12, 2025"
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return date.toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Formats a date as "Jan 12, 2025 at 3:45 PM"
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return date.toLocaleDateString('en-US', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ── FILE SIZE FORMATTING ───────────────────────────────────

/**
 * Converts raw bytes to a human-readable string.
 * e.g. formatFileSize(1048576) → "1.0 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const clamped = Math.min(index, units.length - 1);
  const value = bytes / Math.pow(1024, clamped);

  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[clamped]}`;
}

// ── TEXT UTILITIES ─────────────────────────────────────────

/**
 * Truncates a string to maxLength characters, appending "…".
 * e.g. truncate("Hello world", 8) → "Hello wo…"
 */
export function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Derives a display name from a profile object.
 * Falls back gracefully: full_name → username → email prefix → "User"
 */
export function getDisplayName(profile) {
  if (!profile) return 'User';
  if (profile.full_name?.trim()) return profile.full_name.trim();
  if (profile.username?.trim())  return profile.username.trim();
  if (profile.email)             return profile.email.split('@')[0];
  return 'User';
}

/**
 * Derives initials from a display name for avatar fallbacks.
 * e.g. "John Doe" → "JD", "alice" → "A"
 */
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── URL / FILE UTILITIES ───────────────────────────────────

/**
 * Extracts a clean filename from a Supabase storage path.
 * e.g. "articles/abc123/my-file.pdf" → "my-file.pdf"
 */
export function getFileName(filePath) {
  if (!filePath) return 'file';
  return filePath.split('/').pop() || 'file';
}

/**
 * Returns true if the file path / URL looks like a PDF.
 */
export function isPDF(filePath) {
  if (!filePath) return false;
  return filePath.toLowerCase().endsWith('.pdf');
}

/**
 * Builds a Supabase public storage URL for a given bucket and path.
 * Requires NEXT_PUBLIC_SUPABASE_URL to be set.
 */
export function getStorageUrl(bucket, path) {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

// ── NUMBER UTILITIES ───────────────────────────────────────

/**
 * Formats large numbers compactly.
 * e.g. 1200 → "1.2k", 1000000 → "1M"
 */
export function formatCount(n) {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/**
 * Clamps a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}