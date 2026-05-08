const MAX_DIMENSION = 2048;
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB raw input cap
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate, decode, and resize an image File into a JPEG Blob.
 *
 * @param {File} file
 * @param {object} [deps] — injection hooks for testing
 * @returns {Promise<{ blob: Blob, width: number, height: number, mimeType: 'image/jpeg' }>}
 */
export async function prepareImageUpload(file, deps = {}) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`File too large (max ${MAX_INPUT_BYTES} bytes)`);
  }

  const decode = deps._decode ?? defaultDecode;
  const encode = deps._encode ?? defaultEncode;

  const img = await decode(file);
  const { width: outW, height: outH } = fitWithin(img.width, img.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (img.draw) img.draw(ctx, outW, outH);
  else ctx.drawImage(img, 0, 0, outW, outH);

  const blob = await encode(canvas);
  return { blob, width: outW, height: outH, mimeType: 'image/jpeg' };
}

/**
 * Compute (w, h) preserving aspect ratio so the longest edge ≤ max.
 * @returns {{width: number, height: number}}
 */
function fitWithin(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function defaultDecode(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function defaultEncode(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))),
      'image/jpeg',
      0.9
    );
  });
}

/**
 * @param {{ usage: number, quota: number }} estimate
 * @returns {boolean}
 */
export function shouldWarnAboutStorage({ usage, quota }) {
  if (!quota) return false;
  return usage / quota > 0.8;
}
