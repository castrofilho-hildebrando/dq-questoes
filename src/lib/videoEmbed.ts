/**
 * Converts a video URL (YouTube or Google Drive) into an embeddable iframe src.
 * Returns the original URL unchanged for any other provider.
 */
export function toVideoEmbed(url: string): string {
  try {
    const u = new URL(url);

    // YouTube – short link
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}?modestbranding=1&rel=0`;
    }

    // YouTube – standard link
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?modestbranding=1&rel=0`;
      if (u.pathname.startsWith("/embed/")) {
        // Already an embed link – preserve and add params if missing
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}modestbranding=1&rel=0`;
      }
    }

    // Google Drive – convert /view or /edit to /preview
    if (u.hostname === "drive.google.com") {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
  } catch {
    // invalid URL – fall through
  }
  return url;
}
