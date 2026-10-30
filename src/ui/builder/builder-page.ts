// builder-page.ts - Builder page wiring: i18n init, drag-and-drop import,
// cache indicator, sidebar, view switching, settings and GEDCOM import.

import { rebuildTableView } from '@/ui/components/table.js';
import { initTreeChartView } from '@/features/tree-chart/tree-chart-view.js';
import { appContext, EVENTS } from '@/utils/event-bus.js';
import '@/features/tree-chart/styles/tree-chart.css';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.i18n) {
    try {
      await window.i18n.init();
    } catch (error) {
      console.error('i18n initialization failed:', error);
    }
  }

  setupDragAndDrop();
  setupCacheIndicator();

  // These need the tree core that tree.js creates after its async IndexedDB migration. Wait for it
  // instead of a fixed delay, which left the view buttons dead for the first second. Give up after
  // 5 s and initialize anyway so the UI never stays inert.
  const deadline = Date.now() + 5000;
  const initWhenReady = () => {
    if (!window.treeCore?.personData && Date.now() < deadline) {
      setTimeout(initWhenReady, 50);
      return;
    }
    initializeSidebar();
    initializeEnhancedSettings();
    initializeEnhancedCacheIndicator();
    initTreeChartView(document.getElementById('treeChartView'));
    document.body.dataset.builderReady = 'true';
  };
  initWhenReady();
});

function setupDragAndDrop() {
  const importExportArea = document.getElementById('importExportArea');
  if (!importExportArea) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    importExportArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    importExportArea.addEventListener(eventName, () => importExportArea.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    importExportArea.addEventListener(eventName, () => importExportArea.classList.remove('dragover'), false);
  });

  importExportArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const loadDataInput = document.getElementById('loadData') as HTMLInputElement | null;
        if (loadDataInput) {
          const fileList = new DataTransfer();
          fileList.items.add(file);
          Object.defineProperty(loadDataInput, 'files', { value: fileList.files, writable: true });
          loadDataInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        const { notifications } = await import('@/ui/components/notifications.js');
        const errorTitle = window.i18n ? window.i18n.t('builder.notifications.invalid_file') : 'Invalid File';
        const errorMessage = window.i18n ? window.i18n.t('builder.notifications.drop_json') : 'Please drop a JSON file';
        notifications.error(errorTitle, errorMessage);
      }
    }
  }, false);
}

function setupCacheIndicator() {
  const cacheIndicator = document.getElementById('cacheIndicator');
  if (!cacheIndicator) return;

  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('familyTreeCanvas')) {
      const saveIndicator = document.getElementById('saveIndicator');
      if (saveIndicator) {
        const savedText = window.i18n ? window.i18n.t('builder.cache.saved') : 'Saved';
        saveIndicator.textContent = `${savedText}: ${new Date().toLocaleTimeString()}`;
        cacheIndicator.classList.add('saving');
        setTimeout(() => cacheIndicator.classList.remove('saving'), 2000);
      }
    }
  });

  setTimeout(() => {
    const cachedData = localStorage.getItem('familyTreeCanvas_state');
    if (cachedData) {
      const saveIndicator = document.getElementById('saveIndicator');
      if (saveIndicator) {
        try {
          const data = JSON.parse(cachedData);
          const lastSave = new Date(data.timestamp);
          const lastSavedText = window.i18n ? window.i18n.t('builder.cache.last_saved') : 'Last saved';
          saveIndicator.textContent = `${lastSavedText}: ${lastSave.toLocaleTimeString()}`;
        } catch (error) {
          const cachedText = window.i18n ? window.i18n.t('builder.cache.cached_available') : 'Cached data available';
          saveIndicator.textContent = cachedText;
        }
      }
    }
  }, 2000);
}

function initializeEnhancedCacheIndicator() {
  class EnhancedCacheIndicator {
    indicator: HTMLElement | null;
    saveIndicator: HTMLElement | null;
    treeNameInput: HTMLInputElement | null;
    personCount: HTMLElement | null;
    connectionCount: HTMLElement | null;
    autoSaveStatus: HTMLElement | null;
    expandTimeout: ReturnType<typeof setTimeout> | null;
    isExpanded: boolean;

    constructor() {
      this.indicator = document.getElementById('cacheIndicator');
      this.saveIndicator = document.getElementById('saveIndicator');
      this.treeNameInput = document.getElementById('treeNameInput') as HTMLInputElement | null;
      this.personCount = document.getElementById('personCount');
      this.connectionCount = document.getElementById('connectionCount');
      this.autoSaveStatus = document.getElementById('autoSaveStatus');
      this.expandTimeout = null;
      this.isExpanded = false;
      this.init();
    }

    init() {
      if (this.indicator) {
        this.indicator.addEventListener('click', () => this.toggleExpand());
        this.indicator.addEventListener('mouseleave', () => this.scheduleCollapse());
        this.indicator.addEventListener('mouseenter', () => {
          if (this.expandTimeout) { clearTimeout(this.expandTimeout); this.expandTimeout = null; }
        });
        const expandedContent = this.indicator.querySelector('.cache-expanded-content');
        if (expandedContent) {
          expandedContent.addEventListener('click', (e: Event) => { e.stopPropagation(); this.clearCollapseTimer(); });
          expandedContent.addEventListener('mouseenter', () => this.clearCollapseTimer());
        }
      }
      if (this.treeNameInput) {
        this.treeNameInput.addEventListener('change', () => this.saveTreeName());
        this.treeNameInput.addEventListener('click', (e: Event) => { e.stopPropagation(); this.clearCollapseTimer(); });
        this.treeNameInput.addEventListener('focus', (e: Event) => { e.stopPropagation(); this.clearCollapseTimer(); });
        this.treeNameInput.addEventListener('input', () => this.clearCollapseTimer());
        this.treeNameInput.addEventListener('keydown', () => this.clearCollapseTimer());
        this.treeNameInput.addEventListener('blur', () => { this.saveTreeName(); this.scheduleCollapse(2000); });
      }
      this.updateStats();
      this.loadTreeName();
    }

    toggleExpand() {
      this.isExpanded = !this.isExpanded;
      if (this.isExpanded) {
        this.indicator.classList.add('expanded');
        this.updateStats();
        this.scheduleCollapse(4000);
      } else {
        this.indicator.classList.remove('expanded');
        if (this.expandTimeout) { clearTimeout(this.expandTimeout); this.expandTimeout = null; }
      }
    }

    scheduleCollapse(delay = 500) {
      if (this.expandTimeout) clearTimeout(this.expandTimeout);
      this.expandTimeout = setTimeout(() => {
        if (this.isExpanded) { this.isExpanded = false; this.indicator.classList.remove('expanded'); }
      }, delay);
    }

    clearCollapseTimer() {
      if (this.expandTimeout) { clearTimeout(this.expandTimeout); this.expandTimeout = null; }
    }

    updateStats() {
      if (window.treeCore) {
        const personCount = window.treeCore.renderer?.nodes.size || 0;
        const connectionCount = window.treeCore.renderer?.connections.length || 0;
        if (this.personCount) this.personCount.textContent = String(personCount);
        if (this.connectionCount) this.connectionCount.textContent = String(connectionCount);
      }
    }

    saveTreeName() {
      if (this.treeNameInput) {
        const treeName = this.treeNameInput.value.trim() || 'My Family Tree';
        localStorage.setItem('familyTree_treeName', treeName);
      }
    }

    loadTreeName() {
      const savedName = localStorage.getItem('familyTree_treeName') || 'My Family Tree';
      if (this.treeNameInput) this.treeNameInput.value = savedName;
    }

    updateSaveStatus(status: string, time: string) {
      if (this.saveIndicator) this.saveIndicator.textContent = `${status}: ${time}`;
    }
  }
  window.enhancedCacheIndicator = new EnhancedCacheIndicator();
}

let currentView = 'graphic';

function initializeSidebar() {
  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => { window.location.href = '/'; });
  }

  const centerSelectedBtn = document.getElementById('centerSelectedBtn');
  if (centerSelectedBtn) {
    centerSelectedBtn.addEventListener('click', () => {
      const treeCore = window.treeCore;
      if (treeCore && typeof treeCore.centerSelectedNode === 'function') {
        treeCore.centerSelectedNode();
      }
    });
  }

  const zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => triggerCanvasZoom(-100));

  const zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => triggerCanvasZoom(100));

  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');

  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPanel.classList.toggle('hidden');
      settingsToggle.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!settingsPanel.contains(e.target as Node) && !settingsToggle.contains(e.target as Node)) {
        if (!settingsPanel.classList.contains('hidden')) {
          settingsPanel.classList.add('hidden');
          settingsToggle.classList.remove('active');
        }
      }
    });
  }

  document.querySelectorAll('#viewSelector .view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView((btn as HTMLElement).dataset.view || 'graphic'));
  });
}

function triggerCanvasZoom(deltaY: number) {
  if (currentView === 'treeChart') {
    (window as any)._treeChartView?.zoom(deltaY > 0 ? 1 : -1);
    return;
  }
  let target: Element | null = null;
  if (currentView === 'graphic') {
    const graphicView = document.getElementById('graphicView');
    const canvas = graphicView?.querySelector('canvas');
    target = canvas || document.getElementById('svgArea');
  } else {
    return;
  }
  if (target) {
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new WheelEvent('wheel', {
      deltaY,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true
    }));
  }
}

function setView(name: string) {
  const containers: Record<string, HTMLElement | null> = {
    graphic: document.getElementById('graphicView'),
    treeChart: document.getElementById('treeChartView'),
    table: document.getElementById('tableView')
  };
  const buttons: Record<string, HTMLElement | null> = {
    graphic: document.getElementById('viewGraphicBtn'),
    treeChart: document.getElementById('viewTreeChartBtn'),
    table: document.getElementById('viewTableBtn')
  };
  if (!containers[name]) return;

  currentView = name;
  for (const [key, el] of Object.entries(containers)) {
    if (!el) continue;
    el.classList.toggle('hidden', key !== name);
  }
  for (const [key, btn] of Object.entries(buttons)) {
    if (!btn) continue;
    btn.classList.toggle('active', key === name);
    btn.setAttribute('aria-selected', key === name ? 'true' : 'false');
  }

  document.dispatchEvent(new CustomEvent('view:changed', { detail: { name } }));
  try {
    appContext.getEventBus().emit(EVENTS.UI_VIEW_CHANGED, { view: name, trigger: 'click' });
  } catch {}

  if (name === 'table') setTimeout(() => rebuildTableView(), 100);
}

function initializeEnhancedSettings() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      const content = document.getElementById(targetId);
      if (content) {
        content.classList.toggle('expanded');
        header.classList.toggle('expanded');
      }
    });
  });
}

// GEDCOM Import
(function setupGedcomImport() {
  const importBtn = document.getElementById('importGedcomBtn');
  const modal = document.getElementById('importGedcomModal');
  const closeBtn = document.getElementById('importGedcomClose');
  const cancelBtn = document.getElementById('gedcomCancelBtn');
  const fileInput = document.getElementById('gedcomFileInput') as HTMLInputElement | null;
  const preview = document.getElementById('gedcomPreview');
  const previewSummary = document.getElementById('gedcomPreviewSummary');
  const conflictsDiv = document.getElementById('gedcomConflicts');
  const doImportBtn = document.getElementById('gedcomImportBtn') as HTMLButtonElement | null;

  if (!importBtn || !modal || !fileInput || !doImportBtn || !preview || !conflictsDiv) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsedPersons: any[] = [];

  importBtn.addEventListener('click', () => {
    fileInput.value = '';
    parsedPersons = [];
    doImportBtn.disabled = true;
    preview.classList.add('hidden');
    conflictsDiv.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  function closeModal() {
    modal!.classList.add('hidden');
    parsedPersons = [];
    doImportBtn!.disabled = true;
    preview!.classList.add('hidden');
    conflictsDiv!.classList.add('hidden');
  }
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const importFromGedcom = window.__gedcomImport;
    const SecurityUtils = window.__SecurityUtils;
    try {
      const text = await file.text();
      const result = importFromGedcom(text);
      parsedPersons = result.persons;

      SecurityUtils.setTextContent(previewSummary, `Found ${parsedPersons.length} person(s) in file.`);
      preview.classList.remove('hidden');

      const existingCount = window.treeCore?.renderer?.nodes?.size ?? 0;
      if (existingCount > 0) {
        conflictsDiv.classList.remove('hidden');
      } else {
        conflictsDiv.classList.add('hidden');
      }

      doImportBtn.disabled = parsedPersons.length === 0;
    } catch (err) {
      console.error('[GEDCOM import] parse error:', err);
      SecurityUtils.setTextContent(previewSummary, 'Error parsing file. Is this a valid .ged file?');
      preview.classList.remove('hidden');
      doImportBtn.disabled = true;
    }
  });

  doImportBtn.addEventListener('click', () => {
    if (!parsedPersons.length) return;

    const conflictMode = (document.querySelector('input[name="gedcomConflictMode"]:checked') as HTMLInputElement)?.value ?? 'replace';
    let personsToLoad = parsedPersons;

    if (conflictMode === 'merge' && window.treeCore) {
      const existing = Array.from(window.treeCore.personData?.values() ?? []);
      const existingIds = new Set(existing.map((p: any) => p.id));
      const newOnly = parsedPersons.filter(p => !existingIds.has(p.id));
      personsToLoad = [...existing, ...newOnly];
    }

    if (window.treeCore?.processLoadedData) {
      window.treeCore.processLoadedData({ persons: personsToLoad });
    }
    closeModal();
  });
})();
