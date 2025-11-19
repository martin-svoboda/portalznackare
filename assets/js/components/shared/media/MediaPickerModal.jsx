import React, { useState, useEffect, useRef } from 'react';
import { IconX, IconSearch, IconUpload, IconPhoto, IconCheck, IconCamera, IconCameraRotate } from '@tabler/icons-react';
import FileGrid from './FileGrid.jsx';
import Loader from '../Loader.jsx';
import { createDebugLogger } from '../../../utils/debug.js';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../../utils/notifications.js';

const logger = createDebugLogger('MediaPickerModal');

/**
 * MediaPickerModal - WordPress-style media picker
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSelect: (file: FileAttachment, altText: string) => void
 * - storagePath: string (e.g., "cms/pages/123")
 * - entityType: string (e.g., "pages")
 * - entityId: number (e.g., 123)
 * - accept: string (e.g., "image/*")
 * - maxSize: number (MB, default 10)
 */
export default function MediaPickerModal({
    isOpen = false,
    onClose,
    onSelect,
    storagePath,
    entityType,
    entityId,
    accept = "image/*",
    maxSize = 10
}) {
    // Tabs
    const [activeTab, setActiveTab] = useState('library'); // 'library' | 'upload'

    // Library tab state
    const [libraryFiles, setLibraryFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('images'); // 'all' | 'images' | 'pdfs' | 'documents'

    // Upload tab state
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [capturedPhotoBlob, setCapturedPhotoBlob] = useState(null);
    const [capturedPhotoDataURL, setCapturedPhotoDataURL] = useState(null);

    // Selection state
    const [selectedFile, setSelectedFile] = useState(null);
    const [altText, setAltText] = useState('');

    // Refs
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Load library files when modal opens or search/filter changes
    useEffect(() => {
        if (isOpen && activeTab === 'library') {
            loadLibraryFiles();
        }
    }, [isOpen, activeTab, searchQuery, typeFilter]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Load files from media library
    const loadLibraryFiles = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            // Don't filter by folder - show all files for selection
            // params.append('folder', 'cms');
            params.append('type', typeFilter);
            if (searchQuery) params.append('search', searchQuery);

            logger.api('GET', `/api/portal/files/library?${params}`);
            const response = await fetch(`/api/portal/files/library?${params}`);
            const data = await response.json();

            if (data.success) {
                logger.custom('Loaded library files', { count: data.files.length });
                setLibraryFiles(data.files);
            } else {
                logger.error('Failed to load library', data.error);
                showErrorToast('Nepodařilo se načíst knihovnu médií');
            }
        } catch (error) {
            logger.error('Error loading library', error);
            showErrorToast('Chyba při načítání knihovny médií');
        } finally {
            setLoading(false);
        }
    };

    // Handle file selection from library
    const handleLibraryFileClick = (file) => {
        setSelectedFile(file);
        setAltText(file.fileName.replace(/\.[^/.]+$/, '')); // Remove extension for default alt text
        logger.lifecycle('File selected from library', { fileId: file.id });
    };

    // Handle file upload
    const handleFileUpload = async (files) => {
        if (uploading || files.length === 0) return;

        try {
            setUploading(true);

            // Validate files
            const validFiles = [];
            for (const file of files) {
                // Size validation
                if (file.size > maxSize * 1024 * 1024) {
                    showErrorToast(`Soubor ${file.name} překračuje maximální velikost ${maxSize}MB`);
                    continue;
                }

                // Type validation
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

                validFiles.push(file);
            }

            if (validFiles.length === 0) {
                setUploading(false);
                return;
            }

            // Compress images before upload
            const processedFiles = [];
            for (const file of validFiles) {
                if (file.type.startsWith('image/')) {
                    try {
                        const compressed = await compressImage(file, 1920, 0.85);
                        processedFiles.push(compressed);
                    } catch (error) {
                        logger.error('Compression failed', error);
                        processedFiles.push(file);
                    }
                } else {
                    processedFiles.push(file);
                }
            }

            // Upload to server
            const formData = new FormData();
            processedFiles.forEach(file => formData.append('files[]', file));
            formData.append('path', storagePath);
            formData.append('is_public', 'true'); // CMS files are public
            formData.append('entity_type', entityType);
            formData.append('entity_id', entityId.toString());
            formData.append('field_name', 'content_images');
            formData.append('options', JSON.stringify({
                create_thumbnail: true,
                optimize: true
            }));

            logger.api('POST', '/api/portal/files/upload', { filesCount: processedFiles.length });
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
                    showErrorToast(`${error.file}: ${error.error}`);
                });
            }

            if (result.files && result.files.length > 0) {
                logger.lifecycle('Files uploaded', { count: result.files.length });
                showSuccessToast(`${result.files.length} souborů bylo úspěšně nahráno`);

                // Auto-select first uploaded file
                const uploadedFile = result.files[0];
                setSelectedFile(uploadedFile);
                setAltText(uploadedFile.fileName.replace(/\.[^/.]+$/, ''));

                // Switch to library tab to show uploaded files
                setActiveTab('library');
                loadLibraryFiles();
            }
        } catch (error) {
            logger.error('Upload error', error);
            showErrorToast('Chyba při nahrávání souborů');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Image compression helper
    const compressImage = async (file, maxWidth = 1920, quality = 0.85) => {
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
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.src = URL.createObjectURL(file);
        });
    };

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

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(err => {
                        logger.error('Video play error', err);
                    });
                }
            }, 100);
        } catch (error) {
            logger.error('Camera error', error);
            showErrorToast('Nepodařilo se spustit kameru. Zkontrolujte oprávnění.');
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

            canvas.toBlob((blob) => {
                if (blob) {
                    setCapturedPhotoBlob(blob);

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setCapturedPhotoDataURL(reader.result);
                    };
                    reader.readAsDataURL(blob);

                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                    }
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const retakePhoto = () => {
        setCapturedPhotoBlob(null);
        setCapturedPhotoDataURL(null);
        startCamera();
    };

    const confirmPhoto = async () => {
        if (capturedPhotoBlob) {
            const file = new File([capturedPhotoBlob], `camera-${Date.now()}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });

            await handleFileUpload([file]);
            stopCamera();
        }
    };

    const switchCamera = async () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: newFacingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            setStream(mediaStream);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(err => {
                        logger.error('Video play error', err);
                    });
                }
            }, 100);
        } catch (error) {
            logger.error('Camera switch error', error);
            showWarningToast('Zařízení nemá druhou kameru');
            setFacingMode(facingMode);
        }
    };

    // Drag & drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        handleFileUpload(files);
    };

    // Handle final selection
    const handleConfirmSelection = () => {
        if (!selectedFile) {
            showWarningToast('Vyberte prosím soubor');
            return;
        }

        if (!altText.trim()) {
            showWarningToast('Zadejte prosím alt text pro obrázek');
            return;
        }

        logger.lifecycle('File confirmed', { fileId: selectedFile.id, altText });
        onSelect(selectedFile, altText);
        handleClose();
    };

    // Handle modal close
    const handleClose = () => {
        setSelectedFile(null);
        setAltText('');
        setSearchQuery('');
        setTypeFilter('images');
        setActiveTab('library');
        stopCamera();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="media-picker-overlay">
            <div className="media-picker">
                {/* Header */}
                <div className="media-picker__header">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Vložit obrázek
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="media-picker__tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('library')}
                        className={`media-picker__tab ${activeTab === 'library' ? 'active' : ''}`}
                    >
                        <IconPhoto size={18} />
                        Knihovna médií
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('upload')}
                        className={`media-picker__tab ${activeTab === 'upload' ? 'active' : ''}`}
                    >
                        <IconUpload size={18} />
                        Nahrát nový
                    </button>
                </div>

                {/* Content */}
                <div className="media-picker__content">
                    {/* Library Tab */}
                    {activeTab === 'library' && (
                        <div className="media-picker__library">
                            {/* Filters */}
                            <div className="flex gap-3 mb-4">
                                <div className="flex-1 relative">
                                    <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Hledat soubory..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="images">Obrázky</option>
                                    <option value="all">Všechny typy</option>
                                    <option value="pdfs">PDF</option>
                                    <option value="documents">Dokumenty</option>
                                </select>
                            </div>

                            {/* Files grid */}
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader />
                                </div>
                            ) : libraryFiles.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    Žádné soubory nenalezeny
                                </div>
                            ) : (
                                <div className="media-picker__grid">
                                    {libraryFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            onClick={() => handleLibraryFileClick(file)}
                                            className={`media-picker__grid-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                                        >
                                            {file.fileType.startsWith('image/') ? (
                                                <img
                                                    src={file.thumbnailUrl || file.url}
                                                    alt={file.fileName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                                                    <IconPhoto size={48} className="text-gray-400" />
                                                </div>
                                            )}
                                            {selectedFile?.id === file.id && (
                                                <div className="media-picker__grid-item-check">
                                                    <IconCheck size={24} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div className="media-picker__upload">
                            {/* Camera Modal */}
                            {cameraOpen && (
                                <div className="media-picker__camera">
                                    {capturedPhotoBlob ? (
                                        // Preview captured photo
                                        <div className="flex flex-col items-center gap-4">
                                            <img
                                                src={capturedPhotoDataURL}
                                                alt="Captured"
                                                className="max-w-full max-h-96 rounded-lg"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={retakePhoto}
                                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                                >
                                                    Vyfotit znovu
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={confirmPhoto}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                    disabled={uploading}
                                                >
                                                    {uploading ? 'Nahrávám...' : 'Použít fotku'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Camera view
                                        <>
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                className="w-full rounded-lg"
                                            />
                                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    type="button"
                                                    onClick={switchCamera}
                                                    className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                                >
                                                    <IconCameraRotate size={24} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={capturePhoto}
                                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                >
                                                    <IconCamera size={24} className="inline mr-2" />
                                                    Vyfotit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={stopCamera}
                                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                                >
                                                    Zavřít
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Upload area */}
                            {!cameraOpen && (
                                <>
                                    <div
                                        className={`media-picker__dropzone ${isDragOver ? 'drag-over' : ''}`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <IconUpload size={48} className="text-gray-400 mb-4" />
                                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Přetáhněte soubory sem nebo klikněte pro výběr
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Maximální velikost: {maxSize}MB
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept={accept}
                                            multiple
                                            onChange={(e) => handleFileUpload(Array.from(e.target.files))}
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Camera button */}
                                    <button
                                        type="button"
                                        onClick={startCamera}
                                        className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
                                    >
                                        <IconCamera size={20} />
                                        Použít kameru
                                    </button>

                                    {uploading && (
                                        <div className="mt-4 text-center">
                                            <Loader />
                                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                                Nahrávám soubory...
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer - Preview & Alt text */}
                {selectedFile && (
                    <div className="media-picker__footer">
                        <div className="flex gap-4 items-start">
                            {/* Preview thumbnail */}
                            <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                {selectedFile.fileType.startsWith('image/') ? (
                                    <img
                                        src={selectedFile.thumbnailUrl || selectedFile.url}
                                        alt={selectedFile.fileName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <IconPhoto size={32} className="text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {/* File info & alt text */}
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                    {selectedFile.fileName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    {Math.round(selectedFile.fileSize / 1024)} KB
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Alt text (popis obrázku)
                                    </label>
                                    <input
                                        type="text"
                                        value={altText}
                                        onChange={(e) => setAltText(e.target.value)}
                                        placeholder="Popis obrázku pro nevidomé..."
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Zrušit
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmSelection}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Vložit obrázek
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
