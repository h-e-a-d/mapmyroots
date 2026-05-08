// modal.js - ENHANCED with optimized UX/UI
// Updated to work with Canvas-based tree implementation
// Enhanced with radio button support, maiden name handling, delete functionality, and i18n support
// UPDATED: Shows person names in titles, improved UX, mobile optimization, enhanced animations

import { updateSearchableSelects } from '../components/searchableSelect.js';
import { SecurityUtils, DOMUtils } from '../../utils/security-utils.js';
import { RetryManager } from '../../utils/error-handling.js';
import { appContext, EVENTS } from '../../utils/event-bus.js';
import { createDateInput } from '../components/date-input.js';
import { setupInlineReveal } from '../components/inline-reveal.js';
import { createMarriagesList } from '../components/marriages-list.js';
import { isValidDateValue } from '../../utils/date-value.js';
import { mountCropper, DEFAULT_TRANSFORM } from '../../features/photos/avatar-cropper.js';
import { prepareImageUpload, shouldWarnAboutStorage } from '../../features/photos/photo-utils.js';

let isModalOpen = false;
let currentEditingId = null;
let cropperHandle = null;

// Helper function to get translated text
function t(key, fallback = '') {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key);
  }
  return fallback || key;
}

// Get selected gender from radio buttons
export function getSelectedGender() {
  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  
  if (maleRadio && maleRadio.checked) return 'male';
  if (femaleRadio && femaleRadio.checked) return 'female';
  return '';
}

// ENHANCED: Enhanced openModalForEdit with person name in title and better animations
export function openModalForEdit(personId, retryCount = 0) {
  const maxRetries = 10;
  
  console.log('🎨 Opening modal for:', personId);
  
  const modal = document.getElementById('personModal');
  const titleEl = document.getElementById('modalTitle');
  const deleteBtn = document.getElementById('deletePersonBtn');

  if (!modal || !titleEl) {
    devError('Modal elements not found');
    return;
  }

  // Use global tree core instead of importing
  const treeCore = window.treeCore;
  
  if (personId) {
    // Check if tree core is fully initialized
    if (!treeCore || !treeCore.renderer) {
      console.log(`Tree core not ready for modal (attempt ${retryCount + 1}/${maxRetries}), retrying in 500ms...`);
      console.log('Tree core state:', {
        treeCore: !!treeCore,
        renderer: !!treeCore?.renderer,
        nodes: treeCore?.renderer?.nodes?.size || 0
      });
      
      if (retryCount < maxRetries) {
        setTimeout(() => openModalForEdit(personId, retryCount + 1), 500);
      } else {
        console.error('Max retries reached for modal. Tree core may not be initializing properly.');
      }
      return;
    }
    
    // Get person data for the title
    const personData = treeCore.getPersonData(personId);
    const node = treeCore.renderer?.nodes.get(personId);
    
    // Debug: Log what data we're getting
    console.log('=== MODAL EDIT DEBUG ===');
    console.log('Person ID:', personId);
    console.log('PersonData:', personData);
    console.log('Node data:', node);
    console.log('Renderer nodes count:', treeCore.renderer?.nodes.size || 0);
    console.log('PersonData count:', treeCore.personData?.size || 0);
    console.log('=== END MODAL DEBUG ===');
    
    // Build person name for title
    let personName = '';
    if (node?.name || personData?.name) {
      personName = node?.name || personData?.name;
      if (node?.surname || personData?.surname) {
        personName += ` ${node?.surname || personData?.surname}`;
      }
    }
    
    // Set title with person icon and name (safe DOM manipulation)
    titleEl.innerHTML = ''; // Clear existing content
    
    const iconSpan = SecurityUtils.createElement('span', {
      className: 'person-icon'
    }, personName ? getPersonInitials(personName) : '?');
    
    titleEl.appendChild(iconSpan);
    
    if (personName) {
      const nameText = document.createTextNode(` ${SecurityUtils.sanitizeText(personName)}`);
      titleEl.appendChild(nameText);
    } else {
      const titleText = document.createTextNode(` ${t('builder.modals.person.edit_title', 'Edit Person')}`);
      titleEl.appendChild(titleText);
    }
    
    modal.dataset.editingId = personId;
    currentEditingId = personId;

    devLog('Setting editing ID to:', personId);

    // Show delete button for editing mode
    if (deleteBtn) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.disabled = false; // Ensure button is enabled
      deleteBtn.classList.remove('loading'); // Clear any loading state
      console.log('✅ Delete button enabled for editing mode');
    }

    if (!personData && !node) {
      devWarn(`No data found for id="${personId}"`);
      return;
    }

    // Populate the form fields
    populateFormFields(node, personData);

    // Extract existing mother/father/spouse IDs
    const existingData = {
      motherId: personData?.motherId || '',
      fatherId: personData?.fatherId || '',
      spouseId: personData?.spouseId || ''
    };

    // Rebuild searchable selects, passing in existing IDs
    setTimeout(() => updateSearchableSelects(existingData), 100);
  } else {
    // New person mode - build safely using DOM API
    titleEl.innerHTML = ''; // Clear existing content

    const iconSpan = document.createElement('span');
    iconSpan.className = 'person-icon';
    iconSpan.textContent = '+';

    const titleText = document.createTextNode(' ' + t('builder.modals.person.add_title', 'Add Person'));

    titleEl.appendChild(iconSpan);
    titleEl.appendChild(titleText);

    delete modal.dataset.editingId;
    currentEditingId = null;

    devLog('Clearing editing ID for new person');

    // Hide delete button for new person mode
    if (deleteBtn) {
      deleteBtn.classList.add('hidden');
      deleteBtn.disabled = false; // Reset state for next time
      deleteBtn.classList.remove('loading'); // Clear any loading state
      console.log('🔄 Delete button reset for new person mode');
    }

    // Clear all form fields
    clearForm();

    // No existing relationships
    setTimeout(() => updateSearchableSelects({}), 100);
  }

  // Show the modal with enhanced animation
  showModalWithAnimation(modal);
  
  devLog('Modal opened successfully');
}

// Helper function to get person initials for icon
function getPersonInitials(name) {
  if (!name) return '?';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

let birthDateHandle = null;
let deathDateHandle = null;
let marriagesListHandle = null;

// Helper function to populate form fields
function populateFormFields(node, personData) {
  document.getElementById('personName').value = node?.name || personData?.name || '';
  document.getElementById('personFatherName').value = node?.fatherName || personData?.fatherName || '';
  document.getElementById('personSurname').value = node?.surname || personData?.surname || '';
  document.getElementById('personMaidenName').value = node?.maidenName || personData?.maidenName || '';

  const gender = node?.gender || personData?.gender || '';
  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  if (maleRadio && femaleRadio) {
    maleRadio.checked = gender === 'male';
    femaleRadio.checked = gender === 'female';
    updateGenderRadioStyles();
  }

  const birth = personData?.birth || { date: null, place: '', note: '' };
  const death = personData?.death || { date: null, place: '', note: '' };
  mountEvent('Birth', birth, (h) => { birthDateHandle = h; });
  mountEvent('Death', death, (h) => { deathDateHandle = h; });

  const allPersons = Array.from(window.treeCore?.personData?.values() || []);
  const marriagesMount = document.getElementById('personMarriagesMount');
  if (marriagesMount) {
    marriagesMount.innerHTML = '';
    marriagesListHandle = createMarriagesList({
      container: marriagesMount,
      marriages: Array.isArray(personData?.marriages) ? personData.marriages : [],
      getAllPersons: () => Array.from(window.treeCore?.personData?.values() || []),
      currentPersonId: personData?.id || node?.id || '',
      confirmSpouseChange: showSpouseChangeConfirmation,
      t
    });
  }

  const notesEl = document.getElementById('personNotes');
  if (notesEl) notesEl.value = personData?.notes || '';
  setupInlineReveal({
    trigger: document.getElementById('personNotesReveal'),
    target: document.getElementById('personNotesWrapper')
  });

  const photoMediaIdInput = document.getElementById('personPhotoMediaId');
  const photoTransformInput = document.getElementById('personPhotoTransform');
  const photo = personData?.photo || null;
  if (photoMediaIdInput) photoMediaIdInput.value = photo?.mediaId || '';
  if (photoTransformInput) photoTransformInput.value = JSON.stringify(photo?.transform || DEFAULT_TRANSFORM);
  mountAvatarCropperForPerson(photo);
}

function mountEvent(kind, event, setHandle) {
  const dateMount = document.getElementById(`person${kind}DateMount`);
  if (dateMount) {
    dateMount.innerHTML = '';
    const handle = createDateInput({ idPrefix: `person${kind}`, container: dateMount });
    handle.setValue(isValidDateValue(event.date) ? event.date : null);
    setHandle(handle);
  }

  const placeInput = document.getElementById(`person${kind}Place`);
  if (placeInput) placeInput.value = event.place || '';
  setupInlineReveal({
    trigger: document.getElementById(`person${kind}PlaceReveal`),
    target: document.getElementById(`person${kind}PlaceWrapper`)
  });

  const noteInput = document.getElementById(`person${kind}Note`);
  if (noteInput) noteInput.value = event.note || '';
  setupInlineReveal({
    trigger: document.getElementById(`person${kind}NoteReveal`),
    target: document.getElementById(`person${kind}NoteWrapper`)
  });
}

async function mountAvatarCropperForPerson(photo) {
  const mount = document.getElementById('avatarCropperMount');
  const panel = document.getElementById('tab-photo');
  if (!mount) return;
  if (cropperHandle) { cropperHandle.destroy(); cropperHandle = null; mount.innerHTML = ''; }

  if (!photo?.mediaId) {
    panel?.classList.remove('has-photo');
    return;
  }

  const mountToken = Symbol();
  mount._mountToken = mountToken;

  const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
  const record = await repo?.getMedia(photo.mediaId).catch(() => null);

  // Bail if modal was closed or another mount started while we were waiting
  if (mount._mountToken !== mountToken) return;

  if (!record?.blob) {
    panel?.classList.remove('has-photo');
    return;
  }
  cropperHandle = mountCropper({
    container: mount,
    blob: record.blob,
    transform: photo.transform || DEFAULT_TRANSFORM,
    onChange: (t) => {
      const input = document.getElementById('personPhotoTransform');
      if (input) input.value = JSON.stringify(t);
      const zoomSlider = document.getElementById('avatarZoom');
      if (zoomSlider && Math.abs(Number(zoomSlider.value) - t.scale) > 0.001) {
        zoomSlider.value = String(t.scale);
      }
    }
  });
  panel?.classList.add('has-photo');
}

function showSpouseChangeConfirmation({ previousSpouseId, newSpouseId, confirm, cancel }) {
  const oldSpouse = window.treeCore?.personData?.get(previousSpouseId);
  const oldName = oldSpouse ? `${oldSpouse.name || ''} ${oldSpouse.surname || ''}`.trim() : t('builder.notifications.unknown_person', 'Unknown');
  const message = t('builder.modals.confirm_change_spouse.body', `Changing the spouse will remove this marriage from {{name}}'s record. Continue?`).replace('{{name}}', oldName);
  if (window.confirm(message)) {
    confirm();
  } else {
    cancel();
  }
}

function activateTab(tabBtnId) {
  const tabs = document.querySelectorAll('.person-modal-tabs [role="tab"]');
  const panels = document.querySelectorAll('#personForm [role="tabpanel"]');
  tabs.forEach((tab) => {
    const isActive = tab.id === tabBtnId;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.hidden = panel.getAttribute('aria-labelledby') !== tabBtnId;
  });
}

function setupTabs() {
  const tabsEl = document.querySelector('.person-modal-tabs');
  if (!tabsEl || tabsEl.dataset.wired) return;
  tabsEl.dataset.wired = 'true';
  const tabs = tabsEl.querySelectorAll('[role="tab"]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.id));
    tab.addEventListener('keydown', (e) => {
      const tabArr = Array.from(tabs);
      const idx = tabArr.indexOf(tab);
      if (e.key === 'ArrowRight') tabArr[(idx + 1) % tabArr.length].focus();
      else if (e.key === 'ArrowLeft') tabArr[(idx - 1 + tabArr.length) % tabArr.length].focus();
    });
  });
}

// ENHANCED: Enhanced modal show function with better animation and UX
function showModalWithAnimation(modal) {
  setupTabs();
  activateTab('tab-details-btn');

  // Ensure modal structure is optimized
  ensureModalStructure(modal);
  
  // Add modal header if it doesn't exist
  const modalContent = modal.querySelector('.modal-content');
  const titleEl = modal.querySelector('#modalTitle');
  
  if (modalContent && titleEl && !titleEl.parentElement.classList.contains('modal-header')) {
    // Wrap title in header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    titleEl.parentElement.insertBefore(header, titleEl);
    header.appendChild(titleEl);
  }
  
  // Add modal-body class to form container if not exists
  const formContainer = modal.querySelector('#personForm').parentElement;
  if (formContainer && !formContainer.classList.contains('modal-body')) {
    formContainer.classList.add('modal-body');
  }
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');
  
  // Show modal with enhanced animation
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.classList.add('modal-enhanced');
  isModalOpen = true;
  
  // CRITICAL FIX: Reset all button states when modal opens
  const modalButtons = modal.querySelectorAll('button');
  modalButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.removeAttribute('aria-label');
    // Clear any stored loading states
    if (btn.hasAttribute('data-original-text')) {
      btn.removeAttribute('data-original-text');
    }
  });
  console.log('✅ Modal opened: All buttons reset to enabled state');
  
  // Enhanced focus management
  setTimeout(() => {
    const firstInput = document.getElementById('personName');
    if (firstInput) {
      firstInput.focus();
      firstInput.select(); // Select text for easy editing
      
      // Add focus glow effect
      firstInput.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.2)';
      setTimeout(() => {
        firstInput.style.boxShadow = '';
      }, 1000);
    }
  }, 300);
  
  // Setup enhanced keyboard navigation
  setupEnhancedKeyboardNavigation(modal);
}

// ENHANCED: Enhanced close modal with better animation
export function closeModal() {
  devLog('Closing modal...');
  
  const modal = document.getElementById('personModal');

  if (!modal) {
    devError('Modal not found');
    return;
  }

  // Add enhanced closing animation
  modal.style.animation = 'modalFadeOut 0.3s ease-in';
  modal.classList.add('modal-closing');
  
  setTimeout(() => {
    // Clear the form
    clearForm();

    // Clear searchable selects
    document.querySelectorAll('.searchable-select').forEach(container => {
      container.innerHTML = '';
    });

    // Restore body scroll
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');

    // Hide the modal and clear all editing state
    modal.classList.add('hidden');
    modal.classList.remove('modal-enhanced', 'modal-closing');
    modal.style.display = 'none';
    modal.style.animation = '';
    delete modal.dataset.editingId;
    currentEditingId = null;
    isModalOpen = false;
    
    // Clear any loading states and ensure buttons are enabled
    clearButtonLoadingStates();
    
    // Safety check: ensure all modal buttons are properly enabled
    const modalButtons = document.querySelectorAll('#personModal button, #deleteConfirmModal button');
    modalButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.removeAttribute('aria-label');
    });
    console.log('🔄 All modal buttons reset to enabled state');
    
    devLog('Modal closed successfully');
  }, 300);
}

function clearForm() {
  const form = document.getElementById('personForm');
  if (form) form.reset();

  ['personName', 'personFatherName', 'personSurname', 'personMaidenName'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const emptyEvent = { date: null, place: '', note: '' };
  mountEvent('Birth', emptyEvent, (h) => { birthDateHandle = h; });
  mountEvent('Death', emptyEvent, (h) => { deathDateHandle = h; });
  ['personBirthPlaceWrapper', 'personBirthNoteWrapper', 'personDeathPlaceWrapper', 'personDeathNoteWrapper', 'personNotesWrapper'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['personBirthPlaceReveal', 'personBirthNoteReveal', 'personDeathPlaceReveal', 'personDeathNoteReveal', 'personNotesReveal'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  });
  const notesEl = document.getElementById('personNotes');
  if (notesEl) notesEl.value = '';
  setupInlineReveal({
    trigger: document.getElementById('personNotesReveal'),
    target: document.getElementById('personNotesWrapper')
  });

  const marriagesMount = document.getElementById('personMarriagesMount');
  if (marriagesMount) marriagesMount.innerHTML = '';
  marriagesListHandle = null;

  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  if (maleRadio) maleRadio.checked = false;
  if (femaleRadio) femaleRadio.checked = false;
  updateGenderRadioStyles();
  clearErrorStates();

  const photoMediaIdInput = document.getElementById('personPhotoMediaId');
  const photoTransformInput = document.getElementById('personPhotoTransform');
  if (photoMediaIdInput) photoMediaIdInput.value = '';
  if (photoTransformInput) photoTransformInput.value = JSON.stringify(DEFAULT_TRANSFORM);
  const photoFileInput = document.getElementById('personPhotoInput');
  if (photoFileInput) photoFileInput.value = '';
  document.getElementById('tab-photo')?.classList.remove('has-photo');
  if (cropperHandle) { cropperHandle.destroy(); cropperHandle = null; }
  const cropperMount = document.getElementById('avatarCropperMount');
  if (cropperMount) { delete cropperMount._mountToken; cropperMount.innerHTML = ''; }
}

export function isModalCurrentlyOpen() {
  return isModalOpen;
}

// ENHANCED: Delete person functionality with better UX
function openDeleteConfirmModal() {
  devLog('Opening delete confirmation modal');
  devLog('Current editing ID:', currentEditingId);
  
  const modal = document.getElementById('personModal');
  devLog('Modal dataset editing ID:', modal?.dataset.editingId);
  
  const deleteModal = document.getElementById('deleteConfirmModal');
  if (deleteModal) {
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('modal-enhanced');
    deleteModal.style.display = 'flex';
    
    // CRITICAL FIX: Reset all button states when delete modal opens
    const deleteModalButtons = deleteModal.querySelectorAll('button');
    deleteModalButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.removeAttribute('aria-label');
      if (btn.hasAttribute('data-original-text')) {
        btn.removeAttribute('data-original-text');
      }
    });
    console.log('✅ Delete modal opened: All buttons reset to enabled state');
    
    // Focus the cancel button by default for safety
    setTimeout(() => {
      const cancelBtn = document.getElementById('cancelDeletePerson');
      if (cancelBtn) cancelBtn.focus();
    }, 100);
  }
}

function closeDeleteConfirmModal() {
  const deleteModal = document.getElementById('deleteConfirmModal');
  if (deleteModal) {
    deleteModal.style.animation = 'modalFadeOut 0.2s ease-in';
    
    setTimeout(() => {
      deleteModal.classList.add('hidden');
      deleteModal.classList.remove('modal-enhanced');
      deleteModal.style.display = 'none';
      deleteModal.style.animation = '';
    }, 200);
  }
}

function confirmDeletePerson() {
  // Get the editing ID from modal dataset or currentEditingId
  const modal = document.getElementById('personModal');
  const editingId = modal?.dataset.editingId || currentEditingId;
  
  if (!editingId) {
    devError('No person selected for deletion');
    closeDeleteConfirmModal();
    return;
  }

  devLog('Deleting person with ID:', editingId);

  // Show loading state on confirm button
  const confirmBtn = document.getElementById('confirmDeletePerson');
  if (confirmBtn) {
    setButtonLoading(confirmBtn, true);
  }

  // Use global tree core instead of importing
  const treeCore = window.treeCore;
  
  const personData = treeCore.getPersonData(editingId);
  const node = treeCore.renderer?.nodes.get(editingId);
  
  // Get person name for notification
  let personName = t('builder.notifications.unknown_person', 'Unknown');
  if (node?.name || personData?.name) {
    personName = `${node?.name || personData?.name} ${node?.surname || personData?.surname || ''}`.trim();
  }

  // Delete the person
  const removedPerson = treeCore.personData?.get(editingId);
  if (removedPerson?.photo?.mediaId) {
    const repo = treeCore.cacheManager?.getIdbRepo?.();
    repo?.deleteMedia(removedPerson.photo.mediaId)
         .catch((err) => console.warn('[modal] deleteMedia failed:', err));
    treeCore.renderer?.clearMediaImage(removedPerson.photo.mediaId);
  }
  treeCore.renderer.removeNode(editingId);
  treeCore.personData?.delete(editingId);
  
  // Regenerate connections and save state
  treeCore.regenerateConnections();
  treeCore.undoRedoManager.pushUndoState();
  
  // Show notification with translated messages
  import('../components/notifications.js').then(({ notifications }) => {
    const deleteTitle = t('builder.notifications.person_deleted', 'Person Deleted');
    const deleteMessage = t('builder.notifications.delete_success', `{{name}} has been deleted from the tree`).replace('{{name}}', personName);
    notifications.success(deleteTitle, deleteMessage);
  });
  
  // Close both modals
  setTimeout(() => {
    setButtonLoading(confirmBtn, false);
    closeDeleteConfirmModal();
    closeModal();
  }, 500);
  
  devLog(`Deleted person: ${editingId}`);
}

// ENHANCED: Enhanced form validation with better UX and animations
function validateForm() {
  const nameInput = document.getElementById('personName');
  const gender = getSelectedGender();
  
  // Clear previous error states
  clearErrorStates();
  
  let isValid = true;
  const errors = [];
  
  if (!nameInput || !nameInput.value.trim()) {
    errors.push({
      field: nameInput,
      message: t('builder.validation.name_required', 'Please enter a name.')
    });
    isValid = false;
  }
  
  if (!gender) {
    const genderGroup = document.querySelector('.gender-radio-group');
    errors.push({
      field: genderGroup,
      message: t('builder.validation.gender_required', 'Please select a gender.')
    });
    isValid = false;
  }

  const dateInvalid = (birthDateHandle?.isInvalid?.()) ||
    (deathDateHandle?.isInvalid?.()) ||
    (marriagesListHandle?.hasInvalidDate?.());
  if (dateInvalid) {
    errors.push({
      field: document.querySelector('.date-input-text[aria-invalid="true"]') || document.getElementById('personBirthDate'),
      message: t('builder.validation.invalid_date_format', 'Use dd.mm.yyyy or yyyy.')
    });
    isValid = false;
  }

  // Show errors with enhanced UX and animations
  if (!isValid) {
    showValidationErrors(errors);
  }
  
  return isValid;
}

function clearErrorStates() {
  document.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
  });
  document.querySelectorAll('.error-message').forEach(msg => {
    msg.remove();
  });
}

function showValidationErrors(errors) {
  errors.forEach((error, index) => {
    setTimeout(() => {
      if (error.field) {
        const formGroup = error.field.closest('.form-group') || error.field;
        formGroup.classList.add('error');
        
        // Add shake animation
        formGroup.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          formGroup.style.animation = '';
        }, 500);
        
        // Add error message with slide animation
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = error.message;
        errorMsg.style.cssText = `
          color: #dc3545;
          font-size: 12px;
          margin-top: 6px;
          font-weight: 500;
          line-height: 1.3;
          animation: slideDown 0.3s ease-out;
        `;
        
        formGroup.appendChild(errorMsg);
        
        // Focus first error field with enhanced visual feedback
        if (index === 0 && error.field.focus) {
          error.field.focus();
          error.field.style.borderColor = '#dc3545';
          setTimeout(() => {
            error.field.style.borderColor = '';
          }, 2000);
        }
      }
    }, index * 100); // Stagger error display
  });
  
  // Show summary notification
  import('../components/notifications.js').then(({ notifications }) => {
    const errorTitle = t('builder.validation.form_errors', 'Please fix the errors below:');
    notifications.error('Validation Error', errorTitle);
  });
}

// ENHANCED: Enhanced gender radio button management
function updateGenderRadioStyles() {
  const radioOptions = document.querySelectorAll('.gender-radio-option');
  radioOptions.forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });
}

// ENHANCED: Enhanced keyboard navigation setup
function setupEnhancedKeyboardNavigation(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const trapFocus = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
    
    // Enhanced enter key handling
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      if (e.target.type === 'submit' || e.target.id === 'savePerson') {
        // Let the form handle it
        return;
      } else if (e.target.classList.contains('gender-radio-option')) {
        e.preventDefault();
        e.target.click();
      } else {
        e.preventDefault();
        const saveBtn = document.getElementById('savePerson');
        if (saveBtn && validateForm()) {
          saveBtn.click();
        }
      }
    }
  };
  
  modal.addEventListener('keydown', trapFocus);
  
  // Store reference for cleanup
  modal._focusTrap = trapFocus;
}

// ENHANCED: Button loading state management
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
    button.setAttribute('data-original-text', button.textContent);
    button.setAttribute('aria-label', 'Loading...');
  } else {
    button.classList.remove('loading');
    button.disabled = false;
    button.removeAttribute('aria-label');
    const originalText = button.getAttribute('data-original-text');
    if (originalText) {
      button.textContent = originalText;
      button.removeAttribute('data-original-text');
    }
  }
}

function clearButtonLoadingStates() {
  document.querySelectorAll('.loading').forEach(button => {
    setButtonLoading(button, false);
  });
}

// ENHANCED: Ensure proper modal structure
function ensureModalStructure(modal) {
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) return;
  
  // Ensure modal has proper classes
  modal.classList.add('modal-enhanced');
  
  // Ensure form actions are properly structured
  const formActions = modalContent.querySelector('.form-actions');
  if (formActions && !formActions.querySelector('.form-actions-right')) {
    const rightActions = document.createElement('div');
    rightActions.className = 'form-actions-right';
    
    // Move cancel and save buttons to right side
    const cancelBtn = formActions.querySelector('[id*="cancel"]');
    const saveBtn = formActions.querySelector('[id*="save"], [id*="apply"]');
    
    if (cancelBtn) rightActions.appendChild(cancelBtn);
    if (saveBtn) rightActions.appendChild(saveBtn);
    
    formActions.appendChild(rightActions);
  }
}

function setupAvatarUploadHandlers() {
  const fileInput = document.getElementById('personPhotoInput');
  const removeBtn = document.getElementById('personPhotoRemove');
  const zoomSlider = document.getElementById('avatarZoom');
  const resetBtn = document.getElementById('avatarReset');

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const { blob, width, height, mimeType } = await prepareImageUpload(file);
      const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
      if (!repo) throw new Error('Storage unavailable');
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await repo.saveMedia({ id, blob, mimeType, byteLength: blob.size, width, height });
      const photo = { mediaId: id, transform: { ...DEFAULT_TRANSFORM } };
      const mediaIdInput = document.getElementById('personPhotoMediaId');
      const transformInput = document.getElementById('personPhotoTransform');
      if (mediaIdInput) mediaIdInput.value = id;
      if (transformInput) transformInput.value = JSON.stringify(photo.transform);
      await mountAvatarCropperForPerson(photo);
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (shouldWarnAboutStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 })) {
          const { notifications } = await import('../components/notifications.js');
          notifications.warning('Storage almost full', 'Consider exporting your tree.');
        }
      }
    } catch (err) {
      const { notifications } = await import('../components/notifications.js');
      notifications.error('Photo error', err.message);
      fileInput.value = '';
    }
  });

  removeBtn?.addEventListener('click', async () => {
    const mediaIdInput = document.getElementById('personPhotoMediaId');
    const id = mediaIdInput?.value;
    if (id) {
      const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
      await repo?.deleteMedia(id).catch((err) => console.warn('[modal] remove photo failed:', err));
      window.treeCore?.renderer?.clearMediaImage(id);
    }
    if (mediaIdInput) mediaIdInput.value = '';
    const transformInput = document.getElementById('personPhotoTransform');
    if (transformInput) transformInput.value = JSON.stringify(DEFAULT_TRANSFORM);
    if (fileInput) fileInput.value = '';
    await mountAvatarCropperForPerson(null);
  });

  zoomSlider?.addEventListener('input', () => {
    if (cropperHandle) cropperHandle.setZoom(Number(zoomSlider.value));
  });
  resetBtn?.addEventListener('click', () => {
    if (cropperHandle) cropperHandle.reset();
  });
}

// ENHANCED: Initialize modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  devLog('🎨 Enhanced Modal initializing...');
  
  const modal = document.getElementById('personModal');
  const cancelBtn = document.getElementById('cancelModal');
  const saveBtn = document.getElementById('savePerson');
  const deleteBtn = document.getElementById('deletePersonBtn');
  const form = document.getElementById('personForm');
  
  // Force modal to be hidden initially
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    isModalOpen = false;
    devLog('Modal initialized as hidden');
  }
  
  // Enhanced cancel button event listener
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      devLog('Cancel button clicked');
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
    devLog('Cancel button listener attached');
  }

  // Enhanced delete button event listener
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      devLog('Delete button clicked');
      devLog('Current editing ID:', currentEditingId);
      devLog('Modal dataset editing ID:', modal?.dataset.editingId);
      e.preventDefault();
      e.stopPropagation();
      openDeleteConfirmModal();
    });
    devLog('Delete button listener attached');
  }
  
  // Enhanced save button event listener
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      devLog('Save button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Show loading state
      setButtonLoading(saveBtn, true);
      
      // Validate form with enhanced feedback
      if (!validateForm()) {
        setButtonLoading(saveBtn, false);
        return;
      }
      
      devLog('Form validation passed, triggering save');
      
      // Get form data
      const birthVal = birthDateHandle?.getValue?.() || null;
      const deathVal = deathDateHandle?.getValue?.() || null;
      const formData = {
        name: document.getElementById('personName')?.value.trim() || '',
        fatherName: document.getElementById('personFatherName')?.value.trim() || '',
        surname: document.getElementById('personSurname')?.value.trim() || '',
        maidenName: document.getElementById('personMaidenName')?.value.trim() || '',
        gender: getSelectedGender(),
        motherId: document.querySelector('#motherSelect input[type="hidden"]')?.value || '',
        fatherId: document.querySelector('#fatherSelect input[type="hidden"]')?.value || '',
        birth: {
          date: birthVal,
          place: document.getElementById('personBirthPlace')?.value.trim() || '',
          note: document.getElementById('personBirthNote')?.value.trim() || ''
        },
        death: {
          date: deathVal,
          place: document.getElementById('personDeathPlace')?.value.trim() || '',
          note: document.getElementById('personDeathNote')?.value.trim() || ''
        },
        marriages: marriagesListHandle ? marriagesListHandle.getValue() : [],
        notes: document.getElementById('personNotes')?.value.trim() || '',
        editingId: modal.dataset.editingId || null,
        photo: (() => {
          const mediaId = document.getElementById('personPhotoMediaId')?.value || '';
          if (!mediaId) return null;
          let transform = DEFAULT_TRANSFORM;
          try { transform = JSON.parse(document.getElementById('personPhotoTransform')?.value || ''); } catch {}
          return { mediaId, transform };
        })()
      };
      
      devLog('Form data to save:', formData);
      
      // Use global tree core instead of importing
      const treeCore = window.treeCore;
      
      devLog('TreeCore imported, calling handleSavePersonFromModal');
      if (treeCore && typeof treeCore.handleSavePersonFromModal === 'function') {
        treeCore.handleSavePersonFromModal(formData);
      } else {
        devLog('TreeCore not available, dispatching event');
        // Fallback to event dispatch
        const saveEvent = new CustomEvent('savePersonFromModal', {
          detail: formData
        });
        document.dispatchEvent(saveEvent);
      }
      
      // Clear loading state after a delay
      setTimeout(() => {
        setButtonLoading(saveBtn, false);
      }, 500);
      
    });
    devLog('Save button listener attached');
  }
  
  // Enhanced form submit handler (fallback)
  if (form) {
    form.addEventListener('submit', (e) => {
      devLog('Form submitted via form submission');
      e.preventDefault();
      
      // Trigger save button click
      if (saveBtn) {
        saveBtn.click();
      }
    });
  }
  
  // Enhanced close modal when clicking outside of modal content
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        devLog('Clicked outside modal');
        closeModal();
      }
    });
  }
  
  // Prevent modal content clicks from closing modal
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // Enhanced gender radio button listeners
  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  
  // Add click listeners to the entire gender radio option containers
  const genderOptions = document.querySelectorAll('.gender-radio-option');
  genderOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const radio = option.querySelector('input[type="radio"]');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  
  if (maleRadio) {
    maleRadio.addEventListener('change', () => {
      if (maleRadio.checked) {
        devLog('Gender changed to male');
        updateGenderRadioStyles();
        // Clear any validation errors
        const genderGroup = maleRadio.closest('.form-group');
        if (genderGroup) {
          genderGroup.classList.remove('error');
          const errorMsg = genderGroup.querySelector('.error-message');
          if (errorMsg) errorMsg.remove();
        }
      }
    });
  }
  
  if (femaleRadio) {
    femaleRadio.addEventListener('change', () => {
      if (femaleRadio.checked) {
        devLog('Gender changed to female');
        updateGenderRadioStyles();
        // Clear any validation errors
        const genderGroup = femaleRadio.closest('.form-group');
        if (genderGroup) {
          genderGroup.classList.remove('error');
          const errorMsg = genderGroup.querySelector('.error-message');
          if (errorMsg) errorMsg.remove();
        }
      }
    });
  }

  // Setup avatar upload handlers
  setupAvatarUploadHandlers();

  // Setup delete confirmation modal
  setupDeleteConfirmationModal();

  // Add enhanced input event listeners for real-time validation clearing
  setupEnhancedInputValidation();

  devLog('🎨 Enhanced Modal initialization complete');
});

// Enhanced delete confirmation modal setup
function setupDeleteConfirmationModal() {
  devLog('Setting up enhanced delete confirmation modal...');
  
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const cancelDeleteBtn = document.getElementById('cancelDeletePerson');
  const confirmDeleteBtn = document.getElementById('confirmDeletePerson');

  // Enhanced cancel delete
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', (e) => {
      devLog('Cancel delete button clicked');
      e.preventDefault();
      e.stopPropagation();
      closeDeleteConfirmModal();
    });
    devLog('Cancel delete button listener attached');
  }

  // Enhanced confirm delete
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', (e) => {
      devLog('Confirm delete button clicked');
      e.preventDefault();
      e.stopPropagation();
      confirmDeletePerson();
    });
    devLog('Confirm delete button listener attached');
  }

  // Enhanced close delete modal when clicking outside
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', (e) => {
      if (e.target === deleteConfirmModal) {
        devLog('Clicked outside delete confirmation modal');
        closeDeleteConfirmModal();
      }
    });
    devLog('Delete confirmation modal click-outside listener attached');
  }

  // Prevent modal content clicks from closing modal
  const deleteModalContent = deleteConfirmModal?.querySelector('.modal-content');
  if (deleteModalContent) {
    deleteModalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    devLog('Delete modal content click prevention attached');
  }
}

// Enhanced input validation for real-time error clearing
function setupEnhancedInputValidation() {
  const nameInput = document.getElementById('personName');
  
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim()) {
        const formGroup = nameInput.closest('.form-group');
        if (formGroup && formGroup.classList.contains('error')) {
          formGroup.classList.remove('error');
          const errorMsg = formGroup.querySelector('.error-message');
          if (errorMsg) {
            errorMsg.style.animation = 'slideUp 0.2s ease-in forwards';
            setTimeout(() => errorMsg.remove(), 200);
          }
        }
      }
    });
  }
  
  // Add similar listeners for other inputs
  const inputs = ['personFatherName', 'personSurname', 'personMaidenName', 'personDob'];
  inputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('input', () => {
        const formGroup = input.closest('.form-group');
        if (formGroup && formGroup.classList.contains('error')) {
          formGroup.classList.remove('error');
          const errorMsg = formGroup.querySelector('.error-message');
          if (errorMsg) {
            errorMsg.style.animation = 'slideUp 0.2s ease-in forwards';
            setTimeout(() => errorMsg.remove(), 200);
          }
        }
      });
      
      // Enhanced focus and blur effects
      input.addEventListener('focus', () => {
        input.style.transform = 'translateY(-1px)';
        input.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.15)';
      });
      
      input.addEventListener('blur', () => {
        input.style.transform = '';
        input.style.boxShadow = '';
      });
    }
  });
}

// Enhanced keyboard navigation support
document.addEventListener('keydown', (e) => {
  if (!isModalOpen) return;
  
  // Enhanced escape key handling
  if (e.key === 'Escape') {
    // Close any open delete confirmation modal first
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    if (deleteConfirmModal && !deleteConfirmModal.classList.contains('hidden')) {
      closeDeleteConfirmModal();
      return;
    }
    
    closeModal();
    return;
  }
});

// Update modal content when language changes
if (window.i18n) {
  window.i18n.addObserver((event, data) => {
    if (event === 'localeChanged') {
      devLog('Updating modal content for new locale:', data.newLocale);
      
      // Update modal title if modal is open
      if (isModalOpen) {
        const modal = document.getElementById('personModal');
        const titleEl = document.getElementById('modalTitle');
        const editingId = modal?.dataset.editingId || currentEditingId;
        
        if (titleEl && !editingId) {
          // Only update if it's a new person modal (no editing ID) - build safely using DOM API
          titleEl.innerHTML = ''; // Clear existing content

          const iconSpan = document.createElement('span');
          iconSpan.className = 'person-icon';
          iconSpan.textContent = '+';

          const titleText = document.createTextNode(' ' + t('builder.modals.person.add_title', 'Add Person'));

          titleEl.appendChild(iconSpan);
          titleEl.appendChild(titleText);
        }
      }
    }
  });
}

// Add CSS animations for enhanced UX
const enhancedModalCSS = `
@keyframes slideUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

@keyframes modalFadeOut {
  from {
    opacity: 1;
    backdrop-filter: blur(8px);
  }
  to {
    opacity: 0;
    backdrop-filter: blur(0px);
  }
}

.modal-closing .modal-content {
  animation: modalSlideOut 0.3s ease-in forwards;
}

@keyframes modalSlideOut {
  from {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  to {
    transform: translateY(-20px) scale(0.95);
    opacity: 0;
  }
}
`;

// Inject enhanced CSS
const enhancedStyleElement = document.createElement('style');
enhancedStyleElement.textContent = enhancedModalCSS;
document.head.appendChild(enhancedStyleElement);

// Setup X button functionality for all modals
function setupCloseButtons() {
  // Handle all modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const modal = button.closest('.modal, .panel');
      if (modal) {
        if (modal.classList.contains('panel')) {
          // Settings panel
          modal.classList.add('hidden');
          const settingsToggle = document.getElementById('settingsToggle');
          if (settingsToggle) {
            settingsToggle.classList.remove('active');
          }
        } else {
          // Regular modal
          const modalId = modal.id;
          switch (modalId) {
            case 'personModal':
              closeModal();
              break;
            case 'deleteConfirmModal':
              closeDeleteConfirmModal();
              break;
            case 'clearAllConfirmModal':
              closeModal(); // Use the general close function
              break;
            case 'connectionModal':
              closeConnectionModal();
              break;
            case 'styleModal':
              if (window.treeCore && window.treeCore.closeStyleModal) {
                window.treeCore.closeStyleModal();
              }
              break;
            default:
              modal.classList.add('hidden');
          }
        }
      }
    });
  });
}

// Initialize close buttons when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupCloseButtons);
} else {
  setupCloseButtons();
}

// Helper function to close connection modal
function closeConnectionModal() {
  const modal = document.getElementById('connectionModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Export additional utility functions
export { 
  validateForm, 
  clearErrorStates, 
  showValidationErrors, 
  getPersonInitials,
  setButtonLoading,
  updateGenderRadioStyles
};

function devLog(...args) {
  if (window.NODE_ENV !== 'production') {
    console.log(...args);
  }
}
function devWarn(...args) {
  if (window.NODE_ENV !== 'production') {
    console.warn(...args);
  }
}
function devError(...args) {
  if (window.NODE_ENV !== 'production') {
    console.error(...args);
  }
}
