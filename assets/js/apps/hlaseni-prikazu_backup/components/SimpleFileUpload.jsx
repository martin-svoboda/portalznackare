import React, { useState } from 'react';
import { IconUpload, IconFile, IconTrash, IconPhoto } from '@tabler/icons-react';

export const SimpleFileUpload = ({ 
    id, 
    files = [], 
    onFilesChange, 
    maxFiles = 5, 
    accept = "image/jpeg,image/png,image/heic,application/pdf",
    disabled = false 
}) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileSelect = (newFiles) => {
        if (disabled) return;
        
        const validFiles = Array.from(newFiles).filter(file => {
            const acceptedTypes = accept.split(',').map(type => type.trim());
            return acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return file.name.toLowerCase().endsWith(type.toLowerCase());
                }
                return file.type.match(type.replace('*', '.*'));
            });
        });

        const totalFiles = files.length + validFiles.length;
        if (totalFiles > maxFiles) {
            alert(`Maximální počet souborů je ${maxFiles}`);
            return;
        }

        const processedFiles = validFiles.map(file => ({
            id: crypto.randomUUID(),
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadedAt: new Date(),
            uploadedBy: 'current-user', // This would be the actual user
            url: URL.createObjectURL(file), // For preview, in real app this would be uploaded
            file: file // Keep reference to original file for actual upload
        }));

        onFilesChange([...files, ...processedFiles]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (!disabled) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!disabled) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const removeFile = (fileId) => {
        if (disabled) return;
        const updatedFiles = files.filter(file => file.id !== fileId);
        onFilesChange(updatedFiles);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const isImage = (fileType) => {
        return fileType && fileType.startsWith('image/');
    };

    return (
        <div className="space-y-3">
            {/* Upload area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-6 text-center transition-colors
                    ${disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 
                        isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 cursor-pointer'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                    if (!disabled) {
                        document.getElementById(`file-input-${id}`).click();
                    }
                }}
            >
                <IconUpload size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                    {disabled ? 'Upload zakázán' : 'Klikněte nebo přetáhněte soubory sem'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Maximálně {maxFiles} souborů • {accept.replace(/[^a-zA-Z,]/g, '').toUpperCase()}
                </p>
                
                <input
                    id={`file-input-${id}`}
                    type="file"
                    multiple
                    accept={accept}
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    disabled={disabled}
                />
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0">
                                {isImage(file.fileType) ? (
                                    <IconPhoto size={20} className="text-blue-500" />
                                ) : (
                                    <IconFile size={20} className="text-gray-500" />
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.fileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(file.fileSize)}
                                    {file.uploadedAt && (
                                        <span className="ml-2">
                                            • {new Date(file.uploadedAt).toLocaleDateString('cs-CZ')}
                                        </span>
                                    )}
                                </p>
                            </div>

                            {/* Preview for images */}
                            {isImage(file.fileType) && file.url && (
                                <div className="flex-shrink-0">
                                    <img 
                                        src={file.url} 
                                        alt={file.fileName}
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                </div>
                            )}

                            {/* Remove button */}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeFile(file.id)}
                                    className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 rounded"
                                    title="Odstranit soubor"
                                >
                                    <IconTrash size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};