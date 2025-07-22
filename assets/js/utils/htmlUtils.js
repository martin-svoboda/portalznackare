/**
 * Shared HTML utilities for React applications
 * Handles server-processed HTML content and icon replacements
 */
import React from 'react';

/**
 * Safely renders HTML content from server data
 * @param {string} htmlString - HTML string to render
 * @returns {JSX.Element|null} React element or null
 */
export const renderHtmlContent = (htmlString) => {
    if (!htmlString) return null;
    return <span dangerouslySetInnerHTML={{__html: htmlString}}/>;
};

/**
 * Replaces text with icons - handles server-side processed HTML
 * @param {string} text - Text content (may contain HTML from server)
 * @param {number} size - Icon size (optional, default 14)
 * @returns {JSX.Element|string} Processed content
 */
export const replaceTextWithIcons = (text, size = 14) => {
    if (!text) return '';
    
    // If text contains HTML tags (from server processing), render as HTML
    if (text.includes('<')) {
        return renderHtmlContent(text);
    }
    
    // Otherwise return as plain text
    return text;
};

/**
 * Checks if content contains HTML tags
 * @param {string} content - Content to check
 * @returns {boolean} True if content contains HTML
 */
export const containsHtml = (content) => {
    return content && typeof content === 'string' && content.includes('<');
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