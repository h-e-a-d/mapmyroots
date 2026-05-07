import { parseDateValue, isValidDateValue } from '../../utils/date-value.js';

export function createDateInput({ idPrefix, container, placeholder = 'dd.mm.yyyy or yyyy', estLabel = 'est.' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'date-input';

  const text = document.createElement('input');
  text.type = 'text';
  text.id = `${idPrefix}Date`;
  text.className = 'date-input-text';
  text.placeholder = placeholder;
  text.autocomplete = 'off';
  wrapper.appendChild(text);

  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'date-input-est';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `${idPrefix}Estimated`;
  const estText = document.createTextNode(` ${estLabel}`);
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(estText);
  wrapper.appendChild(checkboxLabel);

  const hint = document.createElement('div');
  hint.className = 'date-input-hint';
  hint.hidden = true;
  wrapper.appendChild(hint);

  if (container) container.appendChild(wrapper);

  let lastValue = null;
  let invalid = false;

  function recompute() {
    const raw = text.value.trim();
    if (raw === '') {
      lastValue = null;
      invalid = false;
      text.removeAttribute('aria-invalid');
      hint.hidden = true;
      return;
    }
    const parsed = parseDateValue(raw, { estimated: checkbox.checked });
    if (parsed && parsed.error) {
      invalid = true;
      lastValue = null;
      text.setAttribute('aria-invalid', 'true');
      hint.hidden = false;
      hint.textContent = 'Use dd.mm.yyyy or yyyy';
    } else {
      invalid = false;
      lastValue = parsed;
      text.removeAttribute('aria-invalid');
      hint.hidden = true;
    }
  }

  text.addEventListener('blur', () => {
    recompute();
    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: { value: lastValue, invalid } }));
  });
  checkbox.addEventListener('change', () => {
    recompute();
    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: { value: lastValue, invalid } }));
  });

  return {
    wrapper,
    text,
    checkbox,
    getValue() {
      recompute();
      return lastValue;
    },
    isInvalid() {
      return invalid;
    },
    setValue(dv) {
      if (!isValidDateValue(dv)) {
        text.value = '';
        checkbox.checked = false;
        recompute();
        return;
      }
      if (dv === null) {
        text.value = '';
        checkbox.checked = false;
      } else if (typeof dv.month === 'number') {
        text.value = `${pad2(dv.day)}.${pad2(dv.month)}.${dv.year}`;
        checkbox.checked = !!dv.estimated;
      } else {
        text.value = String(dv.year);
        checkbox.checked = !!dv.estimated;
      }
      recompute();
    }
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
