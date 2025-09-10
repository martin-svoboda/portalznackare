<?php

namespace App\Service;

use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Service pro získání dat příloh podle ID
 */
class AttachmentLookupService
{
    public function __construct(
        private Connection $connection,
        private LoggerInterface $logger,
        private RequestStack $requestStack
    ) {}

    /**
     * Získá data přílohy podle ID
     */
    public function getAttachmentById(int $id): ?array
    {
        try {
            $result = $this->connection->fetchAssociative(
                'SELECT id, original_name, mime_type, size, path, public_url, is_public, thumbnail_path, usage_info
                 FROM file_attachments 
                 WHERE id = :id',
                ['id' => $id]
            );

            if (!$result) {
                return null;
            }

            // Získat base URL z requestu
            $baseUrl = '';
            $request = $this->requestStack->getCurrentRequest();
            if ($request) {
                $baseUrl = $request->getSchemeAndHttpHost();
            }

            // Převést na strukturu kompatibilní s XML generátorem
            $attachment = [
                'id' => (int)$result['id'],
                'fileName' => $result['original_name'],
                'fileType' => $result['mime_type'],
                'fileSize' => (int)$result['size'],
                'url' => $baseUrl . '/uploads/' . $result['path'], // kompletní URL
                'isPublic' => (bool)$result['is_public']
            ];
            
            // Add thumbnail URL if exists
            if ($result['thumbnail_path']) {
                $attachment['thumbnailUrl'] = $baseUrl . '/uploads/' . $result['thumbnail_path'];
            }
            
            // Add usage count if usage_info exists
            if ($result['usage_info']) {
                $usageInfo = json_decode($result['usage_info'], true) ?: [];
                $attachment['usageCount'] = array_sum(array_map('count', $usageInfo));
            }
            
            return $attachment;
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch attachment', [
                'attachment_id' => $id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Získá data více příloh podle pole ID
     */
    public function getAttachmentsByIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        // Filtrovat jen validní čísla
        $validIds = array_filter($ids, 'is_numeric');
        if (empty($validIds)) {
            return [];
        }

        try {
            $placeholders = implode(',', array_fill(0, count($validIds), '?'));
            
            $results = $this->connection->fetchAllAssociative(
                "SELECT id, original_name, mime_type, size, path, public_url, is_public, thumbnail_path, usage_info
                 FROM file_attachments 
                 WHERE id IN ($placeholders)
                 ORDER BY id",
                $validIds
            );

            // Získat base URL z requestu
            $baseUrl = '';
            $request = $this->requestStack->getCurrentRequest();
            if ($request) {
                $baseUrl = $request->getSchemeAndHttpHost();
            }

            // Převést na strukturu kompatibilní s XML generátorem
            return array_map(function ($result) use ($baseUrl) {
                $attachment = [
                    'id' => (int)$result['id'],
                    'fileName' => $result['original_name'],
                    'fileType' => $result['mime_type'],
                    'fileSize' => (int)$result['size'],
                    'url' => $baseUrl . '/uploads/' . $result['path'], // kompletní URL
                    'isPublic' => (bool)$result['is_public']
                ];
                
                // Add thumbnail URL if exists
                if ($result['thumbnail_path']) {
                    $attachment['thumbnailUrl'] = $baseUrl . '/uploads/' . $result['thumbnail_path'];
                }
                
                // Add usage count if usage_info exists
                if ($result['usage_info']) {
                    $usageInfo = json_decode($result['usage_info'], true) ?: [];
                    $attachment['usageCount'] = array_sum(array_map('count', $usageInfo));
                }
                
                return $attachment;
            }, $results);
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch attachments', [
                'attachment_ids' => $ids,
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }
}