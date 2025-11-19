import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
    IconBold,
    IconItalic,
    IconStrikethrough,
    IconCode,
    IconH1,
    IconH2,
    IconH3,
    IconList,
    IconListNumbers,
    IconQuote,
    IconSeparator,
    IconLink,
    IconPhoto,
} from '@tabler/icons-react';
import MediaPickerModal from '../../../components/shared/media/MediaPickerModal.jsx';

function TiptapEditor({ content, onChange, pageId }) {
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 dark:text-blue-400 underline hover:no-underline',
                },
            }),
            Image.configure({
                // No CSS classes - display images 1:1 without any styling
                HTMLAttributes: {},
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
            },
        },
    });

    // Update editor content when prop changes (for loading existing content)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

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
        // Insert image with data-file-id attribute for usage tracking
        // IMPORTANT: Always use full image URL, never thumbnail
        const fullImageUrl = file.url;

        editor.chain().focus().setImage({
            src: fullImageUrl,
            alt: altText,
            'data-file-id': file.id
        }).run();
        setMediaPickerOpen(false);
    };

    const ToolbarButton = ({ onClick, active, children, title }) => (
        <button
            type="button"
            onClick={onClick}
            className={`
                p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700
                ${active ? 'bg-gray-300 dark:bg-gray-600 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
                transition-colors
            `}
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
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

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    active={editor.isActive('heading', { level: 1 })}
                    title="Nadpis 1"
                >
                    <IconH1 size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    active={editor.isActive('heading', { level: 2 })}
                    title="Nadpis 2"
                >
                    <IconH2 size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    active={editor.isActive('heading', { level: 3 })}
                    title="Nadpis 3"
                >
                    <IconH3 size={18} />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    active={editor.isActive('bulletList')}
                    title="Odrážkový seznam"
                >
                    <IconList size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    active={editor.isActive('orderedList')}
                    title="Číslovaný seznam"
                >
                    <IconListNumbers size={18} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                    title="Citace"
                >
                    <IconQuote size={18} />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

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
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />

            {/* Media Picker Modal */}
            <MediaPickerModal
                isOpen={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelect={handleMediaSelect}
                storagePath={`cms/pages/${pageId || 'new'}`}
                entityType="pages"
                entityId={pageId || 0}
                accept="image/*"
                maxSize={10}
            />
        </div>
    );
}

export default TiptapEditor;
