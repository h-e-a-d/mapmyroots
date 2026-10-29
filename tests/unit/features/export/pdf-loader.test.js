import { describe, it, expect, vi, beforeEach } from 'vitest';

// pdf-loader caches the promise at module scope, so reload it per test.
let loadJsPDF;
beforeEach(async () => {
  vi.resetModules();
  ({ loadJsPDF } = await import('../../../../src/features/export/pdf-loader.js'));
});

describe('loadJsPDF', () => {
  it('resolves the bundled jsPDF constructor', async () => {
    const jsPDF = await loadJsPDF();
    expect(typeof jsPDF).toBe('function');
    const doc = new jsPDF({ unit: 'pt', format: [100, 50] });
    expect(typeof doc.addImage).toBe('function');
  });

  it('imports the module only once across calls', async () => {
    const ctor = function FakePDF() {};
    const importer = vi.fn().mockResolvedValue({ jsPDF: ctor });
    const [a, b] = await Promise.all([loadJsPDF(importer), loadJsPDF(importer)]);
    expect(a).toBe(ctor);
    expect(b).toBe(ctor);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('rejects when the module has no constructor, then allows a retry', async () => {
    await expect(loadJsPDF(() => Promise.resolve({}))).rejects.toThrow(/constructor/);
    const ctor = function FakePDF() {};
    await expect(loadJsPDF(() => Promise.resolve({ default: ctor }))).resolves.toBe(ctor);
  });
});
