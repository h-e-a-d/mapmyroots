// Letter for a keyboard shortcut: the typed Latin letter, or the physical key on non-Latin
// layouts (e.g. Russian, where Cmd+Shift+P reports key "З"). Latin layouts such as AZERTY keep
// e.key, so the shortcut follows the letter printed on the key.
export function shortcutLetter(e) {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  const match = /^Key([A-Z])$/.exec(e.code || '');
  return match ? match[1].toLowerCase() : null;
}
