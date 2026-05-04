import { strToU8, strFromU8, gzipSync, gunzipSync } from 'fflate';

function stripPhotos(tree) {
  return {
    ...tree,
    persons: (tree.persons ?? []).map(({ photoBase64: _, ...rest }) => rest)
  };
}

/**
 * Encode a tree state object to a URL-safe base64url string (gzip + base64url).
 * @param {object} tree
 * @returns {Promise<string>}
 */
export async function encodeTreeToParam(tree) {
  const clean = stripPhotos(tree);
  const json = JSON.stringify(clean);
  const compressed = gzipSync(strToU8(json), { level: 6 });
  return btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL param back to a tree state object.
 * @param {string} param
 * @returns {Promise<object>}
 */
export async function decodeTreeFromParam(param) {
  const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const json = strFromU8(gunzipSync(bytes));
  return JSON.parse(json);
}
