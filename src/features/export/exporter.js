// exporter.js - Enhanced with notification support, GEDCOM, and PDF layout export
// FIXED: PDF export issues resolved

import { notifications } from '../../ui/components/notifications.js';

export function exportTree(format) {
  const original = document.getElementById('svgArea');
  if (!original) {
    console.error('SVG area not found');
    notifications.error('Export Failed', 'SVG area not found');
    return;
  }
  
  // Show loading notification
  const loadingId = notifications.loading('Exporting...', `Generating ${format.toUpperCase()} file`);
  
  try {
    // Small delay to show the loading notification
    setTimeout(() => {
      try {
        const clone = original.cloneNode(true);
        
        // Remove grid lines and background if they exist
        clone.querySelectorAll('.grid-line').forEach((el) => el.remove());
        
        // Remove any existing stroke-dasharray attributes from node outlines to ensure solid lines
        clone.querySelectorAll('.person-group circle, .person-group rect').forEach((el) => {
          el.removeAttribute('stroke-dasharray');
        });
        
        // Ensure the clone has proper styling
        const treeCore = window.treeCore;
        const showOutline = treeCore?.renderer?.settings?.showNodeOutline ?? true;
        const outlineColor = treeCore?.renderer?.settings?.outlineColor ?? '#2c3e50';
        const outlineThickness = treeCore?.renderer?.settings?.outlineThickness ?? 2;
        
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
          .person-group circle { 
            ${showOutline ? `stroke: ${outlineColor}; stroke-width: ${outlineThickness}px; stroke-dasharray: none;` : 'stroke: none;'}
          }
          .person-group rect { 
            ${showOutline ? `stroke: ${outlineColor}; stroke-width: ${outlineThickness}px; stroke-dasharray: none;` : 'stroke: none;'}
          }
          .person-group text.name { 
            font-weight: 600; 
            font-family: 'Inter', sans-serif;
          }
          .person-group text.dob { 
            font-size: 12px; 
            fill: #757575; 
            font-family: 'Inter', sans-serif;
          }
          .relation { 
            stroke: #7f8c8d; 
            stroke-width: 2px; 
          }
          .relation.spouse { 
            stroke-dasharray: 4 2; 
          }
        `;
        clone.insertBefore(style, clone.firstChild);
        
        // Get the bounding box of all content
        const bbox = getContentBounds(clone);
        if (bbox) {
          // Use 10px padding as requested
          const padding = 10;
          clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`);
          clone.setAttribute('width', bbox.width + padding * 2);
          clone.setAttribute('height', bbox.height + padding * 2);
        }
        
        const svgData = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        
        if (format === 'svg') {
          downloadBlob(svgBlob, 'family-tree.svg');
          notifications.remove(loadingId);
          notifications.success('Export Complete', 'SVG file has been downloaded successfully');
        } else {
          const img = new Image();
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const scale = 2; // Higher resolution
              canvas.width = img.width * scale;
              canvas.height = img.height * scale;
              const ctx = canvas.getContext('2d');
              ctx.scale(scale, scale);
              
              // Only fill background for formats that need it
              if (format !== 'png-transparent') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
              
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              
              if (format === 'png') {
                canvas.toBlob((blob) => {
                  downloadBlob(blob, 'family-tree.png');
                  notifications.remove(loadingId);
                  notifications.success('Export Complete', 'PNG file has been downloaded successfully');
                });   
              } else if (format === 'png-transparent') {
                canvas.toBlob((blob) => {
                  downloadBlob(blob, 'family-tree-transparent.png');
                  notifications.remove(loadingId);
                  notifications.success('Export Complete', 'PNG file (transparent background) has been downloaded successfully');
                });   
              } else if (format === 'jpeg') {
                // JPEG always needs background since it doesn't support transparency
                if (!ctx.fillStyle || ctx.fillStyle === 'rgba(0, 0, 0, 0)') {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0);
                }
                canvas.toBlob((blob) => {
                  downloadBlob(blob, 'family-tree.jpg');
                  notifications.remove(loadingId);
                  notifications.success('Export Complete', 'JPEG file has been downloaded successfully');
                }, 'image/jpeg', 0.95);   
              } else if (format === 'pdf') {
                // FIXED: Improved PDF export with proper jsPDF loading
                loadJsPDF().then((jsPDF) => {
                  try {
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = canvas.width / scale;
                    const imgHeight = canvas.height / scale;
                    
                    // Choose orientation based on aspect ratio
                    const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
                    const pdf = new jsPDF({ 
                      orientation: orientation, 
                      unit: 'pt', 
                      format: [imgWidth, imgHeight] 
                    });
                    
                    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                    pdf.save('family-tree.pdf');
                    
                    notifications.remove(loadingId);
                    notifications.success('Export Complete', 'PDF file has been downloaded successfully');
                  } catch (pdfError) {
                    console.error('Error creating PDF:', pdfError);
                    notifications.remove(loadingId);
                    notifications.error('PDF Export Failed', 'Error creating PDF file');
                  }
                }).catch(err => {
                  console.error('Error loading jsPDF:', err);
                  notifications.remove(loadingId);
                  notifications.error('PDF Export Failed', 'Could not load PDF library');
                });
              }
            } catch (canvasError) {
              console.error('Error processing canvas:', canvasError);
              notifications.remove(loadingId);
              notifications.error('Export Failed', 'Error processing image data');
            }
          };
          
          img.onerror = () => {
            console.error('Error loading image for export');
            notifications.remove(loadingId);
            notifications.error('Export Failed', 'Error loading image for export');
            URL.revokeObjectURL(url);
          };
          
          img.src = url;
        }
      } catch (processError) {
        console.error('Error during export process:', processError);
        notifications.remove(loadingId);
        notifications.error('Export Failed', 'An error occurred during the export process');
      }
    }, 200); // Small delay to show loading notification
    
  } catch (error) {
    console.error('Export error:', error);
    notifications.remove(loadingId);
    notifications.error('Export Failed', 'Failed to export family tree');
  }
}

// FIXED: Improved jsPDF loading function
async function loadJsPDF() {
  try {
    // First check if jsPDF is already available
    const existingJsPDF = findJsPDFGlobal();
    if (existingJsPDF) {
      console.log('jsPDF already available');
      return existingJsPDF;
    }
    
    // Try different CDN URLs and versions
    const cdnUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js', // Older version fallback
      'https://unpkg.com/jspdf@1.5.3/dist/jspdf.min.js'
    ];
    
    for (const url of cdnUrls) {
      try {
        console.log('Attempting to load jsPDF from:', url);
        
        // First try dynamic import
        try {
          const module = await import(url);
          const jsPDF = module.jsPDF || module.default?.jsPDF || module.default;
          if (jsPDF && typeof jsPDF === 'function') {
            console.log('jsPDF loaded via dynamic import');
            return jsPDF;
          }
        } catch (importError) {
          console.log('Dynamic import failed, trying script loading');
        }
        
        // Fallback to script loading
        const jsPDF = await loadJsPDFViaScript(url);
        if (jsPDF) {
          console.log('jsPDF loaded via script tag');
          return jsPDF;
        }
        
      } catch (error) {
        console.log(`Failed to load from ${url}:`, error.message);
        continue;
      }
    }
    
    // Last resort: try a different approach with a more reliable version
    console.log('Trying fallback method with reliable version...');
    try {
      return await loadJsPDFSimple();
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
    }
    
    throw new Error('All jsPDF loading methods failed. Please check your internet connection.');
    
  } catch (error) {
    console.error('Error loading jsPDF:', error);
    throw error;
  }
}

// Load jsPDF via script tag
function loadJsPDFViaScript(url) {
  return new Promise((resolve, reject) => {
    // Check if jsPDF is already available globally in various forms
    const existingJsPDF = findJsPDFGlobal();
    if (existingJsPDF) {
      resolve(existingJsPDF);
      return;
    }
    
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      // Give the script a moment to initialize
      setTimeout(() => {
        const jsPDF = findJsPDFGlobal();
        if (jsPDF) {
          console.log('jsPDF found after script load');
          resolve(jsPDF);
        } else {
          console.log('Available globals after script load:', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));
          reject(new Error('jsPDF not found after script load'));
        }
      }, 100);
    };
    script.onerror = () => {
      reject(new Error('Failed to load jsPDF script'));
    };
    document.head.appendChild(script);
  });
}

// Helper function to find jsPDF in various global locations
function findJsPDFGlobal() {
  // Check common global variable names for jsPDF
  const possiblePaths = [
    'jsPDF',           // Most common
    'jspdf.jsPDF',     // Namespaced version
    'jsPDF.jsPDF',     // Double namespaced
    'window.jsPDF',    // Explicit window
    'jspdf',           // Lowercase version
    'jsPdf',           // Alternative casing
    'JSPDF'            // All caps version
  ];
  
  for (const path of possiblePaths) {
    try {
      const parts = path.split('.');
      let obj = window;
      
      for (const part of parts) {
        if (part === 'window') continue;
        obj = obj[part];
        if (!obj) break;
      }
      
      if (obj && typeof obj === 'function') {
        console.log(`Found jsPDF at: ${path}`);
        return obj;
      }
    } catch (e) {
      continue;
    }
  }
  
  // Also try to check if it's available as a constructor
  try {
    if (window.jsPDF && window.jsPDF.API) {
      console.log('Found jsPDF with API property');
      return window.jsPDF;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}

// Simple fallback jsPDF loader using a known working version
function loadJsPDFSimple() {
  return new Promise((resolve, reject) => {
    // Use a known stable version
    const scriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js';
    
    // Remove any existing script first
    const existingScript = document.querySelector(`script[src*="jspdf"]`);
    if (existingScript) {
      existingScript.remove();
    }
    
    const script = document.createElement('script');
    script.src = scriptUrl;
    
    script.onload = () => {
      // Wait a bit longer for older version
      setTimeout(() => {
        // This older version typically exposes as window.jsPDF directly
        if (window.jsPDF && typeof window.jsPDF === 'function') {
          console.log('✅ Fallback jsPDF (v1.5.3) loaded successfully');
          resolve(window.jsPDF);
        } else {
          console.log('❌ Fallback jsPDF not found');
          console.log('Available window properties:', Object.keys(window).filter(k => k.includes('PDF')));
          reject(new Error('Fallback jsPDF loading failed'));
        }
      }, 200);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load fallback jsPDF script'));
    };
    
    console.log('Loading fallback jsPDF from:', scriptUrl);
    document.head.appendChild(script);
  });
}

// Debug function to test jsPDF loading
window.testJsPDFLoading = async function() {
  console.log('Testing jsPDF loading...');
  try {
    const jsPDF = await loadJsPDF();
    console.log('✅ jsPDF loaded successfully:', typeof jsPDF);
    
    // Test creating a simple PDF
    const doc = new jsPDF();
    doc.text('Test PDF', 10, 10);
    console.log('✅ jsPDF test creation successful');
    
    return true;
  } catch (error) {
    console.error('❌ jsPDF loading failed:', error);
    return false;
  }
};

// Enhanced SVG export from canvas
export async function exportCanvasSVG() {
  const loadingId = notifications.loading('Exporting SVG...', 'Generating SVG from canvas');

  try {
    // Use global tree core instead of importing
    const treeCore = window.treeCore;

    if (!treeCore.renderer) {
      notifications.remove(loadingId);
      notifications.warning('No Data', 'No family tree canvas available to export');
      return;
    }

    // Get tree name from localStorage
    const treeName = localStorage.getItem('familyTree_treeName') || 'family-tree';
    const sanitizedTreeName = treeName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    // Calculate precise bounds including text overflow
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const settings = treeCore.renderer.settings;
    const displayPrefs = treeCore.renderer.displayPreferences;

    // Iterate through all nodes to find true bounds including text
    for (const [id, node] of treeCore.renderer.nodes) {
      // Account for node shape
      if (settings.nodeStyle === 'rectangle') {
        const width = treeCore.renderer.getNodeWidth(node);
        const height = treeCore.renderer.getNodeHeight(node);
        minX = Math.min(minX, node.x - width/2);
        minY = Math.min(minY, node.y - height/2);
        maxX = Math.max(maxX, node.x + width/2);
        maxY = Math.max(maxY, node.y + height/2);
      } else {
        const radius = node.radius || settings.nodeRadius;
        minX = Math.min(minX, node.x - radius);
        minY = Math.min(minY, node.y - radius);
        maxX = Math.max(maxX, node.x + radius);
        maxY = Math.max(maxY, node.y + radius);

        // Account for text that extends beyond circular nodes
        // Estimate text width (conservative approximation)
        let fullName = node.name || '';
        if (displayPrefs.showFatherName && node.fatherName) fullName += ' ' + node.fatherName;
        if (node.surname) fullName += ' ' + node.surname;

        const estimatedTextWidth = fullName.length * settings.nameFontSize * 0.6;
        minX = Math.min(minX, node.x - estimatedTextWidth/2);
        maxX = Math.max(maxX, node.x + estimatedTextWidth/2);

        // Account for vertical text spacing
        let textLines = 1; // name
        if (displayPrefs.showMaidenName && node.maidenName) textLines++;
        if (displayPrefs.showDateOfBirth && node.dob) textLines++;
        const textHeight = textLines * 15;
        minY = Math.min(minY, node.y - textHeight/2);
        maxY = Math.max(maxY, node.y + textHeight/2);
      }
    }

    if (!isFinite(minX)) {
      notifications.remove(loadingId);
      notifications.warning('No Data', 'No family tree content to export');
      return;
    }

    // Add consistent padding
    const padding = 10;
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const width = boundsWidth + (padding * 2);
    const height = boundsHeight + (padding * 2);

    // Calculate offset to translate content to (0, 0) based viewBox
    const offsetX = minX - padding;
    const offsetY = minY - padding;

    // Create SVG document with viewBox starting at (0, 0) for better compatibility
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Add background
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', 0);
    background.setAttribute('y', 0);
    background.setAttribute('width', width);
    background.setAttribute('height', height);
    background.setAttribute('fill', '#ffffff');
    svg.appendChild(background);

    // Add CSS styles
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      .connection-line { stroke-width: 2px; fill: none; }
      .family-line { stroke: ${settings.familyLineColor}; stroke-width: ${settings.familyLineThickness}px; }
      .spouse-line { stroke: ${settings.spouseLineColor}; stroke-width: ${settings.spouseLineThickness}px; stroke-dasharray: 8,4; }
      .line-only { stroke: ${settings.lineOnlyColor}; stroke-width: ${settings.lineOnlyThickness}px; stroke-dasharray: 8,4,2,4; }
      .node { ${settings.showNodeOutline ? `stroke: ${settings.outlineColor}; stroke-width: ${settings.outlineThickness}px;` : 'stroke: none;'} }
      .node-text { font-family: ${settings.fontFamily}; font-size: ${settings.nameFontSize}px; fill: ${settings.nameColor}; text-anchor: middle; font-weight: 600; }
      .node-dob { font-family: ${settings.fontFamily}; font-size: ${settings.dobFontSize}px; fill: ${settings.dobColor}; text-anchor: middle; }
    `;
    svg.appendChild(style);

    // Draw connections (with translated coordinates)
    for (const conn of treeCore.renderer.connections) {
      const fromNode = treeCore.renderer.nodes.get(conn.from);
      const toNode = treeCore.renderer.nodes.get(conn.to);

      if (!fromNode || !toNode) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromNode.x - offsetX);
      line.setAttribute('y1', fromNode.y - offsetY);
      line.setAttribute('x2', toNode.x - offsetX);
      line.setAttribute('y2', toNode.y - offsetY);
      line.setAttribute('class', `connection-line ${conn.type === 'spouse' ? 'spouse-line' : conn.type === 'line-only' ? 'line-only' : 'family-line'}`);
      svg.appendChild(line);
    }

    // Draw nodes (with translated coordinates)
    for (const [id, node] of treeCore.renderer.nodes) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Translate node coordinates
      const translatedX = node.x - offsetX;
      const translatedY = node.y - offsetY;

      // Draw circle or rectangle
      if (settings.nodeStyle === 'rectangle') {
        const nodeWidth = treeCore.renderer.getNodeWidth(node);
        const nodeHeight = treeCore.renderer.getNodeHeight(node);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', translatedX - nodeWidth/2);
        rect.setAttribute('y', translatedY - nodeHeight/2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('fill', node.color || settings.nodeColor);
        rect.setAttribute('class', 'node');
        g.appendChild(rect);
      } else {
        const radius = node.radius || settings.nodeRadius;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', translatedX);
        circle.setAttribute('cy', translatedY);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', node.color || settings.nodeColor);
        circle.setAttribute('class', 'node');
        g.appendChild(circle);
      }

      // Add text
      let textY = translatedY;

      // Build full name
      let fullName = node.name || '';
      if (displayPrefs.showFatherName && node.fatherName) {
        fullName += ' ' + node.fatherName;
      }
      if (node.surname) {
        fullName += ' ' + node.surname;
      }

      if (fullName) {
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', translatedX);
        nameText.setAttribute('y', textY);
        nameText.setAttribute('class', 'node-text');
        nameText.textContent = fullName.trim();
        g.appendChild(nameText);
        textY += 12;
      }

      // Add maiden name
      if (displayPrefs.showMaidenName && node.maidenName && node.maidenName !== node.surname) {
        const maidenText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        maidenText.setAttribute('x', translatedX);
        maidenText.setAttribute('y', textY);
        maidenText.setAttribute('class', 'node-dob');
        maidenText.textContent = `(${node.maidenName})`;
        g.appendChild(maidenText);
        textY += 10;
      }

      // Add DOB
      if (displayPrefs.showDateOfBirth && node.dob) {
        const dobText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        dobText.setAttribute('x', translatedX);
        dobText.setAttribute('y', textY + 5);
        dobText.setAttribute('class', 'node-dob');
        dobText.textContent = node.dob;
        g.appendChild(dobText);
      }

      svg.appendChild(g);
    }

    // Serialize SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

    // Download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(svgBlob);
    link.download = `${sanitizedTreeName}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    notifications.remove(loadingId);
    notifications.success('SVG Export Complete', 'SVG file has been downloaded successfully');

  } catch (error) {
    console.error('SVG export error:', error);
    notifications.remove(loadingId);
    notifications.error('SVG Export Failed', 'Error generating SVG file');
  }
}

// Enhanced canvas-based PDF export with optimization and proper filename
export async function exportCanvasPDF() {
  const loadingId = notifications.loading('Exporting PDF...', 'Generating optimized PDF from canvas');

  try {
    // Use global tree core instead of importing
    const treeCore = window.treeCore;

    if (!treeCore.renderer) {
      notifications.remove(loadingId);
      notifications.warning('No Data', 'No family tree canvas available to export');
      return;
    }

    // Get tree name from localStorage
    const treeName = localStorage.getItem('familyTree_treeName') || 'family-tree';
    const sanitizedTreeName = treeName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    // Get canvas image with optimized resolution
    const exportCanvas = treeCore.renderer.exportAsImage('png');

    // Calculate optimal dimensions for PDF - balanced quality/size
    const maxDimension = 3000; // Reduced for smaller file size while maintaining good quality
    let canvasWidth = exportCanvas.width;
    let canvasHeight = exportCanvas.height;

    // Scale down if too large
    if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
      const scale = maxDimension / Math.max(canvasWidth, canvasHeight);
      canvasWidth = canvasWidth * scale;
      canvasHeight = canvasHeight * scale;
    }

    // Create optimized canvas
    const optimizedCanvas = document.createElement('canvas');
    optimizedCanvas.width = canvasWidth;
    optimizedCanvas.height = canvasHeight;
    const ctx = optimizedCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(exportCanvas, 0, 0, canvasWidth, canvasHeight);

    // Use JPEG with optimized quality (0.88 provides good balance)
    const imgData = optimizedCanvas.toDataURL('image/jpeg', 0.88);

    // Load jsPDF
    const jsPDF = await loadJsPDF();

    // Calculate PDF dimensions
    const aspectRatio = canvasWidth / canvasHeight;

    // Choose orientation and size based on aspect ratio
    let pdfWidth, pdfHeight, orientation;
    if (aspectRatio > 1.4) {
      // Wide image - use landscape A4
      orientation = 'landscape';
      pdfWidth = 842; // A4 landscape width in points
      pdfHeight = 595; // A4 landscape height in points
    } else {
      // Tall or square image - use portrait A4
      orientation = 'portrait';
      pdfWidth = 595; // A4 portrait width in points
      pdfHeight = 842; // A4 portrait height in points
    }

    // Calculate scaling to fit image in PDF
    const scaleX = pdfWidth / canvasWidth;
    const scaleY = pdfHeight / canvasHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin

    const finalWidth = canvasWidth * scale;
    const finalHeight = canvasHeight * scale;

    // Center the image
    const offsetX = (pdfWidth - finalWidth) / 2;
    const offsetY = (pdfHeight - finalHeight) / 2;

    // Create PDF with compression
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'pt',
      format: 'a4',
      compress: true
    });

    // Add title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(treeName || 'Family Tree', pdfWidth / 2, 30, { align: 'center' });

    // Add generation date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString();
    pdf.text(`Generated on: ${dateStr}`, pdfWidth / 2, 50, { align: 'center' });

    // Add image with some top margin for title
    const imageY = Math.max(offsetY, 70);
    pdf.addImage(imgData, 'JPEG', offsetX, imageY, finalWidth, finalHeight, undefined, 'FAST');

    // Save PDF with proper filename
    pdf.save(`${sanitizedTreeName}.pdf`);

    notifications.remove(loadingId);
    notifications.success('PDF Export Complete', 'Optimized PDF file has been downloaded successfully');

  } catch (error) {
    console.error('Canvas PDF export error:', error);
    notifications.remove(loadingId);
    notifications.error('PDF Export Failed', 'Error generating PDF from canvas');
  }
}

// Advanced GEDCOM Export
export async function exportGEDCOM() {
  const loadingId = notifications.loading('Exporting GEDCOM...', 'Generating genealogy file');
  
  try {
    // Use global tree core instead of importing
    const treeCore = window.treeCore;
    
    if (!treeCore.renderer || !treeCore.renderer.nodes || treeCore.renderer.nodes.size === 0) {
      notifications.remove(loadingId);
      notifications.warning('No Data', 'No family tree data available to export');
      return;
    }
    
    const gedcomData = generateGEDCOM(treeCore);
    const blob = new Blob([gedcomData], { type: 'text/plain;charset=utf-8' });
    
    downloadBlob(blob, `family-tree-${new Date().toISOString().split('T')[0]}.ged`);
    
    notifications.remove(loadingId);
    notifications.success('GEDCOM Export Complete', 'Genealogy file has been downloaded successfully');
    
  } catch (error) {
    console.error('GEDCOM export error:', error);
    notifications.remove(loadingId);
    notifications.error('GEDCOM Export Failed', 'Error generating GEDCOM file');
  }
}


// Generate GEDCOM format
function generateGEDCOM(treeCore) {
  const lines = [];
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  // Header
  lines.push('0 HEAD');
  lines.push('1 SOUR MapMyRoots');
  lines.push('2 VERS 2.5');
  lines.push('2 NAME MapMyRoots Family Tree Builder');
  lines.push('1 DEST GENERIC');
  lines.push('1 DATE ' + currentDate);
  lines.push('1 CHAR UTF-8');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  
  // Collect all individuals
  const individuals = [];
  const families = new Map();
  let indiCounter = 1;
  let famCounter = 1;
  
  // Process individuals
  for (const [id, node] of treeCore.renderer.nodes) {
    const personData = treeCore.getPersonData(id) || {};
    const indiId = `I${indiCounter++}`;
    
    const individual = {
      originalId: id,
      gedcomId: indiId,
      node,
      personData
    };
    
    individuals.push(individual);
    
    // Generate individual record
    lines.push(`0 ${indiId} INDI`);
    
    // Name
    const givenName = node.name || personData.name || '';
    const surname = node.surname || personData.surname || '';
    const fullName = `${givenName} /${surname}/`.trim();
    lines.push(`1 NAME ${fullName}`);
    
    if (givenName) {
      lines.push(`2 GIVN ${givenName}`);
    }
    if (surname) {
      lines.push(`2 SURN ${surname}`);
    }
    
    // Maiden name for females
    if ((node.gender || personData.gender) === 'female' && (node.maidenName || personData.maidenName)) {
      const maidenName = node.maidenName || personData.maidenName;
      lines.push(`1 NAME ${givenName} /${maidenName}/`);
      lines.push(`2 GIVN ${givenName}`);
      lines.push(`2 SURN ${maidenName}`);
      lines.push(`2 TYPE maiden`);
    }
    
    // Gender
    const gender = (node.gender || personData.gender || '').toUpperCase();
    if (gender === 'MALE' || gender === 'FEMALE') {
      lines.push(`1 SEX ${gender.charAt(0)}`);
    }
    
    // Birth
    const dob = node.dob || personData.dob;
    if (dob) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${formatGEDCOMDate(dob)}`);
    }
    
    // Father's name as note if available
    const fatherName = node.fatherName || personData.fatherName;
    if (fatherName) {
      lines.push('1 NOTE');
      lines.push(`2 CONT Father\'s name: ${fatherName}`);
    }
  }
  
  // Process families
  const processedFamilies = new Set();
  
  for (const individual of individuals) {
    const personData = individual.personData;
    
    // Create family for spouse relationship
    if (personData.spouseId && !processedFamilies.has(`${individual.originalId}-${personData.spouseId}`)) {
      const spouse = individuals.find(ind => ind.originalId === personData.spouseId);
      if (spouse) {
        const famId = `F${famCounter++}`;
        
        lines.push(`0 ${famId} FAM`);
        
        // Determine husband and wife based on gender
        const person1Gender = (individual.node.gender || individual.personData.gender || '').toLowerCase();
        const person2Gender = (spouse.node.gender || spouse.personData.gender || '').toLowerCase();
        
        if (person1Gender === 'male') {
          lines.push(`1 HUSB ${individual.gedcomId}`);
          lines.push(`1 WIFE ${spouse.gedcomId}`);
        } else if (person1Gender === 'female') {
          lines.push(`1 WIFE ${individual.gedcomId}`);
          lines.push(`1 HUSB ${spouse.gedcomId}`);
        } else {
          // Gender unknown, just use spouse relationship
          lines.push(`1 HUSB ${individual.gedcomId}`);
          lines.push(`1 WIFE ${spouse.gedcomId}`);
        }
        
        // Find children
        const children = individuals.filter(ind => 
          ind.personData.motherId === individual.originalId || 
          ind.personData.fatherId === individual.originalId ||
          ind.personData.motherId === spouse.originalId || 
          ind.personData.fatherId === spouse.originalId
        );
        
        children.forEach(child => {
          lines.push(`1 CHIL ${child.gedcomId}`);
        });
        
        // Mark this family as processed
        processedFamilies.add(`${individual.originalId}-${personData.spouseId}`);
        processedFamilies.add(`${personData.spouseId}-${individual.originalId}`);
      }
    }
    
    // Create family for parent-child relationships
    if (personData.motherId || personData.fatherId) {
      const mother = individuals.find(ind => ind.originalId === personData.motherId);
      const father = individuals.find(ind => ind.originalId === personData.fatherId);
      
      if (mother || father) {
        const familyKey = `${personData.fatherId || 'unknown'}-${personData.motherId || 'unknown'}`;
        if (!processedFamilies.has(familyKey)) {
          const famId = `F${famCounter++}`;
          
          lines.push(`0 ${famId} FAM`);
          
          if (father) {
            lines.push(`1 HUSB ${father.gedcomId}`);
          }
          if (mother) {
            lines.push(`1 WIFE ${mother.gedcomId}`);
          }
          
          lines.push(`1 CHIL ${individual.gedcomId}`);
          
          // Find other children with same parents
          const siblings = individuals.filter(ind => 
            ind.originalId !== individual.originalId &&
            ind.personData.motherId === personData.motherId &&
            ind.personData.fatherId === personData.fatherId
          );
          
          siblings.forEach(sibling => {
            lines.push(`1 CHIL ${sibling.gedcomId}`);
          });
          
          processedFamilies.add(familyKey);
        }
      }
    }
  }
  
  // Trailer
  lines.push('0 TRLR');
  
  return lines.join('\n');
}

// Format date for GEDCOM
function formatGEDCOMDate(dateStr) {
  if (!dateStr) return '';
  
  // Handle year only (e.g., "1985")
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Handle dd.mm.yyyy format
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
    ];
    const monthName = monthNames[parseInt(month) - 1];
    return `${parseInt(day)} ${monthName} ${year}`;
  }
  
  // Return as-is for other formats
  return dateStr;
}


function getContentBounds(svgElement) {
  const elements = svgElement.querySelectorAll('circle, text, line');
  if (elements.length === 0) return null;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  elements.forEach(el => {
    let bounds;
    if (el.tagName === 'circle') {
      const cx = parseFloat(el.getAttribute('cx'));
      const cy = parseFloat(el.getAttribute('cy'));
      const r = parseFloat(el.getAttribute('r'));
      bounds = {
        x: cx - r,
        y: cy - r,
        width: r * 2,
        height: r * 2
      };
    } else if (el.tagName === 'text') {
      const x = parseFloat(el.getAttribute('x'));
      const y = parseFloat(el.getAttribute('y'));
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 14;
      const textLength = el.textContent.length * fontSize * 0.6; // Approximate
      bounds = {
        x: x - textLength / 2,
        y: y - fontSize,
        width: textLength,
        height: fontSize
      };
    } else if (el.tagName === 'line') {
      const x1 = parseFloat(el.getAttribute('x1'));
      const y1 = parseFloat(el.getAttribute('y1'));
      const x2 = parseFloat(el.getAttribute('x2'));
      const y2 = parseFloat(el.getAttribute('y2'));
      bounds = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
      };
    }
    
    if (bounds) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function downloadBlob(blob, filename) {
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

// Export success notification helper
export function showExportSuccess(format) {
  notifications.success('Export Complete', `${format.toUpperCase()} file has been downloaded successfully`);
}

// Export error notification helper
export function showExportError(format, message) {
  notifications.error('Export Failed', `Failed to export ${format.toUpperCase()}: ${message}`);
}

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
  window.testJsPDFLoading = async function() {
    console.log('🔍 Testing jsPDF loading...');
    try {
      const jsPDF = await loadJsPDF();
      console.log('✅ jsPDF loaded successfully:', typeof jsPDF);
      
      // Test creating a simple PDF
      const doc = new jsPDF();
      doc.text('Test PDF', 10, 10);
      console.log('✅ jsPDF test creation successful');
      
      notifications.success('jsPDF Test', 'PDF library loaded and tested successfully!');
      return true;
    } catch (error) {
      console.error('❌ jsPDF loading failed:', error);
      notifications.error('jsPDF Test Failed', error.message);
      return false;
    }
  };
  
  console.log('🛠️ PDF Debug: Type testJsPDFLoading() in console to test PDF library loading');
}
