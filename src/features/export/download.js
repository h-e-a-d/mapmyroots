// download.js - Triggers a browser download for a Blob.

import { notifications } from '../../ui/components/notifications.js';

export function downloadBlob(blob, filename) {
  try {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Error downloading file:', error);
    notifications.error('Download Failed', 'Could not download the file');
  }
}
