// exporter.js - Image (PNG/JPEG/SVG) and PDF export of the family tree canvas.
// GEDCOM export lives in gedcom-exporter.js and is re-exported here for callers.

import { notifications } from '../../ui/components/notifications.js';
import { formatLifespanShort } from '../../utils/date-value.js';
import { loadJsPDF } from './pdf-loader.js';
import { downloadBlob } from './download.js';

export { exportGEDCOM, generateGEDCOMText } from './gedcom-exporter.js';

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
                // jsPDF is lazy-loaded from the bundle on first PDF export
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
        if (displayPrefs.showDateOfBirth && node.birth?.date?.year) textLines++;
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
      if (displayPrefs.showDateOfBirth && node.birth?.date?.year) {
        const lifespan = formatLifespanShort(node.birth?.date, node.death?.date);
        if (lifespan) {
          const dobText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          dobText.setAttribute('x', translatedX);
          dobText.setAttribute('y', textY + 5);
          dobText.setAttribute('class', 'node-dob');
          dobText.textContent = lifespan;
          g.appendChild(dobText);
        }
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

// Export success notification helper
export function showExportSuccess(format) {
  notifications.success('Export Complete', `${format.toUpperCase()} file has been downloaded successfully`);
}

// Export error notification helper
export function showExportError(format, message) {
  notifications.error('Export Failed', `Failed to export ${format.toUpperCase()}: ${message}`);
}
