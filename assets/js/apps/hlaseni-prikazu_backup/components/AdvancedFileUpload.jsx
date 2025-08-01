import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    IconUpload, 
    IconFile, 
    IconTrash, 
    IconPhoto, 
    IconCamera,
    IconRotateClockwise,
    IconRotate2,
    IconEye,
    IconX,
    IconCameraRotate,
    IconCheck,
    IconPhotoCancel
} from '@tabler/icons-react';

export const AdvancedFileUpload = ({ 
    id, 
    files = [], 
    onFilesChange, 
    maxFiles = 5, 
    accept = "image/jpeg,image/png,image/heic,application/pdf",
    disabled = false,
    maxSize = 10, // MB
    storagePath = null,
    isPublic = false // New parameter for public/private files
}) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

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
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
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
            alert('Nepodařilo se spustit kameru. Zkontrolujte oprávnění.');
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
                let { width, height } = img;
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
        
        setUploading(true);
        setUploadProgress(0);
        
        const totalNewFiles = Array.from(newFiles);
        
        // Basic validation first
        const validFiles = [];
        for (const file of totalNewFiles) {
            // File size validation
            if (file.size > maxSize * 1024 * 1024) {
                alert(`Soubor ${file.name} překračuje maximální velikost ${maxSize}MB`);
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
                alert(`Soubor ${file.name} má nepodporovaný formát`);
                continue;
            }

            // File count validation
            if (files.length + validFiles.length >= maxFiles) {
                alert(`Můžete nahrát maximálně ${maxFiles} souborů`);
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
                throw new Error('Upload failed');
            }

            const result = await response.json();

            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    alert(`${error.file}: ${error.error}`);
                });
            }

            if (result.files && result.files.length > 0) {
                const processedFiles = result.files.map(file => ({
                    ...file,
                    rotation: 0,
                    uploadedAt: new Date(file.uploadedAt)
                }));

                onFilesChange([...files, ...processedFiles]);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Chyba při nahrávání souborů');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Image rotation
    const rotateImage = (fileId, degrees) => {
        const updatedFiles = files.map(f =>
            f.id === fileId
                ? { ...f, rotation: (f.rotation || 0) + degrees }
                : f
        );
        onFilesChange(updatedFiles);
    };

    // File removal with server delete
    const removeFile = async (fileId) => {
        if (disabled) return;
        
        const fileToRemove = files.find(f => f.id === fileId);
        if (!fileToRemove) return;
        
        try {
            // If file has numeric ID, it's from server - delete it
            if (typeof fileToRemove.id === 'number') {
                const response = await fetch(`/api/portal/files/${fileToRemove.id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error('Delete failed');
                }
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
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Chyba při mazání souboru');
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
                <IconUpload size={32} className="mx-auto mb-2 text-gray-400" />
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
                        <IconCamera size={16} />
                        Fotoaparát
                    </button>
                </div>
            )}

            {/* Upload progress */}
            {uploading && (
                <div className="bg-gray-200 rounded-full h-2">
                    <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                    ></div>
                </div>
            )}

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
                                    {file.rotation && (
                                        <span className="ml-2">
                                            • Otočeno {file.rotation}°
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
                                        style={{
                                            transform: `rotate(${file.rotation || 0}deg)`,
                                            transition: 'transform 0.3s ease'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex-shrink-0 flex gap-1">
                                {/* Preview button */}
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="p-1 text-blue-500 hover:text-blue-700 rounded"
                                    title="Náhled"
                                >
                                    <IconEye size={16} />
                                </button>

                                {/* Rotation buttons for images */}
                                {isImage(file.fileType) && !disabled && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => rotateImage(file.id, -90)}
                                            className="p-1 text-green-500 hover:text-green-700 rounded"
                                            title="Otočit vlevo"
                                        >
                                            <IconRotate2 size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => rotateImage(file.id, 90)}
                                            className="p-1 text-green-500 hover:text-green-700 rounded"
                                            title="Otočit vpravo"
                                        >
                                            <IconRotateClockwise size={16} />
                                        </button>
                                    </>
                                )}

                                {/* Remove button */}
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => removeFile(file.id)}
                                        className="p-1 text-red-500 hover:text-red-700 rounded"
                                        title="Odstranit soubor"
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Camera Modal */}
            {cameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
                    <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Fotoaparát</h3>
                            <button
                                onClick={stopCamera}
                                className="p-2 text-gray-500 hover:text-gray-700"
                            >
                                <IconX size={20} />
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
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                    >
                                        <IconPhotoCancel size={16} />
                                        Znovu
                                    </button>
                                    <button
                                        onClick={confirmPhoto}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                        <IconCheck size={16} />
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
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        <IconCameraRotate size={16} />
                                        Přepnout kameru
                                    </button>
                                    <button
                                        onClick={capturePhoto}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                        <IconCamera size={16} />
                                        Vyfotit
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
                    <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">{previewFile.fileName}</h3>
                            <button
                                onClick={() => setPreviewFile(null)}
                                className="p-2 text-gray-500 hover:text-gray-700"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <div className="text-center">
                            {isImage(previewFile.fileType) ? (
                                <div>
                                    <img
                                        src={previewFile.url}
                                        alt={previewFile.fileName}
                                        className="max-w-full max-h-96 mx-auto rounded"
                                        style={{
                                            transform: `rotate(${previewFile.rotation || 0}deg)`,
                                            transition: 'transform 0.3s ease'
                                        }}
                                    />
                                    {!disabled && (
                                        <div className="flex gap-2 justify-center mt-4">
                                            <button
                                                onClick={() => rotateImage(previewFile.id, -90)}
                                                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                <IconRotate2 size={16} />
                                                Otočit vlevo
                                            </button>
                                            <button
                                                onClick={() => rotateImage(previewFile.id, 90)}
                                                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                <IconRotateClockwise size={16} />
                                                Otočit vpravo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-gray-500">
                                    <IconFile size={64} className="mx-auto mb-4" />
                                    <p>PDF náhled není dostupný v této verzi</p>
                                    <a
                                        href={previewFile.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Otevřít PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};