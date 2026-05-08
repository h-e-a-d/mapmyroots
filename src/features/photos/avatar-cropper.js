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

const VIEWPORT_SIZE = 400;
const PAN_KEY_PX = 8;
const ZOOM_KEY_STEP = 0.1;

/**
 * @param {{
 *   container: HTMLElement,
 *   blob: Blob,
 *   transform?: {x: number, y: number, scale: number},
 *   onChange: (t: {x: number, y: number, scale: number}) => void
 * }} opts
 */
export function mountCropper(opts) {
  const { container, blob, onChange } = opts;
  let transform = { ...(opts.transform ?? DEFAULT_TRANSFORM) };
  let imgSize = { width: 1, height: 1 };
  let img = null;
  let dragging = false;
  let lastPointer = null;

  const canvas = document.createElement('canvas');
  canvas.width = VIEWPORT_SIZE;
  canvas.height = VIEWPORT_SIZE;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Drag to reposition photo, arrow keys to nudge, plus/minus to zoom');
  canvas.classList.add('avatar-cropper-canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Load the image
  const url = URL.createObjectURL(blob);
  const loaded = new Image();
  loaded.onload = () => {
    img = loaded;
    imgSize = { width: loaded.naturalWidth, height: loaded.naturalHeight };
    transform = clampTransform(transform, imgSize);
    redraw();
    onChange(transform);
  };
  loaded.onerror = () => { /* swallow — keep blank canvas */ };
  loaded.src = url;

  function redraw() {
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    if (!img) return;
    const radius = VIEWPORT_SIZE / 2;
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const s = baseCover * transform.scale;
    const drawW = imgSize.width * s;
    const drawH = imgSize.height * s;
    const cx = radius - drawW * transform.x;
    const cy = radius - drawH * transform.y;
    ctx.drawImage(img, cx, cy, drawW, drawH);

    // Dim the area outside the circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mask boundary stroke
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  function update(next) {
    transform = clampTransform(next, imgSize);
    redraw();
    onChange(transform);
  }

  function onPointerDown(e) {
    dragging = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    lastPointer = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dxPx = e.clientX - lastPointer.x;
    const dyPx = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const drawW = imgSize.width * baseCover * transform.scale;
    const drawH = imgSize.height * baseCover * transform.scale;
    const ratioX = rect.width / VIEWPORT_SIZE;
    const ratioY = rect.height / VIEWPORT_SIZE;
    const dx = -(dxPx / ratioX) / drawW;
    const dy = -(dyPx / ratioY) / drawH;
    update(applyPan(transform, { dx, dy }, imgSize));
  }
  function onPointerUp() { dragging = false; lastPointer = null; }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    const ax = (e.clientX - rect.left) / rect.width;
    const ay = (e.clientY - rect.top) / rect.height;
    const anchor = imageSpaceFromViewport(ax, ay);
    update(applyZoom(transform, transform.scale * factor, anchor, imgSize));
  }

  function imageSpaceFromViewport(vx, vy) {
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const s = baseCover * transform.scale;
    const drawW = imgSize.width * s, drawH = imgSize.height * s;
    const cx = VIEWPORT_SIZE / 2 - drawW * transform.x;
    const cy = VIEWPORT_SIZE / 2 - drawH * transform.y;
    const px = (vx * VIEWPORT_SIZE - cx) / drawW;
    const py = (vy * VIEWPORT_SIZE - cy) / drawH;
    return { x: px, y: py };
  }

  function onKeyDown(e) {
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const drawW = imgSize.width * baseCover * transform.scale;
    const drawH = imgSize.height * baseCover * transform.scale;
    if (e.key === 'ArrowLeft') {
      update(applyPan(transform, { dx: -PAN_KEY_PX / drawW, dy: 0 }, imgSize));
    } else if (e.key === 'ArrowRight') {
      update(applyPan(transform, { dx: PAN_KEY_PX / drawW, dy: 0 }, imgSize));
    } else if (e.key === 'ArrowUp') {
      update(applyPan(transform, { dx: 0, dy: -PAN_KEY_PX / drawH }, imgSize));
    } else if (e.key === 'ArrowDown') {
      update(applyPan(transform, { dx: 0, dy: PAN_KEY_PX / drawH }, imgSize));
    } else if (e.key === '+' || e.key === '=') {
      update(applyZoom(transform, transform.scale + ZOOM_KEY_STEP, { x: transform.x, y: transform.y }, imgSize));
    } else if (e.key === '-' || e.key === '_') {
      update(applyZoom(transform, transform.scale - ZOOM_KEY_STEP, { x: transform.x, y: transform.y }, imgSize));
    } else if (e.key === 'r' || e.key === 'R') {
      update(DEFAULT_TRANSFORM);
    } else {
      return;
    }
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);

  return {
    canvas,
    getTransform: () => ({ ...transform }),
    setZoom: (scale) => update({ ...transform, scale }),
    reset: () => update(DEFAULT_TRANSFORM),
    destroy: () => {
      URL.revokeObjectURL(url);
      canvas.remove();
    }
  };
}
