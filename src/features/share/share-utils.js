export const MAX_URL_BYTES = 8000;

/**
 * @param {string} origin - e.g. 'https://mapmyroots.com'
 * @param {string} encoded - base64url string from encodeTreeToParam
 * @returns {string}
 */
export function buildShareUrl(origin, encoded) {
  return `${origin}/view?d=${encoded}`;
}
