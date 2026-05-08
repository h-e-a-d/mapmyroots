// core-export.js
// Export and import manager for family tree

export function setupExport(treeCore) {
  // Lazy-loaded UI helpers (not available in Node/test environments)
  const getNotifications = () => import('../ui/components/notifications.js').then(m => m.notifications);

  // --- Export Buttons ---
  document.getElementById('exportSvg')?.addEventListener('click', () => {
    treeCore.exportCanvasAsSVG();
  });

  document.getElementById('exportPng')?.addEventListener('click', async () => {
    const n = await getNotifications();
    const loadingId = n.loading('Exporting...', 'Generating PNG file');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsPNG();
        n.remove(loadingId);
        n.success('Export Complete', 'PNG file has been downloaded');
      }, 100);
    } catch (error) {
      n.remove(loadingId);
      n.error('Export Failed', 'Error generating PNG file');
      console.error('PNG export error:', error);
    }
  });

  document.getElementById('exportPngTransparent')?.addEventListener('click', async () => {
    const n = await getNotifications();
    const loadingId = n.loading('Exporting...', 'Generating PNG file without background');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsPNGTransparent();
        n.remove(loadingId);
        n.success('Export Complete', 'Transparent PNG file has been downloaded');
      }, 100);
    } catch (error) {
      n.remove(loadingId);
      n.error('Export Failed', 'Error generating transparent PNG file');
      console.error('PNG transparent export error:', error);
    }
  });

  document.getElementById('exportJpeg')?.addEventListener('click', async () => {
    const n = await getNotifications();
    const loadingId = n.loading('Exporting...', 'Generating JPEG file');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsJPEG();
        n.remove(loadingId);
        n.success('Export Complete', 'JPEG file has been downloaded');
      }, 100);
    } catch (error) {
      n.remove(loadingId);
      n.error('Export Failed', 'Error generating JPEG file');
      console.error('JPEG export error:', error);
    }
  });

  document.getElementById('exportPdf')?.addEventListener('click', () => {
    treeCore.exportCanvasAsPDF();
  });

  document.getElementById('saveData')?.addEventListener('click', async () => {
    const n = await getNotifications();
    const loadingId = n.loading('Saving...', 'Generating JSON file');
    try {
      setTimeout(() => {
        treeCore.saveToJSON();
        n.remove(loadingId);
        n.success('Save Complete', 'Family tree saved to JSON file');
      }, 100);
    } catch (error) {
      n.remove(loadingId);
      n.error('Save Failed', 'Error saving family tree');
      console.error('Save error:', error);
    }
  });

  document.getElementById('loadData')?.addEventListener('change', async (e) => {
    const n = await getNotifications();
    const loadingId = n.loading('Loading...', 'Processing JSON file');
    try {
      setTimeout(() => {
        treeCore.loadFromJSON(e);
        n.remove(loadingId);
      }, 100);
    } catch (error) {
      n.remove(loadingId);
      n.error('Load Failed', 'Error loading family tree');
      console.error('Load error:', error);
    }
  });

  // --- Advanced Export ---
  document.getElementById('exportGedcom')?.addEventListener('click', async () => {
    const n = await getNotifications();
    const { exportGEDCOM } = await import('../features/export/exporter.js');
    exportGEDCOM().catch(async error => {
      console.error('GEDCOM export error:', error);
      n.error('GEDCOM Export Failed', 'Error exporting GEDCOM file');
    });
  });


  // --- Export Helpers ---
  treeCore.exportCanvasAsSVG = async function() {
    try {
      const { exportCanvasSVG } = await import('../features/export/exporter.js');
      await exportCanvasSVG();
    } catch (error) {
      console.error('Error exporting SVG:', error);
      notifications.error('Export Failed', 'Could not export SVG: ' + error.message);
    }
  };

  treeCore.exportCanvasAsPDF = async function() {
    try {
      const { exportCanvasPDF } = await import('../features/export/exporter.js');
      await exportCanvasPDF();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      notifications.error('Export Failed', 'Could not export PDF: ' + error.message);
    }
  };

  treeCore.exportCanvasAsPNG = function() {
    try {
      if (this.renderer && this.renderer.exportAsImage) {
        // Use png with white background for regular PNG export
        const canvas = this.renderer.exportAsImage('png');
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'family-tree.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        });
      } else {
        // Fallback to regular exportTree function
        import('../features/export/exporter.js').then(({ exportTree }) => {
          exportTree('png');
        });
      }
    } catch (error) {
      console.error('Error exporting PNG:', error);
      notifications.error('Export Failed', 'Could not export PNG: ' + error.message);
    }
  };

  treeCore.exportCanvasAsPNGTransparent = function() {
    try {
      if (this.renderer && this.renderer.exportAsPNGTransparent) {
        const canvas = this.renderer.exportAsPNGTransparent();
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'family-tree-transparent.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        });
      } else {
        // Fallback to regular exportTree function
        import('../features/export/exporter.js').then(({ exportTree }) => {
          exportTree('png-transparent');
        });
      }
    } catch (error) {
      console.error('Error exporting transparent PNG:', error);
      notifications.error('Export Failed', 'Could not export transparent PNG: ' + error.message);
    }
  };

  treeCore.exportCanvasAsJPEG = function() {
    try {
      if (this.renderer && this.renderer.exportAsJPEG) {
        const canvas = this.renderer.exportAsJPEG();
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'family-tree.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 'image/jpeg', 0.95);
      } else {
        // Fallback to regular exportTree function
        import('../features/export/exporter.js').then(({ exportTree }) => {
          exportTree('jpeg');
        });
      }
    } catch (error) {
      console.error('Error exporting JPEG:', error);
      getNotifications().then(n => n.error('Export Failed', 'Could not export JPEG: ' + error.message));
    }
  };

  treeCore.saveToJSON = async function() {
    const n = await getNotifications();
    try {
      console.log('saveToJSON called, treeCore:', this);
      const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
      let data;
      if (repo) {
        data = await buildExport(repo);
      } else {
        data = this.getCurrentState();
      }
      console.log('Data to export:', data);

      if (!data || !data.persons || data.persons.length === 0) {
        n.warning('No Data to Export', 'Your family tree appears to be empty. Add some people first.');
        return;
      }

      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `family_tree_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('JSON export completed successfully');
    } catch (error) {
      console.error('Error in saveToJSON:', error);
      n.error('Export Failed', `Error exporting JSON: ${error.message}`);
    }
  };

  treeCore.loadFromJSON = async function(event) {
    const n = await getNotifications();
    const file = event.target.files[0];
    if (!file) {
      n.error('No File Selected', 'Please select a JSON file to load');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        console.log('Loaded JSON data:', data);

        // Validate the data structure
        if (!data.persons && !data.people) {
          n.error('Invalid File Format', 'The file does not contain valid family tree data');
          return;
        }

        // Write media blobs + documents to IDB before updating in-memory state.
        // Wait briefly if IDB isn't ready yet (e.g. import fired immediately on load).
        if (data.media?.length) {
          let repo = window.treeCore?.cacheManager?.getIdbRepo?.();
          for (let i = 0; i < 10 && !repo; i++) {
            await new Promise((r) => setTimeout(r, 200));
            repo = window.treeCore?.cacheManager?.getIdbRepo?.();
          }
          if (repo) {
            await applyImport(repo, data);
          } else {
            console.warn('[loadFromJSON] IDB never became ready; media blobs not persisted');
          }
        }

        // Update in-memory state and renderer
        this.processLoadedData(data);
        n.success('Load Complete', `Successfully loaded ${data.persons?.length || data.people?.length || 0} people`);

        // Clear the file input
        event.target.value = '';

      } catch (error) {
        console.error('Error parsing JSON:', error);
        n.error('Parse Error', 'The file could not be parsed as valid JSON');
      }
    };

    reader.onerror = () => {
      n.error('File Read Error', 'Could not read the selected file');
    };

    reader.readAsText(file);
  };
}

// ── Pure data helpers (no DOM, testable in Node) ─────────────────────────────

const EXPORT_VERSION = '2.2.0';

export async function buildExport(repo, persons = null) {
  if (!persons) persons = await repo.getAllPersons();
  const docs = await repo.getAllDocuments();
  const allMediaIds = await listAllMediaIds(persons, docs);
  const media = [];
  for (const id of allMediaIds) {
    const rec = await repo.getMedia(id);
    if (!rec) continue;
    media.push({
      id: rec.id,
      mimeType: rec.mimeType,
      width: rec.width,
      height: rec.height,
      byteLength: rec.byteLength,
      base64: await blobToBase64(rec.blob)
    });
  }
  return { version: EXPORT_VERSION, cacheFormat: 'enhanced', persons, media, documents: docs };
}

function listAllMediaIds(persons, docs) {
  const ids = new Set();
  for (const p of persons) if (p?.photo?.mediaId) ids.add(p.photo.mediaId);
  for (const d of docs) {
    if (d.mediaId) ids.add(d.mediaId);
    if (d.thumbnailMediaId) ids.add(d.thumbnailMediaId);
  }
  return Array.from(ids);
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let s = '';
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

export async function applyImport(repo, data) {
  if (!data?.persons) throw new Error('Invalid import: missing persons');
  const mediaIdsInImport = new Set();
  for (const m of data.media || []) {
    if (!m.id || !m.base64 || !m.mimeType) continue;
    if ((m.byteLength ?? 0) > 10 * 1024 * 1024) continue;
    await repo.saveMedia({
      id: m.id,
      blob: base64ToBlob(m.base64, m.mimeType),
      mimeType: m.mimeType,
      byteLength: m.byteLength ?? Math.floor((m.base64.length * 3) / 4),
      width: m.width,
      height: m.height
    });
    mediaIdsInImport.add(m.id);
  }
  const personIdsInImport = new Set();
  for (const p of data.persons) {
    if (p.photo?.mediaId && !mediaIdsInImport.has(p.photo.mediaId)) {
      console.warn(`[import] dropping dangling photo for person ${p.id}`);
      p.photo = null;
    }
    await repo.savePerson(p);
    personIdsInImport.add(p.id);
  }
  for (const d of data.documents || []) {
    if (!personIdsInImport.has(d.personId)) {
      console.warn(`[import] dropping orphaned document ${d.id} (person ${d.personId} missing)`);
      continue;
    }
    if (d.mediaId && !mediaIdsInImport.has(d.mediaId)) {
      console.warn(`[import] dropping document ${d.id} (media ${d.mediaId} missing)`);
      continue;
    }
    if (d.thumbnailMediaId && !mediaIdsInImport.has(d.thumbnailMediaId)) {
      d.thumbnailMediaId = null;
    }
    await repo.saveDocument(d);
  }
}