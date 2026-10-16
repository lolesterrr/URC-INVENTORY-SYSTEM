/**
 * What an asset label's QR code holds, shared by the browser and the server so a code printed by one is
 * read the same way by the other. Dependency-free.
 *
 * The code resolves to the asset's own record, which is what comparable asset systems do: a technician
 * points a phone at the sticker and the register opens on that asset. A bare id is the fallback, for a
 * label printed before anyone knew the server's address. Either way the id is printed on the label as
 * text, because a scan can fail and a sticker can be damaged.
 */

/** Query parameter the app reads on load to open one asset. */
export const ASSET_QUERY_PARAM = 'asset';

/**
 * Strips a base URL back to origin plus path, with no trailing slash, so the payload is as short as
 * possible: a shorter payload means fewer modules and a code that scans from further away.
 * Returns '' for anything unusable, which makes the payload fall back to the bare id.
 */
export function normaliseLabelBase(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return '';
  }
}

/**
 * The text encoded in the label for one asset. With a usable base it is a URL that opens the asset;
 * without one it is the asset id on its own, which is still enough to find the asset by hand.
 */
export function assetLabelPayload(base: string, assetId: string): string {
  const root = normaliseLabelBase(base);
  if (!root) return assetId;
  return `${root}/?${ASSET_QUERY_PARAM}=${encodeURIComponent(assetId)}`;
}

/**
 * True for an address that only works on the machine that printed it. A label carrying one is useless to
 * everyone else, so the print dialog says so rather than letting a whole sheet be wasted.
 */
export function isLocalOnlyBase(base: string): boolean {
  const root = normaliseLabelBase(base);
  if (!root) return false;
  const host = new URL(root).hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}
