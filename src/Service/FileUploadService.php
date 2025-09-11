<?php

namespace App\Service;

use App\Entity\FileAttachment;
use App\Entity\User;
use App\Repository\FileAttachmentRepository;
use Imagine\Gd\Imagine;
use Imagine\Image\Box;
use Imagine\Image\ImageInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\UrlHelper;
use Symfony\Component\String\Slugger\SluggerInterface;
use Doctrine\ORM\EntityManagerInterface;

class FileUploadService
{
    private string $uploadDir;
    private string $publicPath;
    private Imagine $imagine;

    public function __construct(
        private FileAttachmentRepository $repository,
        private SluggerInterface $slugger,
        private ParameterBagInterface $params,
        private UrlHelper $urlHelper,
        private EntityManagerInterface $entityManager
    ) {
        $this->uploadDir = $params->get('kernel.project_dir') . '/public/uploads';
        $this->publicPath = '/uploads';
        $this->imagine = new Imagine();
    }

    /**
     * Upload file with deduplication and optional image processing
     */
    public function uploadFile(
        UploadedFile $file,
        ?User $user = null,
        ?string $storagePath = null,
        array $options = []
    ): FileAttachment {
        error_log("FileUploadService::uploadFile - Začátek pro soubor: " . $file->getClientOriginalName());
        error_log("FileUploadService::uploadFile - Storage path: " . ($storagePath ?: 'null'));
        error_log("FileUploadService::uploadFile - User: " . ($user ? $user->getJmeno() . ' ' . $user->getPrijmeni() : 'null'));
        // Získat všechny potřebné informace z UploadedFile PŘED jakýmikoliv operacemi
        $tempPath = $file->getPathname();
        $originalName = $file->getClientOriginalName();
        $fileSize = $file->getSize();
        $mimeType = $file->getMimeType() ?? 'application/octet-stream';
        
        error_log("FileUploadService::uploadFile - Temp file path: " . $tempPath);
        error_log("FileUploadService::uploadFile - Original name: " . $originalName);
        error_log("FileUploadService::uploadFile - Size: " . $fileSize);
        error_log("FileUploadService::uploadFile - MIME type: " . $mimeType);
        
        // Zkontrolovat, že temp soubor existuje
        if (!file_exists($tempPath)) {
            throw new \Exception("Temp soubor neexistuje: " . $tempPath);
        }
        
        // Spočítat hash pro deduplikaci
        $hash = sha1_file($tempPath);
        error_log("FileUploadService::uploadFile - File hash: " . $hash);
        
        // Check if file already exists (smart deduplication: hash + original name)
        $existingFile = $this->repository->findByHashAndOriginalName($hash, $originalName);
        if ($existingFile && !($options['force_new'] ?? false)) {
            error_log("FileUploadService::uploadFile - Soubor už existuje (hash + název), vracím existující");
            
            // Update usage_info if entity provided
            if (!empty($options['entity_type']) && !empty($options['entity_id'])) {
                $entityType = $options['entity_type'];
                $entityId = (int)$options['entity_id'];
                $fieldName = $options['field_name'] ?? null;
                
                // Check if file is already used in this specific field (backend duplicate protection)
                if ($fieldName && $this->isUsedInField($existingFile, $entityType, $entityId, $fieldName)) {
                    throw new \Exception("Soubor již existuje v tomto poli");
                }
                
                $this->addUsage($existingFile, $entityType, $entityId, $fieldName);
                $this->repository->save($existingFile, true);
            }
            
            return $existingFile;
        }

        // Generate unique filename
        $originalFilename = pathinfo($originalName, PATHINFO_FILENAME);
        $safeFilename = $this->slugger->slug($originalFilename);
        $extension = $file->guessExtension() ?? 'bin';
        error_log("FileUploadService::uploadFile - Safe filename: " . $safeFilename . '.' . $extension);
        
        // Use provided path or fallback to temp
        $relativePath = $storagePath ? $this->validateStoragePath($storagePath) : $this->generateTempPath();
        error_log("FileUploadService::uploadFile - Relative path: " . $relativePath);
        
        $uploadPath = $this->uploadDir . '/' . $relativePath;
        error_log("FileUploadService::uploadFile - Upload path: " . $uploadPath);
        
        if (!is_dir($uploadPath)) {
            error_log("FileUploadService::uploadFile - Vytvářím adresář: " . $uploadPath);
            $mkdirResult = mkdir($uploadPath, 0755, true);
            if (!$mkdirResult) {
                $lastError = error_get_last();
                throw new \Exception("Nepodařilo se vytvořit adresář $uploadPath: " . ($lastError['message'] ?? 'Neznámá chyba'));
            }
            error_log("FileUploadService::uploadFile - Adresář vytvořen úspěšně");
        } else {
            error_log("FileUploadService::uploadFile - Adresář už existuje");
        }

        // Generate deterministic filename using hash prefix
        $hashPrefix = substr($hash, 0, 8);
        $storedName = sprintf('%s-%s.%s', $safeFilename, $hashPrefix, $extension);
        error_log("FileUploadService::uploadFile - Stored name: " . $storedName);
        
        // Move uploaded file
        error_log("FileUploadService::uploadFile - Přesouvám soubor do: " . $uploadPath . '/' . $storedName);
        error_log("FileUploadService::uploadFile - Temp file exists before move: " . (file_exists($file->getPathname()) ? 'YES' : 'NO'));
        error_log("FileUploadService::uploadFile - Target directory writable: " . (is_writable($uploadPath) ? 'YES' : 'NO'));
        
        try {
            // Check again if temp file exists
            if (!file_exists($file->getPathname())) {
                throw new \Exception("Temp soubor zmizel před přesunem: " . $file->getPathname());
            }
            
            $file->move($uploadPath, $storedName);
            error_log("FileUploadService::uploadFile - Soubor přesunut úspěšně");
        } catch (\Exception $e) {
            error_log("FileUploadService::uploadFile - Chyba při přesunu souboru: " . $e->getMessage());
            error_log("FileUploadService::uploadFile - Error trace: " . $e->getTraceAsString());
            throw new \Exception("Nepodařilo se přesunout soubor: " . $e->getMessage());
        }
        
        $fullPath = $uploadPath . '/' . $storedName;
        error_log("FileUploadService::uploadFile - Full path: " . $fullPath);

        // Process image if needed
        $metadata = [];
        if ($this->isImage($mimeType)) {
            $metadata = $this->processImage($fullPath, $options);
        }

        // Create database entry
        $attachment = new FileAttachment();
        $attachment->setHash($hash);
        $attachment->setOriginalName($originalName);
        $attachment->setStoredName($storedName);
        $attachment->setMimeType($mimeType);
        $attachment->setSize($fileSize);
        $fullRelativePath = $relativePath . '/' . $storedName;
        $attachment->setPath($fullRelativePath);
        $attachment->setStoragePath($relativePath);
        
        // Determine if file is public based on options or path
        $isPublic = $options['is_public'] ?? $this->isPathPublic($relativePath);
        
        // Generate public URL - with or without security token
        if ($isPublic) {
            // Public files - no hash token needed
            $publicUrl = sprintf('%s/%s/%s', $this->publicPath, $relativePath, $storedName);
        } else {
            // Protected files - include security token
            $securityToken = substr(sha1($hash . $relativePath), 0, 16);
            $publicUrl = sprintf('%s/%s/%s/%s', $this->publicPath, $relativePath, $securityToken, $storedName);
        }
        $attachment->setPublicUrl($publicUrl);
        $attachment->setIsPublic($isPublic);

        if ($user) {
            $attachment->setUploadedBy($user->getIntAdr());
        }

        if ($storagePath) {
            $attachment->setIsTemporary(false);
        } else {
            // Temporary files expire after 24 hours
            $attachment->setExpiresAt(new \DateTimeImmutable('+24 hours'));
        }

        $attachment->setMetadata($metadata);

        // Set thumbnail_path if thumbnail was created
        if (!empty($metadata['thumbnail'])) {
            $thumbnailPath = $relativePath . '/' . $metadata['thumbnail'];
            $attachment->setThumbnailPath($thumbnailPath);
        }

        // Set initial usage_info if entity provided
        if (!empty($options['entity_type']) && !empty($options['entity_id'])) {
            $entityType = $options['entity_type'];
            $entityId = (int)$options['entity_id'];
            $fieldName = $options['field_name'] ?? null;
            
            $uploadDebug = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'uploadFile',
                'action' => 'adding_usage',
                'params' => ['entityType' => $entityType, 'entityId' => $entityId, 'fieldName' => $fieldName]
            ];
            file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($uploadDebug) . "\n", FILE_APPEND);
            
            $this->addUsage($attachment, $entityType, $entityId, $fieldName);
            
            $uploadDebug2 = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'uploadFile', 
                'action' => 'usage_added',
                'final_usage_info' => $attachment->getUsageInfo()
            ];
            file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($uploadDebug2) . "\n", FILE_APPEND);
        } else {
            $uploadDebug = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'uploadFile',
                'action' => 'no_usage_tracking',
                'reason' => 'missing entity_type or entity_id',
                'options' => [
                    'entity_type' => $options['entity_type'] ?? null,
                    'entity_id' => $options['entity_id'] ?? null,
                    'field_name' => $options['field_name'] ?? null
                ]
            ];
            file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($uploadDebug) . "\n", FILE_APPEND);
        }

        try {
            $saveDebug = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'uploadFile',
                'action' => 'before_save',
                'usage_info_before_save' => $attachment->getUsageInfo(),
                'attachment_data' => [
                    'hash' => $attachment->getHash(),
                    'original_name' => $attachment->getOriginalName(),
                    'stored_name' => $attachment->getStoredName(),
                    'path' => $attachment->getPath(),
                    'storage_path' => $attachment->getStoragePath(),
                    'size' => $attachment->getSize(),
                    'mime_type' => $attachment->getMimeType(),
                    'uploaded_by' => $attachment->getUploadedBy()
                ]
            ];
            file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($saveDebug) . "\n", FILE_APPEND);
            
            $this->repository->save($attachment, true);
            
            $savedId = $attachment->getId();
            
            $saveDebug2 = [
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => 'uploadFile',
                'action' => 'after_save',
                'saved_id' => $savedId,
                'usage_info_after_save' => $attachment->getUsageInfo()
            ];
            file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($saveDebug2) . "\n", FILE_APPEND);
            error_log("FileUploadService::uploadFile - Úspěšně uloženo s ID: " . ($savedId ?: 'NULL'));
            
            if (!$savedId) {
                throw new \Exception("Entity byla uložena, ale nemá ID - možná problém s auto-increment");
            }
            
        } catch (\Exception $e) {
            error_log("FileUploadService::uploadFile - Chyba při ukládání do databáze: " . $e->getMessage());
            error_log("FileUploadService::uploadFile - Exception class: " . get_class($e));
            error_log("FileUploadService::uploadFile - Stack trace: " . $e->getTraceAsString());
            // Smazat fyzický soubor při chybě databáze
            if (file_exists($fullPath)) {
                error_log("FileUploadService::uploadFile - Mažu fyzický soubor kvůli chybě databáze");
                unlink($fullPath);
            }
            throw new \Exception("Nepodařilo se uložit do databáze: " . $e->getMessage());
        }

        error_log("FileUploadService::uploadFile - Hotovo pro soubor: " . $attachment->getOriginalName());
        return $attachment;
    }

    /**
     * Process uploaded image
     */
    private function processImage(string $filePath, array $options): array
    {
        $metadata = [];
        
        try {
            $image = $this->imagine->open($filePath);
            $size = $image->getSize();
            
            $metadata['width'] = $size->getWidth();
            $metadata['height'] = $size->getHeight();
            
            // Auto-rotate based on EXIF data
            if (function_exists('exif_read_data')) {
                $exif = @exif_read_data($filePath);
                if ($exif && isset($exif['Orientation'])) {
                    $metadata['original_orientation'] = $exif['Orientation'];
                    $image = $this->autoRotateImage($image, $exif['Orientation']);
                    $image->save($filePath);
                }
            }

            // Create thumbnail if requested
            if ($options['create_thumbnail'] ?? true) {
                $thumbnailPath = $this->createThumbnail($filePath, $image);
                if ($thumbnailPath) {
                    $metadata['thumbnail'] = basename($thumbnailPath);
                }
            }

            // Optimize large images
            if ($options['optimize'] ?? true) {
                if ($size->getWidth() > 1920 || $size->getHeight() > 1920) {
                    $image->thumbnail(new Box(1920, 1920), ImageInterface::THUMBNAIL_INSET)
                        ->save($filePath, ['quality' => 85]);
                    $metadata['optimized'] = true;
                }
            }

        } catch (\Exception $e) {
            $metadata['processing_error'] = $e->getMessage();
        }

        return $metadata;
    }

    /**
     * Auto-rotate image based on EXIF orientation
     */
    private function autoRotateImage(ImageInterface $image, int $orientation): ImageInterface
    {
        switch ($orientation) {
            case 3: // 180 degrees
                return $image->rotate(180);
            case 6: // 90 degrees CW
                return $image->rotate(-90);
            case 8: // 90 degrees CCW
                return $image->rotate(90);
            default:
                return $image;
        }
    }

    /**
     * Create thumbnail
     */
    private function createThumbnail(string $originalPath, ImageInterface $image): ?string
    {
        try {
            $pathInfo = pathinfo($originalPath);
            $thumbnailPath = $pathInfo['dirname'] . '/thumb_' . $pathInfo['basename'];
            
            $image->thumbnail(new Box(300, 300), ImageInterface::THUMBNAIL_OUTBOUND)
                ->save($thumbnailPath, ['quality' => 80]);
                
            return $thumbnailPath;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Check if file is image
     */
    private function isImage(string $mimeType): bool
    {
        return str_starts_with($mimeType, 'image/');
    }

    /**
     * Generate temporary path for uploaded files
     */
    private function generateTempPath(): string
    {
        $date = new \DateTimeImmutable();
        return sprintf('temp/%s/%s', $date->format('Y/m'), uniqid());
    }

    /**
     * Generate storage path based on report context with KKZ and area
     */
    public function generateReportPath(int $year, string $kkz, string $obvod, int $reportId): string
    {
        // Validate and sanitize inputs
        $validYear = $this->validateYear($year);
        $sanitizedKkz = $this->sanitizePathComponent($kkz, 'unknown');
        $sanitizedObvod = $this->sanitizePathComponent($obvod, 'unknown');
        $validReportId = max(1, $reportId); // Ensure positive ID
        
        return sprintf('reports/%d/%s/%s/%d', $validYear, $sanitizedKkz, $sanitizedObvod, $validReportId);
    }

    /**
     * Validate year is within reasonable bounds
     */
    private function validateYear(int $year): int
    {
        $currentYear = (int) date('Y');
        $minYear = 2020;
        $maxYear = $currentYear + 5;
        
        return ($year >= $minYear && $year <= $maxYear) ? $year : $currentYear;
    }

    /**
     * Sanitize path component - remove dangerous characters, ensure non-empty
     */
    private function sanitizePathComponent(string $input, string $fallback = 'unknown'): string
    {
        // Remove dangerous characters and trim
        $sanitized = preg_replace('/[^a-zA-Z0-9\-_]/', '', trim($input));
        
        // Ensure not empty and not too long
        if (empty($sanitized) || strlen($sanitized) > 50) {
            return $fallback;
        }
        
        return strtolower($sanitized);
    }

    /**
     * Generate storage path for user files
     */
    public function generateUserPath(int $userId): string
    {
        $validUserId = max(1, $userId); // Ensure positive ID
        return sprintf('users/%d', $validUserId);
    }

    /**
     * Generate generic storage path
     */
    public function generateGenericPath(string $type, string $subPath = ''): string
    {
        $sanitizedType = $this->sanitizePathComponent($type, 'misc');
        
        if ($subPath) {
            $sanitizedSubPath = $this->sanitizePathComponent($subPath, 'unknown');
            return sprintf('%s/%s', $sanitizedType, $sanitizedSubPath);
        }
        
        return $sanitizedType;
    }

    /**
     * Generate public storage path for methodologies
     */
    public function generateMethodologyPath(string $category = 'general'): string
    {
        $sanitizedCategory = $this->sanitizePathComponent($category, 'general');
        return sprintf('methodologies/%s', $sanitizedCategory);
    }

    /**
     * Generate public storage path for downloads
     */
    public function generateDownloadPath(string $category = 'general'): string
    {
        $sanitizedCategory = $this->sanitizePathComponent($category, 'general');
        return sprintf('downloads/%s', $sanitizedCategory);
    }

    /**
     * Generate public storage path for gallery
     */
    public function generateGalleryPath(string $album = 'general'): string
    {
        $sanitizedAlbum = $this->sanitizePathComponent($album, 'general');
        return sprintf('gallery/%s', $sanitizedAlbum);
    }

    /**
     * Check if storage path indicates public file
     */
    private function isPathPublic(string $path): bool
    {
        $publicPaths = [
            'public/',
            'methodologies/',
            'downloads/',
            'gallery/',
            'documentation/'
        ];
        
        foreach ($publicPaths as $publicPath) {
            if (str_starts_with($path, $publicPath)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Validate storage path before use
     */
    public function validateStoragePath(string $path): string
    {
        // Remove leading/trailing slashes
        $path = trim($path, '/');
        
        // Split into components and validate each
        $components = explode('/', $path);
        $validatedComponents = [];
        
        foreach ($components as $component) {
            $sanitized = $this->sanitizePathComponent($component, 'unknown');
            $validatedComponents[] = $sanitized;
        }
        
        // Ensure minimum path structure
        if (count($validatedComponents) < 2) {
            return 'misc/unknown';
        }
        
        return implode('/', $validatedComponents);
    }

    /**
     * Soft delete file (with grace period)
     */
    public function softDeleteFile(FileAttachment $attachment): void
    {
        $attachment->softDelete();
        $this->repository->save($attachment, true);
    }

    /**
     * Delete file with intelligent soft/hard delete logic
     */
    public function deleteFile(FileAttachment $attachment, bool $force = false): void
    {
        // Check if file was uploaded recently (5 minutes grace period)
        $uploadedRecently = $attachment->getCreatedAt() > new \DateTimeImmutable('-5 minutes');

        // Deletion strategy:
        // - force = true (editable form) → hard delete immediately 
        // - force = false (readonly form) → no deletion (handled by UI)
        // - New files (<5min) → hard delete (can be mistake)
        // - Old files (>5min) → soft delete (grace period)
        $shouldHardDelete = false;
        
        if ($force) {
            // Force delete from editable form (draft/rejected status)
            $shouldHardDelete = true;
        } elseif ($uploadedRecently) {
            // New files = hard delete (likely user mistake)
            $shouldHardDelete = true;
        }

        if ($shouldHardDelete) {
            // Physical deletion
            $this->physicallyDeleteFile($attachment);
        } else {
            // Soft delete with grace period
            $this->softDeleteFile($attachment);
        }
    }

    /**
     * Physically delete file from disk and database
     */
    public function physicallyDeleteFile(FileAttachment $attachment): void
    {
        $fullPath = $this->uploadDir . '/' . $attachment->getPath();
        
        // Delete main file
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }

        // Delete thumbnail if exists
        if ($attachment->getMetadata() && isset($attachment->getMetadata()['thumbnail'])) {
            $thumbPath = dirname($fullPath) . '/' . $attachment->getMetadata()['thumbnail'];
            if (file_exists($thumbPath)) {
                unlink($thumbPath);
            }
        }

        // Mark as physically deleted or remove from database
        if (!$attachment->isTemporary() && $attachment->getUsageCount() > 0) {
            // Keep record for files that are used in content
            $attachment->setPhysicallyDeleted(true);
            $this->repository->save($attachment, true);
        } else {
            // Remove temporary files completely
            $this->repository->remove($attachment, true);
        }
    }

    /**
     * Clean up expired temporary files and soft-deleted files past grace period
     */
    public function cleanupFiles(): int
    {
        $deleted = 0;
        
        // Clean expired temporary files
        $expiredFiles = $this->repository->findExpiredTemporaryFiles();
        $orphanedFiles = $this->repository->findOrphanedTemporaryFiles();
        
        foreach (array_merge($expiredFiles, $orphanedFiles) as $file) {
            $this->deleteFile($file, true);
            $deleted++;
        }
        
        // Clean soft-deleted files past grace period
        $softDeletedFiles = $this->repository->findSoftDeletedPastGracePeriod();
        foreach ($softDeletedFiles as $file) {
            if (!$file->isPhysicallyDeleted()) {
                $this->deleteFile($file, true);
                $deleted++;
            }
        }

        return $deleted;
    }

    /**
     * Get file by ID with security check
     */
    public function getFile(int $id, ?User $user = null): ?FileAttachment
    {
        $file = $this->repository->find($id);
        
        if (!$file) {
            return null;
        }

        // Add security checks here if needed
        // For example, check if user has access to the context
        
        return $file;
    }

    /**
     * Add usage tracking to a file
     */
    public function addFileUsage(int $fileId, string $type, int $id, ?array $additionalData = null, ?string $fieldName = null): ?FileAttachment
    {
        $file = $this->repository->find($fileId);
        if (!$file) {
            return null;
        }

        // Use new field-specific usage tracking
        $this->addUsage($file, $type, $id, $fieldName);
        $file->setIsTemporary(false); // Make permanent when used
        
        $this->repository->save($file, true);
        return $file;
    }

    /**
     * Remove usage tracking from a file
     */
    public function removeFileUsage(int $fileId, string $entityType, int $entityId, ?string $fieldName = null): ?FileAttachment
    {
        $file = $this->repository->find($fileId);
        if (!$file) {
            return null;
        }

        // Remove usage using field-specific or legacy format
        $this->removeUsage($file, $entityType, $entityId, $fieldName);
        
        $this->repository->save($file, true);
        return $file;
    }

    /**
     * Remove usage from file using new simplified format {"reports": [123, 456]}
     */
    private function removeUsage(FileAttachment $attachment, string $entityType, int $entityId, ?string $fieldName = null): void
    {
        $usageInfo = $attachment->getUsageInfo() ?? [];
        
        if (!isset($usageInfo[$entityType])) {
            return;
        }
        
        if ($fieldName) {
            // Field-specific usage removal: {"reports": {"123": ["Prilohy_NP", "Prilohy_TIM"]}}
            if (isset($usageInfo[$entityType][$entityId])) {
                $usageInfo[$entityType][$entityId] = array_values(
                    array_filter($usageInfo[$entityType][$entityId], fn($field) => $field !== $fieldName)
                );
                
                // If no fields left for this entity, remove entity
                if (empty($usageInfo[$entityType][$entityId])) {
                    unset($usageInfo[$entityType][$entityId]);
                }
                
                // If no entities left for this type, remove type
                if (empty($usageInfo[$entityType])) {
                    unset($usageInfo[$entityType]);
                }
            }
        } else {
            // Legacy usage removal: {"reports": [123, 456]}
            $usageInfo[$entityType] = array_values(
                array_filter($usageInfo[$entityType], fn($id) => $id !== $entityId)
            );
            
            // If array is empty, remove the entity type
            if (empty($usageInfo[$entityType])) {
                unset($usageInfo[$entityType]);
            }
        }
        
        $attachment->setUsageInfo($usageInfo);
    }

    /**
     * Check if file should be auto force deleted (1 hour grace period + single usage)
     */
    public function shouldAutoForceDelete(FileAttachment $file): bool
    {
        // Check if file was uploaded recently (1 hour grace period)
        $uploadedRecently = $file->getCreatedAt() > new \DateTimeImmutable('-1 hour');
        
        return $uploadedRecently;
    }

    /**
     * Check if physical file exists on filesystem
     */
    public function physicalFileExists(FileAttachment $file): bool
    {
        $fullPath = $this->uploadDir . '/' . $file->getPath();
        return file_exists($fullPath);
    }

    /**
     * Remove orphaned file record from database
     */
    public function removeFromDatabase(FileAttachment $file): void
    {
        $this->entityManager->remove($file);
        $this->entityManager->flush();
    }

    /**
     * Clean up orphaned reference from entity (when file doesn't exist in DB)
     */
    public function cleanupOrphanedReference(int $fileId, string $entityType, int $entityId): bool
    {
        if ($entityType === 'reports') {
            return $this->cleanupReportFileReference($fileId, $entityId);
        }
        
        // Add other entity types here when needed
        // if ($entityType === 'pages') { ... }
        
        return false;
    }

    /**
     * Clean up all entity references when file is being completely deleted
     */
    public function cleanupAllEntityReferences(FileAttachment $file): void
    {
        $usageInfo = $file->getUsageInfo() ?? [];
        
        foreach ($usageInfo as $entityType => $entityIds) {
            foreach ($entityIds as $entityId) {
                $this->cleanupOrphanedReference($file->getId(), $entityType, $entityId);
            }
        }
    }

    /**
     * Remove file reference from report data
     */
    private function cleanupReportFileReference(int $fileId, int $reportId): bool
    {
        try {
            // Find report in database
            $report = $this->entityManager->getRepository(\App\Entity\Report::class)->find($reportId);
            if (!$report) {
                return false;
            }

            // Clean up file references from report data (data_a, data_b)
            $dataA = $report->getDataA() ?? [];
            $dataB = $report->getDataB() ?? [];
            
            $cleaned = false;
            
            // Remove file ID from all attachment arrays in data_a and data_b
            $dataA = $this->removeFileIdFromData($dataA, $fileId, $cleaned);
            $dataB = $this->removeFileIdFromData($dataB, $fileId, $cleaned);
            
            if ($cleaned) {
                $report->setDataA($dataA);
                $report->setDataB($dataB);
                $this->entityManager->flush();
                return true;
            }
            
            return false;
        } catch (\Exception $e) {
            error_log("Failed to cleanup report file reference: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Recursively remove file ID from nested data structure
     */
    private function removeFileIdFromData(array $data, int $fileId, bool &$cleaned): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                if ($key === 'Prilohy' || str_ends_with($key, '_Prilohy')) {
                    // This is an attachments array - remove our file ID
                    if (isset($value[$fileId])) {
                        unset($value[$fileId]);
                        $cleaned = true;
                    }
                    $data[$key] = $value;
                } else {
                    // Recursive search in nested arrays
                    $data[$key] = $this->removeFileIdFromData($value, $fileId, $cleaned);
                }
            }
        }
        
        return $data;
    }

    /**
     * Clean up orphaned file references when file is deleted from admin
     * This method should be called before physically deleting a file
     * to notify all systems that reference the file
     */
    
    /**
     * Get files that may have orphaned references
     * This helps identify files that were deleted but may still be referenced
     */
    public function findPotentialOrphanedReferences(): array
    {
        // Find files that are marked as deleted or physically deleted
        // but have usage info that suggests they may be referenced elsewhere
        $deletedFiles = $this->repository->createQueryBuilder('f')
            ->where('f.deletedAt IS NOT NULL OR f.physicallyDeleted = true')
            ->andWhere('f.usageInfo IS NOT NULL')
            ->getQuery()
            ->getResult();
        
        $orphanedReferences = [];
        
        foreach ($deletedFiles as $file) {
            if ($file->getUsageInfo() && count($file->getUsageInfo()) > 0) {
                $orphanedReferences[] = [
                    'fileId' => $file->getId(),
                    'fileName' => $file->getOriginalName(),
                    'deletedAt' => $file->getDeletedAt()?->format('Y-m-d H:i:s'),
                    'physicallyDeleted' => $file->isPhysicallyDeleted(),
                    'usages' => $file->getUsageInfo()
                ];
            }
        }
        
        return $orphanedReferences;
    }

    /**
     * Add entity usage to usage_info (universal for any entity type)
     */
    private function addUsage(FileAttachment $attachment, string $entityType, int $entityId, ?string $fieldName = null): void
    {
        $debugData = [];
        $debugData['timestamp'] = date('Y-m-d H:i:s');
        $debugData['method'] = 'addUsage';
        $debugData['input'] = ['entityType' => $entityType, 'entityId' => $entityId, 'fieldName' => $fieldName];
        
        $usageInfo = $attachment->getUsageInfo() ?? [];
        $debugData['current_usage_info'] = $usageInfo;
        
        // Initialize entity type array if doesn't exist
        if (!isset($usageInfo[$entityType])) {
            $usageInfo[$entityType] = [];
        }
        
        if ($fieldName) {
            // Field-specific usage tracking: {"reports": {"123": ["Prilohy_NP", "Prilohy_TIM"]}}
            if (!isset($usageInfo[$entityType][$entityId])) {
                $usageInfo[$entityType][$entityId] = [];
            }
            
            // Add field name if not already present
            if (!in_array($fieldName, $usageInfo[$entityType][$entityId])) {
                $usageInfo[$entityType][$entityId][] = $fieldName;
                $debugData['action'] = "Added fieldName '$fieldName' to entityId $entityId";
            } else {
                $debugData['action'] = "FieldName '$fieldName' already exists for entityId $entityId";
            }
        } else {
            // Legacy usage tracking: {"reports": [123, 456]} (BC compatibility)
            if (!in_array($entityId, $usageInfo[$entityType])) {
                $usageInfo[$entityType][] = $entityId;
                $debugData['action'] = "Added entityId $entityId (legacy format)";
            } else {
                $debugData['action'] = "EntityId $entityId already exists (legacy format)";
            }
        }
        
        $debugData['new_usage_info'] = $usageInfo;
        $attachment->setUsageInfo($usageInfo);
        
        file_put_contents($this->params->get('kernel.project_dir') . '/var/debug-file-usage.txt', json_encode($debugData) . "\n", FILE_APPEND);
    }
    
    /**
     * Check if file is already used in specific field of entity
     */
    private function isUsedInField(FileAttachment $attachment, string $entityType, int $entityId, ?string $fieldName = null): bool
    {
        $usageInfo = $attachment->getUsageInfo() ?? [];
        
        if (!isset($usageInfo[$entityType])) {
            return false;
        }
        
        if ($fieldName) {
            // Check field-specific usage: {"reports": {"123": ["Prilohy_NP"]}}
            return isset($usageInfo[$entityType][$entityId]) && 
                   in_array($fieldName, $usageInfo[$entityType][$entityId]);
        } else {
            // Check legacy usage: {"reports": [123, 456]}
            return in_array($entityId, $usageInfo[$entityType]);
        }
    }
}