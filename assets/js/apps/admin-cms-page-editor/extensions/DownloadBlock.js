import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Tiptap extension for downloadable file blocks
 * Renders as a styled download-item component in the editor
 */
export const DownloadBlock = Node.create({
    name: 'downloadBlock',

    group: 'block',

    atom: true, // Cannot be split or have cursor inside

    draggable: true,

    addAttributes() {
        return {
            fileId: {
                default: null,
                parseHTML: element => element.getAttribute('data-file-id'),
                renderHTML: attributes => {
                    if (!attributes.fileId) {
                        return {};
                    }
                    return {
                        'data-file-id': attributes.fileId,
                    };
                },
            },
            fileName: {
                default: '',
                parseHTML: element => {
                    const title = element.querySelector('.download-item__title');
                    return title ? title.textContent : '';
                },
            },
            fileUrl: {
                default: '',
                parseHTML: element => {
                    const link = element.querySelector('a.btn');
                    return link ? link.getAttribute('href') : '';
                },
            },
            fileSize: {
                default: 0,
                parseHTML: element => {
                    const desc = element.querySelector('.download-item__desc');
                    if (desc) {
                        // Try to extract size from description (e.g., "PDF dokument, 1.2 MB")
                        const match = desc.textContent.match(/(\d+\.?\d*)\s*(KB|MB|GB)/i);
                        if (match) {
                            const size = parseFloat(match[1]);
                            const unit = match[2].toUpperCase();
                            // Convert to bytes
                            if (unit === 'KB') return size * 1024;
                            if (unit === 'MB') return size * 1024 * 1024;
                            if (unit === 'GB') return size * 1024 * 1024 * 1024;
                        }
                    }
                    return 0;
                },
            },
            fileType: {
                default: '',
                parseHTML: element => {
                    const desc = element.querySelector('.download-item__desc');
                    if (desc) {
                        // Try to extract type from description (e.g., "PDF dokument")
                        const text = desc.textContent;
                        if (text.includes('PDF')) return 'application/pdf';
                        if (text.includes('Word') || text.includes('DOC')) return 'application/msword';
                        if (text.includes('Excel') || text.includes('XLS')) return 'application/vnd.ms-excel';
                        // Fallback: try to extract from file extension
                        const fileName = element.querySelector('.download-item__title')?.textContent || '';
                        const ext = fileName.split('.').pop()?.toLowerCase();
                        if (ext) return `application/${ext}`;
                    }
                    return '';
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div.download-item',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { fileId, fileName, fileUrl, fileSize, fileType } = HTMLAttributes;

        // Format file size for display
        const formatFileSize = (bytes) => {
            if (!bytes || bytes === 0) return '';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        };

        // Get file type label
        const getFileTypeLabel = (mimeType, fileName) => {
            if (!mimeType && !fileName) return 'Soubor';

            // From MIME type
            if (mimeType) {
                if (mimeType.includes('pdf')) return 'PDF dokument';
                if (mimeType.includes('word') || mimeType.includes('msword')) return 'Word dokument';
                if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel tabulka';
                if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint prezentace';
                if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'Archiv ZIP';
                if (mimeType.includes('image')) return 'Obrázek';
                if (mimeType.includes('video')) return 'Video';
                if (mimeType.includes('audio')) return 'Audio soubor';
                if (mimeType.includes('text')) return 'Textový soubor';
            }

            // From file extension
            if (fileName) {
                const ext = fileName.split('.').pop()?.toLowerCase();
                if (ext === 'pdf') return 'PDF dokument';
                if (['doc', 'docx'].includes(ext)) return 'Word dokument';
                if (['xls', 'xlsx'].includes(ext)) return 'Excel tabulka';
                if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint prezentace';
                if (['zip', 'rar', '7z'].includes(ext)) return 'Archiv';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Obrázek';
                if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return 'Video';
                if (['mp3', 'wav', 'ogg'].includes(ext)) return 'Audio soubor';
                if (['txt', 'md'].includes(ext)) return 'Textový soubor';
            }

            return 'Soubor';
        };

        const fileTypeLabel = getFileTypeLabel(fileType, fileName);
        const fileSizeLabel = formatFileSize(parseInt(fileSize));
        const description = fileSizeLabel ? `${fileTypeLabel}, ${fileSizeLabel}` : fileTypeLabel;

        // Build the download item HTML structure
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                class: 'download-item',
                'data-file-id': fileId,
            }),
            [
                'div',
                { class: 'download-item__info' },
                [
                    'h4',
                    { class: 'download-item__title' },
                    fileName || 'Bez názvu',
                ],
                [
                    'p',
                    { class: 'download-item__desc' },
                    description,
                ],
            ],
            [
                'a',
                {
                    href: fileUrl || '#',
                    class: 'btn btn--primary',
                    download: fileName || true,
                },
                [
                    'svg',
                    {
                        width: '16',
                        height: '16',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        class: 'btn__icon',
                    },
                    [
                        'path',
                        { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
                    ],
                    [
                        'polyline',
                        { points: '7 10 12 15 17 10' },
                    ],
                    [
                        'line',
                        { x1: '12', y1: '15', x2: '12', y2: '3' },
                    ],
                ],
                'Stáhnout',
            ],
        ];
    },

    addCommands() {
        return {
            setDownloadBlock: (attributes) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: attributes,
                });
            },
        };
    },
});

export default DownloadBlock;