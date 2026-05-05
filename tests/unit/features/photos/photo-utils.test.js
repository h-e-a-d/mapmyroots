import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resizePhotoToDataUrl, shouldWarnAboutStorage } from '../../../../src/features/photos/photo-utils.js';

describe('resizePhotoToDataUrl', () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement.toDataURL
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,/9j/fakeresized'
    );
  });

  it('returns a data URL starting with data:image/jpeg;base64, for a valid image data URL', async () => {
    // Create a small valid JPEG base64 (well under 500 KB)
    const fakeBase64 = 'A'.repeat(100);
    const inputUrl = `data:image/jpeg;base64,${fakeBase64}`;

    // Mock Image so onload fires synchronously
    const originalImage = global.Image;
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.complete = true;
        this.naturalWidth = 100;
        this.naturalHeight = 100;
      }
      set src(_val) {
        if (this.onload) setTimeout(() => this.onload(), 0);
      }
    };

    const result = await resizePhotoToDataUrl(inputUrl);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);

    global.Image = originalImage;
  });

  it('rejects if input is not a data URL (does not start with data:image/)', async () => {
    await expect(resizePhotoToDataUrl('https://example.com/photo.jpg')).rejects.toThrow(
      'Input must be an image data URL'
    );
  });

  it('rejects if input is not a string', async () => {
    await expect(resizePhotoToDataUrl(null)).rejects.toThrow(
      'Input must be an image data URL'
    );
  });

  it('rejects if image base64 data exceeds 500 KB', async () => {
    // base64 chars * 0.75 > 500 * 1024 => need > 682667 chars
    const bigBase64 = 'A'.repeat(700_000);
    const bigUrl = `data:image/jpeg;base64,${bigBase64}`;
    await expect(resizePhotoToDataUrl(bigUrl)).rejects.toThrow('Photo exceeds 500 KB limit');
  });
});

describe('shouldWarnAboutStorage', () => {
  it('returns true when usage is above 80% of quota', () => {
    expect(shouldWarnAboutStorage({ usage: 4_500_000, quota: 5_000_000 })).toBe(true);
  });

  it('returns false when usage is below 80% of quota', () => {
    expect(shouldWarnAboutStorage({ usage: 3_000_000, quota: 5_000_000 })).toBe(false);
  });

  it('returns false when quota is zero (guard for zero quota)', () => {
    expect(shouldWarnAboutStorage({ usage: 0, quota: 0 })).toBe(false);
  });
});
