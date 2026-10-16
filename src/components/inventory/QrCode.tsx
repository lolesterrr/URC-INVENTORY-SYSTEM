/**
 * A QR code drawn as one SVG path. One path rather than a grid of rects because a printer renders a
 * single filled shape without the hairline seams that appear between adjacent rectangles, and because it
 * keeps the markup small enough to put a whole sheet of labels on a page.
 */
import qrcode from 'qrcode-generator';

/**
 * Level H keeps a code readable with a good part of it damaged or covered. The payload here is a short
 * URL, so the extra correction data costs nothing that matters.
 */
const ERROR_CORRECTION = 'H';
/** Quiet zone, in modules. Four is the minimum the QR specification allows. */
const QUIET_ZONE = 4;

/** Builds the path data for every dark module, as one `M x y h w v h z` run per module. */
function modulePath(code: ReturnType<typeof qrcode>, count: number): string {
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return d;
}

export function QrCode({ value, size, title }: { value: string; size: string; title?: string }) {
  // Type number 0 lets the library pick the smallest version that fits the payload.
  const code = qrcode(0, ERROR_CORRECTION);
  code.addData(value);
  code.make();
  const count = code.getModuleCount();
  const side = count + QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? `QR code for ${value}`}
    >
      {/* The quiet zone must be white, not transparent, or a dark background would swallow it. */}
      <rect width={side} height={side} fill="#ffffff" />
      <path d={modulePath(code, count)} fill="#000000" />
    </svg>
  );
}
