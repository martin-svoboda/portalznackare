<?php

namespace App\Service;

use App\Entity\FileAttachment;
use App\Repository\FileAttachmentRepository;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Imagine\Gd\Imagine;
use Imagine\Image\Box;
use Imagine\Image\ImageInterface;

/**
 * Služba pro zpracování obrázků - rotace, oříznutí, atd.
 */
class ImageProcessingService
{
    private string $uploadDir;

    public function __construct(
        private FileAttachmentRepository $repository,
        private ParameterBagInterface $params,
        private FileUploadService $fileUploadService
    ) {
        $this->uploadDir = $this->params->get('kernel.project_dir') . '/public/uploads';
    }

    /**
     * Zpracuje seznam operací na obrázku
     */
    public function processOperations(
        FileAttachment $file, 
        array $operations, 
        string $saveMode = 'overwrite',
        ?string $entityType = null,
        ?int $entityId = null,
        ?string $fieldName = null
    ): FileAttachment
    {
        $filePath = $this->uploadDir . '/' . $file->getPath();
        
        if (!file_exists($filePath)) {
            throw new \Exception("Soubor neexistuje: " . $filePath);
        }

        // Načíst obrázek na základě typu
        $image = $this->loadImage($filePath, $file->getMimeType());
        if (!$image) {
            throw new \Exception("Nepodařilo se načíst obrázek");
        }

        // Aplikovat operace postupně
        foreach ($operations as $operation) {
            $type = $operation['type'] ?? '';
            
            switch ($type) {
                case 'rotate':
                    $degrees = $operation['degrees'] ?? 0;
                    $image = $this->rotateImage($image, $degrees);
                    break;
                    
                case 'crop':
                    $x = $operation['x'] ?? 0;
                    $y = $operation['y'] ?? 0;
                    $width = $operation['width'] ?? imagesx($image);
                    $height = $operation['height'] ?? imagesy($image);
                    $image = $this->cropImage($image, $x, $y, $width, $height);
                    break;
                    
                default:
                    throw new \Exception("Neznámá operace: " . $type);
            }
        }

        // Uložit podle módu
        if ($saveMode === 'copy') {
            return $this->saveAsCopy($file, $image, $operations, $entityType, $entityId, $fieldName);
        } else {
            return $this->saveOverwrite($file, $image, $operations);
        }
    }

    /**
     * Načte obrázek podle MIME typu
     */
    private function loadImage(string $filePath, string $mimeType): ?\GdImage
    {
        return match ($mimeType) {
            'image/jpeg' => imagecreatefromjpeg($filePath),
            'image/png' => imagecreatefrompng($filePath),
            'image/webp' => imagecreatefromwebp($filePath),
            'image/gif' => imagecreatefromgif($filePath),
            default => null
        };
    }

    /**
     * Rotuje obrázek o zadané stupně
     */
    private function rotateImage(\GdImage $image, int $degrees): \GdImage
    {
        // Normalizovat úhel
        $degrees = $degrees % 360;
        if ($degrees < 0) {
            $degrees += 360;
        }

        if ($degrees === 0) {
            return $image;
        }

        // GD rotace je proti směru hodinových ručiček, takže invertujeme
        $rotated = imagerotate($image, -$degrees, 0);
        imagedestroy($image);
        
        return $rotated ?: $image;
    }

    /**
     * Ořízne obrázek
     */
    private function cropImage(\GdImage $image, int $x, int $y, int $width, int $height): \GdImage
    {
        $cropped = imagecrop($image, [
            'x' => $x,
            'y' => $y,
            'width' => $width,
            'height' => $height
        ]);

        imagedestroy($image);
        
        return $cropped ?: $image;
    }

    /**
     * Uloží obrázek jako kopii (nový soubor)
     */
    private function saveAsCopy(
        FileAttachment $originalFile, 
        \GdImage $image, 
        array $operations,
        ?string $entityType = null,
        ?int $entityId = null,
        ?string $fieldName = null
    ): FileAttachment
    {
        // Vytvořit nové jméno souboru
        $pathInfo = pathinfo($originalFile->getOriginalName());
        $baseName = $pathInfo['filename'];
        $extension = $pathInfo['extension'];
        $newName = $baseName . '_edited_' . time() . '.' . $extension;

        // Vytvořit nový soubor entity
        $newFile = new FileAttachment();
        $newFile->setOriginalName($newName);
        $newFile->setStoredName($this->generateStoredName($newName));
        $newFile->setMimeType($originalFile->getMimeType());
        $newFile->setIsPublic($originalFile->isPublic());
        $newFile->setUploadedBy($originalFile->getUploadedBy());

        // Použít stejnou storage path jako původní soubor (jen adresář, ne celý path)
        $originalPath = $originalFile->getPath(); // např. reports/2025/c/ta/52715/IMG-5094-13fe661a.jpg
        $storagePath = dirname($originalPath);    // např. reports/2025/c/ta/52715
        $newPath = $storagePath . '/' . $newFile->getStoredName();
        $newFile->setPath($newPath);
        $newFile->setStoragePath($storagePath);
        $newFile->setPublicUrl('/uploads/' . $newPath);

        // Uložit fyzický soubor
        $fullPath = $this->uploadDir . '/' . $newPath;
        $this->createDirectoryIfNotExists(dirname($fullPath));
        $this->saveImageToFile($image, $fullPath, $originalFile->getMimeType());

        // Spočítat velikost a hash
        $newFile->setSize(filesize($fullPath));
        $newFile->setHash(sha1_file($fullPath));

        // Základní metadata
        $metadata = [
            'edited' => true,
            'copy_of' => $originalFile->getId(),
            'operations' => $operations,
            'timestamp' => date('c')
        ];

        // Přidat rozměry obrázku
        $imageSize = getimagesize($fullPath);
        if ($imageSize) {
            $metadata['width'] = $imageSize[0];
            $metadata['height'] = $imageSize[1];
        }

        $newFile->setMetadata($metadata);
        $newFile->setIsTemporary(false);

        // Vygenerovat thumbnail pomocí FileUploadService
        try {
            // Použít reflection pro přístup k private metodě createThumbnail
            $reflection = new \ReflectionClass($this->fileUploadService);
            $method = $reflection->getMethod('createThumbnail');
            $method->setAccessible(true);
            
            // Načíst obrázek pomocí Imagine
            $imagine = new \Imagine\Gd\Imagine();
            $imageForThumbnail = $imagine->open($fullPath);
            
            $thumbnailPath = $method->invoke($this->fileUploadService, $fullPath, $imageForThumbnail);
            if ($thumbnailPath) {
                // Uložit relativní cestu k thumbnail
                $relativeThumbnailPath = str_replace($this->uploadDir . '/', '', $thumbnailPath);
                $newFile->setThumbnailPath($relativeThumbnailPath);
                
                // Přidat info o thumbnail do metadata
                $metadata = $newFile->getMetadata() ?? [];
                $metadata['thumbnail'] = basename($thumbnailPath);
                $newFile->setMetadata($metadata);
            }
        } catch (\Exception $e) {
            // Thumbnail není kritický, pokračujeme bez něj
            error_log("ImageProcessingService::saveAsCopy - Nepodařilo se vytvořit thumbnail: " . $e->getMessage());
        }

        // Uložit do databáze PŘED přesunem usage (potřebujeme ID)
        $this->repository->save($newFile, true);
        
        // Přesunout usage z původního na nový soubor
        if ($entityType && $entityId) {
            try {
                // Použít reflection pro přístup k private metodám
                $reflection = new \ReflectionClass($this->fileUploadService);
                
                // removeUsage
                $removeMethod = $reflection->getMethod('removeUsage');
                $removeMethod->setAccessible(true);
                $removeMethod->invoke($this->fileUploadService, $originalFile, $entityType, $entityId, $fieldName);
                
                // addUsage
                $addMethod = $reflection->getMethod('addUsage');
                $addMethod->setAccessible(true);
                $addMethod->invoke($this->fileUploadService, $newFile, $entityType, $entityId, $fieldName);
                
                // Uložit změny usage info
                $this->repository->save($originalFile, true);
                $this->repository->save($newFile, true);
            } catch (\Exception $e) {
                error_log("ImageProcessingService::saveAsCopy - Nepodařilo se přesunout usage: " . $e->getMessage());
            }
        }
        
        imagedestroy($image);
        
        return $newFile;
    }

    /**
     * Přepíše původní soubor
     */
    private function saveOverwrite(FileAttachment $file, \GdImage $image, array $operations): FileAttachment
    {
        $filePath = $this->uploadDir . '/' . $file->getPath();
        
        // Uložit editovaný obrázek
        $this->saveImageToFile($image, $filePath, $file->getMimeType());

        // Aktualizovat velikost (hash zůstává stejný pro deduplikaci)
        $file->setSize(filesize($filePath));

        // Aktualizovat metadata s informací o editaci
        $metadata = $file->getMetadata() ?? [];
        $metadata['edited'] = true;
        $metadata['edit_history'] = $metadata['edit_history'] ?? [];
        $metadata['edit_history'][] = [
            'operations' => $operations,
            'timestamp' => date('c')
        ];

        // Aktualizovat rozměry obrázku v metadata
        $imageSize = getimagesize($filePath);
        if ($imageSize) {
            $metadata['width'] = $imageSize[0];
            $metadata['height'] = $imageSize[1];
        }

        $file->setMetadata($metadata);

        // Regenerovat thumbnail pokud existuje
        if ($file->getThumbnailPath()) {
            $this->regenerateThumbnail($file);
        }

        // Uložit změny do databáze (thumbnail path zůstává stejný, jen se přepsal obsah)
        $this->repository->save($file, true);
        
        imagedestroy($image);
        
        return $file;
    }

    /**
     * Uloží GD obrázek do souboru podle MIME typu
     */
    private function saveImageToFile(\GdImage $image, string $filePath, string $mimeType): void
    {
        $success = match ($mimeType) {
            'image/jpeg' => imagejpeg($image, $filePath, 90),
            'image/png' => imagepng($image, $filePath),
            'image/webp' => imagewebp($image, $filePath, 90),
            'image/gif' => imagegif($image, $filePath),
            default => false
        };

        if (!$success) {
            throw new \Exception("Nepodařilo se uložit obrázek");
        }
    }

    /**
     * Regeneruje thumbnail pro upravený soubor
     */
    private function regenerateThumbnail(FileAttachment $file): void
    {
        try {
            $filePath = $this->uploadDir . '/' . $file->getPath();
            $existingThumbnailPath = $this->uploadDir . '/' . $file->getThumbnailPath();
            
            // Načíst obrázek pomocí Imagine
            $imagine = new \Imagine\Gd\Imagine();
            $imageForThumbnail = $imagine->open($filePath);
            
            // Vytvořit thumbnail přímo na místě existujícího
            $image = $imageForThumbnail->thumbnail(
                new Box(300, 300), 
                ImageInterface::THUMBNAIL_OUTBOUND
            );
            
            // Uložit thumbnail na stejnou cestu (přepsat)
            $image->save($existingThumbnailPath, ['quality' => 80]);
            
            // Aktualizovat pouze metadata info (path zůstává stejný)
            $metadata = $file->getMetadata() ?? [];
            $metadata['thumbnail'] = basename($existingThumbnailPath);
            $file->setMetadata($metadata);
            
        } catch (\Exception $e) {
            // Thumbnail není kritický, pokračujeme bez něj
            error_log("ImageProcessingService::regenerateThumbnail - Nepodařilo se regenerovat thumbnail: " . $e->getMessage());
        }
    }

    /**
     * Generuje uložené jméno souboru
     */
    private function generateStoredName(string $originalName): string
    {
        $pathInfo = pathinfo($originalName);
        $baseName = $pathInfo['filename'];
        $extension = $pathInfo['extension'] ?? '';
        $hash = substr(md5($originalName . time()), 0, 8);
        
        return $baseName . '-' . $hash . ($extension ? '.' . $extension : '');
    }

    /**
     * Generuje storage cestu podle roku/měsíce
     */
    private function generateStoragePath(): string
    {
        $now = new \DateTime();
        return 'reports/' . $now->format('Y/m');
    }

    /**
     * Vytvoří adresář pokud neexistuje
     */
    private function createDirectoryIfNotExists(string $path): void
    {
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
    }
}