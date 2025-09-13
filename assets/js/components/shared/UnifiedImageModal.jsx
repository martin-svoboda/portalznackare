import React, { useState, useRef, useEffect } from 'react';
import { IconRotateClockwise, IconCrop, IconX, IconCheck, IconLoader2, IconEdit, IconEye, IconTrash } from '@tabler/icons-react';
import { log } from '../../utils/debug';
import { showErrorToast, showSuccessToast } from '../../utils/notifications';
import { 
    calculateCropCoordinates, 
    validateCropArea
} from '../../utils/imageEditorUtils';

/**
 * Unifikovaný modal pro náhled a editaci obrázků
 * Podporuje dva režimy: 'preview' (pouze náhled) a 'edit' (editace s crop/rotace)
 */
const UnifiedImageModal = ({ 
    file, 
    isOpen, 
    onClose, 
    onSave,
    onDelete,
    mode: initialMode = 'preview', // 'preview' | 'edit'
    // Usage tracking props - stejné jako AdvancedFileUpload
    usageType = null,
    entityId = null,
    fieldName = null
}) => {
    const canvasRef = useRef(null);
    const [mode, setMode] = useState(initialMode);
    const [originalImage, setOriginalImage] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [cropArea, setCropArea] = useState(null);
    const [isCropping, setIsCropping] = useState(false);
    const [operations, setOperations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [imageScale, setImageScale] = useState(1);
    const [activeHandle, setActiveHandle] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [previewCrop, setPreviewCrop] = useState(null);
    const [isEditingCrop, setIsEditingCrop] = useState(false);

    // Načíst obrázek při otevření modalu
    useEffect(() => {
        if (isOpen && file) {
            log.info('UnifiedImageModal: Načítám obrázek', { fileName: file.fileName });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                setOriginalImage(img);
                log.info('UnifiedImageModal: Obrázek úspěšně načten', { 
                    width: img.width, 
                    height: img.height 
                });
            };
            img.onerror = () => {
                log.error('UnifiedImageModal: Nepodařilo se načíst obrázek', { src: file.url || file.preview });
            };
            img.src = file.url || file.preview;
        }
    }, [isOpen, file]);

    // Resetovat stav při změně módu
    useEffect(() => {
        if (mode === 'preview') {
            // Resetovat editační stav při přepnutí na preview
            setCropArea(null);
            setIsCropping(false);
            setIsEditingCrop(false);
            setPreviewCrop(null);
            setOperations([]);
            setRotation(0);
        }
    }, [mode]);

    // Automatické překreslení při změně klíčových stavů
    useEffect(() => {
        if (originalImage && mode === 'edit') {
            drawCanvas();
        }
    }, [originalImage, previewCrop, rotation, cropArea, isCropping, mode]);

    // Překreslení canvasu s aplikovanými změnami (pouze pro edit mód)
    const drawCanvas = (img = originalImage, currentRotation = rotation) => {
        if (!img || !canvasRef.current || mode !== 'edit') return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Pokud máme náhled ořezu, zobrazit jen oříznutou část
        if (previewCrop) {
            // Náhled ořezu obsahuje původní souřadnice v obrázku
            const { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight } = previewCrop;
            
            // Škálovat oříznutou část pro přizpůsobení modalu (s ohledem na rotaci)
            let canvasWidth = sourceWidth;
            let canvasHeight = sourceHeight;
            
            if (currentRotation === 90 || currentRotation === 270) {
                [canvasWidth, canvasHeight] = [canvasHeight, canvasWidth];
            }
            
            const maxWidth = 800;
            const maxHeight = 600;
            const scale = Math.min(1, maxWidth / canvasWidth, maxHeight / canvasHeight);
            
            canvas.width = canvasWidth * scale;
            canvas.height = canvasHeight * scale;
            
            // Vyčistit plátno
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Aplikovat rotaci i na oříznutou část
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((currentRotation * Math.PI) / 180);
            ctx.translate(-sourceWidth * scale / 2, -sourceHeight * scale / 2);
            
            // Nakreslit jen oříznutou část z původního obrázku
            ctx.drawImage(
                img, 
                sourceX, sourceY, sourceWidth, sourceHeight, // Source (co vykreslit z obrázku)
                0, 0, sourceWidth * scale, sourceHeight * scale // Destination (kam vykreslit na canvas)
            );
            
            ctx.restore();
            
            // Uložit nové škálování
            setImageScale(scale);
            return;
        }

        // Normální vykreslení celého obrázku
        let { width, height } = img;
        if (currentRotation === 90 || currentRotation === 270) {
            [width, height] = [height, width];
        }

        // Škálovat pro fit do modalu (max 800x600)
        const maxWidth = 800;
        const maxHeight = 600;
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        
        // Uložit škálování pro výpočty ořezu
        setImageScale(scale);
        
        canvas.width = width * scale;
        canvas.height = height * scale;

        // Vyčistit plátno
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Nastavit transformace pro rotaci
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((currentRotation * Math.PI) / 180);
        ctx.translate(-img.width * scale / 2, -img.height * scale / 2);

        // Nakreslit obrázek
        ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
        ctx.restore();

        // Nakreslit oblast ořezu pokud je aktivní
        if (cropArea && isCropping) {
            // Hlavní obdélník
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
            
            // Přidat tmavé překrytí mimo výběr
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // Horní část
            ctx.fillRect(0, 0, canvas.width, cropArea.y);
            // Dolní část
            ctx.fillRect(0, cropArea.y + cropArea.height, canvas.width, canvas.height - cropArea.y - cropArea.height);
            // Levá část
            ctx.fillRect(0, cropArea.y, cropArea.x, cropArea.height);
            // Pravá část
            ctx.fillRect(cropArea.x + cropArea.width, cropArea.y, canvas.width - cropArea.x - cropArea.width, cropArea.height);

            // Nakreslit manipulační body
            const handleSize = 8;
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;

            const handles = [
                { x: cropArea.x, y: cropArea.y }, // nw
                { x: cropArea.x + cropArea.width / 2, y: cropArea.y }, // n
                { x: cropArea.x + cropArea.width, y: cropArea.y }, // ne
                { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height / 2 }, // e
                { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height }, // se
                { x: cropArea.x + cropArea.width / 2, y: cropArea.y + cropArea.height }, // s
                { x: cropArea.x, y: cropArea.y + cropArea.height }, // sw
                { x: cropArea.x, y: cropArea.y + cropArea.height / 2 } // w
            ];

            handles.forEach(handle => {
                ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
                ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
            });

            // Zobrazit rozměry
            if (cropArea.width > 50 && cropArea.height > 30) {
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(cropArea.x, cropArea.y - 25, 100, 20);
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                const origWidth = Math.round(cropArea.width / imageScale);
                const origHeight = Math.round(cropArea.height / imageScale);
                ctx.fillText(`${origWidth} × ${origHeight} px`, cropArea.x + 5, cropArea.y - 10);
            }
        }
    };

    // Přepnutí mezi módy
    const switchToEditMode = () => {
        setMode('edit');
        log.info('UnifiedImageModal: Přepínám do editačního režimu');
    };

    const switchToPreviewMode = () => {
        setMode('preview');
        log.info('UnifiedImageModal: Přepínám do náhledového režimu');
    };

    // Rotace obrázku
    const handleRotate = (degrees) => {
        const newRotation = (rotation + degrees) % 360;
        setRotation(newRotation);
        
        log.info('UnifiedImageModal: Rotace aplikována', { degrees, newRotation });
        
        // Přidat operaci
        const rotateOp = { type: 'rotate', degrees };
        setOperations(prev => [...prev, rotateOp]);
    };

    // Aktivace crop módu nebo úprava existujícího crop
    const handleCropStart = () => {
        if (previewCrop && !isEditingCrop) {
            // Začít upravovat existující crop - zachovat referenci
            const savedPreviewCrop = previewCrop;
            setIsEditingCrop(true);
            setIsCropping(true);
            
            // Nejdřív vymazat preview, pak se canvas překreslí na celý obrázek
            setPreviewCrop(null);
            
            // Počkat na překreslení a pak nastavit crop area
            setTimeout(() => {
                if (!originalImage || !savedPreviewCrop) return;
                
                // Vypočítat aktuální scale pro celý obrázek
                let { width, height } = originalImage;
                if (rotation === 90 || rotation === 270) {
                    [width, height] = [height, width];
                }
                const maxWidth = 800;
                const maxHeight = 600;
                const currentScale = Math.min(1, maxWidth / width, maxHeight / height);
                
                // Převest původní crop na aktuální canvas souřadnice
                const canvasCrop = {
                    x: savedPreviewCrop.x * currentScale,
                    y: savedPreviewCrop.y * currentScale,
                    width: savedPreviewCrop.width * currentScale,
                    height: savedPreviewCrop.height * currentScale
                };
                
                log.info('UnifiedImageModal: Převádím ořez na souřadnice canvas', {
                    originalCrop: savedPreviewCrop,
                    currentScale,
                    canvasCrop
                });
                
                setCropArea(canvasCrop);
            }, 50);
        } else {
            // Nový crop
            setIsCropping(true);
            setIsEditingCrop(false);
            setCropArea(null);
        }
        setActiveHandle(null);
        setIsDragging(false);
    };

    // Získání handle pod kurzorem
    const getHandleAtPoint = (x, y) => {
        if (!cropArea || !isCropping) return null;
        
        const handleSize = 10;
        const handles = [
            { name: 'nw', x: cropArea.x, y: cropArea.y },
            { name: 'n', x: cropArea.x + cropArea.width / 2, y: cropArea.y },
            { name: 'ne', x: cropArea.x + cropArea.width, y: cropArea.y },
            { name: 'e', x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height / 2 },
            { name: 'se', x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height },
            { name: 's', x: cropArea.x + cropArea.width / 2, y: cropArea.y + cropArea.height },
            { name: 'sw', x: cropArea.x, y: cropArea.y + cropArea.height },
            { name: 'w', x: cropArea.x, y: cropArea.y + cropArea.height / 2 }
        ];

        for (const handle of handles) {
            if (Math.abs(x - handle.x) <= handleSize && Math.abs(y - handle.y) <= handleSize) {
                return handle.name;
            }
        }

        // Test zda je kurzor uvnitř crop oblasti pro drag
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            return 'drag';
        }

        return null;
    };

    // Změna kurzoru podle handle
    const getCursorForHandle = (handle) => {
        if (!handle) return 'crosshair';
        if (handle === 'drag') return 'move';
        return `${handle}-resize`;
    };

    // Univerzální handler pro mouse/touch down
    const handlePointerDown = (e) => {
        if (!isCropping || !originalImage || mode !== 'edit') return;
        
        e.preventDefault();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Sjednocení událostí myši a dotyku
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Pokud už máme crop oblast, zkontrolovat handles
        if (cropArea) {
            const handle = getHandleAtPoint(x, y);
            if (handle) {
                setActiveHandle(handle);
                if (handle === 'drag') {
                    setIsDragging(true);
                    setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
                } else {
                    setDragStart({ x, y, originalCrop: {...cropArea} });
                }
                return;
            }
        }

        // Začít nový výběr
        log.info('UnifiedImageModal: Začátek ořezu', { x, y, scale: imageScale });
        setCropArea({ x, y, width: 0, height: 0, startX: x, startY: y });
    };

    // Univerzální handler pro mouse/touch move
    const handlePointerMove = (e) => {
        if (!isCropping || !originalImage || mode !== 'edit') return;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Sjednocení událostí myši a dotyku
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Změna kurzoru pokud není aktivní operace
        if (!activeHandle && !isDragging && cropArea) {
            const handle = getHandleAtPoint(x, y);
            canvas.style.cursor = getCursorForHandle(handle);
        }

        // Drag celé oblasti
        if (isDragging && dragStart) {
            const newX = Math.max(0, Math.min(x - dragStart.x, canvas.width - cropArea.width));
            const newY = Math.max(0, Math.min(y - dragStart.y, canvas.height - cropArea.height));
            setCropArea({
                ...cropArea,
                x: newX,
                y: newY
            });
            return;
        }

        // Resize pomocí handle
        if (activeHandle && activeHandle !== 'drag' && dragStart) {
            const original = dragStart.originalCrop;
            let newCrop = {...original};

            // Logika pro každý handle
            switch(activeHandle) {
                case 'nw':
                    newCrop.width = original.x + original.width - x;
                    newCrop.height = original.y + original.height - y;
                    newCrop.x = x;
                    newCrop.y = y;
                    break;
                case 'n':
                    newCrop.height = original.y + original.height - y;
                    newCrop.y = y;
                    break;
                case 'ne':
                    newCrop.width = x - original.x;
                    newCrop.height = original.y + original.height - y;
                    newCrop.y = y;
                    break;
                case 'e':
                    newCrop.width = x - original.x;
                    break;
                case 'se':
                    newCrop.width = x - original.x;
                    newCrop.height = y - original.y;
                    break;
                case 's':
                    newCrop.height = y - original.y;
                    break;
                case 'sw':
                    newCrop.width = original.x + original.width - x;
                    newCrop.height = y - original.y;
                    newCrop.x = x;
                    break;
                case 'w':
                    newCrop.width = original.x + original.width - x;
                    newCrop.x = x;
                    break;
            }

            // Minimální velikost
            if (newCrop.width > 10 && newCrop.height > 10) {
                setCropArea(newCrop);
            }
            return;
        }

        // Nový výběr
        if (cropArea?.startX !== undefined) {
            const newCropArea = {
                ...cropArea,
                width: x - cropArea.startX,
                height: y - cropArea.startY
            };
            setCropArea(newCropArea);
        }
    };

    // Univerzální handler pro mouse/touch up
    const handlePointerUp = () => {
        if (!isCropping || !originalImage || mode !== 'edit') return;
        
        // Ukončit drag/resize
        setActiveHandle(null);
        setIsDragging(false);
        setDragStart(null);

        // Pokud máme validní crop oblast, normalizovat ji
        if (cropArea && cropArea.width && cropArea.height) {
            const canvasCrop = {
                x: Math.min(cropArea.x, cropArea.x + cropArea.width),
                y: Math.min(cropArea.y, cropArea.y + cropArea.height),
                width: Math.abs(cropArea.width),
                height: Math.abs(cropArea.height)
            };

            if (validateCropArea(canvasCrop)) {
                setCropArea(canvasCrop);
            } else {
                setCropArea(null);
            }
        }
    };

    // Aplikovat crop
    const applyCrop = () => {
        if (!cropArea || !originalImage) return;

        // Přepočítat na původní rozměry obrázku
        const originalCrop = calculateCropCoordinates(
            cropArea, 
            imageScale, 
            originalImage.width, 
            originalImage.height
        );

        log.info('UnifiedImageModal: Ořez aplikován', { canvasCrop: cropArea, originalCrop, scale: imageScale });

        const cropOp = { 
            type: 'crop',
            x: originalCrop.x,
            y: originalCrop.y,
            width: originalCrop.width,
            height: originalCrop.height
        };
        setOperations(prev => [...prev, cropOp]);
        
        // Vymazat crop oblast NEJDŘÍV
        setCropArea(null);
        setIsCropping(false);
        setIsEditingCrop(false);
        
        // PAK nastavit preview
        setPreviewCrop(originalCrop);
    };

    // Zjistit zda máme crop operace pro zobrazení tlačítka kopie
    const hasCropOperations = () => {
        return operations.some(op => op.type === 'crop');
    };

    // Uložení změn
    const handleSave = async (mode = 'overwrite') => {
        if (operations.length === 0) {
            log.info('UnifiedImageModal: Žádné operace k uložení');
            switchToPreviewMode();
            return;
        }
        
        // Ověřit, že máme file s ID
        if (!file || !file.id) {
            log.error('UnifiedImageModal: Chybí file nebo file.id', { file });
            showErrorToast('Nelze uložit - chybí informace o souboru');
            return;
        }

        // Pokud přeuložujeme soubor s crop operacemi, zobrazit varování
        if (mode === 'overwrite' && hasCropOperations()) {
            const confirmed = window.confirm(
                'Přeuložením původního obrázku dojde k jeho úpravě všude kde je použitý, včetně budoucího použití.\n\n' +
                'Opravdu chcete původní obrázek přeuložit?'
            );
            
            if (!confirmed) {
                return; // Uživatel zrušil akci
            }
        }

        setIsLoading(true);
        const requestData = {
            operations,
            saveMode: mode
        };
        
        // Přidat usage tracking parametry stejně jako při upload/delete
        if (usageType && entityId) {
            requestData.entity_type = usageType;
            requestData.entity_id = entityId;
            if (fieldName) {
                requestData.field_name = fieldName;
            }
        }
        
        log.api('PUT', `/api/portal/files/${file.id}/edit`, requestData);
        
        try {
            const response = await fetch(`/api/portal/files/${file.id}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            log.api('PUT', `/api/portal/files/${file.id}/edit`, result);

            if (result.success) {
                log.info('UnifiedImageModal: Úspěšně uloženo', result);
                showSuccessToast('Obrázek byl úspěšně upraven');
                onSave(result.file);
                handleClose();
            } else {
                throw new Error(result.error || 'Chyba při ukládání');
            }
        } catch (error) {
            log.error('UnifiedImageModal: Uložení selhalo', error);
            showErrorToast(error.message || 'Nepodařilo se uložit změny');
        } finally {
            setIsLoading(false);
        }
    };

    // Reset změn
    const handleReset = () => {
        log.info('UnifiedImageModal: Resetuji stav editoru');
        
        // Vymazat všechny stavy najednou
        setCropArea(null);
        setIsCropping(false);
        setIsEditingCrop(false);
        setPreviewCrop(null);
        setOperations([]);
        setRotation(0);
    };

    // Smazání souboru
    const handleDelete = () => {
        const confirmed = window.confirm(
            `Opravdu chcete smazat soubor "${file?.fileName}"?\n\n` +
            'Tato akce je nevratná.'
        );
        
        if (confirmed && onDelete) {
            log.info('UnifiedImageModal: Mazání souboru', { fileName: file?.fileName });
            onDelete(file);
            handleClose();
        }
    };

    // Uzavření modalu
    const handleClose = () => {
        // Reset všech stavů
        setCropArea(null);
        setIsCropping(false);
        setIsEditingCrop(false);
        setPreviewCrop(null);
        setOperations([]);
        setRotation(0);
        setMode(initialMode);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full mx-4 max-h-[95vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4">
                    <h3 className="text-lg mb-0">
                        {mode === 'preview' ? 'Náhled obrázku' : 'Editace obrázku'}: {file?.fileName}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <IconX size={24} />
                    </button>
                </div>

                {/* Content */}
                {mode === 'preview' ? (
                    // Preview mód - pouze zobrazení obrázku
                    <div className="p-4">
                        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                            {originalImage && (
                                <img
                                    src={file.url || file.preview}
                                    alt={file.fileName}
                                    className="max-w-full max-h-[600px] object-contain rounded"
                                />
                            )}
                        </div>
                        
                        {/* Footer pro preview */}
                        <div className="flex justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            {onDelete ? (
                                <button
                                    onClick={handleDelete}
                                    className="btn btn--danger"
                                >
                                    <IconTrash size={16} />
                                    Smazat
                                </button>
                            ) : (
                                <div></div>
                            )}
                            
                            <button
                                onClick={switchToEditMode}
                                className="btn btn--primary"
                            >
                                <IconEdit size={16} />
                                Upravit
                            </button>
                        </div>
                    </div>
                ) : (
                    // Edit mód - celá editační funkcionalita
                    <>
                        {/* Toolbar pro edit mód */}
                        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => handleRotate(90)}
                                className="btn btn--secondary"
                                disabled={isLoading}
                            >
                                <IconRotateClockwise size={16} />
                                Rotovat 90°
                            </button>

                            <button
                                onClick={handleCropStart}
                                className={`btn ${isCropping ? 'btn--primary' : 'btn--secondary'}`}
                                disabled={isLoading}
                            >
                                <IconCrop size={16} />
                                {isCropping 
                                    ? 'Vyberte oblast' 
                                    : (previewCrop ? 'Upravit ořez' : 'Oříznout')
                                }
                            </button>

                            {isCropping && cropArea && (
                                <button
                                    onClick={applyCrop}
                                    className="btn btn--success"
                                    disabled={isLoading}
                                >
                                    <IconCheck size={16} />
                                    Aplikovat ořez
                                </button>
                            )}

                            <button
                                onClick={handleReset}
                                className="btn btn--secondary"
                                disabled={isLoading}
                            >
                                Resetovat
                            </button>
                        </div>

                        {/* Canvas area pro edit mód */}
                        <div className="p-4 flex justify-center bg-gray-100 dark:bg-gray-900">
                            <canvas
                                ref={canvasRef}
                                className="border border-gray-300 dark:border-gray-600"
                                onMouseDown={handlePointerDown}
                                onMouseMove={handlePointerMove}
                                onMouseUp={handlePointerUp}
                                onMouseLeave={handlePointerUp}
                                onTouchStart={handlePointerDown}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerUp}
                                style={{ maxWidth: '100%', maxHeight: '600px', touchAction: 'none' }}
                            />
                        </div>

                        {/* Footer pro edit mód */}
                        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {operations.length > 0 && (
                                    <span>Operace: {operations.length}</span>
                                )}
                                {previewCrop && !isCropping && (
                                    <span className="text-green-600"> • Obrázek je oříznutý - klikněte "Upravit ořez" pro změnu</span>
                                )}
                                {isCropping && !cropArea && (
                                    <span className="text-blue-600"> • Táhněte myší nebo prstem pro výběr oblasti</span>
                                )}
                                {isCropping && cropArea && (
                                    <span className="text-green-600"> • Upravte výběr tažením za body nebo posuňte celý výběr</span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={switchToPreviewMode}
                                    className="btn btn--secondary"
                                    disabled={isLoading}
                                >
                                    <IconEye size={16} />
                                    Zrušit
                                </button>
                                
                                <button
                                    onClick={() => handleSave('overwrite')}
                                    className="btn btn--primary"
                                    disabled={isLoading || operations.length === 0}
                                >
                                    {isLoading ? (
                                        <IconLoader2 size={16} className="animate-spin" />
                                    ) : (
                                        <IconCheck size={16} />
                                    )}
                                    Uložit změny
                                </button>
                                
                                {hasCropOperations() && (
                                    <button
                                        onClick={() => handleSave('copy')}
                                        className="btn btn--secondary"
                                        disabled={isLoading}
                                    >
                                        <IconCheck size={16} />
                                        Uložit jako kopii
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UnifiedImageModal;