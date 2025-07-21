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

class FileUploadService
{
    private string $uploadDir;
    private string $publicPath;
    private Imagine $imagine;

    public function __construct(
        private FileAttachmentRepository $repository,
        private SluggerInterface $slugger,
        private ParameterBagInterface $params,
        private UrlHelper $urlHelper
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
        // Calculate file hash for deduplication
        $hash = sha1_file($file->getPathname());
        
        // Check if file already exists
        $existingFile = $this->repository->findByHash($hash);
        if ($existingFile && !($options['force_new'] ?? false)) {
            return $existingFile;
        }

        // Generate unique filename
        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $this->slugger->slug($originalFilename);
        $extension = $file->guessExtension() ?? 'bin';
        
        // Use provided path or fallback to temp
        $relativePath = $storagePath ? $this->validateStoragePath($storagePath) : $this->generateTempPath();
        
        $uploadPath = $this->uploadDir . '/' . $relativePath;
        if (!is_dir($uploadPath)) {
            mkdir($uploadPath, 0755, true);
        }

        // Generate stored filename
        $storedName = sprintf('%s-%s.%s', $safeFilename, uniqid(), $extension);
        
        // Move uploaded file
        $file->move($uploadPath, $storedName);
        $fullPath = $uploadPath . '/' . $storedName;

        // Process image if needed
        $metadata = [];
        if ($this->isImage($file->getMimeType())) {
            $metadata = $this->processImage($fullPath, $options);
        }

        // Create database entry
        $attachment = new FileAttachment();
        $attachment->setHash($hash);
        $attachment->setOriginalName($file->getClientOriginalName());
        $attachment->setStoredName($storedName);
        $attachment->setMimeType($file->getMimeType() ?? 'application/octet-stream');
        $attachment->setSize($file->getSize());
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

        $this->repository->save($attachment, true);

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
     * Delete file and its thumbnails
     */
    public function deleteFile(FileAttachment $attachment, bool $force = false): void
    {
        // If not forcing and file was recently uploaded, soft delete instead
        if (!$force && !$attachment->isDeleted()) {
            $uploadedRecently = $attachment->getCreatedAt() > new \DateTimeImmutable('-5 minutes');
            if ($uploadedRecently) {
                $this->softDeleteFile($attachment);
                return;
            }
        }

        // Physical deletion
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
    public function addFileUsage(int $fileId, string $type, int $id, ?array $additionalData = null): ?FileAttachment
    {
        $file = $this->repository->find($fileId);
        if (!$file) {
            return null;
        }

        $file->addUsage($type, $id, $additionalData);
        $file->setIsTemporary(false); // Make permanent when used
        
        $this->repository->save($file, true);
        return $file;
    }

    /**
     * Remove usage tracking from a file
     */
    public function removeFileUsage(int $fileId, string $type, int $id): ?FileAttachment
    {
        $file = $this->repository->find($fileId);
        if (!$file) {
            return null;
        }

        $file->removeUsage($type, $id);
        
        // If no more usages, make temporary again
        if ($file->getUsageCount() === 0) {
            $file->setIsTemporary(true);
            $file->setExpiresAt(new \DateTimeImmutable('+24 hours'));
        }
        
        $this->repository->save($file, true);
        return $file;
    }
}