import "server-only";

// Photos for the school's public page. Only raster images are accepted (never SVG, which can carry
// script), and the type is read from the file's first bytes, not its name.

export const MAX_PR_IMAGE_BYTES = 8 * 1024 * 1024;

export function detectImageType(bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: ".jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: "image/png", extension: ".png" };
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: ".webp" };
  return null;
}

/** The URL a page uses to show a PR photo (approved photos are public). */
export function prMediaPath(mediaId: string) {
  return `/api/pr-media/${mediaId}`;
}
