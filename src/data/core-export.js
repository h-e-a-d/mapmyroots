// core-export.js
// Export and import manager for family tree

import { exportGEDCOM } from '../features/export/exporter.js';
import { notifications } from '../ui/components/notifications.js';

export function setupExport(treeCore) {
  // --- Export Buttons ---
  document.getElementById('exportSvg')?.addEventListener('click', () => {
    treeCore.exportCanvasAsSVG();
  });

  document.getElementById('exportPng')?.addEventListener('click', () => {
    const loadingId = notifications.loading('Exporting...', 'Generating PNG file');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsPNG();
        notifications.remove(loadingId);
        notifications.success('Export Complete', 'PNG file has been downloaded');
      }, 100);
    } catch (error) {
      notifications.remove(loadingId);
      notifications.error('Export Failed', 'Error generating PNG file');
      console.error('PNG export error:', error);
    }
  });

  document.getElementById('exportPngTransparent')?.addEventListener('click', () => {
    const loadingId = notifications.loading('Exporting...', 'Generating PNG file without background');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsPNGTransparent();
        notifications.remove(loadingId);
        notifications.success('Export Complete', 'Transparent PNG file has been downloaded');
      }, 100);
    } catch (error) {
      notifications.remove(loadingId);
      notifications.error('Export Failed', 'Error generating transparent PNG file');
      console.error('PNG transparent export error:', error);
    }
  });

  document.getElementById('exportJpeg')?.addEventListener('click', () => {
    const loadingId = notifications.loading('Exporting...', 'Generating JPEG file');
    try {
      setTimeout(() => {
        treeCore.exportCanvasAsJPEG();
        notifications.remove(loadingId);
        notifications.success('Export Complete', 'JPEG file has been downloaded');
      }, 100);
    } catch (error) {
      notifications.remove(loadingId);
      notifications.error('Export Failed', 'Error generating JPEG file');
      console.error('JPEG export error:', error);
    }
  });

  document.getElementById('exportPdf')?.addEventListener('click', () => {
    treeCore.exportCanvasAsPDF();
  });

  document.getElementById('saveData')?.addEventListener('click', () => {
    const loadingId = notifications.loading('Saving...', 'Generating JSON file');
    try {
      setTimeout(() => {
        treeCore.saveToJSON();
        notifications.remove(loadingId);
        notifications.success('Save Complete', 'Family tree saved to JSON file');
      }, 100);
    } catch (error) {
      notifications.remove(loadingId);
      notifications.error('Save Failed', 'Error saving family tree');
      console.error('Save error:', error);
    }
  });

  document.getElementById('loadData')?.addEventListener('change', (e) => {
    const loadingId = notifications.loading('Loading...', 'Processing JSON file');
    try {
      setTimeout(() => {
        treeCore.loadFromJSON(e);
        notifications.remove(loadingId);
      }, 100);
    } catch (error) {
      notifications.remove(loadingId);
      notifications.error('Load Failed', 'Error loading family tree');
      console.error('Load error:', error);
    }
  });

  // --- Advanced Export ---
  document.getElementById('exportGedcom')?.addEventListener('click', () => {
    exportGEDCOM().catch(error => {
      console.error('GEDCOM export error:', error);
      notifications.error('GEDCOM Export Failed', 'Error exporting GEDCOM file');
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
      notifications.error('Export Failed', 'Could not export JPEG: ' + error.message);
    }
  };

  treeCore.saveToJSON = function() {
    try {
      console.log('saveToJSON called, treeCore:', this);
      const data = this.getCurrentState();
      console.log('Data to export:', data);
      
      if (!data || !data.persons || data.persons.length === 0) {
        notifications.warning('No Data to Export', 'Your family tree appears to be empty. Add some people first.');
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
      notifications.error('Export Failed', `Error exporting JSON: ${error.message}`);
    }
  };

  treeCore.loadFromJSON = function(event) {
    const file = event.target.files[0];
    if (!file) {
      notifications.error('No File Selected', 'Please select a JSON file to load');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        console.log('Loaded JSON data:', data);
        
        // Validate the data structure
        if (!data.persons && !data.people) {
          notifications.error('Invalid File Format', 'The file does not contain valid family tree data');
          return;
        }
        
        // Process the loaded data
        this.processLoadedData(data);
        notifications.success('Load Complete', `Successfully loaded ${data.persons?.length || data.people?.length || 0} people`);
        
        // Clear the file input
        event.target.value = '';
        
      } catch (error) {
        console.error('Error parsing JSON:', error);
        notifications.error('Parse Error', 'The file could not be parsed as valid JSON');
      }
    };
    
    reader.onerror = () => {
      notifications.error('File Read Error', 'Could not read the selected file');
    };
    
    reader.readAsText(file);
  };
} 