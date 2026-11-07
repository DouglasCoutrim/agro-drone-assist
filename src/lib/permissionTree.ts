/** Returns a new blocked list after granting (allow=true) or revoking the given hrefs. */
export function toggleHrefs(blocked: string[], hrefs: string[], allow: boolean): string[] {
  if (allow) return blocked.filter((h) => !hrefs.includes(h));
  return Array.from(new Set([...blocked, ...hrefs]));
}
