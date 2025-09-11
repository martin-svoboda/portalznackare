/**
 * Utility funkce pro ImageEditor komponentu
 * Podle CLAUDE.md - separace business logiky od UI komponenty
 */

import { log } from './debug';

/**
 * Validuje crop oblast - musí být dostatečně velká
 */
export const validateCropArea = (cropArea) => {
    if (!cropArea || !cropArea.width || !cropArea.height) {
        log.error('ImageEditorUtils: Crop area is invalid', cropArea);
        return false;
    }
    
    // Minimální velikost crop oblasti
    const minSize = 10;
    if (cropArea.width < minSize || cropArea.height < minSize) {
        log.error('ImageEditorUtils: Crop area too small', { cropArea, minSize });
        return false;
    }
    
    return true;
};

/**
 * Přepočítává crop souřadnice z canvas náhledu na původní obrázek
 * Klíčová funkce pro správné crop výpočty bez závislosti na pixelech náhledu
 */
export const calculateCropCoordinates = (canvasCrop, imageScale, originalWidth, originalHeight) => {
    log.info('ImageEditorUtils: Calculating crop coordinates', { 
        canvasCrop, 
        imageScale, 
        originalWidth, 
        originalHeight 
    });

    // Přepočítat zpět na původní rozměry
    const originalCrop = {
        x: Math.round(canvasCrop.x / imageScale),
        y: Math.round(canvasCrop.y / imageScale),
        width: Math.round(canvasCrop.width / imageScale),
        height: Math.round(canvasCrop.height / imageScale)
    };

    // Zajistit, že crop nepřesáhne hranice původního obrázku
    originalCrop.x = Math.max(0, Math.min(originalCrop.x, originalWidth - 1));
    originalCrop.y = Math.max(0, Math.min(originalCrop.y, originalHeight - 1));
    originalCrop.width = Math.min(originalCrop.width, originalWidth - originalCrop.x);
    originalCrop.height = Math.min(originalCrop.height, originalHeight - originalCrop.y);

    log.info('ImageEditorUtils: Crop coordinates calculated', { 
        original: originalCrop,
        canvas: canvasCrop,
        scale: imageScale 
    });

    return originalCrop;
};

