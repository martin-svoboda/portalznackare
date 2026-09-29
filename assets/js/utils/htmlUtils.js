/**
 * Shared HTML utilities for React applications
 * Handles server-processed HTML content and icon replacements
 */
import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Odstraní z HTML vše spustitelné (skripty, on* atributy, javascript: URL).
 * Server texty z INSYZ escapuje sám; tohle je druhá pojistka pro vše,
 * co se vkládá jako HTML (ikony, značky, náhledy TIMů, validační hlášky).
 * @param {string} html
 * @returns {string}
 */
export const sanitizeHtml = (html) => DOMPurify.sanitize(String(html));

/**
 * Safely renders HTML content from server data (always sanitized)
 * @param {string} htmlString - HTML string to render
 * @returns {JSX.Element|null} React element or null
 */
export const renderHtmlContent = (htmlString) => {
    if (!htmlString) return null;
    return <span dangerouslySetInnerHTML={{__html: sanitizeHtml(htmlString)}}/>;
};

/**
 * Replaces text with icons - handles server-side processed HTML
 * @param {string} text - Text content (may contain HTML from server)
 * @param {number} size - Icon size (optional, default 14)
 * @returns {JSX.Element|string} Processed content
 */
export const replaceTextWithIcons = (text, size = 14) => {
    if (!text) return '';
    
    // HTML ze serveru (ikony) nebo escapované entity (&amp;, &lt;) → vykreslit jako HTML
    if (containsHtml(text)) {
        return renderHtmlContent(text);
    }
    
    // Otherwise return as plain text
    return text;
};

/**
 * Checks if content contains HTML tags or HTML entities
 * (server escapuje texty z INSYZ, např. "Hrad &amp; zámek")
 * @param {string} content - Content to check
 * @returns {boolean} True if content contains HTML
 */
export const containsHtml = (content) => {
    return !!content && typeof content === 'string' && /[<&]/.test(content);
};

/**
 * Safely renders any content - HTML or plain text
 * @param {string} content - Content to render
 * @returns {JSX.Element|string} Processed content
 */
export const renderContent = (content) => {
    if (!content) return '';
    
    if (containsHtml(content)) {
        return renderHtmlContent(content);
    }
    
    return content;
};

// Badge utility functions removed - use BEM classes directly:
// Example: <span className={`badge badge--kct-${code.toLowerCase()}`}>