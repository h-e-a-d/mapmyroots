// pdf-loader.js - Lazy-loads the bundled jsPDF library.
// jsPDF is an npm dependency (not a CDN script) so it is covered by the
// 'self' script-src CSP and pinned to a known version.

let jsPDFPromise = null;

export function loadJsPDF(importer = () => import('jspdf')) {
  if (!jsPDFPromise) {
    jsPDFPromise = importer()
      .then((module) => {
        const jsPDF = module.jsPDF || module.default;
        if (typeof jsPDF !== 'function') {
          throw new Error('jsPDF module did not export a constructor');
        }
        return jsPDF;
      })
      .catch((error) => {
        // Allow a retry on the next export attempt (e.g. after a flaky chunk fetch).
        jsPDFPromise = null;
        throw error;
      });
  }
  return jsPDFPromise;
}
