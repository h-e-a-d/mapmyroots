import { describe, it, expect, vi } from 'vitest';
import { prepareImageUpload, MAX_INPUT_BYTES } from '../../../../src/features/photos/photo-utils.js';

function makeFile(name, type, size) {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('prepareImageUpload', () => {
  it('rejects non-image MIME', async () => {
    const file = makeFile('a.txt', 'text/plain', 100);
    await expect(prepareImageUpload(file)).rejects.toThrow(/type/i);
  });

  it('rejects files over MAX_INPUT_BYTES', async () => {
    const file = makeFile('big.jpg', 'image/jpeg', MAX_INPUT_BYTES + 1);
    await expect(prepareImageUpload(file)).rejects.toThrow(/too large/i);
  });

  it('accepts a JPEG within size', async () => {
    // jsdom can't decode actual image bytes, so we mock the decoder
    const fakeImage = { width: 1024, height: 768 };
    const result = await prepareImageUpload(makeFile('p.jpg', 'image/jpeg', 1000), {
      _decode: async () => fakeImage,
      _encode: async () => new Blob(['encoded'], { type: 'image/jpeg' })
    });
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('downscales an oversize image to max 2048px on the longest edge', async () => {
    const fakeImage = { width: 4000, height: 2000 };
    let encodeCalledWith = null;
    await prepareImageUpload(makeFile('p.jpg', 'image/jpeg', 1000), {
      _decode: async () => fakeImage,
      _encode: async (canvas) => {
        encodeCalledWith = { width: canvas.width, height: canvas.height };
        return new Blob(['x'], { type: 'image/jpeg' });
      }
    });
    expect(encodeCalledWith.width).toBe(2048);
    expect(encodeCalledWith.height).toBe(1024);
  });
});
