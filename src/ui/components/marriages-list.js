import { createMarriageRow } from './marriage-row.js';
import { makeMarriageId } from '../../utils/marriage-sync.js';

export function createMarriagesList({ container, marriages, getAllPersons, currentPersonId, confirmSpouseChange, t }) {
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'marriages-list';
  container.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'reveal-link marriages-add';
  addBtn.textContent = `+ ${t('builder.form.add_marriage', 'add another marriage')}`;
  container.appendChild(addBtn);

  const handles = [];

  function refreshRemovable() {
    handles.forEach((h) => h.setRemovable(handles.length > 1));
  }

  function addRow(marriage, { previouslySaved = true } = {}) {
    const handle = createMarriageRow({
      marriage,
      allPersons: getAllPersons(),
      currentPersonId,
      t,
      onSpouseChange: ({ marriageId, previousSpouseId, newSpouseId, applyAutofill, revertSpouseSelection }) => {
        if (previouslySaved && previousSpouseId && previousSpouseId !== newSpouseId) {
          confirmSpouseChange({
            previousSpouseId,
            newSpouseId,
            confirm: () => {
              if (newSpouseId) tryAutofill(newSpouseId, currentPersonId, marriageId, applyAutofill);
            },
            cancel: () => revertSpouseSelection()
          });
          return;
        }
        if (newSpouseId) tryAutofill(newSpouseId, currentPersonId, marriageId, applyAutofill);
      },
      onRemove: ({ marriageId }) => {
        const idx = handles.findIndex((h) => h.element.dataset.marriageId === marriageId);
        if (idx >= 0) {
          handles[idx].element.remove();
          handles.splice(idx, 1);
          refreshRemovable();
        }
      }
    });
    list.appendChild(handle.element);
    handles.push(handle);
    refreshRemovable();
  }

  function tryAutofill(newSpouseId, currentId, marriageId, applyAutofill) {
    const spouse = getAllPersons().find((p) => p.id === newSpouseId);
    if (!spouse || !Array.isArray(spouse.marriages)) return;
    const mirror = spouse.marriages.find((m) => m.id === marriageId || m.spouseId === currentId);
    if (mirror) applyAutofill(mirror);
  }

  if (Array.isArray(marriages) && marriages.length > 0) {
    marriages.forEach((m) => addRow(m, { previouslySaved: true }));
  } else {
    addRow({ id: makeMarriageId(), spouseId: '', date: null, place: '', note: '' }, { previouslySaved: false });
  }

  addBtn.addEventListener('click', () => {
    addRow({ id: makeMarriageId(), spouseId: '', date: null, place: '', note: '' }, { previouslySaved: false });
  });

  return {
    getValue() {
      return handles.map((h) => h.getValue());
    },
    hasInvalidDate() {
      return handles.some((h) => h.isInvalid());
    }
  };
}
