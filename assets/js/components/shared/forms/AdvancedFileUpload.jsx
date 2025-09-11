import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
    IconUpload,
    IconFile,
    IconTrash,
    IconPhoto,
    IconCamera,
    IconEye,
    IconEdit,
    IconX,
    IconCheck,
    IconPhotoCancel
} from '@tabler/icons-react';
import {showErrorToast, showSuccessToast, showWarningToast} from '../../../utils/notifications.js';
import UnifiedImageModal from '../UnifiedImageModal';

export const AdvancedFileUpload = ({
                                       id,
                                       files = [],
                                       onFilesChange,
                                       maxFiles = 5,
                                       accept = "image/jpeg,image/png,image/heic,application/pdf",
                                       disabled = false,
                                       maxSize = 10, // MB
                                       storagePath = null,
                                       isPublic = false, // New parameter for public/private files
                                       // Usage tracking props
                                       usageType = null, // e.g., 'reports', 'pages' - database entity type
                                       entityId = null,  // e.g., 123 - database record ID
                                       fieldName = null  // e.g., 'Prilohy_NP', 'Prilohy_TIM' - specific field name
                                   }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [editorOpen, setEditorOpen] = useState(false);
    const [fileToEdit, setFileToEdit] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Unique component instance ID for isolation
    const componentInstanceId = useMemo(() =>
        `${id}-${Date.now()}-${Math.random().toString(36).substring(2)}`, [id]
    );

    // Camera functionality
    const startCamera = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: {ideal: 1920},
                    height: {ideal: 1080}
                }
            };
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            setCameraOpen(true);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            showErrorToast('Nepodařilo se spustit kameru. Zkontrolujte oprávnění.', {
                title: 'Kamera nedostupná',
                duration: 0
            });
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraOpen(false);
        setCapturedPhoto(null);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedPhoto(dataURL);
        }
    };

    const confirmPhoto = () => {
        if (capturedPhoto) {
            // Convert dataURL to file
            fetch(capturedPhoto)
                .then(res => res.blob())
                .then(blob => {
                    const timestamp = Date.now();
                    const file = new File([blob], `camera-${timestamp}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: timestamp
                    });
                    handleFileSelect([file]);
                    stopCamera();
                });
        }
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        stopCamera();
        setTimeout(() => startCamera(), 100);
    };

    // Image compression
    const compressImage = async (file, maxWidth = 1920, quality = 0.8) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                let {width, height} = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    // File handling with server upload
    const handleFileSelect = async (newFiles) => {
        if (disabled) return;

        const totalNewFiles = Array.from(newFiles);
        
        // Pre-upload duplicate check (layer 1)
        const filesToUpload = [];
        for (const file of totalNewFiles) {
            const isDuplicate = files.some(existingFile => existingFile.fileName === file.name);
            if (isDuplicate) {
                const confirmed = window.confirm(`Soubor se stejným názvem "${file.name}" již byl přidán, opravdu chcete přidat i tento?`);
                if (!confirmed) {
                    continue; // Skip this file
                }
            }
            filesToUpload.push(file);
        }
        
        if (filesToUpload.length === 0) {
            return; // No files to upload
        }

        setUploading(true);
        setUploadProgress(0);

        // Basic validation first
        const validFiles = [];
        for (const file of filesToUpload) {
            // File size validation
            if (file.size > maxSize * 1024 * 1024) {
                showErrorToast(`Soubor ${file.name} překračuje maximální velikost ${maxSize}MB`);
                continue;
            }

            // File type validation
            const acceptedTypes = accept.split(',').map(type => type.trim());
            const isValidType = acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return file.name.toLowerCase().endsWith(type.toLowerCase());
                }
                return file.type.match(type.replace('*', '.*'));
            });

            if (!isValidType) {
                showErrorToast(`Soubor ${file.name} má nepodporovaný formát`);
                continue;
            }

            // File count validation
            if (files.length + validFiles.length >= maxFiles) {
                showWarningToast(`Můžete nahrát maximálně ${maxFiles} souborů`);
                break;
            }

            validFiles.push(file);
        }

        if (validFiles.length === 0) {
            setUploading(false);
            return;
        }

        // Upload files to server
        try {
            const formData = new FormData();
            validFiles.forEach(file => {
                formData.append('files[]', file);
            });

            // Add storage path if provided
            if (storagePath) formData.append('path', storagePath);

            // Add is_public parameter
            formData.append('is_public', isPublic.toString());

            // Add entity type and ID for usage tracking
            if (usageType && entityId) {
                console.log('USAGE DEBUG - Sending to backend:', {
                    entity_type: usageType,
                    entity_id: entityId,
                    field_name: fieldName
                });
                formData.append('entity_type', usageType);
                formData.append('entity_id', entityId.toString());
                if (fieldName) {
                    formData.append('field_name', fieldName);
                }
            } else {
                console.warn('USAGE DEBUG - Missing usage tracking params:', {
                    usageType, entityId, fieldName
                });
            }

            // Add options
            formData.append('options', JSON.stringify({
                create_thumbnail: true,
                optimize: true
            }));

            const response = await fetch('/api/portal/files/upload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let errorMessage = 'Upload failed';
                try {
                    const errorData = await response.json();
                    console.error('Upload error response:', errorData);
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                    if (errorData.trace) {
                        console.error('Error trace:', errorData.trace);
                    }
                } catch (e) {
                    console.error('Failed to parse error response');
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();

            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    showErrorToast(`${error.file}: ${error.error}`, {duration: 8000});
                });
            }

            if (result.files && result.files.length > 0) {
                const processedFiles = result.files.map(file => ({
                    ...file,
                    rotation: 0,
                    uploadedAt: new Date(file.uploadedAt)
                }));

                // Post-upload ID duplicate check (layer 3)
                const existingIds = files.map(f => f.id);
                const newFiles = processedFiles.filter(pf => !existingIds.includes(pf.id));
                
                onFilesChange([...files, ...newFiles]);

                // Usage tracking je nyní řešeno na backend při uploadu s entity_type a entity_id parametry
                // Odstraněno duplicitní frontend tracking

                // Zobrazit success toast pro úspěšně nahrané soubory
                if (processedFiles.length > 0) {
                    const fileCount = processedFiles.length;
                    const message = fileCount === 1
                        ? `Soubor ${processedFiles[0].fileName} byl úspěšně nahrán`
                        : `${fileCount} souborů bylo úspěšně nahráno`;
                    showSuccessToast(message);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            showErrorToast('Chyba při nahrávání souborů', {
                title: 'Upload selhal',
                duration: 0 // Chyba se nezavře automaticky
            });
        } finally {
            setUploading(false);
            setUploadProgress(0);
            
            // Clear file input to allow selecting the same file again
            const fileInput = document.getElementById(`file-input-${componentInstanceId}`);
            if (fileInput) {
                fileInput.value = '';
            }
        }
    };


    // Image editor functions
    const openEditor = (file) => {
        if (!isImage(file.fileType)) return;
        setFileToEdit(file);
        setEditorOpen(true);
    };

    const handleEditorSave = (editedFile) => {
        // Pro copy mode - kompletně nahradit původní soubor novým
        // Pro overwrite mode - merge dat
        const updatedFiles = files.map(f => 
            f.id === fileToEdit.id 
                ? (editedFile.isNewFile 
                    ? { ...editedFile, rotation: 0, uploadedAt: new Date() } // Copy - nový soubor
                    : { ...f, ...editedFile, url: editedFile.url || f.url, size: editedFile.size || f.size, isEdited: true }) // Overwrite - merge
                : f
        );
        onFilesChange(updatedFiles);

        // Pokud je soubor aktuálně v náhledu, aktualizovat náhled
        if (previewFile && previewFile.id === fileToEdit.id) {
            setPreviewFile({
                ...previewFile,
                ...editedFile,
                url: editedFile.url || previewFile.url,
                isEdited: true
            });
        }
    };

    const handleEditorClose = () => {
        setEditorOpen(false);
        setFileToEdit(null);
    };

    // File removal with server delete and confirmation
    const removeFile = async (fileId) => {
        if (disabled) return;

        const fileToRemove = files.find(f => f.id === fileId);
        if (!fileToRemove) return;

        // Confirmation dialog
        const confirmed = window.confirm('Opravdu chcete smazat tento soubor?');
        if (!confirmed) return;

        try {
            // If file has numeric ID, it's from server - delete it
            if (typeof fileToRemove.id === 'number') {
                const response = await fetch(`/api/portal/files/${fileToRemove.id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        entity_type: usageType,    // e.g., 'reports'
                        entity_id: entityId,       // e.g., 123456
                        field_name: fieldName      // e.g., 'Prilohy_NP'
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error || 'Delete failed';
                    const errorDetails = errorData.details ? ` (${errorData.details})` : '';
                    throw new Error(`${errorMessage}${errorDetails}`);
                }

                // Usage tracking se automaticky aktualizuje na backend při mazání souboru
            }

            // Clean up URLs if they're blob URLs
            if (fileToRemove.url && fileToRemove.url.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            if (fileToRemove.thumbnailUrl && fileToRemove.thumbnailUrl.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.thumbnailUrl);
            }

            const updatedFiles = files.filter(f => f.id !== fileId);
            onFilesChange(updatedFiles);
            showSuccessToast('Soubor byl úspěšně smazán');
        } catch (error) {
            console.error('Error deleting file:', error);
            showErrorToast(error.message || 'Chyba při mazání souboru', {
                title: 'Mazání selhalo',
                duration: 0 // Nechej zobrazené dokud uživatel nezavře
            });
        }
    };

    // Drag and drop handlers
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

    // Utility functions
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            // Cleanup URLs
            files.forEach(file => {
                if (file.url) URL.revokeObjectURL(file.url);
                if (file.thumbnailUrl && file.thumbnailUrl !== file.url) {
                    URL.revokeObjectURL(file.thumbnailUrl);
                }
            });
        };
    }, []);

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
                        document.getElementById(`file-input-${componentInstanceId}`).click();
                    }
                }}
            >
                <IconUpload size={32} className="mx-auto mb-2 text-gray-400"/>
                <p className="text-sm text-gray-600">
                    {disabled ? 'Upload zakázán' : 'Klikněte nebo přetáhněte soubory sem'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Maximálně {maxFiles} souborů • {accept.replace(/[^a-zA-Z,]/g, '').toUpperCase()}
                </p>

                <input
                    id={`file-input-${componentInstanceId}`}
                    type="file"
                    multiple
                    accept={accept}
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    disabled={disabled}
                />
            </div>

            {/* Camera and additional actions */}
            {!disabled && (
                <div className="flex gap-2 justify-center">
                    <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <IconCamera size={16}/>
                        Fotoaparát
                    </button>
                </div>
            )}

            {/* Upload progress */}
            {uploading && (
                <div className="bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{width: `${uploadProgress}%`}}
                    ></div>
                </div>
            )}

            {/* File list */}
            {files.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {files.map((file) => (
                        <div key={file.id}
                             className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div
                                className="flex-shrink-0"
                                onClick={() => setPreviewFile(file)}
                            >
                                {/* Preview for images or file icon */}
                                {isImage(file.fileType) ? (
                                    <div className="flex-shrink-0 w-20 h-20">
                                        <img
                                            src={file.thumbnailUrl || file.url}
                                            alt={file.fileName}
                                            className=""
                                            style={{
                                                transition: 'transform 0.3s ease'
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <IconFile size={42} className="text-gray-500"/>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 gap-1">
                                <p className="text-sm font-medium text-gray-900 truncate mb-1">
                                    {file.fileName}
                                </p>
                                <p className="text-xs text-gray-500 mb-3">
                                    {formatFileSize(file.fileSize)}
                                    {file.uploadedAt && (
                                        <span className="ml-2">
                                            • {new Date(file.uploadedAt).toLocaleDateString('cs-CZ')}
                                        </span>
                                    )}
                                    {file.rotation ? (
                                        <span className="ml-2">
                                            • Otočeno {file.rotation}°
                                        </span>
                                    ) : ''}
                                    {file.isEdited && (
                                        <span className="ml-2 text-purple-600 font-medium">
                                            • Upraveno
                                        </span>
                                    )}
                                </p>

                                {/* Action buttons */}
                                <div className="flex-shrink-0 flex justify-between gap-1">
                                    <div className="flex-shrink-0 flex gap-1">
                                        {/* Preview button */}
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFile(file)}
                                            className="p-1 text-blue-500 hover:text-blue-700 rounded"
                                            title="Náhled"
                                        >
                                            <IconEye size={20}/>
                                        </button>

                                        {/* Edit button for images */}
                                        {isImage(file.fileType) && !disabled && (
                                            <button
                                                type="button"
                                                onClick={() => openEditor(file)}
                                                className="p-1 text-purple-500 hover:text-purple-700 rounded"
                                                title="Upravit obrázek"
                                            >
                                                <IconEdit size={20}/>
                                            </button>
                                        )}

                                    </div>

                                    {/* Remove button */}
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={() => removeFile(file.id)}
                                            className="p-1 text-red-500 hover:text-red-700 rounded"
                                            title="Odstranit soubor"
                                        >
                                            <IconTrash size={20}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Camera Modal */}
            {cameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Fotoaparát</h3>
                            <button
                                onClick={stopCamera}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <IconX size={20}/>
                            </button>
                        </div>

                        {capturedPhoto ? (
                            <div className="text-center">
                                <img
                                    src={capturedPhoto}
                                    alt="Captured"
                                    className="max-w-full max-h-96 mx-auto rounded"
                                />
                                <div className="flex gap-2 justify-center mt-4">
                                    <button
                                        onClick={() => setCapturedPhoto(null)}
                                        className="btn btn--warning--light"
                                    >
                                        <IconPhotoCancel size={16}/>
                                        Znovu
                                    </button>
                                    <button
                                        onClick={confirmPhoto}
                                        className="btn btn--success"
                                    >
                                        <IconCheck size={16}/>
                                        Použít
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="max-w-full max-h-96 mx-auto rounded"
                                />
                                <div className="flex gap-2 justify-center mt-4">
                                    <button
                                        onClick={switchCamera}
                                        className="btn btn--primary--light"
                                    >
                                        <IconCameraRotate size={16}/>
                                        Přepnout kameru
                                    </button>
                                    <button
                                        onClick={capturePhoto}
                                        className="btn btn--success"
                                    >
                                        <IconCamera size={16}/>
                                        Vyfotit
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} className="hidden"/>
                </div>
            )}

            {/* Preview Modal - nahrazeno UnifiedImageModal */}
            <UnifiedImageModal
                file={previewFile}
                isOpen={!!previewFile}
                onClose={() => setPreviewFile(null)}
                onSave={handleEditorSave}
                onDelete={async (fileId) => {
                    try {
                        await removeFile(fileId);
                        setPreviewFile(null);
                    } catch (error) {
                        console.error('Failed to delete file from preview:', error);
                    }
                }}
                mode="preview"
                usageType={usageType}
                entityId={entityId}
                fieldName={fieldName}
            />

            {/* Image Editor Modal */}
            <UnifiedImageModal
                file={fileToEdit}
                isOpen={editorOpen}
                onClose={handleEditorClose}
                onSave={handleEditorSave}
                mode="edit"
                // Předat usage tracking props stejně jako při upload/delete
                usageType={usageType}
                entityId={entityId}
                fieldName={fieldName}
            />
        </div>
    );
};