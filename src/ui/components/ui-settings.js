// ui-settings.js
// Settings and display preferences manager for family tree

import { notifications } from './notifications.js';
import { ShapeManager } from '../../shapes/shape-manager.js';

export function setupSettings(treeCore) {
  // Initialize Shape Manager
  if (!treeCore.shapeManager) {
    treeCore.shapeManager = new ShapeManager(treeCore);
  }

  // --- Settings Panel ---
  const applyBtn = document.getElementById('applyNodeStyle');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const color = document.getElementById('nodeColorPicker').value;
      const size = parseInt(document.getElementById('nodeSizeInput').value, 10);
      if (!isNaN(size) && size > 0) {
        treeCore.nodeRadius = size;
        treeCore.defaultColor = color;
        treeCore.updateRendererSettings();
        treeCore.updateAllExistingNodes();
        notifications.success('Style Applied', 'Node appearance updated');
        treeCore.undoRedoManager.pushUndoState();
      } else {
        notifications.error('Invalid Size', 'Please enter a valid node size');
      }
    });
  }

  const fontSelect = document.getElementById('fontSelect');
  if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
      treeCore.fontFamily = e.target.value;
      treeCore.updateRendererSettings();
      treeCore.updateAllExistingNodes();
      notifications.success('Font Changed', `Font changed to ${e.target.value}`);
      treeCore.undoRedoManager.pushUndoState();
    });
  }

  const fontSizeInput = document.getElementById('fontSizeInput');
  if (fontSizeInput) {
    fontSizeInput.addEventListener('change', (e) => {
      const newSize = parseInt(e.target.value, 10);
      if (!isNaN(newSize) && newSize > 0) {
        treeCore.fontSize = newSize;
        treeCore.updateRendererSettings();
        treeCore.updateAllExistingNodes();
        notifications.success('Font Size Changed', `Font size changed to ${newSize}px`);
        treeCore.undoRedoManager.pushUndoState();
      }
    });
  }

  const nameColorPicker = document.getElementById('nameColorPicker');
  if (nameColorPicker) {
    nameColorPicker.addEventListener('change', (e) => {
      treeCore.nameColor = e.target.value;
      treeCore.updateRendererSettings();
      treeCore.updateAllExistingNodes();
      notifications.success('Name Color Changed', 'Name color updated');
      treeCore.undoRedoManager.pushUndoState();
    });
  }

  const dateColorPicker = document.getElementById('dateColorPicker');
  if (dateColorPicker) {
    dateColorPicker.addEventListener('change', (e) => {
      treeCore.dateColor = e.target.value;
      treeCore.updateRendererSettings();
      treeCore.updateAllExistingNodes();
      notifications.success('Date Color Changed', 'Date color updated');
      treeCore.undoRedoManager.pushUndoState();
    });
  }

  // --- Node Outline Settings ---
  const showNodeOutline = document.getElementById('showNodeOutline');
  if (showNodeOutline) {
    showNodeOutline.checked = treeCore.renderer?.settings.showNodeOutline ?? true;
    showNodeOutline.addEventListener('change', () => {
      if (treeCore.renderer) {
        treeCore.renderer.settings.showNodeOutline = showNodeOutline.checked;
        
        // Update line style settings for saving
        if (!treeCore.lineStyleSettings) treeCore.lineStyleSettings = {};
        treeCore.lineStyleSettings.showNodeOutline = showNodeOutline.checked;
        
        treeCore.renderer.needsRedraw = true;
      }
      notifications.info('Outline Toggle', `Node outline ${showNodeOutline.checked ? 'enabled' : 'disabled'}`);
      treeCore.undoRedoManager.pushUndoState();
    });
  }

  const outlineThicknessInput = document.getElementById('outlineThicknessInput');
  if (outlineThicknessInput) {
    outlineThicknessInput.value = treeCore.renderer?.settings.outlineThickness ?? 2;
  }

  const outlineColorPicker = document.getElementById('outlineColorPicker');
  if (outlineColorPicker) {
    outlineColorPicker.value = treeCore.renderer?.settings.outlineColor ?? '#2c3e50';
  }

  const applyOutlineStyle = document.getElementById('applyOutlineStyle');
  if (applyOutlineStyle) {
    applyOutlineStyle.addEventListener('click', () => {
      const thickness = parseInt(outlineThicknessInput.value, 10);
      const color = outlineColorPicker.value;
      
      if (!isNaN(thickness) && thickness >= 0) {
        if (treeCore.renderer) {
          treeCore.renderer.settings.outlineThickness = thickness;
          treeCore.renderer.settings.outlineColor = color;
          
          // Update line style settings for saving
          if (!treeCore.lineStyleSettings) treeCore.lineStyleSettings = {};
          treeCore.lineStyleSettings.outlineThickness = thickness;
          treeCore.lineStyleSettings.outlineColor = color;
          
          treeCore.renderer.needsRedraw = true;
        }
        notifications.success('Outline Applied', 'Node outline settings updated');
        treeCore.undoRedoManager.pushUndoState();
      } else {
        notifications.error('Invalid Thickness', 'Please enter a valid outline thickness');
      }
    });
  }

  // --- Connector Line Settings ---
  // Family connections
  const familyLineStyleSelect = document.getElementById('familyLineStyleSelect');
  const familyLineThicknessInput = document.getElementById('familyLineThicknessInput');
  const familyLineColorPicker = document.getElementById('familyLineColorPicker');
  
  if (familyLineStyleSelect) {
    familyLineStyleSelect.value = treeCore.renderer?.settings.familyLineStyle ?? 'solid';
  }
  if (familyLineThicknessInput) {
    familyLineThicknessInput.value = treeCore.renderer?.settings.familyLineThickness ?? 2;
  }
  if (familyLineColorPicker) {
    familyLineColorPicker.value = treeCore.renderer?.settings.familyLineColor ?? '#7f8c8d';
  }

  // Spouse connections
  const spouseLineStyleSelect = document.getElementById('spouseLineStyleSelect');
  const spouseLineThicknessInput = document.getElementById('spouseLineThicknessInput');
  const spouseLineColorPicker = document.getElementById('spouseLineColorPicker');
  
  if (spouseLineStyleSelect) {
    spouseLineStyleSelect.value = treeCore.renderer?.settings.spouseLineStyle ?? 'dashed';
  }
  if (spouseLineThicknessInput) {
    spouseLineThicknessInput.value = treeCore.renderer?.settings.spouseLineThickness ?? 2;
  }
  if (spouseLineColorPicker) {
    spouseLineColorPicker.value = treeCore.renderer?.settings.spouseLineColor ?? '#e74c3c';
  }

  // Line-only connections
  const lineOnlyStyleSelect = document.getElementById('lineOnlyStyleSelect');
  const lineOnlyThicknessInput = document.getElementById('lineOnlyThicknessInput');
  const lineOnlyColorPicker = document.getElementById('lineOnlyColorPicker');
  
  if (lineOnlyStyleSelect) {
    lineOnlyStyleSelect.value = treeCore.renderer?.settings.lineOnlyStyle ?? 'dash-dot';
  }
  if (lineOnlyThicknessInput) {
    lineOnlyThicknessInput.value = treeCore.renderer?.settings.lineOnlyThickness ?? 2;
  }
  if (lineOnlyColorPicker) {
    lineOnlyColorPicker.value = treeCore.renderer?.settings.lineOnlyColor ?? '#9b59b6';
  }

  const applyLineStyles = document.getElementById('applyLineStyles');
  if (applyLineStyles) {
    applyLineStyles.addEventListener('click', () => {
      if (treeCore.renderer) {
        // Create line style settings object
        const lineStyles = {
          // Family connections
          familyLineStyle: familyLineStyleSelect.value,
          familyLineThickness: parseInt(familyLineThicknessInput.value, 10),
          familyLineColor: familyLineColorPicker.value,
          
          // Spouse connections
          spouseLineStyle: spouseLineStyleSelect.value,
          spouseLineThickness: parseInt(spouseLineThicknessInput.value, 10),
          spouseLineColor: spouseLineColorPicker.value,
          
          // Line-only connections
          lineOnlyStyle: lineOnlyStyleSelect.value,
          lineOnlyThickness: parseInt(lineOnlyThicknessInput.value, 10),
          lineOnlyColor: lineOnlyColorPicker.value,
          
          // Node outline settings (include current values)
          showNodeOutline: treeCore.renderer.settings.showNodeOutline,
          outlineThickness: treeCore.renderer.settings.outlineThickness,
          outlineColor: treeCore.renderer.settings.outlineColor
        };
        
        // Apply to renderer settings
        Object.assign(treeCore.renderer.settings, lineStyles);
        
        // Store in treeCore for saving/caching
        treeCore.lineStyleSettings = lineStyles;
        
        treeCore.renderer.needsRedraw = true;
      }
      notifications.success('Line Styles Applied', 'Connector line styles updated');
      treeCore.undoRedoManager.pushUndoState();
    });
  }

  // --- Node Style Selection ---
  const nodeStyleOptions = document.querySelectorAll('.node-style-option');
  if (nodeStyleOptions.length > 0) {
    // Set initial selection based on current node style
    nodeStyleOptions.forEach(option => {
      option.classList.remove('selected');
      if (option.getAttribute('data-style') === treeCore.nodeStyle) {
        option.classList.add('selected');
      }
    });

    // Add click event listeners
    nodeStyleOptions.forEach(option => {
      option.addEventListener('click', () => {
        const selectedStyle = option.getAttribute('data-style');
        
        // Update visual selection
        nodeStyleOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        // Update tree core node style
        treeCore.nodeStyle = selectedStyle;
        
        // Update renderer settings
        if (treeCore.renderer) {
          treeCore.renderer.settings.nodeStyle = selectedStyle;
          treeCore.renderer.needsRedraw = true;
        }
        
        // Update all existing nodes
        treeCore.updateAllExistingNodes();
        
        // Show notification
        const styleName = selectedStyle === 'circle' ? 'Circle' : 'Rectangle';
        notifications.success('Node Style Changed', `Changed to ${styleName} style`);
        
        // Save state for undo
        treeCore.undoRedoManager.pushUndoState();
      });
    });
  }

  // --- Display Preferences ---
  const preferences = ['showMaidenName', 'showDateOfBirth', 'showFatherName'];
  preferences.forEach(prefId => {
    const checkbox = document.getElementById(prefId);
    if (checkbox) {
      checkbox.checked = treeCore.displayPreferences[prefId];
      checkbox.addEventListener('change', () => {
        const prefKey = prefId;
        const newValue = checkbox.checked;
        treeCore.displayPreferences[prefKey] = newValue;
        if (treeCore.renderer) {
          treeCore.renderer.updateDisplayPreferences(treeCore.displayPreferences);
        }
        const label = checkbox.parentNode.querySelector('label').textContent;
        notifications.info('Display Updated', `${label} ${newValue ? 'enabled' : 'disabled'}`);
        treeCore.undoRedoManager.pushUndoState();
      });
    }
  });

  // --- Load Default Tree Button ---
  const loadDefaultBtn = document.getElementById('loadDefaultBtn');
  if (loadDefaultBtn) {
    loadDefaultBtn.addEventListener('click', () => {
      openLoadDefaultModal();
    });
  }

  // Load Default Tree Modal handlers
  function openLoadDefaultModal() {
    const modal = document.getElementById('loadDefaultConfirmModal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function closeLoadDefaultModal() {
    const modal = document.getElementById('loadDefaultConfirmModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  // Modal event listeners
  const cancelLoadDefaultBtn = document.getElementById('cancelLoadDefault');
  const confirmLoadDefaultBtn = document.getElementById('confirmLoadDefault');
  const loadDefaultModal = document.getElementById('loadDefaultConfirmModal');

  if (cancelLoadDefaultBtn) {
    cancelLoadDefaultBtn.addEventListener('click', closeLoadDefaultModal);
  }

  if (confirmLoadDefaultBtn) {
    confirmLoadDefaultBtn.addEventListener('click', () => {
      loadDefaultTemplate(treeCore);
      closeLoadDefaultModal();
    });
  }

  if (loadDefaultModal) {
    const closeBtn = loadDefaultModal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeLoadDefaultModal);
    }

    // Close on background click
    loadDefaultModal.addEventListener('click', (e) => {
      if (e.target === loadDefaultModal) {
        closeLoadDefaultModal();
      }
    });
  }

  // Load Default Template Function
  async function loadDefaultTemplate(treeCore) {
    try {
      notifications.info('Loading Template', 'Loading default family tree template...');
      
      const response = await fetch('./docs/templates/default.json');
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status}`);
      }
      
      const defaultData = await response.json();
      
      // Process the template data
      treeCore.processLoadedData(defaultData);
      
      // Update cache indicator if available
      if (treeCore.enhancedCacheIndicator) {
        treeCore.enhancedCacheIndicator.updateStats();
        treeCore.enhancedCacheIndicator.updateSaveStatus('Template loaded');
      }
      
      // Auto-save the new data
      if (treeCore.cacheManager) {
        treeCore.cacheManager.autoSave();
      }
      
      // Update undo/redo state
      if (treeCore.undoRedoManager) {
        treeCore.undoRedoManager.clearStacks();
        treeCore.undoRedoManager.pushUndoState();
      }
      
      notifications.success('Template Loaded', 'Default family tree template loaded successfully');
      
    } catch (error) {
      console.error('Failed to load default template:', error);
      notifications.error('Load Failed', 'Failed to load default template. Please try again.');
    }
  }

  // --- Tree Shapes ---
  const shapeSelect = document.getElementById('shapeSelect');
  const applyShapeBtn = document.getElementById('applyShape');
  const resetToManualBtn = document.getElementById('resetToManual');
  const shapeOptionsContainer = document.getElementById('shapeOptions');

  if (shapeSelect) {
    // Set initial value
    shapeSelect.value = treeCore.shapeManager.getCurrentShapeType();
    
    // Handle shape selection change
    shapeSelect.addEventListener('change', (e) => {
      const selectedShape = e.target.value;
      updateShapeOptions(selectedShape);
      
      // Show notification about shape selection
      const shapeNames = {
        'none': 'Manual Positioning',
        'grape': 'Grape Bunch',
        'treeBranches': 'Tree Branches'
      };
      const shapeName = shapeNames[selectedShape] || selectedShape;
      notifications.info('Shape Selected', `Selected: ${shapeName}`);
    });
    
    // Initialize with current shape options
    updateShapeOptions(shapeSelect.value);
  }

  if (applyShapeBtn) {
    applyShapeBtn.addEventListener('click', async () => {
      const selectedShape = shapeSelect.value;
      
      try {
        applyShapeBtn.disabled = true;
        applyShapeBtn.textContent = 'Applying...';
        
        if (selectedShape === 'none') {
          treeCore.shapeManager.resetToManual();
          notifications.success('Shape Applied', 'Reset to manual positioning');
        } else {
          // Get shape-specific options
          const options = getShapeOptionsFromUI();
          
          await treeCore.shapeManager.applyShape(selectedShape, options);
          
          const shapeNames = {
            'grape': 'Grape Bunch',
            'treeBranches': 'Tree Branches'
          };
          const shapeName = shapeNames[selectedShape] || selectedShape;
          notifications.success('Shape Applied', `Applied ${shapeName} layout`);
        }
        
        // Save state for undo
        if (treeCore.undoRedoManager) {
          treeCore.undoRedoManager.pushUndoState();
        }
        
      } catch (error) {
        console.error('Error applying shape:', error);
        notifications.error('Shape Error', 'Failed to apply shape layout');
      } finally {
        applyShapeBtn.disabled = false;
        applyShapeBtn.textContent = shapeSelect.value === 'none' ? 'Reset to Manual' : 'Apply Shape';
      }
    });
  }

  if (resetToManualBtn) {
    resetToManualBtn.addEventListener('click', () => {
      shapeSelect.value = 'none';
      treeCore.shapeManager.resetToManual();
      updateShapeOptions('none');
      notifications.success('Layout Reset', 'Reset to manual positioning');
      
      if (treeCore.undoRedoManager) {
        treeCore.undoRedoManager.pushUndoState();
      }
    });
  }

  // Helper function to update shape options UI
  function updateShapeOptions(shapeType) {
    if (!shapeOptionsContainer) return;
    
    // Clear existing options
    shapeOptionsContainer.innerHTML = '';
    
    if (shapeType === 'none') {
      shapeOptionsContainer.innerHTML = '<p class="shape-help">Manual positioning allows you to freely drag and place family members anywhere on the canvas.</p>';
      return;
    }
    
    // Get shape-specific configuration parameters
    const shapeClass = treeCore.shapeManager.availableShapes.get(shapeType);
    if (!shapeClass) return;
    
    const tempShape = new shapeClass(treeCore);
    const parameters = tempShape.getConfigParameters();
    
    // Create UI for each parameter
    Object.entries(parameters).forEach(([key, config]) => {
      const settingGroup = document.createElement('div');
      settingGroup.className = 'setting-group';
      
      const label = document.createElement('label');
      label.textContent = `${config.label}:`;
      label.setAttribute('for', `shape_${key}`);
      
      let input;
      if (config.type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.min = config.min;
        input.max = config.max;
        input.value = config.default;
      } else if (config.type === 'select') {
        input = document.createElement('select');
        config.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          if (option.value === config.default) {
            optionEl.selected = true;
          }
          input.appendChild(optionEl);
        });
      }
      
      if (input) {
        input.id = `shape_${key}`;
        input.dataset.shapeParam = key;
        
        settingGroup.appendChild(label);
        settingGroup.appendChild(input);
        shapeOptionsContainer.appendChild(settingGroup);
      }
    });
  }

  // Helper function to get shape options from UI
  function getShapeOptionsFromUI() {
    const options = {};
    const paramInputs = shapeOptionsContainer.querySelectorAll('[data-shape-param]');
    
    paramInputs.forEach(input => {
      const paramName = input.dataset.shapeParam;
      const value = input.type === 'number' ? parseInt(input.value, 10) : input.value;
      options[paramName] = value;
    });
    
    return options;
  }

  // Attach helpers to treeCore
  treeCore.updateRendererSettings = function() {
    if (!this.renderer) return;
    
    // Update basic renderer settings
    this.renderer.settings.nodeRadius = this.nodeRadius;
    this.renderer.settings.nodeColor = this.defaultColor;
    this.renderer.settings.fontFamily = this.fontFamily;
    this.renderer.settings.nameFontSize = this.fontSize;
    this.renderer.settings.nameColor = this.nameColor;
    this.renderer.settings.dobColor = this.dateColor;
    this.renderer.settings.nodeStyle = this.nodeStyle;
    
    // Apply line style settings from treeCore.lineStyleSettings if available
    // This preserves loaded settings and prevents override with defaults
    if (this.lineStyleSettings) {
      // Family line settings
      if (this.lineStyleSettings.familyLineStyle !== undefined) this.renderer.settings.familyLineStyle = this.lineStyleSettings.familyLineStyle;
      if (this.lineStyleSettings.familyLineThickness !== undefined) this.renderer.settings.familyLineThickness = this.lineStyleSettings.familyLineThickness;
      if (this.lineStyleSettings.familyLineColor !== undefined) this.renderer.settings.familyLineColor = this.lineStyleSettings.familyLineColor;
      
      // Spouse line settings
      if (this.lineStyleSettings.spouseLineStyle !== undefined) this.renderer.settings.spouseLineStyle = this.lineStyleSettings.spouseLineStyle;
      if (this.lineStyleSettings.spouseLineThickness !== undefined) this.renderer.settings.spouseLineThickness = this.lineStyleSettings.spouseLineThickness;
      if (this.lineStyleSettings.spouseLineColor !== undefined) this.renderer.settings.spouseLineColor = this.lineStyleSettings.spouseLineColor;
      
      // Line-only settings
      if (this.lineStyleSettings.lineOnlyStyle !== undefined) this.renderer.settings.lineOnlyStyle = this.lineStyleSettings.lineOnlyStyle;
      if (this.lineStyleSettings.lineOnlyThickness !== undefined) this.renderer.settings.lineOnlyThickness = this.lineStyleSettings.lineOnlyThickness;
      if (this.lineStyleSettings.lineOnlyColor !== undefined) this.renderer.settings.lineOnlyColor = this.lineStyleSettings.lineOnlyColor;
      
      // Node outline settings
      if (this.lineStyleSettings.showNodeOutline !== undefined) this.renderer.settings.showNodeOutline = this.lineStyleSettings.showNodeOutline;
      if (this.lineStyleSettings.outlineColor !== undefined) this.renderer.settings.outlineColor = this.lineStyleSettings.outlineColor;
      if (this.lineStyleSettings.outlineThickness !== undefined) this.renderer.settings.outlineThickness = this.lineStyleSettings.outlineThickness;
    }
    
    this.renderer.updateDisplayPreferences(this.displayPreferences);
    this.renderer.needsRedraw = true;
  };

  treeCore.updateAllExistingNodes = function() {
    if (!this.renderer) return;
    for (const [id, node] of this.renderer.nodes) {
      const personData = this.getPersonData(id) || {};
      this.renderer.setNode(id, {
        ...node,
        ...personData,
        color: node.color || this.defaultColor,
        radius: node.radius || this.nodeRadius
      });
    }
    this.renderer.needsRedraw = true;
  };
} 