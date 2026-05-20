import { appContext, EVENTS } from '../../utils/event-bus.js';

export function setupInlineReveal({ trigger, target, focusOnReveal = true, name }) {
  if (!trigger || !target) return;

  const reveal = ({ userInitiated } = { userInitiated: false }) => {
    target.hidden = false;
    target.removeAttribute('aria-hidden');
    trigger.hidden = true;
    if (focusOnReveal) {
      const focusTarget = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button');
      focusTarget?.focus();
    }
    if (userInitiated && name) {
      try {
        appContext.getEventBus().emit(EVENTS.UI_DISCLOSURE_TOGGLED, { name, expanded: true });
      } catch {
        // EventBus may not be ready during early-load tests; safe to swallow.
      }
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
    reveal({ userInitiated: true });
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
