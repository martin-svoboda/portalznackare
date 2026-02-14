import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
    IconUpload,
    IconFile,
    IconFileTypePdf,
    IconTrash,
    IconCamera,
    IconEye,
    IconEdit,
    IconX,
    IconCheck,
    IconCameraRotate
} from '@tabler/icons-react';
import {showErrorToast, showSuccessToast, showWarningToast} from '../../../utils/notifications.js';
import UnifiedImageModal from '../UnifiedImageModal';
import {Loader} from '../Loader';

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
    const [selectedFile, setSelectedFile] = useState(null);
    const [modalMode, setModalMode] = useState(null); // 'preview' | 'edit' | null
    const [cameraOpen, setCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [capturedPhotoBlob, setCapturedPhotoBlob] = useState(null);
    const [capturedPhotoDataURL, setCapturedPhotoDataURL] = useState(null);
    const [uploading, setUploading] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Unique component instance ID for isolation
    const componentInstanceId = useMemo(() =>
        `${id}-${Date.now()}-${Math.random().toString(36).substring(2)}`, [id]
    );

    // Camera functionality
    const startCamera = async () => {
        try {
            // Zkusíme nejprve požadovaný facing mode
            let constraints = {
                video: {
                    facingMode: facingMode,
                    width: {ideal: 1920},
                    height: {ideal: 1080}
                }
            };

            let mediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                // Fallback bez facingMode pokud selže
                constraints = {
                    video: {
                        width: {ideal: 1920},
                        height: {ideal: 1080}
                    }
                };
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            setStream(mediaStream);
            setCameraOpen(true);

            // Timeout pro korektní připojení video streamu
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(err => {
                        console.error('Video play error:', err);
                    });
                }
            }, 100);
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
        setCapturedPhotoBlob(null);
        setCapturedPhotoDataURL(null);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            // Vytvoříme blob pro upload + data URL pro náhled (CSP safe)
            canvas.toBlob((blob) => {
                if (blob) {
                    setCapturedPhotoBlob(blob);

                    // Pro náhled v modalu - data: URL je CSP kompatibilní
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setCapturedPhotoDataURL(reader.result);
                    };
                    reader.readAsDataURL(blob);

                    // Zastavíme video stream po vyfocení
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                    }
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const retakePhoto = () => {
        // Vyčistíme captured photo
        setCapturedPhotoBlob(null);
        setCapturedPhotoDataURL(null);

        // Restartujeme kameru
        startCamera();
    };

    const confirmPhoto = async () => {
        if (capturedPhotoBlob) {
            try {
                // Vytvoříme File z blobu
                const file = new File([capturedPhotoBlob], `camera-${Date.now()}.jpg`, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });

                // ✅ KOMPRESE před odesláním (1920px @ 85% podle backend standardu)
                const compressedFile = await compressImage(file, 1920, 0.85);

                await handleFileSelect([compressedFile]);
                stopCamera();
            } catch (error) {
                console.error('Error confirming photo:', error);
                showErrorToast('Nepodařilo se zpracovat fotografii');
            }
        }
    };

    const switchCamera = async () => {
        if (stream) {
            // Zastavíme aktuální stream
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);

        try {
            // Spustíme novou kameru s opačným facing mode
            let mediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: newFacingMode,
                        width: {ideal: 1920},
                        height: {ideal: 1080}
                    }
                });
            } catch (error) {
                showWarningToast('Zařízení nemá druhou kameru');
                // Vrátíme zpět na původní facing mode
                setFacingMode(facingMode);
                return;
            }

            setStream(mediaStream);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(err => {
                        console.error('Video play error:', err);
                    });
                }
            }, 100);
        } catch (error) {
            console.error('Error switching camera:', error);
            showErrorToast('Nepodařilo se přepnout kameru.');
        }
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

        // ✅ KOMPRESE obrázků před uploadem (1920px @ 85% podle backend standardu)
        const processedFiles = [];
        for (const file of validFiles) {
            if (isImage(file.type)) {
                try {
                    const compressed = await compressImage(file, 1920, 0.85);
                    processedFiles.push(compressed);
                } catch (error) {
                    console.error('Error compressing image:', file.name, error);
                    // Pokud komprese selže, použijeme původní soubor
                    processedFiles.push(file);
                }
            } else {
                processedFiles.push(file);
            }
        }

        // Upload files to server
        try {
            const formData = new FormData();
            processedFiles.forEach(file => {
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

            // Clear file input to allow selecting the same file again
            const fileInput = document.getElementById(`file-input-${componentInstanceId}`);
            if (fileInput) {
                fileInput.value = '';
            }
        }
    };


    // Modal handlers
    const openPreview = (file) => {
        setSelectedFile(file);
        setModalMode('preview');
    };

    const openEditor = (file) => {
        if (!isImage(file.fileType)) return;
        setSelectedFile(file);
        setModalMode('edit');
    };

    const handleModalSave = (editedFile) => {
        if (!selectedFile) {
            console.error('handleModalSave: No selected file');
            return;
        }

        // Pro copy mode - kompletně nahradit původní soubor novým
        // Pro overwrite mode - merge dat
        const updatedFiles = files.map(f =>
            f.id === selectedFile.id
                ? (editedFile.isNewFile
                    ? {...editedFile, rotation: 0, uploadedAt: new Date()} // Copy - nový soubor
                    : {...f, ...editedFile, url: editedFile.url || f.url, size: editedFile.size || f.size, isEdited: true}) // Overwrite - merge
                : f
        );
        onFilesChange(updatedFiles);

        // Aktualizovat vybraný soubor
        setSelectedFile({
            ...selectedFile,
            ...editedFile,
            url: editedFile.url || selectedFile.url,
            isEdited: true
        });
    };

    const handleModalClose = () => {
        setSelectedFile(null);
        setModalMode(null);
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

    const isPdf = (fileType) => {
        return fileType === 'application/pdf';
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
            <div className="flex gap-3">
                {/* Upload area */}
                <div
                    className={`flex-1 border-2 border-dashed rounded-lg transition-colors flex gap-4 items-center justify-center min-h-20 p-5 flex-1
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
                    <IconUpload size={32} className="text-gray-400"/>
                    <div className="flex flex-col justify-center">
                        <div className="text-sm text-gray-600">
                            {disabled ? 'Upload zakázán' : 'Klikněte nebo přetáhněte soubory sem'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            Maximálně {maxFiles} souborů
                            • {accept.replace(/[^a-zA-Z,]/g, ' ').replace(/'image'/g, '')}
                        </div>
                    </div>

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
                    <button
                        type="button"
                        onClick={startCamera}
                        className="border-2 rounded-lg transition-colors flex flex-col gap-1 items-center justify-center min-h-20 p-5 text-sm border-gray-300 hover:border-gray-400"
                    >
                        <IconCamera size={24} className="text-gray-400"/>
                        Vyfotit
                    </button>
                )}
            </div>

            {/* Upload loading indicator */}
            {uploading && (
                <div className="flex items-center justify-center gap-3 py-4">
                    <Loader />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Nahrávání souborů...
                    </span>
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
                                onClick={() => openPreview(file)}
                            >
                                {/* Preview for images, PDF icon, or generic file icon */}
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
                                ) : isPdf(file.fileType) ? (
                                    <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center bg-red-50 dark:bg-red-900/30 rounded">
                                        <IconFileTypePdf size={42} className="text-red-600 dark:text-red-400" stroke={1}/>
                                    </div>
                                ) : (
                                    <IconFile size={42} className="text-gray-500" stroke={1}/>
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
                                            onClick={() => openPreview(file)}
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

            {/* Camera Modal - minimalistické rozhraní jako fotoaparát v mobilu */}
            {cameraOpen && (
                <div className="fixed inset-0 z-50 bg-black/90 md:flex md:items-center md:justify-center md:p-4">
                    <div className="relative w-full h-full md:w-auto md:h-auto md:max-w-4xl md:max-h-[90vh] flex flex-col md:rounded-2xl md:overflow-hidden md:shadow-2xl">
                        {capturedPhotoDataURL ? (
                            <>
                                {/* Photo confirmation view */}
                                <div className="flex-1 flex items-center justify-center bg-black p-4">
                                    <img
                                        src={capturedPhotoDataURL}
                                        alt="Zachycená fotka"
                                        className="max-w-full max-h-full object-contain md:max-h-[80vh]"
                                    />
                                </div>

                                {/* Action buttons - s textem po vyfocení */}
                                <div className="absolute bottom-0 left-0 right-0 flex gap-4 justify-center p-6 bg-gradient-to-t from-black/80 to-transparent">
                                    <button
                                        onClick={retakePhoto}
                                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
                                        disabled={uploading}
                                    >
                                        <IconX size={20}/>
                                        Vyfotit znovu
                                    </button>

                                    <button
                                        onClick={confirmPhoto}
                                        className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors"
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader />
                                                Nahrávání...
                                            </>
                                        ) : (
                                            <>
                                                <IconCheck size={20}/>
                                                Potvrdit
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Live camera view */}
                                <div className="flex-1 flex items-center justify-center bg-black overflow-hidden md:min-h-[600px]">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover md:max-h-[80vh]"
                                    />
                                </div>

                                {/* Floating action buttons - pouze ikony */}
                                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 p-8 bg-gradient-to-t from-black/80 to-transparent">
                                    {/* Přepnout kameru */}
                                    <button
                                        onClick={switchCamera}
                                        className="w-14 h-14 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-all"
                                        aria-label="Přepnout kameru"
                                    >
                                        <IconCameraRotate size={28} className="text-white" stroke={1.5}/>
                                    </button>

                                    {/* Vyfotit - hlavní tlačítko */}
                                    <button
                                        onClick={capturePhoto}
                                        className="w-20 h-20 flex items-center justify-center bg-white hover:bg-gray-200 rounded-full shadow-lg transition-all hover:scale-105"
                                        aria-label="Vyfotit"
                                    >
                                        <div className="w-16 h-16 border-4 border-gray-900 rounded-full"></div>
                                    </button>

                                    {/* Zavřít */}
                                    <button
                                        onClick={stopCamera}
                                        className="w-14 h-14 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-all"
                                        aria-label="Zavřít kameru"
                                    >
                                        <IconX size={28} className="text-white" stroke={1.5}/>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <canvas ref={canvasRef} className="hidden"/>
                </div>
            )}

            {/* Unified Modal - jeden pro preview i edit */}
            <UnifiedImageModal
                file={selectedFile}
                isOpen={modalMode !== null}
                onClose={handleModalClose}
                onSave={handleModalSave}
                onDelete={async (fileId) => {
                    try {
                        await removeFile(fileId);
                        setSelectedFile(null);
                        setModalMode(null);
                    } catch (error) {
                        console.error('Failed to delete file:', error);
                    }
                }}
                mode={modalMode || 'preview'}
                usageType={usageType}
                entityId={entityId}
                fieldName={fieldName}
            />
        </div>
    );
};