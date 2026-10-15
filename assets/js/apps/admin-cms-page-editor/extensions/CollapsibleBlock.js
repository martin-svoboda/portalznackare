import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Sbalitelný blok textu do CMS (INSYZ-366).
 *
 * Ukládá se jako nativní `<details class="collapsible">`, takže na webu se rozbaluje bez
 * JavaScriptu. V editoru se vykresluje jako `<div>` (node view) – zavřený `<details>` by
 * v contenteditable skryl obsah a nešel by upravovat.
 *
 * Struktura: collapsible > collapsibleSummary (nadpis, inline) + collapsibleContent (bloky)
 */

const VYCHOZI_NADPIS = 'Zobrazit více';

// V editoru místo <details>/<summary> obyčejný div, ať je obsah vždy vidět
const divNodeView = (className) => () => () => {
    const dom = document.createElement('div');
    dom.className = className;
    return { dom, contentDOM: dom };
};

export const CollapsibleSummary = Node.create({
    name: 'collapsibleSummary',
    content: 'inline*',
    defining: true,
    selectable: false,

    parseHTML() {
        return [{ tag: 'details.collapsible > summary' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['summary', mergeAttributes(HTMLAttributes, { class: 'collapsible__summary' }), 0];
    },

    addNodeView: divNodeView('collapsible__summary'),

    addKeyboardShortcuts() {
        return {
            // Enter v nadpisu přeskočí do obsahu bloku (nadpis se rozdělit nedá)
            Enter: ({ editor }) => {
                const { $from } = editor.state.selection;
                if ($from.parent.type.name !== this.name) {
                    return false;
                }
                // za nadpisem → dovnitř obsahu → dovnitř prvního bloku
                return editor.commands.setTextSelection($from.after() + 2);
            },
        };
    },
});

export const CollapsibleContent = Node.create({
    name: 'collapsibleContent',
    content: 'block+',
    defining: true,
    selectable: false,

    parseHTML() {
        return [{ tag: 'details.collapsible > div.collapsible__content' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'collapsible__content' }), 0];
    },
});

export const CollapsibleBlock = Node.create({
    name: 'collapsible',
    group: 'block',
    content: 'collapsibleSummary collapsibleContent',
    defining: true,
    draggable: true,

    addExtensions() {
        return [CollapsibleSummary, CollapsibleContent];
    },

    parseHTML() {
        return [{ tag: 'details.collapsible' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['details', mergeAttributes(HTMLAttributes, { class: 'collapsible' }), 0];
    },

    addNodeView: divNodeView('collapsible collapsible--editor'),

    addCommands() {
        return {
            // Zabalí bloky v označení (nebo blok s kurzorem) do sbalitelného bloku
            setCollapsible: () => ({ state, chain }) => {
                const { $from, $to } = state.selection;
                // Jen celé bloky nejvyšší úrovně – položka seznamu sama o sobě není platný obsah
                const range = $from.blockRange($to, node => node.type.name === 'doc');
                if (!range) {
                    return false;
                }

                const bloky = state.doc.slice(range.start, range.end).content.toJSON();

                return chain()
                    .insertContentAt({ from: range.start, to: range.end }, {
                        type: this.name,
                        content: [
                            { type: 'collapsibleSummary', content: [{ type: 'text', text: VYCHOZI_NADPIS }] },
                            { type: 'collapsibleContent', content: bloky },
                        ],
                    })
                    .run();
            },

            // Zruší sbalitelný blok – obsah zůstane, nadpis zmizí
            unsetCollapsible: () => ({ state, tr, dispatch }) => {
                const { $from } = state.selection;
                for (let depth = $from.depth; depth > 0; depth--) {
                    const node = $from.node(depth);
                    if (node.type.name !== this.name) {
                        continue;
                    }
                    if (dispatch) {
                        const pos = $from.before(depth);
                        tr.replaceWith(pos, pos + node.nodeSize, node.lastChild.content);
                    }
                    return true;
                }
                return false;
            },

            toggleCollapsible: () => ({ editor, commands }) => (
                editor.isActive(this.name) ? commands.unsetCollapsible() : commands.setCollapsible()
            ),
        };
    },
});

export default CollapsibleBlock;
