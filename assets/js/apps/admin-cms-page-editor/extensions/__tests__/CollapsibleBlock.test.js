import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CollapsibleBlock from '../CollapsibleBlock.js';

const ULOZENY_BLOK =
    '<details class="collapsible"><summary class="collapsible__summary">Návod krok za krokem</summary>'
    + '<div class="collapsible__content"><p>Skrytý text</p></div></details>';

let editor;

const vytvorEditor = (content) => {
    editor = new Editor({ extensions: [StarterKit, CollapsibleBlock], content });
    return editor;
};

afterEach(() => editor?.destroy());

describe('CollapsibleBlock (INSYZ-366)', () => {
    it('uložený blok projde editorem beze změny', () => {
        expect(vytvorEditor(ULOZENY_BLOK).getHTML()).toBe(ULOZENY_BLOK);
    });

    it('zabalí odstavec s kurzorem a doplní výchozí nadpis', () => {
        // Blok záměrně není poslední – za koncový blok doplní StarterKit (TrailingNode) prázdný odstavec
        vytvorEditor('<p>Úvod</p><p>Dlouhý návod</p><p>Konec</p>');
        editor.commands.setTextSelection(10);
        editor.commands.setCollapsible();

        expect(editor.getHTML()).toBe(
            '<p>Úvod</p><details class="collapsible"><summary class="collapsible__summary">Zobrazit více</summary>'
            + '<div class="collapsible__content"><p>Dlouhý návod</p></div></details><p>Konec</p>'
        );
    });

    it('zabalí všechny označené bloky včetně celého seznamu', () => {
        vytvorEditor('<p>A</p><ul><li><p>B</p></li></ul><p>C</p>');
        editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 1 });
        editor.commands.setCollapsible();

        expect(editor.getHTML()).toContain(
            '<div class="collapsible__content"><p>A</p><ul><li><p>B</p></li></ul><p>C</p></div>'
        );
    });

    it('zrušení bloku ponechá obsah a odstraní nadpis', () => {
        vytvorEditor(ULOZENY_BLOK + '<p>Konec</p>');
        editor.commands.setTextSelection(30); // uvnitř „Skrytý text"
        editor.commands.toggleCollapsible();

        expect(editor.getHTML()).toBe('<p>Skrytý text</p><p>Konec</p>');
    });

    it('cizí <details> bez třídy collapsible se blokem nestane', () => {
        vytvorEditor('<details><summary>cizí</summary><p>x</p></details><p>y</p>');

        expect(editor.getHTML()).not.toContain('collapsible');
    });

    it('Enter v nadpisu přesune kurzor do obsahu', () => {
        vytvorEditor(ULOZENY_BLOK + '<p>Konec</p>');
        editor.commands.setTextSelection(4);
        // Skutečný keydown – commands.keyboardShortcut přenáší jen kroky dokumentu, ne výběr
        const enter = new KeyboardEvent('keydown', { key: 'Enter' });
        editor.view.someProp('handleKeyDown', f => f(editor.view, enter));

        expect(editor.state.selection.$from.parent.textContent).toBe('Skrytý text');
        expect(editor.getHTML()).toBe(ULOZENY_BLOK + '<p>Konec</p>');
    });
});
