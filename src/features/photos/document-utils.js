export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_DOCS_PER_PERSON = 30;
export const DOCUMENT_TYPES = ['certificate', 'photo', 'letter', 'other'];

export function validatePdfUpload(file) {
  if (file.type !== 'application/pdf') throw new Error(`Unsupported file type: ${file.type}`);
  if (file.size > MAX_PDF_BYTES) throw new Error(`File too large (max ${MAX_PDF_BYTES} bytes)`);
}

export function enforceDocumentLimit(currentCount) {
  if (currentCount >= MAX_DOCS_PER_PERSON) {
    throw new Error(`Document limit reached (${MAX_DOCS_PER_PERSON} per person)`);
  }
}

export function defaultDocumentMetadata(file) {
  const title = file.name.replace(/\.(jpe?g|png|webp|pdf)$/i, '');
  return { title, type: 'other', description: '' };
}

export async function generatePdfThumbnail(pdfBlob, width = 256) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;
  const buf = await pdfBlob.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = width / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.85);
  });
}

export async function generateImageThumbnail(imageBlob, width = 256) {
  const url = URL.createObjectURL(imageBlob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image decode failed'));
      i.src = url;
    });
    const ratio = width / Math.max(img.width, img.height);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.85);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
