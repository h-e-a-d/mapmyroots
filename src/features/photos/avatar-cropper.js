export const DEFAULT_TRANSFORM = Object.freeze({ x: 0.5, y: 0.5, scale: 1.0 });
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;

/**
 * Clamp a transform so:
 *  - scale is in [MIN_SCALE, MAX_SCALE]
 *  - x/y keep the image fully covering the unit circle
 * @param {{x: number, y: number, scale: number}} t
 * @param {{width: number, height: number}} imgSize
 * @returns {{x: number, y: number, scale: number}}
 */
export function clampTransform(t, imgSize) {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale ?? 1));

  const aspect = imgSize.width / imgSize.height;
  const coverX = aspect >= 1 ? 1 : aspect;
  const coverY = aspect >= 1 ? 1 / aspect : 1;
  const halfX = (1 / (scale * coverX)) / 2;
  const halfY = (1 / (scale * coverY)) / 2;

  const xMin = halfX, xMax = 1 - halfX;
  const yMin = halfY, yMax = 1 - halfY;
  const x = xMin > xMax ? 0.5 : Math.min(xMax, Math.max(xMin, t.x ?? 0.5));
  const y = yMin > yMax ? 0.5 : Math.min(yMax, Math.max(yMin, t.y ?? 0.5));

  return { x, y, scale };
}

/**
 * Apply a pan delta (in normalized image coordinates).
 * @param {{x: number, y: number, scale: number}} t
 * @param {{dx: number, dy: number}} delta
 * @param {{width: number, height: number}} imgSize
 */
export function applyPan(t, delta, imgSize) {
  return clampTransform({ x: t.x + delta.dx, y: t.y + delta.dy, scale: t.scale }, imgSize);
}

/**
 * Apply a zoom step around an anchor (a point in the image, normalized 0..1).
 * The point under the anchor stays under the anchor after zoom.
 * @param {{x: number, y: number, scale: number}} t
 * @param {number} newScale
 * @param {{x: number, y: number}} anchor
 * @param {{width: number, height: number}} imgSize
 */
export function applyZoom(t, newScale, anchor, imgSize) {
  const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  const ratio = t.scale / target;
  const x = anchor.x - (anchor.x - t.x) * ratio;
  const y = anchor.y - (anchor.y - t.y) * ratio;
  return clampTransform({ x, y, scale: target }, imgSize);
}
