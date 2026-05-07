export function setupInlineReveal({ trigger, target, focusOnReveal = true }) {
  if (!trigger || !target) return;

  const reveal = () => {
    target.hidden = false;
    target.removeAttribute('aria-hidden');
    trigger.hidden = true;
    if (focusOnReveal) {
      const focusTarget = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button');
      focusTarget?.focus();
    }
  };

  if (hasValue(target)) {
    reveal();
  } else {
    target.hidden = true;
    target.setAttribute('aria-hidden', 'true');
    trigger.hidden = false;
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    reveal();
  });
}

function hasValue(target) {
  const inputs = target.matches('input, textarea')
    ? [target]
    : target.querySelectorAll('input, textarea');
  for (const el of inputs) {
    if (el.value && el.value.trim() !== '') return true;
    if (el.type === 'checkbox' && el.checked) return true;
  }
  return false;
}
