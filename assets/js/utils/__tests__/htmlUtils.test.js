import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanitizeHtml, renderHtmlContent, replaceTextWithIcons, containsHtml } from '../htmlUtils';

const markup = (node) => (typeof node === 'string' ? node : renderToStaticMarkup(node));

describe('sanitizeHtml – odstraní spustitelný obsah', () => {
    it.each([
        ['<img src=x onerror="alert(1)">', '<img src="x">'],
        ['A<script>alert(1)</script>B', 'AB'],
        ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
        ['<svg><script>alert(1)</script></svg>', '<svg></svg>'],
        ['<div onclick="alert(1)">x</div>', '<div>x</div>'],
    ])('%s', (vstup, vystup) => {
        expect(sanitizeHtml(vstup)).toBe(vystup);
    });
});

describe('sanitizeHtml – zachová HTML ze serveru', () => {
    it('ikonu dopravy (span se stylem + inline SVG)', () => {
        const ikona = '<span style="display: inline-flex; margin: 0 2px;"><svg viewBox="0 0 24 24" width="10" height="10"><path d="M1 1h2" fill="#000"></path></svg></span>';
        expect(sanitizeHtml(ikona)).toBe(ikona);
    });

    it('šipku TIMu jako <img> s data URI', () => {
        const img = '<img src="data:image/svg+xml;base64,PHN2Zy8+" width="40" height="25">';
        expect(sanitizeHtml(img)).toBe(img);
    });

    it('<small> kolem závorek a background-image ve stylu', () => {
        const html = '<div style="background-image: url(data:image/svg+xml;base64,PHN2Zy8+);">Chata <small>(2 km)</small></div>';
        expect(sanitizeHtml(html)).toBe(html);
    });
});

describe('renderHtmlContent / replaceTextWithIcons', () => {
    it('renderHtmlContent sanitizuje', () => {
        expect(markup(renderHtmlContent('Hrad <img src=x onerror=alert(1)>'))).not.toContain('onerror');
    });

    it('escapovaný text ze serveru se zobrazí dekódovaný, ne jako entita', () => {
        // server: "Hrad & zámek" → "Hrad &amp; zámek"
        expect(markup(replaceTextWithIcons('Hrad &amp; zámek'))).toBe('<span>Hrad &amp; zámek</span>');
        // server: "<b>" v textu → "&lt;b&gt;" – zůstane textem, nestane se tagem
        expect(markup(replaceTextWithIcons('A &lt;b&gt; B'))).toBe('<span>A &lt;b&gt; B</span>');
    });

    it('prostý text vrací beze změny', () => {
        expect(replaceTextWithIcons('SEDLEC (nám.) - JEŽOVKA')).toBe('SEDLEC (nám.) - JEŽOVKA');
    });

    it('containsHtml pozná tagy i entity', () => {
        expect(containsHtml('a <span>')).toBe(true);
        expect(containsHtml('a &amp; b')).toBe(true);
        expect(containsHtml('a b')).toBe(false);
        expect(containsHtml(null)).toBe(false);
    });
});
