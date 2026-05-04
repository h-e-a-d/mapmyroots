const MAX_BYTES = 500 * 1024; // 500 KB
const OUTPUT_SIZE = 256;      // px

/**
 * Validate, resize, and compress a photo data URL.
 * @param {string} dataUrl - Input data URL (image/jpeg, image/png, image/webp)
 * @returns {Promise<string>} Resolved data URL (image/jpeg, 256x256, ≤500KB)
 */
export async function resizePhotoToDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Input must be an image data URL');
  }
  const base64 = dataUrl.split(',')[1] ?? '';
  if (base64.length * 0.75 > MAX_BYTES) {
    throw new Error('Photo exceeds 500 KB limit');
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      // Cover-fit: scale so the smaller dimension fills the square
      const scale = Math.max(OUTPUT_SIZE / img.width, OUTPUT_SIZE / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      ctx.drawImage(img, (OUTPUT_SIZE - drawW) / 2, (OUTPUT_SIZE - drawH) / 2, drawW, drawH);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
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
