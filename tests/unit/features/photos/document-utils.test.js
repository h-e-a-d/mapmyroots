// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  validatePdfUpload,
  MAX_PDF_BYTES,
  MAX_DOCS_PER_PERSON,
  enforceDocumentLimit,
  defaultDocumentMetadata
} from '../../../../src/features/photos/document-utils.js';

function pdfFile(size) {
  return new File([new Uint8Array(size)], 'doc.pdf', { type: 'application/pdf' });
}

describe('validatePdfUpload', () => {
  it('accepts pdf within size', () => {
    expect(() => validatePdfUpload(pdfFile(100))).not.toThrow();
  });

  it('rejects non-pdf', () => {
    expect(() => validatePdfUpload(new File([], 'a.txt', { type: 'text/plain' }))).toThrow(/type/i);
  });

  it('rejects pdf over MAX_PDF_BYTES', () => {
    expect(() => validatePdfUpload(pdfFile(MAX_PDF_BYTES + 1))).toThrow(/too large/i);
  });
});

describe('enforceDocumentLimit', () => {
  it('throws when at cap', () => {
    expect(() => enforceDocumentLimit(MAX_DOCS_PER_PERSON)).toThrow(/limit/i);
  });

  it('does not throw under cap', () => {
    expect(() => enforceDocumentLimit(MAX_DOCS_PER_PERSON - 1)).not.toThrow();
  });
});

describe('defaultDocumentMetadata', () => {
  it('builds defaults from file name', () => {
    const m = defaultDocumentMetadata({ name: 'birth-cert.pdf' });
    expect(m.title).toBe('birth-cert');
    expect(m.type).toBe('other');
    expect(m.description).toBe('');
  });

  it('strips known image extensions from title', () => {
    expect(defaultDocumentMetadata({ name: 'family.JPEG' }).title).toBe('family');
    expect(defaultDocumentMetadata({ name: 'photo.PNG' }).title).toBe('photo');
  });
});
