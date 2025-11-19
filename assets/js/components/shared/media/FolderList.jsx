import React from 'react';
import { IconFolder, IconFolderOpen } from '@tabler/icons-react';

/**
 * FolderList - Simple flat list of folders with indentation
 *
 * Props:
 * - folders: Array of folder objects with { name, count, depth? }
 * - selectedFolder: string | null - Currently selected folder name
 * - onFolderSelect: (folderName: string | null) => void - Handler for folder selection
 * - showCounts: boolean - Show file counts (default: true)
 */
export default function FolderList({
    folders = [],
    selectedFolder = null,
    onFolderSelect,
    showCounts = true
}) {
    // Helper: Get folder depth from name (count slashes)
    const getFolderDepth = (folderName) => {
        if (!folderName) return 0;
        return (folderName.match(/\//g) || []).length;
    };

    return (
        <div className="space-y-1">
            {/* "All files" button */}
            <button
                type="button"
                onClick={() => onFolderSelect && onFolderSelect(null)}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg
                    transition-colors
                    ${selectedFolder === null
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                `}
            >
                <IconFolderOpen
                    size={18}
                    className={selectedFolder === null ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
                />
                <span className="flex-1">Všechny soubory</span>
                {showCounts && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {folders.reduce((sum, f) => sum + f.count, 0)}
                    </span>
                )}
            </button>

            {/* Folder list */}
            {folders.map((folder) => {
                const depth = folder.depth !== undefined ? folder.depth : getFolderDepth(folder.name);
                const folderPath = folder.path || folder.name;
                const displayName = folder.name;
                const isSelected = selectedFolder === folderPath;

                return (
                    <button
                        key={folderPath}
                        type="button"
                        onClick={() => onFolderSelect && onFolderSelect(folderPath)}
                        className={`
                            w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg
                            transition-colors
                            ${isSelected
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }
                        `}
                        style={{
                            paddingLeft: `${0.75 + depth * 1.5}rem`
                        }}
                    >
                        <IconFolder
                            size={18}
                            className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
                        />
                        <span className="flex-1 truncate" title={folderPath}>
                            {displayName}
                        </span>
                        {showCounts && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {folder.count}
                            </span>
                        )}
                    </button>
                );
            })}

            {/* Empty state */}
            {folders.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Žádné složky
                </div>
            )}
        </div>
    );
}
