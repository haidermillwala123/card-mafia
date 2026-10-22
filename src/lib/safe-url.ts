// Source links come from the database. Only https links are allowed to become an href, so a bad row cannot plant a javascript: or data: link.
export function safeUrl(u: string | null | undefined): string {
  if (!u) return '';
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}
