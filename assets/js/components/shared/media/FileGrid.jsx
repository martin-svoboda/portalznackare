import React from 'react';
import { IconFile, IconEye, IconEdit, IconTrash, IconCopy } from '@tabler/icons-react';

/**
 * FileGrid - Reusable grid component for displaying files
 *
 * Props:
 * - files: Array of file objects with { id, fileName, fileSize, fileType, url, thumbnailUrl, uploadedAt, ... }
 * - onPreview: (file) => void - Handler for preview action
 * - onEdit: (file) => void - Handler for edit action (optional, only for images)
 * - onDelete: (file) => void - Handler for delete action
 * - onCopyUrl: (file) => void - Handler for copy URL action (optional)
 * - gridCols: number - Number of columns in grid (default: 2 for form, 4 for admin)
 * - showActions: boolean - Show action buttons (default: true)
 * - actionsMode: 'inline' | 'overlay' - Actions display mode (default: 'inline')
 * - disabled: boolean - Disable edit/delete actions
 */
export default function FileGrid({
    files = [],
    onPreview,
    onEdit,
    onDelete,
    onCopyUrl,
    gridCols = 2,
    showActions = true,
    actionsMode = 'inline',
    disabled = false
}) {
    // Helper: Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper: Check if file is image
    const isImage = (fileType) => {
        return fileType && fileType.startsWith('image/');
    };

    // Grid columns class mapping
    const gridColsClass = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    };

    if (files.length === 0) {
        return null;
    }

    return (
        <div className={`grid ${gridColsClass[gridCols] || gridColsClass[2]} gap-2`}>
            {files.map((file) => (
                <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    {/* Thumbnail / Icon */}
                    <div
                        className="flex-shrink-0 cursor-pointer"
                        onClick={() => onPreview && onPreview(file)}
                    >
                        {isImage(file.fileType) ? (
                            <div className="w-20 h-20 overflow-hidden rounded">
                                <img
                                    src={file.thumbnailUrl || file.url}
                                    alt={file.fileName}
                                    className="w-full h-full object-cover"
                                    style={{ transition: 'transform 0.3s ease' }}
                                />
                            </div>
                        ) : (
                            <div className="w-20 h-20 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
                                <IconFile size={42} className="text-gray-500 dark:text-gray-400" />
                            </div>
                        )}
                    </div>

                    {/* File Info + Actions */}
                    <div className="flex-1 min-w-0">
                        {/* File name */}
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                            {file.fileName}
                        </p>

                        {/* File metadata */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            {formatFileSize(file.fileSize)}
                            {file.uploadedAt && (
                                <span className="ml-2">
                                    • {new Date(file.uploadedAt).toLocaleDateString('cs-CZ')}
                                </span>
                            )}
                            {file.isEdited && (
                                <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">
                                    • Upraveno
                                </span>
                            )}
                            {file.usageCount !== undefined && file.usageCount > 0 && (
                                <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                    • Použito {file.usageCount}×
                                </span>
                            )}
                        </p>

                        {/* Action buttons - Inline mode */}
                        {showActions && actionsMode === 'inline' && (
                            <div className="flex justify-between gap-1">
                                <div className="flex gap-1">
                                    {/* Preview button */}
                                    {onPreview && (
                                        <button
                                            type="button"
                                            onClick={() => onPreview(file)}
                                            className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded"
                                            title="Náhled"
                                        >
                                            <IconEye size={20} />
                                        </button>
                                    )}

                                    {/* Edit button (only for images) */}
                                    {onEdit && isImage(file.fileType) && !disabled && (
                                        <button
                                            type="button"
                                            onClick={() => onEdit(file)}
                                            className="p-1 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 rounded"
                                            title="Upravit obrázek"
                                        >
                                            <IconEdit size={20} />
                                        </button>
                                    )}

                                    {/* Copy URL button */}
                                    {onCopyUrl && (
                                        <button
                                            type="button"
                                            onClick={() => onCopyUrl(file)}
                                            className="p-1 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded"
                                            title="Kopírovat URL"
                                        >
                                            <IconCopy size={20} />
                                        </button>
                                    )}
                                </div>

                                {/* Delete button */}
                                {onDelete && !disabled && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(file)}
                                        className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded"
                                        title="Odstranit soubor"
                                    >
                                        <IconTrash size={20} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Action buttons - Overlay mode (for admin) */}
                        {showActions && actionsMode === 'overlay' && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {onPreview && (
                                    <button
                                        type="button"
                                        onClick={() => onPreview(file)}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg"
                                        title="Náhled"
                                    >
                                        <IconEye size={24} />
                                    </button>
                                )}

                                {onEdit && isImage(file.fileType) && !disabled && (
                                    <button
                                        type="button"
                                        onClick={() => onEdit(file)}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg"
                                        title="Upravit"
                                    >
                                        <IconEdit size={24} />
                                    </button>
                                )}

                                {onCopyUrl && (
                                    <button
                                        type="button"
                                        onClick={() => onCopyUrl(file)}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg"
                                        title="Kopírovat URL"
                                    >
                                        <IconCopy size={24} />
                                    </button>
                                )}

                                {onDelete && !disabled && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(file)}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg"
                                        title="Smazat"
                                    >
                                        <IconTrash size={24} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
