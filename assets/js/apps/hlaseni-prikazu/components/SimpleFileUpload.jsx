import React, { useState } from 'react';
import { IconUpload, IconX, IconFile } from '@tabler/icons-react';

/**
 * Jednoduchý file upload komponent
 * Základní funkcionalita bez pokročilých features jako camera nebo rotation
 */
export const SimpleFileUpload = ({
    id,
    files = [],
    onFilesChange,
    maxFiles = 10,
    accept = "image/jpeg,image/png,image/heic,application/pdf",
    disabled = false,
    maxSize = 15, // MB
    className = ''
}) => {
    const [dragOver, setDragOver] = useState(false);

    const handleFileSelect = (selectedFiles) => {
        if (!selectedFiles || selectedFiles.length === 0) return;

        const fileArray = Array.from(selectedFiles);
        const validFiles = [];

        fileArray.forEach(file => {
            // Check file size
            if (file.size > maxSize * 1024 * 1024) {
                alert(`Soubor ${file.name} je příliš velký (max ${maxSize}MB)`);
                return;
            }

            // Check file type
            const acceptedTypes = accept.split(',').map(type => type.trim());
            const fileType = file.type;
            const isValid = acceptedTypes.some(acceptedType => {
                if (acceptedType.includes('*')) {
                    const baseType = acceptedType.split('/')[0];
                    return fileType.startsWith(baseType);
                }
                return fileType === acceptedType;
            });

            if (!isValid) {
                alert(`Soubor ${file.name} má nepodporovaný formát`);
                return;
            }

            // Create file object
            const fileObject = {
                id: crypto.randomUUID(),
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                uploadedAt: new Date(),
                file: file, // Store the actual file for upload
                url: URL.createObjectURL(file) // Create preview URL
            };

            validFiles.push(fileObject);
        });

        // Check max files limit
        const totalFiles = files.length + validFiles.length;
        if (totalFiles > maxFiles) {
            alert(`Můžete nahrát maximálně ${maxFiles} souborů`);
            return;
        }

        // Update files
        const newFiles = [...files, ...validFiles];
        onFilesChange(newFiles);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOver(false);
    };

    const removeFile = (fileId) => {
        const newFiles = files.filter(file => file.id !== fileId);
        onFilesChange(newFiles);
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Upload area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-4 text-center transition-colors
                    ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50'}
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                    if (!disabled) {
                        document.getElementById(`file-input-${id}`).click();
                    }
                }}
            >
                <input
                    id={`file-input-${id}`}
                    type="file"
                    multiple
                    accept={accept}
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                    disabled={disabled}
                />
                
                <IconUpload size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-1">
                    Klikněte pro výběr souborů nebo je sem přetáhněte
                </p>
                <p className="text-xs text-gray-500">
                    Max {maxFiles} souborů, každý do {maxSize}MB
                </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium">Nahrané soubory ({files.length})</h4>
                    {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-2 border border-gray-200 rounded bg-gray-50">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <IconFile size={16} className="text-gray-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{file.fileName}</p>
                                    <p className="text-xs text-gray-500">
                                        {formatFileSize(file.fileSize)} • {file.fileType}
                                    </p>
                                </div>
                            </div>
                            
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeFile(file.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                    title="Odstranit soubor"
                                >
                                    <IconX size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* File limit warning */}
            {files.length >= maxFiles && (
                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    Dosáhli jste limitu {maxFiles} souborů
                </div>
            )}
        </div>
    );
};