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

  const spouseSelect = document.createElement('select');
  spouseSelect.className = 'marriage-spouse-select';
  spouseSelect.appendChild(option('', t('builder.form.select_spouse', 'Select Spouse')));
  for (const p of allPersons) {
    if (p.id === currentPersonId) continue;
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id;
    spouseSelect.appendChild(option(p.id, fullName));
  }
  spouseSelect.value = marriage.spouseId || '';
  header.appendChild(spouseSelect);

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

function option(value, text) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}
