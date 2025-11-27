import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Dropcursor } from '@tiptap/extensions'
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';

// Custom extensions
import DownloadBlock from '../extensions/DownloadBlock.js';
import ImageExtended from '../extensions/ImageExtended.js';


// Icons
import {
    IconBold,
    IconItalic,
    IconStrikethrough,
    IconCode,
    IconCodeDots,
    IconQuote,
    IconSeparator,
    IconLink,
    IconPhoto,
    IconDownload,
    IconTable,
    IconRowInsertTop,
    IconRowInsertBottom,
    IconColumnInsertLeft,
    IconColumnInsertRight,
    IconRowRemove,
    IconColumnRemove,
    IconTableOff,
    IconBorderAll,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconFloatLeft,
    IconFloatRight,
    IconFloatNone,
    IconLayoutAlignLeft,
    IconLayoutAlignCenter,
    IconLayoutAlignRight, IconTableColumn, IconTableRow, IconBorderNone,
} from '@tabler/icons-react';

// Shared components
import MediaPickerModal from '../../../components/shared/media/MediaPickerModal.jsx';

// UI components
import HeadingDropdownMenu from './ui/HeadingDropdownMenu.jsx';
import ListDropdownMenu from './ui/ListDropdownMenu.jsx';
import TextAlignDropdown from './ui/TextAlignDropdown.jsx';
import ColorTextDropdown from './ui/ColorTextDropdown.jsx';
import ColorHighlightDropdown from './ui/ColorHighlightDropdown.jsx';

function TiptapEditor({ content, onChange, pageId }) {
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [filePickerOpen, setFilePickerOpen] = useState(false);
    const [isInTable, setIsInTable] = useState(false);
    const [isImageSelected, setIsImageSelected] = useState(false);

    const editor = useEditor({
        extensions: [
            Document,
            Paragraph,
            Text,
            StarterKit.configure({
                // Disable default image extension from StarterKit since we use ImageExtended
                // image: false,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 dark:text-blue-400 underline hover:no-underline',
                },
            }),
            ImageExtended,
            DownloadBlock,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            Dropcursor,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: ({ editor }) => {
            // Update table state only when it changes
            const inTable = editor.isActive('table');
            if (inTable !== isInTable) {
                setIsInTable(inTable);
            }

            // Update image state only when it changes
            const imageSelected = editor.isActive('image');
            if (imageSelected !== isImageSelected) {
                setIsImageSelected(imageSelected);
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
            },
        },
    });

    // Update editor content when prop changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    // Toolbar actions
    const addLink = () => {
        const url = window.prompt('URL odkazu:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    const addImage = () => {
        setMediaPickerOpen(true);
    };

    const handleMediaSelect = (file, altText) => {
        const fullImageUrl = file.url;
        editor.chain().focus().setImage({
            src: fullImageUrl,
            alt: altText,
            'data-file-id': file.id
        }).run();
        setMediaPickerOpen(false);
    };

    const addDownloadFile = () => {
        setFilePickerOpen(true);
    };

    const handleFileSelect = (file) => {
        editor.chain().focus().setDownloadBlock({
            fileId: file.id,
            fileName: file.fileName,
            fileUrl: file.url,
            fileSize: file.fileSize,
            fileType: file.fileType
        }).run();
        setFilePickerOpen(false);
    };

    const ToolbarButton = ({ onClick, active, children, title, disabled }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
                p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700
                ${active ? 'bg-gray-300 dark:bg-gray-600 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent' : ''}
                transition-colors
            `}
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-visible bg-white dark:bg-gray-800">
            {/* Sticky Toolbar */}
            <div className="sticky top-[64px] z-50 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 shadow-md rounded-t-lg">
                <div className="flex flex-wrap gap-1 px-2">
                {/* Undo/Redo */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Zpět (Ctrl+Z)"
                >
                    <IconArrowBackUp size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Znovu (Ctrl+Shift+Z)"
                >
                    <IconArrowForwardUp size={18} />
                </ToolbarButton>

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Text formatting */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive('bold')}
                    title="Tučně (Ctrl+B)"
                >
                    <IconBold size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive('italic')}
                    title="Kurzíva (Ctrl+I)"
                >
                    <IconItalic size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    active={editor.isActive('strike')}
                    title="Přeškrtnuté"
                >
                    <IconStrikethrough size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    active={editor.isActive('code')}
                    title="Kód (inline)"
                >
                    <IconCode size={18} />
                </ToolbarButton>

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Heading Dropdown */}
                <HeadingDropdownMenu editor={editor} />

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* List Dropdown */}
                <ListDropdownMenu editor={editor} />

                {/* Text Align Dropdown */}
                <TextAlignDropdown editor={editor} />

                {/* Color Text Dropdown */}
                <ColorTextDropdown editor={editor} />

                {/* Color Highlight Dropdown */}
                <ColorHighlightDropdown editor={editor} />

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                    title="Citace"
                >
                    <IconQuote size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    active={editor.isActive('codeBlock')}
                    title="Blok kódu"
                >
                    <IconCodeDots size={18} />
                </ToolbarButton>

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    title="Vložit tabulku"
                >
                    <IconTable size={18} />
                </ToolbarButton>

                <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    title="Horizontální čára"
                >
                    <IconSeparator size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={addLink}
                    active={editor.isActive('link')}
                    title="Odkaz"
                >
                    <IconLink size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={addImage}
                    title="Obrázek"
                >
                    <IconPhoto size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={addDownloadFile}
                    title="Soubor ke stažení"
                >
                    <IconDownload size={18} />
                </ToolbarButton>
                </div>

                {/* Image operations submenu - show only when image is selected */}
                {isImageSelected && (
                    <div className="flex flex-wrap gap-1 px-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-600 dark:text-gray-400 self-center mr-2">Zarovnání:</span>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageAlign('left').run()}
                            active={editor.getAttributes('image')['data-align'] === 'left'}
                            title="Zarovnat vlevo"
                        >
                            <IconLayoutAlignLeft size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageAlign('center').run()}
                            active={editor.getAttributes('image')['data-align'] === 'center'}
                            title="Zarovnat na střed"
                        >
                            <IconLayoutAlignCenter size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageAlign('right').run()}
                            active={editor.getAttributes('image')['data-align'] === 'right'}
                            title="Zarovnat vpravo"
                        >
                            <IconLayoutAlignRight size={16} />
                        </ToolbarButton>

                        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <span className="text-xs text-gray-600 dark:text-gray-400 self-center mr-2">Obtékání:</span>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageFloat('left').run()}
                            active={editor.getAttributes('image')['data-float'] === 'left'}
                            title="Obtékat zleva (obrázek vlevo, text vpravo)"
                        >
                            <IconFloatLeft size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageFloat('right').run()}
                            active={editor.getAttributes('image')['data-float'] === 'right'}
                            title="Obtékat zprava (text vlevo, obrázek vpravo)"
                        >
                            <IconFloatRight size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().setImageFloat('none').run()}
                            active={editor.getAttributes('image')['data-float'] === 'none'}
                            title="Bez obtékání (obrázek blokový)"
                        >
                            <IconFloatNone size={16} />
                        </ToolbarButton>
                    </div>
                )}

                {/* Table operations submenu - show only when cursor is in table */}
                {isInTable && (
                    <div className="flex flex-wrap gap-1 px-2 border-t border-gray-200 dark:border-gray-700">
                        <ToolbarButton
                            onClick={() => editor.chain().focus().addRowBefore().run()}
                            title="Přidat řádek nad"
                        >
                            <IconRowInsertTop size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().addRowAfter().run()}
                            title="Přidat řádek pod"
                        >
                            <IconRowInsertBottom size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().addColumnBefore().run()}
                            title="Přidat sloupec vlevo"
                        >
                            <IconColumnInsertLeft size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().addColumnAfter().run()}
                            title="Přidat sloupec vpravo"
                        >
                            <IconColumnInsertRight size={16} />
                        </ToolbarButton>

                        <div className="w-px h-7 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <ToolbarButton
                            onClick={() => editor.chain().focus().deleteRow().run()}
                            title="Smazat řádek"
                        >
                            <IconRowRemove size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().deleteColumn().run()}
                            title="Smazat sloupec"
                        >
                            <IconColumnRemove size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().deleteTable().run()}
                            title="Smazat tabulku"
                        >
                            <IconTableOff size={16} />
                        </ToolbarButton>

                        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <ToolbarButton
                            onClick={() => editor.chain().focus().mergeCells().run()}
                            title="Sloučit buňky (vyber více buněk)"
                        >
                            <IconBorderNone size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().splitCell().run()}
                            title="Rozdělit buňku"
                        >
                            <IconBorderAll size={16} />
                        </ToolbarButton>

                        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                            title="Přepnout řádek záhlaví"
                        >
                            <IconTableRow size={16} />
                        </ToolbarButton>

                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                            title="Přepnout sloupec záhlaví"
                        >
                            <IconTableColumn size={16} />
                        </ToolbarButton>
                    </div>
                )}
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />

            {/* Media Picker Modal - Images */}
            <MediaPickerModal
                isOpen={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelect={handleMediaSelect}
                storagePath={`cms/pages/${pageId || 'new'}`}
                entityType="pages"
                entityId={pageId || 0}
                accept="image/*"
                maxSize={10}
                mode="image"
            />

            {/* File Picker Modal - Download Files */}
            <MediaPickerModal
                isOpen={filePickerOpen}
                onClose={() => setFilePickerOpen(false)}
                onSelect={handleFileSelect}
                storagePath={`cms/pages/${pageId || 'new'}`}
                entityType="pages"
                entityId={pageId || 0}
                accept="*"
                maxSize={50}
                mode="file"
            />
        </div>
    );
}

export default TiptapEditor;
