import { describe, it, expect } from 'vitest';
import { encodeTreeToParam, decodeTreeFromParam } from '../../../../src/features/share/url-codec.js';

describe('url-codec', () => {
  const tiny = { persons: [{ id: 'p1', name: 'Alice', surname: 'Smith', gender: 'female', x: 100, y: 100 }] };

  it('encodeTreeToParam returns a non-empty string', async () => {
    const encoded = await encodeTreeToParam(tiny);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('round-trips a tree object', async () => {
    const encoded = await encodeTreeToParam(tiny);
    const decoded = await decodeTreeFromParam(encoded);
    expect(decoded.persons).toHaveLength(1);
    expect(decoded.persons[0].name).toBe('Alice');
  });

  it('strips photoBase64 from persons before encoding', async () => {
    const withPhoto = { persons: [{ id: 'p1', name: 'Bob', photoBase64: 'data:image/jpeg;base64,abc' }] };
    const encoded = await encodeTreeToParam(withPhoto);
    const decoded = await decodeTreeFromParam(encoded);
    expect(decoded.persons[0].photoBase64).toBeUndefined();
  });

  it('decodeTreeFromParam throws on invalid input', async () => {
    await expect(decodeTreeFromParam('not-valid-base64!!')).rejects.toThrow();
  });
});
