/**
 * Next.js response cache kept in this process's memory instead of .next/server/route-cache.
 *
 * The disk cache is keyed by route, not by build, and lives in a folder the Git deployment never
 * empties. On the Plesk host something kept writing an old build's /login page (with its old
 * /school/_next/... asset URLs) back into it, so visitors got an unstyled page with 404s. With this
 * handler a page is rendered from the running build on its first request and cached only here, so
 * nothing outside this process — an older release, another app, a leftover file — can serve it.
 *
 * One Node.js process serves the site, so a per-process cache loses nothing. Restarting the app
 * starts it empty.
 */

const MAX_ENTRIES = 1000;
const entries = new Map();

function tagsOf(data, ctx) {
  const tags = new Set(ctx && Array.isArray(ctx.tags) ? ctx.tags : []);
  // Page and route responses carry their tags (including revalidatePath's) in this header.
  const header = data && data.headers && data.headers["x-next-cache-tags"];
  if (typeof header === "string") for (const tag of header.split(",")) if (tag) tags.add(tag);
  return tags;
}

module.exports = class MemoryCacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    // Refresh recency so the least recently used entry is evicted first.
    entries.delete(key);
    entries.set(key, entry);
    return { value: entry.value, lastModified: entry.lastModified };
  }

  async set(key, data, ctx) {
    if (data === null || data === undefined) {
      entries.delete(key);
      return;
    }
    entries.delete(key);
    entries.set(key, { value: data, lastModified: Date.now(), tags: tagsOf(data, ctx) });
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  }

  async revalidateTag(tags) {
    const wanted = new Set([tags].flat().filter(Boolean));
    if (wanted.size === 0) return;
    for (const [key, entry] of entries) {
      for (const tag of entry.tags) {
        if (wanted.has(tag)) {
          entries.delete(key);
          break;
        }
      }
    }
  }

  resetRequestCache() {}
};
