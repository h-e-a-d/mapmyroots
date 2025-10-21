/**
 * DOM Sanitizer Wrapper - Provides XSS protection for all HTML content
 * Uses DOMPurify for comprehensive sanitization
 *
 * DOMPurify is loaded globally via CDN in the HTML file
 */

// Get DOMPurify from global scope (loaded via CDN)
const DOMPurify = window.DOMPurify;

/**
 * Configuration for DOMPurify
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'button', 'input', 'label',
    'select', 'option', 'textarea', 'table', 'tr', 'td', 'th',
    'svg', 'path', 'circle', 'rect', 'line', 'polyline'
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'style', 'href', 'src', 'alt', 'title',
    'data-*', 'aria-*', 'role', 'type', 'name', 'value',
    'placeholder', 'disabled', 'readonly', 'checked',
    'd', 'viewBox', 'fill', 'stroke', 'stroke-width', 'width', 'height',
    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r'
  ],
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false
};

/**
 * Sanitize HTML string to prevent XSS attacks
 * @param {string} dirty - Unsafe HTML string
 * @param {object} config - Optional custom configuration
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHTML(dirty, config = {}) {
  if (typeof dirty !== 'string') {
    console.warn('sanitizeHTML: Expected string, got', typeof dirty);
    return '';
  }

  const mergedConfig = { ...SANITIZE_CONFIG, ...config };
  return DOMPurify.sanitize(dirty, mergedConfig);
}

/**
 * Safely set innerHTML with automatic sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content to set
 * @param {object} config - Optional custom configuration
 */
export function safeSetInnerHTML(element, html, config = {}) {
  if (!(element instanceof HTMLElement)) {
    console.error('safeSetInnerHTML: First argument must be an HTMLElement');
    return;
  }

  element.innerHTML = sanitizeHTML(html, config);
}

/**
 * Create a sanitized DOM element from HTML string
 * @param {string} html - HTML string
 * @param {object} config - Optional custom configuration
 * @returns {DocumentFragment} - Sanitized DOM fragment
 */
export function createSanitizedElement(html, config = {}) {
  const mergedConfig = {
    ...SANITIZE_CONFIG,
    ...config,
    RETURN_DOM_FRAGMENT: true
  };

  return DOMPurify.sanitize(html, mergedConfig);
}

/**
 * Sanitize URL to prevent javascript: and data: URL attacks
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL or empty string if dangerous
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:')) {
    console.warn('Blocked dangerous URL protocol:', url);
    return '';
  }

  return DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

/**
 * Sanitize CSS to prevent CSS injection attacks
 * @param {string} css - CSS string
 * @returns {string} - Sanitized CSS
 */
export function sanitizeCSS(css) {
  if (typeof css !== 'string') return '';

  // Remove dangerous CSS properties
  const dangerous = [
    'expression', 'behavior', 'binding', 'import',
    'javascript:', 'vbscript:', 'data:'
  ];

  let safe = css;
  dangerous.forEach(pattern => {
    const regex = new RegExp(pattern, 'gi');
    safe = safe.replace(regex, '');
  });

  return safe;
}

/**
 * Escape HTML entities for safe text node insertion
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHTML(text) {
  if (typeof text !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Safely append text content (alternative to innerHTML)
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text content
 */
export function safeSetTextContent(element, text) {
  if (!(element instanceof HTMLElement)) {
    console.error('safeSetTextContent: First argument must be an HTMLElement');
    return;
  }

  element.textContent = text;
}

/**
 * Create a safe element with attributes
 * @param {string} tagName - Element tag name
 * @param {object} attributes - Attributes to set
 * @param {string} content - Text content (will be escaped)
 * @returns {HTMLElement} - Created element
 */
export function createSafeElement(tagName, attributes = {}, content = '') {
  const element = document.createElement(tagName);

  // Set attributes safely
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'href' || key === 'src') {
      element.setAttribute(key, sanitizeURL(value));
    } else if (key === 'style') {
      element.setAttribute(key, sanitizeCSS(value));
    } else {
      element.setAttribute(key, String(value));
    }
  });

  // Set text content safely
  if (content) {
    element.textContent = content;
  }

  return element;
}

/**
 * Configure DOMPurify hooks for additional security
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Remove any remaining event handlers
  if (node.hasAttribute) {
    Array.from(node.attributes || []).forEach(attr => {
      if (attr.name.startsWith('on')) {
        node.removeAttribute(attr.name);
      }
    });
  }

  // Ensure external links open in new tab securely
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    const href = node.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export default {
  sanitizeHTML,
  safeSetInnerHTML,
  createSanitizedElement,
  sanitizeURL,
  sanitizeCSS,
  escapeHTML,
  safeSetTextContent,
  createSafeElement
};
