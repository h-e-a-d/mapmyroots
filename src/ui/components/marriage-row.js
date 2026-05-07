import { createDateInput } from './date-input.js';
import { setupInlineReveal } from './inline-reveal.js';
import { isValidDateValue } from '../../utils/date-value.js';

export function createMarriageRow({ marriage, allPersons, currentPersonId, onSpouseChange, onRemove, t }) {
  const row = document.createElement('div');
  row.className = 'marriage-row';
  row.dataset.marriageId = marriage.id;

  const header = document.createElement('div');
  header.className = 'marriage-row-header';

  const spouseLabel = document.createElement('label');
  spouseLabel.textContent = t('builder.form.spouse', 'Spouse');
  header.appendChild(spouseLabel);

  const spouseWrapper = document.createElement('div');
  spouseWrapper.className = 'searchable-select marriage-spouse-searchable';

  const placeholder = t('builder.form.select_spouse', 'Select Spouse');
  const selectedPerson = marriage.spouseId ? allPersons.find((p) => p.id === marriage.spouseId) : null;
  const initialDisplay = selectedPerson
    ? ([selectedPerson.name, selectedPerson.surname].filter(Boolean).join(' ').trim() || selectedPerson.id)
    : placeholder;

  const inputBox = document.createElement('div');
  inputBox.className = 'select-input';
  inputBox.textContent = initialDisplay;
  inputBox.dataset.selectedId = marriage.spouseId || '';
  spouseWrapper.appendChild(inputBox);

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.value = marriage.spouseId || '';
  spouseWrapper.appendChild(hiddenInput);

  const optionsWrapper = document.createElement('div');
  optionsWrapper.className = 'options hidden';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'select-search';
  searchInput.placeholder = 'Search…';
  searchInput.setAttribute('aria-label', 'Search options');
  optionsWrapper.appendChild(searchInput);

  const optionsList = document.createElement('div');
  optionsList.className = 'select-options-list';
  const noneOpt = document.createElement('div');
  noneOpt.className = 'select-option';
  noneOpt.dataset.id = '';
  noneOpt.textContent = placeholder;
  optionsList.appendChild(noneOpt);
  for (const p of allPersons) {
    if (p.id === currentPersonId) continue;
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id;
    const opt = document.createElement('div');
    opt.className = 'select-option';
    if (p.id === (marriage.spouseId || '')) opt.classList.add('selected');
    opt.dataset.id = p.id;
    opt.textContent = fullName;
    optionsList.appendChild(opt);
  }
  optionsWrapper.appendChild(optionsList);

  const noResults = document.createElement('div');
  noResults.className = 'select-no-results hidden';
  noResults.textContent = 'No results';
  optionsWrapper.appendChild(noResults);

  spouseWrapper.appendChild(optionsWrapper);
  header.appendChild(spouseWrapper);

  function closeSpouseDropdown() {
    searchInput.value = '';
    optionsList.querySelectorAll('.select-option').forEach((o) => (o.style.display = ''));
    noResults.classList.add('hidden');
    optionsWrapper.classList.add('hidden');
    inputBox.classList.remove('open');
    spouseWrapper.closest('.form-group')?.style.removeProperty('z-index');
  }

  inputBox.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.searchable-select .options').forEach((o) => {
      if (o !== optionsWrapper) {
        o.classList.add('hidden');
        o.parentNode.querySelector('.select-input')?.classList.remove('open');
      }
    });
    optionsWrapper.classList.toggle('hidden');
    inputBox.classList.toggle('open');
    const formGroup = spouseWrapper.closest('.form-group');
    if (formGroup) formGroup.style.zIndex = optionsWrapper.classList.contains('hidden') ? '' : '100';
    if (!optionsWrapper.classList.contains('hidden')) searchInput.focus();
  });

  searchInput.addEventListener('click', (e) => e.stopPropagation());
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    let any = false;
    optionsList.querySelectorAll('.select-option').forEach((o) => {
      const matches = !q || o.textContent.trim().toLowerCase().includes(q);
      o.style.display = matches ? '' : 'none';
      if (matches) any = true;
    });
    noResults.classList.toggle('hidden', any);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.marriage-spouse-searchable')) closeSpouseDropdown();
  });

  const spouseSelect = {
    get value() { return hiddenInput.value; },
    set value(v) {
      hiddenInput.value = v;
      inputBox.dataset.selectedId = v;
      const found = v ? allPersons.find((p) => p.id === v) : null;
      inputBox.textContent = found
        ? ([found.name, found.surname].filter(Boolean).join(' ').trim() || found.id)
        : placeholder;
    },
    addEventListener(event, cb) {
      if (event !== 'change') return;
      optionsList.addEventListener('click', (e) => {
        if (!e.target.classList.contains('select-option')) return;
        const prevVal = hiddenInput.value;
        const newVal = e.target.dataset.id;
        hiddenInput.value = newVal;
        inputBox.dataset.selectedId = newVal;
        inputBox.textContent = newVal
          ? (e.target.textContent.trim() || newVal)
          : placeholder;
        optionsList.querySelectorAll('.select-option').forEach((o) => o.classList.remove('selected'));
        e.target.classList.add('selected');
        closeSpouseDropdown();
        if (prevVal !== newVal) cb();
      });
    }
  };

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'marriage-row-remove';
  removeBtn.setAttribute('aria-label', t('builder.form.remove_marriage', 'Remove marriage'));
  removeBtn.textContent = '✕';
  header.appendChild(removeBtn);

  row.appendChild(header);

  const dateLabel = document.createElement('label');
  dateLabel.textContent = t('builder.form.marriage_date', 'Marriage date');
  row.appendChild(dateLabel);
  const dateHandle = createDateInput({ idPrefix: `marr-${marriage.id}`, container: row });
  dateHandle.setValue(isValidDateValue(marriage.date) ? marriage.date : null);

  const placeWrapper = document.createElement('div');
  placeWrapper.className = 'marriage-place-wrapper';
  const placeLabel = document.createElement('label');
  placeLabel.textContent = t('builder.form.marriage_place', 'Marriage place');
  const placeInput = document.createElement('input');
  placeInput.type = 'text';
  placeInput.className = 'marriage-place';
  placeInput.value = marriage.place || '';
  placeWrapper.appendChild(placeLabel);
  placeWrapper.appendChild(placeInput);

  const placeReveal = document.createElement('button');
  placeReveal.type = 'button';
  placeReveal.className = 'reveal-link';
  placeReveal.textContent = `+ ${t('builder.form.add_place', 'add place')}`;
  row.appendChild(placeReveal);
  row.appendChild(placeWrapper);
  setupInlineReveal({ trigger: placeReveal, target: placeWrapper });

  const noteWrapper = document.createElement('div');
  noteWrapper.className = 'marriage-note-wrapper';
  const noteLabel = document.createElement('label');
  noteLabel.textContent = t('builder.form.marriage_note', 'Marriage note');
  const noteTextarea = document.createElement('textarea');
  noteTextarea.className = 'marriage-note';
  noteTextarea.rows = 2;
  noteTextarea.value = marriage.note || '';
  noteWrapper.appendChild(noteLabel);
  noteWrapper.appendChild(noteTextarea);

  const noteReveal = document.createElement('button');
  noteReveal.type = 'button';
  noteReveal.className = 'reveal-link';
  noteReveal.textContent = `+ ${t('builder.form.add_note', 'add note')}`;
  row.appendChild(noteReveal);
  row.appendChild(noteWrapper);
  setupInlineReveal({ trigger: noteReveal, target: noteWrapper });

  const hint = document.createElement('div');
  hint.className = 'marriage-row-hint';
  hint.hidden = true;
  row.appendChild(hint);

  spouseSelect.addEventListener('change', () => {
    if (typeof onSpouseChange === 'function') {
      onSpouseChange({
        marriageId: marriage.id,
        previousSpouseId: marriage.spouseId,
        newSpouseId: spouseSelect.value,
        applyAutofill: (mirror) => applyAutofill(mirror, { dateHandle, placeInput, noteTextarea, placeReveal, placeWrapper, noteReveal, noteWrapper, hint, t }),
        revertSpouseSelection: () => { spouseSelect.value = marriage.spouseId || ''; }
      });
    }
    marriage.spouseId = spouseSelect.value;
  });

  removeBtn.addEventListener('click', () => {
    if (typeof onRemove === 'function') onRemove({ marriageId: marriage.id, spouseId: marriage.spouseId });
  });

  return {
    element: row,
    getValue() {
      return {
        id: marriage.id,
        spouseId: spouseSelect.value || '',
        date: dateHandle.getValue(),
        place: placeInput.value.trim(),
        note: noteTextarea.value.trim()
      };
    },
    isInvalid() {
      return dateHandle.isInvalid();
    },
    setRemovable(removable) {
      removeBtn.hidden = !removable;
    }
  };
}

function applyAutofill(mirror, { dateHandle, placeInput, noteTextarea, placeReveal, placeWrapper, noteReveal, noteWrapper, hint, t }) {
  const userTouched = (dateHandle.getValue() !== null) ||
    (placeInput.value.trim() !== '') ||
    (noteTextarea.value.trim() !== '');

  if (userTouched) {
    hint.hidden = false;
    hint.textContent = t('builder.form.marriage_autofill_offer', 'Use spouse\'s saved values');
    return;
  }

  if (mirror.date) dateHandle.setValue(mirror.date);
  if (mirror.place) {
    placeInput.value = mirror.place;
    placeReveal.hidden = true;
    placeWrapper.hidden = false;
  }
  if (mirror.note) {
    noteTextarea.value = mirror.note;
    noteReveal.hidden = true;
    noteWrapper.hidden = false;
  }
  hint.hidden = false;
  hint.textContent = t('builder.form.marriage_autofilled', 'Filled from spouse\'s record');
}

