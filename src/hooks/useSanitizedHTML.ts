import { useMemo } from 'react';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'blockquote', 'pre', 'code',
  'div', 'span', 'hr'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'width', 'height', 'style', 'target', 'rel'
];

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHTML(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Hook that memoizes HTML sanitization
 * @param html - The HTML string to sanitize
 * @returns Memoized sanitized HTML string
 */
export function useSanitizedHTML(html: string | null | undefined): string {
  return useMemo(() => sanitizeHTML(html), [html]);
}
